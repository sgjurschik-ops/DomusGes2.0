// /api/patients/[id]/gas-assessments/[assessmentId] — delete a formal GAS assessment

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit } from "@/lib/server";

type Ctx = { params: Promise<{ id: string; assessmentId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id: patientId, assessmentId } = await params;

  try {
    // Verify the assessment belongs to a goal of this patient
    const assessment = await db.gasAssessment.findUnique({
      where: { id: assessmentId },
      include: { goal: { include: { occupationalProfile: { select: { patientId: true } } } } },
    });

    if (!assessment || assessment.goal.occupationalProfile.patientId !== patientId) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    await db.gasAssessment.delete({ where: { id: assessmentId } });

    await audit(prof.id, "gas_assessment.delete", "GasAssessment", assessmentId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("gas-assessment DELETE error:", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
