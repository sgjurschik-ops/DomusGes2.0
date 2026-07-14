// /api/patients/[id]/occupational-profile — get & save occupational profile

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  const profile = await db.occupationalProfile.findUnique({
    where: { patientId: id },
    include: { goals: { orderBy: { createdAt: "asc" } } },
  });

  await audit(prof.id, "occupational_profile.view", "OccupationalProfile", id);

  return NextResponse.json(profile ?? null);
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  // `goals` is a relation, not a scalar column — it can't be spread into
  // create/update like the rest of the (intentionally loose) body. The
  // form always sends the complete current list, so the simplest correct
  // approach is to replace the set entirely rather than diff it.
  const { goals, ...scalarFields } = body;

  const profile = await db.occupationalProfile.upsert({
    where: { patientId: id },
    create: {
      patientId: id,
      ...scalarFields,
    },
    update: {
      ...scalarFields,
    },
  });

  if (Array.isArray(goals)) {
    await db.occupationalGoal.deleteMany({ where: { occupationalProfileId: profile.id } });
    if (goals.length > 0) {
      await db.occupationalGoal.createMany({
        data: goals.map((g: any) => ({
          occupationalProfileId: profile.id,
          text: g.text ?? "",
          area: g.area ?? "Cuidado de sí mismo",
          status: g.status ?? "En curso",
          startDate: g.startDate ? new Date(g.startDate) : null,
          targetDate: g.targetDate ? new Date(g.targetDate) : null,
          evaluation: g.evaluation ?? "",
        })),
      });
    }
  }

  const withGoals = await db.occupationalProfile.findUnique({
    where: { id: profile.id },
    include: { goals: { orderBy: { createdAt: "asc" } } },
  });

  await audit(prof.id, "occupational_profile.upsert", "OccupationalProfile", profile.id);

  return NextResponse.json(withGoals);
}