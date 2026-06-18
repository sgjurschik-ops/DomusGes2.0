// /api/appointments/[id] — move (drag-drop) & delete
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapAppointment } from "@/lib/server";
import { appointmentMoveSchema } from "@/lib/schemas";

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

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;
  await db.appointment.delete({ where: { id } });
  await audit(prof.id, "appointment.delete", "Appointment", id);
  return NextResponse.json({ ok: true });
}
