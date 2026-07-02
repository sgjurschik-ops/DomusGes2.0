// GET  /api/patients/[id]/routine-records — list all routine records for a patient
// POST /api/patients/[id]/routine-records — create or update record for a given date

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  await requireProfessional();
  const { id: patientId } = await params;

  const profile = await db.occupationalProfile.findUnique({
    where: { patientId },
    select: { id: true },
  });
  if (!profile) return NextResponse.json([]);

  const records = await db.weeklyRoutineRecord.findMany({
    where: { occupationalProfileId: profile.id },
    orderBy: { date: "desc" },
    select: { id: true, date: true, notes: true, createdAt: true },
  });

  return NextResponse.json(
    records.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    })),
  );
}

export async function POST(req: NextRequest, { params }: Ctx) {
  await requireProfessional();
  const { id: patientId } = await params;
  const body = await req.json();

  const profile = await db.occupationalProfile.upsert({
    where: { patientId },
    create: { patientId },
    update: {},
    select: { id: true },
  });

  const date = new Date(body.date);
  const record = await db.weeklyRoutineRecord.upsert({
    where: { occupationalProfileId_date: { occupationalProfileId: profile.id, date } },
    create: {
      occupationalProfileId: profile.id,
      date,
      cells: body.cells ?? "[]",
      notes: body.notes ?? null,
    },
    update: {
      cells: body.cells ?? "[]",
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json({
    id: record.id,
    date: record.date.toISOString().slice(0, 10),
    notes: record.notes,
  });
}
