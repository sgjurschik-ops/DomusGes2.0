// ─────────────────────────────────────────────────────────────────────────────
// Exportación de seguimientos a un documento imprimible (PDF vía "Imprimir" del
// navegador → "Guardar como PDF"). No usa librerías externas: reutiliza el mismo
// patrón de impresión que el Inventario de AVDs (abrir ventana nueva + print).
//
// `buildVisitsPrintHtml` es una función PURA que arma el HTML; `openVisitsPrint`
// se encarga de abrir la ventana e imprimir. Sirve tanto para exportar un/a
// usuario/a como varios/as a la vez (una sección por usuario/a).
//
// Es solo lectura: no modifica ningún dato. Por eso es una red de seguridad
// segura antes de cualquier otro cambio.
// ─────────────────────────────────────────────────────────────────────────────

export type ExportVisit = {
  date: string; // ISO
  durationMin: number;
  title: string | null;
  notes: string; // HTML de las notas clínicas (tal como se guardan)
  therapistName: string;
  therapistRole?: string | null;
  interventions?: string[];
  tasks?: { id: string; text: string; completed: boolean }[];
  goals?: { text: string; gas?: number }[]; // objetivos ya resueltos a texto
};

export type ExportPatientGroup = {
  patientName: string;
  visits: ExportVisit[];
};

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function visitBlock(v: ExportVisit): string {
  const author = v.therapistRole
    ? `${esc(v.therapistName)} · ${esc(v.therapistRole)}`
    : esc(v.therapistName);

  const goals = (v.goals ?? []).length
    ? `<div class="line"><span class="lbl">Objetivos:</span> ${v
        .goals!.map(
          (g) =>
            `${esc(g.text)}${g.gas !== undefined ? ` (GAS ${g.gas > 0 ? "+" : ""}${g.gas})` : ""}`,
        )
        .join(" · ")}</div>`
    : "";

  const interventions = (v.interventions ?? []).length
    ? `<div class="chips">${v.interventions!.map((i) => `<span class="chip">${esc(i)}</span>`).join("")}</div>`
    : "";

  const tasks = (v.tasks ?? []).length
    ? `<div class="tasks"><span class="lbl">Tareas:</span><ul>${v
        .tasks!.map((t) => `<li>${t.completed ? "☑" : "☐"} ${esc(t.text)}</li>`)
        .join("")}</ul></div>`
    : "";

  return `<div class="visit">
    <div class="vhead">
      <span class="vtitle">${esc(v.title || "Seguimiento")}</span>
      <span class="vmeta">${esc(fmtDateTime(v.date))} · ${v.durationMin} min · ${author}</span>
    </div>
    <div class="notes">${v.notes || "<em>Sin notas.</em>"}</div>
    ${goals}
    ${interventions}
    ${tasks}
  </div>`;
}

export function buildVisitsPrintHtml(
  groups: ExportPatientGroup[],
  meta: { title?: string } = {},
): string {
  const sections = groups
    .map((g) => {
      const body = g.visits.length
        ? g.visits.map(visitBlock).join("")
        : `<p class="empty">Sin seguimientos registrados.</p>`;
      return `<section class="patient">
        <h2>${esc(g.patientName)} <span class="count">(${g.visits.length})</span></h2>
        ${body}
      </section>`;
    })
    .join("");

  const today = new Date().toLocaleDateString("es-ES");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(meta.title ?? "Seguimientos")}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#222;font-size:12.5px;line-height:1.45;max-width:820px;margin:0 auto;padding:32px}
  h1{font-size:18px;color:#1a5c58;margin:0 0 4px}
  .subtitle{color:#666;font-size:12px;margin-bottom:20px}
  section.patient{margin:0 0 28px}
  h2{font-size:15px;color:#1a5c58;border-bottom:2px solid #1a5c58;padding-bottom:4px;margin:20px 0 12px}
  h2 .count{color:#999;font-weight:400;font-size:12px}
  .visit{border:1px solid #ddd;border-radius:8px;padding:12px 14px;margin:0 0 12px;page-break-inside:avoid}
  .vhead{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px}
  .vtitle{font-weight:700}
  .vmeta{color:#666;font-size:11px}
  .notes{background:#f7f7f7;border-radius:6px;padding:8px 10px;margin:6px 0}
  .notes p{margin:0 0 6px}
  .notes p:last-child{margin-bottom:0}
  .line{margin:6px 0;font-size:12px}
  .lbl{font-weight:700;color:#555;text-transform:uppercase;font-size:10.5px;letter-spacing:.03em;margin-right:4px}
  .chips{margin:6px 0;display:flex;gap:6px;flex-wrap:wrap}
  .chip{border:1px solid #ccc;border-radius:10px;padding:1px 8px;font-size:11px}
  .tasks ul{margin:2px 0 0;padding-left:2px;list-style:none}
  .tasks li{font-size:12px}
  .empty{color:#999}
  .footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center}
  @media print{body{padding:12px}button{display:none!important}}
</style></head><body>
<h1>Seguimientos</h1>
<div class="subtitle">${esc(meta.title ?? "")}${meta.title ? " · " : ""}Exportado ${esc(today)}</div>
${sections || `<p class="empty">No hay seguimientos.</p>`}
<div class="footer">DomusGes · Exportación de seguimientos · ${esc(today)}</div>
</body></html>`;
}

// Abre el documento imprimible en una ventana nueva y lanza el diálogo de
// impresión (el usuario elige "Guardar como PDF"). Devuelve false si el
// navegador bloqueó la ventana emergente.
export function openVisitsPrint(
  groups: ExportPatientGroup[],
  meta: { title?: string } = {},
): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(buildVisitsPrintHtml(groups, meta));
  w.document.close();
  w.focus();
  w.print();
  return true;
}
