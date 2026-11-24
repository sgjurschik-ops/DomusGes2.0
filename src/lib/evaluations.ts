// Valoración escrita del usuario/a (pestaña "Valoración"): definición de los
// bloques, qué escalas se muestran en cada uno y tipos compartidos entre el
// servidor y la interfaz. Única fuente de verdad: si se añade un bloque o una
// escala nueva, se toca solo aquí.

export const EVALUATION_TEXT_FIELDS = [
  "generalData",
  "adl",
  "iadl",
  "physical",
  "routines",
  "other",
] as const;
export type EvaluationTextField = (typeof EVALUATION_TEXT_FIELDS)[number];

export function isEvaluationTextField(v: unknown): v is EvaluationTextField {
  return typeof v === "string" && (EVALUATION_TEXT_FIELDS as readonly string[]).includes(v);
}

export type EvaluationSectionDef = {
  key: string;
  title: string;
  hint: string;
  // Campos de texto del bloque (Área funcional tiene dos: ABVDs y AIVDs).
  fields: { field: EvaluationTextField; label?: string; placeholder: string }[];
  // Escalas cuyo resultado más reciente se muestra dentro del bloque.
  scales: readonly string[];
};

export const EVALUATION_SECTIONS: readonly EvaluationSectionDef[] = [
  {
    key: "general",
    title: "Datos generales",
    hint: "Entorno, ocupación, dificultades actuales, diagnóstico…",
    fields: [{ field: "generalData", placeholder: "Entorno, ocupación, dificultades actuales, diagnóstico…" }],
    scales: [],
  },
  {
    key: "functional",
    title: "Área funcional",
    hint: "Actividades básicas e instrumentales de la vida diaria",
    fields: [
      { field: "adl", label: "ABVDs", placeholder: "Alimentación, higiene, vestido, movilidad, continencia…" },
      { field: "iadl", label: "AIVDs", placeholder: "Tareas domésticas, compras, gestión económica, medicación, transporte…" },
    ],
    scales: ["Barthel", "Lawton-Brody", "VAVDI", "Inventario de AVDs", "COPM"],
  },
  {
    key: "physical",
    title: "Área física y motora",
    hint: "Fuerza, destreza, sensibilidad, movilidad, fatiga…",
    fields: [{ field: "physical", placeholder: "Fuerza, destreza, sensibilidad, movilidad, fatiga…" }],
    scales: ["JAMAR", "9HPT", "Box and Block", "Minnesota", "TUG", "Monofilamentos", "Esterognosia", "Propiocepción", "MFIS"],
  },
  {
    key: "routines",
    title: "Rutinas e intereses",
    hint: "Rutina diaria, intereses, ocio, participación…",
    fields: [{ field: "routines", placeholder: "Rutina diaria, intereses, ocio, participación…" }],
    scales: [],
  },
  {
    key: "other",
    title: "Otros",
    hint: "Cualquier otra información relevante",
    fields: [{ field: "other", placeholder: "Otras observaciones…" }],
    scales: [],
  },
];

export interface PatientEvaluationDTO {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  authorId: string;
  authorName: string;
  updatedByName: string | null;
  updatedAt: string; // ISO
  generalData: string;
  adl: string;
  iadl: string;
  physical: string;
  routines: string;
  other: string;
}
