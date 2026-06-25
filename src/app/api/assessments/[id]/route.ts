// /api/assessments/[id] — get, update & delete a single assessment
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapAssessment } from "@/lib/server";
import { assessmentUpdateSchema } from "@/lib/schemas";
import { generateAreaSummaryData } from "@/lib/scales";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;
  const row = await db.assessment.findUnique({
    where: { id },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await audit(prof.id, "assessment.view", "Assessment", row.id);
  return NextResponse.json(mapAssessment(row));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = assessmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const areaSummaryData = d.itemScores ? generateAreaSummaryData(d.scale, d.itemScores) : null;

  const row = await db.assessment.update({
    where: { id },
    data: {
      scale: d.scale,
      score: d.score,
      itemScores: d.itemScores ? JSON.stringify(d.itemScores) : null,
      areaSummary: areaSummaryData ? JSON.stringify(areaSummaryData) : null,
      notes: d.notes || null,
      date: new Date(d.date),
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
  });

  await audit(prof.id, "assessment.update", "Assessment", row.id, { patientId: row.patientId });
  return NextResponse.json(mapAssessment(row));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  const existing = await db.assessment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await db.assessment.delete({ where: { id } });
  await audit(prof.id, "assessment.delete", "Assessment", id, { patientId: existing.patientId });
  return NextResponse.json({ ok: true });
}
