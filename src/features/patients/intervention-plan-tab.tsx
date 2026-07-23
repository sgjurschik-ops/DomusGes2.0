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
  Save, Plus, Trash2, X, ClipboardCheck, Pencil, Eye,
} from "lucide-react";
import { usePatient, useGasAssessments, useCreateGasAssessments, useDeleteGasAssessment } from "@/hooks/api";
import type { GasAssessmentDTO } from "@/hooks/api";
import { toast } from "@/hooks/use-toast";
import { RichTextarea } from "@/components/rich-textarea";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Main tab component ──────────────────────────────────────────────────────

export function InterventionPlanTab({ patientId }: { patientId: string }) {
  const { data: patient } = usePatient(patientId);
  const gasEnabled = patient?.resource === "Asociación EM";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gasSheetOpen, setGasSheetOpen] = useState(false);

  // State
  const [desiredImprovements, setDesiredImprovements] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);

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

  async function save() {
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
      // Re-parse response to get server-assigned IDs
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
      setEditing(false);
    } catch (e: any) {
      console.error("Error guardando plan de intervención:", e);
      toast({ title: "Error al guardar", description: e?.message ?? "Error desconocido.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">Cargando plan de intervención…</div>;
  if (loadError) return <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</div>;

  return (
    <div className="space-y-4">
      {/* ─── Toolbar ─── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Plan de intervención</h3>
        <div className="flex gap-2">
          {gasEnabled && goals.filter((g) => g.id).length > 0 && (
            <Button type="button" variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={() => setGasSheetOpen(true)}>
              <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
              Valorar objetivos (GAS)
            </Button>
          )}
          {editing && (
            <Button type="button" variant="default" size="sm" className="h-7 px-3 text-xs" disabled={saving} onClick={save}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-7 px-3 text-xs" onClick={() => setEditing(!editing)}>
            {editing ? <><Eye className="w-3.5 h-3.5 mr-1" />Ver</> : <><Pencil className="w-3.5 h-3.5 mr-1" />Editar</>}
          </Button>
        </div>
      </div>

      {/* ─── Content ─── */}
      {editing ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">Descripción del plan</Label>
            <RichTextarea rows={3} value={desiredImprovements} onChange={setDesiredImprovements} />
          </div>
          <GoalsEditor value={goals} onChange={setGoals} />
        </div>
      ) : (
        <div className="space-y-4">
          <ReadOnlyHtml label="Descripción del plan" value={desiredImprovements} />
          <ReadOnlyGoals goals={goals} />
        </div>
      )}

      {/* ─── GAS Sheet ─── */}
      {gasSheetOpen && (
        <GasAssessmentSheet
          patientId={patientId}
          goals={goals.filter((g) => g.id)}
          open={gasSheetOpen}
          onOpenChange={setGasSheetOpen}
        />
      )}
    </div>
  );
}

// ─── ReadOnly helpers ────────────────────────────────────────────────────────

function ReadOnlyHtml({ label, value, placeholder = "Sin completar." }: { label: string; value?: string; placeholder?: string }) {
  const hasValue = value && value.replace(/<[^>]*>/g, "").trim();
  return (
    <div className="space-y-1.5">
      <p className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">{label}</p>
      {hasValue ? (
        <div className="text-sm prose prose-sm max-w-none bg-muted/30 rounded-md px-3 py-2" dangerouslySetInnerHTML={{ __html: value! }} />
      ) : (
        <p className="text-sm text-muted-foreground italic border border-dashed border-muted-foreground/40 rounded-md px-3 py-2">{placeholder}</p>
      )}
    </div>
  );
}

function ReadOnlyGoals({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) return <p className="text-sm text-muted-foreground italic border border-dashed border-muted-foreground/40 rounded-md px-3 py-2">Sin objetivos añadidos.</p>;

  const completedMetas: { goalIdx: number; goalText: string; meta: SpecificGoal }[] = [];
  goals.forEach((g, idx) => {
    (g.specificGoals ?? []).forEach((s) => {
      if (s.status === "Conseguido") completedMetas.push({ goalIdx: idx, goalText: g.text, meta: s });
    });
  });

  const enCurso = goals.filter((g) => g.status === "En curso");
  const conseguidos = goals.filter((g) => g.status === "Conseguido");
  const abandonados = goals.filter((g) => g.status === "Abandonado");

  function GoalCard({ g, num, showOnlyActive }: { g: Goal; num: number; showOnlyActive?: boolean }) {
    const areaColor = GOAL_AREA_COLORS[g.area] ?? "#6b7280";
    const specifics = showOnlyActive
      ? (g.specificGoals ?? []).filter((s) => s.status !== "Conseguido")
      : (g.specificGoals ?? []);
    return (
      <div className="rounded-lg border bg-card p-3 space-y-1.5" style={{ borderLeftWidth: "4px", borderLeftColor: areaColor }}>
        <p className="text-sm font-medium">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mr-1.5" style={{ backgroundColor: `${areaColor}20`, color: areaColor }}>{num}</span>
          {g.text}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px]" style={{ color: areaColor }}>{g.area || "Sin asignar"}</span>
          {g.scope && g.scope !== "Con el paciente" && (
            <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ color: GOAL_SCOPE_COLORS[g.scope as GoalScope] ?? "#6b7280", backgroundColor: `${GOAL_SCOPE_COLORS[g.scope as GoalScope] ?? "#6b7280"}18` }}>{g.scope}</span>
          )}
        </div>
        {specifics.length > 0 && (
          <ul className="space-y-0.5 mt-1">
            {specifics.map((s) => (
              <li key={s.id} className={`text-xs flex items-center gap-1.5 ${s.status === "Conseguido" ? "line-through text-muted-foreground" : ""}`}>
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${s.status === "Conseguido" ? "bg-green-100 border-green-400 text-green-600" : "border-muted-foreground/30"}`}>
                  {s.status === "Conseguido" && <span className="text-[10px]">✓</span>}
                </span>
                {s.text}
              </li>
            ))}
          </ul>
        )}
        {g.evaluation && <p className="text-[11px] text-muted-foreground mt-1 italic">{g.evaluation}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">Objetivos</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400" /> En curso ({enCurso.length})
          </p>
          {enCurso.length === 0 ? <p className="text-xs text-muted-foreground italic">Ninguno.</p> : enCurso.map((g, i) => <GoalCard key={i} g={g} num={goals.indexOf(g) + 1} showOnlyActive />)}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-green-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400" /> Conseguidos
          </p>
          {conseguidos.map((g, i) => <GoalCard key={`c-${i}`} g={g} num={goals.indexOf(g) + 1} />)}
          {completedMetas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-green-600 font-semibold">Metas funcionales conseguidas</p>
              {completedMetas.map((cm) => (
                <div key={cm.meta.id} className="flex items-center gap-2 text-xs rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5">
                  <span className="w-4 h-4 rounded border-2 border-green-400 bg-green-100 text-green-600 flex items-center justify-center shrink-0"><span className="text-[10px] font-bold">✓</span></span>
                  <div>
                    <span className="line-through text-muted-foreground">{cm.meta.text}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">({cm.goalText})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {conseguidos.length === 0 && completedMetas.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Ninguno todavía.</p>
          )}
          {abandonados.length > 0 && (
            <>
              <p className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5 mt-3">
                <span className="w-2 h-2 rounded-full bg-zinc-300" /> Abandonados ({abandonados.length})
              </p>
              {abandonados.map((g, i) => <GoalCard key={`a-${i}`} g={g} num={goals.indexOf(g) + 1} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Goals editor ────────────────────────────────────────────────────────────

function GoalsEditor({ value, onChange }: { value: Goal[]; onChange: (goals: Goal[]) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  const [specificInput, setSpecificInput] = useState<Record<number, string>>({});

  function addFromPredefined(obj: { text: string; area: GoalArea }) {
    onChange([...value, { text: obj.text, area: obj.area, scope: "Con el paciente", status: "En curso", specificGoals: [], startDate: new Date().toISOString().slice(0, 10), targetDate: null, evaluation: "", gasLevels: null }]);
    setShowPicker(false);
  }
  function addCustom() {
    onChange([...value, { text: "", area: "Cuidado de sí mismo", scope: "Con el paciente", status: "En curso", specificGoals: [], startDate: new Date().toISOString().slice(0, 10), targetDate: null, evaluation: "", gasLevels: null }]);
  }
  function updateRow(i: number, patch: Partial<Goal>) { onChange(value.map((g, idx) => (idx === i ? { ...g, ...patch } : g))); }
  function removeRow(i: number) {
    if (!confirm("¿Seguro que quieres eliminar este objetivo y sus metas funcionales?")) return;
    onChange(value.filter((_, idx) => idx !== i));
  }
  function addSpecific(goalIdx: number) {
    const text = (specificInput[goalIdx] ?? "").trim();
    if (!text) return;
    const goal = value[goalIdx];
    const specifics = [...(goal.specificGoals ?? []), { id: `sg-${Date.now()}`, text, status: "En curso" as GoalStatus }];
    updateRow(goalIdx, { specificGoals: specifics });
    setSpecificInput({ ...specificInput, [goalIdx]: "" });
  }
  function updateSpecific(goalIdx: number, specificId: string, patch: Partial<SpecificGoal>) {
    const goal = value[goalIdx];
    const specifics = (goal.specificGoals ?? []).map((s) => s.id === specificId ? { ...s, ...patch } : s);
    updateRow(goalIdx, { specificGoals: specifics });
  }
  function removeSpecific(goalIdx: number, specificId: string) {
    const goal = value[goalIdx];
    updateRow(goalIdx, { specificGoals: (goal.specificGoals ?? []).filter((s) => s.id !== specificId) });
  }

  const usedTexts = new Set(value.map((g) => g.text));

  return (
    <div className="space-y-3">
      <Label className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">Objetivos</Label>
      {value.length === 0 && <p className="text-xs text-muted-foreground italic">Sin objetivos añadidos.</p>}
      <div className="space-y-3">
        {value.map((goal, i) => {
          const areaColor = GOAL_AREA_COLORS[goal.area] ?? "#6b7280";
          return (
            <div key={i} className="rounded-lg border overflow-hidden" style={{ borderLeftWidth: "4px", borderLeftColor: areaColor }}>
              <div className="p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold mt-1.5 shrink-0" style={{ backgroundColor: `${areaColor}20`, color: areaColor }}>{i + 1}</span>
                  <div className="flex-1">
                    <Textarea rows={1} placeholder="Objetivo general…" value={goal.text} onChange={(e) => updateRow(i, { text: e.target.value })} className="text-sm font-medium" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeRow(i)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-5 gap-2">
                  <Select value={goal.area || "_none"} onValueChange={(v) => updateRow(i, { area: (v === "_none" ? "" : v) as GoalArea })}>
                    <SelectTrigger className="h-8 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: areaColor }} />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_AREAS.map((a) => (
                        <SelectItem key={a || "_none"} value={a || "_none"}><div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: GOAL_AREA_COLORS[a] }} />{a || "Sin asignar"}</div></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={goal.scope ?? "Con el paciente"} onValueChange={(v) => updateRow(i, { scope: v as GoalScope })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GOAL_SCOPES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={goal.status} onValueChange={(v) => updateRow(i, { status: v as GoalStatus })}>
                    <SelectTrigger className={`h-8 text-xs ${GOAL_STATUS_STYLES[goal.status]}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{GOAL_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Inicio</p>
                    <Input type="date" className="h-8 text-xs" value={goal.startDate ?? ""} onChange={(e) => updateRow(i, { startDate: e.target.value || null })} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Fecha objetivo</p>
                    <Input type="date" className="h-8 text-xs" value={goal.targetDate ?? ""} onChange={(e) => updateRow(i, { targetDate: e.target.value || null })} />
                  </div>
                </div>

                {/* Specific goals / metas funcionales */}
                <div className="space-y-1.5 pl-3 border-l-2" style={{ borderColor: `${areaColor}40` }}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Metas funcionales</p>
                  {(goal.specificGoals ?? []).map((sg) => (
                    <div key={sg.id} className="flex items-center gap-2 text-sm">
                      <button type="button" onClick={() => updateSpecific(i, sg.id, { status: sg.status === "Conseguido" ? "En curso" : "Conseguido" })}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sg.status === "Conseguido" ? "bg-green-100 border-green-400 text-green-600" : "border-muted-foreground/30"}`}>
                        {sg.status === "Conseguido" && <span className="text-[10px]">✓</span>}
                      </button>
                      <span className={`flex-1 ${sg.status === "Conseguido" ? "line-through text-muted-foreground" : ""}`}>{sg.text}</span>
                      <button type="button" onClick={() => removeSpecific(i, sg.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <Input placeholder="Añadir objetivo específico…" className="h-7 text-xs" value={specificInput[i] ?? ""}
                      onChange={(e) => setSpecificInput({ ...specificInput, [i]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSpecific(i); } }} />
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => addSpecific(i)} disabled={!(specificInput[i] ?? "").trim()}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Evaluación</Label>
                  <Textarea rows={2} placeholder="Valoración del progreso…" value={goal.evaluation ?? ""} onChange={(e) => updateRow(i, { evaluation: e.target.value })} className={!goal.evaluation ? "border-dashed border-muted-foreground/40" : ""} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add objective buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowPicker(!showPicker)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir objetivo predefinido
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={addCustom}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Objetivo personalizado
        </Button>
      </div>

      {/* Predefined objective picker */}
      {showPicker && (
        <div className="border rounded-md p-3 space-y-1.5 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Selecciona un objetivo general:</p>
          {PREDEFINED_OBJECTIVES.filter((o) => !usedTexts.has(o.text)).map((obj) => (
            <button key={obj.text} type="button" onClick={() => addFromPredefined(obj)}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2 border border-transparent hover:border-border transition-colors">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: GOAL_AREA_COLORS[obj.area] }} />
              <span className="flex-1">{obj.text}</span>
              <span className="text-[10px] text-muted-foreground">{obj.area}</span>
            </button>
          ))}
          {PREDEFINED_OBJECTIVES.filter((o) => !usedTexts.has(o.text)).length === 0 && (
            <p className="text-xs text-muted-foreground italic">Todos los objetivos predefinidos ya están añadidos.</p>
          )}
        </div>
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
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                              selected
                                ? "text-white border-transparent"
                                : "bg-white text-foreground border-border hover:bg-muted"
                            }`}
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
                    <Textarea
                      rows={1}
                      placeholder="Nota opcional…"
                      className="text-xs"
                      value={notes[goalId] ?? ""}
                      onChange={(e) => updateNote(goalId, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={createMut.isPending || Object.keys(scores).length === 0}
              >
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
                        <span
                          className="font-bold px-1.5 py-0.5 rounded text-white text-[11px] shrink-0"
                          style={{ backgroundColor: GAS_SCORE_COLORS[a.score] ?? "#6b7280" }}
                        >
                          {a.score > 0 ? `+${a.score}` : a.score}
                        </span>
                        {a.notes && <span className="text-muted-foreground italic flex-1 truncate">{a.notes}</span>}
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Eliminar valoración"
                        >
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
