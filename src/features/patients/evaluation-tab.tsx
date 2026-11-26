"use client";

// Pestaña "Valoración" → sub-pestaña "Valoración": valoración escrita por
// bloques, con fecha. La primera es la valoración inicial; las siguientes,
// revaloraciones (se pueden crear en blanco o copiando el texto de una
// anterior). Cada bloque se guarda por separado. Dentro de cada bloque se
// muestra, en solo lectura, el resultado más actual de las escalas de esa
// área (leído en vivo de las evaluaciones registradas en "Escalas").
// COMPARTIDA: la ve todo el equipo con acceso clínico al usuario/a.

import { useEffect, useMemo, useState } from "react";
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
import { formatDate } from "@/components/domain";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { QUALITATIVE_SCALES } from "@/lib/schemas";
import {
  EVALUATION_SECTIONS,
  EVALUATION_TEXT_FIELDS,
  type EvaluationSectionDef,
  type EvaluationTextField,
  type PatientEvaluationDTO,
} from "@/lib/evaluations";
import type { AssessmentDTO } from "@/types/domain";
import { ClipboardList, Copy, FilePlus2, Gauge, Save, Trash2, Check } from "lucide-react";

type Drafts = Record<EvaluationTextField, string>;

// Borradores SIN GUARDAR de cada valoración (solo los campos modificados),
// guardados fuera del componente para que no se pierdan al cambiar de
// sub-pestaña (p. ej. "Ir a escalas") o de pestaña y volver.
const unsavedDrafts = new Map<string, Partial<Drafts>>();

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
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);

  const list = useMemo(() => evaluations ?? [], [evaluations]);
  const selectedIndex = list.findIndex((e) => e.id === selectedId);
  const selected = selectedIndex >= 0 ? list[selectedIndex] : null;
  // La más antigua es la valoración inicial; el resto, revaloraciones.
  const isInitial = selected ? selectedIndex === list.length - 1 : false;

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

  // Al cambiar de valoración se cargan sus textos como borrador.
  const selectedKey = selected?.id ?? null;
  useEffect(() => {
    if (!selectedKey) { setDrafts(null); return; }
    const ev = list.find((e) => e.id === selectedKey);
    if (ev) setDrafts({ ...draftsFrom(ev), ...(unsavedDrafts.get(ev.id) ?? {}) });
    // Solo al cambiar de valoración: tras guardar, el borrador ya coincide.
  }, [selectedKey]);

  const isFieldDirty = (f: EvaluationTextField) =>
    !!selected && !!drafts && normalizeHtml(drafts[f]) !== normalizeHtml(selected[f]);
  const isSectionDirty = (s: EvaluationSectionDef) => s.fields.some((x) => isFieldDirty(x.field));
  const anyDirty = EVALUATION_SECTIONS.some(isSectionDirty);

  // Mantiene al día el almacén de borradores sin guardar.
  useEffect(() => {
    if (!selected || !drafts) return;
    const dirtyFields: Partial<Drafts> = {};
    for (const f of EVALUATION_TEXT_FIELDS) {
      if (normalizeHtml(drafts[f]) !== normalizeHtml(selected[f])) dirtyFields[f] = drafts[f];
    }
    if (Object.keys(dirtyFields).length > 0) unsavedDrafts.set(selected.id, dirtyFields);
    else unsavedDrafts.delete(selected.id);
  }, [drafts, selected]);

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

  const saveFields = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<Drafts>; sectionKey: string }) =>
      fetcher<PatientEvaluationDTO>(`/api/patients/${patientId}/evaluations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ fields }),
      }),
    onSuccess: (updated, vars) => {
      replaceInCache(updated);
      setSavedSection(vars.sectionKey);
      toast({ title: "Bloque guardado" });
    },
    onError: () => toast({ title: "Error al guardar", description: "No se ha podido guardar el bloque.", variant: "destructive" }),
  });

  const changeDate = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      fetcher<PatientEvaluationDTO>(`/api/patients/${patientId}/evaluations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ date }),
      }),
    onSuccess: (updated) => { replaceInCache(updated); toast({ title: "Fecha actualizada" }); },
    onError: () => toast({ title: "Error", description: "No se ha podido cambiar la fecha.", variant: "destructive" }),
  });

  const create = useMutation({
    mutationFn: (payload: { date: string; copyFromId?: string }) =>
      fetcher<PatientEvaluationDTO>(`/api/patients/${patientId}/evaluations`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (created) => {
      qc.setQueryData<PatientEvaluationDTO[]>(queryKey, (old) => sortEvaluations([created, ...(old ?? [])]));
      setSelectedId(created.id);
      setDrafts(draftsFrom(created));
      setNewOpen(false);
      toast({ title: "Valoración creada", description: formatDate(created.date) });
    },
    onError: () => toast({ title: "Error", description: "No se ha podido crear la valoración.", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetcher<{ ok: true }>(`/api/patients/${patientId}/evaluations/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => {
      unsavedDrafts.delete(id);
      qc.setQueryData<PatientEvaluationDTO[]>(queryKey, (old) => (old ?? []).filter((e) => e.id !== id));
      setDeleteOpen(false);
      toast({ title: "Valoración eliminada" });
    },
    onError: () => toast({ title: "Error", description: "No se ha podido eliminar la valoración.", variant: "destructive" }),
  });

  function requestSwitch(id: string) {
    if (id === selectedId) return;
    if (anyDirty) { setPendingSwitchId(id); return; }
    setSelectedId(id);
    setSavedSection(null);
  }

  function openNewDialog() {
    if (anyDirty) {
      toast({ title: "Tienes cambios sin guardar", description: "Guarda o descarta los bloques modificados antes de crear una valoración nueva.", variant: "destructive" });
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

  return (
    <div className="space-y-4">
      {list.length === 0 || !selected || !drafts ? (
        <Card className="p-8 text-center space-y-3">
          <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">Todavía no hay ninguna valoración para este/a usuario/a.</p>
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <FilePlus2 className="w-3.5 h-3.5 mr-1" />Crear valoración inicial
            </Button>
            <Button size="sm" variant="outline" onClick={onGoToScales}>
              <Gauge className="w-3.5 h-3.5 mr-1" />Ir a escalas
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Cabecera compacta: selector de valoración, fecha, autoría y acciones */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <Select value={selected.id} onValueChange={requestSwitch}>
              <SelectTrigger className="h-8 w-60 text-sm font-medium" aria-label="Valoración">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {list.map((e, i) => (
                  <SelectItem key={e.id} value={e.id}>
                    {i === list.length - 1 ? "Valoración inicial" : "Revaloración"} · {formatDate(e.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              aria-label="Fecha de la valoración"
              className="h-8 w-36 text-sm"
              value={selected.date}
              disabled={changeDate.isPending}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v !== selected.date) {
                  changeDate.mutate({ id: selected.id, date: v });
                }
              }}
            />
            <span className="flex-1 min-w-[160px] text-[11px] text-muted-foreground leading-tight">
              {isInitial ? "Valoración inicial" : "Revaloración"} · {selected.authorName}
              {selected.updatedByName && <> · editada por {selected.updatedByName}, {formatDate(selected.updatedAt)}</>}
            </span>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onGoToScales}>
              <Gauge className="w-3.5 h-3.5 mr-1" />Escalas
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={openNewDialog}>
              <FilePlus2 className="w-3.5 h-3.5 mr-1" />Nueva valoración
            </Button>
            {me?.id === selected.authorId && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label="Eliminar valoración" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Bloques: todos en una sola tarjeta, separados por líneas, con el
              título a la izquierda en pantallas anchas para ahorrar altura. */}
          <Card className="overflow-hidden py-0 gap-0">
            {EVALUATION_SECTIONS.map((section, idx) => {
              const dirty = isSectionDirty(section);
              const saving = saveFields.isPending && saveFields.variables?.sectionKey === section.key;
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
                  {/* Título + guardar */}
                  <div className="flex lg:flex-col items-start justify-between lg:justify-start gap-1.5">
                    <div>
                      <h3 className="text-sm font-semibold leading-tight">{section.title}</h3>
                      <p className="hidden lg:block text-[11px] text-muted-foreground leading-snug mt-0.5">{section.hint}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button size="sm" variant={dirty ? "default" : "outline"} className="h-7 px-2.5 text-xs" disabled={!dirty || saving}
                        onClick={() => {
                          const fields: Partial<Drafts> = {};
                          for (const x of section.fields) fields[x.field] = normalizeHtml(drafts[x.field]);
                          saveFields.mutate({ id: selected.id, fields, sectionKey: section.key });
                        }}>
                        <Save className="w-3 h-3 mr-1" />{saving ? "Guardando…" : "Guardar"}
                      </Button>
                      {dirty ? (
                        <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                          onClick={() => setDrafts((d) => {
                            if (!d) return d;
                            const next = { ...d };
                            for (const x of section.fields) next[x.field] = selected[x.field];
                            return next;
                          })}>
                          Descartar
                        </button>
                      ) : savedSection === section.key ? (
                        <span className="text-[11px] text-emerald-700 inline-flex items-center gap-0.5"><Check className="w-3 h-3" />Guardado</span>
                      ) : null}
                    </div>
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
                          <RichTextarea
                            key={`${selected.id}-${x.field}`}
                            tone="filled"
                            value={drafts[x.field]}
                            onChange={(html) => {
                              setSavedSection(null);
                              setDrafts((d) => (d ? { ...d, [x.field]: html } : d));
                            }}
                            rows={3}
                            placeholder={x.placeholder}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}
          </Card>
        </>
      )}

      <NewEvaluationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        previous={list}
        pending={create.isPending}
        onCreate={(payload) => create.mutate(payload)}
      />

      {/* Confirmar cambio de valoración con cambios sin guardar */}
      <AlertDialog open={!!pendingSwitchId} onOpenChange={(o) => { if (!o) setPendingSwitchId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hay cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Si cambias de valoración se perderán los cambios de los bloques que no has guardado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (selectedId) unsavedDrafts.delete(selectedId);
              if (pendingSwitchId) { setSelectedId(pendingSwitchId); setSavedSection(null); }
              setPendingSwitchId(null);
            }}>
              Descartar y cambiar
            </AlertDialogAction>
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
  onCreate: (payload: { date: string; copyFromId?: string }) => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState<"blank" | "copy">("blank");
  const [copyFromId, setCopyFromId] = useState<string>("");
  const isFirst = previous.length === 0;

  // Cada vez que se abre: fecha de hoy y, si hay anteriores, propone copiar
  // la más reciente.
  useEffect(() => {
    if (!open) return;
    setDate(todayStr());
    setMode(previous.length > 0 ? "copy" : "blank");
    setCopyFromId(previous[0]?.id ?? "");
  }, [open, previous]);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && (mode === "blank" || !!copyFromId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isFirst ? "Valoración inicial" : "Nueva valoración"}</DialogTitle>
          <DialogDescription>
            {isFirst
              ? "Se creará la valoración inicial con la fecha indicada."
              : "Elige la fecha y si quieres empezar en blanco o partir del texto de una valoración anterior."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-evaluation-date" className="text-xs">Fecha</Label>
            <Input id="new-evaluation-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
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
                    {previous.map((e, i) => (
                      <SelectItem key={e.id} value={e.id}>
                        {i === previous.length - 1 ? "Valoración inicial" : "Revaloración"} · {formatDate(e.date)}
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
            onClick={() => onCreate(mode === "copy" && copyFromId ? { date, copyFromId } : { date })}
          >
            {pending ? "Creando…" : "Crear valoración"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
