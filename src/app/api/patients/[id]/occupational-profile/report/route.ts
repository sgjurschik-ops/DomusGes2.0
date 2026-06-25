// GET /api/patients/[id]/occupational-profile/report
// Generates a Word (.docx) report of a patient's occupational profile:
// header with the patient's basics, body with every filled-in section
// (mirrors the on-screen sections/labels in occupational-profile-tab.tsx),
// and a footer with the signing professional, generation date, and a
// signature line.

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
import { db } from "@/lib/db";
import { requireProfessional, audit } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

const PAGE_WIDTH = 12240; // US Letter, DXA
const PAGE_HEIGHT = 15840;
const MARGIN = 1440; // 1 inch
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 9360

const BRAND_COLOR = "1A5C58"; // matches --primary brand color (#1a5c58)
const BORDER_GRAY = "D9D9D9";
const LABEL_COLOR = "707070";

// A value longer than this renders full-width instead of sharing a row,
// so long answers never get squeezed into a half-width column.
const LONG_VALUE_THRESHOLD = 45;

const NO_BORDERS = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE },
  insideVertical: { style: BorderStyle.NONE },
} as const;

// Each entry: [fieldKey, label]. Grouped the same way as the on-screen
// sections, in the same order, so the report mirrors what the professional
// sees and fills in on screen.
const SECTIONS: { title: string; fields: [string, string][] }[] = [
  {
    title: "Datos generales",
    fields: [
      ["documentsAttached", "Documentos que adjunta"],
      ["referralResource", "Recurso que deriva"],
      ["interventionReason", "Motivo de intervención"],
    ],
  },
  {
    title: "Área social-familiar",
    fields: [
      ["drivingLicense", "Carné de conducir"],
      ["currentlyDrivesText", "¿Conduce actualmente?"],
      ["drivingReason", "Motivo si no conduce o información relevante"],
      ["maritalStatus", "Estado civil"],
      ["partnerInfo", "Nombre y edad / información pareja"],
      ["livingSituation", "Convivencia actual"],
      ["familyComposition", "Composición familiar"],
      ["supportNetwork", "Red de apoyo / amistades"],
      ["bestRelationship", "Con quién tiene mejor relación"],
      ["worstRelationship", "Con quién tiene peor relación"],
    ],
  },
  {
    title: "Área laboral y económica",
    fields: [
      ["educationLevel", "Estudios realizados"],
      ["otherEducation", "Otros estudios, cursos o talleres"],
      ["workHistory", "Trabajos realizados"],
      ["currentWorkSituation", "Situación laboral actual"],
      ["currentOccupation", "Trabajo u ocupación actual"],
      ["approximateIncome", "Ingresos aproximados"],
      ["moneyManager", "Quién gestiona el dinero"],
      ["incomeOrganization", "Organización de ingresos / autonomía económica"],
    ],
  },
  {
    title: "Hábitos y rutinas",
    fields: [
      ["dailyRoutine", "Día normal con horarios aproximados"],
      ["selfCare", "Autocuidado"],
      ["leisure", "Ocio"],
      ["domesticTasks", "Tareas domésticas"],
      ["physicalActivity", "Actividad física"],
      ["responsibilities", "Responsabilidades"],
      ["socialParticipation", "Participación social"],
    ],
  },
  {
    title: "Intereses y motivaciones",
    fields: [
      ["leisureActivitiesCurrent", "Actividades de ocio que realiza actualmente"],
      ["leisureActivitiesPast", "Actividades de ocio que ya no realiza"],
      ["sportsCurrent", "Deportes actuales"],
      ["sportsPast", "Deportes que ya no realiza"],
      ["trainingCurrent", "Cursos o formación actual"],
      ["trainingPast", "Cursos o formación que ya no realiza"],
    ],
  },
  {
    title: "Objetivos y planificación",
    fields: [
      ["desiredImprovements", "Qué le gustaría conseguir o mejorar"],
      ["shortTermGoal1", "Objetivo 1"],
      ["shortTermGoal2", "Objetivo 2"],
      ["shortTermGoal3", "Objetivo 3"],
    ],
  },
];

function calcAge(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

type FieldBlock = {
  value: string;
  fullWidth: boolean;
  paragraphs: Paragraph[];
};

// Form-style field: small uppercase label, value below it, thin rule
// underneath to anchor it — no table borders/shading. Short values (like
// "No" or "Soltero") are far more compact than a 2-column bordered table
// row, so several can share a line.
function fieldBlock(label: string, value: string, forceFullWidth = false): FieldBlock {
  const fullWidth = forceFullWidth || value.length > LONG_VALUE_THRESHOLD;
  const lines = value.split("\n");
  return {
    value,
    fullWidth,
    paragraphs: [
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: label.toUpperCase(), bold: true, size: 15, color: LABEL_COLOR }),
        ],
      }),
      new Paragraph({
        spacing: { after: 160 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY, space: 2 } },
        children: lines.map(
          (line, i) => new TextRun({ text: line, size: 21, break: i > 0 ? 1 : 0 }),
        ),
      }),
    ],
  };
}

// Lays fields out two-per-row when both are short, full-width otherwise —
// so short answers don't waste half a page of blank space next to them.
function layoutFields(fields: FieldBlock[]): Table[] {
  const rows: Table[] = [];
  let i = 0;
  while (i < fields.length) {
    const current = fields[i];
    if (current.fullWidth) {
      rows.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          borders: NO_BORDERS,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                  children: current.paragraphs,
                }),
              ],
            }),
          ],
        }),
      );
      i += 1;
      continue;
    }

    const next = fields[i + 1];
    if (next && !next.fullWidth) {
      rows.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          borders: NO_BORDERS,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: CONTENT_WIDTH / 2, type: WidthType.DXA },
                  margins: { right: 200 },
                  children: current.paragraphs,
                }),
                new TableCell({
                  width: { size: CONTENT_WIDTH / 2, type: WidthType.DXA },
                  children: next.paragraphs,
                }),
              ],
            }),
          ],
        }),
      );
      i += 2;
    } else {
      rows.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          borders: NO_BORDERS,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                  children: current.paragraphs,
                }),
              ],
            }),
          ],
        }),
      );
      i += 1;
    }
  }
  return rows;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const profile = await db.occupationalProfile.findUnique({ where: { patientId: id } });

  const data: Record<string, any> = { ...(profile ?? {}) };
  // Mirror the boolean -> readable text conversion used on screen.
  data.currentlyDrivesText =
    data.currentlyDrives === true ? "Sí" : data.currentlyDrives === false ? "No" : "";

  const today = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const birthDateStr = patient.birthDate.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // ── Header: title only (no logo — app logo not finalized yet) ──────────
  const bodyBlocks: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Perfil ocupacional", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [
        new TextRun({ text: "DomusGes · Seguimiento de pacientes", size: 18, color: "707070" }),
      ],
    }),
  ];

  // ── Patient basics ───────────────────────────────────────────────────────
  bodyBlocks.push(
    ...layoutFields([
      fieldBlock("Usuario/a", `${patient.firstName} ${patient.lastName}`),
      fieldBlock("Fecha de nacimiento", `${birthDateStr} (${calcAge(patient.birthDate)} años)`),
      fieldBlock("Objetivo de tratamiento", patient.objective?.trim() || "No especificado", true),
    ]),
  );

  // ── Body sections ─────────────────────────────────────────────────────
  for (const section of SECTIONS) {
    const blocks = section.fields
      .map(([key, label]) => {
        const raw = data[key];
        const value = typeof raw === "string" ? raw.trim() : raw ? String(raw) : "";
        return value ? fieldBlock(label, value) : null;
      })
      .filter((b): b is FieldBlock => b !== null);

    bodyBlocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 160 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_COLOR, space: 1 },
        },
        children: [new TextRun({ text: section.title, bold: true, color: BRAND_COLOR })],
      }),
    );

    if (blocks.length === 0) {
      bodyBlocks.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: "Sin información registrada en esta sección.",
              italics: true,
              color: "808080",
              size: 19,
            }),
          ],
        }),
      );
    } else {
      bodyBlocks.push(...layoutFields(blocks));
    }
  }

  // ── Footer: professional, date, signature ─────────────────────────────
  bodyBlocks.push(
    new Paragraph({ spacing: { before: 600 } }),
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY, space: 6 } },
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
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY, space: 1 } },
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
          quickFormat: true,
          run: { size: 30, bold: true, font: "Arial", color: "1A1A1A" },
          paragraph: { spacing: { before: 0, after: 120 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 22, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        children: bodyBlocks,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  // NextResponse's body type doesn't accept Node's Buffer directly (it's not
  // part of the standard BodyInit union) — Uint8Array is, and a Buffer is
  // already a Uint8Array view over the same bytes, so this is a zero-copy,
  // lossless conversion, not a workaround.
  const body = new Uint8Array(buffer);

  await audit(prof.id, "occupational_profile.report", "OccupationalProfile", id);

  const fileName = `Perfil_ocupacional_${patient.firstName}_${patient.lastName}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents for a clean ASCII filename
    .replace(/[^a-zA-Z0-9_]+/g, "_");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}.docx"`,
    },
  });
}
