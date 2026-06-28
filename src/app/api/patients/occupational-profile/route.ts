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

  const profile = await db.occupationalProfile.upsert({
    where: { patientId: id },
    create: {
      patientId: id,
      ...body,
    },
    update: {
      ...body,
    },
  });

  await audit(prof.id, "occupational_profile.upsert", "OccupationalProfile", profile.id);

  return NextResponse.json(profile);
}