"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Save, Plus, Trash2, X, ClipboardCheck, Pencil, Eye, ChevronDown, ChevronUp, FileDown,
} from "lucide-react";
import { usePatient, useGasAssessments, useCreateGasAssessments, useDeleteGasAssessment, occupationalProfileKey } from "@/hooks/api";
import { useQueryClient } from "@tanstack/react-query";
import type { GasAssessmentDTO } from "@/hooks/api";
import { toast } from "@/hooks/use-toast";
import { RichTextarea } from "@/components/rich-textarea";

// ─── Types & constants ───────────────────────────────────────────────────────

// Los objetivos YA NO se clasifican por área ocupacional (Cuidado de sí
// mismo / Productividad / Ocio). El campo `area` se conserva en la base de
// datos solo para no perder datos antiguos, pero no se muestra ni se pide;
// los objetivos nuevos se guardan con área vacía. Todos usan el color de marca.
type GoalArea = string;
const GOAL_ACCENT = "#1a5c58";

const GOAL_SCOPES = ["Con el paciente", "Con la familia/entorno", "Coordinación profesional"] as const;
type GoalScope = typeof GOAL_SCOPES[number];
/** Display labels — the stored DB value stays "Con el paciente" for backward compat. */
const SCOPE_DISPLAY: Record<GoalScope, string> = {
  "Con el paciente": "Con el/la usuario/a",
  "Con la familia/entorno": "Con la familia/entorno",
  "Coordinación profesional": "Coordinación profesional",
};
const GOAL_SCOPE_COLORS: Record<GoalScope, string> = {
  "Con el paciente": "#4A6D8C",
  "Con la familia/entorno": "#8B6F5A",
  "Coordinación profesional": "#6B5A8C",
};
const GOAL_STATUSES = ["En curso", "Conseguido", "Abandonado"] as const;
type GoalStatus = typeof GOAL_STATUSES[number];

const GOAL_STATUS_STYLES: Record<GoalStatus, string> = {
  "En curso": "bg-sky-100 text-sky-900",
  "Conseguido": "bg-emerald-100 text-emerald-900",
  "Abandonado": "bg-zinc-100 text-zinc-700",
};

interface SpecificGoal {
  id: string;
  text: string;
  status: GoalStatus;
}

interface Goal {
  id?: string;
  text: string;
  area: GoalArea;
  scope: GoalScope;
  status: GoalStatus;
  specificGoals: SpecificGoal[];
  startDate: string | null;
  targetDate: string | null;
  evaluation: string;
  gasLevels: GasLevels | null;
}

const GAS_LEVEL_KEYS = ["-2", "-1", "0", "1", "2"] as const;
type GasLevels = Record<(typeof GAS_LEVEL_KEYS)[number], string>;
function emptyGasLevels(): GasLevels {
  return { "-2": "", "-1": "", "0": "", "1": "", "2": "" };
}
function parseGasLevels(raw: unknown): GasLevels | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return GAS_LEVEL_KEYS.every((k) => typeof parsed?.[k] === "string") ? parsed : null;
  } catch {
    return null;
  }
}

const GAS_SCORE_LABELS: Record<number, string> = {
  "-2": "Mucho menos de lo esperado",
  "-1": "Menos de lo esperado",
  "0": "Resultado esperado",
  "1": "Más de lo esperado",
  "2": "Mucho más de lo esperado",
};
const GAS_SCORE_COLORS: Record<number, string> = {
  "-2": "#dc2626",
  "-1": "#f97316",
  "0": "#6b7280",
  "1": "#22c55e",
  "2": "#059669",
};

const PREDEFINED_OBJECTIVES: { text: string }[] = [
  { text: "Mejorar la autonomía en actividades de la vida diaria" },
  { text: "Incrementar la participación en actividades significativas" },
  { text: "Promover la gestión del hogar de forma independiente" },
  { text: "Fomentar las relaciones sociales y la participación comunitaria" },
  { text: "Mejorar las habilidades de organización y planificación" },
  { text: "Favorecer la gestión emocional y el bienestar" },
  { text: "Potenciar las habilidades cognitivas funcionales" },
  { text: "Mejorar la movilidad funcional y el equilibrio" },
  { text: "Promover hábitos de vida saludables" },
  { text: "Facilitar la integración laboral o formativa" },
  { text: "Mejorar la coordinación y destreza manual" },
  { text: "Favorecer la adaptación al entorno y uso de productos de apoyo" },
];

// Plantillas específicas para Asociación EM con niveles GAS pre-rellenados
const EM_PREDEFINED_OBJECTIVES: { text: string; gasLevels: GasLevels }[] = [
  {
    text: "Mantener la destreza manual funcional",
    gasLevels: { "-2": "Pérdida significativa de destreza que impide AVD básicas", "-1": "Disminución leve de destreza respecto al nivel inicial", "0": "Mantiene el nivel de destreza actual", "1": "Mejora leve en velocidad o precisión manipulativa", "2": "Mejora significativa que permite nuevas actividades" },
  },
  {
    text: "Gestionar la fatiga en actividades de la vida diaria",
    gasLevels: { "-2": "La fatiga impide realizar AVD básicas de forma autónoma", "-1": "Aumento de la fatiga que reduce la participación en alguna AVD", "0": "Mantiene las estrategias de gestión de la fatiga actuales", "1": "Aplica nuevas estrategias que aumentan su participación", "2": "Gestiona la fatiga de forma autónoma y amplía actividades" },
  },
  {
    text: "Mejorar la autonomía en el autocuidado",
    gasLevels: { "-2": "Necesita ayuda total en más de 2 actividades de autocuidado", "-1": "Ha perdido autonomía en alguna actividad de autocuidado", "0": "Mantiene el nivel actual de autonomía", "1": "Recupera autonomía en al menos una actividad", "2": "Realiza de forma independiente todas las actividades de autocuidado" },
  },
  {
    text: "Mejorar el equilibrio y la movilidad funcional",
    gasLevels: { "-2": "Aumento significativo de caídas o necesidad de ayuda para deambular", "-1": "Ligero empeoramiento del equilibrio o la marcha", "0": "Mantiene el nivel de equilibrio y movilidad actual", "1": "Mejora en equilibrio estático o dinámico medible en escalas", "2": "Mejora significativa: reduce ayudas técnicas o amplia distancias" },
  },
  {
    text: "Favorecer la participación social y comunitaria",
    gasLevels: { "-2": "Aislamiento social completo, no sale del domicilio", "-1": "Reducción de actividades sociales respecto al nivel previo", "0": "Mantiene la frecuencia actual de participación social", "1": "Incorpora al menos una actividad social nueva", "2": "Participación social activa y autónoma en la comunidad" },
  },
  {
    text: "Mejorar las funciones cognitivas aplicadas a la vida diaria",
    gasLevels: { "-2": "Deterioro cognitivo que impide la planificación de actividades cotidianas", "-1": "Olvidos o dificultades atencionales que afectan a alguna actividad", "0": "Mantiene el rendimiento cognitivo funcional actual", "1": "Aplica estrategias compensatorias que mejoran su organización", "2": "Mejora cognitiva funcional que permite mayor independencia" },
  },
  {
    text: "Adaptar el entorno domiciliario a las necesidades funcionales",
    gasLevels: { "-2": "El entorno supone un riesgo de seguridad evidente", "-1": "Existen barreras identificadas pero sin resolver", "0": "Se han implementado las adaptaciones prioritarias", "1": "El entorno está adaptado y el usuario lo utiliza correctamente", "2": "Entorno óptimo: adaptaciones integradas, sin barreras" },
  },
  {
    text: "Mantener o mejorar la capacidad de gestión del hogar",
    gasLevels: { "-2": "Incapaz de realizar tareas domésticas básicas sin ayuda", "-1": "Ha dejado de realizar alguna tarea que antes hacía", "0": "Mantiene el nivel actual de gestión doméstica", "1": "Recupera alguna tarea doméstica o la realiza con menos ayuda", "2": "Gestiona el hogar de forma independiente con estrategias compensatorias" },
  },
];

// ─── Main tab component ──────────────────────────────────────────────────────
//
// Versión SIMPLIFICADA (nov 2026): una lista limpia de objetivos.
// - Cada objetivo se ve en una tarjeta compacta; sus metas funcionales se
//   marcan directamente con un clic.
// - Añadir / editar se hace en una ventana, y todo se guarda al momento (ya
//   no hay modo edición ni botón "Guardar cambios" general).
// - Los objetivos conseguidos o abandonados quedan plegados al final.

function blankGoal(): Goal {
  return {
    text: "", area: "" as GoalArea, scope: "Con el paciente", status: "En curso", specificGoals: [],
    startDate: new Date().toISOString().slice(0, 10), targetDate: null, evaluation: "", gasLevels: null,
  };
}

function goalFromApi(g: any): Goal {
  return {
    id: g.id,
    text: g.text,
    area: g.area ?? "",
    scope: g.scope ?? "Con el paciente",
    status: g.status,
    specificGoals: (() => { try { return typeof g.specificGoals === "string" ? JSON.parse(g.specificGoals) : (g.specificGoals ?? []); } catch { return []; } })(),
    startDate: g.startDate ? g.startDate.slice(0, 10) : null,
    targetDate: g.targetDate ? g.targetDate.slice(0, 10) : null,
    evaluation: g.evaluation ?? "",
    gasLevels: parseGasLevels(g.gasLevels),
  };
}

function fmtShortDate(d: string | null): string {
  if (!d) return "";
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export function InterventionPlanTab({
  patientId,
  embedded = false,
  readOnly = false,
}: {
  patientId: string;
  // Dentro del PIAI (apartado de Terapia ocupacional): sin título propio ni
  // descripción del plan; solo los objetivos.
  embedded?: boolean;
  // Solo lectura (p. ej. otros profesionales viendo el PIAI): sin añadir,
  // editar ni marcar metas.
  readOnly?: boolean;
}) {
  const { data: patient } = usePatient(patientId);
  // Para usuarios/as de Centro de día esta pestaña se llama "Objetivos PIAI".
  const isDayCenter = patient?.resource === "Asociación EM" && patient?.emCategory === "Centro de día";
  const gasEnabled = patient?.resource === "Asociación EM";
  const { data: gasAssessments } = useGasAssessments(patientId);
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [gasSheetOpen, setGasSheetOpen] = useState(false);
  const [gasReportOpen, setGasReportOpen] = useState(false);

  const [desiredImprovements, setDesiredImprovements] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  // Ventana de objetivo: índice que se edita, o "new" para uno nuevo.
  const [dialogTarget, setDialogTarget] = useState<number | "new" | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [metaInput, setMetaInput] = useState<Record<number, string>>({});

  const gasByGoal: Record<string, GasAssessmentDTO[]> = {};
  for (const a of gasAssessments ?? []) {
    (gasByGoal[a.goalId] ??= []).push(a);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/patients/${patientId}/occupational-profile`);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`(${res.status}) ${text.slice(0, 300)}`);
        }
        const data = await res.json();
        setDesiredImprovements(data?.desiredImprovements ?? "");
        setGoals(Array.isArray(data?.goals) ? data.goals.map(goalFromApi) : []);
      } catch (e: any) {
        console.error("Error cargando plan de intervención:", e);
        setLoadError(e?.message ?? "Error desconocido.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId]);

  // Guarda el plan completo (descripción + objetivos) y refresca con lo que
  // devuelve el servidor (así los objetivos nuevos reciben su id).
  async function persist(nextGoals: Goal[], nextDesc: string = desiredImprovements, successMsg?: string): Promise<boolean> {
    const previousGoals = goals;
    const previousDesc = desiredImprovements;
    setGoals(nextGoals);
    setDesiredImprovements(nextDesc);
    setSaving(true);
    try {
      const payload = {
        desiredImprovements: nextDesc,
        goals: nextGoals.map((g) => ({
          ...g,
          specificGoals: JSON.stringify(g.specificGoals ?? []),
          gasLevels: gasEnabled
            ? JSON.stringify(g.gasLevels ?? emptyGasLevels())
            : g.gasLevels ? JSON.stringify(g.gasLevels) : null,
        })),
      };
      const res = await fetch(`/api/patients/${patientId}/occupational-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`(${res.status}) ${text.slice(0, 300)}`);
      }
      const data = await res.json();
      if (Array.isArray(data?.goals)) setGoals(data.goals.map(goalFromApi));
      // Avisa al resto de la ficha (Resumen, seguimientos) de que han cambiado los objetivos.
      queryClient.invalidateQueries({ queryKey: occupationalProfileKey(patientId) });
      if (successMsg) toast({ title: successMsg });
      return true;
    } catch (e: any) {
      console.error("Error guardando plan de intervención:", e);
      setGoals(previousGoals);
      setDesiredImprovements(previousDesc);
      toast({ title: "Error al guardar", description: e?.message ?? "Error desconocido.", variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function toggleMeta(goalIdx: number, metaId: string) {
    const next = goals.map((g, i) => i !== goalIdx ? g : {
      ...g,
      specificGoals: (g.specificGoals ?? []).map((m) => m.id === metaId
        ? { ...m, status: (m.status === "Conseguido" ? "En curso" : "Conseguido") as GoalStatus }
        : m),
    });
    persist(next);
  }

  function addMeta(goalIdx: number) {
    const text = (metaInput[goalIdx] ?? "").trim();
    if (!text) return;
    const next = goals.map((g, i) => i !== goalIdx ? g : {
      ...g,
      specificGoals: [...(g.specificGoals ?? []), { id: `sg-${Date.now()}`, text, status: "En curso" as GoalStatus }],
    });
    setMetaInput((p) => ({ ...p, [goalIdx]: "" }));
    persist(next);
  }

  if (loading) return <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">Cargando plan de intervención…</div>;
  if (loadError) return <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div>;

  const openGoals = goals.map((g, i) => ({ g, i })).filter(({ g }) => g.status === "En curso");
  const closedGoals = goals.map((g, i) => ({ g, i })).filter(({ g }) => g.status !== "En curso");
  const hasDesc = !!desiredImprovements && desiredImprovements.replace(/<[^>]*>/g, "").trim().length > 0;

  function renderGoal({ g: goal, i }: { g: Goal; i: number }, number: number) {
    const metas = goal.specificGoals ?? [];
    const done = metas.filter((m) => m.status === "Conseguido").length;
    const history = goal.id ? (gasByGoal[goal.id] ?? []) : [];
    const closed = goal.status !== "En curso";
    return (
      <div key={goal.id ?? `new-${i}`} className={`rounded-lg border bg-card px-4 py-3 space-y-2 ${closed ? "opacity-75" : ""}`}>
        <div className="flex items-start gap-2.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0" style={{ backgroundColor: `${GOAL_ACCENT}18`, color: GOAL_ACCENT }}>{number}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-snug ${goal.status === "Abandonado" ? "line-through text-muted-foreground" : ""}`}>
              {goal.text || <span className="text-muted-foreground italic">Sin título</span>}
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-1 text-[11px] text-muted-foreground">
              {closed && <span className={`px-1.5 py-0.5 rounded font-medium ${GOAL_STATUS_STYLES[goal.status]}`}>{goal.status}</span>}
              {metas.length > 0 && <span>{done}/{metas.length} metas</span>}
              {goal.targetDate && <span>· hasta {fmtShortDate(goal.targetDate)}</span>}
              {goal.scope && goal.scope !== "Con el paciente" && <span>· {SCOPE_DISPLAY[goal.scope as GoalScope] ?? goal.scope}</span>}
              {history.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  · GAS
                  {history.map((a) => (
                    <span key={a.id} className="font-bold px-1 rounded text-white text-[10px]" style={{ backgroundColor: GAS_SCORE_COLORS[a.score] ?? "#6b7280" }}
                      title={`${new Date(a.date).toLocaleDateString("es-ES")}${a.notes ? ` — ${a.notes}` : ""}`}>
                      {a.score > 0 ? `+${a.score}` : a.score}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>
          <button type="button" hidden={readOnly} onClick={() => setDialogTarget(i)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted shrink-0" title="Editar objetivo">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Metas funcionales: se marcan con un clic y se guardan al momento */}
        {(metas.length > 0 || (!closed && !readOnly)) && (
          <div className="pl-8 space-y-1">
            {metas.map((m) => (
              <button key={m.id} type="button" disabled={saving || readOnly} onClick={() => toggleMeta(i, m.id)}
                className="w-full flex items-center gap-2 text-left text-xs group">
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${m.status === "Conseguido" ? "bg-green-100 border-green-400 text-green-600" : "border-muted-foreground/40 group-hover:border-foreground/60"}`}>
                  {m.status === "Conseguido" && <span className="text-[10px]">✓</span>}
                </span>
                <span className={m.status === "Conseguido" ? "line-through text-muted-foreground" : ""}>{m.text}</span>
              </button>
            ))}
            {!closed && !readOnly && (
              <div className="flex items-center gap-1.5">
                <Plus className="w-3 h-3 text-muted-foreground shrink-0" />
                <input
                  value={metaInput[i] ?? ""}
                  onChange={(e) => setMetaInput((p) => ({ ...p, [i]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMeta(i); } }}
                  onBlur={() => addMeta(i)}
                  placeholder="Añadir meta funcional…"
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/70 py-0.5"
                />
              </div>
            )}
          </div>
        )}
        {goal.evaluation && <p className="pl-8 text-[11px] text-muted-foreground italic">{goal.evaluation}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra superior: título + acciones */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">
          {embedded ? "Objetivos de terapia ocupacional" : isDayCenter ? "Objetivos PIAI" : "Plan de intervención"}
          {saving && <span className="ml-2 text-[11px] font-normal text-muted-foreground">Guardando…</span>}
        </h3>
        <div className="flex gap-2 flex-wrap">
          {gasEnabled && goals.some((g) => g.id) && (
            <>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setGasReportOpen(true)}>
                <FileDown className="w-3.5 h-3.5 mr-1" />Informe GAS
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 px-2.5 text-xs" hidden={readOnly} onClick={() => setGasSheetOpen(true)}>
                <ClipboardCheck className="w-3.5 h-3.5 mr-1" />Valorar (GAS)
              </Button>
            </>
          )}
          {!readOnly && (
            <Button type="button" size="sm" className="h-8 px-3 text-xs" onClick={() => setDialogTarget("new")}>
              <Plus className="w-3.5 h-3.5 mr-1" />Añadir objetivo
            </Button>
          )}
        </div>
      </div>

      {/* Descripción del plan: discreta; solo ocupa sitio si tiene contenido */}
      {embedded ? null : editingDesc ? (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-semibold text-muted-foreground">Descripción del plan</p>
          <RichTextarea rows={3} tone="filled" value={descDraft} onChange={setDescDraft} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingDesc(false)}>Cancelar</Button>
            <Button type="button" size="sm" className="h-7 text-xs" disabled={saving}
              onClick={async () => { if (await persist(goals, descDraft, "Descripción guardada")) setEditingDesc(false); }}>
              <Save className="w-3 h-3 mr-1" />Guardar
            </Button>
          </div>
        </div>
      ) : hasDesc ? (
        <div className="group relative rounded-lg bg-muted/30 px-3 py-2">
          <div className="text-sm prose prose-sm max-w-none pr-6" dangerouslySetInnerHTML={{ __html: desiredImprovements }} />
          <button type="button" hidden={readOnly} onClick={() => { setDescDraft(desiredImprovements); setEditingDesc(true); }}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground" title="Editar descripción">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : readOnly ? null : (
        <button type="button" onClick={() => { setDescDraft(""); setEditingDesc(true); }} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          + Añadir una descripción del plan (opcional)
        </button>
      )}

      {/* Objetivos en curso */}
      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Todavía no hay objetivos.</p>
          <Button type="button" size="sm" variant="outline" hidden={readOnly} onClick={() => setDialogTarget("new")}>
            <Plus className="w-3.5 h-3.5 mr-1" />Añadir el primer objetivo
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {openGoals.length === 0 && <p className="text-sm text-muted-foreground italic">No hay objetivos en curso.</p>}
          {openGoals.map((x, n) => renderGoal(x, n + 1))}
        </div>
      )}

      {/* Conseguidos / abandonados, plegados */}
      {closedGoals.length > 0 && (
        <div className="space-y-2">
          <button type="button" onClick={() => setShowClosed((v) => !v)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {showClosed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Conseguidos y cerrados ({closedGoals.length})
          </button>
          {showClosed && closedGoals.map((x, n) => renderGoal(x, openGoals.length + n + 1))}
        </div>
      )}

      {dialogTarget !== null && (
        <GoalDialog
          key={String(dialogTarget)}
          initial={dialogTarget === "new" ? blankGoal() : goals[dialogTarget]}
          isNew={dialogTarget === "new"}
          gasEnabled={!!gasEnabled}
          usedTexts={new Set(goals.map((g) => g.text))}
          saving={saving}
          onClose={() => setDialogTarget(null)}
          onSave={async (goal) => {
            const next = dialogTarget === "new" ? [...goals, goal] : goals.map((g, i) => (i === dialogTarget ? goal : g));
            if (await persist(next, desiredImprovements, dialogTarget === "new" ? "Objetivo añadido" : "Objetivo guardado")) setDialogTarget(null);
          }}
          onDelete={dialogTarget === "new" ? undefined : async () => {
            if (!confirm("¿Seguro que quieres eliminar este objetivo y sus metas funcionales?")) return;
            const next = goals.filter((_, i) => i !== dialogTarget);
            if (await persist(next, desiredImprovements, "Objetivo eliminado")) setDialogTarget(null);
          }}
        />
      )}

      {gasSheetOpen && (
        <GasAssessmentSheet patientId={patientId} goals={goals.filter((g) => g.id)} open={gasSheetOpen} onOpenChange={setGasSheetOpen} />
      )}
      {gasReportOpen && (
        <GasReportSheet patient={patient} goals={goals.filter((g) => g.id)} assessments={gasAssessments ?? []} open={gasReportOpen} onOpenChange={setGasReportOpen} />
      )}
    </div>
  );
}

// ─── Ventana para crear / editar un objetivo ─────────────────────────────────

function GoalDialog({
  initial,
  isNew,
  gasEnabled,
  usedTexts,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Goal;
  isNew: boolean;
  gasEnabled: boolean;
  usedTexts: Set<string>;
  saving: boolean;
  onClose: () => void;
  onSave: (goal: Goal) => void;
  onDelete?: () => void;
}) {
  const [goal, setGoal] = useState<Goal>(initial);
  const [metaText, setMetaText] = useState("");
  const [showPredefined, setShowPredefined] = useState(isNew);
  const patch = (p: Partial<Goal>) => setGoal((g) => ({ ...g, ...p }));

  const predefined = [
    ...(gasEnabled ? EM_PREDEFINED_OBJECTIVES.map((o) => ({ ...o, gas: true })) : []),
    ...PREDEFINED_OBJECTIVES.map((o) => ({ ...o, gasLevels: null as GasLevels | null, gas: false })),
  ].filter((o) => !usedTexts.has(o.text));

  function addMeta() {
    const text = metaText.trim();
    if (!text) return;
    patch({ specificGoals: [...(goal.specificGoals ?? []), { id: `sg-${Date.now()}`, text, status: "En curso" }] });
    setMetaText("");
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuevo objetivo" : "Editar objetivo"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Objetivo</Label>
            <Textarea rows={2} autoFocus placeholder="Escribe el objetivo…" value={goal.text} onChange={(e) => patch({ text: e.target.value })} />
            {isNew && predefined.length > 0 && (
              <div className="space-y-1">
                <button type="button" onClick={() => setShowPredefined((v) => !v)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                  {showPredefined ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  o elige uno predefinido
                </button>
                {showPredefined && (
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {predefined.map((o) => (
                      <button key={o.text} type="button"
                        onClick={() => patch({ text: o.text, gasLevels: o.gasLevels ?? goal.gasLevels })}
                        className={`rounded-full border px-2.5 py-1 text-[11px] text-left transition-colors ${goal.text === o.text ? "border-[#1a5c58] bg-[#1a5c58]/10 text-[#1a5c58]" : "hover:bg-muted"}`}>
                        {o.text}{o.gas && <span className="ml-1 text-fuchsia-600 font-semibold">GAS</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={goal.status} onValueChange={(v) => patch({ status: v as GoalStatus })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{GOAL_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Con quién</Label>
              <Select value={goal.scope ?? "Con el paciente"} onValueChange={(v) => patch({ scope: v as GoalScope })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{GOAL_SCOPES.map((s) => (<SelectItem key={s} value={s}>{SCOPE_DISPLAY[s]}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Inicio</Label>
              <Input type="date" className="h-8 text-xs" value={goal.startDate ?? ""} onChange={(e) => patch({ startDate: e.target.value || null })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha objetivo</Label>
              <Input type="date" className="h-8 text-xs" value={goal.targetDate ?? ""} onChange={(e) => patch({ targetDate: e.target.value || null })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Metas funcionales</Label>
            {(goal.specificGoals ?? []).map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-xs">
                <span className="flex-1">{m.text}</span>
                <button type="button" aria-label="Quitar meta" onClick={() => patch({ specificGoals: goal.specificGoals.filter((x) => x.id !== m.id) })}
                  className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
              </div>
            ))}
            <div className="flex gap-1.5">
              <Input placeholder="Añadir meta funcional…" className="h-8 text-xs" value={metaText}
                onChange={(e) => setMetaText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMeta(); } }} />
              <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={addMeta} disabled={!metaText.trim()}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {gasEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs">Niveles GAS</Label>
              {GAS_LEVEL_KEYS.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-center text-[11px] font-bold text-white rounded" style={{ backgroundColor: GAS_SCORE_COLORS[Number(k)] }}>
                    {Number(k) > 0 ? `+${k}` : k}
                  </span>
                  <Input className="h-7 text-xs" placeholder={GAS_SCORE_LABELS[Number(k)]}
                    value={goal.gasLevels?.[k] ?? ""}
                    onChange={(e) => patch({ gasLevels: { ...(goal.gasLevels ?? emptyGasLevels()), [k]: e.target.value } })} />
                </div>
              ))}
            </div>
          )}

          {!isNew && (
            <div className="space-y-1">
              <Label className="text-xs">Evaluación</Label>
              <Textarea rows={2} placeholder="Valoración del progreso…" value={goal.evaluation ?? ""} onChange={(e) => patch({ evaluation: e.target.value })} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {onDelete ? (
            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete} disabled={saving}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />Eliminar
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="button" size="sm" disabled={saving || !goal.text.trim()} onClick={() => onSave({ ...goal, text: goal.text.trim() })}>
              <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── GAS formal assessment sheet ─────────────────────────────────────────────

function GasAssessmentSheet({
  patientId,
  goals,
  open,
  onOpenChange,
}: {
  patientId: string;
  goals: Goal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: assessments, isLoading } = useGasAssessments(patientId);
  const createMut = useCreateGasAssessments(patientId);
  const deleteMut = useDeleteGasAssessment(patientId);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  function updateScore(goalId: string, score: number) {
    setScores((prev) => ({ ...prev, [goalId]: score }));
  }
  function updateNote(goalId: string, note: string) {
    setNotes((prev) => ({ ...prev, [goalId]: note }));
  }

  async function handleSave() {
    const entries = goals
      .filter((g) => g.id && scores[g.id!] !== undefined)
      .map((g) => ({
        goalId: g.id!,
        score: scores[g.id!],
        notes: notes[g.id!]?.trim() || undefined,
      }));
    if (entries.length === 0) return;

    try {
      await createMut.mutateAsync({ date, entries });
      setScores({});
      setNotes({});
      toast({ title: "Valoración GAS guardada", description: `${entries.length} objetivo${entries.length > 1 ? "s" : ""} valorado${entries.length > 1 ? "s" : ""}.` });
    } catch {
      toast({ title: "Error", description: "No se ha podido guardar la valoración GAS.", variant: "destructive" });
    }
  }

  async function handleDelete(assessmentId: string) {
    if (!confirm("¿Eliminar esta valoración?")) return;
    try {
      await deleteMut.mutateAsync(assessmentId);
    } catch {
      toast({ title: "Error", description: "No se ha podido eliminar la valoración.", variant: "destructive" });
    }
  }

  const byGoal: Record<string, GasAssessmentDTO[]> = {};
  for (const a of assessments ?? []) {
    (byGoal[a.goalId] ??= []).push(a);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Valoración formal GAS</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* ─── New assessment form ─── */}
          <div className="rounded-lg border bg-fuchsia-50/50 border-fuchsia-200 p-4 space-y-4">
            <p className="text-sm font-semibold text-fuchsia-900">Nueva valoración</p>
            <div className="space-y-1">
              <Label className="text-xs text-fuchsia-800">Fecha de valoración</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" />
            </div>

            <div className="space-y-3">
              {goals.map((goal, idx) => {
                const areaColor = GOAL_ACCENT;
                const goalId = goal.id;
                if (!goalId) return null;
                return (
                  <div key={goalId} className="rounded-md border bg-white p-3 space-y-2" style={{ borderLeftWidth: "3px", borderLeftColor: areaColor }}>
                    <p className="text-sm font-medium">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mr-1.5" style={{ backgroundColor: `${areaColor}20`, color: areaColor }}>{idx + 1}</span>
                      {goal.text}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {([-2, -1, 0, 1, 2] as const).map((s) => {
                        const selected = scores[goalId] === s;
                        const desc = goal.gasLevels?.[String(s) as keyof GasLevels] ?? "";
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => updateScore(goalId, s)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${selected ? "text-white border-transparent" : "bg-white text-foreground border-border hover:bg-muted"}`}
                            style={selected ? { backgroundColor: GAS_SCORE_COLORS[s] } : undefined}
                            title={desc || GAS_SCORE_LABELS[s]}
                          >
                            {s > 0 ? `+${s}` : s}
                          </button>
                        );
                      })}
                    </div>
                    {scores[goalId] !== undefined && (
                      <p className="text-[11px] text-muted-foreground italic">
                        {(goal.gasLevels?.[String(scores[goalId]) as keyof GasLevels]) || GAS_SCORE_LABELS[scores[goalId]]}
                      </p>
                    )}
                    <Textarea rows={1} placeholder="Nota opcional…" className="text-xs" value={notes[goalId] ?? ""} onChange={(e) => updateNote(goalId, e.target.value)} />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSave} disabled={createMut.isPending || Object.keys(scores).length === 0}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {createMut.isPending ? "Guardando…" : "Guardar valoración"}
              </Button>
            </div>
          </div>

          {/* ─── History per goal ─── */}
          <div className="space-y-4">
            <p className="text-sm font-semibold">Historial de valoraciones</p>
            {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
            {!isLoading && (assessments ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground italic border border-dashed border-muted-foreground/40 rounded-md px-3 py-2">
                Aún no hay valoraciones formales registradas.
              </p>
            )}
            {goals.map((goal, idx) => {
              const goalId = goal.id;
              if (!goalId) return null;
              const history = byGoal[goalId] ?? [];
              if (history.length === 0) return null;
              const areaColor = GOAL_ACCENT;
              return (
                <div key={goalId} className="rounded-md border p-3 space-y-2" style={{ borderLeftWidth: "3px", borderLeftColor: areaColor }}>
                  <p className="text-sm font-medium">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mr-1.5" style={{ backgroundColor: `${areaColor}20`, color: areaColor }}>{idx + 1}</span>
                    {goal.text}
                  </p>
                  <div className="space-y-1.5">
                    {history.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs rounded-md bg-muted/40 px-2.5 py-1.5 group">
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {new Date(a.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        <span className="font-bold px-1.5 py-0.5 rounded text-white text-[11px] shrink-0" style={{ backgroundColor: GAS_SCORE_COLORS[a.score] ?? "#6b7280" }}>
                          {a.score > 0 ? `+${a.score}` : a.score}
                        </span>
                        {a.notes && <span className="text-muted-foreground italic flex-1 truncate">{a.notes}</span>}
                        <button type="button" onClick={() => handleDelete(a.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Eliminar valoración">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
// ─── GAS Report Sheet (printable summary) ────────────────────────────────────

function GasReportSheet({
  patient,
  goals,
  assessments,
  open,
  onOpenChange,
}: {
  patient: any;
  goals: Goal[];
  assessments: GasAssessmentDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const byGoal: Record<string, GasAssessmentDTO[]> = {};
  for (const a of assessments) {
    (byGoal[a.goalId] ??= []).push(a);
  }

  // Get unique dates sorted
  const allDates = [...new Set(assessments.map((a) => a.date.slice(0, 10)))].sort();

  function handlePrint() {
    const el = document.getElementById("gas-report-content");
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe GAS — ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}</title>
<style>
body{font-family:system-ui,sans-serif;padding:32px;color:#333;font-size:13px;max-width:800px;margin:0 auto}
h1{font-size:18px;color:#1a5c58;margin-bottom:4px}
h2{font-size:14px;color:#1a5c58;margin-top:20px;margin-bottom:8px;border-bottom:1px solid #ddd;padding-bottom:4px}
.subtitle{color:#666;font-size:12px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:12px}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:center}
th{background:#f5f5f5;font-weight:600}
td.goal{text-align:left;font-weight:500}
.score{font-weight:bold;padding:2px 6px;border-radius:4px;color:white;font-size:11px}
.s-2{background:#dc2626}.s-1{background:#f97316}.s0{background:#6b7280}.s1{background:#22c55e}.s2{background:#059669}
.note{font-style:italic;color:#666;font-size:11px;margin-top:2px}
.footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:11px;color:#999;text-align:center}
@media print{body{padding:16px}button{display:none!important}}
</style></head><body>${el.innerHTML}
<div class="footer">Nexo · Informe GAS · ${new Date().toLocaleDateString("es-ES")}</div>
</body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Informe de valoración GAS</SheetTitle>
        </SheetHeader>

        <div className="mt-3 mb-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <FileDown className="w-3.5 h-3.5 mr-1.5" />
            Imprimir / PDF
          </Button>
        </div>

        <div id="gas-report-content" className="space-y-4">
          <div>
            <h1 style={{ fontSize: "18px", color: "#1a5c58", marginBottom: "4px" }}>
              Informe de evolución GAS
            </h1>
            <p className="text-xs text-muted-foreground">
              {patient?.firstName} {patient?.lastName} · {patient?.resource ?? ""} · Generado el {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>

          {assessments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4">No hay valoraciones GAS registradas para generar el informe.</p>
          ) : (
            <>
              {/* Summary table */}
              <div>
                <h2 style={{ fontSize: "14px", color: "#1a5c58", marginTop: "16px", marginBottom: "8px", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>Resumen de puntuaciones</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th className="text-left border border-border bg-muted/50 px-2 py-1.5 font-semibold" style={{ minWidth: "200px" }}>Objetivo</th>
                        {allDates.map((d) => (
                          <th key={d} className="border border-border bg-muted/50 px-2 py-1.5 font-semibold text-center" style={{ minWidth: "70px" }}>
                            {new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {goals.map((goal, idx) => {
                        const history = goal.id ? (byGoal[goal.id] ?? []) : [];
                        const scoreByDate: Record<string, GasAssessmentDTO> = {};
                        for (const a of history) scoreByDate[a.date.slice(0, 10)] = a;
                        const areaColor = GOAL_ACCENT;
                        return (
                          <tr key={goal.id ?? idx}>
                            <td className="text-left border border-border px-2 py-1.5 font-medium" style={{ borderLeft: `3px solid ${areaColor}` }}>
                              {idx + 1}. {goal.text}
                            </td>
                            {allDates.map((d) => {
                              const a = scoreByDate[d];
                              if (!a) return <td key={d} className="border border-border px-2 py-1 text-center text-muted-foreground">—</td>;
                              return (
                                <td key={d} className="border border-border px-2 py-1 text-center">
                                  <span className="inline-block font-bold px-1.5 py-0.5 rounded text-white text-[11px]" style={{ backgroundColor: GAS_SCORE_COLORS[a.score] ?? "#6b7280" }}>
                                    {a.score > 0 ? `+${a.score}` : a.score}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detail per goal */}
              <div>
                <h2 style={{ fontSize: "14px", color: "#1a5c58", marginTop: "16px", marginBottom: "8px", borderBottom: "1px solid #ddd", paddingBottom: "4px" }}>Detalle por objetivo</h2>
                {goals.map((goal, idx) => {
                  const history = goal.id ? (byGoal[goal.id] ?? []) : [];
                  if (history.length === 0) return null;
                  const areaColor = GOAL_ACCENT;
                  const latest = history[history.length - 1];
                  const first = history[0];
                  const trend = latest && first && history.length > 1
                    ? latest.score > first.score ? "↑ Mejora" : latest.score < first.score ? "↓ Empeoramiento" : "→ Estable"
                    : null;
                  return (
                    <div key={goal.id} className="rounded-md border p-3 space-y-2 mb-3" style={{ borderLeftWidth: "3px", borderLeftColor: areaColor }}>
                      <p className="text-sm font-medium">{idx + 1}. {goal.text}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{history.length} valoración{history.length > 1 ? "es" : ""}</span>
                        {trend && (
                          <>
                            <span>·</span>
                            <span className={trend.startsWith("↑") ? "text-green-600 font-medium" : trend.startsWith("↓") ? "text-red-600 font-medium" : ""}>{trend}</span>
                          </>
                        )}
                      </div>
                      <div className="space-y-1">
                        {history.map((a) => (
                          <div key={a.id} className="flex items-start gap-2 text-xs">
                            <span className="text-muted-foreground tabular-nums shrink-0 w-20">
                              {new Date(a.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            <span className="font-bold px-1.5 py-0.5 rounded text-white text-[10px] shrink-0" style={{ backgroundColor: GAS_SCORE_COLORS[a.score] ?? "#6b7280" }}>
                              {a.score > 0 ? `+${a.score}` : a.score}
                            </span>
                            <span className="text-muted-foreground">{GAS_SCORE_LABELS[a.score]}</span>
                            {a.notes && <span className="text-muted-foreground italic ml-1">— {a.notes}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
