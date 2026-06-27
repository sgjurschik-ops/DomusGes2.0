// /api/appointments — list (with filters) & create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapAppointment, buildMadridDateTime } from "@/lib/server";
import { appointmentCreateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const prof = await requireProfessional();
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const therapistId = url.searchParams.get("therapistId");

  const where: {
    start?: { gte?: Date; lte?: Date };
    therapistId?: string;
  } = {};
  if (from || to) {
    where.start = {};
    if (from) where.start.gte = new Date(from);
    if (to) where.start.lte = new Date(to);
  }
  if (therapistId) where.therapistId = therapistId;

  const rows = await db.appointment.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true, color: true, address: true } },
      therapist: { select: { name: true } },
    },
    orderBy: { start: "asc" },
    take: 500,
  });
  await audit(prof.id, "appointment.list", "Appointment", null);
  return NextResponse.json(rows.map(mapAppointment));
}

export async function POST(req: NextRequest) {
  const prof = await requireProfessional();
  const body = await req.json();
  const parsed = appointmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const start = buildMadridDateTime(d.date, d.time);
  const row = await db.appointment.create({
    data: {
      patientId: d.patientId,
      therapistId: d.therapistId,
      start,
      durationMin: d.durationMin,
      type: d.type,
      notes: d.notes || null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true, color: true, address: true } },
      therapist: { select: { name: true } },
    },
  });
  await audit(prof.id, "appointment.create", "Appointment", row.id, { patientId: row.patientId });
  return NextResponse.json(mapAppointment(row), { status: 201 });
}
