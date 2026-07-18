"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateVisit, usePatients, useProfessionals } from "@/hooks/api";
import { useNav } from "@/store/nav";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichTextarea } from "@/components/rich-textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, X, Plus } from "lucide-react";
import { visitCreateSchema, type VisitCreateInput } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";

import { z } from "zod";

export function NewVisitForm() {
  const create = useCreateVisit();
  const { data: patients } = usePatients();
  const { data: professionals } = useProfessionals();
  const { back, newVisitPatientId, selectPatient, navigate } = useNav();
  const [interventionInput, setInterventionInput] = useState("");
  const [patientGoals, setPatientGoals] = useState<{ id: string; text: string; area: string; status: string }[]>([]);



  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof visitCreateSchema>, any, z.output<typeof visitCreateSchema>>({
    resolver: zodResolver(visitCreateSchema),
    defaultValues: {
      patientId: newVisitPatientId ?? "",
      therapistId: "",
      date: new Date().toISOString().slice(0, 10),
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
    },
  });

  async function onSubmit(values: VisitCreateInput) {
    try {
      // Update previous visit's tasks with completion status
      if (previousVisitId && previousTasks.length > 0) {
        await fetch(`/api/visits/${previousVisitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: JSON.stringify(previousTasks) }),
        }).catch(() => {});
      }
      const v = await create.mutateAsync(values);
      toast({ title: "Seguimiento registrado", description: v.patientName });
      selectPatient(values.patientId);
      back();
    } catch (e: any) {
      toast({ title: "Error al registrar seguimiento", variant: "destructive" });
    }
  }

  const interventions = watch("interventions");
  const selectedPatientId = watch("patientId");
  const [previousTasks, setPreviousTasks] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [previousVisitId, setPreviousVisitId] = useState<string | null>(null);
  const [taskInput, setTaskInput] = useState("");

  // Fetch patient goals and previous tasks when patient changes
  useEffect(() => {
    if (!selectedPatientId) { setPatientGoals([]); setPreviousTasks([]); setPreviousVisitId(null); return; }
    fetch(`/api/patients/${selectedPatientId}/occupational-profile`)
      .then((r) => r.json())
      .then((data) => {
        const goals = (data?.goals ?? []).filter((g: any) => g.status === "En curso");
        setPatientGoals(goals);
      })
      .catch(() => setPatientGoals([]));
    fetch(`/api/visits?patientId=${selectedPatientId}&limit=1`)
      .then((r) => r.json())
      .then((visits: any[]) => {
        if (visits.length > 0 && Array.isArray(visits[0].tasks)) {
          const pending = visits[0].tasks.filter((t: any) => !t.completed);
          setPreviousTasks(pending);
          setPreviousVisitId(visits[0].id);
        } else {
          setPreviousTasks([]);
          setPreviousVisitId(null);
        }
      })
      .catch(() => { setPreviousTasks([]); setPreviousVisitId(null); });
  }, [selectedPatientId]);

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
    <div className="max-w-3xl mx-auto space-y-4">
      <button
        onClick={back}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos del seguimiento</CardTitle>
            <CardDescription>Registra la sesión realizada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Compact data row: 2 cols on mobile, 3 on tablet, all 5 in one row from lg up */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.8fr_1.8fr_1fr_1.1fr_0.9fr] gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-xs">Paciente <span className="text-destructive">*</span></Label>
                <Controller
                  control={control}
                  name="patientId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecciona un paciente" /></SelectTrigger>
                      <SelectContent>
                        {(patients ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.patientId && <p className="text-xs text-destructive">{errors.patientId.message}</p>}
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
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

            {/* Title + notes get the visual weight */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Título del seguimiento <span className="text-destructive">*</span></Label>
              <Input
                placeholder="p. ej. Primera valoración, Revisión mensual…"
                {...register("title")}
              />
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
                    rows={12}
                    placeholder="Describe la sesión: hallazgos, técnicas aplicadas, respuesta del paciente, plan para el próximo seguimiento…"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
            </div>

            {/* Goals worked on this session */}
            {patientGoals.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Objetivos trabajados en esta sesión</Label>
                <Controller control={control} name="goalIds"
                  render={({ field }) => (
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {patientGoals.map((goal) => {
                        const checked = (field.value ?? []).includes(goal.id);
                        return (
                          <label key={goal.id}
                            className={`flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition-colors ${checked ? "bg-primary/5 border-primary/30" : "hover:bg-muted"}`}>
                            <input type="checkbox" checked={checked} className="mt-0.5"
                              onChange={() => {
                                const current = field.value ?? [];
                                field.onChange(checked ? current.filter((id: string) => id !== goal.id) : [...current, goal.id]);
                              }} />
                            <div className="min-w-0">
                              <p className="text-sm leading-tight">{goal.text}</p>
                              <p className="text-[10px] text-muted-foreground">{goal.area}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                />
              </div>
            )}

            {/* Previous session tasks — review */}
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

            {/* New tasks for next session */}
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
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={back}>Cancelar</Button>
          <Button type="submit" disabled={create.isPending}>
            <Save className="w-4 h-4 mr-1.5" />
            {create.isPending ? "Guardando…" : "Registrar seguimiento"}
          </Button>
        </div>
      </form>
    </div>
  );
}
