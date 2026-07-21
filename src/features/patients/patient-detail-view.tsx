"use client";

import { usePatient, useVisits, useAssessments, useProfessionals, useCreateAssessment, useDeletePatient, useUpdatePatient, useMe } from "@/hooks/api";
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
import { assessmentCreateSchema, type AssessmentCreateInput, STRUCTURED_SCALES, QUALITATIVE_SCALES, ASSESSMENT_CATEGORIES } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { formatScaleScore, isScaleComplete, STRUCTURED_SCALE_DEFINITIONS } from "@/lib/scales";
import { StructuredScaleFields } from "./structured-scale-fields";
import { CopmFields, formatCopmScore } from "./copm-fields";
import { AssessmentDetailDialog } from "./assessment-detail-dialog";
import { VisitDetailDialog } from "./visit-detail-dialog";
import { NewVisitForm } from "@/features/visits/new-visit-form";
import { EvolutionTable } from "./evolution-table";
import { PatientReportDialog } from "./patient-report-dialog";
import { ArrowLeft, Phone, MapPin, Stethoscope, Target, User2, Calendar, ClipboardList, Plus, Trash2, Pencil, MoreVertical, ArrowUp, ArrowDown, Minus, AlertTriangle, FileDown, Activity, ListChecks, StickyNote, Home, Hand, Fingerprint, BatteryLow, Brain, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { OccupationalProfileTab, getProfileCompletion } from "./occupational-profile-tab";
import { ClinicalNotes } from "@/components/clinical-notes";
import { Mic, MicOff } from "lucide-react";

export function PatientDetailView() {
  const { selectedPatientId, navigate, back } = useNav();
  const { data: patient, isLoading } = usePatient(selectedPatientId);
  const { data: visits } = useVisits(selectedPatientId ?? undefined);
  const { data: assessments } = useAssessments(selectedPatientId ?? undefined);
  const { data: professionals } = useProfessionals();
  const { data: me } = useMe();
  const isAdmin = me?.userRole === "admin";
  const deletePatient = useDeletePatient();
  const updatePatient = useUpdatePatient();
  const [openAssessmentId, setOpenAssessmentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [openVisitId, setOpenVisitId] = useState<string | null>(null);
  const [openVisitEdit, setOpenVisitEdit] = useState(false);
  const [newVisitOpen, setNewVisitOpen] = useState(false);
  const [problemsUser, setProblemsUser] = useState<string>("");
  const [profileCompletion, setProfileCompletion] = useState<{ filled: number; total: number } | null>(null);

  const [patientGoals, setPatientGoals] = useState<{ id: string; text: string; area: string }[]>([]);

  // Fetch patient-reported problems, profile completion, and goals from occupational profile
  useEffect(() => {
    if (!selectedPatientId) return;
    fetch(`/api/patients/${selectedPatientId}/occupational-profile`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.problemsUser) setProblemsUser(data.problemsUser);
        setProfileCompletion(getProfileCompletion(data ?? {}));
        setPatientGoals((data?.goals ?? []).filter((g: any) => g.status === "En curso"));
      })
      .catch(() => {});
  }, [selectedPatientId]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [evolutionView, setEvolutionView] = useState<"chart" | "table">("table");

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
          <div className="flex gap-0">
            {/* Left: patient info */}
            <div className="flex-1 min-w-0 space-y-2.5">
              {/* Row 1: Identity + action buttons */}
              <div className="flex items-start gap-3">
                <Avatar name={patient.fullName} color={patient.color} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold leading-tight">{patient.fullName}</h2>
                    <SpecialtyBadge specialty={patient.specialty} />
                    <StatusBadge status={patient.status} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {patient.age} años · {patient.totalVisits} seguimientos · Inicio {formatDate(patient.startDate)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setReportDialogOpen(true)}>
                    <FileDown className="w-3.5 h-3.5 mr-1" />Informe
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Más acciones"><MoreVertical className="w-3.5 h-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate("edit-patient")}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteDialogOpen(true)}><Trash2 className="w-4 h-4 mr-2" />Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Row 2: Alerts (if any) */}
              {(patient.alerts ?? []).length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(patient.alerts ?? []).map((alert) => (
                    <span key={alert} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: "var(--chip-orange-bg)", color: "var(--chip-orange-text)" }}>
                      <AlertTriangle className="w-3 h-3" />{alert}
                    </span>
                  ))}
                </div>
              )}

              {/* Row 3: Clinical info */}
              <div className="rounded-md bg-accent/40 px-3 py-2 space-y-0.5">
                <div className="flex items-start gap-2">
                  <Stethoscope className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs"><span className="text-muted-foreground">Diagnóstico: </span><span className="font-medium">{patient.diagnosis ?? "—"}</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <Target className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs"><span className="text-muted-foreground">Objetivo: </span><span className="font-medium">{patient.objective ?? "—"}</span></p>
                </div>
              </div>

              {/* Row 4: Contact & scheduling — smaller text */}
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Teléfono:</span>
                  <span className="font-medium">{patient.phone ?? "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Dirección:</span>
                  <span className="font-medium">{patient.address ?? "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Referente:</span>
                  <span className="font-medium">{patient.referentName ? `${patient.referentName} · ${patient.referentPhone ?? ""}` : "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Próxima cita:</span>
                  {patient.nextAppointmentDate ? (
                    <button type="button" onClick={() => navigate("calendar")} className="text-xs text-primary hover:underline font-medium">
                      {formatDateTime(patient.nextAppointmentDate)}
                    </button>
                  ) : (
                    <span className="font-medium">Sin cita</span>
                  )}
                </div>
              </div>

              {/* Row 5: Therapists */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground">Terapeutas:</span>
                {patient.therapistNames.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground italic">Sin asignar</span>
                ) : (
                  patient.therapistNames.map((n) => (<Badge key={n} variant="secondary" className="text-[11px] py-0">{n}</Badge>))
                )}
              </div>
            </div>

            {/* Divider */}
            {!isAdmin && <div className="w-px bg-border mx-4 self-stretch hidden lg:block" />}
            {!isAdmin && <QuickNotes patientId={patient.id} initial={patient.quickNotes} />}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full max-w-2xl ${isAdmin ? "grid-cols-1 max-w-xs" : "grid-cols-5"}`}>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          {!isAdmin && <TabsTrigger value="visits">Seguimientos</TabsTrigger>}
          {!isAdmin && <TabsTrigger value="occupational-profile">Perfil ocupacional</TabsTrigger>}
          {!isAdmin && <TabsTrigger value="assessments">Valoración</TabsTrigger>}
          {!isAdmin && <TabsTrigger value="progress">Evolución</TabsTrigger>}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {!isAdmin && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button type="button" onClick={() => setActiveTab("visits")} className="text-left">
                <KpiChip icon={Calendar} color="blue" label="Última visita"
                  value={visits && visits.length > 0 ? formatDate(visits[0].date) : "Sin visitas"} />
              </button>
              <button type="button" onClick={() => setActiveTab("visits")} className="text-left">
                <KpiChip icon={ClipboardList} color="green" label="Seguimientos"
                  value={`${patient.totalVisits}`} />
              </button>
              <button type="button" onClick={() => setActiveTab("assessments")} className="text-left">
                <KpiChip icon={Activity} color="purple" label="Última evaluación"
                  value={assessments && assessments.length > 0 ? `${assessments[0].scale} · ${assessments[0].score}` : "Sin registrar"} />
              </button>
              <button type="button" onClick={() => setActiveTab("occupational-profile")} className="text-left">
                <KpiChip icon={ListChecks} color="yellow" label="Perfil ocupacional"
                  value={profileCompletion ? `${profileCompletion.filled}/${profileCompletion.total} campos` : "—"} />
              </button>
            </div>
          )}

          {isAdmin && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <p>Como administrador/a, no tienes acceso a la información clínica del paciente.</p>
              <p className="mt-1">Puedes gestionar citas desde la <button type="button" onClick={() => navigate("calendar")} className="text-primary hover:underline font-medium">Agenda</button>.</p>
            </Card>
          )}

          {!isAdmin && (
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Pending tasks */}
              <Card className="border-l-4" style={{ borderLeftColor: "var(--chip-blue-text)" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    Tareas pendientes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const lastTasks = visits && visits.length > 0 ? (visits[0].tasks ?? []).filter((t: any) => !t.completed) : [];
                    return lastTasks.length > 0 ? (
                      <ul className="space-y-1.5">
                        {lastTasks.map((task: any) => (
                          <li key={task.id} className="flex items-center gap-2 text-sm">
                            <span className="w-4 h-4 rounded border border-muted-foreground/30 flex items-center justify-center shrink-0" />
                            {task.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sin tareas pendientes.</p>
                    );
                  })()}
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
          )}

          {/* Pending tasks from last visit — old standalone card removed, integrated above */}

          {/* Patient-reported problems from occupational profile */}
          {!isAdmin && problemsUser && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Problemas detectados por el/la paciente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: problemsUser }} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Visits — hidden for admin */}
        {!isAdmin && <TabsContent value="visits" className="mt-4 space-y-3">
          <div className="flex items-center justify-end">
            <Button size="sm" className="h-8 text-xs px-3" onClick={() => setNewVisitOpen(true)} disabled={!professionals?.length}>
              <Plus className="w-3.5 h-3.5 mr-1" />Registrar seguimiento
            </Button>
          </div>
          {!visits || visits.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No hay seguimientos registrados todavía.
            </Card>
          ) : (
            visits.map((v, idx) => (
              <Card key={v.id} className="overflow-hidden" style={{ borderLeftWidth: "4px", borderLeftColor: idx === 0 ? "var(--chip-blue-text)" : "var(--border)" }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold">{v.title ?? "Seguimiento"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(v.date)} · {v.durationMin} min · {v.therapistName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setOpenVisitId(v.id); setOpenVisitEdit(true); }}>
                        <Pencil className="w-3 h-3 mr-1" /> Editar
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/40 px-3 py-2 mb-2">
                    <ClinicalNotes html={v.notes} />
                  </div>
                  {(v.goalIds ?? []).length > 0 && patientGoals.length > 0 && (
                    <div className="mt-2 flex items-start gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">Objetivos:</span>
                      {v.goalIds.map((gid) => {
                        const goal = patientGoals.find((g) => g.id === gid);
                        return goal ? <Badge key={gid} variant="secondary" className="text-[11px] py-0">{goal.text}</Badge> : null;
                      })}
                    </div>
                  )}
                  {(v.tasks ?? []).length > 0 && (
                    <div className="mt-3 rounded-md border bg-accent/30 px-3 py-2 space-y-1.5">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Tareas para la próxima sesión</p>
                      {v.tasks.map((t) => (
                        <div key={t.id} className={`flex items-center gap-2 text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>
                          <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${t.completed ? "bg-green-100 border-green-400 text-green-600" : "border-muted-foreground/40"}`}>
                            {t.completed && <span className="text-xs font-bold">✓</span>}
                          </span>
                          <span className="font-medium">{t.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
        </TabsContent>}

{/* Occupational profile — hidden for admin */}
{!isAdmin && <TabsContent value="occupational-profile" className="mt-4">
  <OccupationalProfileTab patientId={patient.id} />
</TabsContent>}

        {/* Assessments — hidden for admin */}
        {!isAdmin && <TabsContent value="assessments" className="mt-4 space-y-4">
          <AssessmentForm
            patientId={patient.id}
            therapistId={patient.therapistIds[0] ?? professionals?.[0]?.id ?? ""}
          />
        </TabsContent>}

        {/* Progress — hidden for admin */}
        {!isAdmin && <TabsContent value="progress" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
              <button type="button"
                className={`px-3 py-1.5 text-xs rounded-sm transition-colors ${evolutionView === "table" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setEvolutionView("table")}>
                Tabla evolución
              </button>
              <button type="button"
                className={`px-3 py-1.5 text-xs rounded-sm transition-colors ${evolutionView === "chart" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setEvolutionView("chart")}>
                Por escala
              </button>
            </div>
          </div>

          {evolutionView === "table" ? (
            <EvolutionTable assessments={assessments ?? []} onOpenAssessment={setOpenAssessmentId} />
          ) : (
            <ProgressChart assessments={assessments ?? []} onOpenAssessment={setOpenAssessmentId} />
          )}

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
        </TabsContent>}
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
          initialEdit={openVisitEdit}
          onClose={() => { setOpenVisitId(null); setOpenVisitEdit(false); }}
        />
      )}

      <NewVisitForm
        open={newVisitOpen}
        patientId={patient.id}
        patientName={patient.fullName}
        previousVisit={visits?.[0]}
        onClose={() => setNewVisitOpen(false)}
      />

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

type ChipColor = "blue" | "green" | "orange" | "purple" | "yellow";

const CHIP_VARS: Record<ChipColor, { bg: string; text: string }> = {
  blue: { bg: "var(--chip-blue-bg)", text: "var(--chip-blue-text)" },
  green: { bg: "var(--chip-green-bg)", text: "var(--chip-green-text)" },
  orange: { bg: "var(--chip-orange-bg)", text: "var(--chip-orange-text)" },
  purple: { bg: "var(--chip-purple-bg)", text: "var(--chip-purple-text)" },
  yellow: { bg: "var(--chip-yellow-bg)", text: "var(--chip-yellow-text)" },
};

function KpiChip({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: LucideIcon;
  color: ChipColor;
  label: string;
  value: string;
}) {
  const chip = CHIP_VARS[color];
  return (
    <div className="rounded-md p-3" style={{ backgroundColor: chip.bg }}>
      <p className="text-xs mb-1 flex items-center gap-1.5 opacity-80" style={{ color: chip.text }}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </p>
      <p className="text-sm font-semibold" style={{ color: chip.text }}>{value}</p>
    </div>
  );
}

const NOTE_COLORS: { bg: string; border: string }[] = [
  { bg: "var(--chip-blue-bg)", border: "var(--chip-blue-text)" },
  { bg: "var(--chip-green-bg)", border: "var(--chip-green-text)" },
  { bg: "var(--chip-orange-bg)", border: "var(--chip-orange-text)" },
  { bg: "var(--chip-purple-bg)", border: "var(--chip-purple-text)" },
  { bg: "var(--chip-yellow-bg)", border: "var(--chip-yellow-text)" },
];

interface QuickNote { id: string; text: string; colorIdx: number; }

function QuickNotes({ patientId, initial }: { patientId: string; initial?: string | null }) {
  const [notes, setNotes] = useState<QuickNote[]>(() => {
    if (!initial) return [];
    try { return JSON.parse(initial); } catch { return []; }
  });
  const [saving, setSaving] = useState(false);

  async function persist(updated: QuickNote[]) {
    setNotes(updated);
    setSaving(true);
    try {
      await fetch(`/api/patients/${patientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quickNotes: JSON.stringify(updated) }),
      });
    } catch { /* silent */ }
    setSaving(false);
  }

  function addNote() {
    const colorIdx = notes.length % NOTE_COLORS.length;
    persist([...notes, { id: Date.now().toString(), text: "", colorIdx }]);
  }
  function updateNote(id: string, text: string) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
  }
  function saveNote(id: string) {
    persist(notes.map((n) => (n.id === id ? { ...n } : n)));
  }
  function removeNote(id: string) {
    persist(notes.filter((n) => n.id !== id));
  }

  return (
    <div className="w-56 shrink-0 hidden lg:flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground flex items-center gap-1">
          <StickyNote className="w-3 h-3" /> Notas rápidas
        </span>
        <button type="button" onClick={addNote} className="text-xs text-primary hover:underline">+ Añadir</button>
      </div>
      {notes.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">Sin notas.</p>
      )}
      <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
        {notes.map((note) => {
          const c = NOTE_COLORS[note.colorIdx % NOTE_COLORS.length];
          return (
            <div key={note.id} className="rounded-md p-2 relative group" style={{ backgroundColor: c.bg, borderLeft: `3px solid ${c.border}` }}>
              <textarea
                value={note.text}
                onChange={(e) => updateNote(note.id, e.target.value)}
                onBlur={() => saveNote(note.id)}
                placeholder="Escribe una nota…"
                className="w-full bg-transparent text-xs resize-none outline-none min-h-[2rem] leading-relaxed"
                rows={2}
              />
              <button type="button" onClick={() => removeNote(note.id)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
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

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  avd: Home,
  destreza: Hand,
  sensibilidad: Fingerprint,
  fatiga: BatteryLow,
  cognitiva: Brain,
};

function AssessmentForm({ patientId, therapistId }: { patientId: string; therapistId: string }) {
  const create = useCreateAssessment();
  const [itemScores, setItemScores] = useState<Record<string, number>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [copmData, setCopmData] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>(ASSESSMENT_CATEGORIES[0].key);
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
      // No scale pre-selected — the professional picks a category, then a
      // scale, instead of always starting from the (previously hardcoded)
      // first scale in the list.
      scale: "" as AssessmentCreateInput["scale"],
      score: "",
      notes: "",
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const scale = watch("scale");
  const isCopm = scale === "COPM";
  const isStructured = (STRUCTURED_SCALES as readonly string[]).includes(scale);
  const isQualitative = (QUALITATIVE_SCALES as readonly string[]).includes(scale);

  // Keep the (hidden, but still registered) `score` field in sync with the
  // computed total as items are answered.
  useEffect(() => {
    if (isCopm) {
      setValue("score", formatCopmScore(itemScores), { shouldValidate: false });
    } else if (isStructured) {
      setValue("score", formatScaleScore(scale, itemScores), { shouldValidate: false });
    }
  }, [isStructured, isCopm, scale, itemScores, setValue]);

  async function onSubmit(values: AssessmentCreateInput) {
    const payload = isStructured
      ? {
          ...values,
          itemScores,
          // For COPM, store the full problem data in areaSummary
          ...(isCopm && copmData ? { areaSummary: copmData } : {}),
        }
      : values;
    try {
      await create.mutateAsync(payload);
      toast({ title: "Evaluación registrada" });
      setItemScores({});
      setCopmData(null);
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
    setCopmData(null);
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
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs">Área</Label>
            <div className="flex flex-wrap gap-1 rounded-md bg-muted/40 p-1">
              {ASSESSMENT_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.key];
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                      isActive ? "bg-[#1a5c58]/10 text-[#1a5c58] shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {ASSESSMENT_CATEGORIES.find((c) => c.key === activeCategory)?.scales.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1 py-1.5">Próximamente</p>
              ) : (
                ASSESSMENT_CATEGORIES.find((c) => c.key === activeCategory)?.scales.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleScaleChange(s as AssessmentCreateInput["scale"])}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs transition-colors",
                      scale === s ? "border-[#1a5c58] bg-[#1a5c58]/5 font-medium text-[#1a5c58]" : "hover:bg-muted/60",
                    )}
                  >
                    {s}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-xs">Fecha</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
          </div>
          {(scale as string) === "" ? null : isStructured ? (
            <input type="hidden" {...register("score")} />
          ) : isQualitative ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="score" className="text-xs">Observaciones</Label>
              <Textarea id="score" rows={4}
                placeholder="Describe los hallazgos de la exploración…"
                {...register("score")} />
              {errors.score && <p className="text-xs text-destructive">{errors.score.message}</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="score" className="text-xs">Puntuación</Label>
              <Input id="score" placeholder="p. ej. 5/10, 18/27" {...register("score")} />
              {errors.score && <p className="text-xs text-destructive">{errors.score.message}</p>}
            </div>
          )}

          {isCopm ? (
            <CopmFields
              itemScores={itemScores}
              onChange={setItemScores}
              onProblemsChange={setCopmData}
            />
          ) : isStructured ? (
            <StructuredScaleFields scale={scale} itemScores={itemScores} onChange={setItemScores} />
          ) : null}

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
                (scale as string) === "" ||
                (isStructured && !isCopm && !isScaleComplete(scale, itemScores))
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
