"use client";

import { usePatient, useVisits, useAssessments, useProfessionals, useCreateAssessment, useDeletePatient, useUpdatePatient } from "@/hooks/api";
import { useNav } from "@/store/nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, SpecialtyBadge, StatusBadge, formatDate, formatDateTime } from "@/components/domain";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { assessmentCreateSchema, type AssessmentCreateInput, ASSESSMENT_SCALES, STRUCTURED_SCALES } from "@/lib/schemas";
import { formatScaleScore, STRUCTURED_SCALE_DEFINITIONS } from "@/lib/scales";
import { StructuredScaleFields } from "./structured-scale-fields";
import { AssessmentDetailDialog } from "./assessment-detail-dialog";
import { VisitDetailDialog } from "./visit-detail-dialog";
import { PatientReportDialog } from "./patient-report-dialog";
import { ArrowLeft, Phone, MapPin, Stethoscope, Target, User2, Calendar, ClipboardList, Plus, Trash2, Pencil, MoreVertical, ArrowUp, ArrowDown, Minus, AlertTriangle, FileDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot,
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
  const [openVisitId, setOpenVisitId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

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
                {patient.age} años · {patient.totalVisits} seguimientos · Inicio {formatDate(patient.startDate)}
              </p>

              {/* Alerts — shown first, above clinical info, so they're the
                  very first thing seen before a session */}
              {(patient.alerts ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(patient.alerts ?? []).map((alert) => (
                    <span
                      key={alert}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-100 border border-amber-300 text-amber-900 font-medium"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {alert}
                    </span>
                  ))}
                </div>
              )}

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
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={() => {
                  useNav.getState().setNewVisitPatient(patient.id);
                  navigate("new-visit");
                }}
                disabled={!professionals?.length}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Registrar seguimiento
              </Button>

              <Button variant="outline" size="sm" onClick={() => setReportDialogOpen(true)}>
                <FileDown className="w-4 h-4 mr-1.5" />
                Generar informe
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Más acciones">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("edit-patient")}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
       </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="visits">Seguimientos ({visits?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="occupational-profile">Perfil ocupacional</TabsTrigger>
          <TabsTrigger value="assessments">Escalas</TabsTrigger>
          <TabsTrigger value="progress">Evolución</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Último seguimiento</CardTitle>
              </CardHeader>
              <CardContent>
                {visits && visits.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium mb-0.5">{visits[0].title ?? "Seguimiento"}</p>
                    <p className="text-xs text-muted-foreground mb-1">
                      {formatDateTime(visits[0].date)} · {visits[0].durationMin} min · {visits[0].therapistName}
                    </p>
                    <p className="text-sm line-clamp-3">{visits[0].notes}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin seguimientos registrados.</p>
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
              No hay seguimientos registrados todavía.
            </Card>
          ) : (
            visits.map((v) => (
              <Card
                key={v.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenVisitId(v.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenVisitId(v.id);
                  }
                }}
                className="cursor-pointer transition-colors hover:bg-muted/50"
              >
                <CardContent className="p-4">
                  <div className="mb-2">
                    <p className="text-sm font-semibold">{v.title ?? "Seguimiento"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(v.date)} · {v.durationMin} min · {v.therapistName}
                    </p>
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
        </TabsContent>

        {/* Progress */}
        <TabsContent value="progress" className="mt-4 space-y-4">
          <ProgressChart assessments={assessments ?? []} onOpenAssessment={setOpenAssessmentId} />
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
      </Tabs>

      {openAssessmentId && (
        <AssessmentDetailDialog
          assessmentId={openAssessmentId}
          patientId={patient.id}
          onClose={() => setOpenAssessmentId(null)}
        />
      )}

      {openVisitId && (
        <VisitDetailDialog
          visitId={openVisitId}
          patientId={patient.id}
          onClose={() => setOpenVisitId(null)}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {patient.fullName}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Esta acción no se puede deshacer. Se eliminarán también:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>{visits?.length ?? 0} seguimiento{(visits?.length ?? 0) === 1 ? "" : "s"} registrado{(visits?.length ?? 0) === 1 ? "" : "s"}</li>
                  <li>{assessments?.length ?? 0} evaluación{(assessments?.length ?? 0) === 1 ? "" : "es"} de escalas</li>
                  <li>Su perfil ocupacional, si lo tiene completado</li>
                  <li>Sus citas programadas en la Agenda</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePatient.isPending}
              onClick={async () => {
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
              {deletePatient.isPending ? "Eliminando…" : "Eliminar definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PatientReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        patientId={patient.id}
        patientName={patient.fullName}
      />
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

function ProgressChart({
  assessments,
  onOpenAssessment,
}: {
  assessments: { id: string; scale: string; score: string; date: string }[];
  onOpenAssessment: (id: string) => void;
}) {
  // Group by scale, keeping both the normalized value (for the mini chart's
  // Y position) and the original "x/y — interpretation" string (for the
  // subtitle), since the backend already computes that text for us.
  const data = useMemo(() => {
    const byScale: Record<string, { id: string; date: string; value: number; label: string }[]> = {};
    for (const a of assessments) {
      const m = a.score.match(/^(\d+)\s*\/\s*(\d+)/);
      const v = m ? (parseFloat(m[1]) / parseFloat(m[2])) * 100 : parseFloat(a.score);
      if (isNaN(v)) continue;
      byScale[a.scale] ??= [];
      byScale[a.scale].push({ id: a.id, date: a.date, value: Math.round(v), label: a.score });
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Evolución por escala</CardTitle>
        <CardDescription className="text-xs">
          Una franja por escala, con el cambio respecto a la evaluación anterior. Haz clic en un punto para abrir esa evaluación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.map((d, i) => (
          <ScaleTrendRow
            key={d.scale}
            scale={d.scale}
            points={d.points}
            color={SCALE_COLORS[i % SCALE_COLORS.length]}
            onOpenAssessment={onOpenAssessment}
            isLast={i === data.length - 1}
          />
        ))}
      </CardContent>
    </Card>
  );
}

const SCALE_COLORS = ["#1a5c58", "#5b3fa0", "#c17f3a", "#b03060", "#2a6b3f", "#1a5c80", "#7c3a3a"];

function ScaleTrendRow({
  scale,
  points,
  color,
  onOpenAssessment,
  isLast,
}: {
  scale: string;
  points: { id: string; date: string; value: number; label: string }[];
  color: string;
  onOpenAssessment: (id: string) => void;
  isLast: boolean;
}) {
  const last = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;
  const delta = prev ? last.value - prev.value : null;

  // VAVDI is the opposite of Barthel/Lawton-Brody: a LOWER score means MORE
  // autonomy. Defaults to true (higher = better) for any non-structured
  // scale not in this map, since that's the more common convention.
  const higherIsBetter = STRUCTURED_SCALE_DEFINITIONS[scale]?.higherIsBetter ?? true;
  const isImprovement = delta !== null && (higherIsBetter ? delta > 0 : delta < 0);
  const isDecline = delta !== null && (higherIsBetter ? delta < 0 : delta > 0);

  // Stretch the Y axis to the actual range of this scale's own points (with
  // a little padding) instead of a fixed 0–100, so a real but modest change
  // (e.g. 65 → 55) is visually legible instead of looking almost flat.
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.min(100, Math.max(...values));
  const pad = Math.max((max - min) * 0.3, 4);
  const domain: [number, number] = [Math.max(0, min - pad), Math.min(100, max + pad)];

  const chartData = points.map((p) => ({
    ...p,
    dateLabel: new Date(p.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
  }));

  function renderClickableDot(props: any) {
    const { key, ...rest } = props;
    const isLastPoint = rest.payload?.id === last.id;
    return (
      <Dot
        key={key}
        {...rest}
        r={isLastPoint ? 5 : 3}
        style={{ cursor: "pointer" }}
        onClick={() => onOpenAssessment(rest.payload.id)}
      />
    );
  }

  return (
    <div className={isLast ? "" : "pb-5 border-b"}>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-sm font-medium">{scale}</span>
        <div className="flex items-center gap-2 text-xs text-muted-foreground text-right">
          <span>{last.label}</span>
          {delta !== null && (
            <span
              className={
                "inline-flex items-center gap-0.5 font-medium shrink-0 " +
                (isImprovement ? "text-emerald-600" : isDecline ? "text-red-600" : "text-muted-foreground")
              }
              title={isImprovement ? "Mejora respecto a la evaluación anterior" : isDecline ? "Empeora respecto a la evaluación anterior" : "Sin cambios"}
            >
              {delta > 0 ? <ArrowUp className="w-3 h-3" /> : delta < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {Math.abs(delta)}
            </span>
          )}
        </div>
      </div>
      <div className="h-20 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 16, bottom: 0, left: 0 }}>
            <YAxis domain={domain} hide />
            <XAxis dataKey="dateLabel" hide />
            <Tooltip
              formatter={(_value: number, _name: string, ctx: any) => [ctx?.payload?.label ?? "", ""]}
              labelFormatter={(label: string) => label}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={color}
              fillOpacity={0.1}
              strokeWidth={2}
              dot={renderClickableDot}
              activeDot={renderClickableDot}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
