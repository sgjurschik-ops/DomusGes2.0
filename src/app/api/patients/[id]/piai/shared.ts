// Utilidades compartidas por las rutas de /api/patients/[id]/piai.
// (No es una ruta: Next.js solo trata como endpoint los archivos route.ts.)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  PIAI_GENERAL_FIELDS,
  PIAI_SECTIONS,
  PIAI_STATUSES,
  PIAI_REVIEW_RESULTS,
  safeJsonObject,
  type PiaiDTO,
  type PiaiGeneral,
  type PiaiGeneralObjective,
  type PiaiReview,
  type PiaiSectionContent,
} from "@/lib/piai";

export const PIAI_INCLUDE = {
  createdBy: { select: { name: true } },
  sections: true,
} as const;

type PiaiRow = {
  id: string;
  patientId: string;
  date: Date;
  status: string;
  createdById: string;
  general: string;
  generalObjectives: string;
  reviews: string;
  updatedAt: Date;
  updatedById: string | null;
  createdBy: { name: string };
  sections: { sectionKey: string; content: string; updatedById: string | null; updatedAt: Date }[];
};

export async function mapPiai(row: PiaiRow): Promise<PiaiDTO> {
  const editorIds = [...new Set([row.updatedById, ...row.sections.map((s) => s.updatedById)].filter((x): x is string => !!x))];
  const editors = editorIds.length
    ? await db.professional.findMany({ where: { id: { in: editorIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map<string, string>(editors.map((e: { id: string; name: string }) => [e.id, e.name] as [string, string]));
  const sections: PiaiDTO["sections"] = {};
  for (const s of row.sections) {
    sections[s.sectionKey] = {
      content: safeJsonObject<PiaiSectionContent>(s.content, {}),
      updatedByName: s.updatedById ? nameById.get(s.updatedById) ?? null : null,
      updatedAt: s.updatedAt.toISOString(),
    };
  }
  // Última modificación: la más reciente entre la parte común y los apartados.
  let lastEditedAt = row.updatedAt;
  let lastEditedById = row.updatedById;
  for (const s of row.sections) {
    if (s.updatedAt > lastEditedAt) { lastEditedAt = s.updatedAt; lastEditedById = s.updatedById; }
  }
  return {
    id: row.id,
    patientId: row.patientId,
    lastEditedAt: lastEditedAt.toISOString(),
    lastEditedByName: lastEditedById ? nameById.get(lastEditedById) ?? null : null,
    date: row.date.toISOString().slice(0, 10),
    status: row.status,
    createdById: row.createdById,
    createdByName: row.createdBy.name,
    updatedAt: row.updatedAt.toISOString(),
    general: safeJsonObject<PiaiGeneral>(row.general, {}),
    generalObjectives: safeJsonObject<PiaiGeneralObjective[]>(row.generalObjectives, []),
    // Siempre normalizadas: convierte revisiones guardadas con el formato antiguo.
    reviews: cleanReviews(safeJsonObject<unknown[]>(row.reviews, [])),
    sections,
  };
}

export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function errorResponse(tag: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  console.error(`[${tag}]`, err);
  return NextResponse.json({ error: "SERVER_ERROR", detail: message }, { status: 500 });
}

// ─── Saneado de lo que llega del navegador ───────────────────────────────────

const str = (v: unknown, max = 20000) => (typeof v === "string" ? v.slice(0, max) : undefined);
const strArray = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => (x as string).slice(0, 2000)) : []);

export function cleanGeneral(v: unknown): PiaiGeneral {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: PiaiGeneral = {};
  for (const f of PIAI_GENERAL_FIELDS) {
    const val = str(o[f.key], 2000);
    if (val !== undefined) out[f.key] = val;
  }
  const description = str(o.description);
  if (description !== undefined) out.description = description;
  const acceptanceDate = str(o.acceptanceDate, 20);
  if (acceptanceDate !== undefined) out.acceptanceDate = acceptanceDate;
  const acceptanceNotes = str(o.acceptanceNotes, 2000);
  if (acceptanceNotes !== undefined) out.acceptanceNotes = acceptanceNotes;
  return out;
}

export function cleanGeneralObjectives(v: unknown): PiaiGeneralObjective[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 30).map((o, i) => {
    const x = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
    return { id: str(x.id, 60) || `go-${i}`, text: str(x.text, 2000) ?? "", actions: strArray(x.actions).slice(0, 20) };
  });
}

export function cleanReviews(v: unknown): PiaiReview[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 40).map((r, i) => {
    const x = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    // Formato antiguo (objetivos con acciones): se convierte a la lista de
    // objetivos revisados, sin resultado marcado.
    const rawItems = Array.isArray(x.items) ? x.items : Array.isArray(x.objectives) ? x.objectives : [];
    return {
      id: str(x.id, 60) || `rv-${i}`,
      date: str(x.date, 20),
      meetingDate: str(x.meetingDate, 20),
      comments: str(x.comments),
      items: rawItems.slice(0, 40).map((o, j) => {
        const y = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
        const result = str(y.result, 40) ?? "";
        return {
          id: str(y.id, 60) || `ri-${j}`,
          objectiveId: str(y.objectiveId, 60),
          text: str(y.text, 2000) ?? "",
          result: (PIAI_REVIEW_RESULTS as readonly string[]).includes(result) ? result : "",
          comment: str(y.comment, 4000) ?? str(y.modifications, 4000),
        };
      }),
    };
  });
}

export function cleanSectionContent(sectionKey: string, v: unknown): PiaiSectionContent {
  const def = PIAI_SECTIONS.find((s) => s.key === sectionKey);
  const x = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: PiaiSectionContent = {
    responsible: str(x.responsible, 200),
    assessedBy: str(x.assessedBy, 200),
    assessment: str(x.assessment),
    objectives: strArray(x.objectives).slice(0, 20),
    comments: str(x.comments, 8000),
    individualSession: str(x.individualSession, 200),
    groupSession: str(x.groupSession, 200),
    extras: {},
  };
  const extras = (x.extras && typeof x.extras === "object" ? x.extras : {}) as Record<string, unknown>;
  for (const e of def?.extras ?? []) {
    const val = str(extras[e.key], 4000);
    if (val !== undefined) out.extras![e.key] = val;
  }
  if (def?.hasLeisure) {
    const l = (x.leisure && typeof x.leisure === "object" ? x.leisure : {}) as Record<string, unknown>;
    out.leisure = {
      assessment: str(l.assessment),
      objectives: strArray(l.objectives).slice(0, 20),
      comments: str(l.comments, 8000),
      individualSession: str(l.individualSession, 200),
      groupSession: str(l.groupSession, 200),
    };
  }
  return out;
}

export function isValidStatus(v: unknown): v is string {
  return typeof v === "string" && (PIAI_STATUSES as readonly string[]).includes(v);
}
