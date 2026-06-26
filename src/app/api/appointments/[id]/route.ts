// /api/appointments/[id] — move (drag-drop), full update & delete
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapAppointment } from "@/lib/server";
import { appointmentMoveSchema, appointmentUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;
  const body = await req.json();
  const parsed = appointmentMoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const row = await db.appointment.update({
    where: { id },
    data: { start: new Date(parsed.data.start) },
    include: {
      patient: { select: { firstName: true, lastName: true, color: true, address: true } },
      therapist: { select: { name: true } },
    },
  });
  await audit(prof.id, "appointment.move", "Appointment", id, { start: parsed.data.start });
  return NextResponse.json(mapAppointment(row));
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;
  const body = await req.json();
  const parsed = appointmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const start = new Date(`${d.date}T${d.time}`);
  const row = await db.appointment.update({
    where: { id },
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
  await audit(prof.id, "appointment.update", "Appointment", id, { patientId: row.patientId });
  return NextResponse.json(mapAppointment(row));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;
  await db.appointment.delete({ where: { id } });
  await audit(prof.id, "appointment.delete", "Appointment", id);
  return NextResponse.json({ ok: true });
}
