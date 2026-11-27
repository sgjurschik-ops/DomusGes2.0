// Utilidades compartidas por las rutas de /api/patients/[id]/evaluations.
// (No es una ruta: Next.js solo trata como endpoint los archivos route.ts.)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { PatientEvaluationDTO } from "@/lib/evaluations";

export const EVALUATION_INCLUDE = {
  author: { select: { name: true, role: true } },
} as const;

type EvaluationRow = {
  id: string;
  patientId: string;
  authorId: string;
  date: Date;
  generalData: string;
  adl: string;
  iadl: string;
  physical: string;
  routines: string;
  other: string;
  updatedById: string | null;
  updatedAt: Date;
  author: { name: string; role: string };
};

export async function mapEvaluation(row: EvaluationRow): Promise<PatientEvaluationDTO> {
  let updatedByName: string | null = null;
  if (row.updatedById) {
    const editor = await db.professional.findUnique({
      where: { id: row.updatedById },
      select: { name: true },
    });
    updatedByName = editor?.name ?? null;
  }
  return {
    id: row.id,
    patientId: row.patientId,
    date: row.date.toISOString().slice(0, 10),
    authorId: row.authorId,
    authorName: row.author.name,
    profession: row.author.role,
    updatedByName,
    updatedAt: row.updatedAt.toISOString(),
    generalData: row.generalData,
    adl: row.adl,
    iadl: row.iadl,
    physical: row.physical,
    routines: row.routines,
    other: row.other,
  };
}

// "YYYY-MM-DD" → Date a medianoche UTC (mismo criterio que las escalas), o
// null si no es una fecha válida.
export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

// Errores: sesión caducada → 401; cualquier otro → 500 con el detalle real
// (para ver la causa exacta en vez de un error genérico).
export function errorResponse(tag: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "SERVER_ERROR", detail: message }, { status: 500 });
}
