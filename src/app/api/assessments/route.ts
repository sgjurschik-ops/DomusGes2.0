// /api/assessments — list & create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapAssessment } from "@/lib/server";
import { assessmentCreateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const prof = await requireProfessional();
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  const where = patientId ? { patientId } : {};
  const rows = await db.assessment.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: patientId ? 200 : 50,
  });
  if (patientId) await audit(prof.id, "assessment.list", "Patient", patientId);
  return NextResponse.json(rows.map(mapAssessment));
}

export async function POST(req: NextRequest) {
  const prof = await requireProfessional();
  const body = await req.json();
  const parsed = assessmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const row = await db.assessment.create({
    data: {
      patientId: d.patientId,
      therapistId: d.therapistId,
      scale: d.scale,
      score: d.score,
      notes: d.notes || null,
      date: new Date(d.date),
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
  });
  await audit(prof.id, "assessment.create", "Assessment", row.id, { patientId: row.patientId });
  return NextResponse.json(mapAssessment(row), { status: 201 });
}
