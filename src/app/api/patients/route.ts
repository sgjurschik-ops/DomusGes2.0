// /api/patients — list & create
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapPatient } from "@/lib/server";
import { patientCreateSchema } from "@/lib/schemas";

export async function GET() {
  const prof = await requireProfessional();
  const rows = await db.patient.findMany({
    include: {
      therapists: { select: { id: true, name: true } },
      visits: {
        select: { date: true },
        orderBy: { date: "desc" },
        take: 1,
      },
      appointments: {
        where: { start: { gt: new Date() }, status: "programada" },
        select: { start: true },
        orderBy: { start: "asc" },
        take: 1,
      },
      _count: { select: { visits: true } },
    },
    orderBy: { lastName: "asc" },
  });
  await audit(prof.id, "patient.list", "Patient", null);
  return NextResponse.json(rows.map(mapPatient));
}

export async function POST(req: NextRequest) {
  const prof = await requireProfessional();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = patientCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const row = await db.patient.create({
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      birthDate: new Date(d.birthDate),
      specialty: d.specialty,
      status: d.status,
      phone: d.phone || null,
      address: d.address || null,
      diagnosis: d.diagnosis || null,
      objective: d.objective || null,
      startDate: new Date(d.startDate),
      referentName: d.referentName || null,
      referentPhone: d.referentPhone || null,
      color: ["#1a5c58", "#5b3fa0", "#c17f3a", "#b03060", "#2a6b3f", "#1a5c80"][
        Math.floor(Math.random() * 6)
      ],
      therapists: { connect: d.therapistIds.map((id) => ({ id })) },
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
  await audit(prof.id, "patient.create", "Patient", row.id, { name: `${row.firstName} ${row.lastName}` });
  return NextResponse.json(mapPatient(row), { status: 201 });
}
