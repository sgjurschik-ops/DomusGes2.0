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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[2fr_2fr_0.8fr_1fr_0.8fr] gap-3">
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
              <div className="space-y-1.5">
                <Label className="text-xs">Duración</Label>
                <Input type="number" min={15} max={240} step={15} {...register("durationMin")} />
                {errors.durationMin && <p className="text-xs text-destructive">{errors.durationMin.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha <span className="text-destructive">*</span></Label>
                <Input type="date" {...register("date")} />
                {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hora <span className="text-destructive">*</span></Label>
                <Input type="time" {...register("time")} />
                {errors.time && <p className="text-xs text-destructive">{errors.time.message}</p>}
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Notes get the visual weight: bigger label, larger textarea by default */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Notas clínicas <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground">Observaciones, evolución y plan.</p>
              <Textarea
                rows={12}
                placeholder="Describe la sesión: hallazgos, técnicas aplicadas, respuesta del paciente, plan para el próximo seguimiento…"
                className="text-sm"
                {...register("notes")}
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
