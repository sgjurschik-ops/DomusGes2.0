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
  Save, Plus, Trash2, X, ClipboardCheck, Pencil, Eye, ChevronDown, ChevronUp, FileDown,
} from "lucide-react";
import { usePatient, useGasAssessments, useCreateGasAssessments, useDeleteGasAssessment } from "@/hooks/api";
import type { GasAssessmentDTO } from "@/hooks/api";
import { toast } from "@/hooks/use-toast";
import { RichTextarea } from "@/components/rich-textarea";

// ─── Types & constants ───────────────────────────────────────────────────────

const GOAL_AREAS = ["Cuidado de sí mismo", "Productividad", "Ocio", ""] as const;
type GoalArea = typeof GOAL_AREAS[number];
const GOAL_AREA_COLORS: Record<GoalArea, string> = {
  "Cuidado de sí mismo": "#5DCAA5",
  "Productividad": "#EF9F27",
  "Ocio": "#8b5cf6",
  "": "#9CA3AF",
};

const GOAL_SCOPES = ["Con el paciente", "Con la familia/entorno", "Coordinación profesional"] as const;
type GoalScope = typeof GOAL_SCOPES[number];
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

const PREDEFINED_OBJECTIVES: { text: string; area: GoalArea }[] = [
  { text: "Mejorar la autonomía en actividades de la vida diaria", area: "Cuidado de sí mismo" },
  { text: "Incrementar la participación en actividades significativas", area: "Ocio" },
  { text: "Promover la gestión del hogar de forma independiente", area: "Productividad" },
  { text: "Fomentar las relaciones sociales y la participación comunitaria", area: "Ocio" },
  { text: "Mejorar las habilidades de organización y planificación", area: "Productividad" },
  { text: "Favorecer la gestión emocional y el bienestar", area: "Cuidado de sí mismo" },
  { text: "Potenciar las habilidades cognitivas funcionales", area: "Cuidado de sí mismo" },
  { text: "Mejorar la movilidad funcional y el equilibrio", area: "Cuidado de sí mismo" },
  { text: "Promover hábitos de vida saludables", area: "Cuidado de sí mismo" },
  { text: "Facilitar la integración laboral o formativa", area: "Productividad" },
  { text: "Mejorar la coordinación y destreza manual", area: "Cuidado de sí mismo" },
  { text: "Favorecer la adaptación al entorno y uso de productos de apoyo", area: "Productividad" },
];

// Plantillas específicas para Asociación EM con niveles GAS pre-rellenados
const EM_PREDEFINED_OBJECTIVES: { text: string; area: GoalArea; gasLevels: GasLevels }[] = [
  {
    text: "Mantener la destreza manual funcional",
    area: "Cuidado de sí mismo",
    gasLevels: { "-2": "Pérdida significativa de destreza que impide AVD básicas", "-1": "Disminución leve de destreza respecto al nivel inicial", "0": "Mantiene el nivel de destreza actual", "1": "Mejora leve en velocidad o precisión manipulativa", "2": "Mejora significativa que permite nuevas actividades" },
  },
  {
    text: "Gestionar la fatiga en actividades de la vida diaria",
    area: "Cuidado de sí mismo",
    gasLevels: { "-2": "La fatiga impide realizar AVD básicas de forma autónoma", "-1": "Aumento de la fatiga que reduce la participación en alguna AVD", "0": "Mantiene las estrategias de gestión de la fatiga actuales", "1": "Aplica nuevas estrategias que aumentan su participación", "2": "Gestiona la fatiga de forma autónoma y amplía actividades" },
  },
  {
    text: "Mejorar la autonomía en el autocuidado",
    area: "Cuidado de sí mismo",
    gasLevels: { "-2": "Necesita ayuda total en más de 2 actividades de autocuidado", "-1": "Ha perdido autonomía en alguna actividad de autocuidado", "0": "Mantiene el nivel actual de autonomía", "1": "Recupera autonomía en al menos una actividad", "2": "Realiza de forma independiente todas las actividades de autocuidado" },
  },
  {
    text: "Mejorar el equilibrio y la movilidad funcional",
    area: "Cuidado de sí mismo",
    gasLevels: { "-2": "Aumento significativo de caídas o necesidad de ayuda para deambular", "-1": "Ligero empeoramiento del equilibrio o la marcha", "0": "Mantiene el nivel de equilibrio y movilidad actual", "1": "Mejora en equilibrio estático o dinámico medible en escalas", "2": "Mejora significativa: reduce ayudas técnicas o amplia distancias" },
  },
  {
    text: "Favorecer la participación social y comunitaria",
    area: "Ocio",
    gasLevels: { "-2": "Aislamiento social completo, no sale del domicilio", "-1": "Reducción de actividades sociales respecto al nivel previo", "0": "Mantiene la frecuencia actual de participación social", "1": "Incorpora al menos una actividad social nueva", "2": "Participación social activa y autónoma en la comunidad" },
  },
  {
    text: "Mejorar las funciones cognitivas aplicadas a la vida diaria",
    area: "Cuidado de sí mismo",
    gasLevels: { "-2": "Deterioro cognitivo que impide la planificación de actividades cotidianas", "-1": "Olvidos o dificultades atencionales que afectan a alguna actividad", "0": "Mantiene el rendimiento cognitivo funcional actual", "1": "Aplica estrategias compensatorias que mejoran su organización", "2": "Mejora cognitiva funcional que permite mayor independencia" },
  },
  {
    text: "Adaptar el entorno domiciliario a las necesidades funcionales",
    area: "Productividad",
    gasLevels: { "-2": "El entorno supone un riesgo de seguridad evidente", "-1": "Existen barreras identificadas pero sin resolver", "0": "Se han implementado las adaptaciones prioritarias", "1": "El entorno está adaptado y el usuario lo utiliza correctamente", "2": "Entorno óptimo: adaptaciones integradas, sin barreras" },
  },
  {
    text: "Mantener o mejorar la capacidad de gestión del hogar",
    area: "Productividad",
    gasLevels: { "-2": "Incapaz de realizar tareas domésticas básicas sin ayuda", "-1": "Ha dejado de realizar alguna tarea que antes hacía", "0": "Mantiene el nivel actual de gestión doméstica", "1": "Recupera alguna tarea doméstica o la realiza con menos ayuda", "2": "Gestiona el hogar de forma independiente con estrategias compensatorias" },
  },
];

// ─── Main tab component ──────────────────────────────────────────────────────

export function InterventionPlanTab({ patientId }: { patientId: string }) {
  const { data: patient } = usePatient(patientId);
  const gasEnabled = patient?.resource === "Asociación EM";
  const { data: gasAssessments } = useGasAssessments(patientId);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [gasSheetOpen, setGasSheetOpen] = useState(false);
  const [gasReportOpen, setGasReportOpen] = useState(false);

  // State
  const [desiredImprovements, setDesiredImprovements] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingGoalIdx, setEditingGoalIdx] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [specificInput, setSpecificInput] = useState<Record<number, string>>({});

  // Group GAS assessments by goalId
  const gasByGoal: Record<string, GasAssessmentDTO[]> = {};
  for (const a of gasAssessments ?? []) {
    (gasByGoal[a.goalId] ??= []).push(a);
  }

  // Load from occupational profile API
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
        setGoals(
          Array.isArray(data?.goals)
            ? data.goals.map((g: any) => ({
                id: g.id,
                text: g.text,
                area: g.area,
                scope: g.scope ?? "Con el paciente",
                status: g.status,
                specificGoals: (() => { try { return typeof g.specificGoals === "string" ? JSON.parse(g.specificGoals) : (g.specificGoals ?? []); } catch { return []; } })(),
                startDate: g.startDate ? g.startDate.slice(0, 10) : null,
                targetDate: g.targetDate ? g.targetDate.slice(0, 10) : null,
                evaluation: g.evaluation ?? "",
                gasLevels: parseGasLevels(g.gasLevels),
              }))
            : [],
        );
      } catch (e: any) {
        console.error("Error cargando plan de intervención:", e);
        setLoadError(e?.message ?? "Error desconocido.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId]);

  async function saveAll() {
    setSaving(true);
    try {
      const payload = {
        desiredImprovements,
        goals: goals.map((g) => ({
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
      if (Array.isArray(data?.goals)) {
        setGoals(
          data.goals.map((g: any) => ({
            id: g.id,
            text: g.text,
            area: g.area,
            scope: g.scope ?? "Con el paciente",
            status: g.status,
            specificGoals: (() => { try { return typeof g.specificGoals === "string" ? JSON.parse(g.specificGoals) : (g.specificGoals ?? []); } catch { return []; } })(),
            startDate: g.startDate ? g.startDate.slice(0, 10) : null,
            targetDate: g.targetDate ? g.targetDate.slice(0, 10) : null,
            evaluation: g.evaluation ?? "",
            gasLevels: parseGasLevels(g.gasLevels),
          })),
        );
      }
      toast({ title: "Plan de intervención guardado" });
      setEditingDesc(false);
      setEditingGoalIdx(null);
    } catch (e: any) {
      console.error("Error guardando plan de intervención:", e);
      toast({ title: "Error al guardar", description: e?.message ?? "Error desconocido.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Goal mutation helpers
  function updateGoal(i: number, patch: Partial<Goal>) { setGoals((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g))); }
  function removeGoal(i: number) {
    if (!confirm("¿Seguro que quieres eliminar este objetivo y sus metas funcionales?")) return;
    setGoals((prev) => prev.filter((_, idx) => idx !== i));
    setEditingGoalIdx(null);
  }
  function addFromPredefined(obj: { text: string; area: GoalArea; gasLevels?: GasLevels | null }) {
    const newGoals = [...goals, { text: obj.text, area: obj.area, scope: "Con el paciente" as GoalScope, status: "En curso" as GoalStatus, specificGoals: [], startDate: new Date().toISOString().slice(0, 10), targetDate: null, evaluation: "", gasLevels: obj.gasLevels ?? null }];
    setGoals(newGoals);
    setEditingGoalIdx(newGoals.length - 1);
    setShowPicker(false);
  }
  function addCustom() {
    const newGoals = [...goals, { text: "", area: "Cuidado de sí mismo" as GoalArea, scope: "Con el paciente" as GoalScope, status: "En curso" as GoalStatus, specificGoals: [], startDate: new Date().toISOString().slice(0, 10), targetDate: null, evaluation: "", gasLevels: null }];
    setGoals(newGoals);
    setEditingGoalIdx(newGoals.length - 1);
  }
  function addSpecific(goalIdx: number) {
    const text = (specificInput[goalIdx] ?? "").trim();
    if (!text) return;
    const goal = goals[goalIdx];
    updateGoal(goalIdx, { specificGoals: [...(goal.specificGoals ?? []), { id: `sg-${Date.now()}`, text, status: "En curso" as GoalStatus }] });
    setSpecificInput({ ...specificInput, [goalIdx]: "" });
  }

  if (loading) return <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">Cargando plan de intervención…</div>;
  if (loadError) return <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div>;

  const usedTexts = new Set(goals.map((g) => g.text));
  const hasEdits = editingDesc || editingGoalIdx !== null;

  return (
    <div className="space-y-5">
      {/* ─── Toolbar ─── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Plan de intervención</h3>
        <div className="flex gap-2">
          {gasEnabled && goals.filter((g) => g.id).length > 0 && (
            <>
              <Button type="button" variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => setGasReportOpen(true)}>
                <FileDown className="w-3.5 h-3.5 mr-1" />
                Informe GAS
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => setGasSheetOpen(true)}>
                <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                Valorar objetivos (GAS)
              </Button>
            </>
          )}
          {hasEdits && (
            <Button type="button" variant="default" size="sm" className="h-7 px-3 text-xs" disabled={saving} onClick={saveAll}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          )}
        </div>
      </div>

      {/* ─── Descripción del plan ─── */}
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">Descripción del plan</p>
          <button type="button" onClick={() => setEditingDesc(!editingDesc)} className="text-muted-foreground hover:text-foreground">
            {editingDesc ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          </button>
        </div>
        {editingDesc ? (
          <RichTextarea rows={3} value={desiredImprovements} onChange={setDesiredImprovements} />
        ) : desiredImprovements && desiredImprovements.replace(/<[^>]*>/g, "").trim() ? (
          <div className="text-sm prose prose-sm max-w-none bg-muted/30 rounded-md px-3 py-2" dangerouslySetInnerHTML={{ __html: desiredImprovements }} />
        ) : (
          <p className="text-sm text-muted-foreground italic">Sin completar.</p>
        )}
      </div>

      {/* ─── Objetivos ─── */}
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded inline-block">Objetivos ({goals.length})</p>

        {goals.length === 0 && <p className="text-sm text-muted-foreground italic border border-dashed border-muted-foreground/40 rounded-md px-3 py-2">Sin objetivos añadidos.</p>}

        {goals.map((goal, i) => {
          const areaColor = GOAL_AREA_COLORS[goal.area] ?? "#6b7280";
          const isEditing = editingGoalIdx === i;
          const goalHistory = goal.id ? (gasByGoal[goal.id] ?? []) : [];

          return (
            <div key={goal.id ?? `new-${i}`} className="rounded-lg border overflow-hidden transition-shadow" style={{ borderLeftWidth: "4px", borderLeftColor: areaColor }}>
              {/* ── Goal header (always visible) ── */}
              <div className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold mt-0.5 shrink-0" style={{ backgroundColor: `${areaColor}20`, color: areaColor }}>{i + 1}</span>
                  {isEditing ? (
                    <Textarea rows={1} placeholder="Objetivo general…" value={goal.text} onChange={(e) => updateGoal(i, { text: e.target.value })} className="text-sm font-medium flex-1" />
                  ) : (
                    <p className="text-sm font-medium flex-1 pt-0.5">{goal.text || <span className="text-muted-foreground italic">Sin título</span>}</p>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => setEditingGoalIdx(isEditing ? null : i)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted" title={isEditing ? "Ver" : "Editar"}>
                      {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                    </button>
                    {isEditing && (
                      <button type="button" onClick={() => removeGoal(i)} className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-muted" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Metadata row ── */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isEditing ? (
                    <>
                      <Select value={goal.area || "_none"} onValueChange={(v) => updateGoal(i, { area: (v === "_none" ? "" : v) as GoalArea })}>
                        <SelectTrigger className="h-7 text-xs w-auto min-w-[140px]">
                          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: areaColor }} /><SelectValue /></div>
                        </SelectTrigger>
                        <SelectContent>{GOAL_AREAS.map((a) => (<SelectItem key={a || "_none"} value={a || "_none"}><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: GOAL_AREA_COLORS[a] }} />{a || "Sin asignar"}</div></SelectItem>))}</SelectContent>
                      </Select>
                      <Select value={goal.scope ?? "Con el paciente"} onValueChange={(v) => updateGoal(i, { scope: v as GoalScope })}>
                        <SelectTrigger className="h-7 text-xs w-auto min-w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{GOAL_SCOPES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                      </Select>
                      <Select value={goal.status} onValueChange={(v) => updateGoal(i, { status: v as GoalStatus })}>
                        <SelectTrigger className={`h-7 text-xs w-auto min-w-[100px] ${GOAL_STATUS_STYLES[goal.status]}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{GOAL_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px]" style={{ color: areaColor }}>{goal.area || "Sin asignar"}</span>
                      {goal.scope && goal.scope !== "Con el paciente" && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ color: GOAL_SCOPE_COLORS[goal.scope as GoalScope] ?? "#6b7280", backgroundColor: `${GOAL_SCOPE_COLORS[goal.scope as GoalScope] ?? "#6b7280"}18` }}>{goal.scope}</span>
                      )}
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${GOAL_STATUS_STYLES[goal.status]}`}>{goal.status}</span>
                    </>
                  )}
                </div>

                {/* ── Dates (editing only) ── */}
                {isEditing && (
                  <div className="flex gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">Inicio</p>
                      <Input type="date" className="h-7 text-xs w-36" value={goal.startDate ?? ""} onChange={(e) => updateGoal(i, { startDate: e.target.value || null })} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">Fecha objetivo</p>
                      <Input type="date" className="h-7 text-xs w-36" value={goal.targetDate ?? ""} onChange={(e) => updateGoal(i, { targetDate: e.target.value || null })} />
                    </div>
                  </div>
                )}

                {/* ── Specific goals / metas funcionales ── */}
                {((goal.specificGoals ?? []).length > 0 || isEditing) && (
                  <div className="space-y-1.5 pl-3 border-l-2" style={{ borderColor: `${areaColor}40` }}>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Metas funcionales</p>
                    {(goal.specificGoals ?? []).map((sg) => (
                      <div key={sg.id} className="flex items-center gap-2 text-sm">
                        {isEditing ? (
                          <button type="button" onClick={() => {
                            const specifics = (goal.specificGoals ?? []).map((s) => s.id === sg.id ? { ...s, status: (sg.status === "Conseguido" ? "En curso" : "Conseguido") as GoalStatus } : s);
                            updateGoal(i, { specificGoals: specifics });
                          }}
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sg.status === "Conseguido" ? "bg-green-100 border-green-400 text-green-600" : "border-muted-foreground/30"}`}>
                            {sg.status === "Conseguido" && <span className="text-[10px]">✓</span>}
                          </button>
                        ) : (
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sg.status === "Conseguido" ? "bg-green-100 border-green-400 text-green-600" : "border-muted-foreground/30"}`}>
                            {sg.status === "Conseguido" && <span className="text-[10px]">✓</span>}
                          </span>
                        )}
                        <span className={`flex-1 text-xs ${sg.status === "Conseguido" ? "line-through text-muted-foreground" : ""}`}>{sg.text}</span>
                        {isEditing && (
                          <button type="button" onClick={() => updateGoal(i, { specificGoals: (goal.specificGoals ?? []).filter((s) => s.id !== sg.id) })} className="text-muted-foreground hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {isEditing && (
                      <div className="flex gap-1.5">
                        <Input placeholder="Añadir meta funcional…" className="h-7 text-xs" value={specificInput[i] ?? ""}
                          onChange={(e) => setSpecificInput({ ...specificInput, [i]: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSpecific(i); } }} />
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => addSpecific(i)} disabled={!(specificInput[i] ?? "").trim()}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Evaluation (editing: textarea, view: only if has content) ── */}
                {isEditing ? (
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Evaluación</Label>
                    <Textarea rows={2} placeholder="Valoración del progreso…" value={goal.evaluation ?? ""} onChange={(e) => updateGoal(i, { evaluation: e.target.value })} className={!goal.evaluation ? "border-dashed border-muted-foreground/40" : ""} />
                  </div>
                ) : goal.evaluation ? (
                  <p className="text-[11px] text-muted-foreground italic">{goal.evaluation}</p>
                ) : null}

                {/* ── GAS history inline (view mode) ── */}
                {!isEditing && goalHistory.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Historial GAS</p>
                    <div className="flex flex-wrap gap-1.5">
                      {goalHistory.map((a) => (
                        <div key={a.id} className="flex items-center gap-1 text-[11px] bg-muted/40 rounded px-2 py-0.5" title={a.notes ?? undefined}>
                          <span className="text-muted-foreground tabular-nums">{new Date(a.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })}</span>
                          <span className="font-bold px-1 py-0.5 rounded text-white text-[10px]" style={{ backgroundColor: GAS_SCORE_COLORS[a.score] ?? "#6b7280" }}>
                            {a.score > 0 ? `+${a.score}` : a.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ─── Add objective buttons ─── */}
        <div className="flex gap-2 flex-wrap">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowPicker(!showPicker)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir objetivo predefinido
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={addCustom}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Objetivo personalizado
          </Button>
        </div>

        {/* Predefined picker */}
        {showPicker && (
          <div className="border rounded-md p-3 space-y-1.5 bg-muted/30">
            {gasEnabled && (
              <>
                <p className="text-xs font-semibold text-fuchsia-700 mb-2">Objetivos específicos EM (con escala GAS):</p>
                {EM_PREDEFINED_OBJECTIVES.filter((o) => !usedTexts.has(o.text)).map((obj) => (
                  <button key={obj.text} type="button" onClick={() => addFromPredefined(obj)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-fuchsia-50 text-sm flex items-center gap-2 border border-transparent hover:border-fuchsia-200 transition-colors">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GOAL_AREA_COLORS[obj.area] }} />
                    <span className="flex-1">{obj.text}</span>
                    <span className="text-[10px] text-fuchsia-600 font-medium shrink-0">GAS</span>
                  </button>
                ))}
                {EM_PREDEFINED_OBJECTIVES.filter((o) => !usedTexts.has(o.text)).length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Todos los objetivos EM ya están añadidos.</p>
                )}
                <hr className="my-2 border-border" />
              </>
            )}
            <p className="text-xs font-semibold text-muted-foreground mb-2">Objetivos generales:</p>
            {PREDEFINED_OBJECTIVES.filter((o) => !usedTexts.has(o.text)).map((obj) => (
              <button key={obj.text} type="button" onClick={() => addFromPredefined(obj)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2 border border-transparent hover:border-border transition-colors">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GOAL_AREA_COLORS[obj.area] }} />
                <span className="flex-1">{obj.text}</span>
                <span className="text-[10px] text-muted-foreground">{obj.area}</span>
              </button>
            ))}
            {PREDEFINED_OBJECTIVES.filter((o) => !usedTexts.has(o.text)).length === 0 && (
              <p className="text-xs text-muted-foreground italic">Todos los objetivos generales ya están añadidos.</p>
            )}
          </div>
        )}
      </div>

      {/* ─── GAS Sheet ─── */}
      {gasSheetOpen && (
        <GasAssessmentSheet patientId={patientId} goals={goals.filter((g) => g.id)} open={gasSheetOpen} onOpenChange={setGasSheetOpen} />
      )}
      {gasReportOpen && (
        <GasReportSheet patient={patient} goals={goals.filter((g) => g.id)} assessments={gasAssessments ?? []} open={gasReportOpen} onOpenChange={setGasReportOpen} />
      )}
    </div>
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
                const areaColor = GOAL_AREA_COLORS[goal.area] ?? "#6b7280";
                const goalId = goal.id;
                if (!goalId) return null;
                return (
                  <div key={goalId} className="rounded-md border bg-white p-3 space-y-2" style={{ borderLeftWidth: "3px", borderLeftColor: areaColor }}>
                    <p className="text-sm font-medium">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mr-1.5" style={{ backgroundColor: `${areaColor}20`, color: areaColor }}>{idx + 1}</span>
                      {goal.text}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{goal.area || "Sin área"}</p>
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
              const areaColor = GOAL_AREA_COLORS[goal.area] ?? "#6b7280";
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
<div class="footer">DomusGes · Informe GAS · ${new Date().toLocaleDateString("es-ES")}</div>
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
                        const areaColor = GOAL_AREA_COLORS[goal.area] ?? "#6b7280";
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
                  const areaColor = GOAL_AREA_COLORS[goal.area] ?? "#6b7280";
                  const latest = history[history.length - 1];
                  const first = history[0];
                  const trend = latest && first && history.length > 1
                    ? latest.score > first.score ? "↑ Mejora" : latest.score < first.score ? "↓ Empeoramiento" : "→ Estable"
                    : null;
                  return (
                    <div key={goal.id} className="rounded-md border p-3 space-y-2 mb-3" style={{ borderLeftWidth: "3px", borderLeftColor: areaColor }}>
                      <p className="text-sm font-medium">{idx + 1}. {goal.text}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{goal.area}</span>
                        <span>·</span>
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
