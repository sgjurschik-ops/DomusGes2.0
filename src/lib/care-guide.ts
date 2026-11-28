// Guía de cuidados (Centro de día): resumen práctico de apoyos y cuidados de
// cada persona. Se rellena casi todo pulsando opciones (con iconos) y se
// imprime / guarda en PDF como hoja de referencia del equipo.
//
// Archivo compartido entre navegador y servidor: apartados, campos, opciones,
// iconos y limpieza de los datos que se guardan.

// ─── Iconos (dibujos de línea 24×24, trazo = color del texto) ────────────────
// Se guardan como el interior de un <svg>, para usarlos igual en pantalla y
// en la hoja impresa.
export const CARE_ICONS = {
  movilidad: "<circle cx=\"13\" cy=\"4.5\" r=\"1.8\"></circle><path d=\"M11.5 8l-2 6 3 2.5 1 5.5M9.5 14l-2.5 7M12 8.5l4 3 3-.5M10 9.5l-3.5 2\"></path>",
  alimentacion: "<path d=\"M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2.5 1.5-3.5 4.5-3.5 8h3.5v10\"></path>",
  higiene: "<path d=\"M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z\"></path><path d=\"M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5\"></path>",
  vestido: "<path d=\"M8.5 3L3 6l2 4.5 3-1V21h8V9.5l3 1L21 6l-5.5-3a3.5 3.5 0 0 1-7 0z\"></path>",
  comunicacion: "<path d=\"M4 5h16v11H10l-5 4v-4H4z\"></path><path d=\"M8 9.5h8M8 12.5h5\"></path>",
  conducta: "<circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M15.5 8.5l-2 5-5 2 2-5z\"></path>",
  otros: "<path d=\"M6 3h9l4 4v14H6z\"></path><path d=\"M14.5 3v4.5H19M9 12h7M9 16h5\"></path>",
  autonomo: "<circle cx=\"12\" cy=\"6\" r=\"2.6\"></circle><path d=\"M7 21v-4.5a5 5 0 0 1 10 0V21\"></path>",
  supervision: "<path d=\"M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z\"></path><circle cx=\"12\" cy=\"12\" r=\"2.8\"></circle>",
  guiaverbal: "<path d=\"M4 5h16v11H10l-5 4v-4H4z\"></path><path d=\"M8 9.5h8M8 12.5h5\"></path>",
  ayuda1: "<path d=\"M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 3.9-2.7 7-6 7-2.4 0-3.9-1.2-5.2-3.5L4 14.2a1.5 1.5 0 0 1 2.6-1.5L8 15\"></path>",
  ayuda2: "<circle cx=\"8\" cy=\"7\" r=\"2.3\"></circle><circle cx=\"16\" cy=\"7\" r=\"2.3\"></circle><path d=\"M3.5 20v-3a4.5 4.5 0 0 1 9 0v3M11.5 20v-3a4.5 4.5 0 0 1 9 0v3\"></path>",
  baston: "<path d=\"M10 21V8a3 3 0 0 1 6 0v1.5\"></path>",
  andador: "<path d=\"M6 20V8.5h12V20M6 8.5L7.5 4h9L18 8.5M6 13.5h12\"></path><circle cx=\"6\" cy=\"20.5\" r=\"1\"></circle><circle cx=\"18\" cy=\"20.5\" r=\"1\"></circle>",
  silla: "<circle cx=\"9.5\" cy=\"16\" r=\"5\"></circle><circle cx=\"18.5\" cy=\"19.5\" r=\"1.4\"></circle><path d=\"M7 3v8h7.5l2.5 6.5h2M7 11h9\"></path>",
  vaso: "<path d=\"M5 4h4.5l2.5 3.5L14.5 4H19l-2 16H7z\"></path>",
  plato: "<circle cx=\"12\" cy=\"13\" r=\"7.5\"></circle><circle cx=\"12\" cy=\"13\" r=\"4\"></circle><path d=\"M4.5 10.5a8 8 0 0 1 15 0\" stroke-width=\"3\"></path>",
  antideslizante: "<rect x=\"3.5\" y=\"6\" width=\"17\" height=\"12\" rx=\"2\"></rect><circle cx=\"8\" cy=\"10\" r=\".6\"></circle><circle cx=\"12\" cy=\"10\" r=\".6\"></circle><circle cx=\"16\" cy=\"10\" r=\".6\"></circle><circle cx=\"8\" cy=\"14\" r=\".6\"></circle><circle cx=\"12\" cy=\"14\" r=\".6\"></circle><circle cx=\"16\" cy=\"14\" r=\".6\"></circle>",
  cuchara: "<ellipse cx=\"12\" cy=\"7\" rx=\"3\" ry=\"4\"></ellipse><path d=\"M12 11v10\"></path>",
  espesante: "<rect x=\"6.5\" y=\"7\" width=\"11\" height=\"14\" rx=\"1.5\"></rect><path d=\"M7.5 3.5h9V7h-9zM9.5 12h5M9.5 15h5\"></path>",
  absorbente: "<path d=\"M3.5 6h17l-2.5 9a6.5 6.5 0 0 1-12 0z\"></path><path d=\"M8 6v3M16 6v3\"></path>",
  barras: "<path d=\"M4 4v16\"></path><path d=\"M4 9h11a2 2 0 0 1 0 4H4\" ></path>",
  ducha: "<path d=\"M6 11h12M8 11v9M16 11v9M6 11V4.5M6 4.5h3\"></path><path d=\"M9.5 14h5\"></path>",
  gafas: "<circle cx=\"7\" cy=\"14\" r=\"3.5\"></circle><circle cx=\"17\" cy=\"14\" r=\"3.5\"></circle><path d=\"M10.5 14h3M3.5 13.5L2.5 9M20.5 13.5l1-4.5\"></path>",
  audifono: "<path d=\"M7 10a5 5 0 0 1 10 0c0 3-3 3.5-3 7a3 3 0 0 1-5.5 1.5\"></path><path d=\"M10 10a2 2 0 0 1 4 0\"></path>",
  pictos: "<rect x=\"3.5\" y=\"3.5\" width=\"7.5\" height=\"7.5\" rx=\"1.5\"></rect><rect x=\"13\" y=\"3.5\" width=\"7.5\" height=\"7.5\" rx=\"1.5\"></rect><rect x=\"3.5\" y=\"13\" width=\"7.5\" height=\"7.5\" rx=\"1.5\"></rect><rect x=\"13\" y=\"13\" width=\"7.5\" height=\"7.5\" rx=\"1.5\"></rect>",
  reloj: "<circle cx=\"12\" cy=\"12\" r=\"8.5\"></circle><path d=\"M12 7.5V12l3 2\"></path>",
  caida: "<circle cx=\"15.5\" cy=\"4.5\" r=\"1.8\"></circle><path d=\"M14.5 8l-4.5 3.5 3 3-2 5.5M10 11.5l-5 .5M13 14.5l5 1.5M3 21.5h18\"></path>",
  alergia: "<path d=\"M12 3.5l9.5 17h-19z\"></path><path d=\"M12 10v4.5M12 17.5v.5\"></path>",
  atragantamiento: "<path d=\"M9 3c-2.5 2-3 5-1.5 8 1 2 1 4-.5 6.5M15 3c2.5 2 3 5 1.5 8-1 2-1 4 .5 6.5\"></path><path d=\"M10 13h4\"></path>",
  desorientacion: "<path d=\"M4 21V3h9v18\"></path><path d=\"M13 12h8M18 9l3 3-3 3\"></path><circle cx=\"10.5\" cy=\"12\" r=\".6\"></circle>",
  crisis: "<path d=\"M13 2.5L4.5 14h7l-1 7.5L19 10h-7z\"></path>",
  diabetes: "<path d=\"M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z\"></path><path d=\"M12 11v6M9 14h6\"></path>",
  piel: "<path d=\"M5 15.5L15.5 5a3 3 0 0 1 4.2 4.2L9.2 19.7A3 3 0 0 1 5 15.5z\"></path><path d=\"M10 10l4 4\"></path>",} as const;
export type CareIconName = keyof typeof CARE_ICONS;

export function careIconSvg(name: CareIconName, size: number, color = "currentColor", strokeWidth = 1.7): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CARE_ICONS[name]}</svg>`;
}

// ─── Estructura ──────────────────────────────────────────────────────────────

// level  → nivel de apoyo: uno o varios (p. ej. supervisión + guía verbal),
//          botones grandes con icono
// choice → una opción entre pocas (p. ej. Sí / No), botones pequeños
// chips  → varias opciones de texto
// tiles  → varias opciones con icono (ayudas técnicas)
// alerts → alertas: varias opciones con icono + un detalle por cada una
// text   → texto libre (pautas)
export type CareFieldKind = "level" | "choice" | "chips" | "tiles" | "alerts" | "text";

export interface CareOption {
  label: string;
  icon?: CareIconName;
}

export interface CareFieldDef {
  key: string;
  label: string;
  kind: CareFieldKind;
  options?: readonly CareOption[];
  placeholder?: string;
}

export interface CareSectionDef {
  key: string;
  title: string;
  icon: CareIconName;
  band: string; // fondo de la franja
  tone: string; // color de los iconos
  fields: readonly CareFieldDef[];
}

export interface CareFieldValue {
  sel?: string | string[];
  text?: string;
  details?: Record<string, string>; // solo alertas: detalle por alerta
}
export type CareGuideData = Record<string, Record<string, CareFieldValue>>;

export interface CareGuideDTO {
  data: CareGuideData;
  updatedAt: string | null;
  updatedByName: string | null;
}

export const ALERT_RED = "#b42318";

const o = (label: string, icon?: CareIconName): CareOption => ({ label, icon });

const LEVELS: readonly CareOption[] = [
  o("Autónomo/a", "autonomo"), o("Supervisión", "supervision"), o("Guía verbal", "guiaverbal"),
  o("Ayuda parcial", "ayuda1"), o("Ayuda total", "ayuda2"),
];
const MOBILITY_LEVELS: readonly CareOption[] = [
  o("Autónomo/a", "autonomo"), o("Supervisión", "supervision"),
  o("Ayuda de 1 persona", "ayuda1"), o("Ayuda de 2 personas", "ayuda2"),
];
const PAUTAS = "Pautas";
const DETAIL = "Detalle (opcional)";

export const ALERTS_SECTION: CareSectionDef = {
  key: "alertas",
  title: "Alertas importantes",
  icon: "alergia",
  band: "#fdecea",
  tone: ALERT_RED,
  fields: [
    {
      key: "alertas", label: "Alertas", kind: "alerts",
      options: [
        o("Riesgo de caídas", "caida"), o("Alergias", "alergia"), o("Riesgo de atragantamiento", "atragantamiento"),
        o("Riesgo de desorientación / salida", "desorientacion"), o("Crisis epilépticas", "crisis"),
        o("Diabetes", "diabetes"), o("Piel frágil / úlceras", "piel"),
      ],
      placeholder: "Otras alertas",
    },
  ],
};

export const CARE_SECTIONS: readonly CareSectionDef[] = [
  {
    key: "movilidad", title: "Movilidad - Transferencias", icon: "movilidad", band: "#fdf0b5", tone: "#8a6a00",
    fields: [
      { key: "trasladosCortos", label: "Traslados cortos", kind: "level", options: MOBILITY_LEVELS, placeholder: DETAIL },
      { key: "trasladosLargos", label: "Traslados largos", kind: "level", options: MOBILITY_LEVELS, placeholder: DETAIL },
      { key: "transferencias", label: "Transferencias", kind: "level", options: MOBILITY_LEVELS, placeholder: DETAIL },
      {
        key: "ayudas", label: "Ayudas técnicas", kind: "tiles",
        options: [
          o("Bastón", "baston"), o("Muletas", "baston"), o("Andador", "andador"), o("Rollator", "andador"),
          o("Silla de ruedas", "silla"), o("Silla eléctrica", "silla"), o("Disco giratorio"), o("Grúa"),
        ],
        placeholder: "Otras / detalles (p. ej. lado izquierdo afectado)",
      },
      { key: "pautas", label: PAUTAS, kind: "text", placeholder: "Cómo ayudar en traslados y transferencias…" },
    ],
  },
  {
    key: "alimentacion", title: "Alimentación", icon: "alimentacion", band: "#fde2c8", tone: "#9a4a12",
    fields: [
      { key: "apoyos", label: "Apoyos", kind: "level", options: LEVELS, placeholder: DETAIL },
      { key: "textura", label: "Textura", kind: "choice", options: [o("Normal"), o("Blanda"), o("Picada"), o("Triturada")], placeholder: DETAIL },
      { key: "espesante", label: "Espesante", kind: "choice", options: [o("No"), o("Sí")], placeholder: "Cantidad (p. ej. 1 cucharadita)" },
      {
        key: "ayudas", label: "Ayudas técnicas", kind: "tiles",
        options: [
          o("Tope para el plato", "plato"), o("Plato con reborde", "plato"), o("Antideslizante", "antideslizante"),
          o("Vaso con escotadura", "vaso"), o("Vaso con asas", "vaso"), o("Cuchara pequeña", "cuchara"),
          o("Cubiertos adaptados", "cuchara"), o("Espesante", "espesante"),
        ],
        placeholder: "Otras",
      },
      { key: "pautas", label: PAUTAS, kind: "text", placeholder: "Ambiente, ritmo, cantidades…" },
    ],
  },
  {
    key: "higiene", title: "Higiene personal y WC", icon: "higiene", band: "#d6e9f8", tone: "#1f5694",
    fields: [
      {
        key: "apoyos", label: "Apoyos", kind: "level",
        options: [o("Autónomo/a", "autonomo"), o("Supervisión", "supervision"), o("Acompañamiento", "guiaverbal"), o("Ayuda parcial", "ayuda1"), o("Ayuda total", "ayuda2")],
        placeholder: DETAIL,
      },
      { key: "absorbentes", label: "Absorbentes", kind: "choice", options: [o("No"), o("Sí"), o("Solo de noche"), o("Ocasional")], placeholder: DETAIL },
      {
        key: "ayudas", label: "Ayudas técnicas", kind: "tiles",
        options: [o("Absorbente", "absorbente"), o("Barras de apoyo", "barras"), o("Alza de WC"), o("Silla de ducha", "ducha"), o("Esponja de mango largo")],
        placeholder: "Otras (o «valorar»)",
      },
      { key: "pautas", label: PAUTAS, kind: "text", placeholder: "Guía verbal, qué observar…" },
    ],
  },
  {
    key: "vestido", title: "Vestido", icon: "vestido", band: "#e7e1f7", tone: "#5b3bb0",
    fields: [
      { key: "apoyos", label: "Apoyos", kind: "level", options: LEVELS, placeholder: DETAIL },
      {
        key: "ayudas", label: "Ayudas técnicas", kind: "tiles",
        options: [o("Calzador largo"), o("Abotonador"), o("Calzado con velcro"), o("Ponemedias")],
        placeholder: "Otras",
      },
      { key: "pautas", label: PAUTAS, kind: "text", placeholder: "Orden de las prendas, lado afectado…" },
    ],
  },
  {
    key: "comunicacion", title: "Comunicación - Sensorial", icon: "comunicacion", band: "#d7efc4", tone: "#2f6b1f",
    fields: [
      {
        key: "apoyos", label: "Apoyos", kind: "chips",
        options: [o("Respetar tiempos de respuesta"), o("Frases cortas y sencillas"), o("Hablar de frente"), o("Apoyo visual"), o("Confirmar que ha entendido")],
        placeholder: "Otros",
      },
      {
        key: "ayudas", label: "Ayudas técnicas", kind: "tiles",
        options: [o("Gafas", "gafas"), o("Audífono", "audifono"), o("Pictogramas", "pictos"), o("Tablero de comunicación", "pictos"), o("Reloj o agenda visual", "reloj")],
        placeholder: "Otras (o «no precisa por el momento»)",
      },
      { key: "pautas", label: PAUTAS, kind: "text", placeholder: "Cómo comunicarse mejor con la persona…" },
    ],
  },
  {
    key: "conducta", title: "Orientación - Conducta", icon: "conducta", band: "#f7dce8", tone: "#93306d",
    fields: [
      {
        key: "apoyos", label: "Apoyos", kind: "chips",
        options: [o("Recordatorios"), o("Orientación en tiempo y lugar"), o("Rutina estable"), o("Evitar ruido y estímulos"), o("Acompañar en cambios de actividad")],
        placeholder: "Otros",
      },
      { key: "pautas", label: PAUTAS, kind: "text", placeholder: "Qué le tranquiliza, qué evitar…" },
    ],
  },
  {
    key: "otros", title: "Otras indicaciones", icon: "otros", band: "#e6e9ec", tone: "#475569",
    fields: [
      { key: "pautas", label: "Observaciones", kind: "text", placeholder: "Descanso, posicionamiento, preferencias…" },
    ],
  },
];

export const ALL_CARE_SECTIONS: readonly CareSectionDef[] = [ALERTS_SECTION, ...CARE_SECTIONS];

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

export function optionIcon(f: CareFieldDef, label: string, fallback: CareIconName): CareIconName {
  return f.options?.find((op) => op.label === label)?.icon ?? fallback;
}

const isSingle = (k: CareFieldKind) => k === "choice";
const isMulti = (k: CareFieldKind) => k === "level" || k === "chips" || k === "tiles" || k === "alerts";

// Limpia lo que llega del navegador: solo apartados, campos y opciones
// conocidos; textos recortados a un tamaño razonable.
export function cleanCareGuide(input: unknown): CareGuideData {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: CareGuideData = {};
  for (const s of ALL_CARE_SECTIONS) {
    const sec = (src[s.key] && typeof src[s.key] === "object" ? src[s.key] : {}) as Record<string, unknown>;
    const cleanSec: Record<string, CareFieldValue> = {};
    for (const f of s.fields) {
      const raw = (sec[f.key] && typeof sec[f.key] === "object" ? sec[f.key] : {}) as Record<string, unknown>;
      const labels = (f.options ?? []).map((op) => op.label);
      const value: CareFieldValue = {};
      const text = typeof raw.text === "string" ? raw.text.slice(0, f.kind === "text" ? 4000 : 500) : "";
      if (text.trim()) value.text = text;
      if (isSingle(f.kind) && typeof raw.sel === "string" && labels.includes(raw.sel)) value.sel = raw.sel;
      // Los niveles de apoyo antes eran de una sola opción: se acepta también
      // un texto suelto y se convierte en lista.
      const rawSel = f.kind === "level" && typeof raw.sel === "string" ? [raw.sel] : raw.sel;
      if (isMulti(f.kind) && Array.isArray(rawSel)) {
        const chosen = labels.filter((l) => (rawSel as unknown[]).includes(l));
        if (chosen.length) value.sel = chosen;
      }
      if (f.kind === "alerts" && raw.details && typeof raw.details === "object") {
        const details: Record<string, string> = {};
        for (const l of selList(value)) {
          const d = (raw.details as Record<string, unknown>)[l];
          if (typeof d === "string" && d.trim()) details[l] = d.slice(0, 300);
        }
        if (Object.keys(details).length) value.details = details;
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
