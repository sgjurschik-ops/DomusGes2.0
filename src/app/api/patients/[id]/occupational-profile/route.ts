// /api/patients/[id]/occupational-profile — get & save occupational profile

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, safePartial } from "@/lib/server";

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

  // `goals` is a relation, not a scalar column — handled separately below.
  // Only include scalar fields that were explicitly sent (not undefined),
  // so partial saves (e.g. from a single section) don't wipe other sections.
  const { goals, id: _id, patientId: _pid, createdAt: _ca, updatedAt: _ua, ...rawFields } = body;
  const scalarFields = safePartial(rawFields);

  const profile = await db.occupationalProfile.upsert({
    where: { patientId: id },
    create: { patientId: id, ...scalarFields },
    update: scalarFields,
  });

  if (Array.isArray(goals)) {
    // IMPORTANT: goal ids are referenced elsewhere (Visit.goalIds). The
    // previous implementation deleted every goal and recreated them from
    // scratch on every save, which handed out a brand-new id to every goal
    // — even unchanged ones — silently breaking any visit that referenced
    // the old id. Now we update existing goals in place (keeping their id),
    // only create genuinely new ones, and only delete ones the person
    // actually removed.
    const existing = await db.occupationalGoal.findMany({
      where: { occupationalProfileId: profile.id },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((g) => g.id));
    const incomingIds = new Set(
      goals.filter((g: any) => g.id && existingIds.has(g.id)).map((g: any) => g.id),
    );

    const toDelete = [...existingIds].filter((gid) => !incomingIds.has(gid));
    if (toDelete.length > 0) {
      await db.occupationalGoal.deleteMany({ where: { id: { in: toDelete } } });
    }

    for (const g of goals) {
      const data = {
        text: g.text ?? "",
        area: g.area ?? "",
        scope: g.scope ?? "Con el paciente",
        status: g.status ?? "En curso",
        specificGoals: typeof g.specificGoals === "string" ? g.specificGoals : JSON.stringify(g.specificGoals ?? []),
        startDate: g.startDate ? new Date(g.startDate) : null,
        targetDate: g.targetDate ? new Date(g.targetDate) : null,
        evaluation: g.evaluation ?? "",
      };
      if (g.id && existingIds.has(g.id)) {
        await db.occupationalGoal.update({ where: { id: g.id }, data });
      } else {
        await db.occupationalGoal.create({ data: { occupationalProfileId: profile.id, ...data } });
      }
    }
  }

  const withGoals = await db.occupationalProfile.findUnique({
    where: { id: profile.id },
    include: { goals: { orderBy: { createdAt: "asc" } } },
  });

  await audit(prof.id, "occupational_profile.upsert", "OccupationalProfile", profile.id);

  return NextResponse.json(withGoals);
}