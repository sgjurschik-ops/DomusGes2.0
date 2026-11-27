"use client";

import { usePatient, useVisits, useAssessments, useProfessionals, useCreateAssessment, useDeletePatient, useUpdatePatient, useMe, useOccupationalProfile, fetcher } from "@/hooks/api";
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
import { ArrowLeft, Phone, MapPin, Stethoscope, Target, User2, Calendar, ClipboardList, Plus, Trash2, Pencil, MoreVertical, ArrowUp, ArrowDown, Minus, AlertTriangle, FileDown, Activity, ListChecks, StickyNote, Home, Hand, Fingerprint, BatteryLow, Brain, ShieldCheck, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot,
} from "recharts";
import { toast } from "@/hooks/use-toast";
import { OccupationalProfileTab, getProfileCompletion } from "./occupational-profile-tab";
import { InterventionPlanTab } from "./intervention-plan-tab";
import { EvaluationTab } from "./evaluation-tab";
import { PiaiTab } from "./piai-tab";
import { PIAI_SECTIONS, type PiaiDTO } from "@/lib/piai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListPlus, EyeOff, Lock, ChevronDown, ChevronRight, ChevronUp, Flag, ClipboardPen } from "lucide-react";
import type { PatientEvaluationDTO } from "@/lib/evaluations";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

// Tarjetas del Resumen: compactas (sin el gran margen por defecto), con
// borde de color a la izquierda y misma altura dentro de cada fila.
const SUMMARY_CARD = "py-3 gap-2 h-full border-l-4 rounded-l-none";

// Punto de color del estado del/de la usuario/a en la cabecera.
const STATUS_DOT: Record<string, string> = {
  "Activo": "#16a34a",
  "En seguimiento": "#2563eb",
  "Pausado": "#d97706",
  "Alta": "#6b7280",
};

// Seguimientos que se muestran completos; los anteriores aparecen plegados.
const VISITS_OPEN_COUNT = 5;

// Separador visual entre grupos de pestañas (definido fuera del render para
// que React no lo recree en cada pintado).
function TabSep() {
  return <span aria-hidden className="h-5 w-px bg-border shrink-0 self-center mx-0.5" />;
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
  const isEM = !!patient && patient.resource === "Asociación EM";
  const deletePatient = useDeletePatient();
  const updatePatient = useUpdatePatient();
  const [openAssessmentId, setOpenAssessmentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  // Dentro de Seguimientos: los compartidos o mis intervenciones privadas.
  const [visitsView, setVisitsView] = useState<"shared" | "private">("shared");
  // Sub-pestaña dentro de "Valoración": valoración escrita | escalas | evolución.
  const [assessmentSubTab, setAssessmentSubTab] = useState("evaluation");
  const queryClient = useQueryClient();
  const [togglingProfile, setTogglingProfile] = useState(false);
  const [openVisitId, setOpenVisitId] = useState<string | null>(null);
  const [newVisitOpen, setNewVisitOpen] = useState(false);
  // Seguimientos: filtro por profesional y cuáles de los antiguos están desplegados.
  const [visitsTherapist, setVisitsTherapist] = useState<string>("all");
  const [expandedVisitIds, setExpandedVisitIds] = useState<Set<string>>(new Set());

  // Perfil ocupacional + objetivos: fuente COMPARTIDA (React Query). Cuando se
  // guarda en Perfil ocupacional o Plan de intervención, esto se actualiza solo.
  const { data: occProfile } = useOccupationalProfile(selectedPatientId);
  const problemsUser: string = occProfile?.problemsUser ?? "";
  const profileCompletion = useMemo(
    () => (occProfile ? getProfileCompletion(occProfile) : null),
    [occProfile],
  );
  // TODOS los objetivos (cualquier estado): los seguimientos antiguos pueden
  // referenciar objetivos ya conseguidos.
  const patientGoals = useMemo<{ id: string; text: string; status: string; specificGoals: unknown }[]>(
    () => (Array.isArray(occProfile?.goals) ? occProfile.goals : []),
    [occProfile],
  );

  // PIAI (solo Centro de día; misma caché que la pestaña PIAI) → el Resumen
  // muestra sus objetivos generales y los de cada profesional.
  const { data: piais } = useQuery<PiaiDTO[]>({
    queryKey: ["piai", selectedPatientId],
    queryFn: () => fetcher(`/api/patients/${selectedPatientId}/piai`),
    enabled: !!selectedPatientId && !isAdmin && isDayCenter,
  });

  // Valoraciones escritas (misma caché que la pestaña Valoración).
  const { data: evaluations } = useQuery<PatientEvaluationDTO[]>({
    queryKey: ["evaluations", selectedPatientId],
    queryFn: () => fetcher(`/api/patients/${selectedPatientId}/evaluations`),
    enabled: !!selectedPatientId && !isAdmin,
  });

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

  // Seguimientos: profesionales que han escrito alguno (para el filtro) y la
  // lista ya filtrada.
  const visitTherapists = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of visits ?? []) m.set(v.therapistId, v.therapistName);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [visits]);
  const filteredVisits = useMemo(
    () => (visits ?? []).filter((v) => visitsTherapist === "all" || v.therapistId === visitsTherapist),
    [visits, visitsTherapist],
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
  // Documentación en índigo APAGADO (antes índigo vivo, demasiado llamativo).
  const TAB_DOC = "text-[#56608a] hover:bg-[#56608a]/10 data-[state=active]:bg-[#56608a] data-[state=active]:text-white";
  // Medición en morado APAGADO (gris-violeta), menos llamativo que el violeta puro.
  const TAB_MEASURE = "text-[#6e6587] hover:bg-[#6e6587]/10 data-[state=active]:bg-[#6e6587] data-[state=active]:text-white";
  const SUBTAB = "px-4 text-[#6e6587] data-[state=active]:bg-[#6e6587] data-[state=active]:text-white data-[state=active]:shadow-sm";

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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [evolutionView, setEvolutionView] = useState<"chart" | "table">("table");

  // Perfil ocupacional OPCIONAL (solo Terapia ocupacional): la pestaña se ve
  // si se ha activado para este/a usuario/a o si ya tiene datos de antes
  // (así nunca se "esconde" información ya escrita).
  const profileHasData = (profileCompletion?.filled ?? 0) > 0;
  const showOccupationalProfile = isTO && (!!patient?.occupationalProfileEnabled || profileHasData);

  async function setOccupationalProfileEnabled(enabled: boolean) {
    if (!patient) return;
    setTogglingProfile(true);
    try {
      const r = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupationalProfileEnabled: enabled }),
      });
      if (!r.ok) throw new Error(String(r.status));
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
      if (enabled) {
        setActiveTab("occupational-profile");
        toast({ title: isDayCenter ? "Historia de Vida activada" : "Perfil ocupacional activado" });
      } else {
        if (activeTab === "occupational-profile") setActiveTab("assessments");
        toast({ title: isDayCenter ? "Historia de Vida ocultada" : "Perfil ocupacional ocultado" });
      }
    } catch {
      toast({ title: "Error", description: "No se ha podido cambiar la pestaña.", variant: "destructive" });
    } finally {
      setTogglingProfile(false);
    }
  }

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
    <div className="space-y-3">
      {/* "Volver" está en la barra superior de la app (ahorra una línea). */}

      {/* Cabecera COMPACTA y FIJA: igual en todas las pestañas (ya no se
          pliega/despliega). Identidad + datos clave en dos líneas, avisos
          agrupados en un solo botón, contacto en un desplegable, y las notas
          rápidas siempre visibles a la derecha. */}
      <Card className="py-0 gap-0">
        <CardContent className="px-3 py-2.5 sm:px-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:gap-0">
            <div className="flex-1 min-w-0 flex items-start gap-3">
              <Avatar name={patient.fullName} color={patient.color} size={40} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-x-2.5 gap-y-0.5 flex-wrap">
                      <h2 className="text-lg font-bold leading-tight">{patient.fullName}</h2>
                      <span className="text-sm text-muted-foreground">
                        {[patient.specialty, patient.resource, isEM ? patient.emCategory : null].filter(Boolean).join(" · ")}
                        {" · "}
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: STATUS_DOT[patient.status] ?? "#9ca3af" }} />
                          {patient.status}
                        </span>
                      </span>
                      {isEM && patient.informedConsent && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-700" title="Consentimiento informado firmado">
                          <ShieldCheck className="w-3.5 h-3.5" />Consentimiento
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(patient.alerts ?? []).length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100">
                            <AlertTriangle className="w-3 h-3" />
                            {patient.alerts.length} aviso{patient.alerts.length === 1 ? "" : "s"}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 p-2">
                          <ul className="space-y-1">
                            {patient.alerts.map((alert) => (
                              <li key={alert} className="flex items-start gap-1.5 text-xs">
                                <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />{alert}
                              </li>
                            ))}
                          </ul>
                          <button type="button" onClick={() => navigate("edit-patient")} className="mt-2 text-[11px] text-primary hover:underline">Editar avisos</button>
                        </PopoverContent>
                      </Popover>
                    )}
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setReportDialogOpen(true)}>
                      <FileDown className="w-3.5 h-3.5 mr-1" />Informe
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Más acciones"><MoreVertical className="w-3.5 h-3.5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate("edit-patient")}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                        {!isAdmin && isTO && !profileHasData && (
                          patient.occupationalProfileEnabled ? (
                            <DropdownMenuItem disabled={togglingProfile} onClick={() => setOccupationalProfileEnabled(false)}>
                              <EyeOff className="w-4 h-4 mr-2" />Ocultar {isDayCenter ? "Historia de Vida" : "Perfil ocupacional"}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled={togglingProfile} onClick={() => setOccupationalProfileEnabled(true)}>
                              <ListPlus className="w-4 h-4 mr-2" />Activar {isDayCenter ? "Historia de Vida" : "Perfil ocupacional"}
                            </DropdownMenuItem>
                          )
                        )}
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteDialogOpen(true)}><Trash2 className="w-4 h-4 mr-2" />Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Datos clave en UNA línea (se parte sola si no cabe):
                    diagnóstico resaltado, terapeutas, referentes, inicio, contacto. */}
                <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-[13px]">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-accent/50 px-2 py-0.5">
                    <Stethoscope className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Diagnóstico:</span>
                    <span className="font-medium">{patient.diagnosis || <span className="italic font-normal text-muted-foreground">sin indicar</span>}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <User2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Terapeutas:</span>
                    <span className="font-medium">{patient.therapistNames.length > 0 ? patient.therapistNames.join(", ") : "Sin asignar"}</span>
                  </span>
                  {isDayCenter && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-muted-foreground">Referente técnico/a:</span><span className="font-medium">{patient.referent || "—"}</span>
                      <span className="text-muted-foreground ml-1.5">Cuidados:</span><span className="font-medium">{patient.careTeamReferent || "—"}</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Desde:</span>
                    <span className="font-medium">{formatDate(patient.startDate)}</span>
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Phone className="w-3.5 h-3.5" />Contacto<ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 p-3 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted-foreground shrink-0" /><span className="text-muted-foreground">Teléfono:</span><span className="font-medium">{patient.phone ?? "—"}</span></div>
                      <div className="flex items-start gap-1.5"><MapPin className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" /><span className="text-muted-foreground">Dirección:</span><span className="font-medium">{patient.address ? shortenAddress(patient.address) : "—"}</span></div>
                      <div className="flex items-start gap-1.5"><User2 className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" /><span className="text-muted-foreground">Familiar:</span><span className="font-medium">{patient.referentName ? `${patient.referentName} · ${patient.referentPhone ?? ""}` : "—"}</span></div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {!isAdmin && <div className="w-px bg-border mx-4 self-stretch hidden lg:block" />}
            {!isAdmin && <div className="h-px bg-border lg:hidden" />}
            {!isAdmin && <QuickNotes patientId={patient.id} />}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="inline-flex w-full max-w-4xl items-center gap-1 overflow-x-auto bg-muted/60 py-1">
          <TabsTrigger value="overview" className={cn(TAB_BASE, TAB_ENTRY)}>Resumen</TabsTrigger>

          {!isAdmin && <TabSep />}
          {!isAdmin && <TabsTrigger value="visits" className={cn(TAB_BASE, TAB_DAILY)}>Seguimientos</TabsTrigger>}

          {!isAdmin && <TabSep />}
          {!isAdmin && <TabsTrigger value="assessments" className={cn(TAB_BASE, TAB_MEASURE)}>Valoración</TabsTrigger>}

          {!isAdmin && <TabSep />}
          {!isAdmin && showOccupationalProfile && <TabsTrigger value="occupational-profile" className={cn(TAB_BASE, TAB_DOC)}>{isDayCenter ? "Historia de Vida" : "Perfil ocupacional"}</TabsTrigger>}
          {!isAdmin && <TabsTrigger value="intervention-plan" className={cn(TAB_BASE, TAB_DOC)}>{isDayCenter ? "PIAI" : "Plan de intervención"}</TabsTrigger>}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-3 space-y-4">
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button type="button" onClick={() => setActiveTab("visits")} className="text-left">
                <KpiChip icon={Calendar} color="blue" label="Última visita"
                  value={visits && visits.length > 0 ? formatDate(visits[0].date) : "Sin visitas"} />
              </button>
              <button type="button" onClick={() => navigate("calendar")} className="text-left">
                <KpiChip icon={Calendar} color="orange" label="Próxima cita"
                  value={patient.nextAppointmentDate ? formatDateTime(patient.nextAppointmentDate) : "Sin cita"} />
              </button>
              <button type="button" onClick={() => setActiveTab("visits")} className="text-left">
                <KpiChip icon={ClipboardList} color="green" label="Seguimientos"
                  value={`${patient.totalVisits}`} />
              </button>
              <button type="button" onClick={() => { setActiveTab("assessments"); setAssessmentSubTab("scales"); }} className="text-left">
                <KpiChip icon={Activity} color="purple" label="Última evaluación"
                  value={assessments && assessments.length > 0 ? `${assessments[0].scale} · ${formatDate(assessments[0].date)}` : "Sin registrar"} />
              </button>
            </div>
          )}

          {isAdmin && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <p>Como administrador/a, no tienes acceso a la información clínica del paciente.</p>
              <p className="mt-1">Puedes gestionar citas desde la <button type="button" onClick={() => navigate("calendar")} className="text-primary hover:underline font-medium">Agenda</button>.</p>
            </Card>
          )}

          {/* Objetivos que se plantean con la persona + última valoración */}
          {!isAdmin && (
            <div className="grid lg:grid-cols-2 gap-4 items-stretch">
              <GoalsSummaryCard
                generalObjective={patient.objective}
                goals={patientGoals}
                piai={isDayCenter ? piais?.[0] ?? null : null}
                onOpenPlan={() => setActiveTab("intervention-plan")}
                planLabel={isDayCenter ? "PIAI" : "Plan de intervención"}
              />
              <EvaluationSummaryCard
                evaluations={evaluations ?? []}
                onOpen={() => { setActiveTab("assessments"); setAssessmentSubTab("evaluation"); }}
              />
              {/* Pending tasks */}
              <Card className={SUMMARY_CARD} style={{ borderLeftColor: "var(--chip-blue-text)" }}>
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
              <Card className={SUMMARY_CARD} style={{ borderLeftColor: "#6e6587" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    Últimas evaluaciones
                    <button type="button" className="text-xs font-normal text-primary hover:underline" onClick={() => { setActiveTab("assessments"); setAssessmentSubTab("evolution"); }}>
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
        {!isAdmin && <TabsContent value="visits" className="mt-3 space-y-3">
          {/* Selector: seguimientos compartidos / mis intervenciones privadas */}
          <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
            <button type="button" onClick={() => setVisitsView("shared")}
              className={cn("px-3 py-1.5 text-xs rounded-sm transition-colors", visitsView === "shared" ? "bg-background shadow-sm font-medium text-[#1a5c58]" : "text-muted-foreground hover:text-foreground")}>
              Seguimientos
            </button>
            <button type="button" onClick={() => setVisitsView("private")} title="Privadas: solo las ves tú"
              className={cn("px-3 py-1.5 text-xs rounded-sm transition-colors inline-flex items-center gap-1", visitsView === "private" ? "bg-background shadow-sm font-medium text-[#1a5c58]" : "text-muted-foreground hover:text-foreground")}>
              Intervenciones <Lock className="w-3 h-3" />
            </button>
          </div>
          {visitsView === "private" ? (
            <InterventionsTab patientId={patient.id} patientName={patient.fullName} />
          ) : (<>
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {visitTherapists.length > 1 && (
              <Select value={visitsTherapist} onValueChange={setVisitsTherapist}>
                <SelectTrigger className="h-8 w-52 text-xs mr-auto" aria-label="Filtrar por profesional">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los profesionales</SelectItem>
                  {visitTherapists.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
          ) : filteredVisits.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">No hay seguimientos de este/a profesional.</Card>
          ) : (
            filteredVisits.map((v, idx) => {
              // Los 5 más recientes se ven completos; los anteriores, plegados
              // en una línea (clic para desplegar), para no hacer scroll eterno.
              const isOld = idx >= VISITS_OPEN_COUNT;
              const expanded = !isOld || expandedVisitIds.has(v.id);
              if (!expanded) {
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setExpandedVisitIds((prev) => new Set(prev).add(v.id))}
                    className="w-full flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-left hover:bg-muted/40 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{v.title ?? "Seguimiento"}</span>
                    <span className="text-xs text-muted-foreground truncate">· {formatDate(v.date)} · {v.therapistName}</span>
                  </button>
                );
              }
              return (
              <Card key={v.id} className="overflow-hidden py-0 gap-0" style={{ borderLeftWidth: "4px", borderLeftColor: idx === 0 ? "var(--chip-blue-text)" : "var(--border)" }}>
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
                      {isOld && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => setExpandedVisitIds((prev) => { const next = new Set(prev); next.delete(v.id); return next; })}>
                          <ChevronDown className="w-3 h-3 mr-1" /> Plegar
                        </Button>
                      )}
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
              );
            })
          )}
          </>)}
        </TabsContent>}


{/* Occupational profile — hidden for admin */}
{!isAdmin && showOccupationalProfile && <TabsContent value="occupational-profile" className="mt-3">
  <OccupationalProfileTab patientId={patient.id} />
</TabsContent>}

{!isAdmin && <TabsContent value="intervention-plan" className="mt-3">
  {/* Centro de día: el PIAI de equipo (los objetivos de TO del plan van
      dentro, en su apartado). Resto: el Plan de intervención de siempre. */}
  {isDayCenter ? <PiaiTab patientId={patient.id} referent={patient.referent} careTeamReferent={patient.careTeamReferent} /> : <InterventionPlanTab patientId={patient.id} />}
</TabsContent>}

        {/* Assessments — hidden for admin */}
        {!isAdmin && <TabsContent value="assessments" className="mt-3">
          <Tabs value={assessmentSubTab} onValueChange={setAssessmentSubTab} className="w-full">
            <TabsList className="inline-flex gap-1 bg-muted/60">
              <TabsTrigger value="evaluation" className={SUBTAB}>Valoración</TabsTrigger>
              <TabsTrigger value="scales" className={SUBTAB}>Escalas</TabsTrigger>
              <TabsTrigger value="evolution" className={SUBTAB}>Evolución</TabsTrigger>
            </TabsList>

            <TabsContent value="evaluation" className="mt-4">
              <EvaluationTab
                patientId={patient.id}
                assessments={assessments}
                allowedScales={allowedScales}
                onGoToScales={() => setAssessmentSubTab("scales")}
                onOpenAssessment={setOpenAssessmentId}
              />
            </TabsContent>

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
              {me && allowedScales.length === 0
                ? "Aún no se han incorporado las escalas propias de esta especialidad."
                : "Sin evaluaciones registradas todavía."}
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

function htmlToText(html: string | null | undefined): string {
  return (html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

type SummaryGoal = { id: string; text: string; status: string; specificGoals: unknown; targetDate?: string | null };

function parseSpecificGoals(raw: unknown): { status: string }[] {
  if (Array.isArray(raw)) return raw as { status: string }[];
  if (typeof raw === "string" && raw) {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

// Resumen → objetivos planteados con la persona (los "En curso" del Plan de
// intervención) más el objetivo general de su ficha, si lo tiene.
function GoalsSummaryCard({
  generalObjective,
  goals,
  piai,
  onOpenPlan,
  planLabel,
}: {
  generalObjective: string | null;
  goals: SummaryGoal[];
  // Centro de día: objetivos del PIAI más reciente (generales + por profesional).
  piai?: PiaiDTO | null;
  onOpenPlan: () => void;
  planLabel: string;
}) {
  const active = goals.filter((g) => g.status === "En curso");
  if (piai) {
    const general = piai.generalObjectives.filter((o) => o.text.trim());
    const byProfession = PIAI_SECTIONS.map((def) => ({
      title: def.title,
      items: def.objectivesFromPlan
        ? active.map((g) => g.text).filter(Boolean)
        : (piai.sections[def.key]?.content.objectives ?? []).filter((o) => o.trim()),
    })).filter((x) => x.items.length > 0);
    return (
      <Card className={SUMMARY_CARD} style={{ borderLeftColor: "#1a5c58" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Flag className="w-4 h-4 text-[#1a5c58]" />Objetivos</span>
            <button type="button" className="text-xs font-normal text-primary hover:underline" onClick={onOpenPlan}>
              PIAI · {formatDate(piai.date)} →
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Generales</p>
            {general.length === 0 ? <p className="text-sm text-muted-foreground">Sin objetivos generales.</p> : (
              <ol className="space-y-1">
                {general.map((o, i) => (
                  <li key={o.id} className="flex items-start gap-2 text-sm">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 bg-[#1a5c58]/10 text-[#1a5c58]">{i + 1}</span>
                    <span className="leading-snug">{o.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {byProfession.map((p) => (
            <div key={p.title}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{p.title}</p>
              <ul className="space-y-0.5">
                {p.items.map((t, i) => <li key={i} className="text-sm leading-snug">· {t}</li>)}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }
  const achieved = goals.filter((g) => g.status === "Conseguido").length;
  return (
    <Card className={SUMMARY_CARD} style={{ borderLeftColor: "#1a5c58" }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Flag className="w-4 h-4 text-[#1a5c58]" />Objetivos</span>
          <button type="button" className="text-xs font-normal text-primary hover:underline" onClick={onOpenPlan}>
            {planLabel} →
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {generalObjective && (
          <p className="text-xs rounded-md bg-accent/40 px-2.5 py-1.5">
            <span className="text-muted-foreground">Objetivo general: </span>
            <span className="font-medium">{generalObjective}</span>
          </p>
        )}
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin objetivos en curso.</p>
        ) : (
          <ol className="space-y-1.5">
            {active.map((g, i) => {
              const metas = parseSpecificGoals(g.specificGoals);
              const done = metas.filter((m) => m.status === "Conseguido").length;
              return (
                <li key={g.id} className="flex items-start gap-2 text-sm">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 mt-0.5 bg-[#1a5c58]/10 text-[#1a5c58]">{i + 1}</span>
                  <span className="flex-1 leading-snug">{g.text || <span className="italic text-muted-foreground">Sin título</span>}</span>
                  {metas.length > 0 && (
                    <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5" title="Metas funcionales conseguidas">
                      {done}/{metas.length} metas
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {achieved > 0 && (
          <p className="text-[11px] text-emerald-700">✓ {achieved} objetivo{achieved === 1 ? "" : "s"} conseguido{achieved === 1 ? "" : "s"}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Resumen → la valoración escrita más reciente (fecha, autor/a y un extracto
// de los datos generales: entorno, dificultades actuales…).
function EvaluationSummaryCard({
  evaluations,
  onOpen,
}: {
  evaluations: PatientEvaluationDTO[];
  onOpen: () => void;
}) {
  const latest = evaluations[0];
  const excerpt = latest ? htmlToText(latest.generalData) : "";
  return (
    <Card className={SUMMARY_CARD} style={{ borderLeftColor: "#6e6587" }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><ClipboardPen className="w-4 h-4 text-[#6e6587]" />Valoración</span>
          <button type="button" className="text-xs font-normal text-primary hover:underline" onClick={onOpen}>
            {latest ? "Abrir →" : "Crear valoración →"}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {!latest ? (
          <p className="text-sm text-muted-foreground">Todavía no hay valoración.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{latest.profession}</span>
              {" · "}{formatDate(latest.date)} · {latest.authorName}
              {evaluations.length > 1 && <> · {evaluations.length} valoraciones en total</>}
            </p>
            {excerpt ? (
              <p className="text-sm leading-snug line-clamp-4">{excerpt}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Datos generales sin completar.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
  // Se muestran en todas las pantallas (antes solo en las muy anchas) y avisan
  // si no se han podido guardar, para no perder nada sin darse cuenta.
  const [notes, setNotes] = useState<QuickNote[]>([]);
  const [saveState, setSaveState] = useState<Record<string, "saving" | "saved" | "error">>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/patients/${patientId}/quick-notes`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setNotes(Array.isArray(data) ? data : []); })
      .catch(() => { /* sin notas: se muestra vacío */ });
    return () => { cancelled = true; };
  }, [patientId]);

  function notifyError(action: string) {
    toast({ title: "Nota rápida no guardada", description: `No se ha podido ${action}. Revisa la conexión e inténtalo de nuevo.`, variant: "destructive" });
  }

  async function addNote() {
    const colorIdx = notes.length % NOTE_COLORS.length;
    try {
      const r = await fetch(`/api/patients/${patientId}/quick-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "", colorIdx }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const created = await r.json();
      setNotes((prev) => [...prev, created]);
    } catch {
      notifyError("crear la nota");
    }
  }
  function updateNote(id: string, text: string) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
  }
  async function saveNote(id: string) {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    setSaveState((p) => ({ ...p, [id]: "saving" }));
    try {
      const r = await fetch(`/api/patients/${patientId}/quick-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note.text, colorIdx: note.colorIdx }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setSaveState((p) => ({ ...p, [id]: "saved" }));
    } catch {
      setSaveState((p) => ({ ...p, [id]: "error" }));
      notifyError("guardar la nota");
    }
  }
  async function removeNote(id: string) {
    const previous = notes;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      const r = await fetch(`/api/patients/${patientId}/quick-notes/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      setNotes(previous);
      notifyError("borrar la nota");
    }
  }

  const wide = notes.length > 3;
  return (
    <div className={cn("shrink-0 flex flex-col gap-1.5 w-full transition-[width]", wide ? "lg:w-[28rem]" : "lg:w-56")}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground flex items-center gap-1" title="Privadas: solo tú las ves">
          <StickyNote className="w-3 h-3" /> Notas rápidas <Lock className="w-2.5 h-2.5" />
        </span>
        <button type="button" onClick={addNote} className="text-xs text-primary hover:underline">+ Añadir</button>
      </div>
      {notes.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">Sin notas.</p>
      )}
      <div
        className={cn("overflow-y-auto grid gap-1.5 grid-cols-1 sm:grid-cols-2", wide ? "lg:grid-cols-2" : "lg:grid-cols-1")}
        style={{ maxHeight: "116px" }}
      >
        {notes.map((note) => {
          const c = NOTE_COLORS[note.colorIdx % NOTE_COLORS.length];
          const st = saveState[note.id];
          return (
            <div key={note.id} className="rounded-md p-2 relative group" style={{ backgroundColor: c.bg, borderLeft: `3px solid ${c.border}` }}>
              <textarea
                value={note.text}
                onChange={(e) => {
                  updateNote(note.id, e.target.value);
                  setSaveState((p) => { const next = { ...p }; delete next[note.id]; return next; });
                }}
                onBlur={() => saveNote(note.id)}
                placeholder="Escribe una nota…"
                className="w-full bg-transparent text-xs resize-none outline-none min-h-[2rem] leading-relaxed"
                rows={2}
              />
              {st && (
                <span className={cn("absolute bottom-1 right-1.5 text-[9px]", st === "error" ? "text-destructive font-semibold" : "text-muted-foreground")}>
                  {st === "saving" ? "Guardando…" : st === "saved" ? "✓ Guardada" : "No guardada"}
                </span>
              )}
              <button type="button" onClick={() => removeNote(note.id)} aria-label="Borrar nota"
                className="absolute top-1 right-1 opacity-60 lg:opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
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

  // Perfiles distintos de Terapia ocupacional todavía no tienen sus propias
  // escalas cargadas en la app. En vez de mostrar el selector de categorías
  // vacío (con "Próximamente" repetido en cada una), se explica una sola vez.
  if (me && allowedScales.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Aún no se han incorporado las escalas propias de esta especialidad.
      </Card>
    );
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
