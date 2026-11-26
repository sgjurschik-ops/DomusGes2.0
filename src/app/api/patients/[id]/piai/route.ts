// GET  /api/patients/[id]/piai — lista los PIAI del/de la usuario/a (más
//       reciente primero), con todos sus apartados. Lo ve todo el equipo.
// POST /api/patients/[id]/piai — crea un PIAI. Body: { date, copyFromId? }.
//       Con copyFromId se copian la información general, los objetivos
//       generales y los apartados de cada profesional del PIAI anterior.
// Solo para usuarios/as de Centro de día.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, canViewClinical, canEditClinical, isDayCenterPatient, audit } from "@/lib/server";
import { mapPiai, PIAI_INCLUDE, parseDateOnly, errorResponse } from "./shared";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId } = await params;
    if (!(await canViewClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const rows = await db.piai.findMany({
      where: { patientId },
      include: PIAI_INCLUDE,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(await Promise.all(rows.map(mapPiai)));
  } catch (err) {
    return errorResponse("piai GET", err);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId } = await params;
    if (!(await canEditClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (!(await isDayCenterPatient(patientId))) {
      return NextResponse.json({ error: "VALIDATION", detail: "El PIAI es solo para usuarios/as de Centro de día" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const date = parseDateOnly(body?.date);
    if (!date) return NextResponse.json({ error: "VALIDATION", detail: "Fecha no válida" }, { status: 400 });

    let source: { general: string; generalObjectives: string; sections: { sectionKey: string; content: string }[] } | null = null;
    if (typeof body?.copyFromId === "string" && body.copyFromId) {
      source = await db.piai.findFirst({
        where: { id: body.copyFromId, patientId },
        select: { general: true, generalObjectives: true, sections: { select: { sectionKey: true, content: true } } },
      });
      if (!source) return NextResponse.json({ error: "NOT_FOUND", detail: "PIAI de origen no encontrado" }, { status: 404 });
    }

    const row = await db.piai.create({
      data: {
        patientId,
        createdById: prof.id,
        date,
        general: source?.general ?? "{}",
        generalObjectives: source?.generalObjectives ?? "[]",
        sections: source
          ? { create: source.sections.map((s) => ({ sectionKey: s.sectionKey, content: s.content })) }
          : undefined,
      },
      include: PIAI_INCLUDE,
    });
    await audit(prof.id, "piai.create", "Piai", row.id, { patientId, copiedFrom: body?.copyFromId ?? null });
    return NextResponse.json(await mapPiai(row), { status: 201 });
  } catch (err) {
    return errorResponse("piai POST", err);
  }
}
