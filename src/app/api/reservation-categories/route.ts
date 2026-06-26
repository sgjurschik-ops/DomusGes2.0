// /api/reservation-categories — list (own only) & create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapReservationCategory } from "@/lib/server";
import { reservationCategoryCreateSchema } from "@/lib/schemas";

export async function GET() {
  const prof = await requireProfessional();
  const rows = await db.reservationCategory.findMany({
    where: { professionalId: prof.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(rows.map(mapReservationCategory));
}

export async function POST(req: NextRequest) {
  const prof = await requireProfessional();
  const body = await req.json();
  const parsed = reservationCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const row = await db.reservationCategory.create({
    data: {
      professionalId: prof.id,
      name: parsed.data.name,
      color: parsed.data.color,
    },
  });
  await audit(prof.id, "reservationCategory.create", "ReservationCategory", row.id);
  return NextResponse.json(mapReservationCategory(row), { status: 201 });
}
