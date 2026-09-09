// /api/patients/[id] — detail, update, delete
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireProfessional,
  canViewPatient,
  canEditPatient,
  audit,
  safePartial,
  mapPatient,
  getPatientTimelineMap,
} from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  if (!(await canViewPatient(prof, id))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const row = await db.patient.findUnique({
    where: { id },
    include: {
      therapists: { select: { id: true, name: true, color: true, role: true } },
      _count: { select: { visits: true } },
    },
  });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const { lastVisitMap, nextApptMap } = await getPatientTimelineMap([row.id]);
  await audit(prof.id, "patient.view", "Patient", row.id);
  return NextResponse.json(
    mapPatient(row, {
      lastVisitDate: lastVisitMap.get(row.id) ?? null,
      nextAppointmentDate: nextApptMap.get(row.id) ?? null,
    }),
  );
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

  const hasFullEditAccess = await canEditPatient(prof, id);

  // ─── Auto-asignación de un/a terapeuta no asignado/a ────────────────────
  // Un/a profesional que NO forma parte del equipo de este paciente no tiene
  // permiso de edición general (canEditPatient = false), pero SÍ debe poder
  // añadirse a sí mismo/a como terapeuta — igual que ya puede hacerlo al
  // crear un paciente nuevo. No puede tocar ningún otro dato del paciente
  // ni quitar a nadie del equipo. Para garantizarlo, se compara la petición
  // campo a campo contra los datos actuales: si algo más además de sumarse
  // a sí mismo/a ha cambiado, se rechaza.
  if (!hasFullEditAccess) {
    const current = await db.patient.findUnique({
      where: { id },
      include: { therapists: { select: { id: true } } },
    });
    if (!current) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    if ((current as any).restricted) {
      // Paciente restringido: nadie puede auto-asignarse. Solo la
      // Administradora o un/a terapeuta ya asignado/a puede añadir a
      // alguien más al equipo.
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const sameOrUnset = (key: string, currentValue: unknown) =>
      body[key] === undefined || (body[key] ?? null) === (currentValue ?? null);

    const sameDateOrUnset = (key: string, currentValue: Date) =>
      body[key] === undefined || new Date(body[key]).getTime() === currentValue.getTime();

    const sameArrayOrUnset = (key: string, currentValue: unknown) =>
      body[key] === undefined || JSON.stringify(body[key]) === JSON.stringify(currentValue ?? []);

    const onlyTherapistsChanged =
      sameOrUnset("firstName", current.firstName) &&
      sameOrUnset("lastName", current.lastName) &&
      sameDateOrUnset("birthDate", current.birthDate) &&
      sameOrUnset("specialty", current.specialty) &&
      sameOrUnset("status", current.status) &&
      sameOrUnset("resource", current.resource) &&
      sameOrUnset("emCategory", current.emCategory) &&
      sameOrUnset("phone", current.phone) &&
      sameOrUnset("address", current.address) &&
      sameDateOrUnset("startDate", current.startDate) &&
      sameOrUnset("referentName", current.referentName) &&
      sameOrUnset("referentPhone", current.referentPhone) &&
      sameOrUnset("referent", current.referent) &&
      sameOrUnset("careTeamReferent", current.careTeamReferent) &&
      sameOrUnset("quickNotes", current.quickNotes) &&
      sameOrUnset("diagnosis", current.diagnosis) &&
      sameOrUnset("objective", current.objective) &&
      sameArrayOrUnset("alerts", (current as any).alerts);

    if (!onlyTherapistsChanged) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const currentTherapistIds = new Set(current.therapists.map((t) => t.id));
    const requestedTherapistIds = Array.isArray(body.therapistIds)
      ? new Set<string>(body.therapistIds)
      : currentTherapistIds;

    const removedSomeone = [...currentTherapistIds].some((tid) => !requestedTherapistIds.has(tid));
    const addedIds = [...requestedTherapistIds].filter((tid) => !currentTherapistIds.has(tid));
    const onlyAddsSelf = addedIds.length === 1 && addedIds[0] === prof.id;

    if (removedSomeone || addedIds.length === 0 || !onlyAddsSelf) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const row = await db.patient.update({
      where: { id },
      data: { therapists: { connect: { id: prof.id } } },
      include: {
        therapists: { select: { id: true, name: true } },
        _count: { select: { visits: true } },
      },
    });

    const { lastVisitMap, nextApptMap } = await getPatientTimelineMap([row.id]);
    await audit(prof.id, "patient.self_assign", "Patient", row.id);

    return NextResponse.json(
      mapPatient(row, {
        lastVisitDate: lastVisitMap.get(row.id) ?? null,
        nextAppointmentDate: nextApptMap.get(row.id) ?? null,
      }),
    );
  }

  // ─── Edición completa (admin o terapeuta ya asignado) ───────────────────
  const therapistUpdate =
    Array.isArray(body.therapistIds)
      ? { set: body.therapistIds.map((tid: string) => ({ id: tid })) }
      : undefined;

  // Admin can only edit contact/admin fields, not clinical ones
  const isAdmin = prof.userRole === "admin";

  const row = await db.patient.update({
    where: { id },
    data: safePartial({
      firstName: body.firstName,
      lastName: body.lastName,
      birthDate: body.birthDate !== undefined ? new Date(body.birthDate) : undefined,
      specialty: body.specialty,
      status: body.status,
      resource: body.resource !== undefined ? (body.resource || null) : undefined,
      // La clasificación EM sigue al recurso: si el recurso cambia a algo
      // que no es "Asociación EM", se limpia; si es EM, se guarda la elegida.
      emCategory:
        body.resource !== undefined
          ? body.resource === "Asociación EM"
            ? (body.emCategory ?? null)
            : null
          : body.emCategory !== undefined
            ? (body.emCategory || null)
            : undefined,
      phone: body.phone !== undefined ? (body.phone || null) : undefined,
      address: body.address !== undefined ? (body.address || null) : undefined,
      startDate: body.startDate !== undefined ? new Date(body.startDate) : undefined,
      referentName: body.referentName !== undefined ? (body.referentName || null) : undefined,
      referentPhone: body.referentPhone !== undefined ? (body.referentPhone || null) : undefined,
      referent: body.referent !== undefined ? (body.referent || null) : undefined,
      careTeamReferent: body.careTeamReferent !== undefined ? (body.careTeamReferent || null) : undefined,
      therapists: therapistUpdate,
      quickNotes: body.quickNotes,
      restricted: typeof body.restricted === "boolean" ? body.restricted : undefined,
      ...(isAdmin ? {} : {
        diagnosis: body.diagnosis !== undefined ? (body.diagnosis || null) : undefined,
        objective: body.objective !== undefined ? (body.objective || null) : undefined,
        alerts: Array.isArray(body.alerts) ? body.alerts : undefined,
      }),
    }),
    include: {
      therapists: { select: { id: true, name: true } },
      _count: { select: { visits: true } },
    },
  });

  const { lastVisitMap, nextApptMap } = await getPatientTimelineMap([row.id]);
  await audit(prof.id, "patient.update", "Patient", row.id);

  return NextResponse.json(
    mapPatient(row, {
      lastVisitDate: lastVisitMap.get(row.id) ?? null,
      nextAppointmentDate: nextApptMap.get(row.id) ?? null,
    }),
  );
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  if (prof.userRole !== "admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const { id } = await params;

  await db.$transaction(async (tx) => {
    await tx.appointment.deleteMany({ where: { patientId: id } });
    await tx.assessment.deleteMany({ where: { patientId: id } });
    await tx.visit.deleteMany({ where: { patientId: id } });
    await tx.patient.update({ where: { id }, data: { therapists: { set: [] } } });
    await tx.patient.delete({ where: { id } });
  });

  await audit(prof.id, "patient.delete", "Patient", id);
  return NextResponse.json({ ok: true });
}
