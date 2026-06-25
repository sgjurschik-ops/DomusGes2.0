"use client";

import { usePatient, useVisits, useAssessments, useProfessionals, useCreateAssessment, useDeletePatient, useUpdatePatient } from "@/hooks/api";
import { useNav } from "@/store/nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, SpecialtyBadge, StatusBadge, ScoreDots, formatDate, formatDateTime } from "@/components/domain";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { assessmentCreateSchema, type AssessmentCreateInput, ASSESSMENT_SCALES, STRUCTURED_SCALES } from "@/lib/schemas";
import { formatScaleScore } from "@/lib/scales";
import { StructuredScaleFields } from "./structured-scale-fields";
import { AssessmentDetailDialog } from "./assessment-detail-dialog";
import { ArrowLeft, Phone, MapPin, Stethoscope, Target, User2, Calendar, ClipboardList, Plus, Trash2, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { OccupationalProfileTab } from "./occupational-profile-tab";

export function PatientDetailView() {
  const { selectedPatientId, navigate, back } = useNav();
  const { data: patient, isLoading } = usePatient(selectedPatientId);
  const { data: visits } = useVisits(selectedPatientId ?? undefined);
  const { data: assessments } = useAssessments(selectedPatientId ?? undefined);
  const { data: professionals } = useProfessionals();
  const deletePatient = useDeletePatient();
  const updatePatient = useUpdatePatient();
  const [openAssessmentId, setOpenAssessmentId] = useState<string | null>(null);

  if (!selectedPatientId) {
    return <p className="text-sm text-muted-foreground">Selecciona un paciente.</p>;
  }

  if (isLoading || !patient) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={back}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      {/* Header card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <Avatar name={patient.fullName} color={patient.color} size={56} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold">{patient.fullName}</h2>
                <SpecialtyBadge specialty={patient.specialty} />
                <StatusBadge status={patient.status} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {patient.age} años · {patient.totalVisits} visitas · Inicio {formatDate(patient.startDate)}
              </p>

              {/* Clinical info first — what matters most before a session */}
              <div className="mt-3 rounded-md bg-accent/40 px-3 py-2.5 space-y-2">
                <InfoRow icon={Stethoscope} label="Diagnóstico / motivo de derivación" value={patient.diagnosis ?? "—"} />
                <InfoRow icon={Target} label="Objetivo terapéutico" value={patient.objective ?? "—"} />
              </div>

              {/* Administrative info — contact, scheduling, referral */}
              <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm">
                <InfoRow icon={Phone} label="Teléfono" value={patient.phone ?? "—"} />
                <InfoRow icon={MapPin} label="Dirección" value={patient.address ?? "—"} />
                <InfoRow icon={User2} label="Referente" value={
                  patient.referentName ? `${patient.referentName} · ${patient.referentPhone ?? ""}` : "—"
                } />
                <InfoRow icon={Calendar} label="Próxima cita" value={
                  patient.nextAppointmentDate ? formatDateTime(patient.nextAppointmentDate) : "Sin cita"
                } />
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Terapeutas:</span>
                {patient.therapistNames.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Sin asignar</span>
                ) : (
                  patient.therapistNames.map((n, i) => (
                    <Badge key={n} variant="secondary" className="text-xs">
                      {n}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
                
   <Button
  variant="outline"
  onClick={() => {
    navigate("edit-patient");
  }}
>
  <Pencil className="w-4 h-4 mr-1.5" />
  
  Editar
</Button>          
  <Button
    variant="destructive"
    onClick={async () => {
      const ok = confirm(
        `¿Seguro que quieres eliminar a ${patient.fullName}? Esta acción no se puede deshacer.`,
      );

      if (!ok) return;

      try {
        await deletePatient.mutateAsync(patient.id);
        toast({
          title: "Paciente eliminado",
          description: `${patient.fullName} ha sido eliminado.`,
        });
        navigate("patients");
      } catch {
        toast({
          title: "Error",
          description: "No se ha podido eliminar el paciente.",
          variant: "destructive",
        });
      }
    }}
  >
    <Trash2 className="w-4 h-4 mr-1.5" />

    Eliminar
  </Button>

  <Button
    onClick={() => {
      useNav.getState().setNewVisitPatient(patient.id);
      navigate("new-visit");
    }}
    disabled={!professionals?.length}
  >
    <Plus className="w-4 h-4 mr-1.5" />

    Registrar visita
  </Button>
</div>
          </div>
       </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="visits">Visitas ({visits?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="occupational-profile">Perfil ocupacional</TabsTrigger>
          <TabsTrigger value="assessments">Escalas</TabsTrigger>
          <TabsTrigger value="progress">Evolución</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Última visita</CardTitle>
              </CardHeader>
              <CardContent>
                {visits && visits.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {formatDateTime(visits[0].date)} · {visits[0].durationMin} min · {visits[0].therapistName}
                    </p>
                    <p className="text-sm line-clamp-3">{visits[0].notes}</p>
                    {visits[0].score !== null && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Progreso:</span>
                        <ScoreDots score={visits[0].score} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin visitas registradas.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Últimas evaluaciones</CardTitle>
              </CardHeader>
              <CardContent>
                {assessments && assessments.length > 0 ? (
                  <ul className="space-y-1.5">
                    {assessments.slice(0, 4).map((a) => (
                      <li key={a.id} className="flex items-center justify-between text-sm">
                        <span>{a.scale}</span>
                        <span className="font-mono">{a.score}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin evaluaciones registradas.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Visits */}
        <TabsContent value="visits" className="mt-4 space-y-3">
          {!visits || visits.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No hay visitas registradas todavía.
            </Card>
          ) : (
            visits.map((v) => (
              <Card key={v.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-medium">{formatDateTime(v.date)}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.durationMin} min · {v.therapistName}
                      </p>
                    </div>
                    {v.score !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Progreso</span>
                        <ScoreDots score={v.score} />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{v.notes}</p>
                  {v.interventions.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      {v.interventions.map((it, i) => (
                        <Badge key={i} variant="outline" className="text-[11px]">{it}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

{/* Occupational profile */}
<TabsContent value="occupational-profile" className="mt-4">
  <OccupationalProfileTab patientId={patient.id} />
</TabsContent>

        {/* Assessments */}
        <TabsContent value="assessments" className="mt-4 space-y-4">
          <AssessmentForm
            patientId={patient.id}
            therapistId={patient.therapistIds[0] ?? professionals?.[0]?.id ?? ""}
          />
          {!assessments || assessments.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Sin evaluaciones registradas todavía.
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Historial</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {assessments.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setOpenAssessmentId(a.id)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium">{a.scale}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(a.date)} · {a.therapistName}
                          </p>
                          {a.notes && <p className="text-xs text-muted-foreground mt-1 italic">{a.notes}</p>}
                        </div>
                        <span className="font-mono text-sm font-semibold shrink-0">{a.score}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Progress */}
        <TabsContent value="progress" className="mt-4">
          <ProgressChart assessments={assessments ?? []} />
        </TabsContent>
      </Tabs>

      {openAssessmentId && (
        <AssessmentDetailDialog
          assessmentId={openAssessmentId}
          patientId={patient.id}
          onClose={() => setOpenAssessmentId(null)}
        />
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground">{label}: </span>
        <span className="text-sm text-foreground">{value}</span>
      </div>
    </div>
  );
}

function AssessmentForm({ patientId, therapistId }: { patientId: string; therapistId: string }) {
  const create = useCreateAssessment();
  const [itemScores, setItemScores] = useState<Record<string, number>>({});
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AssessmentCreateInput>({
    resolver: zodResolver(assessmentCreateSchema) as Resolver<AssessmentCreateInput>,
    defaultValues: {
      patientId,
      therapistId,
      scale: "VAVDI",
      score: "",
      notes: "",
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const scale = watch("scale");
  const isStructured = (STRUCTURED_SCALES as readonly string[]).includes(scale);
  const structuredItemCount = isStructured
    ? Object.keys(itemScores).length
    : 0;

  // Keep the (hidden, but still registered) `score` field in sync with the
  // computed total as items are answered. This matters because
  // react-hook-form/Zod validate `score` on submit regardless of whether
  // the input is visually shown — hiding the field without updating its
  // value left `score` empty, so validation silently failed and the
  // submit handler never ran (no value -> no API call -> nothing visible).
  useEffect(() => {
    if (isStructured) {
      setValue("score", formatScaleScore(scale, itemScores), { shouldValidate: false });
    }
  }, [isStructured, scale, itemScores, setValue]);

  async function onSubmit(values: AssessmentCreateInput) {
    const payload = isStructured ? { ...values, itemScores } : values;
    try {
      await create.mutateAsync(payload);
      toast({ title: "Evaluación registrada" });
      setItemScores({});
      reset({ ...values, score: "", notes: "" });
    } catch {
      toast({
        title: "Error al guardar",
        description: "No se ha podido registrar la evaluación. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  }

  function handleScaleChange(value: AssessmentCreateInput["scale"]) {
    setValue("scale", value);
    setItemScores({});
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Registrar evaluación</CardTitle>
        <CardDescription className="text-xs">
          Aplica una escala validada y registra la puntuación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-3">
          <input type="hidden" {...register("patientId")} />
          <input type="hidden" {...register("therapistId")} />
          <div className="space-y-1.5">
            <Label htmlFor="scale" className="text-xs">Escala</Label>
            <Select value={scale} onValueChange={handleScaleChange}>
              <SelectTrigger id="scale"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSESSMENT_SCALES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isStructured ? (
            <input type="hidden" {...register("score")} />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="score" className="text-xs">Puntuación</Label>
              <Input id="score" placeholder="p. ej. 5/10, 18/27" {...register("score")} />
              {errors.score && <p className="text-xs text-destructive">{errors.score.message}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-xs">Fecha</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>

          {isStructured && (
            <StructuredScaleFields scale={scale} itemScores={itemScores} onChange={setItemScores} />
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes" className="text-xs">Notas (opcional)</Label>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={
                create.isPending ||
                (isStructured && structuredItemCount < (STRUCTURED_SCALES as readonly string[]).length)
              }
            >
              {create.isPending ? "Guardando…" : "Añadir evaluación"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProgressChart({ assessments }: { assessments: { scale: string; score: string; date: string }[] }) {
  // Group by scale and parse "x/y" → x/y * 100 for normalization.
  const data = useMemo(() => {
    const byScale: Record<string, { date: string; value: number }[]> = {};
    for (const a of assessments) {
      const m = a.score.match(/^(\d+)\s*\/\s*(\d+)/);
      const v = m ? (parseFloat(m[1]) / parseFloat(m[2])) * 100 : parseFloat(a.score);
      if (isNaN(v)) continue;
      byScale[a.scale] ??= [];
      byScale[a.scale].push({ date: a.date, value: Math.round(v) });
    }
    return Object.entries(byScale).map(([scale, points]) => ({
      scale,
      points: points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    }));
  }, [assessments]);

  if (data.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Aún no hay datos suficientes para mostrar la evolución.
          Registra evaluaciones periódicamente para ver el progreso.
        </p>
      </Card>
    );
  }

  // Build merged dataset: one row per unique date with one column per scale.
  const allDates = Array.from(new Set(data.flatMap((d) => d.points.map((p) => p.date)))).sort();
  const merged = allDates.map((date) => {
    const row: Record<string, number | string> = { date: new Date(date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) };
    for (const { scale, points } of data) {
      const p = points.find((p) => p.date === date);
      if (p) row[scale] = p.value;
    }
    return row;
  });

  const COLORS = ["#1a5c58", "#5b3fa0", "#c17f3a", "#b03060", "#2a6b3f", "#1a5c80", "#7c3a3a"];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Evolución por escala (normalizada 0–100)</CardTitle>
        <CardDescription className="text-xs">
          Cada escala se normaliza a 0–100 para comparar tendencias.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={merged}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              {data.map((d, i) => (
                <Area
                  key={d.scale}
                  type="monotone"
                  dataKey={d.scale}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
