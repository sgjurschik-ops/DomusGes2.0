// /api/billing — aggregated billing for the current month (or any month)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional } from "@/lib/server";

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

  const appointments = await db.appointment.findMany({
    where: { start: { gte: from, lt: to }, status: { not: "cancelada" } },
    include: {
      patient: { select: { firstName: true, lastName: true, specialty: true } },
      therapist: { select: { name: true } },
    },
    orderBy: { start: "asc" },
  });

  const lines = appointments.map((a) => ({
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
  const byTherapist = lines.reduce<Record<string, { count: number; amount: number }>>((acc, l) => {
    acc[l.therapistName] ??= { count: 0, amount: 0 };
    acc[l.therapistName].count += 1;
    acc[l.therapistName].amount += l.amount;
    return acc;
  }, {});

  return NextResponse.json({
    period: { year, month: month + 1 },
    total,
    count: lines.length,
    byTherapist: Object.entries(byTherapist).map(([name, v]) => ({ name, ...v })),
    lines,
  });
}
