// /api/assessments — list & create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapAssessment, canViewClinical, canEditClinical } from "@/lib/server";
import { assessmentCreateSchema } from "@/lib/schemas";
import { generateAreaSummaryData } from "@/lib/scales";

export async function GET(req: NextRequest) {
  const prof = await requireProfessional();
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");

  if (patientId) {
    if (!(await canViewClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const where: Record<string, unknown> = patientId
    ? { patientId }
    : prof.userRole === "guest"
      ? { therapistId: prof.id }
      : prof.userRole !== "admin"
        ? { patient: { OR: [{ restricted: false }, { therapists: { some: { id: prof.id } } }] } }
        : {};

  const rows = await db.assessment.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: patientId ? 200 : 50,
  });
  if (patientId) await audit(prof.id, "assessment.list", "Patient", patientId);
  return NextResponse.json(rows.map(mapAssessment));
}

export async function POST(req: NextRequest) {
  const prof = await requireProfessional();
  const body = await req.json();
  const parsed = assessmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  if (!(await canEditClinical(prof, d.patientId))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // COPM sends its own areaSummary (problem names); other structured scales
  // compute it from item scores (strengths/areas-to-work-on).
  const areaSummaryData = d.areaSummary
    ? d.areaSummary
    : d.itemScores
      ? generateAreaSummaryData(d.scale, d.itemScores)
      : null;
  const row = await db.assessment.create({
    data: {
      patientId: d.patientId,
      // El autor es SIEMPRE quien está creando la valoración, nunca un id
      // que venga del formulario (antes se usaba el primer terapeuta
      // asignado al paciente, atribuyendo mal la autoría).
      therapistId: prof.id,
      scale: d.scale,
      score: d.score,
      itemScores: d.itemScores ? JSON.stringify(d.itemScores) : null,
      areaSummary: areaSummaryData ? JSON.stringify(areaSummaryData) : null,
      inventoryData: d.inventoryData ?? null,
      notes: d.notes || null,
      date: new Date(d.date),
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
  });
  await audit(prof.id, "assessment.create", "Assessment", row.id, { patientId: row.patientId });
  return NextResponse.json(mapAssessment(row), { status: 201 });
}
