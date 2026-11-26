// PATCH  /api/patients/[id]/piai/[piaiId] — guarda la parte COMÚN del PIAI
//        (fecha, estado, información general, objetivos generales,
//        revisiones). La puede editar cualquiera del equipo con edición
//        clínica. Body: cualquiera de { date, status, general,
//        generalObjectives, reviews }.
// DELETE /api/patients/[id]/piai/[piaiId] — solo quien lo creó.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, canEditClinical, audit } from "@/lib/server";
import {
  mapPiai, PIAI_INCLUDE, parseDateOnly, errorResponse,
  cleanGeneral, cleanGeneralObjectives, cleanReviews, isValidStatus,
} from "../shared";

type Ctx = { params: Promise<{ id: string; piaiId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId, piaiId } = await params;
    if (!(await canEditClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const existing = await db.piai.findFirst({ where: { id: piaiId, patientId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: { date?: Date; status?: string; general?: string; generalObjectives?: string; reviews?: string } = {};
    if (body?.date !== undefined) {
      const d = parseDateOnly(body.date);
      if (!d) return NextResponse.json({ error: "VALIDATION", detail: "Fecha no válida" }, { status: 400 });
      data.date = d;
    }
    if (body?.status !== undefined) {
      if (!isValidStatus(body.status)) return NextResponse.json({ error: "VALIDATION", detail: "Estado no válido" }, { status: 400 });
      data.status = body.status;
    }
    if (body?.general !== undefined) data.general = JSON.stringify(cleanGeneral(body.general));
    if (body?.generalObjectives !== undefined) data.generalObjectives = JSON.stringify(cleanGeneralObjectives(body.generalObjectives));
    if (body?.reviews !== undefined) data.reviews = JSON.stringify(cleanReviews(body.reviews));
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "VALIDATION", detail: "Nada que guardar" }, { status: 400 });
    }

    const row = await db.piai.update({
      where: { id: piaiId },
      data: { ...data, updatedById: prof.id },
      include: PIAI_INCLUDE,
    });
    await audit(prof.id, "piai.update", "Piai", piaiId, { patientId, fields: Object.keys(data) });
    return NextResponse.json(await mapPiai(row));
  } catch (err) {
    return errorResponse("piai PATCH", err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId, piaiId } = await params;
    if (!(await canEditClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    const existing = await db.piai.findFirst({ where: { id: piaiId, patientId }, select: { createdById: true } });
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (existing.createdById !== prof.id) {
      return NextResponse.json({ error: "FORBIDDEN", detail: "Solo quien creó el PIAI puede eliminarlo" }, { status: 403 });
    }
    await db.piai.delete({ where: { id: piaiId } });
    await audit(prof.id, "piai.delete", "Piai", piaiId, { patientId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("piai DELETE", err);
  }
}
