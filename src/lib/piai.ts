// PIAI — Plan de Atención Individualizada (Centro de día).
// Única fuente de verdad de la estructura del documento: información
// general, objetivos generales, apartados por profesión y revisiones.
// La usan la API, la pestaña PIAI, el Resumen y la exportación a Word.
// Basado en la plantilla en papel del centro.

export const PIAI_STATUSES = ["En elaboración", "Reunión", "Devolución", "Cerrado"] as const;
export type PiaiStatus = (typeof PIAI_STATUSES)[number];

// ─── Información general ─────────────────────────────────────────────────────

export interface PiaiGeneral {
  meetingDate?: string; // Fecha reunión PPUU/equipo técnico (objetivos generales)
  admissionDate?: string; // Fecha de alta
  dischargeDate?: string; // Fecha de baja
  dependencyGrade?: string; // Grado y nivel de dependencia
  disabilityGrade?: string; // Grado de discapacidad
  service?: string; // Servicio aplicable
  benefits?: string; // Servicios y prestaciones
  publicFunding?: string; // Financiación pública
  objectivesSheetDelivered?: string; // Ficha objetivos generales entregada
  description?: string; // Breve descripción de la persona (HTML)
  acceptanceDate?: string; // (ya no se muestra; se conserva si existía)
  acceptanceNotes?: string;
  deliveredDate?: string; // Fecha en que se entregó el PIA a la persona usuaria ("" = no entregado)
}

export const PIAI_GENERAL_FIELDS: { key: keyof PiaiGeneral; label: string; type: "date" | "text" }[] = [
  { key: "admissionDate", label: "Fecha de alta", type: "date" },
  { key: "dischargeDate", label: "Fecha de baja", type: "date" },
  { key: "dependencyGrade", label: "Grado y nivel de dependencia", type: "text" },
  { key: "disabilityGrade", label: "Grado de discapacidad", type: "text" },
  { key: "service", label: "Servicio aplicable", type: "text" },
  { key: "benefits", label: "Servicios y prestaciones", type: "text" },
  { key: "publicFunding", label: "Financiación pública", type: "text" },
];

export interface PiaiAction {
  id: string;
  text: string;
  done: boolean; // casilla marcada = acción realizada
}

export interface PiaiGeneralObjective {
  id: string;
  text: string;
  actions: PiaiAction[];
}

// ─── Apartados por profesión ─────────────────────────────────────────────────

export interface PiaiSessionInfo {
  individualSession?: string;
  groupSession?: string;
}

export interface PiaiSectionContent extends PiaiSessionInfo {
  responsible?: string;
  assessedBy?: string;
  assessment?: string; // HTML
  objectives?: string[];
  comments?: string;
  extras?: Record<string, string>;
  // Solo Trabajo social: bloque "Atención al ocio y tiempo libre".
  leisure?: PiaiSessionInfo & {
    assessment?: string; // HTML
    objectives?: string[];
    comments?: string;
  };
}

export interface PiaiSectionDef {
  key: string;
  title: string;
  // Profesión (Professional.role) que puede editar este apartado.
  role: string;
  assessmentLabel: string;
  // Campos propios de la profesión (texto corto).
  extras: { key: string; label: string }[];
  hasLeisure?: boolean;
  // Terapia ocupacional: sus objetivos son los del Plan de intervención
  // (con metas funcionales y GAS), no una lista de texto aparte.
  objectivesFromPlan?: boolean;
}

export const PIAI_SECTIONS: readonly PiaiSectionDef[] = [
  { key: "trabajo-social", title: "Trabajo social", role: "Trabajo Social", assessmentLabel: "Valoración socio-familiar", extras: [{ key: "referenceRelative", label: "Familiar de referencia" }], hasLeisure: true },
  { key: "terapia-ocupacional", title: "Terapia ocupacional", role: "Terapia ocupacional", assessmentLabel: "Valoración de terapia ocupacional", extras: [{ key: "technicalAid", label: "Ayuda técnica" }], objectivesFromPlan: true },
  {
    key: "logopedia", title: "Logopedia", role: "Logopedia", assessmentLabel: "Valoración logopédica",
    extras: [
      { key: "feeding", label: "Alimentación" },
      { key: "intolerances", label: "Intolerancias" },
      { key: "diet", label: "Dieta específica" },
      { key: "liquids", label: "Líquidos" },
      { key: "healthNotes", label: "Observaciones condiciones de salud" },
      { key: "functional", label: "Valoración funcional" },
    ],
  },
  { key: "fisioterapia", title: "Fisioterapia", role: "Fisioterapia", assessmentLabel: "Valoración fisioterapéutica", extras: [] },
  { key: "psicologia", title: "Psicología", role: "Psicología", assessmentLabel: "Valoración psicológica", extras: [] },
  { key: "neuropsicologia", title: "Neuropsicología", role: "Neuropsicología", assessmentLabel: "Valoración neuropsicológica", extras: [] },
  {
    key: "cuidados", title: "Cuidados", role: "Cuidados", assessmentLabel: "Valoración del estado de salud",
    extras: [
      { key: "crane", label: "Grúa" },
      { key: "transferNeeds", label: "Necesidades en los cambios" },
      { key: "allergies", label: "Alergias" },
    ],
  },
];

export function piaiSectionDef(key: string): PiaiSectionDef | undefined {
  return PIAI_SECTIONS.find((s) => s.key === key);
}

// ─── Revisiones de objetivos ─────────────────────────────────────────────────
// Ciclo: PIA general una vez al año y, a los ~6 meses, una REVISIÓN DE
// OBJETIVOS en la que solo se marca, para cada objetivo general, si se ha
// conseguido, se mantiene o no se ha conseguido. Cada revisión queda guardada
// con su fecha dentro de su PIA y aparece en el historial.

export const PIAI_REVIEW_RESULTS = ["Conseguido", "Se mantiene", "No conseguido"] as const;
export type PiaiReviewResult = (typeof PIAI_REVIEW_RESULTS)[number];

export interface PiaiReviewItem {
  id: string;
  objectiveId?: string; // id del objetivo general revisado
  text: string; // texto del objetivo en el momento de la revisión
  result: string; // "" = sin marcar | PIAI_REVIEW_RESULTS
  comment?: string;
}

export interface PiaiReview {
  id: string;
  date?: string;
  meetingDate?: string;
  comments?: string;
  items: PiaiReviewItem[];
}

// ─── DTO ─────────────────────────────────────────────────────────────────────

export interface PiaiDTO {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  status: string;
  createdById: string;
  createdByName: string;
  updatedAt: string;
  // Última modificación de CUALQUIER parte del PIAI (común o apartados).
  lastEditedAt: string;
  lastEditedByName: string | null;
  general: PiaiGeneral;
  generalObjectives: PiaiGeneralObjective[];
  reviews: PiaiReview[];
  sections: Record<string, { content: PiaiSectionContent; updatedByName: string | null; updatedAt: string }>;
}

export function safeJsonObject<T extends object>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
