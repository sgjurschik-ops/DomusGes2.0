"use client";

// Pestaña "Guía de cuidados" — solo Centro de día.
// Resumen visual de apoyos y cuidados de la persona: alertas importantes
// arriba y, debajo, un apartado por área (movilidad, alimentación, higiene,
// vestido, comunicación, orientación…). Se rellena pulsando opciones con
// icono y se imprime / guarda en PDF como hoja de referencia.
// Hay una única guía vigente por persona: al guardar se sustituye.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher, useMe } from "@/hooks/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/components/domain";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ALERTS_SECTION, ALERT_RED, CARE_ICONS, CARE_SECTIONS, fieldHasData, optionIcon, sectionHasData, selList,
  type CareFieldDef, type CareFieldValue, type CareGuideData, type CareGuideDTO, type CareIconName, type CareSectionDef,
} from "@/lib/care-guide";
import { buildCareGuidePrintHtml, printCareGuide } from "@/lib/care-guide-print";
import { Check, Pencil, Printer, Save, X } from "lucide-react";

const ACCENT = "#56608a";

function errDetail(e: unknown): string {
  const body = (e as { body?: { detail?: string; error?: string } })?.body;
  return body?.detail || body?.error || (e instanceof Error ? e.message : "Error desconocido");
}

// Los iconos son constantes del propio código (no datos del usuario).
function CareIcon({ name, size = 24, strokeWidth = 1.7, className }: { name: CareIconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("shrink-0", className)}
      dangerouslySetInnerHTML={{ __html: CARE_ICONS[name] }}
    />
  );
}

function SectionHeader({ section }: { section: CareSectionDef }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ backgroundColor: section.band }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white" style={{ color: section.tone }}>
        <CareIcon name={section.icon} size={19} />
      </span>
      <h3 className="text-[15px] font-bold text-foreground">{section.title}</h3>
    </div>
  );
}

function Tile({
  icon, label, tone, selected, onClick, width = 92,
}: { icon: CareIconName; label: string; tone: string; selected?: boolean; onClick?: () => void; width?: number }) {
  const content = (
    <>
      {selected && (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      <span style={{ color: tone }}><CareIcon name={icon} size={30} strokeWidth={1.6} /></span>
      <span className="text-[11px] leading-tight text-foreground">{label}</span>
    </>
  );
  const cls = "relative flex flex-col items-center gap-1.5 rounded-lg bg-white px-1.5 pb-2 pt-2.5 text-center";
  if (!onClick) return <div className={cn(cls, "border")} style={{ width }}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!selected}
      className={cn(cls, "transition-colors hover:bg-muted/40", selected ? "border-2" : "border")}
      style={{ width, borderColor: selected ? ACCENT : undefined }}
    >
      {content}
    </button>
  );
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

function FieldRead({ section, field, value }: { section: CareSectionDef; field: CareFieldDef; value: CareFieldValue }) {
  const sel = selList(value);
  const text = value.text?.trim();
  if (field.kind === "level" || field.kind === "choice") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {sel[0] && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 font-semibold">
            {field.kind === "level" && (
              <span style={{ color: section.tone }}><CareIcon name={optionIcon(field, sel[0], section.icon)} size={17} /></span>
            )}
            {sel[0]}
          </span>
        )}
        {text && <span>{text}</span>}
      </div>
    );
  }
  if (field.kind === "tiles") {
    return (
      <div>
        {sel.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sel.map((l) => <Tile key={l} icon={optionIcon(field, l, section.icon)} label={l} tone={section.tone} />)}
          </div>
        )}
        {text && <p className={cn("text-xs text-muted-foreground", sel.length > 0 && "mt-1.5")}>{text}</p>}
      </div>
    );
  }
  if (field.kind === "chips") {
    return <p className="text-sm">{[...sel, ...(text ? [text] : [])].join(" · ")}</p>;
  }
  return <p className="whitespace-pre-line text-sm">{text}</p>;
}

function SectionRead({ data, section }: { data: CareGuideData; section: CareSectionDef }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <SectionHeader section={section} />
      <div className="divide-y">
        {section.fields
          .filter((f) => fieldHasData(data[section.key]?.[f.key]))
          .map((f) => (
            <div key={f.key} className="flex gap-3 px-4 py-3">
              <p className="w-[120px] shrink-0 pt-0.5 text-xs font-semibold text-muted-foreground">{f.label}</p>
              <div className="min-w-0 flex-1">
                <FieldRead section={section} field={f} value={data[section.key]![f.key]!} />
              </div>
            </div>
          ))}
      </div>
    </Card>
  );
}

function AlertsRead({ data }: { data: CareGuideData }) {
  const v = data[ALERTS_SECTION.key]?.alertas;
  if (!v || !fieldHasData(v)) return null;
  const f = ALERTS_SECTION.fields[0];
  return (
    <section className="rounded-xl border border-[#f3b8b1] bg-[#fdecea] px-4 py-3.5">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: ALERT_RED }}>
        <CareIcon name="alergia" size={16} strokeWidth={2} /> Alertas importantes
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {selList(v).map((l) => (
          <div key={l} className="flex min-w-[220px] flex-1 basis-[220px] items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: ALERT_RED }}>
              <CareIcon name={optionIcon(f, l, "alergia")} size={21} strokeWidth={1.9} />
            </span>
            <div>
              <p className="text-sm font-bold text-[#7a1a12]">{l}</p>
              {v.details?.[l] && <p className="text-xs text-[#7a2a20]">{v.details[l]}</p>}
            </div>
          </div>
        ))}
        {v.text?.trim() && (
          <div className="flex min-w-[220px] flex-1 basis-[220px] items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: ALERT_RED }}>
              <CareIcon name="alergia" size={21} strokeWidth={1.9} />
            </span>
            <p className="pt-2 text-sm font-semibold text-[#7a1a12]">{v.text}</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Edición ─────────────────────────────────────────────────────────────────

function FieldEdit({
  section, field, value, onChange,
}: { section: CareSectionDef; field: CareFieldDef; value: CareFieldValue | undefined; onChange: (v: CareFieldValue) => void }) {
  const sel = selList(value);
  const text = value?.text ?? "";
  const options = field.options ?? [];

  function pickSingle(label: string) {
    onChange({ ...value, sel: sel[0] === label ? undefined : label });
  }
  function toggleMulti(label: string) {
    onChange({ ...value, sel: sel.includes(label) ? sel.filter((l) => l !== label) : [...sel, label] });
  }

  let picker: React.ReactNode = null;
  if (field.kind === "level") {
    picker = (
      <div className="flex flex-wrap gap-2">
        {options.map((op) => {
          const active = sel[0] === op.label;
          return (
            <button
              key={op.label}
              type="button"
              onClick={() => pickSingle(op.label)}
              aria-pressed={active}
              className={cn(
                "flex w-[108px] flex-col items-center gap-1.5 rounded-lg px-1.5 py-2.5 text-xs transition-colors",
                active ? "border-2 bg-[#eef0f7] font-semibold" : "border bg-white hover:bg-muted/40",
              )}
              style={{ borderColor: active ? ACCENT : undefined }}
            >
              <span style={{ color: section.tone }}><CareIcon name={op.icon ?? section.icon} size={26} /></span>
              {op.label}
            </button>
          );
        })}
      </div>
    );
  } else if (field.kind === "choice" || field.kind === "chips") {
    const single = field.kind === "choice";
    picker = (
      <div className="flex flex-wrap gap-1.5">
        {options.map((op) => {
          const active = sel.includes(op.label);
          return (
            <button
              key={op.label}
              type="button"
              onClick={() => (single ? pickSingle(op.label) : toggleMulti(op.label))}
              aria-pressed={active}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs transition-colors",
                active ? "border-2 bg-[#eef0f7] font-semibold" : "border bg-white hover:bg-muted/40",
              )}
              style={{ borderColor: active ? ACCENT : undefined }}
            >
              {op.label}
            </button>
          );
        })}
      </div>
    );
  } else if (field.kind === "tiles") {
    picker = (
      <div className="flex flex-wrap gap-2">
        {options.map((op) => (
          <Tile
            key={op.label}
            icon={op.icon ?? section.icon}
            label={op.label}
            tone={section.tone}
            selected={sel.includes(op.label)}
            onClick={() => toggleMulti(op.label)}
            width={96}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:gap-4">
      <p className="w-[140px] shrink-0 pt-1 text-sm font-semibold">{field.label}</p>
      <div className="min-w-0 flex-1 space-y-2">
        {picker}
        {field.kind === "text" ? (
          <Textarea value={text} onChange={(e) => onChange({ ...value, text: e.target.value })} placeholder={field.placeholder} rows={3} className="max-w-2xl" />
        ) : (
          <Input value={text} onChange={(e) => onChange({ ...value, text: e.target.value })} placeholder={field.placeholder} className="h-8 max-w-xl text-sm" />
        )}
      </div>
    </div>
  );
}

function AlertsEdit({ value, onChange }: { value: CareFieldValue | undefined; onChange: (v: CareFieldValue) => void }) {
  const f = ALERTS_SECTION.fields[0];
  const sel = selList(value);
  const details = value?.details ?? {};
  function toggle(label: string) {
    const next = sel.includes(label) ? sel.filter((l) => l !== label) : [...sel, label];
    onChange({ ...value, sel: next });
  }
  return (
    <Card className="gap-0 overflow-hidden border-[#f3b8b1] py-0">
      <SectionHeader section={ALERTS_SECTION} />
      <div className="space-y-3 px-4 py-3.5">
        <div className="flex flex-wrap gap-2">
          {(f.options ?? []).map((op) => {
            const active = sel.includes(op.label);
            return (
              <button
                key={op.label}
                type="button"
                onClick={() => toggle(op.label)}
                aria-pressed={active}
                className={cn(
                  "flex w-[128px] flex-col items-center gap-1.5 rounded-lg px-1.5 py-2.5 text-xs transition-colors",
                  active ? "border-2 bg-[#fdecea] font-semibold" : "border bg-white hover:bg-muted/40",
                )}
                style={{ borderColor: active ? ALERT_RED : undefined }}
              >
                <span style={{ color: ALERT_RED }}><CareIcon name={op.icon ?? "alergia"} size={26} /></span>
                {op.label}
              </button>
            );
          })}
        </div>
        {sel.map((l) => (
          <div key={l} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="w-[200px] shrink-0 text-xs font-semibold text-[#7a1a12]">{l}</span>
            <Input
              value={details[l] ?? ""}
              onChange={(e) => onChange({ ...value, details: { ...details, [l]: e.target.value } })}
              placeholder={l === "Alergias" ? "¿A qué? (p. ej. penicilina)" : "Detalle (opcional)"}
              className="h-8 max-w-xl text-sm"
            />
          </div>
        ))}
        <Input
          value={value?.text ?? ""}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder="Otras alertas"
          className="h-8 max-w-xl text-sm"
        />
      </div>
    </Card>
  );
}

function EditView({ draft, setDraft }: { draft: CareGuideData; setDraft: (d: CareGuideData) => void }) {
  function setField(sectionKey: string, fieldKey: string, v: CareFieldValue) {
    setDraft({ ...draft, [sectionKey]: { ...(draft[sectionKey] ?? {}), [fieldKey]: v } });
  }
  return (
    <div className="space-y-4">
      <AlertsEdit value={draft.alertas?.alertas} onChange={(v) => setField("alertas", "alertas", v)} />
      {CARE_SECTIONS.map((s) => (
        <Card key={s.key} className="gap-0 overflow-hidden py-0">
          <SectionHeader section={s} />
          <div className="divide-y">
            {s.fields.map((f) => (
              <FieldEdit key={f.key} section={s} field={f} value={draft[s.key]?.[f.key]} onChange={(v) => setField(s.key, f.key, v)} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Pestaña ─────────────────────────────────────────────────────────────────

export function CareGuideTab({
  patientId, patientName, referent, careTeamReferent,
}: { patientId: string; patientName: string; referent: string | null; careTeamReferent: string | null }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const canEdit = !!me && me.userRole !== "guest";
  const queryKey = ["care-guide", patientId];
  const { data, isLoading, error } = useQuery<CareGuideDTO>({
    queryKey,
    queryFn: () => fetcher(`/api/patients/${patientId}/care-guide`),
  });
  const [draft, setDraft] = useState<CareGuideData | null>(null);

  const save = useMutation({
    mutationFn: (d: CareGuideData) =>
      fetcher<CareGuideDTO>(`/api/patients/${patientId}/care-guide`, { method: "PUT", body: JSON.stringify({ data: d }) }),
    onSuccess: (res) => {
      qc.setQueryData(queryKey, res);
      setDraft(null);
      toast({ title: "Guía de cuidados guardada" });
    },
    onError: (e) => toast({ title: "No se pudo guardar la guía", description: errDetail(e), variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !data) {
    return <Card className="p-6 text-sm text-destructive">No se pudo cargar la guía de cuidados: {errDetail(error)}</Card>;
  }

  const referents = [referent, careTeamReferent].filter((r): r is string => !!r?.trim());
  const filledSections = CARE_SECTIONS.filter((s) => sectionHasData(data.data, s));
  const isEmpty = filledSections.length === 0 && !sectionHasData(data.data, ALERTS_SECTION);

  function handlePrint() {
    if (!data) return;
    const ok = printCareGuide(buildCareGuidePrintHtml(data.data, { patientName, referents, updatedAt: data.updatedAt }));
    if (!ok) toast({ title: "El navegador ha bloqueado la ventana de impresión", description: "Permite las ventanas emergentes para esta web y vuelve a intentarlo.", variant: "destructive" });
  }

  if (draft) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Editar guía de cuidados</h2>
          <p className="text-sm text-muted-foreground">Pulsa lo que corresponda. Escribir es opcional: solo para matizar.</p>
        </div>
        <EditView draft={draft} setDraft={setDraft} />
        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
          <Button variant="outline" onClick={() => setDraft(null)} disabled={save.isPending}>
            <X className="mr-1.5 h-4 w-4" /> Cancelar
          </Button>
          <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
            <Save className="mr-1.5 h-4 w-4" /> {save.isPending ? "Guardando…" : "Guardar guía"}
          </Button>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <Card className="p-10 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eef0f7]" style={{ color: ACCENT }}>
          <CareIcon name="ayuda1" size={26} />
        </span>
        <p className="mb-1 text-sm font-medium">Aún no hay guía de cuidados</p>
        <p className="mb-4 text-xs text-muted-foreground">
          Alertas y apoyos para movilidad, alimentación, higiene, vestido y comunicación. Se rellena en un par de minutos.
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setDraft({})}>
            <Pencil className="mr-1.5 h-4 w-4" /> Rellenar guía
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-row flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold">Resumen de apoyos y cuidados</h2>
          <p className="text-xs text-muted-foreground">
            {referents.length > 0 && <>Referentes: {referents.join(", ")} · </>}
            {data.updatedAt && <>Actualizada el {formatDate(data.updatedAt)}{data.updatedByName ? ` por ${data.updatedByName}` : ""}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} title="Imprimir o guardar en PDF">
            <Printer className="mr-1.5 h-4 w-4" /> Imprimir / PDF
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => setDraft(structuredClone(data.data))}>
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
          )}
        </div>
      </Card>
      <AlertsRead data={data.data} />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {filledSections.map((s) => <SectionRead key={s.key} data={data.data} section={s} />)}
      </div>
    </div>
  );
}
