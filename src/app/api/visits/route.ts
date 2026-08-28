// /api/visits — list & create
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, audit, mapVisit, buildMadridDateTime, isDayCenterPatient } from "@/lib/server";
import { visitCreateSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const prof = await requireProfessional();
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  const kindParam = url.searchParams.get("kind");
  const kind = kindParam === "intervencion" ? "intervencion" : "seguimiento";

  // Build base filter
  const where: Record<string, unknown> = { kind };
  if (patientId) where.patientId = patientId;

  if (kind === "intervencion") {
    // PRIVACIDAD: las intervenciones son privadas del profesional autor.
    // Cada profesional (incluido admin) solo ve las suyas. Esto se fuerza
    // SIEMPRE en el servidor, no solo se oculta en la interfaz.
    where.therapistId = prof.id;
  } else if (prof.userRole === "guest") {
    // Seguimientos (compartidos): el invitado solo ve los de sus usuarios/as,
    // salvo en Centro de día, donde son colaborativos y los ve todos.
    const dayCenter = patientId ? await isDayCenterPatient(patientId) : false;
    if (!dayCenter) where.therapistId = prof.id;
  }

  const rows = await db.visit.findMany({
    where,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: patientId ? 200 : 50,
  });
  if (patientId) await audit(prof.id, "visit.list", "Patient", patientId);
  return NextResponse.json(rows.map(mapVisit));
}

export async function POST(req: NextRequest) {
  const prof = await requireProfessional();
  const body = await req.json();
  const parsed = visitCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const date = buildMadridDateTime(d.date, d.time);
  // Para intervenciones (privadas) el autor es SIEMPRE el profesional de la
  // sesión: no se puede crear una intervención privada a nombre de otra persona.
  const therapistId = d.kind === "intervencion" ? prof.id : d.therapistId;
  const row = await db.visit.create({
    data: {
      patientId: d.patientId,
      therapistId,
      date,
      durationMin: d.durationMin,
      title: d.title,
      notes: d.notes,
      interventions: JSON.stringify(d.interventions),
      goalIds: JSON.stringify(d.goalIds ?? []),
      gasScores: JSON.stringify(d.gasScores ?? {}),
      tasks: JSON.stringify(d.tasks ?? []),
      kind: d.kind,
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      therapist: { select: { name: true } },
    },
  });
  await audit(prof.id, "visit.create", "Visit", row.id, { patientId: row.patientId, kind: row.kind });
  return NextResponse.json(mapVisit(row), { status: 201 });
}
