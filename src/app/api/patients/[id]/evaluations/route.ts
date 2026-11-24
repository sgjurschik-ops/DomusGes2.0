// GET  /api/patients/[id]/evaluations — lista las valoraciones escritas del
//       usuario/a (más reciente primero). COMPARTIDAS: las ve todo el equipo
//       con acceso clínico.
// POST /api/patients/[id]/evaluations — crea una valoración nueva con fecha.
//       Body: { date: "YYYY-MM-DD", copyFromId?: string } — si llega
//       copyFromId, se copia el texto de esa valoración anterior.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, canViewClinical, canEditClinical, audit } from "@/lib/server";
import { mapEvaluation, EVALUATION_INCLUDE, parseDateOnly, errorResponse } from "./shared";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId } = await params;

    if (!(await canViewClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const rows = await db.patientEvaluation.findMany({
      where: { patientId },
      include: EVALUATION_INCLUDE,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(await Promise.all(rows.map(mapEvaluation)));
  } catch (err) {
    return errorResponse("evaluations GET", err);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId } = await params;

    if (!(await canEditClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const date = parseDateOnly(body?.date);
    if (!date) {
      return NextResponse.json({ error: "VALIDATION", detail: "Fecha no válida" }, { status: 400 });
    }

    // Copia opcional del texto de una valoración anterior DEL MISMO usuario/a.
    let copied = {};
    if (typeof body?.copyFromId === "string" && body.copyFromId) {
      const source = await db.patientEvaluation.findFirst({
        where: { id: body.copyFromId, patientId },
        select: { generalData: true, adl: true, iadl: true, physical: true, routines: true, other: true },
      });
      if (!source) {
        return NextResponse.json({ error: "NOT_FOUND", detail: "Valoración de origen no encontrada" }, { status: 404 });
      }
      copied = source;
    }

    const row = await db.patientEvaluation.create({
      data: {
        patientId,
        authorId: prof.id,
        date,
        ...copied,
      },
      include: EVALUATION_INCLUDE,
    });

    await audit(prof.id, "evaluation.create", "PatientEvaluation", row.id, {
      patientId,
      copiedFrom: body?.copyFromId ?? null,
    });

    return NextResponse.json(await mapEvaluation(row), { status: 201 });
  } catch (err) {
    return errorResponse("evaluations POST", err);
  }
}
