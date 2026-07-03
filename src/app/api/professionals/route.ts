// /api/professionals — list & create (admin only for create)
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireProfessional, requireAdmin, audit } from "@/lib/server";
import { professionalCreateSchema } from "@/lib/schemas";

export async function GET() {
  const prof = await requireProfessional();
  const rows = await db.professional.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, email: true, name: true, role: true, numColegiado: true,
      phone: true, isActive: true, isAdmin: true, color: true, joinedAt: true,
    },
  });
  await audit(prof.id, "professional.list", "Professional", null);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  const body = await req.json();
  const parsed = professionalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const exists = await db.professional.findUnique({ where: { email: d.email.toLowerCase() } });
  if (exists) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }
  const row = await db.professional.create({
    data: {
      email: d.email.toLowerCase(),
      name: d.name,
      role: d.role,
      numColegiado: d.numColegiado || null,
      phone: d.phone || null,
      passwordHash: bcrypt.hashSync(d.password, 10),
      isAdmin: d.userRole === "admin",
      userRole: d.userRole,
      color: d.color,
    },
    select: {
      id: true, email: true, name: true, role: true, numColegiado: true,
      phone: true, isActive: true, isAdmin: true, userRole: true, color: true, joinedAt: true,
    },
  });
  await audit(admin.id, "professional.create", "Professional", row.id, { name: row.name });
  return NextResponse.json(row, { status: 201 });
}
