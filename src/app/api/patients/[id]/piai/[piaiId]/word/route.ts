// GET /api/patients/[id]/piai/[piaiId]/word
// Descarga el PIAI en Word (.docx) siguiendo la estructura de la plantilla
// en papel del centro: 1. Información general (datos generales,
// características y objetivos generales), apartados de cada profesional
// (1.3 Trabajo social … 1.9 Cuidados), aceptación y 2. Revisión PIA.

import { NextRequest, NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,
  Table, TableRow, TableCell, WidthType,
} from "docx";
import { db } from "@/lib/db";
import { requireProfessional, canViewClinical, audit } from "@/lib/server";
import { htmlToPlainText } from "@/lib/patient-report-data";
import { PIAI_GENERAL_FIELDS, PIAI_SECTIONS, type PiaiSectionContent } from "@/lib/piai";
import { mapPiai, PIAI_INCLUDE, errorResponse } from "../../shared";

type Ctx = { params: Promise<{ id: string; piaiId: string }> };

const BRAND = "1A5C58";
const PAGE_WIDTH = 11906; // A4
const MARGIN = 1134; // 2 cm
const CONTENT = PAGE_WIDTH - MARGIN * 2;

function fmt(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND, space: 2 } },
    children: [new TextRun({ text, bold: true, color: BRAND, size: 26 })],
  });
}
function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, color: BRAND, size: 22 })],
  });
}
function label(text: string) {
  return new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text, bold: true, size: 20 })] });
}
// Texto con saltos de línea → un párrafo por línea.
function body(text: string | null | undefined, empty = "—") {
  const t = (text ?? "").trim();
  const lines = t ? t.split("\n") : [empty];
  return lines.map((line) => new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: line, size: 20, color: t ? undefined : "808080", italics: !t })],
  }));
}
function kv(pairs: [string, string | null | undefined][]) {
  const w = Math.floor(CONTENT / 2);
  const rows: TableRow[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    rows.push(new TableRow({
      children: [pairs[i], pairs[i + 1]].map((p) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({
          children: p
            ? [new TextRun({ text: `${p[0]}: `, bold: true, size: 19 }), new TextRun({ text: p[1] || "", size: 19 })]
            : [new TextRun({ text: "" })],
        })],
      })),
    }));
  }
  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "D9D9D9" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "D9D9D9" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "D9D9D9" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
    rows,
  });
}
function objectivesList(items: string[], actions?: string[][]) {
  const out: Paragraph[] = [];
  const filled = items.map((t, i) => ({ t: t.trim(), i })).filter((x) => x.t);
  if (filled.length === 0) return body("", "Sin objetivos.");
  filled.forEach((x, n) => {
    out.push(new Paragraph({ spacing: { before: 60, after: 20 }, children: [
      new TextRun({ text: `Objetivo ${n + 1}: `, bold: true, size: 20 }),
      new TextRun({ text: x.t, size: 20 }),
    ] }));
    for (const [k, a] of (actions?.[x.i] ?? []).filter((s) => s.trim()).entries()) {
      out.push(new Paragraph({ indent: { left: 400 }, spacing: { after: 20 }, children: [new TextRun({ text: `Acción ${k + 1}: ${a}`, size: 19 })] }));
    }
  });
  return out;
}
function sessions(c: { individualSession?: string; groupSession?: string }) {
  return new Paragraph({ spacing: { before: 100, after: 100 }, children: [
    new TextRun({ text: "Sesión individual: ", bold: true, size: 19 }), new TextRun({ text: `${c.individualSession ?? ""}      `, size: 19 }),
    new TextRun({ text: "Sesión grupal: ", bold: true, size: 19 }), new TextRun({ text: c.groupSession ?? "", size: 19 }),
  ] });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId, piaiId } = await params;
    if (!(await canViewClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const [row, patient, profile] = await Promise.all([
      db.piai.findFirst({ where: { id: piaiId, patientId }, include: PIAI_INCLUDE }),
      db.patient.findUnique({ where: { id: patientId }, select: { firstName: true, lastName: true, diagnosis: true, referent: true, careTeamReferent: true } }),
      db.occupationalProfile.findUnique({ where: { patientId }, include: { goals: { orderBy: { createdAt: "asc" } } } }),
    ]);
    if (!row || !patient) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const piai = await mapPiai(row);
    const fullName = `${patient.firstName} ${patient.lastName}`;
    const g = piai.general;

    const blocks: (Paragraph | Table)[] = [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [
        new TextRun({ text: "Plan de Atención Individualizada (PIA)", bold: true, size: 32, color: BRAND }),
      ] }),
      h1("1. INFORMACIÓN GENERAL"),
      h2("1.1 Datos generales"),
      kv([
        ["Fecha del PIA", fmt(piai.date)],
        ["Fecha reunión PPUU/equipo técnico", fmt(g.meetingDate)],
        ["Nombre de usuario/a", fullName],
        ["Estado del PIA", piai.status],
        ["Fecha de alta", fmt(g.admissionDate)],
        ["Fecha de baja", fmt(g.dischargeDate)],
        ["Grado y nivel de dependencia", g.dependencyGrade],
        ["Grado de discapacidad", g.disabilityGrade],
        ["Diagnóstico", patient.diagnosis ?? ""],
        ["Referente técnico/a", patient.referent ?? ""],
        ["Referente de cuidados", patient.careTeamReferent ?? ""],
        ...PIAI_GENERAL_FIELDS
          .filter((f) => ["service", "benefits", "publicFunding", "objectivesSheetDelivered"].includes(f.key))
          .map((f) => [f.label, g[f.key]] as [string, string | undefined]),
      ]),
      h2("1.2 Características de la persona"),
      label("Breve descripción"),
      ...body(htmlToPlainText(g.description)),
      label("Objetivos generales"),
      ...objectivesList(piai.generalObjectives.map((o) => o.text), piai.generalObjectives.map((o) => o.actions)),
    ];

    PIAI_SECTIONS.forEach((def, idx) => {
      const c: PiaiSectionContent = piai.sections[def.key]?.content ?? {};
      blocks.push(h2(`1.${idx + 3} ${def.title.toUpperCase()}`));
      blocks.push(kv([["Responsable", c.responsible], ["Valoración realizada por", c.assessedBy]]));
      for (const e of def.extras) {
        if (c.extras?.[e.key]) blocks.push(label(e.label), ...body(c.extras[e.key]));
      }
      blocks.push(label(def.assessmentLabel), ...body(htmlToPlainText(c.assessment)));
      blocks.push(label("Objetivos"));
      if (def.objectivesFromPlan) {
        // Terapia ocupacional: objetivos del Plan de intervención (con metas).
        const goals = (profile?.goals ?? []).filter((x: { status: string }) => x.status !== "Abandonado");
        const metas = goals.map((x: { specificGoals: string }) => {
          try { const v = JSON.parse(x.specificGoals || "[]"); return Array.isArray(v) ? v.map((m: { text?: string }) => m.text ?? "") : []; } catch { return []; }
        });
        blocks.push(...objectivesList(goals.map((x: { text: string }) => x.text), metas));
      } else {
        blocks.push(...objectivesList(c.objectives ?? []));
      }
      blocks.push(label(`Comentarios ${def.title.toLowerCase()}`), ...body(c.comments));
      blocks.push(sessions(c));
      if (def.hasLeisure) {
        const l = c.leisure ?? {};
        blocks.push(h2("Atención al ocio y tiempo libre"));
        blocks.push(label("Valoración ocio y tiempo libre"), ...body(htmlToPlainText(l.assessment)));
        blocks.push(label("Objetivos"), ...objectivesList(l.objectives ?? []));
        blocks.push(label("Comentarios ocio y tiempo libre"), ...body(l.comments));
        blocks.push(sessions(l));
      }
    });

    blocks.push(label("Fecha y aceptación de la persona usuaria"), ...body([fmt(g.acceptanceDate), g.acceptanceNotes].filter(Boolean).join(" — ")));

    blocks.push(h1("2. REVISIÓN DE OBJETIVOS"));
    if (piai.reviews.length === 0) blocks.push(...body("", "Sin revisiones."));
    for (const r of [...piai.reviews].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))) {
      blocks.push(h2(`Revisión del ${fmt(r.date)}`));
      if (r.meetingDate) blocks.push(new Paragraph({ spacing: { after: 60 }, children: [
        new TextRun({ text: "Fecha reunión PPUU/equipo técnico: ", bold: true, size: 19 }), new TextRun({ text: fmt(r.meetingDate), size: 19 }),
      ] }));
      r.items.forEach((it, i) => {
        blocks.push(new Paragraph({ spacing: { before: 60, after: 20 }, children: [
          new TextRun({ text: `Objetivo ${i + 1}: `, bold: true, size: 20 }),
          new TextRun({ text: it.text, size: 20 }),
          new TextRun({ text: `   →  ${it.result || "Sin marcar"}`, bold: true, size: 20,
            color: it.result === "Conseguido" ? "15803D" : it.result === "No conseguido" ? "B91C1C" : it.result ? "B45309" : "808080" }),
        ] }));
        if (it.comment) blocks.push(new Paragraph({ indent: { left: 400 }, children: [new TextRun({ text: it.comment, size: 19, color: "505050" })] }));
      });
      if (r.comments) blocks.push(label("Comentarios"), ...body(r.comments));
    }

    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
      sections: [{ properties: { page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } }, children: blocks }],
    });
    const buffer = await Packer.toBuffer(doc);
    await audit(prof.id, "piai.word", "Piai", piaiId, { patientId });
    const safeName = fullName.replace(/[^\p{L}\p{N}]+/gu, "_");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="PIAI_${safeName}_${piai.date}.docx"`,
      },
    });
  } catch (err) {
    return errorResponse("piai word", err);
  }
}
