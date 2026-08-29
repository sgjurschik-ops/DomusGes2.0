// GET  /api/patients/[id]/quick-notes — lista las notas rápidas del profesional
//       de la sesión para este/a usuario/a (PRIVADAS: solo las suyas).
// POST /api/patients/[id]/quick-notes — crea una nota privada del profesional
//       de la sesión.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id: patientId } = await params;

  // PRIVACIDAD: se filtra SIEMPRE por el profesional de la sesión en el
  // servidor, no solo se oculta en la interfaz. Cada profesional (incluido
  // admin) solo ve las notas que él mismo ha creado.
  const notes = await db.quickNote.findMany({
    where: { patientId, professionalId: prof.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, colorIdx: true },
  });

  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const prof = await requireProfessional();
  const { id: patientId } = await params;
  const body = await req.json().catch(() => ({}));

  const note = await db.quickNote.create({
    data: {
      patientId,
      professionalId: prof.id,
      text: typeof body.text === "string" ? body.text : "",
      colorIdx: Number.isInteger(body.colorIdx) ? body.colorIdx : 0,
    },
    select: { id: true, text: true, colorIdx: true },
  });

  return NextResponse.json(note, { status: 201 });
}
