"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateVisit, usePatients, useProfessionals } from "@/hooks/api";
import { useNav } from "@/store/nav";
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
import { useState } from "react";

import { z } from "zod";

export function NewVisitForm() {
  const create = useCreateVisit();
  const { data: patients } = usePatients();
  const { data: professionals } = useProfessionals();
  const { back, newVisitPatientId, selectPatient, navigate } = useNav();
  const [interventionInput, setInterventionInput] = useState("");

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
      time: "10:00",
      durationMin: 45,
      title: "",
      notes: "",
      interventions: [],
    },
  });

  async function onSubmit(values: VisitCreateInput) {
    try {
      const v = await create.mutateAsync(values);
      toast({ title: "Seguimiento registrado", description: v.patientName });
      selectPatient(values.patientId);
      navigate("patient-detail");
    } catch (e: any) {
      toast({ title: "Error al registrar seguimiento", variant: "destructive" });
    }
  }

  const interventions = watch("interventions");

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
                <Input type="time" className="px-2" {...register("time")} />
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
