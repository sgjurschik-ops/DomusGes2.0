// /api/visits — list & create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapVisit } from "@/lib/server";
import { visitCreateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const prof = await requireProfessional();
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  const where = patientId ? { patientId } : {};
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
  const date = new Date(`${d.date}T${d.time}`);
  const row = await db.visit.create({
    data: {
      patientId: d.patientId,
      therapistId: d.therapistId,
      date,
      durationMin: d.durationMin,
      notes: d.notes,
      interventions: JSON.stringify(d.interventions),
      score: d.score ?? null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
  });
  await audit(prof.id, "visit.create", "Visit", row.id, { patientId: row.patientId });
  return NextResponse.json(mapVisit(row), { status: 201 });
}
