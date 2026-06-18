// /api/patients/[id] — detail, update, delete
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, requireAdmin, audit, mapPatient } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;
  const row = await db.patient.findUnique({
    where: { id },
    include: {
      therapists: { select: { id: true, name: true, color: true, role: true } },
      visits: {
        select: { date: true },
        orderBy: { date: "desc" },
        take: 1,
      },
      appointments: {
        where: { start: { gt: new Date() } },
        select: { start: true },
        orderBy: { start: "asc" },
        take: 1,
      },
      _count: { select: { visits: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await audit(prof.id, "patient.view", "Patient", row.id);
  return NextResponse.json(mapPatient(row));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireAdmin();
  const { id } = await params;
  await db.patient.delete({ where: { id } });
  await audit(prof.id, "patient.delete", "Patient", id);
  return NextResponse.json({ ok: true });
}
