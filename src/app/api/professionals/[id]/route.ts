// /api/professionals/[id] — update (admin), toggle active (admin), delete (admin)
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/server";
import { professionalUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await req.json();

  // Support two shapes: full professional update, or password-only reset.
  if (typeof body === "object" && body !== null && "password" in body && typeof body.password === "string") {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "PASSWORD_TOO_SHORT" }, { status: 400 });
    }
    await db.professional.update({
      where: { id },
      data: { passwordHash: bcrypt.hashSync(body.password, 10) },
    });
    await audit(admin.id, "professional.password_reset", "Professional", id);
    return NextResponse.json({ ok: true });
  }

  const parsed = professionalUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const row = await db.professional.update({
    where: { id },
    data: {
      name: d.name,
      email: d.email.toLowerCase(),
      role: d.role,
      numColegiado: d.numColegiado || null,
      phone: d.phone || null,
      color: d.color,
      isActive: d.isActive,
      isAdmin: d.userRole === "admin",
      userRole: d.userRole,
    },
    select: {
      id: true, email: true, name: true, role: true, numColegiado: true,
      phone: true, isActive: true, isAdmin: true, userRole: true, color: true, joinedAt: true,
    },
  });
  await audit(admin.id, "professional.update", "Professional", id, { name: row.name });
  return NextResponse.json(row);
}
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  const { id } = await params;

  if (id === admin.id) {
    return NextResponse.json(
      { error: "CANNOT_DELETE_SELF", message: "No puedes eliminar tu propia cuenta." },
      { status: 400 },
    );
  }

  await db.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { professionalId: id } });
    await tx.appointment.deleteMany({ where: { therapistId: id } });
    await tx.assessment.deleteMany({ where: { therapistId: id } });
    await tx.visit.deleteMany({ where: { therapistId: id } });

    await tx.professional.update({
      where: { id },
      data: {
        patients: { set: [] },
      },
    });

    await tx.professional.delete({ where: { id } });
  });

  await audit(admin.id, "professional.delete", "Professional", id);

  return NextResponse.json({ ok: true });
}
