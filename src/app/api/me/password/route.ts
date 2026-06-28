// PATCH /api/me/password — change the current professional's own password
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireProfessional, audit } from "@/lib/server";
import { changePasswordSchema } from "@/lib/schemas";

export async function PATCH(req: NextRequest) {
  const prof = await requireProfessional();
  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // passwordHash never goes into ProfessionalDTO, so fetch it directly here
  // rather than trusting anything the client sent about the current user.
  const row = await db.professional.findUnique({
    where: { id: prof.id },
    select: { passwordHash: true },
  });
  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const matches = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
  if (!matches) {
    return NextResponse.json(
      { error: "VALIDATION", issues: { currentPassword: ["La contraseña actual no es correcta"] } },
      { status: 400 },
    );
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.professional.update({
    where: { id: prof.id },
    data: { passwordHash: newHash },
  });
  await audit(prof.id, "professional.changePassword", "Professional", prof.id);
  return NextResponse.json({ ok: true });
}
