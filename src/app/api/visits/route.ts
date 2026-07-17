// /api/visits — list & create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapVisit, buildMadridDateTime } from "@/lib/server";
import { visitCreateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const prof = await requireProfessional();
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");

  // Build base filter
  const where: Record<string, unknown> = {};
  if (patientId) where.patientId = patientId;

  // Permission: guest only sees visits for their own patients;
  // therapist sees all; admin does not access clinical data but
  // we still allow listing for reporting purposes.
  if (prof.userRole === "guest") {
    where.therapistId = prof.id;
  }

  const rows = await db.visit.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: patientId ? 200 : 50,
  });
  if (patientId) await audit(prof.id, "visit.list", "Patient", patientId);
  return NextResponse.json(rows.map(mapVisit));
}

export async function POST(req: NextRequest) {
  const prof = await requireProfessional();
  const body = await req.json();
  const parsed = visitCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const date = buildMadridDateTime(d.date, d.time);
  const row = await db.visit.create({
    data: {
      patientId: d.patientId,
      therapistId: d.therapistId,
      date,
      durationMin: d.durationMin,
      title: d.title,
      notes: d.notes,
      interventions: JSON.stringify(d.interventions),
      goalIds: JSON.stringify(d.goalIds ?? []),
      tasks: JSON.stringify(d.tasks ?? []),
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
  });
  await audit(prof.id, "visit.create", "Visit", row.id, { patientId: row.patientId });
  return NextResponse.json(mapVisit(row), { status: 201 });
}
