// /api/billing — aggregated billing for the current month (or any month)
// Admin sees all therapists. Therapist/guest only sees their own billing.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional } from "@/lib/server";
import { isBillableResource } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const prof = await requireProfessional();
  const url = new URL(req.url);
  const yearStr = url.searchParams.get("year");
  const monthStr = url.searchParams.get("month");

  const now = new Date();
  const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
  const month = monthStr ? parseInt(monthStr, 10) - 1 : now.getMonth();

  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);

  const PRICE: Record<string, number> = {
    Sesión: 60,
    Valoración: 90,
    Seguimiento: 60,
    Coordinación: 35,
  };

  // Admin sees all; therapist/guest only see their own
  const therapistFilter =
    prof.userRole === "admin" ? {} : { therapistId: prof.id };

  const appointments = await db.appointment.findMany({
    where: { start: { gte: from, lt: to }, status: { not: "cancelada" }, ...therapistFilter },
    include: {
      patient: { select: { firstName: true, lastName: true, specialty: true, resource: true } },
      therapist: { select: { name: true } },
    },
    orderBy: { start: "asc" },
  });

  interface BillingLine {
    id: string;
    date: string;
    patientName: string;
    specialty: string;
    therapistName: string;
    type: string;
    amount: number;
    durationMin: number;
  }

  // Patients from a non-billable resource (e.g. "Asociación EM") are
  // scheduled and seen like anyone else, but their sessions must NOT be
  // counted toward billing. Split them out here instead of at display
  // time, so the totals/averages below are never computed from them.
  const billableAppts = appointments.filter((a) => isBillableResource(a.patient.resource));
  const excludedAppts = appointments.filter((a) => !isBillableResource(a.patient.resource));

  const lines: BillingLine[] = billableAppts.map((a) => ({
    id: a.id,
    date: a.start.toISOString(),
    patientName: `${a.patient.firstName} ${a.patient.lastName}`,
    specialty: a.patient.specialty,
    therapistName: a.therapist.name,
    type: a.type,
    amount: PRICE[a.type] ?? 60,
    durationMin: a.durationMin,
  }));

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const byTherapist: Record<string, { count: number; amount: number }> = {};
  for (const l of lines) {
    byTherapist[l.therapistName] ??= { count: 0, amount: 0 };
    byTherapist[l.therapistName].count += 1;
    byTherapist[l.therapistName].amount += l.amount;
  }

  return NextResponse.json({
    period: { year, month: month + 1 },
    total,
    count: lines.length,
    byTherapist: Object.entries(byTherapist).map(([name, v]) => ({ name, ...v })),
    lines,
    // Sessions that happened but are excluded from billing on purpose
    // (non-billable resource, e.g. Asociación EM) — shown as an
    // informational count, not folded into the totals above.
    excludedCount: excludedAppts.length,
    isFiltered: prof.userRole !== "admin",
    therapistName: prof.userRole !== "admin" ? prof.name : null,
  });
}
