"use client";

import { usePatient, useVisits, useAssessments, useProfessionals, useCreateAssessment, useDeletePatient, useUpdatePatient, useMe } from "@/hooks/api";
import { useNav } from "@/store/nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, SpecialtyBadge, StatusBadge, ResourceBadge, formatDate, formatDateTime } from "@/components/domain";
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
import { assessmentCreateSchema, type AssessmentCreateInput, STRUCTURED_SCALES, QUALITATIVE_SCALES, ASSESSMENT_CATEGORIES, EM_ONLY_SCALES, EM_RESOURCE_KEY, RESOURCE_KEYS, SCALE_GROUPS, scalesForRole } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatScaleScore, isScaleComplete, STRUCTURED_SCALE_DEFINITIONS, computeScaleSubscales } from "@/lib/scales";
import { StructuredScaleFields } from "./structured-scale-fields";
import { CopmFields, formatCopmScore } from "./copm-fields";
import { AdlInventoryFields } from "./adl-inventory-fields";
import { ADL_INVENTORY_SCALE, buildEmptyAdlInventory, summarizeAdlInventory, type AdlInventoryData } from "@/lib/adl-inventory";
import { openVisitsPrint, type ExportVisit } from "@/lib/visits-export";
import { AssessmentDetailDialog } from "./assessment-detail-dialog";
import { NewVisitForm } from "@/features/visits/new-visit-form";
import { InterventionsTab } from "./interventions-tab";
import { EvolutionTable } from "./evolution-table";
import { PatientReportDialog } from "./patient-report-dialog";
import { ArrowLeft, Phone, MapPin, Stethoscope, Target, User2, Calendar, ClipboardList, Plus, Trash2, Pencil, MoreVertical, ArrowUp, ArrowDown, Minus, AlertTriangle, FileDown, Activity, ListChecks, StickyNote, Home, Hand, Fingerprint, BatteryLow, Brain, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { OccupationalProfileTab, getProfileCompletion } from "./occupational-profile-tab";
import { InterventionPlanTab } from "./intervention-plan-tab";
import { ClinicalNotes } from "@/components/clinical-notes";
import { Mic, MicOff } from "lucide-react";

/** Reduce a full Nominatim address to "Calle Nº, Ciudad" for display. */
function shortenAddress(full: string): string {
  const parts = full.split(",").map((p) => p.trim());
  if (parts.length <= 2) return full;
  // Nominatim format: number, street, barrio, zona, city, comarca, region, CP, country
  // We want: street number, city  (e.g. "Calle Estafeta 25, Pamplona")
  const num = parts[0];
  const street = parts[1] ?? "";
  // City is usually index 4 or 3 depending on depth
  const city = parts[4] ?? parts[3] ?? parts[2] ?? "";
  const isNum = /^\d/.test(num);
  if (isNum && street) return `${street} ${num}, ${city}`;
  return `${parts[0]}, ${city}`;
}

export function PatientDetailView() {
  const { selectedPatientId, navigate, back } = useNav();
  const { data: patient, isLoading } = usePatient(selectedPatientId);
  const { data: visits } = useVisits(selectedPatientId ?? undefined);
  const { data: assessmentsRaw } = useAssessments(selectedPatientId ?? undefined);
  const { data: professionals } = useProfessionals();
  const { data: me } = useMe();
  const isAdmin = me?.userRole === "admin";
  // El Perfil ocupacional es un instrumento propio de Terapia ocupacional:
  // su pestaña (y el acceso directo del Resumen) solo se muestran a ese perfil.
  const isTO = me?.role === "Terapia ocupacional";
  // Usuario/a de Centro de día (recurso EM + clasificación "Centro de día"):
  // cambia el nombre de un par de pestañas para adaptarse a su flujo.
  const isDayCenter = !!patient && patient.resource === "Asociación EM" && patient.emCategory === "Centro de día";
  const deletePatient = useDeletePatient();
  const updatePatient = useUpdatePatient();
  const [openAssessmentId, setOpenAssessmentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [openVisitId, setOpenVisitId] = useState<string | null>(null);
  const [newVisitOpen, setNewVisitOpen] = useState(false);
  const [problemsUser, setProblemsUser] = useState<string>("");
  const [profileCompletion, setProfileCompletion] = useState<{ filled: number; total: number } | null>(null);

  const [patientGoals, setPatientGoals] = useState<{ id: string; text: string; area: string }[]>([]);

  // Mapa profesional → profesión, para mostrar autor + profesión en los
  // seguimientos (compartidos) y en la exportación.
  // Escalas por profesión: cada profesional solo ve (en Valoración, Evolución,
  // Resumen…) las evaluaciones de las escalas de su propio perfil. Filtrando
  // aquí en el origen, todos los sitios que usan `assessments` quedan filtrados
  // sin tocarlos uno a uno.
  const allowedScales = useMemo(() => scalesForRole(me?.role), [me?.role]);
  const assessments = useMemo(
    () => (assessmentsRaw ?? []).filter((a) => allowedScales.includes(a.scale)),
    [assessmentsRaw, allowedScales],
  );

  const roleById = useMemo(
    () => new Map((professionals ?? []).map((p) => [p.id, p.role])),
    [professionals],
  );

  // Estilo de las pestañas agrupadas por color: cada grupo tiene su tono
  // (registro diario = teal de marca, documentación = índigo, medición =
  // violeta, entrada = gris). La pestaña activa se rellena en sólido para que
  // destaque mucho más que antes. `cn`/twMerge hace que estos colores ganen
  // sobre los del componente base.
  const TAB_BASE = "shrink-0 px-3 py-1.5 rounded-md font-medium data-[state=active]:shadow-sm";
  const TAB_ENTRY = "text-slate-600 hover:bg-slate-200/60 data-[state=active]:bg-slate-700 data-[state=active]:text-white";
  const TAB_DAILY = "text-[#1a5c58] hover:bg-[#1a5c58]/10 data-[state=active]:bg-[#1a5c58] data-[state=active]:text-white";
  const TAB_DOC = "text-indigo-600 hover:bg-indigo-100/70 data-[state=active]:bg-indigo-600 data-[state=active]:text-white";
  const TAB_MEASURE = "text-violet-600 hover:bg-violet-100/70 data-[state=active]:bg-violet-600 data-[state=active]:text-white";
  const SUBTAB = "px-4 text-violet-600 data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-sm";
  const TabSep = () => <span aria-hidden className="h-5 w-px bg-border shrink-0 self-center mx-0.5" />;

  // Exporta a PDF imprimible todos los seguimientos de este/a usuario/a,
  // reutilizando los datos ya cargados (no vuelve a pedir nada al servidor).
  // Incluye autor + profesión, notas, objetivos/GAS, intervenciones y tareas.
  function exportPatientVisits() {
    if (!patient) return;
    const exportVisits: ExportVisit[] = (visits ?? []).map((v) => ({
      date: v.date,
      durationMin: v.durationMin,
      title: v.title,
      notes: v.notes,
      therapistName: v.therapistName,
      therapistRole: roleById.get(v.therapistId) ?? null,
      interventions: v.interventions,
      tasks: v.tasks,
      goals: (v.goalIds ?? []).flatMap((gid) => {
        const goal = patientGoals.find((g) => g.id === gid);
        if (!goal) return [];
        const gas = v.gasScores?.[gid];
        return [gas === undefined ? { text: goal.text } : { text: goal.text, gas }];
      }),
    }));
    openVisitsPrint([{ patientName: patient.fullName, visits: exportVisits }], {
      title: patient.fullName,
    });
  }

  // Fetch patient-reported problems, profile completion, and goals from occupational profile
  useEffect(() => {
    if (!selectedPatientId) return;
    fetch(`/api/patients/${selectedPatientId}/occupational-profile`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.problemsUser) setProblemsUser(data.problemsUser);
        setProfileCompletion(getProfileCompletion(data ?? {}));
        // Used only to render the "Objetivos" badges on past seguimientos —
        // must include ALL goals regardless of status, otherwise a goal
        // that's since moved to "Conseguido" (or any other status) vanishes
        // from visits that already reference it.
        setPatientGoals(data?.goals ?? []);
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
                    <ResourceBadge resource={patient.resource} />
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
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Dirección:</span>
                  <span className="font-medium">{patient.address ? shortenAddress(patient.address) : "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Referente familiar:</span>
                  <span className="font-medium">{patient.referentName ? `${patient.referentName} · ${patient.referentPhone ?? ""}` : "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Referente:</span>
                  <span className="font-medium">{patient.referent || "—"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Referente equipo de cuidados:</span>
                  <span className="font-medium">{patient.careTeamReferent || "—"}</span>
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
            {!isAdmin && <QuickNotes patientId={patient.id} />}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="inline-flex w-full max-w-4xl items-center gap-1 overflow-x-auto bg-muted/60 py-1">
          <TabsTrigger value="overview" className={cn(TAB_BASE, TAB_ENTRY)}>Resumen</TabsTrigger>

          {!isAdmin && <TabSep />}
          {!isAdmin && <TabsTrigger value="visits" className={cn(TAB_BASE, TAB_DAILY)}>Seguimientos</TabsTrigger>}
          {!isAdmin && <TabsTrigger value="interventions" className={cn(TAB_BASE, TAB_DAILY)}>Intervenciones</TabsTrigger>}

          {!isAdmin && <TabSep />}
          {!isAdmin && isTO && <TabsTrigger value="occupational-profile" className={cn(TAB_BASE, TAB_DOC)}>{isDayCenter ? "Historia de Vida" : "Perfil ocupacional"}</TabsTrigger>}
          {!isAdmin && <TabsTrigger value="intervention-plan" className={cn(TAB_BASE, TAB_DOC)}>{isDayCenter ? "Objetivos PIAI" : "Plan de intervención"}</TabsTrigger>}

          {!isAdmin && <TabSep />}
          {!isAdmin && <TabsTrigger value="assessments" className={cn(TAB_BASE, TAB_MEASURE)}>Valoración</TabsTrigger>}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {!patient.resource && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-900 flex-1">
                Este paciente no tiene <strong>recurso</strong> asignado (Domicilio / Asociación EM). Es necesario para saber si sus sesiones se facturan.
              </p>
              <Select onValueChange={(v) => updatePatient.mutate(
                { id: patient.id, data: { resource: v as any } },
                { onSuccess: () => toast({ title: "Recurso asignado", description: v }) },
              )}>
                <SelectTrigger className="w-full sm:w-48 h-8 text-xs bg-background">
                  <SelectValue placeholder="Asignar recurso" />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_KEYS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
                  value={assessments && assessments.length > 0 ? `${assessments[0].scale} · ${formatDate(assessments[0].date)}` : "Sin registrar"} />
              </button>
              {isTO && <button type="button" onClick={() => setActiveTab("occupational-profile")} className="text-left">
                <KpiChip icon={ListChecks} color="yellow" label={isDayCenter ? "Historia de Vida" : "Perfil ocupacional"}
                  value={profileCompletion ? `${profileCompletion.filled}/${profileCompletion.total} campos` : "—"} />
              </button>}
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
                  <CardTitle className="text-sm flex items-center justify-between">
                    Últimas evaluaciones
                    <button type="button" className="text-xs font-normal text-primary hover:underline" onClick={() => setActiveTab("assessments")}>
                      Ver todas →
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {assessments && assessments.length > 0 ? (() => {
                    const latestByScale = new Map<string, typeof assessments[0]>();
                    const prevByScale = new Map<string, typeof assessments[0]>();
                    for (const a of [...assessments].sort((x, y) => y.date.localeCompare(x.date))) {
                      if (!latestByScale.has(a.scale)) latestByScale.set(a.scale, a);
                      else if (!prevByScale.has(a.scale)) prevByScale.set(a.scale, a);
                    }
                    const activeGroups = SCALE_GROUPS
                      .map((g) => ({ ...g, items: g.scales.map((s) => latestByScale.get(s)).filter(Boolean) as typeof assessments }))
                      .filter((g) => g.items.length > 0);
                    const groupColors: Record<string, string> = {
                      "AVD": "#16a34a", "Desempeño ocupacional": "#2563eb", "Fuerza": "#2563eb",
                      "Destreza": "#2563eb", "Sensibilidad": "#d97706", "Movilidad": "#16a34a", "Fatiga": "#d97706",
                    };
                    const isQualitative = (scale: string) => (QUALITATIVE_SCALES as readonly string[]).includes(scale);
                    function parsePrimaryScore(score: string): number | null {
                      const n = parseFloat(score.replace(",", ".").replace(/[^\d.-]/g, ""));
                      return isNaN(n) ? null : n;
                    }
                    return (
                      <div className="space-y-4">
                        {activeGroups.map((group) => (
                          <div key={group.label}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[11px] font-medium text-muted-foreground">{group.label}</span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                            <div className="space-y-1">
                              {group.items.map((a) => {
                                const dot = groupColors[group.label] ?? "#6b7280";
                                const qual = isQualitative(a.scale);
                                const prev = prevByScale.get(a.scale);
                                let trendEl: React.ReactNode = null;
                                if (!qual && prev) {
                                  const cur = parsePrimaryScore(a.score);
                                  const old = parsePrimaryScore(prev.score);
                                  const lowerBetter = ["TUG", "9HPT", "Minnesota"].includes(a.scale);
                                  if (cur !== null && old !== null && cur !== old) {
                                    const improved = lowerBetter ? cur < old : cur > old;
                                    trendEl = improved ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 shrink-0">
                                        <ArrowUp className="w-2.5 h-2.5" /> mejora
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 shrink-0">
                                        <ArrowDown className="w-2.5 h-2.5" /> empeora
                                      </span>
                                    );
                                  } else if (cur !== null && old !== null) {
                                    trendEl = (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                                        <Minus className="w-2.5 h-2.5" /> estable
                                      </span>
                                    );
                                  }
                                }
                                const subscales = (a.scale as string) === "MFIS" && a.itemScores
                                  ? computeScaleSubscales("MFIS", a.itemScores)
                                  : null;
                                return (
                                  <div key={a.id}>
                                    <div className="flex items-start gap-2 py-1">
                                      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: dot }} />
                                      <span className="text-sm font-medium w-28 shrink-0">{a.scale}</span>
                                      {qual ? (
                                        <span className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-2">{a.notes ?? a.score}</span>
                                      ) : (
                                        <span className="text-sm font-mono flex-1 leading-snug">{a.score}</span>
                                      )}
                                      <div className="flex flex-col items-end gap-1 shrink-0">
                                        {trendEl}
                                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatDate(a.date)}</span>
                                      </div>
                                    </div>
                                    {subscales && (
                                      <div className="flex gap-1.5 flex-wrap ml-4 mb-1">
                                        {subscales.map((s) => (
                                          <span key={s.title} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                            {s.title}: {s.total}/{s.maxScore}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })() : (
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
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs px-3"
              onClick={exportPatientVisits}
              disabled={!visits || visits.length === 0}
            >
              <FileDown className="w-3.5 h-3.5 mr-1" />Exportar PDF
            </Button>
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
                        {roleById.get(v.therapistId) ? ` · ${roleById.get(v.therapistId)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setOpenVisitId(v.id)}>
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
                        if (!goal) return null;
                        const gasScore = v.gasScores?.[gid];
                        return (
                          <Badge key={gid} variant="secondary" className="text-[11px] py-0 gap-1">
                            {goal.text}
                            {gasScore !== undefined && (
                              <span className="font-bold text-fuchsia-700">
                                GAS {gasScore > 0 ? `+${gasScore}` : gasScore}
                              </span>
                            )}
                          </Badge>
                        );
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

        {/* Interventions (private per professional) — hidden for admin */}
        {!isAdmin && <TabsContent value="interventions" className="mt-4">
          <InterventionsTab patientId={patient.id} patientName={patient.fullName} />
        </TabsContent>}

{/* Occupational profile — hidden for admin */}
{!isAdmin && isTO && <TabsContent value="occupational-profile" className="mt-4">
  <OccupationalProfileTab patientId={patient.id} />
</TabsContent>}

{!isAdmin && <TabsContent value="intervention-plan" className="mt-4">
  <InterventionPlanTab patientId={patient.id} />
</TabsContent>}

        {/* Assessments — hidden for admin */}
        {!isAdmin && <TabsContent value="assessments" className="mt-4">
          <Tabs defaultValue="scales" className="w-full">
            <TabsList className="inline-flex gap-1 bg-muted/60">
              <TabsTrigger value="scales" className={SUBTAB}>Escalas</TabsTrigger>
              <TabsTrigger value="evolution" className={SUBTAB}>Evolución</TabsTrigger>
            </TabsList>

            <TabsContent value="scales" className="mt-4 space-y-4">
              <AssessmentForm
                patientId={patient.id}
                therapistId={patient.therapistIds[0] ?? professionals?.[0]?.id ?? ""}
                resource={patient.resource}
              />
            </TabsContent>

            <TabsContent value="evolution" className="mt-4 space-y-4">
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
            </TabsContent>
          </Tabs>
        </TabsContent>}
      </Tabs>

      {openAssessmentId && (
        <AssessmentDetailDialog
          assessmentId={openAssessmentId}
          patientId={patient.id}
          onClose={() => setOpenAssessmentId(null)}
        />
      )}

      <NewVisitForm
        open={newVisitOpen || !!openVisitId}
        patientId={patient.id}
        patientName={patient.fullName}
        previousVisit={visits?.[0]}
        editVisit={openVisitId ? visits?.find((v) => v.id === openVisitId) : undefined}
        onClose={() => { setNewVisitOpen(false); setOpenVisitId(null); }}
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

function QuickNotes({ patientId }: { patientId: string }) {
  // Notas privadas del profesional de la sesión. Se cargan desde el servidor
  // (que ya filtra por profesional) y se crean/editan/borran contra los
  // endpoints /api/patients/[id]/quick-notes. Cada profesional solo ve las suyas.
  const [notes, setNotes] = useState<QuickNote[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/patients/${patientId}/quick-notes`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setNotes(Array.isArray(data) ? data : []); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [patientId]);

  async function addNote() {
    const colorIdx = notes.length % NOTE_COLORS.length;
    try {
      const r = await fetch(`/api/patients/${patientId}/quick-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "", colorIdx }),
      });
      if (r.ok) {
        const created = await r.json();
        setNotes((prev) => [...prev, created]);
      }
    } catch { /* silent */ }
  }
  function updateNote(id: string, text: string) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
  }
  async function saveNote(id: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    try {
      await fetch(`/api/patients/${patientId}/quick-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note.text, colorIdx: note.colorIdx }),
      });
    } catch { /* silent */ }
  }
  async function removeNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch(`/api/patients/${patientId}/quick-notes/${id}`, { method: "DELETE" });
    } catch { /* silent */ }
  }

  return (
    <div className="shrink-0 hidden lg:flex flex-col gap-1.5" style={{ width: notes.length > 3 ? "28rem" : "14rem", transition: "width 0.2s" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground flex items-center gap-1" title="Privadas: solo tú las ves">
          <StickyNote className="w-3 h-3" /> Notas rápidas
        </span>
        <button type="button" onClick={addNote} className="text-xs text-primary hover:underline">+ Añadir</button>
      </div>
      {notes.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">Sin notas.</p>
      )}
      <div
        className="overflow-y-auto"
        style={{
          display: "grid",
          gridTemplateColumns: notes.length > 3 ? "1fr 1fr" : "1fr",
          gap: "6px",
          maxHeight: "260px",
        }}
      >
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

function AssessmentForm({ patientId, therapistId, resource }: { patientId: string; therapistId: string; resource: string | null }) {
  const create = useCreateAssessment();
  const { data: me } = useMe();
  const allowedScales = scalesForRole(me?.role);
  const [itemScores, setItemScores] = useState<Record<string, number>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [copmData, setCopmData] = useState<any>(null);
  const [inventory, setInventory] = useState<AdlInventoryData>(() => buildEmptyAdlInventory());
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
  const isInventory = scale === ADL_INVENTORY_SCALE;
  const isEM = resource === EM_RESOURCE_KEY;

  // Escalas de la categoría activa que este profesional puede usar: se filtran
  // por su perfil (escalas por profesión) y por el recurso (EM_ONLY para EM).
  const activeCategoryScales = (
    ASSESSMENT_CATEGORIES.find((c) => c.key === activeCategory)?.scales ?? []
  ).filter(
    (s) => allowedScales.includes(s) && (isEM || !(EM_ONLY_SCALES as readonly string[]).includes(s)),
  );

  // Keep the (hidden, but still registered) `score` field in sync with the
  // computed total as items are answered.
  useEffect(() => {
    if (isCopm) {
      setValue("score", formatCopmScore(itemScores), { shouldValidate: false });
    } else if (isStructured) {
      setValue("score", formatScaleScore(scale, itemScores), { shouldValidate: false });
    } else if (isInventory) {
      setValue("score", summarizeAdlInventory(inventory), { shouldValidate: false });
    }
  }, [isStructured, isCopm, isInventory, scale, itemScores, inventory, setValue]);

  async function onSubmit(values: AssessmentCreateInput) {
    const payload = isStructured
      ? {
          ...values,
          itemScores,
          // For COPM, store the full problem data in areaSummary
          ...(isCopm && copmData ? { areaSummary: copmData } : {}),
        }
      : isInventory
        ? {
            ...values,
            inventoryData: JSON.stringify(inventory),
            score: summarizeAdlInventory(inventory),
          }
        : values;
    try {
      await create.mutateAsync(payload);
      toast({ title: "Evaluación registrada" });
      setItemScores({});
      setCopmData(null);
      setInventory(buildEmptyAdlInventory());
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
    setInventory(buildEmptyAdlInventory());
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
              {activeCategoryScales.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-1 py-1.5">Próximamente</p>
              ) : (
                activeCategoryScales.map((s) => (
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
          {(scale as string) === "" ? null : isStructured || isInventory ? (
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
          ) : isInventory ? (
            <AdlInventoryFields data={inventory} onChange={setInventory} />
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
                (isStructured && !isCopm && !isScaleComplete(scale, itemScores)) ||
                (isInventory &&
                  !Object.values(inventory.items).some((i) => i.autonomy) &&
                  !inventory.customRows.some((r) => r.autonomy))
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
