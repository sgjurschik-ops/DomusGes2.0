// Structured ADL/IADL scales — Barthel, Lawton-Brody, VAVDI.
//
// Each scale defines its items (with per-item score options), how to
// compute the total from item scores, and how to turn that total into a
// clinical interpretation label. This is the single source of truth used
// by the assessment form (per-item inputs + live total) and can later be
// reused by any report/printout without duplicating the clinical content.

// `shortLabel` is the compact clinical word used in the read-only summary
// (e.g. "Independiente", "Dependencia parcial") — `label` stays the full
// descriptive sentence shown in the dropdown while answering.
export type ScaleOption = { value: number; label: string; shortLabel: string };
export type ScaleItem = { id: string; label: string; options: ScaleOption[] };

export type ScaleDefinition = {
  id: "Barthel" | "Lawton-Brody" | "VAVDI";
  name: string;
  description: string;
  items: ScaleItem[];
  minScore: number;
  maxScore: number;
  // Returns a human label for a given total score.
  interpret: (total: number) => string;
};

// ─── Barthel (AVD básicas) ───────────────────────────────────────────────────

const BARTHEL_ITEMS: ScaleItem[] = [
  {
    id: "feeding",
    label: "Alimentación",
    options: [
      { value: 10, label: "Independiente. Come solo y utiliza correctamente los cubiertos", shortLabel: "Independiente" },
      { value: 5, label: "Necesita ayuda para cortar, untar o parte de la tarea", shortLabel: "Ayuda parcial" },
      { value: 0, label: "Dependiente", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "bathing",
    label: "Baño",
    options: [
      { value: 5, label: "Independiente para bañarse o ducharse", shortLabel: "Independiente" },
      { value: 0, label: "Dependiente", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "grooming",
    label: "Aseo personal",
    options: [
      { value: 5, label: "Independiente (lavarse la cara, peinarse, afeitarse, dientes...)", shortLabel: "Independiente" },
      { value: 0, label: "Dependiente", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "dressing",
    label: "Vestido",
    options: [
      { value: 10, label: "Independiente, incluyendo abrocharse y ayudas técnicas", shortLabel: "Independiente" },
      { value: 5, label: "Necesita ayuda parcial", shortLabel: "Ayuda parcial" },
      { value: 0, label: "Dependiente", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "bowels",
    label: "Control de deposiciones",
    options: [
      { value: 10, label: "Continente", shortLabel: "Continente" },
      { value: 5, label: "Episodios ocasionales o ayuda para enemas/supositorios", shortLabel: "Incontinencia ocasional" },
      { value: 0, label: "Incontinente", shortLabel: "Incontinente" },
    ],
  },
  {
    id: "bladder",
    label: "Control de micción",
    options: [
      { value: 10, label: "Continente", shortLabel: "Continente" },
      { value: 5, label: "Episodios ocasionales o ayuda con la sonda", shortLabel: "Incontinencia ocasional" },
      { value: 0, label: "Incontinente", shortLabel: "Incontinente" },
    ],
  },
  {
    id: "toilet",
    label: "Uso del retrete",
    options: [
      { value: 10, label: "Independiente para entrar, salir, limpiarse y vestirse", shortLabel: "Independiente" },
      { value: 5, label: "Necesita alguna ayuda", shortLabel: "Ayuda parcial" },
      { value: 0, label: "Dependiente", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "transfer",
    label: "Traslado silla-cama",
    options: [
      { value: 15, label: "Independiente", shortLabel: "Independiente" },
      { value: 10, label: "Mínima ayuda o supervisión", shortLabel: "Supervisión mínima" },
      { value: 5, label: "Ayuda importante de una o dos personas", shortLabel: "Ayuda importante" },
      { value: 0, label: "Dependiente; no colabora", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "ambulation",
    label: "Deambulación",
    options: [
      { value: 15, label: "Independiente (puede usar bastón, muletas o andador)", shortLabel: "Independiente" },
      { value: 10, label: "Ayuda o supervisión para caminar ~50 metros", shortLabel: "Ayuda o supervisión" },
      { value: 5, label: "Independiente en silla de ruedas al menos 50 metros", shortLabel: "Independiente en silla de ruedas" },
      { value: 0, label: "Dependiente", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "stairs",
    label: "Subir y bajar escaleras",
    options: [
      { value: 10, label: "Independiente", shortLabel: "Independiente" },
      { value: 5, label: "Ayuda o supervisión", shortLabel: "Ayuda o supervisión" },
      { value: 0, label: "Dependiente", shortLabel: "Dependiente" },
    ],
  },
];

function interpretBarthel(total: number): string {
  if (total === 100) return "Independiente";
  if (total >= 91) return "Dependencia leve";
  if (total >= 61) return "Dependencia moderada";
  if (total >= 21) return "Dependencia grave";
  return "Dependencia total";
}

export const BARTHEL: ScaleDefinition = {
  id: "Barthel",
  name: "Índice de Barthel",
  description: "Valora la independencia en actividades básicas de la vida diaria (AVD).",
  items: BARTHEL_ITEMS,
  minScore: 0,
  maxScore: 100,
  interpret: interpretBarthel,
};

// Barthel has no official sub-block grouping (unlike VAVDI), but for the
// "strengths vs. areas to work on" summary it helps to cluster items into
// recognizable clinical categories rather than listing 10 items flat.
export const BARTHEL_BLOCKS = [
  {
    title: "Autocuidado",
    itemIds: ["feeding", "bathing", "grooming", "dressing", "bowels", "bladder", "toilet"],
  },
  {
    title: "Movilidad",
    itemIds: ["transfer", "ambulation", "stairs"],
  },
];

// ─── Lawton-Brody (AVD instrumentales) ──────────────────────────────────────

const LAWTON_BRODY_ITEMS: ScaleItem[] = [
  {
    id: "phone",
    label: "Uso del teléfono",
    options: [
      { value: 1, label: "Utiliza el teléfono por iniciativa propia, busca números y llama", shortLabel: "Independiente" },
      { value: 0, label: "No lo utiliza de forma independiente o necesita ayuda", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "shopping",
    label: "Compras",
    options: [
      { value: 1, label: "Realiza todas las compras de forma independiente", shortLabel: "Independiente" },
      { value: 0, label: "Necesita ayuda o no puede realizar las compras", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "food_prep",
    label: "Preparación de comidas",
    options: [
      { value: 1, label: "Planifica, prepara y sirve comidas adecuadas de forma independiente", shortLabel: "Independiente" },
      { value: 0, label: "Necesita ayuda o no prepara las comidas", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "housekeeping",
    label: "Cuidado de la casa",
    options: [
      { value: 1, label: "Mantiene la casa con autonomía (puede requerir ayuda en tareas pesadas)", shortLabel: "Independiente" },
      { value: 0, label: "Necesita ayuda para el mantenimiento del hogar", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "laundry",
    label: "Lavado de la ropa",
    options: [
      { value: 1, label: "Lava toda su ropa de forma independiente", shortLabel: "Independiente" },
      { value: 0, label: "Necesita ayuda o no realiza esta actividad", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "transport",
    label: "Uso de medios de transporte",
    options: [
      { value: 1, label: "Se desplaza solo (transporte público, vehículo propio, taxi o a pie)", shortLabel: "Independiente" },
      { value: 0, label: "Necesita ayuda para desplazarse", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "medication",
    label: "Responsabilidad sobre la medicación",
    options: [
      { value: 1, label: "Se responsabiliza de tomarla en dosis y horarios adecuados", shortLabel: "Independiente" },
      { value: 0, label: "Necesita supervisión o que otra persona la administre", shortLabel: "Dependiente" },
    ],
  },
  {
    id: "finances",
    label: "Manejo de asuntos económicos",
    options: [
      { value: 1, label: "Administra su dinero, paga facturas y hace gestiones de forma independiente", shortLabel: "Independiente" },
      { value: 0, label: "Necesita ayuda o no puede gestionar sus finanzas", shortLabel: "Dependiente" },
    ],
  },
];

function interpretLawtonBrody(total: number): string {
  if (total === 8) return "Independencia completa";
  if (total >= 6) return "Dependencia leve";
  if (total >= 4) return "Dependencia moderada";
  if (total >= 2) return "Dependencia grave";
  return "Dependencia total o muy grave";
}

export const LAWTON_BRODY: ScaleDefinition = {
  id: "Lawton-Brody",
  name: "Escala de Lawton y Brody",
  description: "Valora la independencia en actividades instrumentales de la vida diaria (AIVD).",
  items: LAWTON_BRODY_ITEMS,
  minScore: 0,
  maxScore: 8,
  interpret: interpretLawtonBrody,
};

// ─── VAVDI (AVD básicas + instrumentales, nivel de apoyo) ───────────────────

const VAVDI_SUPPORT_OPTIONS: ScaleOption[] = [
  { value: 1, label: "Autónomo. Lo realiza de forma independiente, segura y sin ayuda", shortLabel: "Autónomo" },
  { value: 2, label: "Requiere supervisión o apoyo mínimo", shortLabel: "Supervisión mínima" },
  { value: 3, label: "Requiere ayuda moderada o guía frecuente (verbal, gestual o física parcial)", shortLabel: "Ayuda moderada" },
  { value: 4, label: "Requiere ayuda importante. Solo realiza parte de la actividad", shortLabel: "Ayuda importante" },
  { value: 5, label: "Dependiente. La actividad debe ser realizada por otra persona", shortLabel: "Dependiente" },
];

const VAVDI_BASIC_ITEMS: ScaleItem[] = [
  { id: "bathing", label: "Bañarse o ducharse", options: VAVDI_SUPPORT_OPTIONS },
  { id: "bladder_bowel", label: "Control de vejiga e intestino", options: VAVDI_SUPPORT_OPTIONS },
  { id: "grooming", label: "Higiene y arreglo personal", options: VAVDI_SUPPORT_OPTIONS },
  { id: "dressing", label: "Vestirse", options: VAVDI_SUPPORT_OPTIONS },
  { id: "eating", label: "Alimentación y modales en la mesa", options: VAVDI_SUPPORT_OPTIONS },
  { id: "functional_mobility", label: "Movilidad funcional", options: VAVDI_SUPPORT_OPTIONS },
];

const VAVDI_INSTRUMENTAL_ITEMS: ScaleItem[] = [
  { id: "communication", label: "Gestión de la comunicación", options: VAVDI_SUPPORT_OPTIONS },
  { id: "community_mobility", label: "Movilidad en la comunidad", options: VAVDI_SUPPORT_OPTIONS },
  { id: "finances", label: "Manejo de finanzas", options: VAVDI_SUPPORT_OPTIONS },
  { id: "health_management", label: "Manejo y mantenimiento de la salud (incluida medicación)", options: VAVDI_SUPPORT_OPTIONS },
  { id: "home_establishment", label: "Establecimiento y manejo del hogar", options: VAVDI_SUPPORT_OPTIONS },
  { id: "meal_prep", label: "Preparación de comidas y limpieza", options: VAVDI_SUPPORT_OPTIONS },
  { id: "bathroom_cleaning", label: "Limpieza del baño", options: VAVDI_SUPPORT_OPTIONS },
  { id: "safety", label: "Procedimientos de seguridad y respuesta ante emergencias", options: VAVDI_SUPPORT_OPTIONS },
  { id: "clothing_care", label: "Mantenimiento de la ropa", options: VAVDI_SUPPORT_OPTIONS },
  { id: "shopping", label: "Compras", options: VAVDI_SUPPORT_OPTIONS },
];

// VAVDI doesn't use dependency-severity cut-offs (no "leve/moderada/grave");
// a lower score means more autonomy, a higher score more support needed.
function interpretVavdi(total: number): string {
  if (total <= 22) return "Autonomía alta — apoyo puntual";
  if (total <= 38) return "Autonomía media — apoyo moderado en varias áreas";
  if (total <= 54) return "Apoyo considerable en la mayoría de áreas";
  return "Apoyo extenso o dependencia en la mayoría de áreas";
}

export const VAVDI: ScaleDefinition = {
  id: "VAVDI",
  name: "VAVDI",
  description:
    "Valoración de Actividades de la Vida Diaria e Instrumentales — nivel de apoyo necesario en cada actividad (básicas e instrumentales).",
  items: [...VAVDI_BASIC_ITEMS, ...VAVDI_INSTRUMENTAL_ITEMS],
  minScore: 16,
  maxScore: 80,
  interpret: interpretVavdi,
};

// VAVDI items split by block, used to render two clearly labeled groups
// (AVD básicas / AVD instrumentales) instead of one flat list of 16 items.
export const VAVDI_BLOCKS = [
  { title: "Actividades básicas (AVD)", items: VAVDI_BASIC_ITEMS },
  { title: "Actividades instrumentales (AVDI)", items: VAVDI_INSTRUMENTAL_ITEMS },
];

export const STRUCTURED_SCALE_DEFINITIONS: Record<string, ScaleDefinition> = {
  Barthel: BARTHEL,
  "Lawton-Brody": LAWTON_BRODY,
  VAVDI: VAVDI,
};

export function computeScaleTotal(scaleId: string, itemScores: Record<string, number>): number {
  const def = STRUCTURED_SCALE_DEFINITIONS[scaleId];
  if (!def) return 0;
  return def.items.reduce((sum, item) => sum + (itemScores[item.id] ?? 0), 0);
}

export function formatScaleScore(scaleId: string, itemScores: Record<string, number>): string {
  const def = STRUCTURED_SCALE_DEFINITIONS[scaleId];
  if (!def) return "";
  const total = computeScaleTotal(scaleId, itemScores);
  return `${total}/${def.maxScore} — ${def.interpret(total)}`;
}

// ─── Area summary (strengths vs. areas to work on) ──────────────────────────
//
// Rule-based (not AI-generated): for a given scale, groups items into their
// clinical blocks (Barthel: Autocuidado/Movilidad; VAVDI: AVD básicas/AVDI)
// and, within each block, separates items the person handles well from
// those that need support — using each item's own best possible score as
// the bar, since Barthel items have different max values per item.
//
// Deterministic by design: the same scores always produce the same result,
// which matters for clinical use — no variability between runs, no cost
// per generation, no network dependency.

type AreaBlock = { title: string; items: ScaleItem[] };

function blocksFor(scaleId: string): AreaBlock[] | null {
  if (scaleId === "VAVDI") return VAVDI_BLOCKS;
  if (scaleId === "Barthel") {
    return BARTHEL_BLOCKS.map((b) => ({
      title: b.title,
      items: BARTHEL_ITEMS.filter((i) => b.itemIds.includes(i.id)),
    }));
  }
  return null; // Lawton-Brody has no sub-blocks; not covered by this summary.
}

// An item counts as a strength if its score is at (or above) this fraction
// of its own maximum. VAVDI's scale is inverted (1 = best), so it's handled
// separately below rather than through a single shared threshold.
const BARTHEL_STRENGTH_RATIO = 1; // Barthel: only the item's own max counts as a strength — partial credit still signals a support need.
const VAVDI_STRENGTH_MAX_SCORE = 2; // VAVDI: 1 (autónomo) or 2 (supervisión mínima) count as a strength.

export type AreaSummaryBlock = { title: string; strengths: string[]; toWork: string[] };
export type AreaSummaryData = { blocks: AreaSummaryBlock[] };

// Structured version — used by the UI to render strengths/areas-to-work-on
// as two clearly separated, colored columns instead of a single paragraph.
export function generateAreaSummaryData(
  scaleId: string,
  itemScores: Record<string, number>,
): AreaSummaryData | null {
  const blocks = blocksFor(scaleId);
  if (!blocks) return null;

  const result: AreaSummaryBlock[] = [];

  for (const block of blocks) {
    const strengths: string[] = [];
    const toWork: string[] = [];

    for (const item of block.items) {
      const score = itemScores[item.id];
      if (score === undefined) continue;

      const isStrength =
        scaleId === "VAVDI"
          ? score <= VAVDI_STRENGTH_MAX_SCORE
          : score >= Math.max(...item.options.map((o) => o.value)) * BARTHEL_STRENGTH_RATIO;

      (isStrength ? strengths : toWork).push(item.label);
    }

    if (strengths.length === 0 && toWork.length === 0) continue;
    result.push({ title: block.title, strengths, toWork });
  }

  return result.length > 0 ? { blocks: result } : null;
}

// Plain-text version, kept for storage/back-compat (e.g. exporting into a
// report) — derived from the same structured data so the two never drift.
export function generateAreaSummary(
  scaleId: string,
  itemScores: Record<string, number>,
): string | null {
  const data = generateAreaSummaryData(scaleId, itemScores);
  if (!data) return null;

  const lines = data.blocks.map((block) => {
    if (block.toWork.length === 0) {
      return `${block.title}: buen desempeño en todas las áreas evaluadas (${block.strengths.join(", ")}).`;
    }
    if (block.strengths.length === 0) {
      return `${block.title}: requiere apoyo en todas las áreas evaluadas (${block.toWork.join(", ")}).`;
    }
    return (
      `${block.title}: buen desempeño en ${block.strengths.join(", ")}. ` +
      `Áreas a trabajar: ${block.toWork.join(", ")}.`
    );
  });

  return lines.join("\n");
}
