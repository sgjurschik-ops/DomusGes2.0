// Shared data-gathering for the "full patient record" report (distinct
// from the dedicated occupational-profile report). Both the Word and PDF
// renderers consume this same shape, so the two formats never drift apart
// in which fields they show.

import { db } from "@/lib/db";

export const REPORT_SECTIONS = ["summary", "visits", "assessments"] as const;
export type ReportSection = typeof REPORT_SECTIONS[number];

export function parseSections(raw: string | null): ReportSection[] {
  if (!raw) return [...REPORT_SECTIONS];
  const requested = raw.split(",").map((s) => s.trim());
  const valid = requested.filter((s): s is ReportSection =>
    (REPORT_SECTIONS as readonly string[]).includes(s),
  );
  return valid.length > 0 ? valid : [...REPORT_SECTIONS];
}

function calcAge(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
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

export interface PatientReportData {
  audience: ReportAudience;
  patient: {
    fullName: string;
    age: number;
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
): Promise<PatientReportData | null> {
  const audience = parseAudience(audienceRaw);
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    include: { therapists: { select: { name: true } } },
  });
  if (!patient) return null;

  const [visits, assessments] = await Promise.all([
    sections.includes("visits")
      ? db.visit.findMany({
          where: { patientId },
          orderBy: { date: "desc" },
          include: { therapist: { select: { name: true } } },
        })
      : Promise.resolve([]),
    sections.includes("assessments")
      ? db.assessment.findMany({
          where: { patientId },
          orderBy: { date: "desc" },
          include: { therapist: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  return {
    audience,
    patient: {
      fullName: `${patient.firstName} ${patient.lastName}`,
      age: calcAge(patient.birthDate),
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
    visits: visits.map((v) => ({
      date: v.date,
      title: v.title,
      therapistName: v.therapist.name,
      durationMin: v.durationMin,
      notes: v.notes,
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
