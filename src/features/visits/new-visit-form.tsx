"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateVisit, useUpdateVisit, useDeleteVisit, useMe, useProfessionals } from "@/hooks/api";
import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RichTextarea } from "@/components/rich-textarea";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Save, X, Plus, Target, Trash2 } from "lucide-react";
import { visitCreateSchema, type VisitCreateInput } from "@/lib/schemas";
import type { VisitDTO } from "@/types/domain";
import { toast } from "@/hooks/use-toast";

import { z } from "zod";

// The previous default used `new Date().toISOString().slice(0, 10)`, which
// takes the UTC calendar date — while the default `time` below is read from
// the browser's local wall clock. Near midnight in Madrid (UTC+1/+2) these
// two can disagree on which day it is, silently pre-filling the wrong date
// next to a correct-looking time. This reads the date from the same local
// clock as the time, so both always describe the same instant.
function todayLocalDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function nowRoundedTimeStr(): string {
  const now = new Date();
  const m = Math.round(now.getMinutes() / 15) * 15;
  const h = m === 60 ? now.getHours() + 1 : now.getHours();
  return `${String(h % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// The 5 GAS levels, worst to best — must match GAS_LEVEL_KEYS in
// occupational-profile-tab.tsx (where the per-goal descriptions are written).
const GAS_KEYS = ["-2", "-1", "0", "1", "2"] as const;

type Props = {
  open: boolean;
  patientId: string;
  patientName: string;
  /** Most recent visit for this patient, already loaded by the parent (useVisits) — avoids a duplicate fetch. */
  previousVisit?: VisitDTO;
  /**
   * When set, the panel opens in edit mode for this existing visit instead
   * of creating a new one — same Sheet, same fields (including Objetivos
   * and Tareas), so editing has full parity with creating instead of
   * falling back to a separate, more limited dialog.
   */
  editVisit?: VisitDTO;
  onClose: () => void;
};

export function NewVisitForm({ open, patientId, patientName, previousVisit, editVisit, onClose }: Props) {
  const isEditMode = !!editVisit;
  const create = useCreateVisit();
  const update = useUpdateVisit();
  const del = useDeleteVisit();
  const { data: me } = useMe();
  const { data: professionals } = useProfessionals();
  const [interventionInput, setInterventionInput] = useState("");
  const [patientGoals, setPatientGoals] = useState<{ id: string; text: string; area: string; status: string; gasLevels: Record<string, string> | null }[]>([]);

  function buildDefaults(): z.input<typeof visitCreateSchema> {
    if (editVisit) {
      return {
        patientId,
        therapistId: editVisit.therapistId,
        date: editVisit.date.slice(0, 10),
        time: editVisit.date.slice(11, 16),
        durationMin: editVisit.durationMin,
        title: editVisit.title ?? "",
        notes: /<[a-z][\s\S]*>/i.test(editVisit.notes) ? editVisit.notes : editVisit.notes.replace(/\n/g, "<br>"),
        interventions: editVisit.interventions,
        goalIds: editVisit.goalIds ?? [],
        gasScores: editVisit.gasScores ?? {},
        tasks: editVisit.tasks ?? [],
      };
    }
    return {
      patientId,
      therapistId: me?.id ?? "",
      date: todayLocalDateStr(),
      time: nowRoundedTimeStr(),
      durationMin: 60,
      title: "",
      notes: "",
      interventions: [],
      goalIds: [],
      gasScores: {},
      tasks: [],
    };
  }

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof visitCreateSchema>, any, z.output<typeof visitCreateSchema>>({
    resolver: zodResolver(visitCreateSchema),
    defaultValues: buildDefaults(),
  });

  // Pending tasks from the previous visit, kept in sync with the parent's
  // already-loaded `visits` query (no separate fetch, no staleness). Not
  // applicable in edit mode — there we're just editing this visit's own
  // record, not reviewing what came before it.
  const [previousTasks, setPreviousTasks] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [taskInput, setTaskInput] = useState("");

  // Reset the form and pull in fresh context each time the panel is opened.
  useEffect(() => {
    if (!open) return;
    reset(buildDefaults());
    setPreviousTasks(isEditMode ? [] : (previousVisit?.tasks ?? []).filter((t) => !t.completed));
    setTaskInput("");
    setInterventionInput("");

    setPatientGoals([]);
    fetch(`/api/patients/${patientId}/occupational-profile`)
      .then((r) => r.json())
      .then((data) => {
        function withParsedGas(g: any) {
          let gasLevels: Record<string, string> | null = null;
          if (typeof g.gasLevels === "string" && g.gasLevels) {
            try { gasLevels = JSON.parse(g.gasLevels); } catch { gasLevels = null; }
          }
          return { id: g.id, text: g.text, area: g.area, status: g.status, gasLevels };
        }
        const allGoals = (data?.goals ?? []).map(withParsedGas);
        const inCurso = allGoals.filter((g: any) => g.status === "En curso");
        // If we're editing a visit that references a goal no longer "En
        // curso" (e.g. since marked "Conseguido"), keep it selectable/shown
        // instead of having it silently vanish from the picker.
        const referencedIds: string[] = editVisit?.goalIds ?? [];
        const alsoNeeded = allGoals.filter(
          (g: any) => referencedIds.includes(g.id) && g.status !== "En curso",
        );
        setPatientGoals([...inCurso, ...alsoNeeded]);
      })
      .catch(() => setPatientGoals([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId, previousVisit?.id, editVisit?.id, me?.id]);

  async function onSubmit(values: VisitCreateInput) {
    if (isEditMode && editVisit) {
      try {
        const { patientId: _pid, ...updateData } = values;
        await update.mutateAsync({ id: editVisit.id, data: updateData });
        toast({ title: "Seguimiento actualizado", description: patientName });
        onClose();
      } catch {
        toast({ title: "Error al actualizar seguimiento", variant: "destructive" });
      }
      return;
    }
    try {
      // Update previous visit's tasks with completion status marked in this form.
      if (previousVisit && previousTasks.length > 0) {
        await fetch(`/api/visits/${previousVisit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: JSON.stringify(previousTasks) }),
        }).catch(() => {});
      }
      // Carry forward any task still pending from the previous visit into
      // THIS visit's own tasks. Otherwise, once this visit becomes the
      // "previous visit" for the next one, only its own tasks are reviewed
      // — anything left pending 2+ visits back would silently disappear
      // instead of continuing to show up as pending.
      const stillPending = previousTasks.filter((t) => !t.completed);
      const payload = { ...values, tasks: [...stillPending, ...(values.tasks ?? [])] };
      await create.mutateAsync(payload);
      toast({ title: "Seguimiento registrado", description: patientName });
      onClose();
    } catch {
      toast({ title: "Error al registrar seguimiento", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!editVisit) return;
    if (!confirm("¿Eliminar este seguimiento? Esta acción no se puede deshacer.")) return;
    try {
      await del.mutateAsync({ id: editVisit.id, patientId });
      toast({ title: "Seguimiento eliminado" });
      onClose();
    } catch {
      toast({ title: "Error", description: "No se ha podido eliminar el seguimiento.", variant: "destructive" });
    }
  }

  const interventions = watch("interventions");

  function togglePreviousTask(id: string) {
    setPreviousTasks((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t));
  }

  function addTask() {
    const t = taskInput.trim();
    if (!t) return;
    const current = watch("tasks") ?? [];
    setValue("tasks", [...current, { id: `task-${Date.now()}`, text: t, completed: false }]);
    setTaskInput("");
  }

  function removeTask(id: string) {
    const current = watch("tasks") ?? [];
    setValue("tasks", current.filter((t: any) => t.id !== id));
  }

  function addIntervention() {
    const t = interventionInput.trim();
    if (!t) return;
    setValue("interventions", [...(interventions ?? []), t]);
    setInterventionInput("");
  }
  function removeIntervention(idx: number) {
    setValue("interventions", (interventions ?? []).filter((_, i) => i !== idx));
  }

  const isSaving = isEditMode ? update.isPending : create.isPending;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
          <SheetHeader>
            <SheetTitle>{isEditMode ? "Editar seguimiento" : "Nuevo seguimiento"}</SheetTitle>
            <SheetDescription>
              {isEditMode ? `Corrige los datos registrados · ${patientName}` : patientName}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            {isEditMode ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Terapeuta <span className="text-destructive">*</span></Label>
                <Controller
                  control={control}
                  name="therapistId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecciona un terapeuta" /></SelectTrigger>
                      <SelectContent>
                        {(professionals ?? []).filter((p) => p.isActive).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} · {p.role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.therapistId && <p className="text-xs text-destructive">{errors.therapistId.message}</p>}
              </div>
            ) : (
              <input type="hidden" {...register("therapistId")} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">Fecha <span className="text-destructive">*</span></Label>
                <Input type="date" className="px-2" {...register("date")} />
                {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs">Hora <span className="text-destructive">*</span></Label>
                <Controller control={control} name="time"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Hora" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {Array.from({ length: 24 }, (_, h) =>
                          [0, 15, 30, 45].map((m) => {
                            const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                            return <SelectItem key={val} value={val}>{val}</SelectItem>;
                          })
                        ).flat()}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.time && <p className="text-xs text-destructive">{errors.time.message}</p>}
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Título del seguimiento <span className="text-destructive">*</span></Label>
              <Input placeholder="p. ej. Primera valoración, Revisión mensual…" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Notas clínicas <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">Observaciones, evolución y plan.</p>
              <Controller
                control={control}
                name="notes"
                render={({ field }) => (
                  <RichTextarea
                    rows={10}
                    placeholder="Describe la sesión: hallazgos, técnicas aplicadas, respuesta del paciente, plan para el próximo seguimiento…"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
            </div>

            {patientGoals.length > 0 && (
              <Controller control={control} name="goalIds"
                render={({ field }) => {
                  const selected = (field.value ?? []) as string[];
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Objetivos trabajados</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1">
                              <Target className="w-3.5 h-3.5" />
                              Seleccionar ({selected.length})
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 max-h-64 overflow-y-auto p-2" align="end">
                            <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Objetivos</p>
                            {patientGoals.map((goal) => {
                              const checked = selected.includes(goal.id);
                              return (
                                <label key={goal.id}
                                  className={`flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${checked ? "bg-[#1a5c58]/5" : "hover:bg-muted"}`}>
                                  <input type="checkbox" checked={checked} className="mt-0.5"
                                    onChange={() => {
                                      field.onChange(checked ? selected.filter((id: string) => id !== goal.id) : [...selected, goal.id]);
                                    }} />
                                  <div className="min-w-0">
                                    <p className="text-sm leading-tight">{goal.text}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {goal.area}{goal.status !== "En curso" ? ` · ${goal.status}` : ""}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </PopoverContent>
                        </Popover>
                      </div>
                      {selected.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selected.map((gid) => {
                            const goal = patientGoals.find((g) => g.id === gid);
                            return goal ? (
                              <Badge key={gid} variant="secondary" className="text-[11px] gap-1 py-0.5">
                                {goal.text}
                                <button type="button" onClick={() => field.onChange(selected.filter((id: string) => id !== gid))} className="hover:text-destructive">
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                      {selected.some((gid) => patientGoals.find((g) => g.id === gid)?.gasLevels) && (
                        <Controller
                          control={control}
                          name="gasScores"
                          render={({ field: gasField }) => {
                            const scores = (gasField.value ?? {}) as Record<string, number>;
                            return (
                              <div className="space-y-2 rounded-md border border-dashed border-fuchsia-300 bg-fuchsia-50/40 p-2.5">
                                <p className="text-[10px] font-medium text-fuchsia-800">Puntuación GAS de este seguimiento</p>
                                {selected.map((gid) => {
                                  const goal = patientGoals.find((g) => g.id === gid);
                                  if (!goal?.gasLevels) return null;
                                  const current = scores[gid];
                                  return (
                                    <div key={gid} className="space-y-1">
                                      <p className="text-xs">{goal.text}</p>
                                      <div className="flex gap-1">
                                        {GAS_KEYS.map((k) => (
                                          <button
                                            key={k}
                                            type="button"
                                            title={goal.gasLevels![k]}
                                            onClick={() => gasField.onChange({ ...scores, [gid]: Number(k) })}
                                            className={`flex-1 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition-colors ${current === Number(k) ? "border-fuchsia-500 bg-fuchsia-100 text-fuchsia-900" : "hover:bg-muted"}`}
                                          >
                                            {k === "0" ? "0" : k.startsWith("-") ? k : `+${k}`}
                                          </button>
                                        ))}
                                      </div>
                                      {current !== undefined && (
                                        <p className="text-[10px] text-muted-foreground italic">{goal.gasLevels[String(current)]}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }}
                        />
                      )}
                    </div>
                  );
                }}
              />
            )}

            {previousTasks.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Tareas de la sesión anterior</Label>
                <div className="space-y-1">
                  {previousTasks.map((task) => (
                    <label key={task.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${task.completed ? "bg-green-50 border-green-200" : "hover:bg-muted"}`}>
                      <input type="checkbox" checked={task.completed} onChange={() => togglePreviousTask(task.id)} className="mt-0" />
                      <span className={`text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.text}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground italic">Marca las tareas que el paciente ha completado.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Tareas para la próxima sesión</Label>
              <div className="flex gap-2">
                <Input placeholder="Ej. Practicar poner la lavadora solo" value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }} />
                <Button type="button" variant="outline" size="sm" onClick={addTask} disabled={!taskInput.trim()}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Controller control={control} name="tasks" render={({ field }) => (
                <div className="space-y-1">
                  {(field.value ?? []).map((task: { id: string; text: string; completed?: boolean }) => (
                    <div key={task.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                      <span className={`flex-1 ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.text}</span>
                      <button type="button" onClick={() => removeTask(task.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Intervenciones realizadas</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="p. ej. Ejercicios activos asistidos"
                  value={interventionInput}
                  onChange={(e) => setInterventionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addIntervention();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addIntervention}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {(interventions ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(interventions ?? []).map((it, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {it}
                      <button
                        type="button"
                        onClick={() => removeIntervention(i)}
                        aria-label={`Quitar ${it}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="flex-row items-center justify-between gap-2 border-t">
            {isEditMode ? (
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={del.isPending}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                {del.isPending ? "Eliminando…" : "Eliminar"}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                <Save className="w-4 h-4 mr-1.5" />
                {isSaving ? "Guardando…" : isEditMode ? "Guardar cambios" : "Registrar seguimiento"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
