// /api/reservations — list (with filters) & create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapSlotReservation } from "@/lib/server";
import { slotReservationCreateSchema } from "@/lib/schemas";

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

  const rows = await db.slotReservation.findMany({
    where,
    include: {
      therapist: { select: { name: true, color: true } },
      category: { select: { id: true, name: true, color: true } },
    },
    orderBy: { start: "asc" },
    take: 500,
  });
  await audit(prof.id, "reservation.list", "SlotReservation", null);
  return NextResponse.json(rows.map(mapSlotReservation));
}

export async function POST(req: NextRequest) {
  const prof = await requireProfessional();
  const body = await req.json();
  const parsed = slotReservationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const start = new Date(`${d.date}T${d.time}`);
  const row = await db.slotReservation.create({
    data: {
      therapistId: d.therapistId,
      categoryId: d.categoryId || null,
      title: d.title,
      start,
      durationMin: d.durationMin,
    },
    include: {
      therapist: { select: { name: true, color: true } },
      category: { select: { id: true, name: true, color: true } },
    },
  });
  await audit(prof.id, "reservation.create", "SlotReservation", row.id, { therapistId: row.therapistId });
  return NextResponse.json(mapSlotReservation(row), { status: 201 });
}