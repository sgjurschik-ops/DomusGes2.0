// Guía de cuidados (Centro de día): resumen práctico de apoyos y cuidados de
// cada persona, pensado para rellenarse en un par de minutos (casi todo son
// opciones para marcar) y para imprimirse como hoja de referencia del equipo.
//
// Este archivo es compartido entre el navegador y el servidor: define los
// apartados, los campos y sus opciones, y cómo se limpian los datos.

export type CareFieldKind = "single" | "multi" | "text";

export interface CareFieldDef {
  key: string;
  label: string;
  kind: CareFieldKind;
  options?: readonly string[];
  // Texto de ayuda del cuadro de texto que acompaña a la opción (detalle,
  // "otras"...). En los campos "text" es el placeholder del cuadro.
  detailPlaceholder?: string;
}

export interface CareSectionDef {
  key: string;
  title: string;
  // Color de la franja del apartado (pantalla e impresión).
  band: string;
  fields: readonly CareFieldDef[];
}

// Un campo guardado: la opción u opciones marcadas y un texto libre.
export interface CareFieldValue {
  sel?: string | string[];
  text?: string;
}
export type CareGuideData = Record<string, Record<string, CareFieldValue>>;

export interface CareGuideDTO {
  data: CareGuideData;
  updatedAt: string | null;
  updatedByName: string | null;
}

const LEVELS = ["Autónomo/a", "Supervisión", "Guía verbal", "Ayuda parcial", "Ayuda total"] as const;
const MOBILITY_LEVELS = ["Autónomo/a", "Supervisión", "Ayuda de 1 persona", "Ayuda de 2 personas", "Grúa"] as const;
const PAUTAS = "Pautas / observaciones";

export const CARE_SECTIONS: readonly CareSectionDef[] = [
  {
    key: "movilidad",
    title: "Movilidad - Transferencias",
    band: "#fdf2a6",
    fields: [
      { key: "trasladosCortos", label: "Traslados cortos", kind: "single", options: MOBILITY_LEVELS, detailPlaceholder: "Detalle (p. ej. andador del centro + supervisión)" },
      { key: "trasladosLargos", label: "Traslados largos", kind: "single", options: MOBILITY_LEVELS, detailPlaceholder: "Detalle (p. ej. silla de ruedas manual con ayuda)" },
      { key: "transferencias", label: "Transferencias", kind: "single", options: MOBILITY_LEVELS, detailPlaceholder: "Detalle (silla-WC, silla-sillón…)" },
      {
        key: "ayudas", label: "Ayudas técnicas", kind: "multi",
        options: ["Bastón", "Muletas", "Andador", "Rollator", "Silla de ruedas manual", "Silla de ruedas eléctrica", "Disco giratorio", "Tabla de transferencia", "Cinturón de transferencia", "Grúa"],
        detailPlaceholder: "Otras / detalles (p. ej. lado izquierdo afectado)",
      },
      { key: "pautas", label: PAUTAS, kind: "text", detailPlaceholder: "Cómo ayudar en traslados y transferencias…" },
    ],
  },
  {
    key: "alimentacion",
    title: "Alimentación",
    band: "#fdf2a6",
    fields: [
      { key: "apoyos", label: "Apoyos", kind: "single", options: LEVELS, detailPlaceholder: "Detalle (p. ej. supervisión + guía verbal)" },
      { key: "textura", label: "Textura", kind: "single", options: ["Normal", "Blanda", "Picada", "Triturada"], detailPlaceholder: "Detalle" },
      { key: "espesante", label: "Espesante", kind: "single", options: ["No", "Sí"], detailPlaceholder: "Cantidad (p. ej. 1 cucharadita)" },
      {
        key: "ayudas", label: "Ayudas técnicas", kind: "multi",
        options: ["Tope para el plato", "Plato con reborde", "Antideslizante", "Vaso con escotadura", "Vaso con asas", "Pajita", "Cubiertos adaptados", "Cuchara pequeña", "Babero"],
        detailPlaceholder: "Otras",
      },
      { key: "pautas", label: PAUTAS, kind: "text", detailPlaceholder: "Ambiente, ritmo, cantidades…" },
    ],
  },
  {
    key: "higiene",
    title: "Higiene personal y uso de WC",
    band: "#fdf2a6",
    fields: [
      { key: "apoyos", label: "Apoyos", kind: "single", options: ["Autónomo/a", "Supervisión", "Acompañamiento", "Ayuda parcial", "Ayuda total"], detailPlaceholder: "Detalle" },
      { key: "absorbentes", label: "Uso de absorbentes", kind: "single", options: ["No", "Sí", "Solo de noche", "Ocasional"], detailPlaceholder: "Detalle (talla, cambios…)" },
      {
        key: "ayudas", label: "Ayudas técnicas", kind: "multi",
        options: ["Barras de apoyo", "Alza de WC", "Silla de ducha", "Asiento de bañera", "Esponja de mango largo"],
        detailPlaceholder: "Otras (o «valorar»)",
      },
      { key: "pautas", label: PAUTAS, kind: "text", detailPlaceholder: "Guía verbal, qué observar…" },
    ],
  },
  {
    key: "vestido",
    title: "Vestido",
    band: "#fdf2a6",
    fields: [
      { key: "apoyos", label: "Apoyos", kind: "single", options: LEVELS, detailPlaceholder: "Detalle" },
      {
        key: "ayudas", label: "Ayudas técnicas", kind: "multi",
        options: ["Calzador largo", "Abotonador", "Calzado con velcro", "Ponemedias"],
        detailPlaceholder: "Otras",
      },
      { key: "pautas", label: PAUTAS, kind: "text", detailPlaceholder: "Orden de las prendas, lado afectado…" },
    ],
  },
  {
    key: "comunicacion",
    title: "Comunicación - Sensorial",
    band: "#c9e7a7",
    fields: [
      {
        key: "apoyos", label: "Apoyos", kind: "multi",
        options: ["Respetar tiempos de respuesta", "Frases cortas y sencillas", "Hablar de frente", "Apoyo visual / pictogramas", "Confirmar que ha entendido"],
        detailPlaceholder: "Otros",
      },
      {
        key: "ayudas", label: "Ayudas técnicas", kind: "multi",
        options: ["Gafas", "Audífono", "Pictogramas", "Tablero de comunicación", "Agenda o reloj visual"],
        detailPlaceholder: "Otras (o «no precisa por el momento»)",
      },
      { key: "pautas", label: PAUTAS, kind: "text", detailPlaceholder: "Cómo comunicarse mejor con la persona…" },
    ],
  },
  {
    key: "conducta",
    title: "Orientación - Conducta",
    band: "#c9e7a7",
    fields: [
      {
        key: "apoyos", label: "Apoyos", kind: "multi",
        options: ["Recordatorios", "Orientación en tiempo y lugar", "Rutina estable", "Evitar ruido y estímulos", "Acompañar en cambios de actividad"],
        detailPlaceholder: "Otros",
      },
      { key: "pautas", label: PAUTAS, kind: "text", detailPlaceholder: "Qué le tranquiliza, qué evitar…" },
    ],
  },
  {
    key: "otros",
    title: "Otras indicaciones",
    band: "#dbe4f3",
    fields: [
      { key: "pautas", label: "Observaciones", kind: "text", detailPlaceholder: "Descanso, posicionamiento, preferencias, cualquier otra cosa que el equipo deba saber…" },
    ],
  },
];

// ─── Utilidades ──────────────────────────────────────────────────────────────

export function selList(v: CareFieldValue | undefined): string[] {
  if (!v?.sel) return [];
  return Array.isArray(v.sel) ? v.sel : [v.sel];
}

export function fieldHasData(v: CareFieldValue | undefined): boolean {
  return selList(v).length > 0 || !!v?.text?.trim();
}

export function sectionHasData(data: CareGuideData, s: CareSectionDef): boolean {
  return s.fields.some((f) => fieldHasData(data[s.key]?.[f.key]));
}

// Texto para mostrar un campo: "Supervisión — andador del centro".
export function fieldDisplay(f: CareFieldDef, v: CareFieldValue | undefined): string {
  const parts = selList(v);
  const text = v?.text?.trim();
  if (f.kind === "text") return text ?? "";
  if (f.kind === "single") return [parts[0], text].filter(Boolean).join(" — ");
  return [...parts, ...(text ? [text] : [])].join(", ");
}

// Limpia lo que llega del navegador: solo apartados/campos conocidos y
// opciones válidas; textos recortados a un tamaño razonable.
export function cleanCareGuide(input: unknown): CareGuideData {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: CareGuideData = {};
  for (const s of CARE_SECTIONS) {
    const sec = (src[s.key] && typeof src[s.key] === "object" ? src[s.key] : {}) as Record<string, unknown>;
    const cleanSec: Record<string, CareFieldValue> = {};
    for (const f of s.fields) {
      const raw = (sec[f.key] && typeof sec[f.key] === "object" ? sec[f.key] : {}) as Record<string, unknown>;
      const value: CareFieldValue = {};
      const text = typeof raw.text === "string" ? raw.text.slice(0, f.kind === "text" ? 4000 : 500) : "";
      if (text.trim()) value.text = text;
      const opts = f.options ?? [];
      if (f.kind === "single" && typeof raw.sel === "string" && opts.includes(raw.sel)) value.sel = raw.sel;
      if (f.kind === "multi" && Array.isArray(raw.sel)) {
        const chosen = opts.filter((o) => (raw.sel as unknown[]).includes(o));
        if (chosen.length) value.sel = chosen;
      }
      if (fieldHasData(value)) cleanSec[f.key] = value;
    }
    if (Object.keys(cleanSec).length) out[s.key] = cleanSec;
  }
  return out;
}

export function parseCareGuide(json: string | null | undefined): CareGuideData {
  if (!json) return {};
  try {
    return cleanCareGuide(JSON.parse(json));
  } catch {
    return {};
  }
}
