// Shared data-gathering for the "full patient record" report (distinct
// from the dedicated occupational-profile report). Both the Word and PDF
// renderers consume this same shape, so the two formats never drift apart
// in which fields they show.

import { db } from "@/lib/db";
import { scalesForRole } from "@/lib/schemas";
import { evaluationSectionsFor } from "@/lib/evaluations";

export const REPORT_SECTIONS = ["summary", "goals", "evaluation", "visits", "assessments"] as const;
export type ReportSection = typeof REPORT_SECTIONS[number];

export function parseSections(raw: string | null): ReportSection[] {
  if (!raw) return [...REPORT_SECTIONS];
  const requested = raw.split(",").map((s) => s.trim());
  const valid = requested.filter((s): s is ReportSection =>
    (REPORT_SECTIONS as readonly string[]).includes(s),
  );
  return valid.length > 0 ? valid : [...REPORT_SECTIONS];
}

export type ReportAudience = "professional" | "family";

function parseAudience(raw: string | null): ReportAudience {
  return raw === "family" ? "family" : "professional";
}

// Assessment.score is stored as "44/80 — Apoyo considerable en la mayoría
// de áreas" — number and clinical interpretation in one string, separated
// by an em dash. The family report shows only the interpretation in
// words; the professional report shows the score as saved.
function splitScoreText(score: string): { numeric: string; interpretation: string } {
  const sepIndex = score.indexOf(" — ");
  if (sepIndex === -1) return { numeric: score, interpretation: score };
  return { numeric: score.slice(0, sepIndex), interpretation: score.slice(sepIndex + 3) };
}

// Notas y valoraciones se guardan como HTML (RichTextarea). En el informe
// van como texto plano, conservando los saltos de línea.
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseSpecificGoals(raw: string | null | undefined): { text: string; status: string }[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export interface PatientReportData {
  audience: ReportAudience;
  patient: {
    fullName: string;
    specialty: string;
    status: string;
    diagnosis: string | null;
    objective: string | null;
    alerts: string[]; // empty for "family" audience — filtered before this is built
    phone: string | null;
    address: string | null;
    startDate: Date;
    therapistNames: string[];
  };
  goals: {
    text: string;
    status: string;
    targetDate: Date | null;
    metas: { text: string; status: string }[];
  }[];
  evaluation: {
    date: Date;
    isInitial: boolean;
    authorName: string;
    blocks: { title: string; text: string }[];
  } | null;
  visits: { date: Date; title: string | null; therapistName: string; durationMin: number; notes: string }[];
  assessments: {
    date: Date;
    scale: string;
    score: string; // numeric form, e.g. "44/80" — only meaningful for "professional"
    interpretation: string; // words-only form, used by both, primary display for "family"
    therapistName: string;
    notes: string | null;
  }[];
}

export async function gatherPatientReportData(
  patientId: string,
  sections: ReportSection[],
  audienceRaw: string | null = null,
  // Perfil del profesional que genera el informe: solo se incluyen las
  // escalas de su profesión (igual que lo que ve en la app).
  professionalRole: string | null = null,
): Promise<PatientReportData | null> {
  const audience = parseAudience(audienceRaw);
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    include: { therapists: { select: { name: true } } },
  });
  if (!patient) return null;

  const allowedScales = scalesForRole(professionalRole);

  const [visits, assessments, profile, evaluations] = await Promise.all([
    sections.includes("visits")
      ? db.visit.findMany({
          // Solo seguimientos COMPARTIDOS: las "intervenciones" son privadas
          // de cada profesional y nunca salen en el informe.
          where: { patientId, kind: "seguimiento" },
          orderBy: { date: "desc" },
          include: { therapist: { select: { name: true } } },
        })
      : Promise.resolve([]),
    sections.includes("assessments")
      ? db.assessment.findMany({
          where: { patientId, scale: { in: [...allowedScales] } },
          orderBy: { date: "desc" },
          include: { therapist: { select: { name: true } } },
        })
      : Promise.resolve([]),
    sections.includes("goals")
      ? db.occupationalProfile.findUnique({
          where: { patientId },
          include: { goals: { orderBy: { createdAt: "asc" } } },
        })
      : Promise.resolve(null),
    sections.includes("evaluation")
      ? db.patientEvaluation.findMany({
          where: { patientId },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          include: { author: { select: { name: true, role: true } } },
        })
      : Promise.resolve([]),
  ]);

  // Objetivos: en curso y conseguidos (los abandonados no aportan al informe).
  const goals = (profile?.goals ?? [])
    .filter((g) => g.status !== "Abandonado")
    .map((g) => ({
      text: g.text,
      status: g.status,
      targetDate: g.targetDate,
      metas: parseSpecificGoals(g.specificGoals).map((m) => ({ text: m.text, status: m.status })),
    }));

  // Valoración: la más reciente de la profesión de quien genera el informe
  // (si no tiene, la más reciente de cualquier profesión).
  const latest = evaluations.find((e) => e.author.role === professionalRole) ?? evaluations[0];
  const evaluation = latest
    ? {
        date: latest.date,
        isInitial: evaluations.length === 1,
        authorName: latest.author.name,
        blocks: evaluationSectionsFor(latest.author.role).flatMap((section) =>
          section.fields
            .map((f) => ({
              title: f.label ? `${section.title} — ${f.label}` : section.title,
              text: htmlToPlainText(latest[f.field]),
            }))
            .filter((b) => b.text.length > 0),
        ),
      }
    : null;

  return {
    audience,
    patient: {
      fullName: `${patient.firstName} ${patient.lastName}`,
      specialty: patient.specialty,
      status: patient.status,
      diagnosis: patient.diagnosis,
      objective: patient.objective,
      // Family reports never show clinical/administrative alert tags —
      // decided explicitly rather than trying to guess which ones are
      // "family-appropriate".
      alerts: audience === "family" ? [] : patient.alerts,
      phone: patient.phone,
      address: patient.address,
      startDate: patient.startDate,
      therapistNames: patient.therapists.map((t) => t.name),
    },
    goals,
    evaluation,
    visits: visits.map((v) => ({
      date: v.date,
      title: v.title,
      therapistName: v.therapist.name,
      durationMin: v.durationMin,
      notes: htmlToPlainText(v.notes),
    })),
    assessments: assessments.map((a) => {
      const { numeric, interpretation } = splitScoreText(a.score);
      return {
        date: a.date,
        scale: a.scale,
        score: numeric,
        interpretation,
        therapistName: a.therapist.name,
        notes: a.notes,
      };
    }),
  };
}
