"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateVisit, useMe } from "@/hooks/api";
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
import { Save, X, Plus, Target } from "lucide-react";
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

type Props = {
  open: boolean;
  patientId: string;
  patientName: string;
  /** Most recent visit for this patient, already loaded by the parent (useVisits) — avoids a duplicate fetch. */
  previousVisit?: VisitDTO;
  onClose: () => void;
};

export function NewVisitForm({ open, patientId, patientName, previousVisit, onClose }: Props) {
  const create = useCreateVisit();
  const { data: me } = useMe();
  const [interventionInput, setInterventionInput] = useState("");
  const [patientGoals, setPatientGoals] = useState<{ id: string; text: string; area: string; status: string }[]>([]);

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
    defaultValues: {
      patientId,
      therapistId: me?.id ?? "",
      date: todayLocalDateStr(),
      time: (() => {
        const now = new Date();
        const m = Math.round(now.getMinutes() / 15) * 15;
        const h = m === 60 ? now.getHours() + 1 : now.getHours();
        return `${String(h % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      })(),
      durationMin: 60,
      title: "",
      notes: "",
      interventions: [],
      goalIds: [],
      tasks: [],
    },
  });

  // Pending tasks from the previous visit, kept in sync with the parent's
  // already-loaded `visits` query (no separate fetch, no staleness).
  const [previousTasks, setPreviousTasks] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [taskInput, setTaskInput] = useState("");

  // Reset the form and pull in fresh context each time the panel is opened.
  useEffect(() => {
    if (!open) return;
    reset({
      patientId,
      therapistId: me?.id ?? "",
      date: todayLocalDateStr(),
      time: (() => {
        const now = new Date();
        const m = Math.round(now.getMinutes() / 15) * 15;
        const h = m === 60 ? now.getHours() + 1 : now.getHours();
        return `${String(h % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      })(),
      durationMin: 60,
      title: "",
      notes: "",
      interventions: [],
      goalIds: [],
      tasks: [],
    });
    setPreviousTasks((previousVisit?.tasks ?? []).filter((t) => !t.completed));
    setTaskInput("");
    setInterventionInput("");

    setPatientGoals([]);
    fetch(`/api/patients/${patientId}/occupational-profile`)
      .then((r) => r.json())
      .then((data) => {
        const goals = (data?.goals ?? []).filter((g: any) => g.status === "En curso");
        setPatientGoals(goals);
      })
      .catch(() => setPatientGoals([]));
  }, [open, patientId, previousVisit?.id, me?.id]);

  async function onSubmit(values: VisitCreateInput) {
    try {
      // Update previous visit's tasks with completion status marked in this form.
      if (previousVisit && previousTasks.length > 0) {
        await fetch(`/api/visits/${previousVisit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: JSON.stringify(previousTasks) }),
        }).catch(() => {});
      }
      await create.mutateAsync(values);
      toast({ title: "Seguimiento registrado", description: patientName });
      onClose();
    } catch {
      toast({ title: "Error al registrar seguimiento", variant: "destructive" });
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

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
          <SheetHeader>
            <SheetTitle>Nuevo seguimiento</SheetTitle>
            <SheetDescription>{patientName}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            <input type="hidden" {...register("therapistId")} />
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
                            <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Objetivos en curso</p>
                            {patientGoals.map((goal) => {
                              const checked = selected.includes(goal.id);
                              return (
                                <label key={goal.id}
                                  className={`flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${checked ? "bg-primary/5" : "hover:bg-muted"}`}>
                                  <input type="checkbox" checked={checked} className="mt-0.5"
                                    onChange={() => {
                                      field.onChange(checked ? selected.filter((id: string) => id !== goal.id) : [...selected, goal.id]);
                                    }} />
                                  <div className="min-w-0">
                                    <p className="text-sm leading-tight">{goal.text}</p>
                                    <p className="text-[10px] text-muted-foreground">{goal.area}</p>
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
                  {(field.value ?? []).map((task: { id: string; text: string }) => (
                    <div key={task.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                      <span className="flex-1">{task.text}</span>
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

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              <Save className="w-4 h-4 mr-1.5" />
              {create.isPending ? "Guardando…" : "Registrar seguimiento"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
