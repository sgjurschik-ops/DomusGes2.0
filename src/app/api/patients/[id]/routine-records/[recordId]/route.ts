// GET    /api/patients/[id]/routine-records/[recordId] — full cells of one record
// DELETE /api/patients/[id]/routine-records/[recordId] — delete a record

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, canViewClinical, canEditClinical } from "@/lib/server";

type Ctx = { params: Promise<{ id: string; recordId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id: patientId, recordId } = await params;

  if (!(await canViewClinical(prof, patientId))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const record = await db.weeklyRoutineRecord.findUnique({
    where: { id: recordId },
  });
  if (!record) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({
    id: record.id,
    date: record.date.toISOString().slice(0, 10),
    cells: record.cells,
    notes: record.notes,
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id: patientId, recordId } = await params;

  if (!(await canEditClinical(prof, patientId))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await db.weeklyRoutineRecord.delete({ where: { id: recordId } });
  return NextResponse.json({ ok: true });
}
