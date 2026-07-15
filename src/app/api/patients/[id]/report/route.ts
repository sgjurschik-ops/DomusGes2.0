// GET /api/patients/[id]/occupational-profile/report
// Returns a beautifully styled HTML page optimized for print/PDF.
// Open in new tab → Cmd+P → Save as PDF.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

const OTPF_TO_GROUP: Record<string, string> = {
  "Cuidado personal (AVDs)": "Autocuidado",
  "Movilidad funcional": "Autocuidado",
  "Gestión comunitaria": "Autocuidado",
  "Trabajo remunerado/voluntario": "Productividad",
  "Manejo del hogar": "Productividad",
  "Juego/escuela": "Productividad",
  "Recreación tranquila": "Ocio",
  "Recreación activa": "Ocio",
  "Socialización": "Ocio",
  // Legacy
  "AVD": "Autocuidado", "AIVD": "Productividad", "Gestión de la Salud": "Autocuidado",
  "Descanso y Sueño": "Autocuidado", "Educación": "Productividad", "Trabajo": "Productividad",
  "Juego": "Ocio", "Ocio / Tiempo Libre": "Ocio", "Participación Social": "Productividad",
};

const OTPF_COLORS: Record<string, string> = {
  "Cuidado personal (AVDs)": "#E8B48C",
  "Movilidad funcional": "#9CCB9A",
  "Gestión comunitaria": "#93BFE8",
  "Trabajo remunerado/voluntario": "#D99999",
  "Manejo del hogar": "#E0C97A",
  "Juego/escuela": "#B79EDB",
  "Recreación tranquila": "#8FCEC0",
  "Recreación activa": "#E0AD79",
  "Socialización": "#D993BB",
  // Legacy category names (data saved before category rename)
  "AVD": "#E8B48C",
  "Gestión de la Salud": "#9CCB9A",
  "Descanso y Sueño": "#93BFE8",
  "AIVD": "#D99999",
  "Educación": "#E0C97A",
  "Trabajo": "#B79EDB",
  "Juego": "#8FCEC0",
  "Ocio / Tiempo Libre": "#E0AD79",
  "Participación Social": "#D993BB",
};

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim();
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "sin fecha";
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function calcAge(d: Date): number {
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

function safeJson<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, "<br>");
}

// SVG donut chart
function donutSvg(slices: { pct: number; color: string; label: string }[], size = 120, strokeW = 22): string {
  const r = (size - strokeW) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = circ * 0.25; // start at top
  const paths = slices.filter(s => s.pct > 0).map(s => {
    const dash = (s.pct / 100) * circ;
    const svg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${strokeW}" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${offset}" />`;
    offset -= dash;
    return svg;
  }).join("");
  const total = slices.reduce((s, v) => s + (v.pct > 0 ? parseFloat(((v.pct / 100) * circ / 2 / 0.5).toFixed(0)) : 0), 0);
  const totalH = slices.reduce((s, v) => s + v.pct, 0);
  const centerLabel = `${(totalH > 0 ? slices.reduce((s, v) => s + v.pct * 1.2, 0) / 100 * 100 : 0).toFixed(0)}`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}</svg>`;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id } = await params;

    const patient = await db.patient.findUnique({ where: { id } });
    if (!patient) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const profile = await db.occupationalProfile.findUnique({
      where: { patientId: id },
      include: { goals: { orderBy: { createdAt: "asc" } } },
    });

    const latestRecord = profile
      ? await db.weeklyRoutineRecord.findFirst({
          where: { occupationalProfileId: profile.id },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const d: Record<string, any> = { ...(profile ?? {}) };
    const today = fmtDate(new Date());
    const fullName = `${patient.firstName} ${patient.lastName}`;
    const age = calcAge(patient.birthDate);
    const goals: any[] = profile?.goals ?? [];

    // Balance data
    const routineCells = latestRecord?.cells ? safeJson<{ category?: string; group?: string }>(latestRecord.cells as string) : [];
    const balanceCounts: Record<string, number> = { "Autocuidado": 0, "Productividad": 0, "Ocio": 0 };
    for (const c of routineCells) {
      const grp = (c.group as string) || (c.category ? OTPF_TO_GROUP[c.category as string] : null);
      if (grp && grp in balanceCounts) balanceCounts[grp]++;
    }
    const totalSlots = Object.values(balanceCounts).reduce((s, n) => s + n, 0);

    // OTPF data (dynamic: covers both new and legacy category names present in the record)
    const OTPF_CATS = Array.from(new Set(routineCells.map((c) => c.category).filter(Boolean))) as string[];
    const otpfCounts: Record<string, number> = {};
    for (const cat of OTPF_CATS) otpfCounts[cat] = 0;
    for (const c of routineCells) {
      const cat = c.category as string;
      if (cat && cat in otpfCounts) otpfCounts[cat]++;
    }
    const otpfTotal = Object.values(otpfCounts).reduce((s, n) => s + n, 0);

    // Goals stats
    const goalsInProgress = goals.filter(g => g.status === "En curso").length;
    const goalsAchieved = goals.filter(g => g.status === "Conseguido").length;
    const goalsAbandoned = goals.filter(g => g.status === "Abandonado").length;

    // Activity fields
    const actPastSelf = stripHtml(d.activitiesPastSelfcare);
    const actPastProd = stripHtml(d.activitiesPastProductivity);
    const actPastLeis = stripHtml(d.activitiesPastLeisure);
    const actDesSelf = stripHtml(d.activitiesDesiredSelfcare);
    const actDesProd = stripHtml(d.activitiesDesiredProductivity);
    const actDesLeis = stripHtml(d.activitiesDesiredLeisure);
    const hasActivities = actPastSelf || actPastProd || actPastLeis || actDesSelf || actDesProd || actDesLeis;

    // Problems
    const problemsU = stripHtml(d.problemsUser);
    const problemsP = stripHtml(d.problemsProfessional);

    // Family & work
    const family = safeJson<{ name?: string; relationship?: string; occupation?: string; notes?: string }>(d.familyComposition);
    const work = safeJson<{ company?: string; role?: string; year?: string; notes?: string }>(d.workHistory);

    // Social fields
    const socialData: [string, string][] = [];
    if (d.drivingLicense) socialData.push(["Carné de conducir", d.drivingLicense]);
    if (d.currentlyDrives === true || d.currentlyDrives === false) socialData.push(["¿Conduce actualmente?", d.currentlyDrives ? "Sí" : "No"]);
    if (d.drivingReason) socialData.push(["Motivo si no conduce", stripHtml(d.drivingReason)]);
    if (d.maritalStatus) socialData.push(["Estado civil", d.maritalStatus]);
    if (d.partnerInfo) socialData.push(["Pareja", stripHtml(d.partnerInfo)]);
    if (d.livingSituation) socialData.push(["Convivencia actual", stripHtml(d.livingSituation)]);
    if (family.length > 0) socialData.push(["Composición familiar", family.map(fm => [fm.name, fm.relationship, fm.occupation, fm.notes].filter(Boolean).join(" — ")).join("\n")]);
    const supportContacts = safeJson<{ name?: string; relationship?: string; frequency?: string; notes?: string }>(d.supportNetwork);
    if (supportContacts.length > 0) socialData.push(["Red de apoyo / amistades", supportContacts.map(sc => [sc.name, sc.relationship, sc.frequency, sc.notes].filter(Boolean).join(" — ")).join("\n")]);
    else if (typeof d.supportNetwork === "string" && d.supportNetwork.trim()) socialData.push(["Red de apoyo / amistades", stripHtml(d.supportNetwork)]);

    // Work fields
    const workData: [string, string][] = [];
    if (d.educationLevel) workData.push(["Estudios realizados", d.educationLevel]);
    if (d.otherEducation) workData.push(["Otros estudios", stripHtml(d.otherEducation)]);
    if (work.length > 0) workData.push(["Trabajos realizados", work.map(w => [w.company, w.role, w.year, w.notes].filter(Boolean).join(" — ")).join("\n")]);
    if (d.currentOccupation) workData.push(["Trabajo u ocupación actual", stripHtml(d.currentOccupation)]);
    if (d.economicManagement) workData.push(["Gestión económica", stripHtml(d.economicManagement)]);
    if (d.approximateIncome) workData.push(["Ingresos aproximados", d.approximateIncome]);
    if (d.moneyManager) workData.push(["Quién gestiona el dinero", stripHtml(d.moneyManager)]);

    // Balance donut SVG
    const balanceSlices = [
      { pct: totalSlots > 0 ? (balanceCounts["Autocuidado"] / totalSlots) * 100 : 0, color: "#14b8a6", label: "Autocuidado" },
      { pct: totalSlots > 0 ? (balanceCounts["Productividad"] / totalSlots) * 100 : 0, color: "#f59e0b", label: "Productividad" },
      { pct: totalSlots > 0 ? (balanceCounts["Ocio"] / totalSlots) * 100 : 0, color: "#8b5cf6", label: "Ocio" },
    ];

    // OTPF donut SVG
    const otpfSlices = OTPF_CATS.filter(c => otpfCounts[c] > 0).map(c => ({
      pct: (otpfCounts[c] / otpfTotal) * 100,
      color: OTPF_COLORS[c],
      label: c,
    }));

    // ═══════════════════════════════════════════════════════════════════════
    // BUILD HTML
    // ═══════════════════════════════════════════════════════════════════════

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Perfil Ocupacional — ${esc(fullName)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; background: #fff; }
  .container { max-width: 210mm; margin: 0 auto; padding: 0 16mm; }

  /* Print button */
  .print-bar { background: #1A5C58; color: #fff; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
  .print-bar h3 { font-size: 13px; font-weight: 500; }
  .print-btn { background: #fff; color: #1A5C58; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; }
  .print-btn:hover { background: #e0f2f1; }

  /* Cover */
  .cover-bar { background: #1A5C58; border-radius: 8px; padding: 24px 28px; color: #fff; margin-bottom: 20px; margin-top: 20px; }
  .cover-bar h1 { font-size: 18pt; font-weight: 400; letter-spacing: 0.02em; }
  .cover-bar p { color: #B2DFDB; font-size: 9pt; margin-top: 4px; }

  .patient-card { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
  .patient-cell { background: #f9fafb; padding: 12px 16px; }
  .patient-cell + .patient-cell { border-left: 1px solid #e5e7eb; }
  .patient-cell .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 600; margin-bottom: 3px; }
  .patient-cell .value { font-size: 13pt; font-weight: 600; }
  .patient-cell .value-sm { font-size: 11pt; }

  .diag-box { border: 1px solid #e5e7eb; border-top: 3px solid #1A5C58; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; }
  .diag-box .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 600; margin-bottom: 2px; }
  .diag-box .value { font-size: 10pt; margin-bottom: 10px; }
  .diag-box .value:last-child { margin-bottom: 0; }

  /* Summary */
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .summary-box { background: #f9fafb; border-radius: 8px; padding: 16px; }
  .summary-box h4 { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 600; margin-bottom: 10px; }
  .balance-row { display: flex; align-items: center; gap: 16px; }
  .balance-legend { flex: 1; }
  .balance-item { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .balance-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
  .balance-name { font-size: 9pt; font-weight: 600; }
  .balance-val { font-size: 8pt; color: #6b7280; }
  .ref-note { font-size: 7pt; color: #9ca3af; margin-top: 8px; }
  .goals-num { font-size: 24pt; font-weight: 300; margin-bottom: 4px; }
  .goals-sub { font-size: 8.5pt; color: #6b7280; }
  .goals-stat { display: flex; align-items: center; gap: 5px; font-size: 8.5pt; margin-top: 3px; }
  .stat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

  /* Sections */
  .section { margin-bottom: 22px; }
  .section-title { font-size: 12pt; font-weight: 600; color: #1A5C58; padding-bottom: 6px; border-bottom: 2.5px solid #1A5C58; margin-bottom: 14px; }
  .section-title.amber { color: #b45309; border-color: #f59e0b; }

  .field { margin-bottom: 10px; }
  .field .label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 600; margin-bottom: 2px; }
  .field .value { font-size: 9.5pt; padding-bottom: 6px; border-bottom: 1px solid #f0f0f0; }

  /* Activities */
  .act-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .act-col h4 { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; font-weight: 600; margin-bottom: 10px; }
  .act-item { border-left: 3px solid; padding: 6px 0 6px 12px; margin-bottom: 8px; font-size: 9pt; }
  .act-item .area-name { font-size: 8pt; font-weight: 600; margin-bottom: 2px; }
  .act-item.teal { border-color: #14b8a6; }
  .act-item.teal .area-name { color: #1A5C58; }
  .act-item.amber { border-color: #f59e0b; }
  .act-item.amber .area-name { color: #b45309; }
  .act-item.violet { border-color: #8b5cf6; }
  .act-item.violet .area-name { color: #6d28d9; }
  .act-item .empty { color: #9ca3af; font-style: italic; }

  /* Problems */
  .problem-box { border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; }
  .problem-box.user { background: #fef3c7; border-top: 3px solid #f59e0b; }
  .problem-box.prof { background: #e8f5f3; border-top: 3px solid #1A5C58; }
  .problem-box .pb-title { font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .problem-box.user .pb-title { color: #b45309; }
  .problem-box.prof .pb-title { color: #1A5C58; }
  .problem-box p { font-size: 9pt; margin-bottom: 2px; }

  /* Goals */
  .goal-card { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
  .goal-left { width: 5px; }
  .goal-body { padding: 12px 16px; }
  .goal-text { font-size: 10pt; margin-bottom: 8px; }
  .goal-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .badge { font-size: 7.5pt; padding: 2px 8px; border-radius: 4px; font-weight: 600; display: inline-block; }
  .badge.teal { background: #e8f5f3; color: #1A5C58; }
  .badge.amber { background: #fef3c7; color: #b45309; }
  .badge.violet { background: #ede9fe; color: #6d28d9; }
  .badge.green { background: #d1fae5; color: #065f46; }
  .badge.gray { background: #f3f4f6; color: #6b7280; }
  .goal-dates { font-size: 7.5pt; color: #6b7280; }
  .goal-eval { font-size: 8.5pt; color: #4b5563; border-top: 1px solid #f0f0f0; padding-top: 6px; margin-top: 6px; }
  .goal-eval strong { font-size: 7pt; text-transform: uppercase; color: #6b7280; }

  /* OTPF */
  .otpf-row { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
  .otpf-legend { flex: 1; }
  .otpf-item { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .otpf-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
  .otpf-label { font-size: 8pt; }
  .otpf-val { font-size: 8pt; color: #6b7280; margin-left: auto; }

  /* Footer */
  .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 30px; display: flex; justify-content: space-between; font-size: 8.5pt; color: #6b7280; }
  .signature { margin-top: 30px; }
  .signature .line { width: 180px; border-bottom: 1px solid #d1d5db; margin-top: 4px; }
  .signature span { font-size: 8pt; color: #6b7280; }
</style>
</head>
<body>
<div class="print-bar no-print">
  <h3>Informe de Perfil Ocupacional — ${esc(fullName)}</h3>
  <button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button>
</div>
<div class="container">

<!-- COVER -->
<div class="cover-bar">
  <h1>Informe de Perfil Ocupacional</h1>
  <p>DomusGes · Seguimiento ocupacional</p>
</div>

<div class="patient-card">
  <div class="patient-cell">
    <div class="label">Usuario/a</div>
    <div class="value">${esc(fullName)}</div>
  </div>
  <div class="patient-cell">
    <div class="label">Fecha de nacimiento</div>
    <div class="value-sm">${fmtDate(patient.birthDate)} (${age} años)</div>
  </div>
</div>

${patient.diagnosis || patient.objective ? `
<div class="diag-box">
  ${patient.diagnosis ? `<div class="label">Diagnóstico / Motivo de derivación</div><div class="value">${nl2br(patient.diagnosis)}</div>` : ""}
  ${patient.objective ? `<div class="label">Objetivo terapéutico</div><div class="value">${nl2br(patient.objective)}</div>` : ""}
</div>` : ""}

<!-- SUMMARY -->
${totalSlots > 0 || goals.length > 0 ? `
<div class="summary-grid">
  ${totalSlots > 0 ? `
  <div class="summary-box">
    <h4>Equilibrio ocupacional</h4>
    <div class="balance-row">
      ${(() => {
        const r = 40, sw = 16, size = 2 * (r + sw / 2);
        const circ = 2 * Math.PI * r;
        let offset = circ * 0.25;
        const arcs = balanceSlices.filter(s => s.pct > 0).map(s => {
          const dash = (s.pct / 100) * circ;
          const arc = `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" />`;
          offset -= dash;
          return arc;
        }).join("");
        const totalH = (totalSlots * 0.5).toFixed(0);
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}<text x="${size/2}" y="${size/2 + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="#1a1a1a">${totalH}h</text></svg>`;
      })()}
      <div class="balance-legend">
        ${balanceSlices.map(s => `
          <div class="balance-item">
            <span class="balance-dot" style="background:${s.color}"></span>
            <span class="balance-name" style="color:${s.color}">${s.label}</span>
            <span class="balance-val">${(balanceCounts[s.label] * 0.5).toFixed(1)}h · ${s.pct.toFixed(0)}%</span>
          </div>
        `).join("")}
        <div class="ref-note">Ref: Autocuidado ~46% · Productividad ~33% · Ocio ~20%</div>
      </div>
    </div>
  </div>` : ""}
  ${goals.length > 0 ? `
  <div class="summary-box">
    <h4>Objetivos</h4>
    <div class="goals-num">${goals.length}</div>
    <div class="goals-sub">objetivos definidos</div>
    ${goalsInProgress > 0 ? `<div class="goals-stat"><span class="stat-dot" style="background:#f59e0b"></span>${goalsInProgress} en curso</div>` : ""}
    ${goalsAchieved > 0 ? `<div class="goals-stat"><span class="stat-dot" style="background:#065f46"></span>${goalsAchieved} conseguido${goalsAchieved > 1 ? "s" : ""}</div>` : ""}
    ${goalsAbandoned > 0 ? `<div class="goals-stat"><span class="stat-dot" style="background:#6b7280"></span>${goalsAbandoned} abandonado${goalsAbandoned > 1 ? "s" : ""}</div>` : ""}
  </div>` : ""}
</div>` : ""}

<!-- DATOS GENERALES -->
${d.summary || d.documentsAttached || d.referralResource || d.interventionReason ? `
<div class="section">
  <div class="section-title">Datos generales</div>
  ${d.summary ? `<div class="field"><div class="label">Resumen</div><div class="value">${nl2br(stripHtml(d.summary))}</div></div>` : ""}
  ${!d.summary && d.documentsAttached ? `<div class="field"><div class="label">Documentos que adjunta</div><div class="value">${nl2br(stripHtml(d.documentsAttached))}</div></div>` : ""}
  ${!d.summary && d.referralResource ? `<div class="field"><div class="label">Recurso que deriva</div><div class="value">${nl2br(stripHtml(d.referralResource))}</div></div>` : ""}
  ${!d.summary && d.interventionReason ? `<div class="field"><div class="label">Motivo de intervención</div><div class="value">${nl2br(stripHtml(d.interventionReason))}</div></div>` : ""}
</div>` : ""}

<!-- AREA SOCIAL-FAMILIAR -->
${socialData.length > 0 ? `
<div class="section">
  <div class="section-title">Área social-familiar</div>
  ${socialData.map(([label, value]) => `<div class="field"><div class="label">${esc(label)}</div><div class="value">${nl2br(value)}</div></div>`).join("")}
</div>` : ""}

<!-- AREA LABORAL Y ECONOMICA -->
${workData.length > 0 ? `
<div class="section">
  <div class="section-title">Área laboral y económica</div>
  ${workData.map(([label, value]) => `<div class="field"><div class="label">${esc(label)}</div><div class="value">${nl2br(value)}</div></div>`).join("")}
</div>` : ""}

<!-- HABITOS Y RUTINAS -->
${stripHtml(d.dailyRoutine) || stripHtml(d.dailyRoutineMorningWeekday) || stripHtml(d.dailyRoutineAfternoonWeekday) || stripHtml(d.dailyRoutineMorningWeekend) || stripHtml(d.dailyRoutineAfternoonWeekend) || otpfTotal > 0 ? `
<div class="section">
  <div class="section-title">Hábitos y rutinas</div>
  ${stripHtml(d.dailyRoutineMorningWeekday) || stripHtml(d.dailyRoutineAfternoonWeekday) ? `
    <div class="field"><div class="label">Rutina entre semana</div>
      ${stripHtml(d.dailyRoutineMorningWeekday) ? `<div class="value"><strong>Mañana:</strong> ${nl2br(stripHtml(d.dailyRoutineMorningWeekday))}</div>` : ""}
      ${stripHtml(d.dailyRoutineAfternoonWeekday) ? `<div class="value"><strong>Tarde:</strong> ${nl2br(stripHtml(d.dailyRoutineAfternoonWeekday))}</div>` : ""}
    </div>` : ""}
  ${stripHtml(d.dailyRoutineMorningWeekend) || stripHtml(d.dailyRoutineAfternoonWeekend) ? `
    <div class="field"><div class="label">Rutina fin de semana</div>
      ${stripHtml(d.dailyRoutineMorningWeekend) ? `<div class="value"><strong>Mañana:</strong> ${nl2br(stripHtml(d.dailyRoutineMorningWeekend))}</div>` : ""}
      ${stripHtml(d.dailyRoutineAfternoonWeekend) ? `<div class="value"><strong>Tarde:</strong> ${nl2br(stripHtml(d.dailyRoutineAfternoonWeekend))}</div>` : ""}
    </div>` : ""}
  ${stripHtml(d.dailyRoutine) && !stripHtml(d.dailyRoutineMorningWeekday) ? `<div class="field"><div class="label">Rutina de un día</div><div class="value">${nl2br(stripHtml(d.dailyRoutine))}</div></div>` : ""}
  ${otpfTotal > 0 ? `
  <div style="margin-top:12px">
    <div class="label" style="margin-bottom:10px">Distribución por áreas OTPF</div>
    <div class="otpf-row">
      ${(() => {
        const r = 35, sw = 14, size = 2 * (r + sw / 2);
        const circ = 2 * Math.PI * r;
        let offset = circ * 0.25;
        const arcs = otpfSlices.map(s => {
          const dash = (s.pct / 100) * circ;
          const arc = `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" />`;
          offset -= dash;
          return arc;
        }).join("");
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}</svg>`;
      })()}
      <div class="otpf-legend">
        ${OTPF_CATS.filter(c => otpfCounts[c] > 0).map(c => `
          <div class="otpf-item">
            <span class="otpf-dot" style="background:${OTPF_COLORS[c]}"></span>
            <span class="otpf-label">${esc(c)}</span>
            <span class="otpf-val">${(otpfCounts[c] * 0.5).toFixed(1)}h (${((otpfCounts[c] / otpfTotal) * 100).toFixed(0)}%)</span>
          </div>
        `).join("")}
      </div>
    </div>
  </div>` : ""}
</div>` : ""}

<!-- ACTIVIDADES REALIZADAS Y DESEADAS -->
${hasActivities ? `
<div class="section">
  <div class="section-title">Actividades realizadas y deseadas</div>
  <div class="act-grid">
    <div class="act-col">
      <h4>Actividades que realizaba</h4>
      <div class="act-item teal"><div class="area-name">Cuidado de sí mismo</div>${actPastSelf ? nl2br(actPastSelf) : '<span class="empty">Sin información</span>'}</div>
      <div class="act-item amber"><div class="area-name">Productividad</div>${actPastProd ? nl2br(actPastProd) : '<span class="empty">Sin información</span>'}</div>
      <div class="act-item violet"><div class="area-name">Ocio</div>${actPastLeis ? nl2br(actPastLeis) : '<span class="empty">Sin información</span>'}</div>
    </div>
    <div class="act-col">
      <h4>Actividades que le gustaría retomar</h4>
      <div class="act-item teal"><div class="area-name">Cuidado de sí mismo</div>${actDesSelf ? nl2br(actDesSelf) : '<span class="empty">Sin información</span>'}</div>
      <div class="act-item amber"><div class="area-name">Productividad</div>${actDesProd ? nl2br(actDesProd) : '<span class="empty">Sin información</span>'}</div>
      <div class="act-item violet"><div class="area-name">Ocio</div>${actDesLeis ? nl2br(actDesLeis) : '<span class="empty">Sin información</span>'}</div>
    </div>
  </div>
</div>` : ""}

<!-- PROBLEMAS DETECTADOS -->
${problemsU || problemsP ? `
<div class="section">
  <div class="section-title amber">Problemas detectados</div>
  ${problemsU ? `<div class="problem-box user"><div class="pb-title">Problemas detectados por el/la usuario/a</div>${nl2br(problemsU).split("<br>").map(l => `<p>${l}</p>`).join("")}</div>` : ""}
  ${problemsP ? `<div class="problem-box prof"><div class="pb-title">Problemas detectados por el/la profesional</div>${nl2br(problemsP).split("<br>").map(l => `<p>${l}</p>`).join("")}</div>` : ""}
</div>` : ""}

<!-- OBJETIVOS -->
${goals.length > 0 ? `
<div class="section">
  <div class="section-title">Objetivos y planificación</div>
  ${stripHtml(d.desiredImprovements) ? `<div class="field"><div class="label">Qué le gustaría conseguir o mejorar</div><div class="value">${nl2br(stripHtml(d.desiredImprovements))}</div></div>` : ""}
  ${goals.map(goal => {
    const area = goal.area as string;
    const areaCls = area.includes("Cuidado") || area.includes("Autocuidado") ? "teal" : area === "Productividad" ? "amber" : "violet";
    const statusCls = goal.status === "Conseguido" ? "green" : goal.status === "Abandonado" ? "gray" : "amber";
    return `
    <div class="goal-card" style="border-left: 5px solid ${areaCls === "teal" ? "#14b8a6" : areaCls === "amber" ? "#f59e0b" : "#8b5cf6"}">
      <div class="goal-body">
        <div class="goal-text">${nl2br(goal.text || "Sin descripción")}</div>
        <div class="goal-meta">
          <span class="badge ${areaCls}">${esc(area)}</span>
          <span class="badge ${statusCls}">${esc(goal.status)}</span>
          <span class="goal-dates">Inicio: ${fmtDate(goal.startDate)} · Objetivo: ${fmtDate(goal.targetDate)}</span>
        </div>
        ${goal.evaluation?.trim() ? `<div class="goal-eval"><strong>Evaluación:</strong> ${nl2br(goal.evaluation)}</div>` : ""}
      </div>
    </div>`;
  }).join("")}
</div>` : ""}

<!-- FOOTER -->
<div class="footer">
  <span>Profesional: ${esc(prof.name)} (${esc(prof.role)})</span>
  <span>Fecha: ${today}</span>
</div>
<div class="signature">
  <span>Firma:</span>
  <div class="line"></div>
</div>

</div>
</body>
</html>`;

    await audit(prof.id, "occupational_profile.report", "OccupationalProfile", id);

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err: any) {
    console.error("REPORT ERROR:", err);
    return NextResponse.json({ error: err?.message ?? "UNKNOWN", stack: err?.stack?.split("\\n").slice(0, 5) }, { status: 500 });
  }
}
