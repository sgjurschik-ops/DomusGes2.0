// PATCH  /api/patients/[id]/quick-notes/[noteId] — edita texto/color de una nota.
// DELETE /api/patients/[id]/quick-notes/[noteId] — borra una nota.
// En ambos casos SOLO el profesional autor puede hacerlo (comprobado en servidor).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional } from "@/lib/server";

type Ctx = { params: Promise<{ id: string; noteId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { noteId } = await params;

  const existing = await db.quickNote.findUnique({
    where: { id: noteId },
    select: { professionalId: true },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  // PRIVACIDAD: solo el autor puede modificar su nota.
  if (existing.professionalId !== prof.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: { text?: string; colorIdx?: number } = {};
  if (typeof body.text === "string") data.text = body.text;
  if (Number.isInteger(body.colorIdx)) data.colorIdx = body.colorIdx;

  const note = await db.quickNote.update({
    where: { id: noteId },
    data,
    select: { id: true, text: true, colorIdx: true },
  });

  return NextResponse.json(note);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { noteId } = await params;

  const existing = await db.quickNote.findUnique({
    where: { id: noteId },
    select: { professionalId: true },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (existing.professionalId !== prof.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  await db.quickNote.delete({ where: { id: noteId } });
  return NextResponse.json({ ok: true });
}
