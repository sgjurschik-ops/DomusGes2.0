// /api/reservations/[id] — move (drag-drop) & delete
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapSlotReservation } from "@/lib/server";
import { slotReservationMoveSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;
  const body = await req.json();
  const parsed = slotReservationMoveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const row = await db.slotReservation.update({
    where: { id },
    data: { start: new Date(parsed.data.start) },
    include: { therapist: { select: { name: true, color: true } } },
  });
  await audit(prof.id, "reservation.move", "SlotReservation", id, { start: parsed.data.start });
  return NextResponse.json(mapSlotReservation(row));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;
  await db.slotReservation.delete({ where: { id } });
  await audit(prof.id, "reservation.delete", "SlotReservation", id);
  return NextResponse.json({ ok: true });
}
