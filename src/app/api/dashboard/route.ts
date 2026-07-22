// /api/dashboard — KPIs for the current professional
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, buildResourceFilter } from "@/lib/server";

export async function GET(req: NextRequest) {
  const prof = await requireProfessional();
  const resource = new URL(req.url).searchParams.get("resource");
  const resourceFilter = buildResourceFilter(resource);
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Scope filters: admin sees everything, others only their own data —
  // plus, everyone is scoped to the currently active centro/recurso so
  // patients from different centers never mix in these counts.
  const isAdmin = prof.userRole === "admin";
  const apptFilter = { ...(isAdmin ? {} : { therapistId: prof.id }), patient: resourceFilter };
  const visitFilter = { ...(isAdmin ? {} : { therapistId: prof.id }), patient: resourceFilter };
  const patientFilter = {
    ...(isAdmin
      ? {}
      : prof.userRole === "therapist"
        ? {} // therapists see all patients in the list anyway
        : { therapists: { some: { id: prof.id } } }), // guests: only assigned
    ...resourceFilter,
  };

  const [
    totalPatients,
    activePatients,
    todayAppointments,
    weekAppointments,
    recentVisits,
    bySpecialty,
    byStatus,
  ] = await Promise.all([
    db.patient.count({ where: patientFilter }),
    db.patient.count({ where: { ...patientFilter, status: "Activo" } }),
    db.appointment.count({
      where: { start: { gte: startOfDay, lte: endOfDay }, status: "programada", ...apptFilter },
    }),
    db.appointment.count({
      where: { start: { gte: startOfWeek, lte: endOfWeek }, status: "programada", ...apptFilter },
    }),
    db.visit.count({
      where: { date: { gte: new Date(Date.now() - 30 * 86400000) }, ...visitFilter },
    }),
    db.patient.groupBy({ by: ["specialty"], where: patientFilter, _count: true }),
    db.patient.groupBy({ by: ["status"], where: patientFilter, _count: true }),
  ]);

  return NextResponse.json({
    professional: { id: prof.id, name: prof.name, role: prof.role, isAdmin: prof.isAdmin },
    totals: {
      patients: totalPatients,
      activePatients,
      todayAppointments,
      weekAppointments,
      recentVisits,
    },
    bySpecialty: bySpecialty.map((s) => ({ label: s.specialty, value: s._count })),
    byStatus: byStatus.map((s) => ({ label: s.status, value: s._count })),
  });
}
