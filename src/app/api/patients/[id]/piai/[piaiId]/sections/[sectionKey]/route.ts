// PUT /api/patients/[id]/piai/[piaiId]/sections/[sectionKey]
// Guarda el apartado de UNA profesión dentro del PIAI. Solo puede hacerlo
// un/a profesional de esa profesión (p. ej. Fisioterapia → "fisioterapia").
// Body: { content }.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireProfessional, canEditClinical, audit } from "@/lib/server";
import { piaiSectionDef } from "@/lib/piai";
import { mapPiai, PIAI_INCLUDE, errorResponse, cleanSectionContent } from "../../../shared";

type Ctx = { params: Promise<{ id: string; piaiId: string; sectionKey: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const prof = await requireProfessional();
    const { id: patientId, piaiId, sectionKey } = await params;
    const def = piaiSectionDef(sectionKey);
    if (!def) return NextResponse.json({ error: "NOT_FOUND", detail: "Apartado desconocido" }, { status: 404 });
    if (!(await canEditClinical(prof, patientId))) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (prof.role !== def.role) {
      return NextResponse.json({ error: "FORBIDDEN", detail: `Solo un/a profesional de ${def.title} puede editar este apartado` }, { status: 403 });
    }
    const existing = await db.piai.findFirst({ where: { id: piaiId, patientId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const content = JSON.stringify(cleanSectionContent(sectionKey, body?.content));
    await db.piaiSection.upsert({
      where: { piaiId_sectionKey: { piaiId, sectionKey } },
      create: { piaiId, sectionKey, content, updatedById: prof.id },
      update: { content, updatedById: prof.id },
    });
    const row = await db.piai.findUnique({ where: { id: piaiId }, include: PIAI_INCLUDE });
    await audit(prof.id, "piai.section.update", "Piai", piaiId, { patientId, sectionKey });
    return NextResponse.json(await mapPiai(row!));
  } catch (err) {
    return errorResponse("piai section PUT", err);
  }
}
