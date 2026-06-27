// Server-side helpers: current user, requireAdmin, audit log.
// All API routes should call these instead of trusting the client.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ProfessionalDTO, AreaSummaryData } from "@/types/domain";
import type { Prisma } from "@prisma/client";

export async function getCurrentProfessional(): Promise<ProfessionalDTO | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const prof = await db.professional.findUnique({
    where: { id: session.user.id },
  });
  if (!prof || !prof.isActive) return null;
  return {
    id: prof.id,
    email: prof.email,
    name: prof.name,
    role: prof.role,
    numColegiado: prof.numColegiado,
    phone: prof.phone,
    isActive: prof.isActive,
    isAdmin: prof.isAdmin,
    color: prof.color,
    joinedAt: prof.joinedAt.toISOString(),
  };
}

// ─── Timezone-safe local datetime construction ─────────────────────────────
//
// All "date" + "time" form fields represent wall-clock time in Madrid (the
// clinic's timezone), but `new Date("YYYY-MM-DDTHH:mm")` is interpreted in
// whatever timezone the *process* running this code happens to be in. That's
// Europe/Madrid on a developer's Mac, but Vercel's serverless functions run
// in UTC — so the exact same code silently shifted every appointment by the
// Madrid UTC offset (1h in winter, 2h in summer DST) once deployed. This
// helper computes Madrid's real offset for the given date (handling the
// CET/CEST transition correctly) and builds the Date explicitly from that,
// so the result is correct regardless of the server's own timezone.
export function buildMadridDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // Find Madrid's current UTC offset by formatting the same instant in both
  // UTC and Europe/Madrid, then comparing — this naturally accounts for
  // daylight saving without hardcoding transition dates.
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const madridParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(naiveUtc);

  const get = (type: string) => Number(madridParts.find((p) => p.type === type)?.value);
  const madridAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );
  const offsetMs = madridAsUtc - naiveUtc.getTime();

  // The wall-clock time the person typed, minus Madrid's offset, gives the
  // correct UTC instant.
  return new Date(naiveUtc.getTime() - offsetMs);
}

export async function requireProfessional(): Promise<ProfessionalDTO> {
  const prof = await getCurrentProfessional();
  if (!prof) throw new Error("UNAUTHORIZED");
  return prof;
}

export async function requireAdmin(): Promise<ProfessionalDTO> {
  const prof = await requireProfessional();
  if (!prof.isAdmin) throw new Error("FORBIDDEN");
  return prof;
}

// ─── Audit log ───────────────────────────────────────────────────────────────

export async function audit(
  professionalId: string | null,
  action: string,
  entityType: string,
  entityId: string | null = null,
  metadata: Record<string, unknown> = {},
  ipAddress: string | null = null,
) {
  try {
    await db.auditLog.create({
      data: {
        professionalId,
        action,
        entityType,
        entityId,
        metadata: JSON.stringify(metadata),
        ipAddress,
      },
    });
  } catch (err) {
    // Audit failure must never break the user flow
    console.error("[audit] failed to write log:", err);
  }
}

// ─── Patient timeline (last visit / next appointment) ──────────────────────
// Computes, for a set of patient IDs, the most recent visit date and the
// next scheduled appointment date — in exactly 2 queries total, regardless
// of how many patient IDs are passed in. This replaces the old approach of
// nesting `visits`/`appointments` with `orderBy` + `take: 1` inside a
// `findMany`/`findUnique` include, which Prisma cannot turn into a single
// query and instead resolves with one extra query per patient (see notes
// above `PatientWithRels`).
export async function getPatientTimelineMap(patientIds: string[]) {
  const lastVisitMap = new Map<string, Date>();
  const nextApptMap = new Map<string, Date>();
  if (patientIds.length === 0) return { lastVisitMap, nextApptMap };

  const [lastVisits, nextAppts] = await Promise.all([
    db.visit.groupBy({
      by: ["patientId"],
      where: { patientId: { in: patientIds } },
      _max: { date: true },
    }),
    db.appointment.groupBy({
      by: ["patientId"],
      where: {
        patientId: { in: patientIds },
        start: { gt: new Date() },
        status: "programada",
      },
      _min: { start: true },
    }),
  ]);

  for (const v of lastVisits) {
    if (v._max.date) lastVisitMap.set(v.patientId, v._max.date);
  }
  for (const a of nextAppts) {
    if (a._min.start) nextApptMap.set(a.patientId, a._min.start);
  }

  return { lastVisitMap, nextApptMap };
}

// ─── Mappers (Prisma row → DTO) ─────────────────────────────────────────────

export function calcAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

// NOTE on performance: this type intentionally does NOT include `visits` or
// `appointments` as nested relations. Prisma cannot resolve a nested relation
// that combines `orderBy` + `take` into a single SQL query — it falls back to
// issuing one extra query PER PARENT ROW (confirmed Prisma behaviour, not a
// bug in our code). For a list of N patients that meant 1 + 2N queries.
// Instead, the caller fetches `lastVisitDate`/`nextAppointmentDate` separately
// with two aggregate queries (one for the whole list, regardless of N) and
// passes the result in here.
type PatientWithRels = Prisma.PatientGetPayload<{
  include: {
    therapists: { select: { id: true; name: true } };
    _count: { select: { visits: true } };
  };
}>;

export function mapPatient(
  p: PatientWithRels,
  extra: { lastVisitDate: Date | null; nextAppointmentDate: Date | null },
) {
  const now = new Date();
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: `${p.firstName} ${p.lastName}`,
    birthDate: p.birthDate.toISOString(),
    age: calcAge(p.birthDate, now),
    specialty: p.specialty,
    status: p.status,
    phone: p.phone,
    address: p.address,
    diagnosis: p.diagnosis,
    objective: p.objective,
    startDate: p.startDate.toISOString(),
    referentName: p.referentName,
    referentPhone: p.referentPhone,
    color: p.color,
    therapistIds: p.therapists.map((t) => t.id),
    therapistNames: p.therapists.map((t) => t.name),
    totalVisits: p._count.visits,
    lastVisitDate: extra.lastVisitDate?.toISOString() ?? null,
    nextAppointmentDate: extra.nextAppointmentDate?.toISOString() ?? null,
  };
}

type VisitWithRels = Prisma.VisitGetPayload<{
  include: {
    patient: { select: { firstName: true; lastName: true } };
    therapist: { select: { name: true } };
  };
}>;

export function mapVisit(v: VisitWithRels) {
  return {
    id: v.id,
    patientId: v.patientId,
    patientName: `${v.patient.firstName} ${v.patient.lastName}`,
    therapistId: v.therapistId,
    therapistName: v.therapist.name,
    date: v.date.toISOString(),
    durationMin: v.durationMin,
    title: v.title,
    notes: v.notes,
    interventions: JSON.parse(v.interventions || "[]") as string[],
    score: v.score,
    createdAt: v.createdAt.toISOString(),
  };
}

type AssessmentWithRels = Prisma.AssessmentGetPayload<{
  include: {
    patient: { select: { firstName: true; lastName: true } };
    therapist: { select: { name: true } };
  };
}>;

export function mapAssessment(a: AssessmentWithRels) {
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: `${a.patient.firstName} ${a.patient.lastName}`,
    therapistId: a.therapistId,
    therapistName: a.therapist.name,
    scale: a.scale,
    score: a.score,
    itemScores: a.itemScores ? (JSON.parse(a.itemScores) as Record<string, number>) : null,
    areaSummary: a.areaSummary ? (JSON.parse(a.areaSummary) as AreaSummaryData) : null,
    notes: a.notes,
    date: a.date.toISOString(),
  };
}

type AppointmentWithRels = Prisma.AppointmentGetPayload<{
  include: {
    patient: { select: { firstName: true; lastName: true; color: true; address: true } };
    therapist: { select: { name: true } };
  };
}>;

export function mapAppointment(a: AppointmentWithRels) {
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: `${a.patient.firstName} ${a.patient.lastName}`,
    patientColor: a.patient.color,
    patientAddress: a.patient.address,
    therapistId: a.therapistId,
    therapistName: a.therapist.name,
    start: a.start.toISOString(),
    durationMin: a.durationMin,
    type: a.type,
    status: a.status,
    notes: a.notes,
  };
}

type SlotReservationWithRels = Prisma.SlotReservationGetPayload<{
  include: {
    therapist: { select: { name: true; color: true } };
    category: { select: { id: true; name: true; color: true } };
  };
}>;

export function mapSlotReservation(r: SlotReservationWithRels) {
  return {
    id: r.id,
    therapistId: r.therapistId,
    therapistName: r.therapist.name,
    therapistColor: r.therapist.color,
    categoryId: r.category?.id ?? null,
    categoryName: r.category?.name ?? null,
    categoryColor: r.category?.color ?? null,
    title: r.title,
    start: r.start.toISOString(),
    durationMin: r.durationMin,
  };
}

export function mapReservationCategory(c: { id: string; professionalId: string; name: string; color: string }) {
  return {
    id: c.id,
    professionalId: c.professionalId,
    name: c.name,
    color: c.color,
  };
}
