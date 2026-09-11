// /api/patients — list & create
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapPatient, getPatientTimelineMap, buildResourceFilter } from "@/lib/server";
import { patientCreateSchema } from "@/lib/schemas";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const prof = await requireProfessional();
  const resource = new URL(req.url).searchParams.get("resource");

  const isAdmin = prof.userRole === "admin";
  const isGuest = prof.userRole === "guest";

  // ─── Visibilidad de pacientes ───────────────────────────────────────────
  // - Administrador/a: ve todo, sin restricción.
  // - Cualquier otro/a profesional: un paciente marcado como "restricted"
  //   SOLO es visible si está asignado/a a él, sin excepción (ni siquiera
  //   Centro de día, que normalmente es colaborativo).
  // - Para pacientes NO restringidos: terapeuta ve todos; invitado/a solo
  //   los suyos asignados, más los de Centro de día (colaborativo).
  const nonRestrictedCondition: Prisma.PatientWhereInput = isGuest
    ? {
        restricted: false,
        OR: [
          { therapists: { some: { id: prof.id } } },
          { resource: "Asociación EM", emCategory: "Centro de día" },
        ],
      }
    : { restricted: false };

  const visibilityFilter: Prisma.PatientWhereInput = {
    OR: [
      { restricted: true, therapists: { some: { id: prof.id } } },
      nonRestrictedCondition,
    ],
  };

  const where = {
    AND: [
      buildResourceFilter(resource),
      isAdmin ? {} : visibilityFilter,
    ],
  };

  const rows = await db.patient.findMany({
    where,
    include: {
      therapists: { select: { id: true, name: true } },
      _count: { select: { visits: true } },
    },
    orderBy: { lastName: "asc" },
  });
  const { lastVisitMap, nextApptMap } = await getPatientTimelineMap(rows.map((r) => r.id));
  await audit(prof.id, "patient.list", "Patient", null);
  return NextResponse.json(
    rows.map((r) =>
      mapPatient(r, {
        lastVisitDate: lastVisitMap.get(r.id) ?? null,
        nextAppointmentDate: nextApptMap.get(r.id) ?? null,
      }),
    ),
  );
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
      specialty: d.specialty,
      status: d.status,
      resource: d.resource,
      emCategory: d.resource === "Asociación EM" ? (d.emCategory ?? null) : null,
      phone: d.phone || null,
      address: d.address || null,
      diagnosis: d.diagnosis || null,
      objective: d.objective || null,
      alerts: d.alerts,
      startDate: new Date(d.startDate),
      referentName: d.referentName || null,
      referentPhone: d.referentPhone || null,
      referent: d.referent || null,
      careTeamReferent: d.careTeamReferent || null,
      informedConsent: d.informedConsent ?? false,
      color: ["#1a5c58", "#5b3fa0", "#c17f3a", "#b03060", "#2a6b3f", "#1a5c80"][
        Math.floor(Math.random() * 6)
      ],
      therapists: { connect: d.therapistIds.map((id) => ({ id })) },
    },
    include: {
      therapists: { select: { id: true, name: true } },
      _count: { select: { visits: true } },
    },
  });
  await audit(prof.id, "patient.create", "Patient", row.id, { name: `${row.firstName} ${row.lastName}` });
  return NextResponse.json(
    mapPatient(row, { lastVisitDate: null, nextAppointmentDate: null }),
    { status: 201 },
  );
}
