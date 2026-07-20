// Structured ADL/IADL scales — Barthel, Lawton-Brody, VAVDI.
//
// Each scale defines its items (with per-item score options), how to
// compute the total from item scores, and how to turn that total into a
// clinical interpretation label. This is the single source of truth used
// by the assessment form (per-item inputs + live total) and can later be
// reused by any report/printout without duplicating the clinical content.

// `shortLabel` is the compact clinical word used in the read-only summary
// (e.g. "Independiente", "Dependencia parcial") — `label` stays the full
// descriptive sentence shown in the dropdown while answering. `description`
// is the official, item-specific behavioral anchor (only present for VAVDI,
// from the original VAVDI 2009-2015 instrument by Lic. T.O. Mariel
// Pellegrini) — shown as a tooltip so the professional can see the exact
// criteria for that score without memorizing all 15 items' anchors.
export type ScaleOption = { value: number; label: string; shortLabel: string; description?: string };
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
  // Whether a higher total score means MORE independence/autonomy.
  // Barthel and Lawton-Brody: higher = more independent.
  // VAVDI: higher = MORE support needed (lower = more autonomy), so it's
  // the opposite direction — this flag lets trend displays (e.g. the
  // evolution chart) show improvement/decline correctly per scale instead
  // of assuming "higher is always better".
  higherIsBetter: boolean;
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
  higherIsBetter: true,
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
  higherIsBetter: true,
};

// ─── VAVDI (AVD básicas + instrumentales, nivel de apoyo) ───────────────────
//
// Item-specific behavioral anchors transcribed from the official VAVDI
// (2009-2015, Lic. T.O. Mariel Pellegrini) instrument — each item has its
// own 1-5 description, unlike a single shared scale. Kept as `description`
// (shown as a tooltip) alongside the existing `shortLabel`/`label` so the
// stored item scores (1-5) and downstream calculations are unaffected.

function vavdiOptions(descriptions: string[]): ScaleOption[] {
  const shortLabels = ["Autónomo", "Supervisión mínima", "Ayuda moderada", "Ayuda importante", "Dependiente"];
  return descriptions.map((description, i) => ({
    value: i + 1,
    label: `${shortLabels[i]} — ${description.slice(0, 70)}${description.length > 70 ? "…" : ""}`,
    shortLabel: shortLabels[i],
    description,
  }));
}

const VAVDI_BASIC_ITEMS: ScaleItem[] = [
  {
    id: "bathing",
    label: "Bañarse o ducharse",
    options: vavdiOptions([
      "Se baña sin asistencia, utiliza jabón, shampoo, etc., o se enjuaga y seca sin dificultad todo el cuerpo, o mantiene la posición del cuerpo sin riesgo y transfiere desde y hacia la bañera.",
      "Se enjabona sólo una parte del cuerpo (ej. delantera), o no se enjuaga o seca todo el cuerpo, o descuida verificar la temperatura correcta del agua, o se transfiere con algunos descuidos pero sin riesgo de caída.",
      "Se lava sólo algunas partes del cuerpo o en acciones repetidas sin atención a los detalles, o no se enjabona/enjuaga el cuerpo si no tiene una dirección verbal o táctil, o se transfiere desde y hacia la bañera con riesgo de caída.",
      "Necesita asistencia completa de terceros, o entra a la bañera y no trata de lavarse, o recibe pasivamente la asistencia de terceros sin resistencia.",
      "Rechaza entrar a la ducha o bañera, o debe ser asistido completamente por terceros.",
    ]),
  },
  {
    id: "bladder_bowel",
    label: "Control de vejiga e intestino",
    options: vavdiOptions([
      "Realiza la actividad sin dificultad (en salas de baño no familiares), o realiza el cuidado de las necesidades menstruales sin asistencia, o anticipa sus necesidades urinarias/intestinales y/o menstruales.",
      "Realiza la actividad sin dificultad en salas de baño familiares (si no requiere supervisión), o requiere recordatorio para cuidados menstruales, o desperdicia papel higiénico o descuida detalles.",
      "Requiere recordatorio para ir al baño, o no se higieniza correctamente, o se niega a utilizar mudas, apósitos o papel higiénico.",
      "Utiliza el baño de manera inconsistente, o utiliza lugares inaceptables, o necesita asistencia para transferirse hacia y desde la posición del inodoro.",
      "No controla esfínteres.",
    ]),
  },
  {
    id: "grooming",
    label: "Higiene y arreglo personal",
    options: vavdiOptions([
      "Inicia y completa el arreglo personal sin asistencia, o anticipa necesidades o frecuencia, o tiene hábitos incorporados de higiene y arreglo personal.",
      "Inicia las tareas del arreglo pero saltea pasos que no son claramente visibles, o requiere recordatorio para utilizar elementos de higiene, o dificultad en anticipar necesidades fuera de la rutina diaria.",
      "Realiza el arreglo personal diario básico; no puede utilizar instrumentos cortantes en seguridad; algunas actividades deben ser recordadas (bañarse, cambiarse apósitos, utilizar desodorante...).",
      "Necesita apoyo total de terceros para su arreglo personal, puede cooperar con movimientos espontáneos de manos/pies/cabeza, o requiere recordatorio y asistencia para la higiene básica, o requiere asistencia para encontrar los elementos básicos.",
      "Ignora apariencia personal, o no reconoce la función de los elementos básicos de higiene, o requiere asistencia completa, o no coopera espontáneamente con sus cuidadores al ser asistido.",
    ]),
  },
  {
    id: "dressing",
    label: "Vestirse",
    options: vavdiOptions([
      "Selecciona su propia ropa y se viste adecuado a la hora del día y el tiempo, o puede obtener prendas y vestirse/desvestirse en secuencia, o se viste y selecciona accesorios adecuados a la ocasión.",
      "Se viste autónomamente, puede cometer errores menores en la selección, o no identifica la secuencia más óptima, o saltea detalles (amarrarse o ajustarse la ropa), o los colores/accesorios no están combinados.",
      "Se viste con apoyo de terceros, puede tener errores mayores en la selección, o necesita apoyo para la secuencia de vestido, o ignora condiciones del tiempo o costumbres sociales (ropa interior, abrocharse).",
      "Necesita ser vestido por terceros pero modifica espontáneamente las posiciones del cuerpo para facilitar el vestido, o puede resistirse inicialmente pero colabora.",
      "Debe ser vestido por sus cuidadores y no mueve espontáneamente partes del cuerpo para facilitar el vestido o desvestido, o puede presentarse desnudo sin registrarlo.",
    ]),
  },
  {
    id: "eating",
    label: "Alimentación y modales en la mesa",
    options: vavdiOptions([
      "Toma una cantidad adecuada de alimentos con cubiertos para masticar apropiadamente, o come a un ritmo normal y conversa temas adecuados, o tiene hábitos culturalmente aceptables en la mesa.",
      "Tiene modales en la mesa apropiados (usar servilleta, cubiertos...), o se sirve únicamente para él, o necesita recordatorio de comer a un ritmo normal.",
      "Utiliza cubiertos pero no se autocontrola y come aceleradamente, o no utiliza maneras socialmente aceptables.",
      "Toma cantidades groseras, o come con los dedos o sólo con cuchara, o hace ruidos molestos al comer.",
      "Mastica desprolijamente, o necesita indicaciones para comer, o necesita ser alimentado por terceros.",
    ]),
  },
  {
    id: "functional_mobility",
    label: "Movilidad funcional",
    options: vavdiOptions([
      "Se orienta y moviliza en ambientes nuevos fácilmente, o solicita orientación espontáneamente cuando lo necesita, o transporta objetos y ambula funcionalmente en diferentes espacios.",
      "Se moviliza en ambientes familiares sin perderse, o requiere indicaciones reiteradas en ambientes nuevos, o transporta objetos con dificultad y torpeza.",
      "Rechaza ir a lugares no familiares, o inicia caminar dentro de la casa sólo siguiendo indicaciones de otros, o no puede transportar objetos frágiles, o deambula funcionalmente sólo en espacios familiares.",
      "No pregunta y espera pasivamente para movilizarse, o requiere indicaciones de terceros para movilizarse sólo en ambientes familiares, o no puede transportar ningún objeto.",
      "No reconoce obstáculos en el camino, o se moviliza con asistencia física, o rechaza ser movilizado.",
    ]),
  },
];

const VAVDI_INSTRUMENTAL_ITEMS: ScaleItem[] = [
  {
    id: "communication",
    label: "Gestión de la comunicación",
    options: vavdiOptions([
      "Se comunica y utiliza diferentes sistemas (teléfono, fax, correo, móvil, mensajes...), envía/recibe/interpreta información con variedad de sistemas; puede solicitar asistencia inicial con sistemas nuevos pero los comprende y usa.",
      "Se comunica de forma autónoma con apoyo o recordatorio mínimo, recibe e interpreta información con variedad de sistemas, o se comunica con asistencia de terceros o adaptaciones funcionales de los equipos.",
      "Se comunica y utiliza con apoyo de terceros algunos sistemas familiares, o recibe información utilizando sólo uno o dos sistemas, o se comunica con amplias adaptaciones de los equipos.",
      "Responde sólo con un alto apoyo de terceros a sistemas simples de comunicación, o no inicia el uso de sistemas o equipos para comunicarse.",
      "No puede utilizar ningún sistema de comunicación.",
    ]),
  },
  {
    id: "community_mobility",
    label: "Movilidad en la comunidad",
    options: vavdiOptions([
      "Se orienta y moviliza sin dificultad en lugares no conocidos, o utiliza un mapa para anticipar direcciones o determinar la ubicación actual, o conduce/maneja, o utiliza medios de transporte y puede indicar el recorrido a otros.",
      "Se moviliza y ubica en recorridos poco frecuentes, o toma un camino equivocado pero puede solicitar ayuda y corregir, o se pierde en el transporte público pero puede solicitar ayuda y corregir.",
      "Realiza en forma autónoma recorridos familiares y frecuentes, puede perderse en recorridos no familiares, o puede evitar caminos poco familiares.",
      "Entra y sale de medios de transporte conocidos sin asistencia táctil, se pierde sin escolta, o desconoce o se confunde en el recorrido.",
      "Puede ir en un vehículo o medio de transporte sólo con apoyo de terceros, o se niega a subir o bajar de cualquier transporte/vehículo.",
    ]),
  },
  {
    id: "finances",
    label: "Manejo de finanzas",
    options: vavdiOptions([
      "Anticipa gastos no frecuentes y planifica su presupuesto mensual y a largo plazo, o identifica y maneja cálculos mentales para pagar y dar vueltos, o puede asistir a otros en la planificación de gastos.",
      "Maneja su rutina semanal y mensual, o anticipa gastos infrecuentes mayores, o puede calcular el cambio mentalmente o con lápiz y papel.",
      "Maneja los gastos diarios pero difícilmente hace cambios, puede calcular el cambio con papel y lápiz/calculadora, o no puede anticipar el presupuesto semanal o mensual.",
      "Maneja los gastos diarios con asistencia, o no puede calcular el cambio, o no puede anticipar el presupuesto diario, aunque reconoce el dinero.",
      "No maneja los gastos diarios, o no maneja ningún tipo de gasto, o no reconoce los valores del dinero.",
    ]),
  },
  {
    id: "health_management",
    label: "Manejo y mantenimiento de la salud (incluida medicación)",
    options: vavdiOptions([
      "Organiza y toma su medicación sin asistencia, cumple con nuevas dosis y anticipa efectos correctamente, asiste a otros, desarrolla una rutina saludable y disminuye comportamientos de riesgo.",
      "Organiza y toma la medicación en la dosis y tiempo correcto, puede tener problemas para distinguir conceptos sobre los efectos de la droga, mantiene una rutina saludable y evita comportamientos de riesgo.",
      "Toma la medicación en dosis simples y tiempos rutinarios, puede utilizar un dispenser/pastillero, puede necesitar que se le recuerde cuándo tomarla, requiere apoyo de terceros para mantener la rutina saludable y sin riesgo.",
      "La medicación es dada por el cuidador, inicialmente rechaza tomarla pero accede, no identifica factores de riesgo en su rutina, que está organizada por terceros pero se desorganiza progresivamente.",
      "Puede no saber qué medicación está tomando, o rechaza tomarla, o su rutina está organizada por terceros pero evidencia desorganización severa y riesgo para la salud.",
    ]),
  },
  {
    id: "home_establishment",
    label: "Establecimiento y manejo del hogar",
    options: vavdiOptions([
      "Organiza y mantiene sus posesiones personales y su hogar, planifica horarios para completar tareas y las realiza, planifica a largo plazo el mantenimiento, repara efectos personales, y sabe a quién contactar para reparaciones.",
      "Reconoce y completa tareas menos visibles (polvo debajo de objetos) con asistencia, planifica a largo plazo con asistencia, mantiene el orden con recordatorio, sabe a quién contactar pero no requerir el servicio.",
      "Completa tareas familiares y simples de manera aceptable, aunque su nivel de desempeño no es del todo aceptable, colabora sólo con asistencia, no sabe a quién contactar para reparaciones.",
      "Repite la tarea innecesariamente, no obtiene un nivel aceptable de limpieza, no finaliza la tarea, no identifica cuándo ni a quién solicitar el servicio para reparaciones.",
      "No participa en ninguna tarea de limpieza, no identifica si está sucio o desordenado, no identifica si el hogar requiere mantenimiento o reparaciones.",
    ]),
  },
  {
    id: "meal_prep",
    label: "Preparación de comidas y limpieza",
    options: vavdiOptions([
      "Planifica, prepara y sirve un menú cotidiano para una nutrición adecuada, realiza la limpieza de alimentos y utensilios después de las comidas, y anticipa riesgos potenciales (cortes, quemaduras).",
      "Prepara el menú cotidiano pero presenta dificultades de planificación, tiene dificultad para evaluar tiempos de cocción o anticipar riesgos, realiza la limpieza pero saltea detalles.",
      "Prepara platos simples y familiares, presenta dificultad para seguir una receta nueva, no anticipa quemaduras o cortes, no presenta una secuencia útil para la limpieza de alimentos y utensilios.",
      "Utiliza acciones familiares repetidamente y debe ser asistido en la preparación, o no prepara la comida, o no reconoce el horario de la comida, o no limpia los alimentos/utensilios.",
      "No participa en la preparación de la comida, o no reconoce si los utensilios o alimentos necesitan ser limpiados.",
    ]),
  },
  {
    id: "safety",
    label: "Procedimientos de seguridad y respuesta ante emergencias",
    options: vavdiOptions([
      "Posee las destrezas requeridas para vivir en seguridad, prevenir situaciones de emergencia y primeros auxilios, asiste a otros en primeros auxilios básicos, e inicia acciones de urgencia para reducir la amenaza.",
      "Verbaliza cómo contactar cada servicio de emergencia, ubica en la guía números de emergencia próximos al hogar, sigue acciones dadas por terceros (policía, médico, bomberos...).",
      "Cuenta con números de emergencia en forma visible y puede solicitar ayuda, o solicita ayuda para llamar a emergencias.",
      "Reconoce situaciones de emergencia sólo con ayuda de terceros, no discrimina situaciones de seguridad o de emergencia de situaciones seguras.",
      "No reconoce situaciones de emergencia, o produce situaciones de riesgo.",
    ]),
  },
  {
    id: "clothing_care",
    label: "Mantenimiento de la ropa",
    options: vavdiOptions([
      "Identifica y coloca la ropa sucia en el lugar correspondiente, anticipa qué ropa puede desteñir o achicar con el lavado sin error, y realiza correctamente el lavado y ordena la ropa.",
      "Coloca la ropa sucia en el lugar correspondiente pero no anticipa si destiñe o achica, realiza el lavado con apoyo en la organización y ordena.",
      "Coloca la ropa sucia en el lugar correspondiente y realiza el lavado con supervisión de terceros, o realiza el lavado sólo de ropa conocida.",
      "Necesita un alto apoyo de terceros para hacer el lavado, sigue la secuencia de lavado dada por terceros sólo paso a paso.",
      "No participa en hacer el lavado, no coloca la ropa sucia en el lugar correspondiente, o no reconoce la ropa sucia.",
    ]),
  },
  {
    id: "shopping",
    label: "Compras",
    options: vavdiOptions([
      "Planifica listas de compras de comestibles y otros, selecciona/adquiere/transporta los artículos, selecciona el método de pago y realiza las transacciones, anticipa necesidades y sabe dónde comprar.",
      "Planifica con apoyo de terceros listas de compras, realiza las compras rutinarias, necesita asistencia para planificar su presupuesto, compra sólo en lugares conocidos.",
      "Realiza compras pequeñas sólo en lugares conocidos, no tiene dinero suficiente para su gasto, necesita apoyo de terceros para saber qué y dónde comprar.",
      "No reconoce vueltos/cambio, no recuerda qué fue a comprar, presenta confusión acerca de las necesidades.",
      "No realiza compras, o no reconoce lugares dónde realizar compras.",
    ]),
  },
];

// VAVDI doesn't use dependency-severity cut-offs (no "leve/moderada/grave");
// a lower score means more autonomy, a higher score more support needed.
// Cut-offs scaled proportionally for 15 items (range 15-75; was 16-80/22/38/54
// before "Limpieza del baño" was removed as a separate item — it isn't in
// the official 15-item VAVDI 2009-2015 instrument, it's folded into
// "Establecimiento y manejo del hogar").
function interpretVavdi(total: number): string {
  if (total <= 21) return "Autonomía alta — apoyo puntual";
  if (total <= 36) return "Autonomía media — apoyo moderado en varias áreas";
  if (total <= 51) return "Apoyo considerable en la mayoría de áreas";
  return "Apoyo extenso o dependencia en la mayoría de áreas";
}

export const VAVDI: ScaleDefinition = {
  id: "VAVDI",
  name: "VAVDI",
  description:
    "Valoración de Actividades de la Vida Diaria e Instrumentales — nivel de apoyo necesario en cada actividad (básicas e instrumentales). Basada en el instrumento VAVDI (2009-2015, Lic. T.O. Mariel Pellegrini).",
  items: [...VAVDI_BASIC_ITEMS, ...VAVDI_INSTRUMENTAL_ITEMS],
  minScore: 15,
  maxScore: 75,
  interpret: interpretVavdi,
  higherIsBetter: false,
};

// VAVDI items split by block, used to render two clearly labeled groups
// (AVD básicas / AVD instrumentales) instead of one flat list of 15 items.
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
  if (def) return def.items.reduce((sum, item) => sum + (itemScores[item.id] ?? 0), 0);
  // Measurement scales: return dominant hand value as primary
  if (scaleId === "9HPT" || scaleId === "Box and Block") return itemScores["dominant"] ?? 0;
  if (scaleId === "TUG") return itemScores["time"] ?? 0;
  if (scaleId === "JAMAR") return itemScores["msd_1"] ?? 0;
  if (scaleId === "Minnesota") return itemScores["p1_msd"] ?? 0;
  return 0;
}

// Returns true when the user has entered enough data to submit this scale.
// Used by the form to disable the submit button until mandatory fields are filled.
export function isScaleComplete(scaleId: string, itemScores: Record<string, number>): boolean {
  const def = STRUCTURED_SCALE_DEFINITIONS[scaleId];
  if (def) {
    // ADL scales: all items must be answered
    return def.items.every((item) => itemScores[item.id] !== undefined);
  }
  // Measurement scales — at least the primary field(s)
  if (scaleId === "9HPT" || scaleId === "Box and Block") {
    return itemScores["dominant"] !== undefined;
  }
  if (scaleId === "TUG") {
    return itemScores["time"] !== undefined;
  }
  if (scaleId === "JAMAR") {
    return itemScores["msd_1"] !== undefined || itemScores["msi_1"] !== undefined;
  }
  if (scaleId === "Minnesota") {
    // All 3 trials × 2 sides required
    for (let i = 1; i <= 3; i++) {
      if (itemScores[`p${i}_msd`] === undefined || itemScores[`p${i}_msi`] === undefined) return false;
    }
    return true;
  }
  return true;
}

export function formatScaleScore(scaleId: string, itemScores: Record<string, number>): string {
  const def = STRUCTURED_SCALE_DEFINITIONS[scaleId];
  if (def) {
    const total = computeScaleTotal(scaleId, itemScores);
    return `${total}/${def.maxScore} — ${def.interpret(total)}`;
  }
  // Measurement scales
  if (scaleId === "9HPT") {
    const dom = itemScores["dominant"];
    const noDom = itemScores["nonDominant"];
    if (dom === undefined && noDom === undefined) return "";
    return `Dom: ${dom ?? "—"}s / No dom: ${noDom ?? "—"}s`;
  }
  if (scaleId === "Box and Block") {
    const dom = itemScores["dominant"];
    const noDom = itemScores["nonDominant"];
    if (dom === undefined && noDom === undefined) return "";
    return `Dom: ${dom ?? "—"} / No dom: ${noDom ?? "—"} bloques`;
  }
  if (scaleId === "TUG") {
    const time = itemScores["time"];
    if (time === undefined) return "";
    const aid = itemScores["aid_idx"] !== undefined ? TUG_AIDS[itemScores["aid_idx"]] : "";
    return `${time}s${aid ? ` (${aid})` : ""}`;
  }
  if (scaleId === "JAMAR") {
    const keys = Object.keys(itemScores).filter((k) => k.startsWith("msd_")).sort();
    const msdVals = keys.map((k) => itemScores[k]).filter((v) => v !== undefined);
    const msiKeys = Object.keys(itemScores).filter((k) => k.startsWith("msi_")).sort();
    const msiVals = msiKeys.map((k) => itemScores[k]).filter((v) => v !== undefined);
    if (msdVals.length === 0 && msiVals.length === 0) return "";
    const msdStr = msdVals.length > 0 ? `MSD: ${msdVals.join("-")}` : "MSD: —";
    const msiStr = msiVals.length > 0 ? `MSI: ${msiVals.join("-")}` : "MSI: —";
    return `${msdStr} / ${msiStr} kg`;
  }
  if (scaleId === "Minnesota") {
    const trials: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const msd = itemScores[`p${i}_msd`];
      const msi = itemScores[`p${i}_msi`];
      if (msd !== undefined || msi !== undefined) {
        trials.push(`P${i}: ${msd ?? "—"}″/${msi ?? "—"}″`);
      }
    }
    return trials.length > 0 ? trials.join(" | ") : "";
  }
  return "";
}

export const TUG_AIDS = ["Ninguna", "Bastón", "Muleta", "Andador", "Silla de ruedas", "Otra"] as const;
export const TUG_ASSISTANCE = ["Independiente", "Supervisión", "Ayuda física"] as const;

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
