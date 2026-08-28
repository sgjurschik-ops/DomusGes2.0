"use client";

// Vista de solo lectura de un "Inventario de AVDs" guardado, con:
//  - comparación opcional con la valoración anterior (autonomía "antes → ahora")
//  - botón de Imprimir / PDF (cuando se pasa `printMeta`)
// El contenido clínico vive en src/lib/adl-inventory.ts.

import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import {
  ADL_INVENTORY_SECTIONS,
  AUTONOMY_OPTIONS,
  MODIFICATION_OPTIONS,
  CONCLUSION_OPTIONS,
  TRAFFIC_LIGHT_COLORS,
  type AdlInventoryData,
  type AdlItemData,
  type TrafficLight,
} from "@/lib/adl-inventory";

type TrafficOption = { value: TrafficLight; label: string; help?: string };

function labelFor(value: TrafficLight, options: TrafficOption[]): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function Light({ value, options }: { value: TrafficLight | null; options: TrafficOption[] }) {
  if (!value) return null;
  const c = TRAFFIC_LIGHT_COLORS[value];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.dot }} />
      {labelFor(value, options)}
    </span>
  );
}

function hasData(d: AdlItemData | undefined): boolean {
  if (!d) return false;
  return (
    d.autonomy !== null ||
    d.modificacion !== null ||
    !!d.desempeno ||
    !!d.apoyos ||
    d.vigilancia ||
    d.prioridad
  );
}

function Row({ label, d, prev }: { label: string; d: AdlItemData; prev?: AdlItemData }) {
  const changed = !!prev && prev.autonomy !== null && prev.autonomy !== d.autonomy;
  return (
    <div className="px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Light value={d.autonomy} options={AUTONOMY_OPTIONS} />
          {changed && prev?.autonomy && (
            <span className="text-[11px] text-muted-foreground">
              (antes: {labelFor(prev.autonomy, AUTONOMY_OPTIONS)})
            </span>
          )}
          {d.vigilancia && (
            <span className="rounded-full border px-2 py-0.5 text-[11px] bg-amber-50 border-amber-200 text-amber-900">
              Vigilancia
            </span>
          )}
          {d.prioridad && (
            <span className="rounded-full border px-2 py-0.5 text-[11px] bg-[#1a5c58]/10 border-[#1a5c58]/20 text-[#1a5c58]">
              Prioridad
            </span>
          )}
        </div>
      </div>
      {d.desempeno && (
        <p className="text-xs">
          <span className="text-muted-foreground">Desempeño: </span>
          {d.desempeno}
        </p>
      )}
      {d.apoyos && (
        <p className="text-xs">
          <span className="text-muted-foreground">Apoyos: </span>
          {d.apoyos}
        </p>
      )}
      {d.modificacion && (
        <div>
          <Light value={d.modificacion} options={MODIFICATION_OPTIONS} />
        </div>
      )}
    </div>
  );
}

// ─── Impresión ───────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

function cell(value: TrafficLight | null, options: TrafficOption[]): string {
  if (!value) return "—";
  const c = TRAFFIC_LIGHT_COLORS[value];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${c.bg};color:${c.text};border:1px solid ${c.border};font-size:11px;white-space:nowrap">${esc(labelFor(value, options))}</span>`;
}

function buildPrintHtml(
  data: AdlInventoryData,
  previous: AdlInventoryData | null | undefined,
  meta: { patientName: string; date: string },
): string {
  const withPrev = !!previous;
  const colspan = withPrev ? 7 : 6;

  let rows = "";
  for (const section of ADL_INVENTORY_SECTIONS) {
    const items = section.items.filter((it) => hasData(data.items[it.id]) || (previous && hasData(previous.items[it.id])));
    const customs = data.customRows.filter((r) => r.sectionId === section.id && (hasData(r) || !!r.label));
    if (items.length === 0 && customs.length === 0) continue;

    rows += `<tr><td class="sec" colspan="${colspan}">${esc(section.title)}</td></tr>`;

    const render = (label: string, d: AdlItemData, prev?: AdlItemData) => {
      const prevCell = withPrev ? `<td>${cell(prev?.autonomy ?? null, AUTONOMY_OPTIONS)}</td>` : "";
      return `<tr>
        <td class="act">${esc(label)}</td>
        <td>${cell(d.autonomy, AUTONOMY_OPTIONS)}</td>
        ${prevCell}
        <td class="txt">${esc(d.desempeno) || "—"}</td>
        <td class="txt">${esc(d.apoyos) || "—"}</td>
        <td>${d.vigilancia ? "Sí" : "—"}${d.prioridad ? " · Prioridad" : ""}</td>
        <td>${cell(d.modificacion, MODIFICATION_OPTIONS)}</td>
      </tr>`;
    };

    for (const it of items) rows += render(it.label, data.items[it.id], previous?.items[it.id]);
    for (const r of customs) rows += render(r.label || "Otra", r);
  }

  const prevHead = withPrev ? "<th>Autonomía anterior</th>" : "";
  const conclusion = data.conclusion ? cell(data.conclusion, CONCLUSION_OPTIONS) : "—";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Inventario de AVDs — ${esc(meta.patientName)}</title>
<style>
body{font-family:system-ui,sans-serif;padding:32px;color:#333;font-size:12px;max-width:1000px;margin:0 auto}
h1{font-size:18px;color:#1a5c58;margin-bottom:2px}
.subtitle{color:#666;font-size:12px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin:8px 0 16px}
th,td{border:1px solid #ddd;padding:5px 7px;text-align:center;vertical-align:top}
th{background:#f5f5f5;font-weight:600;font-size:11px}
td.act{text-align:left;font-weight:500;width:180px}
td.txt{text-align:left;font-size:11px}
td.sec{text-align:left;background:#eef4f3;color:#1a5c58;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.03em}
.concl{margin-top:8px;padding:10px 12px;border:2px solid #1a5c58;border-radius:8px;background:#eef4f3}
.footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center}
@media print{body{padding:12px}button{display:none!important}}
</style></head><body>
<h1>Inventario de AVDs</h1>
<div class="subtitle">${esc(meta.patientName)} · ${esc(meta.date)}${withPrev ? " · comparado con la valoración anterior" : ""}</div>
<table>
<thead><tr><th style="text-align:left">Actividad</th><th>Autonomía</th>${prevHead}<th>Desempeño / cambios</th><th>Apoyos</th><th>Vig. / Prior.</th><th>Modificación</th></tr></thead>
<tbody>${rows || `<tr><td colspan="${colspan}">Sin datos registrados.</td></tr>`}</tbody>
</table>
<div class="concl">
<strong style="color:#1a5c58">Percepción y conclusión</strong>
<p style="margin:6px 0">${esc(data.perception) || "—"}</p>
<div>Conclusión de autonomía: ${conclusion}</div>
</div>
<div class="footer">DomusGes · Inventario de AVDs · ${esc(new Date().toLocaleDateString("es-ES"))}</div>
</body></html>`;
}

export function AdlInventoryView({
  data,
  previous,
  printMeta,
}: {
  data: AdlInventoryData;
  previous?: AdlInventoryData | null;
  printMeta?: { patientName: string; date: string };
}) {
  function handlePrint() {
    if (!printMeta) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildPrintHtml(data, previous, printMeta));
    w.document.close();
    w.print();
  }

  const anyData =
    ADL_INVENTORY_SECTIONS.some((s) => s.items.some((it) => hasData(data.items[it.id]))) ||
    data.customRows.some((r) => hasData(r)) ||
    !!data.perception ||
    !!data.conclusion;

  if (!anyData) {
    return <p className="text-sm text-muted-foreground">Inventario sin datos registrados.</p>;
  }

  return (
    <div className="space-y-3">
      {printMeta && (
        <div className="flex items-center justify-between">
          {previous ? (
            <p className="text-[11px] text-muted-foreground">Se muestran los cambios respecto a la valoración anterior.</p>
          ) : (
            <span />
          )}
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <FileDown className="w-3.5 h-3.5 mr-1.5" />
            Imprimir / PDF
          </Button>
        </div>
      )}

      {ADL_INVENTORY_SECTIONS.map((section) => {
        const items = section.items.filter((it) => hasData(data.items[it.id]));
        const customs = data.customRows.filter((r) => r.sectionId === section.id && (hasData(r) || !!r.label));
        if (items.length === 0 && customs.length === 0) return null;
        return (
          <div key={section.id} className="rounded-lg border">
            <div className="px-3 py-1.5 border-b bg-muted/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</p>
            </div>
            <div className="divide-y">
              {items.map((it) => (
                <Row key={it.id} label={it.label} d={data.items[it.id]} prev={previous?.items[it.id]} />
              ))}
              {customs.map((r) => (
                <Row key={r.id} label={r.label || "Otra"} d={r} />
              ))}
            </div>
          </div>
        );
      })}

      {(data.perception || data.conclusion) && (
        <div className="rounded-lg border-2 border-[#1a5c58]/30 bg-[#1a5c58]/5 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1a5c58]">Percepción y conclusión</p>
          {data.perception && <p className="text-sm">{data.perception}</p>}
          {data.conclusion && <Light value={data.conclusion} options={CONCLUSION_OPTIONS} />}
        </div>
      )}
    </div>
  );
}
