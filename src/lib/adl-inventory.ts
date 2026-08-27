// ─────────────────────────────────────────────────────────────────────────────
// Inventario de AVDs  (escala cualitativa — solo recurso "Asociación EM" /
// clasificación "Asociación")
//
// A diferencia de las escalas numéricas (Barthel, VAVDI, MFIS…), esta NO tiene
// puntuación total. Es un inventario cualitativo: por cada actividad se registra
// un semáforo de autonomía, texto de desempeño y apoyos, dos casillas
// (vigilancia / prioridad) y un semáforo de modificaciones respecto a la
// valoración anterior. Al final, una percepción + conclusión global de autonomía.
//
// Este archivo es la ÚNICA fuente de verdad del contenido clínico (secciones e
// ítems). El formulario de captura, la vista de lectura y el informe lo
// consumen desde aquí, sin duplicar la lista de ítems.
// ─────────────────────────────────────────────────────────────────────────────

export const ADL_INVENTORY_SCALE = "Inventario de AVDs" as const;

// ─── Semáforos (opciones de las columnas de color) ──────────────────────────

export type TrafficLight = "verde" | "amarillo" | "rojo";

// 1) Estado de autonomía
export const AUTONOMY_OPTIONS: { value: TrafficLight; label: string; help: string }[] = [
  {
    value: "verde",
    label: "Autonomía",
    help: "Realiza la actividad por sí misma, con independencia de las dificultades, estrategias o ayudas técnicas que use.",
  },
  {
    value: "amarillo",
    label: "Autonomía en algunas tareas y dependencia en otras",
    help: "Es autónoma en parte de las tareas de la actividad y dependiente en otras.",
  },
  {
    value: "rojo",
    label: "Dependencia",
    help: "Necesita el apoyo externo de una tercera persona para realizar la actividad.",
  },
];

// 6) Modificaciones respecto a la valoración anterior
export const MODIFICATION_OPTIONS: { value: TrafficLight; label: string }[] = [
  { value: "rojo", label: "Empeora en su estado de autonomía" },
  { value: "amarillo", label: "Empeora en su desempeño" },
  { value: "verde", label: "Mejora en autonomía o desempeño" },
];

// 7) Percepción y conclusión (foco en la AUTONOMÍA — indicador de proyectos)
export const CONCLUSION_OPTIONS: { value: TrafficLight; label: string }[] = [
  { value: "rojo", label: "Empeora autonomía" },
  { value: "amarillo", label: "Mantiene autonomía" },
  { value: "verde", label: "Mejora autonomía" },
];

// Color hex de cada semáforo (para chips/celdas; un único sitio donde tocarlos).
export const TRAFFIC_LIGHT_COLORS: Record<TrafficLight, { bg: string; text: string; border: string; dot: string }> = {
  verde: { bg: "#e7f5ec", text: "#14532d", border: "#bbe2c7", dot: "#16a34a" },
  amarillo: { bg: "#fef7e0", text: "#7a5900", border: "#f5e2a3", dot: "#eab308" },
  rojo: { bg: "#fdeaea", text: "#7f1d1d", border: "#f3c2c2", dot: "#dc2626" },
};

// ─── Columnas por ítem (metadatos, para cabeceras y ayuda contextual) ────────

export const ADL_INVENTORY_COLUMNS = [
  { key: "autonomy", label: "Estado de autonomía", kind: "traffic" as const },
  { key: "desempeno", label: "Desempeño / cambios", kind: "text" as const },
  { key: "apoyos", label: "Apoyos", kind: "text" as const },
  { key: "vigilancia", label: "Vigilancia", kind: "check" as const },
  { key: "prioridad", label: "Prioridad / objetivo", kind: "check" as const },
  { key: "modificacion", label: "Modificaciones respecto a valoración anterior", kind: "traffic" as const },
];

// ─── Estructura: bloques → secciones → ítems ────────────────────────────────

export type AdlBlock = "AVD" | "AIVD";

export type AdlInventoryItem = { id: string; label: string };

export type AdlInventorySection = {
  id: string;
  title: string;
  block: AdlBlock;
  // Casi todas las secciones permiten añadir filas "Otras" a mano.
  allowCustom: boolean;
  items: AdlInventoryItem[];
  // Nota opcional que se muestra bajo el título (p. ej. en Productividad).
  note?: string;
};

export const ADL_INVENTORY_SECTIONS: AdlInventorySection[] = [
  // ── AVD básicas ──────────────────────────────────────────────────────────
  {
    id: "alimentacion",
    title: "Alimentación",
    block: "AVD",
    allowCustom: true,
    items: [
      { id: "manejo_cuchara", label: "Manejo cuchara" },
      { id: "manejo_tenedor", label: "Manejo tenedor" },
      { id: "cortar_comida", label: "Cortar comida" },
      { id: "uso_vaso", label: "Uso de vaso" },
      { id: "llevar_comida_boca", label: "Llevar comida/vaso a la boca" },
    ],
  },
  {
    id: "aseo_higiene",
    title: "Aseo e higiene personal",
    block: "AVD",
    allowCustom: true,
    items: [
      { id: "ducha", label: "Ducha (entrar y salir, enjabonarse cuerpo)" },
      { id: "lavar_secar_pelo", label: "Lavar y secar pelo" },
      { id: "lavarse_dientes", label: "Lavarse los dientes" },
      { id: "wc", label: "WC (uso, higiene y vestido)" },
      { id: "cortarse_unas", label: "Cortarse las uñas" },
      { id: "peinarse", label: "Peinarse" },
      { id: "echarse_crema", label: "Echarse crema" },
      { id: "maquillarse", label: "Maquillarse" },
      { id: "afeitarse_depilarse", label: "Afeitarse/depilarse" },
    ],
  },
  {
    id: "vestido",
    title: "Vestido",
    block: "AVD",
    allowCustom: true,
    items: [
      { id: "parte_arriba", label: "Parte de arriba" },
      { id: "parte_abajo", label: "Parte de abajo" },
      { id: "ropa_interior", label: "Ropa interior" },
      { id: "chaqueta_abrigo", label: "Chaqueta y abrigo" },
      { id: "calzarse_cordones", label: "Calzarse/cordones" },
      { id: "botones_cremalleras", label: "Botones y cremalleras" },
      { id: "elegir_ropa", label: "Elegir ropa" },
    ],
  },
  {
    id: "movilidad",
    title: "Movilidad y desplazamientos",
    block: "AVD",
    allowCustom: true,
    items: [
      { id: "desplazarse", label: "Desplazarse (trayectos cortos, medios y largos)" },
      { id: "subir_bajar_escaleras", label: "Subir/bajar escaleras" },
      { id: "transferencias", label: "Transferencias (sofá, cama, WC, coche, etc.)" },
      { id: "acostarse_incorporarse", label: "Acostarse e incorporarse de la cama" },
      { id: "volteos_cama", label: "Volteos en la cama" },
    ],
  },

  // ── AIVD (instrumentales) ─────────────────────────────────────────────────
  {
    id: "cocinar",
    title: "Cocinar",
    block: "AIVD",
    allowCustom: true,
    items: [
      { id: "planificar_comida", label: "Planificar comida" },
      { id: "preparar_comida", label: "Preparar comida" },
      { id: "poner_mesa", label: "Poner la mesa" },
    ],
  },
  {
    id: "compra",
    title: "Hacer la compra",
    block: "AIVD",
    allowCustom: true,
    items: [
      { id: "lista_compra", label: "Hacer la lista de la compra" },
      { id: "ir_supermercado", label: "Ir al supermercado" },
      { id: "encontrar_productos", label: "Encontrar los productos" },
      { id: "pagar", label: "Pagar" },
    ],
  },
  {
    id: "hogar",
    title: "Mantenimiento del hogar",
    block: "AIVD",
    allowCustom: true,
    items: [
      { id: "hacer_cama", label: "Hacer la cama" },
      { id: "lavar_platos", label: "Lavar platos/uso lavavajillas" },
      { id: "barrer_fregar_aspirador", label: "Barrer/fregar/aspirador" },
      { id: "poner_lavadora", label: "Poner lavadora" },
      { id: "tender_ropa", label: "Tender la ropa" },
      { id: "planchar", label: "Planchar" },
      { id: "limpieza_banos", label: "Limpieza de baños" },
    ],
  },
  {
    id: "comunicacion",
    title: "Comunicación y nuevas tecnologías",
    block: "AIVD",
    allowCustom: true,
    items: [
      { id: "movil", label: "Uso del teléfono móvil" },
      { id: "pc", label: "Uso de PC" },
      { id: "tablet", label: "Uso de tablet" },
      { id: "internet_apps", label: "Uso de internet y apps" },
    ],
  },
  {
    id: "transporte",
    title: "Transporte",
    block: "AIVD",
    allowCustom: true,
    items: [
      { id: "conducir", label: "Conducir" },
      { id: "acceder_coche", label: "Acceder al coche" },
      { id: "taxi", label: "Taxi" },
      { id: "transporte_publico", label: "Transporte público" },
    ],
  },
  {
    id: "otras_tareas",
    title: "Otras tareas",
    block: "AIVD",
    allowCustom: true,
    items: [
      { id: "gestion_economica", label: "Gestión económica (bancos, manejo dinero, etc.)" },
      { id: "cuidado_mascotas", label: "Cuidado de mascotas" },
      { id: "cuidado_otros", label: "Cuidado de otros" },
      { id: "manejo_medicacion", label: "Manejo de medicación" },
      { id: "gestion_salud", label: "Gestión de la salud" },
      { id: "tramites_burocraticos", label: "Trámites burocráticos (pedir citas médicas, solicitar prestaciones, etc.)" },
      { id: "escritura", label: "Escritura" },
      { id: "lectura", label: "Lectura" },
    ],
  },
  {
    id: "ocio",
    title: "Ocio / participación social",
    block: "AIVD",
    allowCustom: true,
    items: [
      { id: "identificacion_intereses", label: "Identificación de intereses" },
      { id: "seleccion_actividades", label: "Selección de actividades de ocio" },
      { id: "participacion_actividades", label: "Participación en actividades de ocio" },
    ],
  },
  {
    id: "productividad",
    title: "Productividad",
    block: "AIVD",
    allowCustom: true,
    note: "Incluye lo que la persona considere productividad (voluntariado, venir a la asociación, una rutina determinada, etc.).",
    items: [
      { id: "empleo", label: "Empleo" },
      { id: "estudios", label: "Estudios" },
    ],
  },
];

// ─── Forma de los datos guardados (JSON en Assessment.inventoryData) ─────────

export type AdlItemData = {
  autonomy: TrafficLight | null;
  desempeno: string;
  apoyos: string;
  vigilancia: boolean;
  prioridad: boolean;
  modificacion: TrafficLight | null;
};

// Fila "Otras" añadida a mano por el/la profesional dentro de una sección.
export type AdlCustomRow = AdlItemData & {
  id: string; // id único de la fila
  sectionId: string; // sección a la que pertenece
  label: string; // nombre de la actividad escrito a mano
};

export type AdlInventoryData = {
  version: 1;
  // Datos por ítem fijo, indexados por id de ítem.
  items: Record<string, AdlItemData>;
  // Filas "Otras" añadidas a mano.
  customRows: AdlCustomRow[];
  // Bloque final (ítem 7).
  perception: string; // percepción de la persona sobre su autonomía
  conclusion: TrafficLight | null; // conclusión global de autonomía (indicador)
};

export function emptyAdlItemData(): AdlItemData {
  return {
    autonomy: null,
    desempeno: "",
    apoyos: "",
    vigilancia: false,
    prioridad: false,
    modificacion: null,
  };
}

// Construye un inventario vacío con todas las secciones/ítems inicializados.
export function buildEmptyAdlInventory(): AdlInventoryData {
  const items: Record<string, AdlItemData> = {};
  for (const section of ADL_INVENTORY_SECTIONS) {
    for (const item of section.items) {
      items[item.id] = emptyAdlItemData();
    }
  }
  return {
    version: 1,
    items,
    customRows: [],
    perception: "",
    conclusion: null,
  };
}

// Parseo defensivo: acepta el JSON guardado (o null) y devuelve un inventario
// completo, rellenando lo que falte. Así, si en el futuro se añaden ítems, las
// valoraciones antiguas se leen sin romperse.
export function parseAdlInventory(raw: string | null | undefined): AdlInventoryData {
  const base = buildEmptyAdlInventory();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<AdlInventoryData>;
    return {
      version: 1,
      items: { ...base.items, ...(parsed.items ?? {}) },
      customRows: Array.isArray(parsed.customRows) ? parsed.customRows : [],
      perception: parsed.perception ?? "",
      conclusion: (parsed.conclusion ?? null) as TrafficLight | null,
    };
  } catch {
    return base;
  }
}

// ─── Resumen corto para la lista/historial (campo `score` de Assessment) ─────
// El campo `score` es obligatorio en la tabla; para esta escala no hay número,
// así que guardamos un resumen legible (nº de actividades con dependencia /
// en vigilancia / marcadas como prioridad).
export function summarizeAdlInventory(data: AdlInventoryData): string {
  const all = [...Object.values(data.items), ...data.customRows];
  const evaluadas = all.filter((i) => i.autonomy !== null).length;
  const dependencia = all.filter((i) => i.autonomy === "rojo").length;
  const prioridad = all.filter((i) => i.prioridad).length;
  return `${evaluadas} eval. · ${dependencia} dep. · ${prioridad} prior.`;
}
