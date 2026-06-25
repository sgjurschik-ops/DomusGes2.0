// Structured ADL/IADL scales — Barthel, Lawton-Brody, VAVDI.
//
// Each scale defines its items (with per-item score options), how to
// compute the total from item scores, and how to turn that total into a
// clinical interpretation label. This is the single source of truth used
// by the assessment form (per-item inputs + live total) and can later be
// reused by any report/printout without duplicating the clinical content.

export type ScaleOption = { value: number; label: string };
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
      { value: 10, label: "Independiente. Come solo y utiliza correctamente los cubiertos" },
      { value: 5, label: "Necesita ayuda para cortar, untar o parte de la tarea" },
      { value: 0, label: "Dependiente" },
    ],
  },
  {
    id: "bathing",
    label: "Baño",
    options: [
      { value: 5, label: "Independiente para bañarse o ducharse" },
      { value: 0, label: "Dependiente" },
    ],
  },
  {
    id: "grooming",
    label: "Aseo personal",
    options: [
      { value: 5, label: "Independiente (lavarse la cara, peinarse, afeitarse, dientes...)" },
      { value: 0, label: "Dependiente" },
    ],
  },
  {
    id: "dressing",
    label: "Vestido",
    options: [
      { value: 10, label: "Independiente, incluyendo abrocharse y ayudas técnicas" },
      { value: 5, label: "Necesita ayuda parcial" },
      { value: 0, label: "Dependiente" },
    ],
  },
  {
    id: "bowels",
    label: "Control de deposiciones",
    options: [
      { value: 10, label: "Continente" },
      { value: 5, label: "Episodios ocasionales o ayuda para enemas/supositorios" },
      { value: 0, label: "Incontinente" },
    ],
  },
  {
    id: "bladder",
    label: "Control de micción",
    options: [
      { value: 10, label: "Continente" },
      { value: 5, label: "Episodios ocasionales o ayuda con la sonda" },
      { value: 0, label: "Incontinente" },
    ],
  },
  {
    id: "toilet",
    label: "Uso del retrete",
    options: [
      { value: 10, label: "Independiente para entrar, salir, limpiarse y vestirse" },
      { value: 5, label: "Necesita alguna ayuda" },
      { value: 0, label: "Dependiente" },
    ],
  },
  {
    id: "transfer",
    label: "Traslado silla-cama",
    options: [
      { value: 15, label: "Independiente" },
      { value: 10, label: "Mínima ayuda o supervisión" },
      { value: 5, label: "Ayuda importante de una o dos personas" },
      { value: 0, label: "Dependiente; no colabora" },
    ],
  },
  {
    id: "ambulation",
    label: "Deambulación",
    options: [
      { value: 15, label: "Independiente (puede usar bastón, muletas o andador)" },
      { value: 10, label: "Ayuda o supervisión para caminar ~50 metros" },
      { value: 5, label: "Independiente en silla de ruedas al menos 50 metros" },
      { value: 0, label: "Dependiente" },
    ],
  },
  {
    id: "stairs",
    label: "Subir y bajar escaleras",
    options: [
      { value: 10, label: "Independiente" },
      { value: 5, label: "Ayuda o supervisión" },
      { value: 0, label: "Dependiente" },
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

// ─── Lawton-Brody (AVD instrumentales) ──────────────────────────────────────

const LAWTON_BRODY_ITEMS: ScaleItem[] = [
  {
    id: "phone",
    label: "Uso del teléfono",
    options: [
      { value: 1, label: "Utiliza el teléfono por iniciativa propia, busca números y llama" },
      { value: 0, label: "No lo utiliza de forma independiente o necesita ayuda" },
    ],
  },
  {
    id: "shopping",
    label: "Compras",
    options: [
      { value: 1, label: "Realiza todas las compras de forma independiente" },
      { value: 0, label: "Necesita ayuda o no puede realizar las compras" },
    ],
  },
  {
    id: "food_prep",
    label: "Preparación de comidas",
    options: [
      { value: 1, label: "Planifica, prepara y sirve comidas adecuadas de forma independiente" },
      { value: 0, label: "Necesita ayuda o no prepara las comidas" },
    ],
  },
  {
    id: "housekeeping",
    label: "Cuidado de la casa",
    options: [
      { value: 1, label: "Mantiene la casa con autonomía (puede requerir ayuda en tareas pesadas)" },
      { value: 0, label: "Necesita ayuda para el mantenimiento del hogar" },
    ],
  },
  {
    id: "laundry",
    label: "Lavado de la ropa",
    options: [
      { value: 1, label: "Lava toda su ropa de forma independiente" },
      { value: 0, label: "Necesita ayuda o no realiza esta actividad" },
    ],
  },
  {
    id: "transport",
    label: "Uso de medios de transporte",
    options: [
      { value: 1, label: "Se desplaza solo (transporte público, vehículo propio, taxi o a pie)" },
      { value: 0, label: "Necesita ayuda para desplazarse" },
    ],
  },
  {
    id: "medication",
    label: "Responsabilidad sobre la medicación",
    options: [
      { value: 1, label: "Se responsabiliza de tomarla en dosis y horarios adecuados" },
      { value: 0, label: "Necesita supervisión o que otra persona la administre" },
    ],
  },
  {
    id: "finances",
    label: "Manejo de asuntos económicos",
    options: [
      { value: 1, label: "Administra su dinero, paga facturas y hace gestiones de forma independiente" },
      { value: 0, label: "Necesita ayuda o no puede gestionar sus finanzas" },
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
  { value: 1, label: "Autónomo. Lo realiza de forma independiente, segura y sin ayuda" },
  { value: 2, label: "Requiere supervisión o apoyo mínimo" },
  { value: 3, label: "Requiere ayuda moderada o guía frecuente (verbal, gestual o física parcial)" },
  { value: 4, label: "Requiere ayuda importante. Solo realiza parte de la actividad" },
  { value: 5, label: "Dependiente. La actividad debe ser realizada por otra persona" },
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
