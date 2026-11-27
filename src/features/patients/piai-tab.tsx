"use client";

// Pestaña PIAI (Plan de Atención Individualizada) — solo Centro de día.
// Documento de EQUIPO, con la estructura de la plantilla del centro:
//   1. Información general (datos, descripción, aceptación)
//   2. Objetivos generales de la persona (con acciones)
//   3. Valoración de cada profesional (TS + ocio, TO, Logopedia, Fisio,
//      Psicología, Neuropsicología, Cuidados): cada uno edita SOLO el suyo,
//      todos leen todo. Los objetivos de TO son los del Plan de intervención.
//   4. Revisiones del PIA
// Todo se ve en modo lectura y cada bloque tiene su botón "Editar".

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher, useMe } from "@/hooks/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichTextarea } from "@/components/rich-textarea";
import { ClinicalNotes } from "@/components/clinical-notes";
import { formatDate } from "@/components/domain";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PIAI_ACTION_STATUSES, PIAI_GENERAL_FIELDS, PIAI_SECTIONS, PIAI_STATUSES, newId,
  type PiaiDTO, type PiaiGeneral, type PiaiGeneralObjective, type PiaiReview,
  type PiaiSectionContent, type PiaiSectionDef,
} from "@/lib/piai";
import type { PatientEvaluationDTO } from "@/lib/evaluations";
import { EVALUATION_SECTIONS } from "@/lib/evaluations";
import { InterventionPlanTab } from "./intervention-plan-tab";
import {
  ClipboardList, Copy, FileDown, FilePlus2, Lock, Pencil, Plus, Save, Trash2, X, Users, Flag, History, CheckCircle2,
} from "lucide-react";

const ACCENT = "#56608a";

// Mensaje real del servidor (p. ej. "tabla no existe") para poder diagnosticar.
function errDetail(e: unknown): string {
  const body = (e as { body?: { detail?: string; error?: string } })?.body;
  return body?.detail || body?.error || (e instanceof Error ? e.message : "Error desconocido");
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmt = (d?: string | null) => (d ? formatDate(d) : "—");
const hasHtmlText = (html?: string) => !!html && html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;

const STATUS_STYLE: Record<string, string> = {
  "En elaboración": "bg-amber-50 text-amber-800 border-amber-200",
  "Reunión": "bg-sky-50 text-sky-800 border-sky-200",
  "Devolución": "bg-violet-50 text-violet-800 border-violet-200",
  "Cerrado": "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export function PiaiTab({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const queryKey = ["piai", patientId];
  const { data: me } = useMe();
  const { data: list, isLoading } = useQuery<PiaiDTO[]>({
    queryKey,
    queryFn: () => fetcher(`/api/patients/${patientId}/piai`),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const piais = useMemo(() => list ?? [], [list]);
  const piai = piais.find((p) => p.id === selectedId) ?? piais[0] ?? null;

  function setCached(updated: PiaiDTO) {
    qc.setQueryData<PiaiDTO[]>(queryKey, (old) =>
      (old ?? []).map((p) => (p.id === updated.id ? updated : p)).sort((a, b) => b.date.localeCompare(a.date)),
    );
    // El Resumen muestra los objetivos del PIAI.
    qc.invalidateQueries({ queryKey: ["piai-summary", patientId] });
  }

  const patchPiai = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetcher<PiaiDTO>(`/api/patients/${patientId}/piai/${piai!.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: (u) => { setCached(u); toast({ title: "PIAI guardado" }); },
    onError: (e) => toast({ title: "No se ha podido guardar el PIAI", description: errDetail(e), variant: "destructive" }),
  });

  const saveSection = useMutation({
    mutationFn: ({ key, content }: { key: string; content: PiaiSectionContent }) =>
      fetcher<PiaiDTO>(`/api/patients/${patientId}/piai/${piai!.id}/sections/${key}`, { method: "PUT", body: JSON.stringify({ content }) }),
    onSuccess: (u) => { setCached(u); toast({ title: "Apartado guardado" }); },
    onError: (e) => toast({ title: "No se ha podido guardar el apartado", description: errDetail(e), variant: "destructive" }),
  });

  const create = useMutation({
    mutationFn: (payload: { date: string; copyFromId?: string }) =>
      fetcher<PiaiDTO>(`/api/patients/${patientId}/piai`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (c) => {
      qc.setQueryData<PiaiDTO[]>(queryKey, (old) => [c, ...(old ?? [])].sort((a, b) => b.date.localeCompare(a.date)));
      qc.invalidateQueries({ queryKey: ["piai-summary", patientId] });
      setSelectedId(c.id);
      setNewOpen(false);
      toast({ title: "PIAI creado" });
    },
    onError: (e) => toast({ title: "No se ha podido crear el PIAI", description: errDetail(e), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fetcher(`/api/patients/${patientId}/piai/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => {
      qc.setQueryData<PiaiDTO[]>(queryKey, (old) => (old ?? []).filter((p) => p.id !== id));
      qc.invalidateQueries({ queryKey: ["piai-summary", patientId] });
      setSelectedId(null);
      toast({ title: "PIAI eliminado" });
    },
    onError: (e) => toast({ title: "No se ha podido eliminar el PIAI", description: errDetail(e), variant: "destructive" }),
  });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-14 w-full" /><Skeleton className="h-64 w-full" /></div>;

  if (!piai) {
    return (
      <>
        <Card className="p-8 text-center space-y-3">
          <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">Todavía no hay ningún PIAI para este/a usuario/a.</p>
          <Button size="sm" onClick={() => setNewOpen(true)} className="mx-auto"><FilePlus2 className="w-3.5 h-3.5 mr-1" />Crear PIAI</Button>
        </Card>
        <NewPiaiDialog open={newOpen} onOpenChange={setNewOpen} previous={piais} pending={create.isPending} onCreate={(p) => create.mutate(p)} />
      </>
    );
  }

  const canDelete = me?.id === piai.createdById;

  return (
    <div className="space-y-4">
      {/* Barra: selector, fecha, estado, acciones */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <Select value={piai.id} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 w-48 text-sm font-medium" aria-label="PIAI"><SelectValue /></SelectTrigger>
          <SelectContent>
            {piais.map((p) => <SelectItem key={p.id} value={p.id}>PIAI · {formatDate(p.date)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" aria-label="Fecha del PIA" className="h-8 w-36 text-sm" value={piai.date}
          onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) patchPiai.mutate({ date: e.target.value }); }} />
        <Select value={piai.status} onValueChange={(v) => patchPiai.mutate({ status: v })}>
          <SelectTrigger className={cn("h-8 w-40 text-xs border", STATUS_STYLE[piai.status])} aria-label="Estado del PIA"><SelectValue /></SelectTrigger>
          <SelectContent>{PIAI_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <span className="flex-1 text-[11px] text-muted-foreground">Creado por {piai.createdByName}</span>
        <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
          <a href={`/api/patients/${patientId}/piai/${piai.id}/word`}><FileDown className="w-3.5 h-3.5 mr-1" />Descargar Word</a>
        </Button>
        <Button size="sm" className="h-8 text-xs" onClick={() => setNewOpen(true)}><FilePlus2 className="w-3.5 h-3.5 mr-1" />Nuevo PIAI</Button>
        {canDelete && (
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Eliminar PIAI"
            onClick={() => { if (confirm("¿Eliminar este PIAI con todos sus apartados? No se puede deshacer.")) remove.mutate(piai.id); }}>
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Índice rápido */}
      <nav className="flex flex-wrap gap-1.5 text-xs">
        {[
          { id: "piai-general", label: "Información general" },
          { id: "piai-objetivos", label: "Objetivos generales" },
          ...PIAI_SECTIONS.map((s) => ({ id: `piai-${s.key}`, label: s.title, done: hasHtmlText(piai.sections[s.key]?.content.assessment) })),
          { id: "piai-revisiones", label: "Revisiones" },
        ].map((x) => (
          <a key={x.id} href={`#${x.id}`} className="rounded-full border px-2.5 py-1 hover:bg-muted inline-flex items-center gap-1">
            {"done" in x && (x.done ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />)}
            {x.label}
          </a>
        ))}
      </nav>

      <GeneralBlock key={`g-${piai.id}`} piai={piai} saving={patchPiai.isPending} onSave={(general) => patchPiai.mutateAsync({ general })} />
      <GeneralObjectivesBlock key={`o-${piai.id}`} piai={piai} saving={patchPiai.isPending} onSave={(generalObjectives) => patchPiai.mutateAsync({ generalObjectives })} />

      <div className="flex items-center gap-2 pt-2">
        <Users className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-sm font-semibold">Valoraciones de los profesionales</h3>
        <span className="text-[11px] text-muted-foreground">Cada profesional edita solo su apartado; todos los ven.</span>
      </div>
      {PIAI_SECTIONS.map((def) => (
        <SectionBlock
          key={`${piai.id}-${def.key}`}
          def={def}
          piai={piai}
          patientId={patientId}
          canEdit={me?.role === def.role}
          saving={saveSection.isPending && saveSection.variables?.key === def.key}
          onSave={(content) => saveSection.mutateAsync({ key: def.key, content })}
        />
      ))}

      <ReviewsBlock key={`r-${piai.id}`} piai={piai} saving={patchPiai.isPending} onSave={(reviews) => patchPiai.mutateAsync({ reviews })} />

      <NewPiaiDialog open={newOpen} onOpenChange={setNewOpen} previous={piais} pending={create.isPending} onCreate={(p) => create.mutate(p)} />
    </div>
  );
}

// ─── Piezas comunes ──────────────────────────────────────────────────────────

function BlockCard({ id, icon: Icon, title, subtitle, editing, canEdit = true, onEdit, children }: {
  id: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  subtitle?: React.ReactNode;
  editing: boolean;
  canEdit?: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className={cn("py-0 gap-0 scroll-mt-4", editing && "ring-2 ring-[#56608a]/30")}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Icon className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
        <h4 className="text-sm font-semibold">{title}</h4>
        {subtitle && <span className="text-[11px] text-muted-foreground truncate">{subtitle}</span>}
        <span className="flex-1" />
        {!editing && (canEdit ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit}><Pencil className="w-3 h-3 mr-1" />Editar</Button>
        ) : (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Lock className="w-3 h-3" />Solo lectura</span>
        ))}
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </Card>
  );
}

function EditActions({ saving, onCancel, onSave }: { saving: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancel}>Cancelar</Button>
      <Button type="button" size="sm" className="h-8 text-xs" disabled={saving} onClick={onSave}>
        <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1 min-w-0", className)}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ReadValue({ value }: { value?: string | null }) {
  return value && value.trim()
    ? <p className="text-sm whitespace-pre-wrap">{value}</p>
    : <p className="text-sm text-muted-foreground/70">—</p>;
}

// Lista editable de textos (objetivos de un profesional, acciones…).
function StringListEditor({ items, onChange, placeholder, addLabel }: {
  items: string[]; onChange: (v: string[]) => void; placeholder: string; addLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
          <Input className="h-8 text-sm" value={t} placeholder={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" aria-label="Quitar" className="text-muted-foreground hover:text-destructive" onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <button type="button" className="text-xs text-primary hover:underline inline-flex items-center gap-1" onClick={() => onChange([...items, ""])}>
        <Plus className="w-3 h-3" />{addLabel}
      </button>
    </div>
  );
}

function NumberedList({ items, empty = "Sin objetivos." }: { items: string[]; empty?: string }) {
  const filled = items.filter((t) => t.trim());
  if (filled.length === 0) return <p className="text-sm text-muted-foreground/70">{empty}</p>;
  return (
    <ol className="space-y-1">
      {filled.map((t, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 bg-[#56608a]/10 text-[#56608a]">{i + 1}</span>
          <span className="leading-snug">{t}</span>
        </li>
      ))}
    </ol>
  );
}

// ─── 1. Información general ──────────────────────────────────────────────────

function GeneralBlock({ piai, saving, onSave }: { piai: PiaiDTO; saving: boolean; onSave: (g: PiaiGeneral) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PiaiGeneral>(piai.general);
  const g = editing ? draft : piai.general;
  const set = (k: keyof PiaiGeneral, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <BlockCard id="piai-general" icon={ClipboardList} title="Información general" editing={editing}
      onEdit={() => { setDraft(piai.general); setEditing(true); }}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
        {PIAI_GENERAL_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            {editing
              ? <Input type={f.type} className="h-8 text-sm" value={g[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              : <ReadValue value={f.type === "date" ? (g[f.key] ? fmt(g[f.key]) : "") : g[f.key]} />}
          </Field>
        ))}
      </div>
      <Field label="Breve descripción de la persona">
        {editing
          ? <RichTextarea tone="filled" rows={3} value={draft.description ?? ""} onChange={(v) => set("description", v)} placeholder="Edad, con quién vive, situación familiar…" />
          : hasHtmlText(g.description) ? <ClinicalNotes html={g.description!} /> : <ReadValue value="" />}
      </Field>
      <div className="grid sm:grid-cols-[12rem_1fr] gap-x-6 gap-y-2.5">
        <Field label="Fecha de aceptación de la persona usuaria">
          {editing ? <Input type="date" className="h-8 text-sm" value={draft.acceptanceDate ?? ""} onChange={(e) => set("acceptanceDate", e.target.value)} /> : <ReadValue value={g.acceptanceDate ? fmt(g.acceptanceDate) : ""} />}
        </Field>
        <Field label="Observaciones de la aceptación">
          {editing ? <Input className="h-8 text-sm" value={draft.acceptanceNotes ?? ""} onChange={(e) => set("acceptanceNotes", e.target.value)} /> : <ReadValue value={g.acceptanceNotes} />}
        </Field>
      </div>
      {editing && <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={async () => { await onSave(draft); setEditing(false); }} />}
    </BlockCard>
  );
}

// ─── 2. Objetivos generales ──────────────────────────────────────────────────

function GeneralObjectivesBlock({ piai, saving, onSave }: { piai: PiaiDTO; saving: boolean; onSave: (o: PiaiGeneralObjective[]) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PiaiGeneralObjective[]>(piai.generalObjectives);
  const items = piai.generalObjectives.filter((o) => o.text.trim());
  const update = (i: number, p: Partial<PiaiGeneralObjective>) => setDraft((d) => d.map((o, j) => (j === i ? { ...o, ...p } : o)));

  return (
    <BlockCard id="piai-objetivos" icon={Flag} title="Objetivos generales" subtitle="los que plantea la persona usuaria" editing={editing}
      onEdit={() => { setDraft(piai.generalObjectives.length ? piai.generalObjectives : [{ id: newId("go"), text: "", actions: [] }]); setEditing(true); }}>
      {editing ? (
        <div className="space-y-3">
          {draft.map((o, i) => (
            <div key={o.id} className="rounded-md border p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold w-20 shrink-0">Objetivo {i + 1}</span>
                <Input className="h-8 text-sm" value={o.text} placeholder="p. ej. Jugar al ajedrez" onChange={(e) => update(i, { text: e.target.value })} />
                <button type="button" aria-label="Quitar objetivo" className="text-muted-foreground hover:text-destructive" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="pl-20">
                <StringListEditor items={o.actions} onChange={(actions) => update(i, { actions })} placeholder="Acción…" addLabel="Añadir acción" />
              </div>
            </div>
          ))}
          <button type="button" className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            onClick={() => setDraft((d) => [...d, { id: newId("go"), text: "", actions: [] }])}>
            <Plus className="w-3 h-3" />Añadir objetivo general
          </button>
          <EditActions saving={saving} onCancel={() => setEditing(false)}
            onSave={async () => { await onSave(draft.filter((o) => o.text.trim()).map((o) => ({ ...o, actions: o.actions.filter((a) => a.trim()) }))); setEditing(false); }} />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">Sin objetivos generales todavía.</p>
      ) : (
        <ol className="space-y-2">
          {items.map((o, i) => (
            <li key={o.id} className="text-sm">
              <div className="flex gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 bg-[#56608a]/10 text-[#56608a]">{i + 1}</span>
                <span className="font-medium leading-snug">{o.text}</span>
              </div>
              {o.actions.length > 0 && (
                <ul className="pl-7 mt-1 space-y-0.5">
                  {o.actions.map((a, k) => <li key={k} className="text-xs text-muted-foreground">Acción {k + 1}: <span className="text-foreground">{a}</span></li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </BlockCard>
  );
}

// ─── 3. Apartado de cada profesional ─────────────────────────────────────────

function SectionBlock({ def, piai, patientId, canEdit, saving, onSave }: {
  def: PiaiSectionDef; piai: PiaiDTO; patientId: string; canEdit: boolean; saving: boolean;
  onSave: (c: PiaiSectionContent) => Promise<unknown>;
}) {
  const stored = piai.sections[def.key];
  const saved: PiaiSectionContent = stored?.content ?? {};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PiaiSectionContent>(saved);
  const c = editing ? draft : saved;
  const set = (p: Partial<PiaiSectionContent>) => setDraft((d) => ({ ...d, ...p }));
  const setLeisure = (p: Partial<NonNullable<PiaiSectionContent["leisure"]>>) => setDraft((d) => ({ ...d, leisure: { ...(d.leisure ?? {}), ...p } }));

  // "Copiar de la última valoración": trae el texto de la pestaña Valoración.
  const { data: evaluations } = useQuery<PatientEvaluationDTO[]>({
    queryKey: ["evaluations", patientId],
    queryFn: () => fetcher(`/api/patients/${patientId}/evaluations`),
    enabled: editing,
  });
  function copyFromEvaluation() {
    const ev = evaluations?.[0];
    if (!ev) { toast({ title: "No hay valoración", description: "Este/a usuario/a todavía no tiene ninguna valoración escrita." }); return; }
    const html = EVALUATION_SECTIONS.flatMap((s) => s.fields
      .filter((f) => hasHtmlText(ev[f.field]))
      .map((f) => `<p><b>${f.label ? `${s.title} — ${f.label}` : s.title}</b></p>${ev[f.field]}`)).join("");
    set({ assessment: hasHtmlText(draft.assessment) ? `${draft.assessment}${html}` : html });
    toast({ title: "Valoración copiada", description: `Del ${formatDate(ev.date)}. Revísala antes de guardar.` });
  }

  const subtitle = stored
    ? <>{saved.responsible ? `Responsable: ${saved.responsible}` : ""}{stored.updatedByName ? ` · editado por ${stored.updatedByName}, ${formatDate(stored.updatedAt)}` : ""}</>
    : <span className="italic">sin completar</span>;

  return (
    <BlockCard id={`piai-${def.key}`} icon={ClipboardList} title={def.title} subtitle={subtitle} editing={editing} canEdit={canEdit}
      onEdit={() => { setDraft({ ...saved, objectives: saved.objectives?.length ? saved.objectives : [""] }); setEditing(true); }}>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
        <Field label="Responsable">{editing ? <Input className="h-8 text-sm" value={c.responsible ?? ""} onChange={(e) => set({ responsible: e.target.value })} /> : <ReadValue value={c.responsible} />}</Field>
        <Field label="Valoración realizada por">{editing ? <Input className="h-8 text-sm" value={c.assessedBy ?? ""} onChange={(e) => set({ assessedBy: e.target.value })} /> : <ReadValue value={c.assessedBy} />}</Field>
        {def.extras.map((e) => (
          <Field key={e.key} label={e.label}>
            {editing
              ? <Input className="h-8 text-sm" value={c.extras?.[e.key] ?? ""} onChange={(ev) => set({ extras: { ...(c.extras ?? {}), [e.key]: ev.target.value } })} />
              : <ReadValue value={c.extras?.[e.key]} />}
          </Field>
        ))}
      </div>

      <Field label={def.assessmentLabel}>
        {editing ? (
          <div className="space-y-1">
            <RichTextarea tone="filled" rows={5} value={draft.assessment ?? ""} onChange={(v) => set({ assessment: v })} />
            <button type="button" onClick={copyFromEvaluation} className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
              <Copy className="w-3 h-3" />Copiar de la última valoración
            </button>
          </div>
        ) : hasHtmlText(c.assessment) ? (
          <div className="rounded-md bg-muted/30 px-3 py-2"><ClinicalNotes html={c.assessment!} /></div>
        ) : <ReadValue value="" />}
      </Field>

      <Field label="Objetivos">
        {def.objectivesFromPlan ? (
          <div className="rounded-md border p-3">
            <InterventionPlanTab patientId={patientId} embedded readOnly={!canEdit} />
          </div>
        ) : editing ? (
          <StringListEditor items={c.objectives ?? []} onChange={(objectives) => set({ objectives })} placeholder="Objetivo…" addLabel="Añadir objetivo" />
        ) : <NumberedList items={c.objectives ?? []} />}
      </Field>

      <Field label="Comentarios">{editing ? <Textarea rows={2} value={c.comments ?? ""} onChange={(e) => set({ comments: e.target.value })} /> : <ReadValue value={c.comments} />}</Field>

      <div className="grid grid-cols-2 gap-x-6">
        <Field label="Sesión individual">{editing ? <Input className="h-8 text-sm" value={c.individualSession ?? ""} onChange={(e) => set({ individualSession: e.target.value })} /> : <ReadValue value={c.individualSession} />}</Field>
        <Field label="Sesión grupal">{editing ? <Input className="h-8 text-sm" value={c.groupSession ?? ""} onChange={(e) => set({ groupSession: e.target.value })} /> : <ReadValue value={c.groupSession} />}</Field>
      </div>

      {def.hasLeisure && (
        <div className="rounded-md border border-dashed p-3 space-y-2.5">
          <p className="text-xs font-semibold">Atención al ocio y tiempo libre</p>
          <Field label="Valoración ocio y tiempo libre">
            {editing ? <RichTextarea tone="filled" rows={3} value={draft.leisure?.assessment ?? ""} onChange={(v) => setLeisure({ assessment: v })} />
              : hasHtmlText(c.leisure?.assessment) ? <ClinicalNotes html={c.leisure!.assessment!} /> : <ReadValue value="" />}
          </Field>
          <Field label="Objetivos">
            {editing ? <StringListEditor items={c.leisure?.objectives ?? []} onChange={(objectives) => setLeisure({ objectives })} placeholder="Objetivo…" addLabel="Añadir objetivo" />
              : <NumberedList items={c.leisure?.objectives ?? []} />}
          </Field>
          <Field label="Comentarios">{editing ? <Textarea rows={2} value={c.leisure?.comments ?? ""} onChange={(e) => setLeisure({ comments: e.target.value })} /> : <ReadValue value={c.leisure?.comments} />}</Field>
          <div className="grid grid-cols-2 gap-x-6">
            <Field label="Sesión individual">{editing ? <Input className="h-8 text-sm" value={c.leisure?.individualSession ?? ""} onChange={(e) => setLeisure({ individualSession: e.target.value })} /> : <ReadValue value={c.leisure?.individualSession} />}</Field>
            <Field label="Sesión grupal">{editing ? <Input className="h-8 text-sm" value={c.leisure?.groupSession ?? ""} onChange={(e) => setLeisure({ groupSession: e.target.value })} /> : <ReadValue value={c.leisure?.groupSession} />}</Field>
          </div>
        </div>
      )}

      {editing && (
        <EditActions saving={saving} onCancel={() => setEditing(false)}
          onSave={async () => {
            await onSave({
              ...draft,
              objectives: (draft.objectives ?? []).filter((o) => o.trim()),
              leisure: draft.leisure ? { ...draft.leisure, objectives: (draft.leisure.objectives ?? []).filter((o) => o.trim()) } : undefined,
            });
            setEditing(false);
          }} />
      )}
    </BlockCard>
  );
}

// ─── 4. Revisiones ───────────────────────────────────────────────────────────

function ReviewsBlock({ piai, saving, onSave }: { piai: PiaiDTO; saving: boolean; onSave: (r: PiaiReview[]) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PiaiReview[]>(piai.reviews);
  const updateReview = (i: number, p: Partial<PiaiReview>) => setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...p } : r)));

  function addReview() {
    // Una revisión nueva parte de los objetivos generales actuales.
    setDraft((d) => [...d, {
      id: newId("rv"), date: todayStr(), comments: "",
      objectives: piai.generalObjectives.filter((o) => o.text.trim()).map((o) => ({
        id: newId("ro"), text: o.text, modifications: "",
        actions: o.actions.map((a) => ({ id: newId("ra"), text: a, status: "En curso" })),
      })),
    }]);
  }

  return (
    <BlockCard id="piai-revisiones" icon={History} title="Revisiones del PIA" editing={editing}
      onEdit={() => { setDraft(piai.reviews); setEditing(true); }}>
      {!editing && piai.reviews.length === 0 && <p className="text-sm text-muted-foreground/70">Sin revisiones todavía.</p>}
      {(editing ? draft : piai.reviews).map((r, i) => (
        <div key={r.id} className="rounded-md border p-3 space-y-2">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            <Field label="Fecha revisión">{editing ? <Input type="date" className="h-8 text-sm" value={r.date ?? ""} onChange={(e) => updateReview(i, { date: e.target.value })} /> : <ReadValue value={r.date ? fmt(r.date) : ""} />}</Field>
            <Field label="Fecha reunión PPUU / equipo técnico">{editing ? <Input type="date" className="h-8 text-sm" value={r.meetingDate ?? ""} onChange={(e) => updateReview(i, { meetingDate: e.target.value })} /> : <ReadValue value={r.meetingDate ? fmt(r.meetingDate) : ""} />}</Field>
          </div>
          <Field label="Comentarios y revisiones">{editing ? <Textarea rows={2} value={r.comments ?? ""} onChange={(e) => updateReview(i, { comments: e.target.value })} /> : <ReadValue value={r.comments} />}</Field>
          {r.objectives.map((o, j) => (
            <div key={o.id} className="pl-2 border-l-2 border-[#56608a]/30 space-y-1">
              {editing ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold w-20 shrink-0">Objetivo {j + 1}</span>
                    <Input className="h-8 text-sm" value={o.text} onChange={(e) => updateReview(i, { objectives: r.objectives.map((x, k) => (k === j ? { ...x, text: e.target.value } : x)) })} />
                    <button type="button" aria-label="Quitar objetivo" className="text-muted-foreground hover:text-destructive" onClick={() => updateReview(i, { objectives: r.objectives.filter((_, k) => k !== j) })}><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <Input className="h-8 text-sm" placeholder="Modificaciones…" value={o.modifications ?? ""} onChange={(e) => updateReview(i, { objectives: r.objectives.map((x, k) => (k === j ? { ...x, modifications: e.target.value } : x)) })} />
                  {o.actions.map((a, k) => (
                    <div key={a.id} className="flex items-center gap-1.5 pl-4">
                      <Input className="h-7 text-xs" value={a.text} placeholder={`Acción ${k + 1}`}
                        onChange={(e) => updateReview(i, { objectives: r.objectives.map((x, m) => (m === j ? { ...x, actions: x.actions.map((y, n) => (n === k ? { ...y, text: e.target.value } : y)) } : x)) })} />
                      <Select value={a.status} onValueChange={(v) => updateReview(i, { objectives: r.objectives.map((x, m) => (m === j ? { ...x, actions: x.actions.map((y, n) => (n === k ? { ...y, status: v } : y)) } : x)) })}>
                        <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{PIAI_ACTION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ))}
                  <button type="button" className="ml-4 text-[11px] text-primary hover:underline"
                    onClick={() => updateReview(i, { objectives: r.objectives.map((x, m) => (m === j ? { ...x, actions: [...x.actions, { id: newId("ra"), text: "", status: "Pendiente" }] } : x)) })}>
                    + Añadir acción
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm"><span className="font-medium">Objetivo {j + 1}:</span> {o.text}</p>
                  {o.modifications && <p className="text-xs text-muted-foreground">Modificaciones: {o.modifications}</p>}
                  {o.actions.map((a, k) => (
                    <p key={a.id} className="text-xs pl-4">Acción {k + 1}: {a.text} <span className="text-muted-foreground">· {a.status}</span></p>
                  ))}
                </>
              )}
            </div>
          ))}
          {editing && (
            <div className="flex gap-3">
              <button type="button" className="text-xs text-primary hover:underline"
                onClick={() => updateReview(i, { objectives: [...r.objectives, { id: newId("ro"), text: "", modifications: "", actions: [] }] })}>
                + Añadir objetivo
              </button>
              <button type="button" className="text-xs text-destructive hover:underline" onClick={() => setDraft((d) => d.filter((_, k) => k !== i))}>Eliminar revisión</button>
            </div>
          )}
        </div>
      ))}
      {editing && (
        <>
          <button type="button" className="text-xs text-primary hover:underline inline-flex items-center gap-1" onClick={addReview}><Plus className="w-3 h-3" />Añadir revisión</button>
          <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={async () => { await onSave(draft); setEditing(false); }} />
        </>
      )}
    </BlockCard>
  );
}

// ─── Nuevo PIAI ──────────────────────────────────────────────────────────────

function NewPiaiDialog({ open, onOpenChange, previous, pending, onCreate }: {
  open: boolean; onOpenChange: (o: boolean) => void; previous: PiaiDTO[]; pending: boolean;
  onCreate: (p: { date: string; copyFromId?: string }) => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [copy, setCopy] = useState(true);
  const last = previous[0];
  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) { setDate(todayStr()); setCopy(true); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{last ? "Nuevo PIAI" : "Crear PIAI"}</DialogTitle>
          <DialogDescription>Fecha del PIA{last ? " y si quieres partir del anterior." : "."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Fecha del PIA</Label>
            <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {last && (
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="mt-1" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
              <span>Copiar la información general, los objetivos generales y los apartados de los profesionales del PIAI del {formatDate(last.date)}</span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={pending || !/^\d{4}-\d{2}-\d{2}$/.test(date)} onClick={() => onCreate(last && copy ? { date, copyFromId: last.id } : { date })}>
            {pending ? "Creando…" : "Crear PIAI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
