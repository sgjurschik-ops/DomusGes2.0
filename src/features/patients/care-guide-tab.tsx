"use client";

// Pestaña "Guía de cuidados" — solo Centro de día.
// Resumen práctico de apoyos y cuidados de la persona (movilidad,
// alimentación, higiene, vestido, comunicación…). Se rellena casi todo
// marcando opciones, y se imprime como hoja de referencia para el equipo.
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
  CARE_SECTIONS, fieldDisplay, fieldHasData, sectionHasData, selList,
  type CareFieldDef, type CareFieldValue, type CareGuideData, type CareGuideDTO, type CareSectionDef,
} from "@/lib/care-guide";
import { HeartHandshake, Pencil, Printer, Save, X } from "lucide-react";

const ACCENT = "#56608a";

function errDetail(e: unknown): string {
  const body = (e as { body?: { detail?: string; error?: string } })?.body;
  return body?.detail || body?.error || (e instanceof Error ? e.message : "Error desconocido");
}

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// ─── Impresión (hoja A4 tipo "Resumen de apoyos y cuidados") ─────────────────

function buildPrintHtml(
  data: CareGuideData,
  meta: { patientName: string; referents: string[]; updatedAt: string | null },
): string {
  const sections = CARE_SECTIONS.filter((s) => sectionHasData(data, s))
    .map((s) => {
      const rows = s.fields
        .filter((f) => fieldHasData(data[s.key]?.[f.key]))
        .map((f) => {
          const value = esc(fieldDisplay(f, data[s.key]?.[f.key])).replace(/\n/g, "<br>");
          return `<tr><th>${esc(f.label)}</th><td>${value}</td></tr>`;
        })
        .join("");
      return `<section><h2 style="background:${s.band}">${esc(s.title)}</h2><table>${rows}</table></section>`;
    })
    .join("");
  const referents = meta.referents.length
    ? meta.referents.map((r) => `<div>${esc(r)}</div>`).join("")
    : "<div>—</div>";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Guía de cuidados · ${esc(meta.patientName)}</title>
<style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{font-family:Inter,system-ui,-apple-system,sans-serif;color:#1a1f1e;margin:0;padding:24px;font-size:12px}
header{display:flex;justify-content:space-between;align-items:stretch;gap:16px;border:1px solid #cfd6d4;margin-bottom:14px}
header .title{padding:12px 16px;flex:1;text-align:center}
header h1{margin:0;font-size:20px}
header .name{margin-top:4px;font-size:15px}
header .ref{border-left:1px solid #cfd6d4;min-width:190px;font-size:11px}
header .ref .h{background:#eceeed;font-weight:700;text-align:center;padding:6px;font-size:12px}
header .ref div:not(.h){padding:4px 8px;text-align:center}
section{break-inside:avoid;margin-bottom:12px;border:1px solid #cfd6d4}
h2{margin:0;padding:6px;text-align:center;font-size:15px;font-weight:700;border-bottom:1px solid #cfd6d4}
table{width:100%;border-collapse:collapse}
th,td{border-top:1px solid #e3e7e6;padding:6px 8px;vertical-align:top;text-align:left}
tr:first-child th,tr:first-child td{border-top:0}
th{width:170px;font-weight:600;background:#f7f8f8;border-right:1px solid #e3e7e6}
.footer{margin-top:16px;font-size:10px;color:#888;text-align:center}
@media print{body{padding:0}}
</style></head><body>
<header><div class="title"><h1>Resumen de apoyos y cuidados</h1><div class="name">${esc(meta.patientName)}</div></div>
<div class="ref"><div class="h">Referentes</div>${referents}</div></header>
${sections || "<p>La guía de cuidados está vacía.</p>"}
<div class="footer">Nexo · Guía de cuidados${meta.updatedAt ? ` · actualizada el ${esc(formatDate(meta.updatedAt))}` : ""}</div>
</body></html>`;
}

// ─── Vista de lectura ────────────────────────────────────────────────────────

function SectionBand({ section, children }: { section: CareSectionDef; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden gap-0 py-0">
      <div className="px-4 py-2 text-sm font-semibold text-center text-[#2d3533] border-b" style={{ backgroundColor: section.band }}>
        {section.title}
      </div>
      {children}
    </Card>
  );
}

function ReadView({ data }: { data: CareGuideData }) {
  const sections = CARE_SECTIONS.filter((s) => sectionHasData(data, s));
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {sections.map((s) => (
        <SectionBand key={s.key} section={s}>
          <dl className="divide-y text-sm">
            {s.fields
              .filter((f) => fieldHasData(data[s.key]?.[f.key]))
              .map((f) => (
                <div key={f.key} className="grid grid-cols-[150px_1fr] gap-3 px-4 py-2.5">
                  <dt className="font-medium text-muted-foreground">{f.label}</dt>
                  <dd className="whitespace-pre-line">{fieldDisplay(f, data[s.key]?.[f.key])}</dd>
                </div>
              ))}
          </dl>
        </SectionBand>
      ))}
    </div>
  );
}

// ─── Edición ─────────────────────────────────────────────────────────────────

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs transition-colors",
        active ? "text-white border-transparent" : "bg-background text-foreground hover:bg-muted",
      )}
      style={active ? { backgroundColor: ACCENT } : undefined}
    >
      {children}
    </button>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: CareFieldDef;
  value: CareFieldValue | undefined;
  onChange: (v: CareFieldValue) => void;
}) {
  const selected = selList(value);
  const text = value?.text ?? "";

  function toggle(option: string) {
    if (field.kind === "single") {
      onChange({ ...value, sel: selected[0] === option ? undefined : option });
    } else {
      const next = selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option];
      onChange({ ...value, sel: next });
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[170px_1fr] sm:gap-4 px-4 py-3">
      <p className="text-sm font-medium pt-1">{field.label}</p>
      <div className="space-y-2 min-w-0">
        {field.options && (
          <div className="flex flex-wrap gap-1.5">
            {field.options.map((o) => (
              <Chip key={o} active={selected.includes(o)} onClick={() => toggle(o)}>{o}</Chip>
            ))}
          </div>
        )}
        {field.kind === "text" ? (
          <Textarea
            value={text}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            placeholder={field.detailPlaceholder}
            rows={3}
          />
        ) : (
          <Input
            value={text}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            placeholder={field.detailPlaceholder}
            className="h-8 text-sm"
          />
        )}
      </div>
    </div>
  );
}

function EditView({ draft, setDraft }: { draft: CareGuideData; setDraft: (d: CareGuideData) => void }) {
  function setField(sectionKey: string, fieldKey: string, v: CareFieldValue) {
    setDraft({ ...draft, [sectionKey]: { ...(draft[sectionKey] ?? {}), [fieldKey]: v } });
  }
  return (
    <div className="space-y-4">
      {CARE_SECTIONS.map((s) => (
        <SectionBand key={s.key} section={s}>
          <div className="divide-y">
            {s.fields.map((f) => (
              <FieldEditor
                key={f.key}
                field={f}
                value={draft[s.key]?.[f.key]}
                onChange={(v) => setField(s.key, f.key, v)}
              />
            ))}
          </div>
        </SectionBand>
      ))}
    </div>
  );
}

// ─── Pestaña ─────────────────────────────────────────────────────────────────

export function CareGuideTab({
  patientId,
  patientName,
  referent,
  careTeamReferent,
}: {
  patientId: string;
  patientName: string;
  referent: string | null;
  careTeamReferent: string | null;
}) {
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

  const isEmpty = !CARE_SECTIONS.some((s) => sectionHasData(data.data, s));
  const referents = [referent, careTeamReferent].filter((r): r is string => !!r?.trim());

  function handlePrint() {
    if (!data) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildPrintHtml(data.data, { patientName, referents, updatedAt: data.updatedAt }));
    w.document.close();
    w.print();
  }

  // ── Edición ──
  if (draft) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Marca las opciones que correspondan y añade detalles solo si hace falta.</p>
        </div>
        <EditView draft={draft} setDraft={setDraft} />
        <div className="sticky bottom-0 z-10 -mx-1 flex justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
          <Button variant="outline" onClick={() => setDraft(null)} disabled={save.isPending}>
            <X className="w-4 h-4 mr-1.5" /> Cancelar
          </Button>
          <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
            <Save className="w-4 h-4 mr-1.5" /> {save.isPending ? "Guardando…" : "Guardar guía"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Vacía ──
  if (isEmpty) {
    return (
      <Card className="p-10 text-center">
        <HeartHandshake className="w-10 h-10 mx-auto mb-3" style={{ color: ACCENT }} />
        <p className="text-sm font-medium mb-1">Aún no hay guía de cuidados</p>
        <p className="text-xs text-muted-foreground mb-4">
          Resumen de apoyos para movilidad, alimentación, higiene, vestido y comunicación. Se rellena en un par de minutos.
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setDraft({})}>
            <Pencil className="w-4 h-4 mr-1.5" /> Rellenar guía
          </Button>
        )}
      </Card>
    );
  }

  // ── Lectura ──
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {data.updatedAt && (
            <>Actualizada el {formatDate(data.updatedAt)}{data.updatedByName ? ` por ${data.updatedByName}` : ""}</>
          )}
          {referents.length > 0 && <> · Referentes: {referents.join(", ")}</>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => setDraft(structuredClone(data.data))}>
              <Pencil className="w-4 h-4 mr-1.5" /> Editar
            </Button>
          )}
        </div>
      </div>
      <ReadView data={data.data} />
    </div>
  );
}
