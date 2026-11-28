// GET /api/patients/[id]/care-guide — guía de cuidados vigente del/de la
//      usuario/a (o vacía si aún no se ha rellenado). La ve todo el equipo.
// PUT /api/patients/[id]/care-guide — guarda la guía completa. Body: { data }.
// Solo para usuarios/as de Centro de día.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, canViewClinical, canEditClinical, isDayCenterPatient, audit } from "@/lib/server";
import { cleanCareGuide, parseCareGuide, type CareGuideDTO } from "@/lib/care-guide";

type Ctx = { params: Promise<{ id: string }> };

function errorResponse(tag: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "SERVER_ERROR", detail: message }, { status: 500 });
}

async function load(patientId: string): Promise<CareGuideDTO> {
  const row = await db.careGuide.findUnique({
    where: { patientId },
    include: { updatedBy: { select: { name: true } } },
  });
  return {
    data: parseCareGuide(row?.data),
    updatedAt: row?.updatedAt.toISOString() ?? null,
    updatedByName: row?.updatedBy?.name ?? null,
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId } = await params;
    if (!(await canViewClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json(await load(patientId));
  } catch (err) {
    return errorResponse("care-guide GET", err);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId } = await params;
    if (!(await canEditClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (!(await isDayCenterPatient(patientId))) {
      return NextResponse.json({ error: "VALIDATION", detail: "La guía de cuidados es solo para usuarios/as de Centro de día" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const data = JSON.stringify(cleanCareGuide(body?.data));
    await db.careGuide.upsert({
      where: { patientId },
      create: { patientId, data, updatedById: prof.id },
      update: { data, updatedById: prof.id },
    });
    await audit(prof.id, "care_guide.update", "CareGuide", patientId, { patientId });
    return NextResponse.json(await load(patientId));
  } catch (err) {
    return errorResponse("care-guide PUT", err);
  }
}
