// Server-side helpers: current user, requireAdmin, audit log.
// All API routes should call these instead of trusting the client.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ProfessionalDTO, AreaSummaryData } from "@/types/domain";
import type { Prisma } from "@prisma/client";
import { RESOURCES } from "@/lib/schemas";

export type UserRole = "admin" | "therapist" | "guest";

export async function getCurrentProfessional(): Promise<ProfessionalDTO | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const prof = await db.professional.findUnique({
    where: { id: session.user.id },
  });
  if (!prof || !prof.isActive) return null;
  const userRole: UserRole = (prof.userRole as UserRole) ?? (prof.isAdmin ? "admin" : "therapist");
  return {
    id: prof.id,
    email: prof.email,
    name: prof.name,
    role: prof.role,
    numColegiado: prof.numColegiado,
    phone: prof.phone,
    isActive: prof.isActive,
    isAdmin: prof.isAdmin,
    userRole,
    color: prof.color,
    joinedAt: prof.joinedAt.toISOString(),
  };
}

export function buildMadridDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
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
  return new Date(naiveUtc.getTime() - offsetMs);
}

export async function requireProfessional(): Promise<ProfessionalDTO> {
  const prof = await getCurrentProfessional();
  if (!prof) throw new Error("UNAUTHORIZED");
  return prof;
}

export async function requireAdmin(): Promise<ProfessionalDTO> {
  const prof = await requireProfessional();
  if (prof.userRole !== "admin") throw new Error("FORBIDDEN");
  return prof;
}

export async function requireTherapistOrAdmin(): Promise<ProfessionalDTO> {
  const prof = await requireProfessional();
  if (prof.userRole === "guest") throw new Error("FORBIDDEN");
  return prof;
}

export async function isDayCenterPatient(patientId: string): Promise<boolean> {
  const p = await db.patient.findUnique({
    where: { id: patientId },
    select: { resource: true, emCategory: true },
  });
  return p?.resource === "Asociación EM" && p?.emCategory === "Centro de día";
}

// ─── Pacientes restringidos ─────────────────────────────────────────────
// Un paciente marcado como "restricted" solo es visible/editable por los
// profesionales que estén expresamente asignados a él como terapeutas.
// Esto anula, SOLO para ese paciente, el acceso general que normalmente
// tiene cualquier "therapist" a todos los pacientes, y también anula el
// acceso colaborativo de Centro de día. Pensado para casos puntuales de
// protección de datos (ej. Eduardo), no para uso general.
export async function isPatientRestricted(patientId: string): Promise<boolean> {
  const p = await db.patient.findUnique({
    where: { id: patientId },
    select: { restricted: true },
  });
  return !!p?.restricted;
}

async function isAssignedTherapist(profId: string, patientId: string): Promise<boolean> {
  const link = await db.patient.findFirst({
    where: { id: patientId, therapists: { some: { id: profId } } },
    select: { id: true },
  });
  return !!link;
}

export async function canEditPatient(prof: ProfessionalDTO, patientId: string): Promise<boolean> {
  if (prof.userRole === "admin") return true;
  return isAssignedTherapist(prof.id, patientId);
}

export async function canEditClinical(prof: ProfessionalDTO, patientId: string): Promise<boolean> {
  if (prof.userRole === "admin") return false;
  if (await isPatientRestricted(patientId)) return isAssignedTherapist(prof.id, patientId);
  if (await isDayCenterPatient(patientId)) return true;
  return isAssignedTherapist(prof.id, patientId);
}

export async function canViewClinical(prof: ProfessionalDTO, patientId: string): Promise<boolean> {
  if (prof.userRole === "admin") return false;
  if (await isPatientRestricted(patientId)) return isAssignedTherapist(prof.id, patientId);
  if (prof.userRole === "therapist") return true;
  if (await isDayCenterPatient(patientId)) return true;
  return isAssignedTherapist(prof.id, patientId);
}

export async function canViewPatient(prof: ProfessionalDTO, patientId: string): Promise<boolean> {
  if (prof.userRole === "admin") return true;
  if (await isPatientRestricted(patientId)) return isAssignedTherapist(prof.id, patientId);
  if (prof.userRole !== "guest") return true;
  if (await isDayCenterPatient(patientId)) return true;
  return isAssignedTherapist(prof.id, patientId);
}

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
    console.error("[audit] failed to write log:", err);
  }
}

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

export function calcAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

type PatientWithRels = Prisma.PatientGetPayload<{
  include: {
    therapists: { select: { id: true; name: true } };
    _count: { select: { visits: true } };
  };
}>;

export function buildResourceFilter(resource: string | null | undefined): Prisma.PatientWhereInput {
  if (!resource) return {};
  const isDefaultResource = RESOURCES[0]?.key === resource;
  return isDefaultResource ? { OR: [{ resource }, { resource: null }] } : { resource };
}

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
    resource: p.resource,
    emCategory: p.emCategory,
    phone: p.phone,
    address: p.address,
    diagnosis: p.diagnosis,
    objective: p.objective,
    alerts: p.alerts,
    startDate: p.startDate.toISOString(),
    referentName: p.referentName,
    referentPhone: p.referentPhone,
    referent: p.referent,
    careTeamReferent: p.careTeamReferent,
    color: p.color,
    quickNotes: p.quickNotes ?? null,
    restricted: (p as any).restricted ?? false,
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
    goalIds: JSON.parse(v.goalIds || "[]") as string[],
    gasScores: JSON.parse(v.gasScores || "{}") as Record<string, number>,
    tasks: JSON.parse(v.tasks || "[]") as { id: string; text: string; completed: boolean }[],
    kind: (v.kind ?? "seguimiento") as "seguimiento" | "intervencion",
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
    inventoryData: a.inventoryData ?? null,
    notes: a.notes,
    date: a.date.toISOString(),
  };
}

type AppointmentWithRels = Prisma.AppointmentGetPayload<{
  include: {
    patient: { select: { firstName: true; lastName: true; color: true; address: true; resource: true } };
    therapist: { select: { name: true } };
  };
}>;

export function mapAppointment(a: AppointmentWithRels) {
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: `${a.patient.firstName} ${a.patient.lastName}`,
    patientColor: a.patient.color,
    patientResource: a.patient.resource,
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

export function safePartial<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as Partial<T>;
}
