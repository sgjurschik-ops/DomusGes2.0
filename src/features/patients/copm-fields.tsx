"use client";

// COPM — Canadian Occupational Performance Measure
// Faithful to the original protocol (Law, Baptiste, Carswell, McColl,
// Polatajko, Pollock).
//
// Step 1+2: Identify problems by area/subcategory (free text, up to 2 per
//           subcategory) and rate importance (1–10).
// Step 3:   Select up to 5 most important problems and rate Performance
//           (1–10) and Satisfaction (1–10).
// Step 4:   Re-evaluation — add new Performance/Satisfaction scores.
//
// Scoring:
//   Performance avg = sum of performance scores / # selected problems
//   Satisfaction avg = sum of satisfaction scores / # selected problems

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ChevronRight, ChevronLeft, BarChart3 } from "lucide-react";

// ─── Area definitions ──────────────────────────────────────────────────────────

type AreaDef = {
  id: string;
  title: string;
  color: string;        // tailwind bg class
  colorHex: string;     // for the chart
  subcategories: { id: string; label: string; examples: string }[];
};

const AREAS: AreaDef[] = [
  {
    id: "selfcare",
    title: "Cuidado de sí mismo",
    color: "bg-teal-500",
    colorHex: "#14b8a6",
    subcategories: [
      { id: "personal", label: "Cuidado personal", examples: "vestirse, bañarse, alimentarse, higiene" },
      { id: "mobility", label: "Movilidad funcional", examples: "traslados, desplazamiento interior/exterior" },
      { id: "community", label: "Gestión comunitaria", examples: "transporte, compras, finanzas" },
    ],
  },
  {
    id: "productivity",
    title: "Productividad",
    color: "bg-amber-500",
    colorHex: "#f59e0b",
    subcategories: [
      { id: "work", label: "Trabajo remunerado/voluntario", examples: "encontrar/mantener empleo, voluntariado" },
      { id: "home", label: "Manejo del hogar", examples: "limpieza, lavado de ropa, cocina" },
      { id: "school", label: "Juego/Escuela", examples: "destrezas de juego, tareas escolares" },
    ],
  },
  {
    id: "leisure",
    title: "Ocio",
    color: "bg-violet-500",
    colorHex: "#8b5cf6",
    subcategories: [
      { id: "quiet", label: "Recreación tranquila", examples: "pasatiempos, manualidades, lectura" },
      { id: "active", label: "Recreación activa", examples: "deportes, paseos, viajes" },
      { id: "social", label: "Socialización", examples: "visitas, llamadas telefónicas, correspondencia" },
    ],
  },
];

const SCORE_1_10 = Array.from({ length: 10 }, (_, i) => i + 1);

// ─── Types ─────────────────────────────────────────────────────────────────────

type Problem = {
  uid: string;          // unique id within the form
  areaId: string;
  subcatId: string;
  description: string;
  importance: number | undefined;
};

type SelectedProblem = {
  uid: string;          // matches Problem.uid
  performance: number | undefined;
  satisfaction: number | undefined;
  performance2: number | undefined;   // re-evaluation
  satisfaction2: number | undefined;  // re-evaluation
};

type CopmData = {
  problems: Problem[];
  selected: SelectedProblem[];
};

// ─── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  itemScores: Record<string, number>;
  onChange: (itemScores: Record<string, number>) => void;
  onProblemsChange?: (data: CopmData) => void;
  /** When true, show the re-evaluation columns (Step 4). */
  showReeval?: boolean;
};

// ─── Encoding helpers ──────────────────────────────────────────────────────────

function encodeToItemScores(data: CopmData): Record<string, number> {
  const scores: Record<string, number> = {};
  // Encode all problems' importance
  data.problems.forEach((p, i) => {
    if (p.importance !== undefined) scores[`prob_${i}_imp`] = p.importance;
  });
  scores.problemCount = data.problems.filter((p) => p.description.trim()).length;
  // Encode selected problems' scores
  data.selected.forEach((s, i) => {
    const n = i + 1;
    if (s.performance !== undefined) scores[`p${n}_performance`] = s.performance;
    if (s.satisfaction !== undefined) scores[`p${n}_satisfaction`] = s.satisfaction;
    if (s.performance2 !== undefined) scores[`p${n}_performance2`] = s.performance2;
    if (s.satisfaction2 !== undefined) scores[`p${n}_satisfaction2`] = s.satisfaction2;
  });
  scores.selectedCount = data.selected.length;
  return scores;
}

let uidCounter = 0;
function nextUid() {
  return `copm_${++uidCounter}_${Date.now()}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function CopmFields({ itemScores, onChange, onProblemsChange, showReeval = false }: Props) {
  const [step, setStep] = useState<1 | 3>(1);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<SelectedProblem[]>([]);

  // Sync out
  const syncOut = useCallback(() => {
    const data: CopmData = { problems, selected };
    onChange(encodeToItemScores(data));
    onProblemsChange?.(data);
  }, [problems, selected, onChange, onProblemsChange]);

  useEffect(() => { syncOut(); }, [syncOut]);

  // ─── Step 1+2 helpers ──────────────────────────────────────────────────────

  function addProblem(areaId: string, subcatId: string) {
    const count = problems.filter((p) => p.areaId === areaId && p.subcatId === subcatId).length;
    if (count >= 2) return;
    setProblems((prev) => [
      ...prev,
      { uid: nextUid(), areaId, subcatId, description: "", importance: undefined },
    ]);
  }

  function updateProblem(uid: string, patch: Partial<Problem>) {
    setProblems((prev) => prev.map((p) => (p.uid === uid ? { ...p, ...patch } : p)));
  }

  function removeProblem(uid: string) {
    setProblems((prev) => prev.filter((p) => p.uid !== uid));
    setSelected((prev) => prev.filter((s) => s.uid !== uid));
  }

  // ─── Step 3 helpers ────────────────────────────────────────────────────────

  function toggleSelect(uid: string) {
    setSelected((prev) => {
      const exists = prev.find((s) => s.uid === uid);
      if (exists) return prev.filter((s) => s.uid !== uid);
      if (prev.length >= 5) return prev;
      return [...prev, {
        uid,
        performance: undefined,
        satisfaction: undefined,
        performance2: undefined,
        satisfaction2: undefined,
      }];
    });
  }

  function updateSelected(uid: string, patch: Partial<SelectedProblem>) {
    setSelected((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  }

  // ─── Compute averages ──────────────────────────────────────────────────────

  const ratedSel = selected.filter((s) => s.performance !== undefined && s.satisfaction !== undefined);
  const perfAvg = ratedSel.length > 0
    ? ratedSel.reduce((sum, s) => sum + (s.performance ?? 0), 0) / ratedSel.length
    : null;
  const satAvg = ratedSel.length > 0
    ? ratedSel.reduce((sum, s) => sum + (s.satisfaction ?? 0), 0) / ratedSel.length
    : null;

  const ratedReeval = selected.filter((s) => s.performance2 !== undefined && s.satisfaction2 !== undefined);
  const perfAvg2 = ratedReeval.length > 0
    ? ratedReeval.reduce((sum, s) => sum + (s.performance2 ?? 0), 0) / ratedReeval.length
    : null;
  const satAvg2 = ratedReeval.length > 0
    ? ratedReeval.reduce((sum, s) => sum + (s.satisfaction2 ?? 0), 0) / ratedReeval.length
    : null;

  // Problems with description filled
  const filledProblems = problems.filter((p) => p.description.trim());
  // Sorted by importance descending for step 3
  const sortedByImportance = [...filledProblems]
    .filter((p) => p.importance !== undefined)
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));

  return (
    <div className="sm:col-span-2 space-y-4">
      <p className="text-xs text-muted-foreground">
        Medida Canadiense del Desempeño de Funciones Ocupacionales (COPM) —
        Law, Baptiste, Carswell, McColl, Polatajko, Pollock.
      </p>

      {/* Step tabs */}
      <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
        <button
          type="button"
          className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-colors ${
            step === 1 ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setStep(1)}
        >
          Pasos 1–2: Problemas e importancia
        </button>
        <button
          type="button"
          className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-colors ${
            step === 3 ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setStep(3)}
        >
          Paso 3: Calificación
        </button>
      </div>

      {step === 1 ? (
        <StepOneTwo
          problems={problems}
          addProblem={addProblem}
          updateProblem={updateProblem}
          removeProblem={removeProblem}
          onNext={() => setStep(3)}
        />
      ) : (
        <StepThree
          allProblems={sortedByImportance}
          selected={selected}
          toggleSelect={toggleSelect}
          updateSelected={updateSelected}
          showReeval={showReeval}
          onBack={() => setStep(1)}
        />
      )}

      {/* Scoring summary */}
      <div className="rounded-lg border bg-muted/40 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filledProblems.length} problemas identificados · {selected.length}/5 seleccionados
          </p>
        </div>
        {selected.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Evaluación inicial</p>
              <p className="text-sm font-semibold">
                Desempeño: {perfAvg !== null ? perfAvg.toFixed(1) : "—"}
              </p>
              <p className="text-sm font-semibold">
                Satisfacción: {satAvg !== null ? satAvg.toFixed(1) : "—"}
              </p>
            </div>
            {(showReeval || ratedReeval.length > 0) && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Re-evaluación</p>
                <p className="text-sm font-semibold">
                  Desempeño: {perfAvg2 !== null ? perfAvg2.toFixed(1) : "—"}
                </p>
                <p className="text-sm font-semibold">
                  Satisfacción: {satAvg2 !== null ? satAvg2.toFixed(1) : "—"}
                </p>
                {perfAvg !== null && perfAvg2 !== null && (
                  <div className="mt-1 space-y-0.5">
                    <ChangeIndicator label="Cambio desempeño" value={perfAvg2 - perfAvg} />
                    <ChangeIndicator label="Cambio satisfacción" value={(satAvg2 ?? 0) - (satAvg ?? 0)} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual summary chart */}
      {filledProblems.length > 0 && <CopmVisualSummary problems={filledProblems} selected={selected} />}
    </div>
  );
}

// ─── Step 1+2: Problem identification + importance ─────────────────────────────

function StepOneTwo({
  problems,
  addProblem,
  updateProblem,
  removeProblem,
  onNext,
}: {
  problems: Problem[];
  addProblem: (areaId: string, subcatId: string) => void;
  updateProblem: (uid: string, patch: Partial<Problem>) => void;
  removeProblem: (uid: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Identifique los problemas de desempeño ocupacional del paciente en cada área.
        Califique la importancia de cada problema del 1 al 10.
      </p>

      {AREAS.map((area) => (
        <div key={area.id} className="rounded-lg border overflow-hidden">
          <div className={`${area.color} px-3 py-2`}>
            <p className="text-xs font-semibold text-white">{area.title}</p>
          </div>
          <div className="p-3 space-y-3">
            {area.subcategories.map((subcat) => {
              const subcatProblems = problems.filter(
                (p) => p.areaId === area.id && p.subcatId === subcat.id,
              );
              return (
                <div key={subcat.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium">{subcat.label}</p>
                      <p className="text-[10px] text-muted-foreground">{subcat.examples}</p>
                    </div>
                    {subcatProblems.length < 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => addProblem(area.id, subcat.id)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {subcatProblems.map((prob) => (
                    <div key={prob.uid} className="flex items-center gap-2">
                      <Input
                        placeholder="Descripción del problema"
                        value={prob.description}
                        onChange={(e) => updateProblem(prob.uid, { description: e.target.value })}
                        className="flex-1 text-sm h-8"
                        style={{ fontSize: "16px" }}
                      />
                      <Select
                        value={prob.importance !== undefined ? String(prob.importance) : ""}
                        onValueChange={(v) => updateProblem(prob.uid, { importance: Number(v) })}
                      >
                        <SelectTrigger className="w-[72px] h-8 text-xs">
                          <SelectValue placeholder="Imp." />
                        </SelectTrigger>
                        <SelectContent>
                          {SCORE_1_10.map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeProblem(prob.uid)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onNext}>
          Siguiente: Calificación
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Select top 5 + rate performance/satisfaction ──────────────────────

function StepThree({
  allProblems,
  selected,
  toggleSelect,
  updateSelected,
  showReeval,
  onBack,
}: {
  allProblems: Problem[];
  selected: SelectedProblem[];
  toggleSelect: (uid: string) => void;
  updateSelected: (uid: string, patch: Partial<SelectedProblem>) => void;
  showReeval: boolean;
  onBack: () => void;
}) {
  const selectedUids = new Set(selected.map((s) => s.uid));

  if (allProblems.length === 0) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          Primero identifique los problemas en el Paso 1.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Volver al Paso 1
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Seleccione hasta 5 de los problemas más importantes. Para cada uno, califique
        desempeño y satisfacción del 1 al 10.
      </p>

      {/* Problem selection list */}
      <div className="rounded-lg border divide-y">
        {allProblems.map((prob) => {
          const area = AREAS.find((a) => a.id === prob.areaId);
          const isSelected = selectedUids.has(prob.uid);
          const sel = selected.find((s) => s.uid === prob.uid);
          const canSelect = isSelected || selected.length < 5;

          return (
            <div key={prob.uid} className={`p-3 transition-colors ${isSelected ? "bg-muted/30" : ""}`}>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isSelected}
                  disabled={!canSelect}
                  onCheckedChange={() => canSelect && toggleSelect(prob.uid)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{prob.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${area?.color ?? "bg-gray-400"}`}
                    />
                    <span className="text-[11px] text-muted-foreground">{area?.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      · Importancia: {prob.importance}
                    </span>
                  </div>
                </div>

                {isSelected && sel && (
                  <div className={`flex items-center gap-2 shrink-0 ${showReeval ? "" : ""}`}>
                    <ScoreSelect
                      label="Desempeño"
                      value={sel.performance}
                      onChange={(v) => updateSelected(prob.uid, { performance: v })}
                    />
                    <ScoreSelect
                      label="Satisfacción"
                      value={sel.satisfaction}
                      onChange={(v) => updateSelected(prob.uid, { satisfaction: v })}
                    />
                    {showReeval && (
                      <>
                        <ScoreSelect
                          label="Desempeño 2"
                          value={sel.performance2}
                          onChange={(v) => updateSelected(prob.uid, { performance2: v })}
                        />
                        <ScoreSelect
                          label="Satisfacción 2"
                          value={sel.satisfaction2}
                          onChange={(v) => updateSelected(prob.uid, { satisfaction2: v })}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-start">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          Volver al Paso 1
        </Button>
      </div>
    </div>
  );
}

// ─── Visual summary chart ──────────────────────────────────────────────────────

function CopmVisualSummary({ problems, selected }: { problems: Problem[]; selected: SelectedProblem[] }) {
  const selectedUids = new Set(selected.map((s) => s.uid));

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-foreground">Mapa de problemas identificados</p>
      </div>

      {AREAS.map((area) => {
        const areaProblems = problems.filter((p) => p.areaId === area.id);
        if (areaProblems.length === 0) return null;

        return (
          <div key={area.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-sm ${area.color}`} />
              <p className="text-xs font-medium">{area.title}</p>
              <span className="text-[10px] text-muted-foreground">
                ({areaProblems.length} problema{areaProblems.length !== 1 ? "s" : ""})
              </span>
            </div>

            <div className="pl-5 space-y-1">
              {areaProblems.map((prob) => {
                const subcat = area.subcategories.find((s) => s.id === prob.subcatId);
                const isSelected = selectedUids.has(prob.uid);
                const sel = selected.find((s) => s.uid === prob.uid);
                const imp = prob.importance ?? 0;
                // Bar width proportional to importance (1–10)
                const barWidth = Math.max(imp * 10, 10);

                return (
                  <div key={prob.uid} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`h-4 rounded-sm flex items-center px-1.5 ${
                            isSelected ? area.color : "bg-muted"
                          }`}
                          style={{ width: `${barWidth}%`, minWidth: "60px" }}
                        >
                          <span
                            className={`text-[10px] font-medium truncate ${
                              isSelected ? "text-white" : "text-foreground"
                            }`}
                          >
                            {prob.description}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-amber-500 shrink-0">★</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{subcat?.label}</span>
                        <span className="text-[10px] text-muted-foreground">Imp: {imp}</span>
                        {sel?.performance !== undefined && (
                          <span className="text-[10px] text-muted-foreground">
                            Des: {sel.performance} · Sat: {sel.satisfaction ?? "—"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-4 pt-1 border-t">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-muted border" />
          <span className="text-[10px] text-muted-foreground">Identificado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-amber-500">★</span>
          <span className="text-[10px] text-muted-foreground">Seleccionado (top 5)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Barra = importancia relativa</span>
        </div>
      </div>
    </div>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function ScoreSelect({ label, value, onChange }: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value !== undefined ? String(value) : ""} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className={"h-8 text-sm " + (value === undefined ? "bg-muted/60" : "")}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {SCORE_1_10.map((n) => (
            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ChangeIndicator({ label, value }: { label: string; value: number }) {
  const formatted = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
  const color = value > 0 ? "text-emerald-600" : value < 0 ? "text-red-500" : "text-muted-foreground";
  return (
    <p className={`text-[11px] ${color}`}>
      {label}: {formatted}
    </p>
  );
}

/** Build the score string shown in the assessment history list. */
export function formatCopmScore(itemScores: Record<string, number>): string {
  const count = itemScores.selectedCount ?? 0;
  if (count === 0) return "COPM — sin calificación";
  let perfSum = 0;
  let satSum = 0;
  let rated = 0;
  for (let i = 1; i <= count; i++) {
    const p = itemScores[`p${i}_performance`];
    const s = itemScores[`p${i}_satisfaction`];
    if (p !== undefined && s !== undefined) {
      perfSum += p;
      satSum += s;
      rated++;
    }
  }
  if (rated === 0) return "COPM — sin calificación";
  return `Desempeño: ${(perfSum / rated).toFixed(1)} · Satisfacción: ${(satSum / rated).toFixed(1)} (${rated} problemas)`;
}
