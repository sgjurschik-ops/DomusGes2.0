// /api/visits/[id] — get, update & delete a single visit
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, canViewClinical, canEditClinical, audit, mapVisit, buildMadridDateTime } from "@/lib/server";
import { visitUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;
  const row = await db.visit.findUnique({
    where: { id },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!(await canViewClinical(prof, row.patientId))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  await audit(prof.id, "visit.view", "Visit", row.id, { patientId: row.patientId });
  return NextResponse.json(mapVisit(row));
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  const existing = await db.visit.findUnique({ where: { id }, select: { patientId: true } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!(await canEditClinical(prof, existing.patientId))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  // Support partial update (e.g. just tasks from new-visit-form reviewing previous tasks)
  if (body.tasks && !body.therapistId) {
    const tasks = typeof body.tasks === "string" ? body.tasks : JSON.stringify(body.tasks);
    await db.visit.update({ where: { id }, data: { tasks } });
    return NextResponse.json({ ok: true });
  }

  const parsed = visitUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const date = buildMadridDateTime(d.date, d.time);

  const row = await db.visit.update({
    where: { id },
    data: {
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

  await audit(prof.id, "visit.update", "Visit", row.id, { patientId: row.patientId });
  return NextResponse.json(mapVisit(row));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  const existing = await db.visit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!(await canEditClinical(prof, existing.patientId))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await db.visit.delete({ where: { id } });
  await audit(prof.id, "visit.delete", "Visit", id, { patientId: existing.patientId });
  return NextResponse.json({ ok: true });
}
