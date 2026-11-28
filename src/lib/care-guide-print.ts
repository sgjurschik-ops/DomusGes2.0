// Hoja imprimible (A4) de la Guía de cuidados. Se abre en una ventana nueva
// y se imprime o se guarda en PDF desde el diálogo del navegador
// ("Guardar como PDF"). Los colores e iconos se fuerzan para que salgan
// también en el PDF.

import {
  ALERTS_SECTION, ALERT_RED, CARE_SECTIONS, careIconSvg, fieldHasData, optionIcon, sectionHasData, selList,
  type CareFieldDef, type CareFieldValue, type CareGuideData, type CareSectionDef,
} from "@/lib/care-guide";

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
const nl2br = (s: string) => esc(s).replace(/\n/g, "<br>");

function fieldHtml(s: CareSectionDef, f: CareFieldDef, v: CareFieldValue): string {
  const sel = selList(v);
  const text = v.text?.trim() ?? "";
  switch (f.kind) {
    case "level": {
      const lead = sel
        .map((l) => `<span class="lvl">${careIconSvg(optionIcon(f, l, s.icon), 15, s.tone, 1.9)}<b>${esc(l)}</b></span>`)
        .join(" + ");
      return `${lead}${lead && text ? " " : ""}${esc(text)}`;
    }
    case "choice": {
      const lead = sel[0] ? `<b>${esc(sel[0])}</b>` : "";
      return `${lead}${lead && text ? " " : ""}${esc(text)}`;
    }
    case "chips":
      return esc([...sel, ...(text ? [text] : [])].join(" · "));
    case "tiles": {
      const tiles = sel
        .map((l) => `<span class="tile">${careIconSvg(optionIcon(f, l, s.icon), 26, s.tone, 1.6)}<span>${esc(l)}</span></span>`)
        .join("");
      return `${tiles ? `<div class="tiles">${tiles}</div>` : ""}${text ? `<div class="note">${esc(text)}</div>` : ""}`;
    }
    case "text":
      return nl2br(text);
    default:
      return "";
  }
}

function sectionHtml(data: CareGuideData, s: CareSectionDef): string {
  const rows = s.fields
    .filter((f) => fieldHasData(data[s.key]?.[f.key]))
    .map((f) => `<tr><th>${esc(f.label)}</th><td>${fieldHtml(s, f, data[s.key]![f.key]!)}</td></tr>`)
    .join("");
  return `<section><h2 style="background:${s.band}">${careIconSvg(s.icon, 17, s.tone, 1.9)}<span>${esc(s.title)}</span></h2><table>${rows}</table></section>`;
}

function alertsHtml(data: CareGuideData): string {
  const v = data[ALERTS_SECTION.key]?.alertas;
  if (!v || !fieldHasData(v)) return "";
  const f = ALERTS_SECTION.fields[0];
  const items = selList(v)
    .map((l) => {
      const d = v.details?.[l];
      return `<span class="alert">${careIconSvg(optionIcon(f, l, "alergia"), 16, ALERT_RED, 2)}<b>${esc(l)}</b>${d ? ` · ${esc(d)}` : ""}</span>`;
    })
    .join("");
  const other = v.text?.trim() ? `<span class="alert">${careIconSvg("alergia", 16, ALERT_RED, 2)}${esc(v.text)}</span>` : "";
  return `<div class="alerts"><span class="alerts-h">Alertas</span>${items}${other}</div>`;
}

export function buildCareGuidePrintHtml(
  data: CareGuideData,
  meta: { patientName: string; referents: string[]; updatedAt: string | null },
): string {
  const sections = CARE_SECTIONS.filter((s) => sectionHasData(data, s)).map((s) => sectionHtml(data, s)).join("");
  const referents = meta.referents.length ? meta.referents.map((r) => `<div>${esc(r)}</div>`).join("") : "<div>—</div>";
  const updated = meta.updatedAt
    ? ` · actualizada el ${esc(new Date(meta.updatedAt).toLocaleDateString("es-ES"))}`
    : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Guía de cuidados · ${esc(meta.patientName)}</title>
<style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Inter,"Helvetica Neue",Arial,sans-serif;color:#1a1f1e;margin:0;padding:20px;font-size:11.5px;line-height:1.4}
header{display:flex;border:1px solid #cfd6d4;margin-bottom:10px}
header .t{flex:1;padding:10px 14px;text-align:center}
header h1{margin:0;font-size:19px}
header .n{margin-top:3px;font-size:14px}
header .r{width:180px;border-left:1px solid #cfd6d4;font-size:10.5px}
header .r .h{background:#eceeed;font-weight:700;text-align:center;padding:5px;font-size:11px}
header .r div:not(.h){padding:3px 6px;text-align:center}
.alerts{border:2px solid ${ALERT_RED};background:#fdecea;padding:7px 10px;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:5px 16px;align-items:center;break-inside:avoid}
.alerts-h{font-weight:700;color:${ALERT_RED};text-transform:uppercase;letter-spacing:.05em;font-size:10.5px}
.alert{display:inline-flex;align-items:center;gap:5px;color:#7a1a12}
section{border:1px solid #cfd6d4;margin-bottom:9px;break-inside:avoid}
h2{margin:0;padding:6px;font-size:13.5px;display:flex;align-items:center;justify-content:center;gap:7px;border-bottom:1px solid #cfd6d4}
table{width:100%;border-collapse:collapse}
th,td{padding:5px 8px;vertical-align:top;text-align:left;border-top:1px solid #e3e7e6}
tr:first-child th,tr:first-child td{border-top:0}
th{width:120px;font-weight:600;background:#f7f8f8;border-right:1px solid #e3e7e6}
.lvl{display:inline-flex;align-items:center;gap:4px;vertical-align:middle}
.tiles{display:flex;flex-wrap:wrap;gap:8px 12px}
.tile{display:inline-flex;flex-direction:column;align-items:center;gap:2px;width:72px;text-align:center;font-size:10px;line-height:1.2}
.note{margin-top:3px;color:#5f6b68}
.footer{margin-top:10px;font-size:9px;color:#888;text-align:center}
@media print{body{padding:0}}
</style></head><body>
<header><div class="t"><h1>Resumen de apoyos y cuidados</h1><div class="n">${esc(meta.patientName)}</div></div>
<div class="r"><div class="h">Referentes</div>${referents}</div></header>
${alertsHtml(data)}
${sections || (alertsHtml(data) ? "" : "<p>La guía de cuidados está vacía.</p>")}
<div class="footer">Nexo · Guía de cuidados${updated}</div>
</body></html>`;
}

// Abre la hoja en una ventana nueva y lanza el diálogo de impresión, desde
// el que se puede elegir "Guardar como PDF".
export function printCareGuide(html: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  // Pequeña espera para que el navegador pinte la hoja antes de imprimir.
  setTimeout(() => w.print(), 300);
  return true;
}
