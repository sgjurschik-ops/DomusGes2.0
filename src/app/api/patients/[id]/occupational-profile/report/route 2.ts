// GET /api/patients/[id]/occupational-profile/report
// Professional PDF report of the occupational profile.
// Uses pdf-lib for server-side generation with donut charts,
// color-coded sections, and visual goal cards.

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont, type RGB } from "pdf-lib";
import { db } from "@/lib/db";
import { requireProfessional, audit } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

// ─── Constants ──────────────────────────────────────────────────────────────

const W = 595.28; // A4 width
const H = 841.89; // A4 height
const M = 50;     // margin
const CW = W - M * 2; // content width

// Colors
const TEAL: RGB = rgb(0.102, 0.361, 0.345);     // #1A5C58
const TEAL_L: RGB = rgb(0.91, 0.96, 0.95);       // light teal bg
const AMBER: RGB = rgb(0.706, 0.333, 0.035);     // #B45309
const AMBER_L: RGB = rgb(0.996, 0.953, 0.78);    // light amber bg
const VIOLET: RGB = rgb(0.427, 0.157, 0.851);    // #6D28D9
const VIOLET_L: RGB = rgb(0.929, 0.914, 0.992);  // light violet bg
const GRAY: RGB = rgb(0.42, 0.42, 0.42);
const GRAY_L: RGB = rgb(0.95, 0.95, 0.95);
const WHITE: RGB = rgb(1, 1, 1);
const BLACK: RGB = rgb(0.1, 0.1, 0.1);
const BORDER: RGB = rgb(0.9, 0.9, 0.9);
const GREEN_D: RGB = rgb(0.024, 0.373, 0.275);
const GREEN_L: RGB = rgb(0.82, 0.98, 0.898);

const AREA_COLORS: Record<string, { bg: RGB; text: RGB; hex: string }> = {
  "Cuidado de sí mismo": { bg: TEAL_L, text: TEAL, hex: "#14b8a6" },
  "Productividad": { bg: AMBER_L, text: AMBER, hex: "#f59e0b" },
  "Ocio": { bg: VIOLET_L, text: VIOLET, hex: "#8b5cf6" },
};

const STATUS_COLORS: Record<string, { bg: RGB; text: RGB }> = {
  "En curso": { bg: AMBER_L, text: AMBER },
  "Conseguido": { bg: GREEN_L, text: GREEN_D },
  "Abandonado": { bg: GRAY_L, text: GRAY },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim();
}

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
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

function hexToRgb(hex: string): RGB {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

// Wraps text to fit within maxWidth, returning lines
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (!rawLine.trim()) { lines.push(""); continue; }
    const words = rawLine.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

// ─── Donut chart ────────────────────────────────────────────────────────────

function drawDonut(
  page: PDFPage, cx: number, cy: number,
  outerR: number, innerR: number,
  slices: { pct: number; color: RGB }[],
) {
  const TWO_PI = Math.PI * 2;
  let startAngle = -Math.PI / 2;
  for (const slice of slices) {
    if (slice.pct <= 0) continue;
    const angle = TWO_PI * (slice.pct / 100);
    const steps = Math.max(12, Math.ceil((angle / TWO_PI) * 80));
    for (let i = 0; i <= steps; i++) {
      const a = startAngle + (angle * i) / steps;
      page.drawLine({
        start: { x: cx + Math.cos(a) * innerR, y: cy + Math.sin(a) * innerR },
        end: { x: cx + Math.cos(a) * outerR, y: cy + Math.sin(a) * outerR },
        thickness: (TWO_PI * outerR * (angle / TWO_PI)) / steps + 0.8,
        color: slice.color,
      });
    }
    startAngle += angle;
  }
}

// ─── Page manager ───────────────────────────────────────────────────────────

class PageManager {
  private doc: typeof PDFDocument extends new (...args: any) => infer R ? R : any;
  page: PDFPage;
  y: number;
  font: PDFFont;
  fontBold: PDFFont;

  constructor(doc: any, font: PDFFont, fontBold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.fontBold = fontBold;
    this.page = doc.addPage([W, H]);
    this.y = H - M;
  }

  ensureSpace(needed: number) {
    if (this.y - needed < M + 20) {
      this.page = this.doc.addPage([W, H]);
      this.y = H - M;
    }
  }

  drawRect(x: number, y: number, w: number, h: number, color: RGB, borderColor?: RGB) {
    this.page.drawRectangle({ x, y, width: w, height: h, color });
    if (borderColor) {
      this.page.drawRectangle({ x, y, width: w, height: h, borderColor, borderWidth: 0.5, color: rgb(0, 0, 0) });
      // Overdraw fill to hide the inner part of border
      this.page.drawRectangle({ x: x + 0.5, y: y + 0.5, width: w - 1, height: h - 1, color });
    }
  }

  text(txt: string, x: number, size: number, color: RGB, bold = false, maxWidth?: number): number {
    const f = bold ? this.fontBold : this.font;
    const lines = maxWidth ? wrapText(txt, f, size, maxWidth) : [txt];
    const lineH = size * 1.4;
    for (const line of lines) {
      this.page.drawText(line, { x, y: this.y, size, font: f, color });
      this.y -= lineH;
    }
    return lines.length * lineH;
  }

  label(txt: string, x = M) {
    this.page.drawText(txt.toUpperCase(), { x, y: this.y, size: 7.5, font: this.fontBold, color: GRAY });
    this.y -= 11;
  }

  value(txt: string, x = M, maxW = CW) {
    const lines = wrapText(txt, this.font, 9.5, maxW);
    for (const line of lines) {
      this.page.drawText(line, { x, y: this.y, size: 9.5, font: this.font, color: BLACK });
      this.y -= 13;
    }
    // Separator line
    this.page.drawLine({ start: { x, y: this.y + 2 }, end: { x: x + maxW, y: this.y + 2 }, thickness: 0.3, color: BORDER });
    this.y -= 8;
  }

  sectionTitle(txt: string, color = TEAL) {
    this.ensureSpace(40);
    this.y -= 12;
    this.page.drawLine({ start: { x: M, y: this.y - 2 }, end: { x: M + CW, y: this.y - 2 }, thickness: 2.5, color });
    this.page.drawText(txt, { x: M, y: this.y + 5, size: 12, font: this.fontBold, color });
    this.y -= 22;
  }

  field(lbl: string, val: string | undefined | null, x = M, maxW = CW) {
    const v = stripHtml(val);
    if (!v) return;
    this.ensureSpace(30);
    this.label(lbl, x);
    this.value(v, x, maxW);
  }

  skip(pts: number) { this.y -= pts; }
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const profile = await db.occupationalProfile.findUnique({
    where: { patientId: id },
    include: { goals: { orderBy: { createdAt: "asc" } } },
  });

  // Also fetch latest routine record for balance charts
  const latestRecord = profile
    ? await db.weeklyRoutineRecord.findFirst({
        where: { occupationalProfileId: profile.id },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const d: Record<string, any> = { ...(profile ?? {}) };
  const today = fmtDate(new Date());
  const birthStr = fmtDate(patient.birthDate);
  const age = calcAge(patient.birthDate);
  const fullName = `${patient.firstName} ${patient.lastName}`;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pm = new PageManager(pdfDoc, font, fontBold);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ═══════════════════════════════════════════════════════════════════════════

  // Brand header bar
  pm.drawRect(M, pm.y - 55, CW, 60, TEAL);
  pm.page.drawText("INFORME DE PERFIL OCUPACIONAL", {
    x: M + 20, y: pm.y - 20, size: 16, font: fontBold, color: WHITE,
  });
  pm.page.drawText("DomusGes · Seguimiento ocupacional", {
    x: M + 20, y: pm.y - 38, size: 8.5, font, color: rgb(0.7, 0.87, 0.84),
  });
  pm.y -= 72;

  // Patient info card
  pm.drawRect(M, pm.y - 38, CW, 42, GRAY_L);
  pm.page.drawText("USUARIO/A", { x: M + 10, y: pm.y - 10, size: 7, font: fontBold, color: GRAY });
  pm.page.drawText(fullName, { x: M + 10, y: pm.y - 24, size: 13, font: fontBold, color: BLACK });
  pm.page.drawText("FECHA DE NACIMIENTO", { x: M + CW * 0.55, y: pm.y - 10, size: 7, font: fontBold, color: GRAY });
  pm.page.drawText(`${birthStr} (${age} años)`, { x: M + CW * 0.55, y: pm.y - 24, size: 11, font, color: BLACK });
  pm.page.drawLine({ start: { x: M + CW * 0.52, y: pm.y - 38 }, end: { x: M + CW * 0.52, y: pm.y + 4 }, thickness: 0.5, color: BORDER });
  pm.y -= 52;

  // Diagnosis & objective box
  if (patient.diagnosis || patient.objective) {
    const diagLines: string[] = [];
    if (patient.diagnosis) diagLines.push(...wrapText(patient.diagnosis, font, 9, CW - 30));
    if (patient.objective) diagLines.push(...wrapText(patient.objective, font, 9, CW - 30));
    const boxH = 20 + (patient.diagnosis ? 12 + diagLines.filter(() => true).length * 12 : 0) + (patient.objective ? 24 : 0);

    pm.page.drawLine({ start: { x: M, y: pm.y + 2 }, end: { x: M + CW, y: pm.y + 2 }, thickness: 2.5, color: TEAL });
    pm.drawRect(M, pm.y - boxH + 2, CW, boxH, rgb(0.98, 0.98, 0.98));

    let boxY = pm.y - 8;
    if (patient.diagnosis) {
      pm.page.drawText("DIAGNÓSTICO / MOTIVO DE DERIVACIÓN", { x: M + 10, y: boxY, size: 7, font: fontBold, color: GRAY });
      boxY -= 13;
      for (const line of wrapText(patient.diagnosis, font, 9, CW - 30)) {
        pm.page.drawText(line, { x: M + 10, y: boxY, size: 9, font, color: BLACK });
        boxY -= 12;
      }
      boxY -= 4;
    }
    if (patient.objective) {
      pm.page.drawText("OBJETIVO TERAPÉUTICO", { x: M + 10, y: boxY, size: 7, font: fontBold, color: GRAY });
      boxY -= 13;
      for (const line of wrapText(patient.objective, font, 9, CW - 30)) {
        pm.page.drawText(line, { x: M + 10, y: boxY, size: 9, font, color: BLACK });
        boxY -= 12;
      }
    }
    pm.y -= boxH + 8;
  }

  // ── Summary dashboard ──
  const goals: any[] = profile?.goals ?? [];
  const routineCells = latestRecord?.cells ? safeJson<{ category?: string; group?: string }>(latestRecord.cells as string) : [];

  pm.skip(12);

  // Balance donut chart
  const filled = routineCells.filter(c => c.group);
  const balanceCounts: Record<string, number> = { "Cuidado de sí mismo": 0, "Productividad": 0, "Ocio": 0 };
  for (const c of filled) {
    const grp = c.group as string;
    if (grp in balanceCounts) balanceCounts[grp]++;
  }
  const totalSlots = Object.values(balanceCounts).reduce((s, n) => s + n, 0);

  if (totalSlots > 0 || goals.length > 0) {
    pm.page.drawText("RESUMEN", { x: M, y: pm.y, size: 10, font: fontBold, color: TEAL });
    pm.y -= 20;

    // Two columns: left = balance chart, right = goals summary
    const colW = CW * 0.48;
    const chartCx = M + 55;
    const chartCy = pm.y - 40;

    if (totalSlots > 0) {
      // Donut chart
      const slices = Object.entries(balanceCounts).map(([name, count]) => ({
        pct: (count / totalSlots) * 100,
        color: hexToRgb(AREA_COLORS[name]?.hex ?? "#888"),
      }));
      drawDonut(pm.page, chartCx, chartCy, 38, 20, slices);

      // Center text
      pm.page.drawText(`${(totalSlots * 0.5).toFixed(0)}h`, {
        x: chartCx - font.widthOfTextAtSize(`${(totalSlots * 0.5).toFixed(0)}h`, 10) / 2,
        y: chartCy - 4, size: 10, font: fontBold, color: BLACK,
      });

      // Legend
      let legendY = pm.y - 5;
      const legendX = M + 110;
      for (const [name, count] of Object.entries(balanceCounts)) {
        const pct = totalSlots > 0 ? ((count / totalSlots) * 100).toFixed(0) : "0";
        const ac = AREA_COLORS[name];
        if (ac) {
          pm.drawRect(legendX, legendY - 2, 8, 8, hexToRgb(ac.hex));
          pm.page.drawText(`${name}`, { x: legendX + 12, y: legendY, size: 8, font: fontBold, color: ac.text });
          pm.page.drawText(`${(count * 0.5).toFixed(1)}h · ${pct}%`, { x: legendX + 12, y: legendY - 11, size: 7.5, font, color: GRAY });
          legendY -= 26;
        }
      }

      // Reference note
      pm.page.drawText("Ref: Autocuidado ~46% · Productividad ~33% · Ocio ~20%", {
        x: M, y: pm.y - 90, size: 6.5, font, color: GRAY,
      });
    }

    // Goals summary (right column)
    if (goals.length > 0) {
      const rightX = M + CW * 0.55;
      pm.page.drawText("OBJETIVOS", { x: rightX, y: pm.y, size: 7.5, font: fontBold, color: GRAY });
      pm.page.drawText(`${goals.length} definidos`, { x: rightX, y: pm.y - 14, size: 14, font: fontBold, color: BLACK });

      let statY = pm.y - 32;
      const inProgress = goals.filter(g => g.status === "En curso").length;
      const achieved = goals.filter(g => g.status === "Conseguido").length;
      const abandoned = goals.filter(g => g.status === "Abandonado").length;

      if (inProgress > 0) {
        pm.drawRect(rightX, statY - 2, 6, 6, AMBER);
        pm.page.drawText(`${inProgress} en curso`, { x: rightX + 10, y: statY, size: 8.5, font, color: AMBER });
        statY -= 14;
      }
      if (achieved > 0) {
        pm.drawRect(rightX, statY - 2, 6, 6, GREEN_D);
        pm.page.drawText(`${achieved} conseguido${achieved > 1 ? "s" : ""}`, { x: rightX + 10, y: statY, size: 8.5, font, color: GREEN_D });
        statY -= 14;
      }
      if (abandoned > 0) {
        pm.drawRect(rightX, statY - 2, 6, 6, GRAY);
        pm.page.drawText(`${abandoned} abandonado${abandoned > 1 ? "s" : ""}`, { x: rightX + 10, y: statY, size: 8.5, font, color: GRAY });
      }
    }

    pm.y -= 105;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETAILED SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Datos generales ──
  pm.sectionTitle("Datos generales");
  pm.field("Documentos que adjunta", d.documentsAttached);
  pm.field("Recurso que deriva", d.referralResource);
  pm.field("Motivo de intervención", d.interventionReason);

  // ── Área social-familiar ──
  pm.sectionTitle("Área social-familiar");
  pm.field("Carné de conducir", d.drivingLicense);
  pm.field("¿Conduce actualmente?", d.currentlyDrives === true ? "Sí" : d.currentlyDrives === false ? "No" : null);
  pm.field("Motivo si no conduce", d.drivingReason);
  pm.field("Estado civil", d.maritalStatus);
  pm.field("Pareja", d.partnerInfo);
  pm.field("Convivencia actual", d.livingSituation);

  const family = safeJson<{ name?: string; relationship?: string; occupation?: string; notes?: string }>(d.familyComposition);
  if (family.length > 0) {
    pm.field("Composición familiar", family.map(f => [f.name, f.relationship, f.occupation, f.notes].filter(Boolean).join(" — ")).join("\n"));
  }
  pm.field("Red de apoyo / amistades", d.supportNetwork);
  pm.field("Con quién tiene mejor relación", d.bestRelationship);
  pm.field("Con quién tiene peor relación", d.worstRelationship);

  // ── Área laboral y económica ──
  pm.sectionTitle("Área laboral y económica");
  pm.field("Estudios realizados", d.educationLevel);
  pm.field("Otros estudios", d.otherEducation);
  const work = safeJson<{ company?: string; role?: string; year?: string; notes?: string }>(d.workHistory);
  if (work.length > 0) {
    pm.field("Trabajos realizados", work.map(w => [w.company, w.role, w.year, w.notes].filter(Boolean).join(" — ")).join("\n"));
  }
  pm.field("Situación laboral actual", d.currentWorkSituation);
  pm.field("Ocupación actual", d.currentOccupation);
  pm.field("Ingresos aproximados", d.approximateIncome);
  pm.field("Quién gestiona el dinero", d.moneyManager);
  pm.field("Organización de ingresos", d.incomeOrganization);

  // ── Hábitos y rutinas ──
  pm.sectionTitle("Hábitos y rutinas");
  pm.field("Rutina de un día", d.dailyRoutine);

  // OTPF detailed chart
  if (routineCells.length > 0) {
    const OTPF_CATS = ["AVD", "AIVD", "Gestión de la Salud", "Descanso y Sueño", "Educación", "Trabajo", "Juego", "Ocio / Tiempo Libre", "Participación Social"];
    const OTPF_COLORS: Record<string, string> = {
      "AVD": "#f6c5a0", "AIVD": "#f6e4a0", "Gestión de la Salud": "#b8e0b8",
      "Descanso y Sueño": "#b8d0f0", "Educación": "#d4b8f0", "Trabajo": "#f0b8b8",
      "Juego": "#f0d4b8", "Ocio / Tiempo Libre": "#b8f0e4", "Participación Social": "#f0b8d4",
    };
    const otpfCounts: Record<string, number> = {};
    for (const cat of OTPF_CATS) otpfCounts[cat] = 0;
    for (const c of routineCells) {
      if (c.category && c.category in otpfCounts) otpfCounts[c.category as string]++;
    }
    const otpfTotal = Object.values(otpfCounts).reduce((s, n) => s + n, 0);

    if (otpfTotal > 0) {
      pm.ensureSpace(120);
      pm.skip(8);
      pm.page.drawText("DISTRIBUCIÓN POR ÁREAS OTPF", { x: M, y: pm.y, size: 7.5, font: fontBold, color: GRAY });
      pm.y -= 16;

      const chartCx = M + 55;
      const chartCy = pm.y - 38;
      const otpfSlices = OTPF_CATS.map(cat => ({
        pct: otpfTotal > 0 ? (otpfCounts[cat] / otpfTotal) * 100 : 0,
        color: hexToRgb(OTPF_COLORS[cat] ?? "#ccc"),
      })).filter(s => s.pct > 0);
      drawDonut(pm.page, chartCx, chartCy, 35, 18, otpfSlices);

      // Legend table
      let legY = pm.y;
      const legX = M + 110;
      for (const cat of OTPF_CATS) {
        if (otpfCounts[cat] === 0) continue;
        const pct = ((otpfCounts[cat] / otpfTotal) * 100).toFixed(0);
        pm.drawRect(legX, legY - 2, 6, 6, hexToRgb(OTPF_COLORS[cat]));
        pm.page.drawText(cat, { x: legX + 10, y: legY, size: 7.5, font, color: BLACK });
        pm.page.drawText(`${(otpfCounts[cat] * 0.5).toFixed(1)}h (${pct}%)`, { x: legX + CW * 0.35, y: legY, size: 7.5, font, color: GRAY });
        legY -= 11;
      }
      pm.y = Math.min(pm.y - 85, legY - 8);
    }
  }

  // ── Actividades realizadas y deseadas ──
  pm.sectionTitle("Actividades realizadas y deseadas");

  const actFields = [
    { past: d.activitiesPastSelfcare, desired: d.activitiesDesiredSelfcare, area: "Cuidado de sí mismo" },
    { past: d.activitiesPastProductivity, desired: d.activitiesDesiredProductivity, area: "Productividad" },
    { past: d.activitiesPastLeisure, desired: d.activitiesDesiredLeisure, area: "Ocio" },
  ];

  // Column headers
  pm.ensureSpace(40);
  pm.page.drawText("REALIZABA", { x: M, y: pm.y, size: 7.5, font: fontBold, color: GRAY });
  pm.page.drawText("LE GUSTARÍA RETOMAR", { x: M + CW * 0.52, y: pm.y, size: 7.5, font: fontBold, color: GRAY });
  pm.y -= 14;

  for (const act of actFields) {
    const ac = AREA_COLORS[act.area];
    if (!ac) continue;
    const pastText = stripHtml(act.past) || "—";
    const desText = stripHtml(act.desired) || "—";
    const colW = CW * 0.46;

    pm.ensureSpace(40);

    // Area tag
    pm.drawRect(M, pm.y - 1, colW, 12, ac.bg);
    pm.page.drawText(act.area, { x: M + 4, y: pm.y + 2, size: 7.5, font: fontBold, color: ac.text });
    pm.drawRect(M + CW * 0.52, pm.y - 1, colW, 12, ac.bg);
    pm.page.drawText(act.area, { x: M + CW * 0.52 + 4, y: pm.y + 2, size: 7.5, font: fontBold, color: ac.text });
    pm.y -= 16;

    // Content
    const pastLines = wrapText(pastText, font, 8.5, colW - 8);
    const desLines = wrapText(desText, font, 8.5, colW - 8);
    const maxLines = Math.max(pastLines.length, desLines.length);
    
    pm.ensureSpace(maxLines * 11 + 8);
    let lineY = pm.y;
    for (const line of pastLines) {
      pm.page.drawText(line, { x: M + 4, y: lineY, size: 8.5, font, color: BLACK });
      lineY -= 11;
    }
    lineY = pm.y;
    for (const line of desLines) {
      pm.page.drawText(line, { x: M + CW * 0.52 + 4, y: lineY, size: 8.5, font, color: BLACK });
      lineY -= 11;
    }
    pm.y -= maxLines * 11 + 8;
  }

  // ── Problemas detectados ──
  const problemsU = stripHtml(d.problemsUser);
  const problemsP = stripHtml(d.problemsProfessional);

  if (problemsU || problemsP) {
    pm.sectionTitle("Problemas detectados", AMBER);

    if (problemsU) {
      const lines = wrapText(problemsU, font, 8.5, CW - 24);
      pm.ensureSpace(20 + lines.length * 11);
      const boxH = 18 + lines.length * 11;
      pm.page.drawLine({ start: { x: M, y: pm.y + 4 }, end: { x: M + CW, y: pm.y + 4 }, thickness: 2.5, color: AMBER });
      pm.drawRect(M, pm.y - boxH + 4, CW, boxH, AMBER_L);
      pm.page.drawText("PROBLEMAS DETECTADOS POR EL/LA USUARIO/A", { x: M + 10, y: pm.y - 6, size: 7, font: fontBold, color: AMBER });
      let ly = pm.y - 18;
      for (const line of lines) {
        pm.page.drawText(line, { x: M + 10, y: ly, size: 8.5, font, color: BLACK });
        ly -= 11;
      }
      pm.y -= boxH + 8;
    }

    if (problemsP) {
      const lines = wrapText(problemsP, font, 8.5, CW - 24);
      pm.ensureSpace(20 + lines.length * 11);
      const boxH = 18 + lines.length * 11;
      pm.page.drawLine({ start: { x: M, y: pm.y + 4 }, end: { x: M + CW, y: pm.y + 4 }, thickness: 2.5, color: TEAL });
      pm.drawRect(M, pm.y - boxH + 4, CW, boxH, TEAL_L);
      pm.page.drawText("PROBLEMAS DETECTADOS POR EL/LA PROFESIONAL", { x: M + 10, y: pm.y - 6, size: 7, font: fontBold, color: TEAL });
      let ly = pm.y - 18;
      for (const line of lines) {
        pm.page.drawText(line, { x: M + 10, y: ly, size: 8.5, font, color: BLACK });
        ly -= 11;
      }
      pm.y -= boxH + 8;
    }
  }

  // ── Objetivos y planificación ──
  if (goals.length > 0) {
    pm.sectionTitle("Objetivos y planificación");

    const desiredImprovements = stripHtml(d.desiredImprovements);
    if (desiredImprovements) pm.field("Qué le gustaría conseguir o mejorar", desiredImprovements);

    for (const goal of goals) {
      const ac = AREA_COLORS[goal.area as string] ?? AREA_COLORS["Cuidado de sí mismo"];
      const sc = STATUS_COLORS[goal.status as string] ?? STATUS_COLORS["En curso"];
      const goalText = goal.text || "—";
      const goalLines = wrapText(goalText, font, 9, CW - 30);
      const hasEval = goal.evaluation?.trim();
      const evalLines = hasEval ? wrapText(goal.evaluation, font, 8, CW - 30) : [];
      const cardH = 16 + goalLines.length * 12 + 18 + (hasEval ? 12 + evalLines.length * 10 : 0) + 8;

      pm.ensureSpace(cardH + 10);

      // Left color border
      pm.drawRect(M, pm.y - cardH + 2, 4, cardH, ac.text);
      // Card bg
      pm.drawRect(M + 4, pm.y - cardH + 2, CW - 4, cardH, rgb(0.99, 0.99, 0.99));
      // Border
      pm.page.drawRectangle({ x: M, y: pm.y - cardH + 2, width: CW, height: cardH, borderColor: BORDER, borderWidth: 0.5 });

      let cardY = pm.y - 8;
      // Goal text
      for (const line of goalLines) {
        pm.page.drawText(line, { x: M + 14, y: cardY, size: 9, font, color: BLACK });
        cardY -= 12;
      }
      cardY -= 2;

      // Area badge
      const areaW = fontBold.widthOfTextAtSize(goal.area, 7) + 12;
      pm.drawRect(M + 14, cardY - 2, areaW, 12, ac.bg);
      pm.page.drawText(goal.area, { x: M + 20, y: cardY + 1, size: 7, font: fontBold, color: ac.text });

      // Status badge
      const statusW = fontBold.widthOfTextAtSize(goal.status, 7) + 12;
      pm.drawRect(M + 14 + areaW + 6, cardY - 2, statusW, 12, sc.bg);
      pm.page.drawText(goal.status, { x: M + 20 + areaW + 6, y: cardY + 1, size: 7, font: fontBold, color: sc.text });

      // Dates
      const dateStr = `Inicio: ${fmtDate(goal.startDate)} → Objetivo: ${fmtDate(goal.targetDate)}`;
      pm.page.drawText(dateStr, { x: M + 14 + areaW + statusW + 16, y: cardY + 1, size: 7, font, color: GRAY });
      cardY -= 16;

      // Evaluation
      if (hasEval) {
        pm.page.drawText("EVALUACIÓN", { x: M + 14, y: cardY, size: 6.5, font: fontBold, color: GRAY });
        cardY -= 10;
        for (const line of evalLines) {
          pm.page.drawText(line, { x: M + 14, y: cardY, size: 8, font, color: GRAY });
          cardY -= 10;
        }
      }

      pm.y -= cardH + 6;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════════════════

  pm.ensureSpace(80);
  pm.skip(30);
  pm.page.drawLine({ start: { x: M, y: pm.y + 6 }, end: { x: M + CW, y: pm.y + 6 }, thickness: 0.5, color: BORDER });
  pm.page.drawText(`Profesional: ${prof.name} (${prof.role})`, { x: M, y: pm.y - 6, size: 8, font, color: GRAY });
  pm.page.drawText(`Fecha: ${today}`, { x: M + CW - font.widthOfTextAtSize(`Fecha: ${today}`, 8), y: pm.y - 6, size: 8, font, color: GRAY });
  pm.skip(40);
  pm.page.drawText("Firma:", { x: M, y: pm.y, size: 8, font, color: GRAY });
  pm.skip(30);
  pm.page.drawLine({ start: { x: M, y: pm.y }, end: { x: M + 180, y: pm.y }, thickness: 0.5, color: BORDER });

  // ═══════════════════════════════════════════════════════════════════════════

  const pdfBytes = await pdfDoc.save();
  await audit(prof.id, "occupational_profile.report", "OccupationalProfile", id);

  const fileName = `Perfil_ocupacional_${patient.firstName}_${patient.lastName}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]+/g, "_");

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
    },
  });
}
