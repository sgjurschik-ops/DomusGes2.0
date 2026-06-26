// /api/reservation-categories/[id] — update & delete (own only)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapReservationCategory } from "@/lib/server";
import { reservationCategoryUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  // Categories are personal: verify ownership before allowing any change,
  // so one professional can never edit or delete another's categories.
  const existing = await db.reservationCategory.findUnique({ where: { id } });
  if (!existing || existing.professionalId !== prof.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = reservationCategoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const row = await db.reservationCategory.update({
    where: { id },
    data: { name: parsed.data.name, color: parsed.data.color },
  });
  await audit(prof.id, "reservationCategory.update", "ReservationCategory", id);
  return NextResponse.json(mapReservationCategory(row));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  const existing = await db.reservationCategory.findUnique({ where: { id } });
  if (!existing || existing.professionalId !== prof.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Reservations using this category are kept; their categoryId is set to
  // null automatically by the schema's onDelete: SetNull.
  await db.reservationCategory.delete({ where: { id } });
  await audit(prof.id, "reservationCategory.delete", "ReservationCategory", id);
  return NextResponse.json({ ok: true });
}
