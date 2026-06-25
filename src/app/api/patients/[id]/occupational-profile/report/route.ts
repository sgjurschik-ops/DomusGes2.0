// GET /api/patients/[id]/occupational-profile/report
// Generates a Word (.docx) report of a patient's occupational profile:
// header with patient basics + app logo, body with every filled-in section
// (mirrors the on-screen sections/labels in occupational-profile-tab.tsx),
// and a footer with the signing professional, generation date, and a
// signature line.

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
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

function fieldRow(label: string, value: string) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY };
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2900, type: WidthType.DXA },
        shading: { fill: "F2F5F4", type: ShadingType.CLEAR },
        borders: { top: border, bottom: border, left: border, right: border },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [
          new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 19, color: "404040" })],
          }),
        ],
      }),
      new TableCell({
        width: { size: CONTENT_WIDTH - 2900, type: WidthType.DXA },
        borders: { top: border, bottom: border, left: border, right: border },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: value
          .split("\n")
          .map((line) => new Paragraph({ children: [new TextRun({ text: line, size: 20 })] })),
      }),
    ],
  });
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

  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;

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

  const children: Paragraph[] = [];

  // ── Header: logo + title ──────────────────────────────────────────────
  if (logoBuffer) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            type: "png",
            data: logoBuffer,
            transformation: { width: 56, height: 56 },
            altText: { title: "DomusGes", description: "Logotipo de DomusGes", name: "Logo" },
          }),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Perfil ocupacional", bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({ text: "DomusGes · Seguimiento de pacientes", size: 18, color: "707070" }),
      ],
    }),
  );

  // ── Patient basics box ────────────────────────────────────────────────
  const basicsTable = new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [2900, CONTENT_WIDTH - 2900],
    rows: [
      fieldRow("Paciente", `${patient.firstName} ${patient.lastName}`),
      fieldRow("Fecha de nacimiento", `${birthDateStr} (${calcAge(patient.birthDate)} años)`),
      fieldRow("Objetivo de tratamiento", patient.objective?.trim() || "No especificado"),
    ],
  });

  // ── Body sections ─────────────────────────────────────────────────────
  const bodyBlocks: (Paragraph | Table)[] = [...children, basicsTable];

  for (const section of SECTIONS) {
    const rows = section.fields
      .map(([key, label]) => {
        const raw = data[key];
        const value = typeof raw === "string" ? raw.trim() : raw ? String(raw) : "";
        return value ? fieldRow(label, value) : null;
      })
      .filter((r): r is TableRow => r !== null);

    bodyBlocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_COLOR, space: 1 },
        },
        children: [new TextRun({ text: section.title, bold: true, color: BRAND_COLOR })],
      }),
    );

    if (rows.length === 0) {
      bodyBlocks.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: "Sin información registrada en esta sección.", italics: true, color: "808080", size: 19 }),
          ],
        }),
      );
    } else {
      bodyBlocks.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [2900, CONTENT_WIDTH - 2900],
          rows,
        }),
      );
    }
  }

  // ── Footer: professional, date, signature ─────────────────────────────
  bodyBlocks.push(
    new Paragraph({ spacing: { before: 480 } }),
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY, space: 4 } },
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      spacing: { before: 200 },
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
