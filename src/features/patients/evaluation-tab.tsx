"use client";

// Pestaña "Valoración" → sub-pestaña "Valoración": valoración escrita por
// bloques, con fecha y tipo ("Valoración inicial" o "Valoración", lo elige el
// profesional). Se crean en blanco o copiando el texto de una anterior. Se lee
// en limpio y con "Editar" se modifican todos los bloques a la vez y se
// guardan juntos con un solo botón. Dentro de cada bloque se
// muestra, en solo lectura, el resultado más actual de las escalas de esa
// área (leído en vivo de las evaluaciones registradas en "Escalas").
// COMPARTIDA: la ve todo el equipo con acceso clínico al usuario/a.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetcher, useMe } from "@/hooks/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RichTextarea } from "@/components/rich-textarea";
import { ClinicalNotes } from "@/components/clinical-notes";
import { formatDate } from "@/components/domain";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { QUALITATIVE_SCALES } from "@/lib/schemas";
import {
  EVALUATION_KINDS,
  OT_PROFESSION,
  evaluationSectionsFor,
  EVALUATION_TEXT_FIELDS,
  type EvaluationKind,
  type EvaluationSectionDef,
  type EvaluationTextField,
  type PatientEvaluationDTO,
} from "@/lib/evaluations";
import type { AssessmentDTO } from "@/types/domain";
import { ClipboardList, Copy, FilePlus2, Gauge, Save, Trash2, Lock, Pencil, X } from "lucide-react";

type Drafts = Record<EvaluationTextField, string>;
type UnsavedEntry = { fields: Partial<Drafts>; date?: string; kind?: EvaluationKind };

// Borradores SIN GUARDAR de cada valoración (solo los campos modificados),
// guardados fuera del componente para que no se pierdan al cambiar de
// sub-pestaña (p. ej. "Ir a escalas") o de pestaña y volver.
const unsavedDrafts = new Map<string, UnsavedEntry>();

const todayStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

function draftsFrom(ev: PatientEvaluationDTO): Drafts {
  return Object.fromEntries(EVALUATION_TEXT_FIELDS.map((f) => [f, ev[f] ?? ""])) as Drafts;
}

// RichTextarea puede dejar restos vacíos ("<br>", "<div><br></div>") al
// borrar: se normalizan para no marcar como "sin guardar" algo que no cambió.
function normalizeHtml(html: string): string {
  const stripped = (html ?? "").replace(/<br\s*\/?>/gi, "").replace(/<(div|p)>\s*<\/\1>/gi, "").replace(/&nbsp;/g, " ").trim();
  return stripped === "" ? "" : html;
}

export function EvaluationTab({
  patientId,
  assessments,
  allowedScales,
  onGoToScales,
  onOpenAssessment,
}: {
  patientId: string;
  // Escalas que puede usar este profesional (por profesión). Los bloques solo
  // muestran el recuadro de resultados con las escalas de su perfil.
  allowedScales: readonly string[];
  // Evaluaciones de escalas YA filtradas por profesión (las que este
  // profesional puede ver).
  assessments: AssessmentDTO[];
  onGoToScales: () => void;
  onOpenAssessment: (id: string) => void;
}) {
  const qc = useQueryClient();
  const queryKey = ["evaluations", patientId];
  const { data: me } = useMe();
  const { data: evaluations, isLoading } = useQuery<PatientEvaluationDTO[]>({
    queryKey,
    queryFn: () => fetcher(`/api/patients/${patientId}/evaluations`),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  // Modo edición: la valoración se lee "limpia" y, al pulsar Editar, todos
  // los bloques pasan a ser editables y se guardan juntos con un solo botón.
  const [editing, setEditing] = useState(false);
  const [metaDraft, setMetaDraft] = useState<{ date: string; kind: EvaluationKind } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  // Valoración recién creada: se abre directamente en modo edición.
  const openInEditRef = useRef<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Acción pendiente de confirmar porque hay cambios sin guardar.
  const [pendingAction, setPendingAction] = useState<
    { type: "switch"; id: string } | { type: "cancel" } | { type: "profession"; profession: string } | null
  >(null);
  // Profesión cuyas valoraciones se ven. Por defecto, la mía. Todos pueden
  // LEER las de las demás profesiones, pero solo editar las suyas.
  const [professionChoice, setProfessionChoice] = useState<string | null>(null);
  const profession = professionChoice ?? me?.role ?? OT_PROFESSION;
  const canEdit = me?.role === profession;
  const sections = evaluationSectionsFor(profession);
  const myRole = me?.role;
  const professions = useMemo(() => {
    const set = new Set<string>((evaluations ?? []).map((e) => e.profession));
    if (myRole) set.add(myRole);
    return [...set].sort();
  }, [evaluations, myRole]);

  const list = useMemo(() => (evaluations ?? []).filter((e) => e.profession === profession), [evaluations, profession]);
  const selectedIndex = list.findIndex((e) => e.id === selectedId);
  const selected = selectedIndex >= 0 ? list[selectedIndex] : null;
  const isEditing = editing && canEdit && !!selected;

  // Selección por defecto: la más reciente. Si la seleccionada desaparece
  // (borrada), se vuelve a la más reciente.
  useEffect(() => {
    if (list.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !list.some((e) => e.id === selectedId)) {
      setSelectedId(list[0].id);
    }
  }, [list, selectedId]);

  // Al cambiar de valoración se cargan sus textos como borrador. Si había
  // cambios sin guardar de esa valoración (p. ej. al volver de "Escalas"),
  // se recuperan y se sigue en modo edición.
  const selectedKey = selected?.id ?? null;
  useEffect(() => {
    if (!selectedKey) { setDrafts(null); setMetaDraft(null); setEditing(false); return; }
    const ev = list.find((e) => e.id === selectedKey);
    if (!ev) return;
    const pending = unsavedDrafts.get(ev.id);
    setDrafts({ ...draftsFrom(ev), ...(pending?.fields ?? {}) });
    setMetaDraft({ date: pending?.date ?? ev.date, kind: pending?.kind ?? ev.kind });
    setEditing(!!pending || openInEditRef.current === ev.id);
    openInEditRef.current = null;
    // Solo al cambiar de valoración: tras guardar, el borrador ya coincide.
  }, [selectedKey]);

  const isFieldDirty = (f: EvaluationTextField) =>
    !!selected && !!drafts && normalizeHtml(drafts[f]) !== normalizeHtml(selected[f]);
  const isSectionDirty = (s: EvaluationSectionDef) => s.fields.some((x) => isFieldDirty(x.field));
  const metaDirty = !!selected && !!metaDraft && (metaDraft.date !== selected.date || metaDraft.kind !== selected.kind);
  const anyDirty = isEditing && (metaDirty || sections.some(isSectionDirty));

  // Mantiene al día el almacén de borradores sin guardar.
  useEffect(() => {
    if (!selected || !drafts || !metaDraft) return;
    if (!editing) { unsavedDrafts.delete(selected.id); return; }
    const fields: Partial<Drafts> = {};
    for (const f of EVALUATION_TEXT_FIELDS) {
      if (normalizeHtml(drafts[f]) !== normalizeHtml(selected[f])) fields[f] = drafts[f];
    }
    const entry: UnsavedEntry = { fields };
    if (metaDraft.date !== selected.date) entry.date = metaDraft.date;
    if (metaDraft.kind !== selected.kind) entry.kind = metaDraft.kind;
    if (Object.keys(fields).length > 0 || entry.date || entry.kind) unsavedDrafts.set(selected.id, entry);
    else unsavedDrafts.delete(selected.id);
  }, [drafts, metaDraft, selected, editing]);

  // Aviso del navegador si se intenta cerrar/recargar con cambios sin guardar.
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);

  function replaceInCache(updated: PatientEvaluationDTO) {
    qc.setQueryData<PatientEvaluationDTO[]>(queryKey, (old) =>
      sortEvaluations((old ?? []).map((e) => (e.id === updated.id ? updated : e))),
    );
  }

  const save = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { fields?: Partial<Drafts>; date?: string; kind?: EvaluationKind } }) =>
      fetcher<PatientEvaluationDTO>(`/api/patients/${patientId}/evaluations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (updated) => {
      unsavedDrafts.delete(updated.id);
      replaceInCache(updated);
      setDrafts(draftsFrom(updated));
      setMetaDraft({ date: updated.date, kind: updated.kind });
      setEditing(false);
      toast({ title: "Valoración guardada" });
    },
    onError: (err) => toast({ title: "Error al guardar", description: errDetail(err, "No se ha podido guardar la valoración."), variant: "destructive" }),
  });

  function saveAll() {
    if (!selected || !drafts || !metaDraft) return;
    if (!anyDirty) { setEditing(false); return; }
    const body: { fields?: Partial<Drafts>; date?: string; kind?: EvaluationKind } = {};
    const fields: Partial<Drafts> = {};
    for (const f of EVALUATION_TEXT_FIELDS) {
      if (isFieldDirty(f)) fields[f] = normalizeHtml(drafts[f]);
    }
    if (Object.keys(fields).length > 0) body.fields = fields;
    if (metaDraft.date !== selected.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(metaDraft.date)) {
        toast({ title: "Fecha no válida", variant: "destructive" });
        return;
      }
      body.date = metaDraft.date;
    }
    if (metaDraft.kind !== selected.kind) body.kind = metaDraft.kind;
    save.mutate({ id: selected.id, body });
  }

  function discardEdits() {
    if (selected) {
      unsavedDrafts.delete(selected.id);
      setDrafts(draftsFrom(selected));
      setMetaDraft({ date: selected.date, kind: selected.kind });
    }
    setEditing(false);
  }

  const create = useMutation({
    mutationFn: (payload: { date: string; kind: EvaluationKind; copyFromId?: string }) =>
      fetcher<PatientEvaluationDTO>(`/api/patients/${patientId}/evaluations`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (created) => {
      qc.setQueryData<PatientEvaluationDTO[]>(queryKey, (old) => sortEvaluations([created, ...(old ?? [])]));
      openInEditRef.current = created.id;
      setSelectedId(created.id);
      setNewOpen(false);
      toast({ title: "Valoración creada", description: `${created.kind} · ${formatDate(created.date)}` });
    },
    onError: (err) => toast({ title: "Error", description: errDetail(err, "No se ha podido crear la valoración."), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetcher<{ ok: true }>(`/api/patients/${patientId}/evaluations/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => {
      unsavedDrafts.delete(id);
      qc.setQueryData<PatientEvaluationDTO[]>(queryKey, (old) => (old ?? []).filter((e) => e.id !== id));
      setDeleteOpen(false);
      setEditing(false);
      toast({ title: "Valoración eliminada" });
    },
    onError: () => toast({ title: "Error", description: "No se ha podido eliminar la valoración.", variant: "destructive" }),
  });

  function requestSwitch(id: string) {
    if (id === selectedId) return;
    if (anyDirty) { setPendingAction({ type: "switch", id }); return; }
    unsavedDrafts.delete(selectedId ?? "");
    setEditing(false);
    setSelectedId(id);
  }

  function requestCancel() {
    if (anyDirty) { setPendingAction({ type: "cancel" }); return; }
    discardEdits();
  }

  function requestProfession(p: string) {
    if (p === profession) return;
    if (anyDirty) { setPendingAction({ type: "profession", profession: p }); return; }
    discardEdits();
    setProfessionChoice(p);
    setSelectedId(null);
  }

  function confirmPending() {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    discardEdits();
    if (action.type === "switch") setSelectedId(action.id);
    if (action.type === "profession") { setProfessionChoice(action.profession); setSelectedId(null); }
  }

  function openNewDialog() {
    if (anyDirty) {
      toast({ title: "Tienes cambios sin guardar", description: "Guarda o cancela la edición antes de crear una valoración nueva.", variant: "destructive" });
      return;
    }
    setNewOpen(true);
  }

  // Resultado más actual de cada escala PARA LA VALORACIÓN SELECCIONADA:
  // - si es la más reciente → el último registrado, sea de cuando sea;
  // - si es una anterior → el último registrado antes de la siguiente
  //   valoración, para que las valoraciones antiguas no "cambien" con el
  //   tiempo al pasar escalas nuevas.
  const latestByScale = useMemo(() => {
    const map = new Map<string, AssessmentDTO>();
    if (!selected) return map;
    const upper = selectedIndex > 0 ? list[selectedIndex - 1].date : null;
    const sorted = [...assessments].sort((a, b) => b.date.localeCompare(a.date));
    for (const a of sorted) {
      if (upper && a.date.slice(0, 10) >= upper) continue;
      if (!map.has(a.scale)) map.set(a.scale, a);
    }
    return map;
  }, [assessments, selected, selectedIndex, list]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const hasText = (h?: string) => !!h && h.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Valoraciones de qué profesión se están viendo */}
      {professions.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap text-xs">
          <span className="text-muted-foreground mr-1">Profesión:</span>
          {professions.map((p) => (
            <button key={p} type="button"
              onClick={() => requestProfession(p)}
              className={cn("rounded-full border px-2.5 py-1 transition-colors",
                p === profession ? "bg-[#6e6587] border-[#6e6587] text-white" : "hover:bg-muted text-muted-foreground")}>
              {p}{p === me?.role ? " (tú)" : ""}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 || !selected || !drafts || !metaDraft ? (
        <Card className="p-8 text-center space-y-3">
          <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">Todavía no hay ninguna valoración de {profession} para este/a usuario/a.</p>
          {canEdit && (
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <FilePlus2 className="w-3.5 h-3.5 mr-1" />Nueva valoración
              </Button>
              {allowedScales.length > 0 && (
                <Button size="sm" variant="outline" onClick={onGoToScales}>
                  <Gauge className="w-3.5 h-3.5 mr-1" />Ir a escalas
                </Button>
              )}
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* Cabecera compacta: selector de valoración, tipo, fecha, autoría y acciones */}
          <div className={cn("flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2", isEditing && "border-[#1a5c58]/40")}>
            <Select value={selected.id} onValueChange={requestSwitch}>
              <SelectTrigger className="h-8 w-60 text-sm font-medium" aria-label="Valoración">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {list.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.kind} · {formatDate(e.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isEditing ? (
              <>
                <KindToggle value={metaDraft.kind} onChange={(kind) => setMetaDraft((m) => (m ? { ...m, kind } : m))} />
                <Input
                  type="date"
                  aria-label="Fecha de la valoración"
                  className="h-8 w-36 text-sm"
                  value={metaDraft.date}
                  onChange={(e) => { const date = e.target.value; setMetaDraft((m) => (m ? { ...m, date } : m)); }}
                />
                <span className="flex-1" />
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={requestCancel} disabled={save.isPending}>
                  <X className="w-3.5 h-3.5 mr-1" />Cancelar
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={saveAll} disabled={save.isPending}>
                  <Save className="w-3.5 h-3.5 mr-1" />{save.isPending ? "Guardando…" : "Guardar"}
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-[160px] text-[11px] text-muted-foreground leading-tight">
                  {profession} · {selected.authorName}
                  {!canEdit && <> · <span className="inline-flex items-center gap-0.5"><Lock className="w-3 h-3" />solo lectura</span></>}
                  {selected.updatedByName && <> · editada por {selected.updatedByName}, {formatDate(selected.updatedAt)}</>}
                </span>
                {allowedScales.length > 0 && canEdit && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onGoToScales}>
                    <Gauge className="w-3.5 h-3.5 mr-1" />Escalas
                  </Button>
                )}
                {canEdit && (
                  <>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={openNewDialog}>
                      <FilePlus2 className="w-3.5 h-3.5 mr-1" />Nueva valoración
                    </Button>
                    <Button size="sm" className="h-8 text-xs" onClick={() => setEditing(true)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" />Editar
                    </Button>
                  </>
                )}
                {me?.id === selected.authorId && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="Eliminar valoración" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Bloques: todos en una sola tarjeta, separados por líneas, con el
              título a la izquierda en pantallas anchas para ahorrar altura. */}
          <Card className="overflow-hidden py-0 gap-0">
            {sections.map((section, idx) => {
              const dirty = isEditing && isSectionDirty(section);
              const sectionScales = section.scales.filter((sc) => allowedScales.includes(sc));
              return (
                <section
                  key={section.key}
                  className={cn(
                    "grid gap-x-4 gap-y-2 px-4 py-3 lg:grid-cols-[11rem_1fr]",
                    idx > 0 && "border-t",
                    dirty && "bg-amber-50/60",
                  )}
                >
                  <div>
                    <h3 className="text-sm font-semibold leading-tight">{section.title}</h3>
                    <p className="hidden lg:block text-[11px] text-muted-foreground leading-snug mt-0.5">{section.hint}</p>
                    {dirty && <p className="text-[11px] text-amber-700 mt-1">Sin guardar</p>}
                  </div>

                  {/* Escalas + texto */}
                  <div className="space-y-2 min-w-0">
                    {sectionScales.length > 0 && (
                      <ScaleResultsRow
                        scales={sectionScales}
                        latestByScale={latestByScale}
                        onGoToScales={onGoToScales}
                        onOpenAssessment={onOpenAssessment}
                      />
                    )}
                    <div className={cn("grid gap-3", section.fields.length > 1 && "md:grid-cols-2")}>
                      {section.fields.map((x) => (
                        <div key={x.field} className="space-y-1 min-w-0">
                          {x.label && <p className="text-xs font-semibold text-muted-foreground">{x.label}</p>}
                          {isEditing ? (
                            <RichTextarea
                              key={`${selected.id}-${x.field}`}
                              tone="filled"
                              value={drafts[x.field]}
                              onChange={(html) => setDrafts((d) => (d ? { ...d, [x.field]: html } : d))}
                              rows={section.key === "free" ? 10 : 3}
                              placeholder={x.placeholder}
                            />
                          ) : hasText(selected[x.field]) ? (
                            <div
                              className={cn("rounded-md bg-muted/30 px-3 py-2", canEdit && "cursor-text hover:bg-muted/50 transition-colors")}
                              title={canEdit ? "Doble clic para editar" : undefined}
                              onDoubleClick={canEdit ? () => setEditing(true) : undefined}
                            >
                              <ClinicalNotes html={selected[x.field]} />
                            </div>
                          ) : (
                            <p className="rounded-md bg-muted/20 px-3 py-2 text-sm text-muted-foreground italic">Sin rellenar</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </Card>

          {/* Barra fija abajo mientras se edita: Guardar siempre a mano */}
          {isEditing && (
            <div className="sticky bottom-3 z-10 flex items-center justify-end gap-2 rounded-lg border bg-background/95 backdrop-blur px-3 py-2 shadow-md">
              <span className="mr-auto text-xs text-muted-foreground">
                {anyDirty ? <span className="text-amber-700">Hay cambios sin guardar</span> : "Editando valoración"}
              </span>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={requestCancel} disabled={save.isPending}>
                Cancelar
              </Button>
              <Button size="sm" className="h-8 text-xs" onClick={saveAll} disabled={save.isPending}>
                <Save className="w-3.5 h-3.5 mr-1" />{save.isPending ? "Guardando…" : "Guardar valoración"}
              </Button>
            </div>
          )}
        </>
      )}

      <NewEvaluationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        previous={list}
        pending={create.isPending}
        onCreate={(payload) => create.mutate(payload)}
      />

      {/* Confirmar acción con cambios sin guardar */}
      <AlertDialog open={!!pendingAction} onOpenChange={(o) => { if (!o) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hay cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Si continúas se perderán los cambios que no has guardado en esta valoración.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPending}>Descartar cambios</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar borrado */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta valoración?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la valoración del {selected ? formatDate(selected.date) : ""} con todo su texto. Las escalas registradas no se borran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() => { if (selected) remove.mutate(selected.id); }}
            >
              {remove.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Selector "Valoración inicial" / "Valoración" en dos pastillas.
function KindToggle({ value, onChange }: { value: EvaluationKind; onChange: (k: EvaluationKind) => void }) {
  return (
    <div className="inline-flex rounded-md border p-0.5 text-xs" role="radiogroup" aria-label="Tipo de valoración">
      {EVALUATION_KINDS.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cn("rounded px-2.5 py-1 transition-colors",
            value === k ? "bg-[#6e6587] text-white" : "text-muted-foreground hover:bg-muted")}>
          {k}
        </button>
      ))}
    </div>
  );
}

function errDetail(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : "";
  return msg && msg.length < 200 ? `${fallback} (${msg})` : fallback;
}

function sortEvaluations(list: PatientEvaluationDTO[]): PatientEvaluationDTO[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

// Resultados de escalas del bloque en una sola línea de "fichas" compactas
// (escala · resultado · fecha). Clic en una ficha → abre la evaluación.
// Tono gris-violeta apagado, a juego con las pestañas de Valoración.
function ScaleResultsRow({
  scales,
  latestByScale,
  onGoToScales,
  onOpenAssessment,
}: {
  scales: readonly string[];
  latestByScale: Map<string, AssessmentDTO>;
  onGoToScales: () => void;
  onOpenAssessment: (id: string) => void;
}) {
  const items = scales.map((s) => latestByScale.get(s)).filter(Boolean) as AssessmentDTO[];
  const isQualitative = (scale: string) => (QUALITATIVE_SCALES as readonly string[]).includes(scale);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6e6587]">
        <Gauge className="w-3 h-3" />Escalas:
      </span>
      {items.length === 0 ? (
        <span className="text-[11px] text-muted-foreground italic">sin registrar</span>
      ) : (
        items.map((a) => {
          const value = isQualitative(a.scale) ? (a.notes || a.score) : a.score;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpenAssessment(a.id)}
              title={`${a.scale}: ${value} (${formatDate(a.date)}) — ver evaluación`}
              className="inline-flex items-center gap-1 max-w-[22rem] rounded-full border border-[#ddd8e6] bg-[#f5f3f8] px-2 py-0.5 text-[11px] text-slate-700 hover:bg-[#ebe7f1] transition-colors"
            >
              <span className="font-semibold text-[#5b536f] shrink-0">{a.scale}</span>
              <span className="truncate font-mono">{value}</span>
              <span className="text-muted-foreground shrink-0">· {formatDate(a.date)}</span>
            </button>
          );
        })
      )}
      <button type="button" onClick={onGoToScales} className="text-[11px] text-[#6e6587] hover:underline ml-0.5">
        + Pasar escala
      </button>
    </div>
  );
}

function NewEvaluationDialog({
  open,
  onOpenChange,
  previous,
  pending,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previous: PatientEvaluationDTO[];
  pending: boolean;
  onCreate: (payload: { date: string; kind: EvaluationKind; copyFromId?: string }) => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [kind, setKind] = useState<EvaluationKind>("Valoración");
  const [mode, setMode] = useState<"blank" | "copy">("blank");
  const [copyFromId, setCopyFromId] = useState<string>("");
  const isFirst = previous.length === 0;

  // Cada vez que se abre: fecha de hoy y, si hay anteriores, propone copiar
  // la más reciente.
  useEffect(() => {
    if (!open) return;
    setDate(todayStr());
    setKind(previous.length === 0 ? "Valoración inicial" : "Valoración");
    setMode(previous.length > 0 ? "copy" : "blank");
    setCopyFromId(previous[0]?.id ?? "");
  }, [open, previous]);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && (mode === "blank" || !!copyFromId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva valoración</DialogTitle>
          <DialogDescription>
            {isFirst
              ? "Elige el tipo y la fecha de la valoración."
              : "Elige el tipo, la fecha y si quieres empezar en blanco o partir del texto de una valoración anterior."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <KindToggle value={kind} onChange={setKind} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-evaluation-date" className="text-xs">Fecha</Label>
              <Input id="new-evaluation-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-40" />
            </div>
          </div>

          {!isFirst && (
            <div className="space-y-2">
              <Label className="text-xs">Contenido</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMode("blank")}
                  className={cn("rounded-md border px-3 py-2 text-xs text-left transition-colors",
                    mode === "blank" ? "border-[#1a5c58] bg-[#1a5c58]/5 font-medium text-[#1a5c58]" : "hover:bg-muted/60")}>
                  <FilePlus2 className="w-3.5 h-3.5 mb-1" />En blanco
                </button>
                <button type="button" onClick={() => setMode("copy")}
                  className={cn("rounded-md border px-3 py-2 text-xs text-left transition-colors",
                    mode === "copy" ? "border-[#1a5c58] bg-[#1a5c58]/5 font-medium text-[#1a5c58]" : "hover:bg-muted/60")}>
                  <Copy className="w-3.5 h-3.5 mb-1" />Copiar texto de una anterior
                </button>
              </div>
              {mode === "copy" && (
                <Select value={copyFromId} onValueChange={setCopyFromId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Elige la valoración a copiar" />
                  </SelectTrigger>
                  <SelectContent>
                    {previous.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.kind} · {formatDate(e.date)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!valid || pending}
            onClick={() => onCreate(mode === "copy" && copyFromId ? { date, kind, copyFromId } : { date, kind })}
          >
            {pending ? "Creando…" : "Crear valoración"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
