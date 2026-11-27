// PATCH  /api/patients/[id]/evaluations/[evaluationId] — guarda la valoración
//        (todos los bloques modificados a la vez), su fecha y/o su tipo.
//        Body: { fields?: { generalData?: string, adl?: string, ... },
//                date?: "YYYY-MM-DD", kind?: "Valoración inicial" | "Valoración" }
//        Solo la edita la misma profesión que la creó; queda registrado quién
//        hizo la última edición.
// DELETE /api/patients/[id]/evaluations/[evaluationId] — solo su autor/a.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, canEditClinical, audit } from "@/lib/server";
import { isEvaluationTextField, normalizeEvaluationKind, type EvaluationTextField } from "@/lib/evaluations";
import { mapEvaluation, EVALUATION_INCLUDE, parseDateOnly, errorResponse } from "../shared";

type Ctx = { params: Promise<{ id: string; evaluationId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId, evaluationId } = await params;

    if (!(await canEditClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const existing = await db.patientEvaluation.findFirst({
      where: { id: evaluationId, patientId },
      select: { id: true, author: { select: { role: true } } },
    });
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    // Cada profesión edita sus propias valoraciones (todos las pueden leer).
    if (existing.author.role !== prof.role) {
      return NextResponse.json({ error: "FORBIDDEN", detail: `Solo un/a profesional de ${existing.author.role} puede editar esta valoración` }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    const data: Partial<Record<EvaluationTextField, string>> & { date?: Date; kind?: string } = {};
    if (body?.fields && typeof body.fields === "object") {
      for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
        if (!isEvaluationTextField(key)) {
          return NextResponse.json({ error: "VALIDATION", detail: `Campo no válido: ${key}` }, { status: 400 });
        }
        if (typeof value !== "string") {
          return NextResponse.json({ error: "VALIDATION", detail: `Valor no válido en ${key}` }, { status: 400 });
        }
        data[key] = value;
      }
    }
    if (body?.date !== undefined) {
      const date = parseDateOnly(body.date);
      if (!date) return NextResponse.json({ error: "VALIDATION", detail: "Fecha no válida" }, { status: 400 });
      data.date = date;
    }
    if (body?.kind !== undefined) data.kind = normalizeEvaluationKind(body.kind);
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "VALIDATION", detail: "Nada que guardar" }, { status: 400 });
    }

    const row = await db.patientEvaluation.update({
      where: { id: evaluationId },
      data: { ...data, updatedById: prof.id },
      include: EVALUATION_INCLUDE,
    });

    await audit(prof.id, "evaluation.update", "PatientEvaluation", row.id, {
      patientId,
      fields: Object.keys(data),
    });

    return NextResponse.json(await mapEvaluation(row));
  } catch (err) {
    return errorResponse("evaluations PATCH", err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId, evaluationId } = await params;

    if (!(await canEditClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const existing = await db.patientEvaluation.findFirst({
      where: { id: evaluationId, patientId },
      select: { id: true, authorId: true },
    });
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (existing.authorId !== prof.id) {
      return NextResponse.json({ error: "FORBIDDEN", detail: "Solo quien creó la valoración puede eliminarla" }, { status: 403 });
    }

    await db.patientEvaluation.delete({ where: { id: evaluationId } });
    await audit(prof.id, "evaluation.delete", "PatientEvaluation", evaluationId, { patientId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse("evaluations DELETE", err);
  }
}
