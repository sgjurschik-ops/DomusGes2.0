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

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const row = await db.patient.update({
    where: { id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      specialty: body.specialty,
      status: body.status,
      phone: body.phone || null,
      address: body.address || null,
      diagnosis: body.diagnosis || null,
      objective: body.objective || null,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      referentName: body.referentName || null,
      referentPhone: body.referentPhone || null,
      therapists: Array.isArray(body.therapistIds)
  ? { set: body.therapistIds.map((id: string) => ({ id })) }
  : undefined,
    },
    include: {
      therapists: { select: { id: true, name: true } },
      visits: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
      appointments: {
        where: { start: { gt: new Date() } },
        select: { start: true },
        orderBy: { start: "asc" },
        take: 1,
      },
      _count: { select: { visits: true } },
    },
  });

  await audit(prof.id, "patient.update", "Patient", row.id);

  return NextResponse.json(mapPatient(row));
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireAdmin();
  const { id } = await params;

  await db.$transaction(async (tx) => {
    await tx.appointment.deleteMany({ where: { patientId: id } });
    await tx.assessment.deleteMany({ where: { patientId: id } });
    await tx.visit.deleteMany({ where: { patientId: id } });

    await tx.patient.update({
      where: { id },
      data: {
        therapists: { set: [] },
      },
    });

    await tx.patient.delete({ where: { id } });
  });

  await audit(prof.id, "patient.delete", "Patient", id);

  return NextResponse.json({ ok: true });
}