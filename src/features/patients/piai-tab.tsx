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

import { createContext, useContext, useMemo, useState } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClinicalNotes } from "@/components/clinical-notes";
import { formatDate } from "@/components/domain";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PIAI_REVIEW_RESULTS, PIAI_GENERAL_FIELDS, PIAI_SECTIONS, PIAI_STATUSES, newId,
  type PiaiDTO, type PiaiGeneral, type PiaiGeneralObjective, type PiaiReview,
  type PiaiSectionContent, type PiaiSectionDef,
} from "@/lib/piai";
import type { PatientEvaluationDTO } from "@/lib/evaluations";
import { EVALUATION_SECTIONS } from "@/lib/evaluations";
import { InterventionPlanTab } from "./intervention-plan-tab";
import {
  ClipboardList, Copy, FileDown, FilePlus2, Lock, Pencil, Plus, Save, Trash2, X, Users, Flag, History, CheckCircle2,
  ChevronDown, ChevronRight, MoreHorizontal,
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

// Punto de color de cada profesión en el menú lateral.
const SECTION_DOT: Record<string, string> = {
  "trabajo-social": "#378ADD",
  "terapia-ocupacional": "#D85A30",
  "logopedia": "#D4537E",
  "fisioterapia": "#639922",
  "psicologia": "#7F77DD",
  "neuropsicologia": "#993556",
  "cuidados": "#1D9E75",
};

// Plegado de bloques. Con el menú lateral se ve un apartado cada vez, así
// que los bloques van siempre abiertos y sin flecha de plegar.
const CollapseCtx = createContext<{ isOpen: (id: string) => boolean; setOpen: (id: string, open: boolean) => void; collapsible?: boolean }>({
  isOpen: () => true,
  setOpen: () => {},
  collapsible: false,
});

const STATUS_STYLE: Record<string, string> = {
  "En elaboración": "bg-amber-50 text-amber-800 border-amber-200",
  "Reunión": "bg-sky-50 text-sky-800 border-sky-200",
  "Devolución": "bg-violet-50 text-violet-800 border-violet-200",
  "Cerrado": "bg-emerald-50 text-emerald-800 border-emerald-200",
};

export function PiaiTab({ patientId, referent, careTeamReferent }: {
  patientId: string;
  // Referentes del/de la usuario/a (se editan en su ficha); se muestran en el
  // PIAI para que todo el equipo los tenga a mano.
  referent?: string | null;
  careTeamReferent?: string | null;
}) {
  const qc = useQueryClient();
  const queryKey = ["piai", patientId];
  const { data: me } = useMe();
  const { data: list, isLoading } = useQuery<PiaiDTO[]>({
    queryKey,
    queryFn: () => fetcher(`/api/patients/${patientId}/piai`),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [highlightReview, setHighlightReview] = useState<string | null>(null);
  // Apartado que se está viendo (menú lateral).
  const [activeSection, setActiveSection] = useState("piai-general");
  const collapse = useMemo(() => ({ isOpen: () => true, setOpen: () => {}, collapsible: false }), []);
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
  const history = historyEntries(piais);
  const navItems: { id: string; label: string; dot?: string; done?: boolean; group?: string }[] = [
    { id: "piai-general", label: "Información general" },
    { id: "piai-objetivos", label: "Objetivos generales", done: piai.generalObjectives.some((o) => o.text.trim()) },
    ...PIAI_SECTIONS.map((sec, i) => ({
      id: `piai-${sec.key}`, label: sec.title, dot: SECTION_DOT[sec.key], group: i === 0 ? "Profesionales" : undefined,
      done: hasHtmlText(piai.sections[sec.key]?.content.assessment),
    })),
    { id: "piai-revisiones", label: "Revisión de objetivos", done: piai.reviews.length > 0 },
  ];
  const lastEdited = new Date(piai.lastEditedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });

  function goToEntry(h: (typeof history)[number]) {
    setSelectedId(h.piaiId);
    if (h.kind === "review") {
      setHighlightReview(h.reviewId!);
      setActiveSection("piai-revisiones");
      setTimeout(() => document.getElementById(`piai-review-${h.reviewId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    } else {
      setHighlightReview(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Cabecera única: qué PIA es, su estado y el historial ── */}
      <Card className="py-0 gap-0">
        <div className="flex items-start gap-3 px-4 pt-3 pb-2.5">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold leading-tight">PIA general · {formatDate(piai.date)}</h3>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5 text-xs">
              <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 font-medium", STATUS_STYLE[piai.status])}>{piai.status}</span>
              {piai.general.deliveredDate ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />Entregado {formatDate(piai.general.deliveredDate)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md border border-dashed px-2 py-0.5 text-muted-foreground">No entregado</span>
              )}
              <span className="text-muted-foreground">· modificado {lastEdited}{piai.lastEditedByName ? ` por ${piai.lastEditedByName}` : ""}</span>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" asChild>
            <a href={`/api/patients/${patientId}/piai/${piai.id}/word`}><FileDown className="w-3.5 h-3.5 mr-1" />Word</a>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Más acciones del PIA"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setMetaOpen(true)}><Pencil className="w-4 h-4 mr-2" />Fecha, estado y entrega</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNewOpen(true)}><FilePlus2 className="w-4 h-4 mr-2" />Nuevo PIA</DropdownMenuItem>
              {canDelete && (
                <DropdownMenuItem variant="destructive"
                  onClick={() => { if (confirm("¿Eliminar este PIA con todos sus apartados? No se puede deshacer.")) remove.mutate(piai.id); }}>
                  <Trash2 className="w-4 h-4 mr-2" />Eliminar este PIA
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Historial como línea de tiempo */}
        <div className="flex items-center gap-y-2 flex-wrap px-4 py-2.5 border-t text-xs">
          <span className="text-muted-foreground mr-3 inline-flex items-center gap-1"><History className="w-3.5 h-3.5" />Historial</span>
          {history.map((h, i) => {
            const active = h.piaiId === piai.id && (h.kind === "pia" ? !highlightReview : highlightReview === h.reviewId);
            return (
              <span key={h.key} className="inline-flex items-center">
                {i > 0 && <span className="w-6 h-px bg-border mx-1.5" aria-hidden />}
                <button type="button" onClick={() => goToEntry(h)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors",
                    active ? "bg-[#56608a]/10 text-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                  <span className={cn("rounded-full shrink-0",
                    h.kind === "pia" ? "w-2.5 h-2.5" : "w-2 h-2 border-[1.5px] border-muted-foreground bg-background",
                    h.kind === "pia" && (active ? "bg-[#56608a]" : "bg-muted-foreground/60"))} />
                  {h.kind === "pia" ? "PIA" : "Revisión"} {formatDate(h.date)}
                  {h.kind === "pia" && h.delivered && <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-label="Entregado" />}
                </button>
              </span>
            );
          })}
          <span className="flex-1" />
          <button type="button" onClick={() => setNewOpen(true)} className="text-primary hover:underline inline-flex items-center gap-1">
            <Plus className="w-3 h-3" />Nuevo PIA
          </button>
        </div>
      </Card>

      {/* ── Menú lateral de apartados + contenido (un apartado cada vez) ── */}
      <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)] gap-4 items-start">
        {/* Pantallas medianas: desplegable */}
        <div className="lg:hidden">
          <Select value={activeSection} onValueChange={setActiveSection}>
            <SelectTrigger className="h-9 text-sm" aria-label="Apartado del PIA"><SelectValue /></SelectTrigger>
            <SelectContent>
              {navItems.map((n) => <SelectItem key={n.id} value={n.id}>{n.label}{n.done ? " ✓" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Pantallas anchas: menú fijo a la izquierda */}
        <nav className="hidden lg:flex flex-col gap-0.5 sticky top-4 text-sm" aria-label="Apartados del PIA">
          {navItems.map((n) => (
            <div key={n.id}>
              {n.group && <p className="px-2.5 pt-3 pb-1 text-[11px] font-medium text-muted-foreground">{n.group}</p>}
              {n.id === "piai-revisiones" && <div className="my-1.5 border-t" />}
              <button type="button" onClick={() => setActiveSection(n.id)} aria-current={activeSection === n.id}
                className={cn("w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors",
                  activeSection === n.id ? "bg-[#56608a]/10 font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                {n.dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: n.dot }} />}
                <span className="flex-1 truncate">{n.label}</span>
                {n.done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-label="Completado" />}
              </button>
            </div>
          ))}
        </nav>

        <div className="min-w-0">
          <CollapseCtx.Provider value={collapse}>
            {activeSection === "piai-general" && (
              <GeneralBlock key={`g-${piai.id}`} referent={referent} careTeamReferent={careTeamReferent} piai={piai} saving={patchPiai.isPending} onSave={(general) => patchPiai.mutateAsync({ general })} />
            )}
            {activeSection === "piai-objetivos" && (
              <GeneralObjectivesBlock key={`o-${piai.id}`} piai={piai} saving={patchPiai.isPending} onSave={(generalObjectives) => patchPiai.mutateAsync({ generalObjectives })} />
            )}
            {PIAI_SECTIONS.filter((def) => activeSection === `piai-${def.key}`).map((def) => (
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
            {activeSection === "piai-revisiones" && (
              <ReviewsBlock key={`r-${piai.id}`} piai={piai} highlightId={highlightReview} saving={patchPiai.isPending} onSave={(reviews) => patchPiai.mutateAsync({ reviews })} />
            )}
          </CollapseCtx.Provider>
        </div>
      </div>

      <NewPiaiDialog open={newOpen} onOpenChange={setNewOpen} previous={piais} pending={create.isPending} onCreate={(p) => create.mutate(p)} />
      {metaOpen && (
        <PiaiMetaDialog
          piai={piai}
          saving={patchPiai.isPending}
          onClose={() => setMetaOpen(false)}
          onSave={async ({ date, status, deliveredDate }) => {
            await patchPiai.mutateAsync({ date, status, general: { ...piai.general, deliveredDate } });
            setMetaOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Cambiar fecha / estado de un PIAI: solo al pulsar "Guardar".
function PiaiMetaDialog({ piai, saving, onClose, onSave }: {
  piai: PiaiDTO; saving: boolean; onClose: () => void; onSave: (b: { date: string; status: string; deliveredDate: string }) => Promise<void>;
}) {
  const [date, setDate] = useState(piai.date);
  const [status, setStatus] = useState(piai.status);
  const [delivered, setDelivered] = useState(!!piai.general.deliveredDate);
  const [deliveredDate, setDeliveredDate] = useState(piai.general.deliveredDate || todayStr());
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Fecha, estado y entrega del PIAI</DialogTitle>
          <DialogDescription>Los cambios solo se guardan al pulsar Guardar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Fecha del PIA</Label>
            <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{PIAI_STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 rounded-md border p-2.5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={delivered} onChange={(e) => setDelivered(e.target.checked)} />
              Entregado a la persona usuaria
            </label>
            {delivered && (
              <div className="flex items-center gap-2 pl-6">
                <Label className="text-xs text-muted-foreground">Fecha de entrega</Label>
                <Input type="date" className="w-40 h-8 text-sm" value={deliveredDate} onChange={(e) => setDeliveredDate(e.target.value)} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!valid || saving || (delivered && !/^\d{4}-\d{2}-\d{2}$/.test(deliveredDate))}
            onClick={() => onSave({ date, status, deliveredDate: delivered ? deliveredDate : "" })}>
            <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const { isOpen, setOpen, collapsible } = useContext(CollapseCtx);
  const open = editing || isOpen(id);
  return (
    <Card id={id} className={cn("py-0 gap-0 scroll-mt-4", editing && "ring-2 ring-[#56608a]/30")}>
      <div className={cn("flex items-center gap-2 px-4 py-2.5 bg-muted/30", open && "border-b")}>
        {/* Pulsar la cabecera pliega/despliega el bloque */}
        <button type="button" onClick={() => !editing && collapsible && setOpen(id, !open)} aria-expanded={open}
          className="flex items-center gap-2 min-w-0 flex-1 text-left">
          {collapsible && (open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />)}
          <Icon className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
          <h4 className="text-sm font-semibold shrink-0">{title}</h4>
          {subtitle && <span className="text-[11px] text-muted-foreground truncate">{subtitle}</span>}
        </button>
        {!editing && (canEdit ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setOpen(id, true); onEdit(); }}><Pencil className="w-3 h-3 mr-1" />Editar</Button>
        ) : (
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 shrink-0"><Lock className="w-3 h-3" />Solo lectura</span>
        ))}
      </div>
      {open && <div className="px-4 py-3 space-y-3">{children}</div>}
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

function GeneralBlock({ piai, saving, onSave, referent, careTeamReferent }: {
  piai: PiaiDTO; saving: boolean; onSave: (g: PiaiGeneral) => Promise<unknown>;
  referent?: string | null; careTeamReferent?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PiaiGeneral>(piai.general);
  const g = editing ? draft : piai.general;
  const set = (k: keyof PiaiGeneral, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <BlockCard id="piai-general" icon={ClipboardList} title="Información general" editing={editing}
      onEdit={() => { setDraft(piai.general); setEditing(true); }}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
        {/* Referentes: vienen de la ficha del/de la usuario/a (se cambian allí) */}
        <Field label="Referente técnico/a"><ReadValue value={referent} />{editing && <p className="text-[10px] text-muted-foreground">Se cambia en la ficha → Editar</p>}</Field>
        <Field label="Referente de cuidados"><ReadValue value={careTeamReferent} />{editing && <p className="text-[10px] text-muted-foreground">Se cambia en la ficha → Editar</p>}</Field>
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
    <BlockCard id="piai-objetivos" icon={Flag} title="Objetivos generales" subtitle={items.length ? `${items.length} objetivo${items.length === 1 ? "" : "s"} de la persona usuaria` : "los que plantea la persona usuaria"} editing={editing}
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

// ─── 4. Revisión de objetivos ────────────────────────────────────────────────
// A los ~6 meses del PIA general: para cada objetivo general se marca si se
// ha conseguido, se mantiene o no se ha conseguido. Cada revisión se guarda
// con su fecha (solo al pulsar Guardar) y aparece en el historial.

const RESULT_STYLE: Record<string, { active: string; badge: string }> = {
  "Conseguido": { active: "bg-green-600 border-green-600 text-white", badge: "bg-green-100 text-green-800" },
  "Se mantiene": { active: "bg-amber-500 border-amber-500 text-white", badge: "bg-amber-100 text-amber-800" },
  "No conseguido": { active: "bg-red-600 border-red-600 text-white", badge: "bg-red-100 text-red-800" },
};

function ReviewsBlock({ piai, saving, onSave, highlightId }: {
  piai: PiaiDTO; saving: boolean; onSave: (r: PiaiReview[]) => Promise<unknown>; highlightId: string | null;
}) {
  const [dialog, setDialog] = useState<PiaiReview | "new" | null>(null);
  const reviews = [...piai.reviews].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const objectives = piai.generalObjectives.filter((o) => o.text.trim());

  return (
    <BlockCard id="piai-revisiones" icon={History} title="Revisión de objetivos"
      subtitle={reviews.length ? `${reviews.length} revisión${reviews.length === 1 ? "" : "es"} · última ${fmt(reviews[0].date)}` : "cada 6 meses, entre PIA y PIA"}
      editing={false} canEdit={false} onEdit={() => {}}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Marca para cada objetivo general si se ha conseguido, se mantiene o no se ha conseguido.</p>
        <Button size="sm" className="h-8 text-xs shrink-0" disabled={objectives.length === 0} onClick={() => setDialog("new")}
          title={objectives.length === 0 ? "Primero añade objetivos generales" : undefined}>
          <Plus className="w-3.5 h-3.5 mr-1" />Nueva revisión
        </Button>
      </div>
      {objectives.length === 0 && <p className="text-sm text-muted-foreground/70">Añade objetivos generales para poder revisarlos.</p>}
      {reviews.length === 0 && objectives.length > 0 && <p className="text-sm text-muted-foreground/70">Todavía no se ha hecho ninguna revisión.</p>}
      {reviews.map((r) => {
        const counts = PIAI_REVIEW_RESULTS.map((res) => ({ res, n: r.items.filter((i) => i.result === res).length })).filter((c) => c.n > 0);
        return (
          <div key={r.id} id={`piai-review-${r.id}`}
            className={cn("rounded-md border p-3 space-y-2 scroll-mt-24 transition-shadow", highlightId === r.id && "ring-2 ring-[#56608a]/40")}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">Revisión del {fmt(r.date)}</span>
              {r.meetingDate && <span className="text-[11px] text-muted-foreground">· reunión {fmt(r.meetingDate)}</span>}
              {counts.map((c) => <span key={c.res} className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", RESULT_STYLE[c.res].badge)}>{c.n} {c.res.toLowerCase()}</span>)}
              <span className="flex-1" />
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDialog(r)}><Pencil className="w-3 h-3 mr-1" />Editar</Button>
            </div>
            <ol className="space-y-1">
              {r.items.map((it, i) => (
                <li key={it.id} className="text-sm flex items-start gap-2">
                  <span className="text-[11px] text-muted-foreground w-4 shrink-0 pt-0.5 text-right">{i + 1}.</span>
                  <span className="flex-1 leading-snug">
                    {it.text}
                    {it.comment && <span className="block text-xs text-muted-foreground">{it.comment}</span>}
                  </span>
                  <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0", it.result ? RESULT_STYLE[it.result]?.badge : "bg-muted text-muted-foreground")}>
                    {it.result || "Sin marcar"}
                  </span>
                </li>
              ))}
            </ol>
            {r.comments && <p className="text-xs text-muted-foreground whitespace-pre-wrap"><span className="font-medium text-foreground">Comentarios:</span> {r.comments}</p>}
          </div>
        );
      })}

      {dialog && (
        <ReviewDialog
          initial={dialog === "new" ? null : dialog}
          objectives={objectives}
          saving={saving}
          onClose={() => setDialog(null)}
          onDelete={dialog === "new" ? undefined : async () => {
            if (!confirm("¿Eliminar esta revisión?")) return;
            await onSave(piai.reviews.filter((x) => x.id !== (dialog as PiaiReview).id));
            setDialog(null);
          }}
          onSave={async (rev) => {
            const exists = piai.reviews.some((x) => x.id === rev.id);
            await onSave(exists ? piai.reviews.map((x) => (x.id === rev.id ? rev : x)) : [...piai.reviews, rev]);
            setDialog(null);
          }}
        />
      )}
    </BlockCard>
  );
}

function ReviewDialog({ initial, objectives, saving, onClose, onSave, onDelete }: {
  initial: PiaiReview | null;
  objectives: PiaiGeneralObjective[];
  saving: boolean;
  onClose: () => void;
  onSave: (r: PiaiReview) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  // Revisión nueva: parte de los objetivos generales actuales del PIA.
  const [draft, setDraft] = useState<PiaiReview>(() => initial ?? {
    id: newId("rv"),
    date: todayStr(),
    meetingDate: "",
    comments: "",
    items: objectives.map((o) => ({ id: newId("ri"), objectiveId: o.id, text: o.text, result: "", comment: "" })),
  });
  const setItem = (i: number, p: Partial<PiaiReview["items"][number]>) =>
    setDraft((d) => ({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, ...p } : x)) }));
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(draft.date ?? "");
  const pending = draft.items.filter((i) => !i.result).length;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar revisión de objetivos" : "Nueva revisión de objetivos"}</DialogTitle>
          <DialogDescription>Se guarda con su fecha al pulsar Guardar y queda en el historial.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Fecha de la revisión</Label>
              <Input type="date" className="w-44" value={draft.date ?? ""} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha reunión PPUU / equipo técnico</Label>
              <Input type="date" className="w-44" value={draft.meetingDate ?? ""} onChange={(e) => setDraft((d) => ({ ...d, meetingDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2.5">
            {draft.items.map((it, i) => (
              <div key={it.id} className="rounded-md border p-2.5 space-y-2">
                <p className="text-sm font-medium"><span className="text-muted-foreground mr-1">{i + 1}.</span>{it.text}</p>
                <div className="flex flex-wrap gap-1.5">
                  {PIAI_REVIEW_RESULTS.map((res) => (
                    <button key={res} type="button" aria-pressed={it.result === res}
                      onClick={() => setItem(i, { result: it.result === res ? "" : res })}
                      className={cn("rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                        it.result === res ? RESULT_STYLE[res].active : "bg-background hover:bg-muted text-muted-foreground")}>
                      {res}
                    </button>
                  ))}
                </div>
                <Input className="h-8 text-xs" placeholder="Comentario (opcional)" value={it.comment ?? ""} onChange={(e) => setItem(i, { comment: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Comentarios generales</Label>
            <Textarea rows={2} value={draft.comments ?? ""} onChange={(e) => setDraft((d) => ({ ...d, comments: e.target.value }))} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {onDelete ? <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 mr-1" />Eliminar</Button> : <span />}
          <div className="flex items-center gap-2">
            {pending > 0 && <span className="text-[11px] text-muted-foreground">{pending} sin marcar</span>}
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" disabled={!valid || saving} onClick={() => onSave(draft)}>
              <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Guardando…" : "Guardar revisión"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Historial cronológico: cada PIA general seguido de sus revisiones.
function historyEntries(piais: PiaiDTO[]) {
  const out: { key: string; kind: "pia" | "review"; date: string; piaiId: string; reviewId?: string; delivered?: boolean }[] = [];
  for (const p of piais) {
    out.push({ key: `p-${p.id}`, kind: "pia", date: p.date, piaiId: p.id, delivered: !!p.general.deliveredDate });
    for (const r of p.reviews) {
      if (r.date) out.push({ key: `r-${r.id}`, kind: "review", date: r.date, piaiId: p.id, reviewId: r.id });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "pia" ? -1 : 1));
}

// ─── Nuevo PIAI ──────────────────────────────────────────────────────────────

function NewPiaiDialog({ open, onOpenChange, previous, pending, onCreate }: {
  open: boolean; onOpenChange: (o: boolean) => void; previous: PiaiDTO[]; pending: boolean;
  onCreate: (p: { date: string; copyFromId?: string }) => void;
}) {
  return open ? <NewPiaiDialogInner onOpenChange={onOpenChange} previous={previous} pending={pending} onCreate={onCreate} /> : null;
}

// Se monta de nuevo cada vez que se abre: fecha de hoy y, si hay PIAs
// anteriores, "Copiar del anterior" marcado por defecto.
function NewPiaiDialogInner({ onOpenChange, previous, pending, onCreate }: {
  onOpenChange: (o: boolean) => void; previous: PiaiDTO[]; pending: boolean;
  onCreate: (p: { date: string; copyFromId?: string }) => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [source, setSource] = useState<string>(previous[0]?.id ?? "blank");
  const optionCls = (active: boolean) => cn("w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
    active ? "border-[#56608a] bg-[#56608a]/5" : "hover:bg-muted");
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{previous.length ? "Nuevo PIAI" : "Crear PIAI"}</DialogTitle>
          <DialogDescription>Elige la fecha y si quieres partir de un PIA anterior.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Fecha del PIA</Label>
            <Input type="date" className="w-44" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contenido</Label>
            {previous.map((p) => (
              <button key={p.id} type="button" onClick={() => setSource(p.id)} className={optionCls(source === p.id)}>
                <span className="flex items-center gap-2 font-medium"><Copy className="w-3.5 h-3.5" />Copiar datos del PIA del {formatDate(p.date)}</span>
                <span className="block text-[11px] text-muted-foreground pl-5.5">Información general, objetivos generales y los apartados de cada profesional.</span>
              </button>
            ))}
            <button type="button" onClick={() => setSource("blank")} className={optionCls(source === "blank")}>
              <span className="flex items-center gap-2 font-medium"><FilePlus2 className="w-3.5 h-3.5" />Empezar en blanco</span>
            </button>
            {previous.length === 0 && <p className="text-[11px] text-muted-foreground">Es el primer PIA de esta persona; no hay datos anteriores que copiar.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={pending || !/^\d{4}-\d{2}-\d{2}$/.test(date)} onClick={() => onCreate(source !== "blank" ? { date, copyFromId: source } : { date })}>
            {pending ? "Creando…" : "Crear PIAI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
