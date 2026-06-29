// GET /api/patients/[id]/report?format=word|pdf&sections=summary,visits,assessments
// Generates the "full patient record" report — distinct from the
// dedicated occupational-profile report — covering whichever sections
// the person checked in the dialog. Always signed by whoever is
// currently logged in and generating it (never a stored/chosen signer).

import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  TabStopType,
  TabStopPosition,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireProfessional, audit } from "@/lib/server";
import { gatherPatientReportData, parseSections, type PatientReportData } from "@/lib/patient-report-data";

type Ctx = { params: Promise<{ id: string }> };

const BRAND_COLOR = "1A5C58"; // matches the occupational-profile report
const BRAND_RGB = rgb(0x1a / 255, 0x5c / 255, 0x58 / 255);
const GRAY_RGB = rgb(0x70 / 255, 0x70 / 255, 0x70 / 255);
const BORDER_RGB = rgb(0xd9 / 255, 0xd9 / 255, 0xd9 / 255);

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "word";
  const sections = parseSections(url.searchParams.get("sections"));
  const audienceParam = url.searchParams.get("audience");

  const data = await gatherPatientReportData(id, sections, audienceParam);
  if (!data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await audit(prof.id, "patient.report", "Patient", id, { format, sections, audience: data.audience });

  const today = fmtDate(new Date());
  const safeName = data.patient.fullName.replace(/[^\p{L}\p{N}]+/gu, "_");

  if (format === "pdf") {
    const bytes = await buildPdf(data, sections, prof, today);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Informe_${safeName}.pdf"`,
      },
    });
  }

  const buffer = await buildWord(data, sections, prof, today);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Informe_${safeName}.docx"`,
    },
  });
}

// ─── Word (.docx) ────────────────────────────────────────────────────────────

async function buildWord(
  data: PatientReportData,
  sections: ReturnType<typeof parseSections>,
  prof: { name: string; role: string },
  today: string,
) {
  const PAGE_WIDTH = 12240;
  const MARGIN = 1440;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Informe clínico", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [new TextRun({ text: "DomusGes · Seguimiento de pacientes", size: 18, color: "707070" })],
    }),
  ];

  if (sections.includes("summary")) {
    blocks.push(sectionHeading(data.audience === "family" ? "Resumen" : "Resumen del paciente"));
    const p = data.patient;
    const isFamily = data.audience === "family";
    const lines = [
      `Nombre: ${p.fullName} (${p.age} años)`,
      isFamily ? null : `Especialidad: ${p.specialty} · Estado: ${p.status}`,
      p.diagnosis ? `${isFamily ? "Motivo de seguimiento" : "Diagnóstico"}: ${p.diagnosis}` : null,
      p.objective ? `Objetivo terapéutico: ${p.objective}` : null,
      !isFamily && p.alerts.length > 0 ? `Alertas clínicas: ${p.alerts.join(", ")}` : null,
      p.phone ? `Teléfono: ${p.phone}` : null,
      p.address ? `Dirección: ${p.address}` : null,
      `Inicio de seguimiento: ${fmtDate(p.startDate)}`,
      p.therapistNames.length > 0 ? `Terapeutas: ${p.therapistNames.join(", ")}` : null,
    ].filter((l): l is string => !!l);
    blocks.push(
      ...lines.map(
        (line) =>
          new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: line, size: 21 })] }),
      ),
    );
  }

  if (sections.includes("visits")) {
    const isFamily = data.audience === "family";
    blocks.push(sectionHeading("Historial de seguimientos"));
    if (data.visits.length === 0) {
      blocks.push(emptyNote("Sin seguimientos registrados."));
    } else if (isFamily) {
      blocks.push(
        ...data.visits.flatMap((v) => [
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({ text: `${fmtDate(v.date)} — ${v.title || "Seguimiento"}`, bold: true, size: 21 }),
            ],
          }),
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun({ text: v.notes || "—", size: 20 })],
          }),
        ]),
      );
    } else {
      blocks.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          borders: tableBorders(),
          rows: [
            headerRow(["Fecha", "Título", "Terapeuta", "Duración", "Notas"], [0.13, 0.2, 0.17, 0.1, 0.4], CONTENT_WIDTH),
            ...data.visits.map((v) =>
              dataRow(
                [
                  fmtDate(v.date),
                  v.title || "Seguimiento",
                  v.therapistName,
                  `${v.durationMin} min`,
                  v.notes || "—",
                ],
                [0.13, 0.2, 0.17, 0.1, 0.4],
                CONTENT_WIDTH,
              ),
            ),
          ],
        }),
        new Paragraph({ spacing: { after: 160 } }),
      );
    }
  }

  if (sections.includes("assessments")) {
    const isFamily = data.audience === "family";
    blocks.push(sectionHeading(isFamily ? "Progreso observado" : "Evaluaciones y escalas"));
    if (data.assessments.length === 0) {
      blocks.push(emptyNote(isFamily ? "Sin valoraciones registradas." : "Sin evaluaciones registradas."));
    } else if (isFamily) {
      blocks.push(
        ...data.assessments.map(
          (a) =>
            new Paragraph({
              spacing: { after: 140 },
              children: [new TextRun({ text: `${fmtDate(a.date)} — ${a.interpretation}`, size: 21 })],
            }),
        ),
      );
    } else {
      blocks.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          borders: tableBorders(),
          rows: [
            headerRow(["Fecha", "Escala", "Puntuación", "Terapeuta"], [0.16, 0.28, 0.28, 0.28], CONTENT_WIDTH),
            ...data.assessments.map((a) =>
              dataRow([fmtDate(a.date), a.scale, a.score, a.therapistName], [0.16, 0.28, 0.28, 0.28], CONTENT_WIDTH),
            ),
          ],
        }),
        new Paragraph({ spacing: { after: 160 } }),
      );
    }
  }

  blocks.push(
    new Paragraph({ spacing: { before: 400 } }),
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9", space: 6 } },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      spacing: { before: 240 },
      children: [
        new TextRun({ text: `Profesional: ${prof.name} (${prof.role})`, size: 19 }),
        new TextRun({ text: `\tFecha del informe: ${today}`, size: 19 }),
      ],
    }),
    new Paragraph({ spacing: { before: 480 }, children: [new TextRun({ text: "Firma:", size: 19 })] }),
    new Paragraph({
      spacing: { before: 600 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9", space: 1 } },
      children: [new TextRun({ text: "" })],
    }),
  );

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          run: { size: 30, bold: true, font: "Arial", color: "1A1A1A" },
          paragraph: { spacing: { before: 0, after: 120 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { size: 23, bold: true, font: "Arial", color: BRAND_COLOR },
          paragraph: { spacing: { before: 320, after: 160 } },
        },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
        children: blocks,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_COLOR, space: 1 } },
    children: [new TextRun({ text: title, bold: true, color: BRAND_COLOR })],
  });
}

function emptyNote(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, italics: true, color: "808080", size: 19 })],
  });
}

function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 2, color: "D9D9D9" },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: "D9D9D9" },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "D9D9D9" },
    insideVertical: { style: BorderStyle.NONE },
  } as const;
}

function headerRow(labels: string[], widths: number[], contentWidth: number): TableRow {
  return new TableRow({
    children: labels.map(
      (label, i) =>
        new TableCell({
          width: { size: contentWidth * widths[i], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 17, color: "707070" })] })],
        }),
    ),
  });
}

function dataRow(values: string[], widths: number[], contentWidth: number): TableRow {
  return new TableRow({
    children: values.map(
      (value, i) =>
        new TableCell({
          width: { size: contentWidth * widths[i], type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: value, size: 19 })] })],
        }),
    ),
  });
}

// ─── PDF (pdf-lib) ───────────────────────────────────────────────────────────
//
// pdf-lib has no automatic text wrapping or flow layout — every line and
// page break is placed by hand. To keep this manageable, long text fields
// (notes) are wrapped to a fixed character width and the cursor moves to
// a new page whenever it runs out of vertical space.

const PAGE_W = 595.28; // A4, points
const PAGE_H = 841.89;
const MARGIN_PT = 56;
const CONTENT_W = PAGE_W - MARGIN_PT * 2;

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

async function buildPdf(
  data: PatientReportData,
  sections: ReturnType<typeof parseSections>,
  prof: { name: string; role: string },
  today: string,
) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_PT;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN_PT) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN_PT;
    }
  }

  function text(str: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const size = opts.size ?? 10.5;
    ensureSpace(size + (opts.gap ?? 4));
    page.drawText(str, {
      x: MARGIN_PT,
      y,
      size,
      font: opts.bold ? fontBold : font,
      color: opts.color ?? rgb(0, 0, 0),
    });
    y -= size + (opts.gap ?? 4);
  }

  function heading(title: string) {
    y -= 8;
    ensureSpace(24);
    text(title, { size: 14, bold: true, color: BRAND_RGB, gap: 2 });
    page.drawLine({
      start: { x: MARGIN_PT, y: y + 4 },
      end: { x: MARGIN_PT + CONTENT_W, y: y + 4 },
      thickness: 1,
      color: BRAND_RGB,
    });
    y -= 10;
  }

  function paragraph(str: string, maxChars = 95) {
    for (const line of wrapText(str, maxChars)) {
      text(line, { size: 10 });
    }
  }

  // Header
  page.drawText("Informe clínico", { x: MARGIN_PT, y, size: 20, font: fontBold });
  y -= 26;
  page.drawText("DomusGes · Seguimiento de pacientes", { x: MARGIN_PT, y, size: 10, font, color: GRAY_RGB });
  y -= 28;

  const isFamily = data.audience === "family";

  if (sections.includes("summary")) {
    heading(isFamily ? "Resumen" : "Resumen del paciente");
    const p = data.patient;
    paragraph(`Nombre: ${p.fullName} (${p.age} años)`);
    if (!isFamily) paragraph(`Especialidad: ${p.specialty} · Estado: ${p.status}`);
    if (p.diagnosis) paragraph(`${isFamily ? "Motivo de seguimiento" : "Diagnóstico"}: ${p.diagnosis}`);
    if (p.objective) paragraph(`Objetivo terapéutico: ${p.objective}`);
    if (!isFamily && p.alerts.length > 0) paragraph(`Alertas clínicas: ${p.alerts.join(", ")}`);
    if (p.phone) paragraph(`Teléfono: ${p.phone}`);
    if (p.address) paragraph(`Dirección: ${p.address}`);
    paragraph(`Inicio de seguimiento: ${fmtDate(p.startDate)}`);
    if (p.therapistNames.length > 0) paragraph(`Terapeutas: ${p.therapistNames.join(", ")}`);
  }

  if (sections.includes("visits")) {
    heading("Historial de seguimientos");
    if (data.visits.length === 0) {
      text("Sin seguimientos registrados.", { size: 10, color: GRAY_RGB });
    } else {
      for (const v of data.visits) {
        ensureSpace(40);
        text(`${fmtDate(v.date)} — ${v.title || "Seguimiento"}`, { size: 11, bold: true, gap: 2 });
        if (!isFamily) text(`${v.therapistName} · ${v.durationMin} min`, { size: 9.5, color: GRAY_RGB, gap: 3 });
        if (v.notes) paragraph(v.notes, 100);
        y -= 6;
      }
    }
  }

  if (sections.includes("assessments")) {
    heading(isFamily ? "Progreso observado" : "Evaluaciones y escalas");
    if (data.assessments.length === 0) {
      text(isFamily ? "Sin valoraciones registradas." : "Sin evaluaciones registradas.", { size: 10, color: GRAY_RGB });
    } else if (isFamily) {
      for (const a of data.assessments) {
        ensureSpace(24);
        paragraph(`${fmtDate(a.date)} — ${a.interpretation}`, 100);
        y -= 4;
      }
    } else {
      for (const a of data.assessments) {
        ensureSpace(28);
        text(`${fmtDate(a.date)} — ${a.scale}: ${a.score}`, { size: 11, bold: true, gap: 2 });
        text(a.therapistName, { size: 9.5, color: GRAY_RGB, gap: 3 });
        if (a.notes) paragraph(a.notes, 100);
        y -= 4;
      }
    }
  }

  // Footer / signature
  ensureSpace(90);
  y -= 10;
  page.drawLine({
    start: { x: MARGIN_PT, y: y + 4 },
    end: { x: MARGIN_PT + CONTENT_W, y: y + 4 },
    thickness: 0.5,
    color: BORDER_RGB,
  });
  y -= 16;
  text(`Profesional: ${prof.name} (${prof.role})`, { size: 10 });
  text(`Fecha del informe: ${today}`, { size: 10, gap: 24 });
  text("Firma:", { size: 10, gap: 30 });
  page.drawLine({
    start: { x: MARGIN_PT, y },
    end: { x: MARGIN_PT + 220, y },
    thickness: 0.5,
    color: BORDER_RGB,
  });

  return pdfDoc.save();
}
