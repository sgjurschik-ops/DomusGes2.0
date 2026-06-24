// Server-side helpers: current user, requireAdmin, audit log.
// All API routes should call these instead of trusting the client.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ProfessionalDTO } from "@/types/domain";
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

// ─── Mappers (Prisma row → DTO) ─────────────────────────────────────────────

export function calcAge(birthDate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

type PatientWithRels = Prisma.PatientGetPayload<{
  include: {
    therapists: { select: { id: true; name: true } };
    visits: { select: { date: true }; orderBy: { date: "desc" }; take: 1 };
    appointments: {
      where: { start: { gt: Date } };
      select: { start: true };
      orderBy: { start: "asc" };
      take: 1;
    };
    _count: { select: { visits: true } };
  };
}>;

export function mapPatient(p: PatientWithRels) {
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
    lastVisitDate: p.visits[0]?.date.toISOString() ?? null,
    nextAppointmentDate: p.appointments[0]?.start.toISOString() ?? null,
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
