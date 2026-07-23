// /api/patients/[id]/gas-assessments — list & create formal GAS assessments
//
// GET  → all GAS assessments for this patient's goals (grouped by goal)
// POST → create a batch of assessments (one per goal, same date)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id: patientId } = await params;

  try {
    // Find the patient's occupational profile to get goal ids
    const profile = await db.occupationalProfile.findUnique({
      where: { patientId },
      select: { id: true, goals: { select: { id: true }, orderBy: { createdAt: "asc" } } },
    });

    if (!profile) {
      return NextResponse.json([]);
    }

    const goalIds = profile.goals.map((g) => g.id);

    const assessments = await db.gasAssessment.findMany({
      where: { goalId: { in: goalIds } },
      orderBy: { date: "asc" },
    });

    await audit(prof.id, "gas_assessment.list", "Patient", patientId);

    return NextResponse.json(assessments);
  } catch (e: any) {
    console.error("gas-assessments GET error:", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id: patientId } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  try {
    // body = { date: "YYYY-MM-DD", entries: [{ goalId, score, notes? }] }
    const { date, entries } = body;

    if (!date || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "INVALID_INPUT", message: "Se requiere date y entries[]." },
        { status: 400 },
      );
    }

    // Validate all goalIds belong to this patient
    const profile = await db.occupationalProfile.findUnique({
      where: { patientId },
      select: { goals: { select: { id: true } } },
    });
    const validIds = new Set(profile?.goals.map((g) => g.id) ?? []);
    for (const entry of entries) {
      if (!validIds.has(entry.goalId)) {
        return NextResponse.json(
          { error: "INVALID_GOAL", message: `El objetivo ${entry.goalId} no pertenece a este paciente.` },
          { status: 400 },
        );
      }
      const s = Number(entry.score);
      if (![-2, -1, 0, 1, 2].includes(s)) {
        return NextResponse.json(
          { error: "INVALID_SCORE", message: "La puntuación debe ser -2, -1, 0, 1 o 2." },
          { status: 400 },
        );
      }
    }

    // Create all assessments in a transaction
    const created = await db.$transaction(
      entries.map((entry: { goalId: string; score: number; notes?: string }) =>
        db.gasAssessment.create({
          data: {
            goalId: entry.goalId,
            date: new Date(date),
            score: Number(entry.score),
            notes: entry.notes?.trim() || null,
          },
        }),
      ),
    );

    await audit(prof.id, "gas_assessment.create", "Patient", patientId, {
      count: created.length,
      date,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    console.error("gas-assessments POST error:", e);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}
