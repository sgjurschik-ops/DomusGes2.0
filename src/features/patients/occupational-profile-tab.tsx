"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { toast } from "@/hooks/use-toast";
import {
  Save,
  FileDown,
  ClipboardList,
  Users,
  Briefcase,
  CalendarClock,
  Heart,
  Target,
  Plus,
  Trash2,
  LayoutGrid,
  Mic,
  MicOff,
  type LucideIcon,
} from "lucide-react";
import {
  ROUTINE_CATEGORIES,
  ROUTINE_CATEGORY_COLORS,
  ROUTINE_CATEGORY_LABELS,
  BALANCE_GROUPS,
  BALANCE_GROUP_COLORS,
  BALANCE_GROUP_REFERENCE,
  OTPF_TO_GROUP,
  type RoutineCategory,
  type BalanceGroup,
  type RoutineCell,
  WeeklyRoutineEditor,
} from "./weekly-routine-editor";
import { useRoutineRecords } from "@/hooks/api";

type Profile = Record<string, any>;

// Each section declares which profile fields belong to it, so we can show a
// "filled / total" indicator on the collapsed header without guessing.
function countFilled(profile: Profile, fields: string[]) {
  const filled = fields.filter((f) => {
    const v = profile[f];
    if (v === undefined || v === null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.length > 0;
    return true; // booleans (e.g. currentlyDrives) count as filled once set
  }).length;
  return { filled, total: fields.length };
}

// Areas a goal can be linked to — mirrors the profile's own section titles,
// so "which area does this objective belong to" always matches a real
// section the person can see, rather than a free-floating list.
const GOAL_AREAS = [
  "Cuidado de sí mismo",
  "Productividad",
  "Ocio",
] as const;
type GoalArea = typeof GOAL_AREAS[number];
const GOAL_AREA_COLORS: Record<GoalArea, string> = {
  "Cuidado de sí mismo": "#14b8a6",
  "Productividad": "#f59e0b",
  "Ocio": "#8b5cf6",
};
const GOAL_STATUSES = ["En curso", "Conseguido", "Abandonado"] as const;
type GoalStatus = typeof GOAL_STATUSES[number];

interface Goal {
  id?: string;
  text: string;
  area: GoalArea;
  status: GoalStatus;
  startDate: string | null;
  targetDate: string | null;
  evaluation: string;
}

interface FamilyMember {
  name: string;
  relationship: string;
  occupation: string;
  notes: string;
}

interface WorkHistoryEntry {
  company: string;
  role: string;
  year: string;
  notes: string;
}

// Safely parses a JSON-encoded array field, falling back to [] for blank,
// null, or pre-existing free-text values that don't parse as JSON (older
// profiles saved before this structured format existed).
function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const emptyProfile: Profile = {
  documentsAttached: "",
  interventionReason: "",
  referralResource: "",
  drivingLicense: "",
  currentlyDrives: undefined,
  drivingReason: "",
  maritalStatus: "",
  partnerInfo: "",
  livingSituation: "",
  familyComposition: "",
  supportNetwork: "",
  bestRelationship: "",
  worstRelationship: "",
  educationLevel: "",
  otherEducation: "",
  workHistory: "",
  currentWorkSituation: "",
  currentOccupation: "",
  approximateIncome: "",
  moneyManager: "",
  incomeOrganization: "",
  weeklyRoutine: [] as RoutineCell[],
  dailyRoutine: "",
  activitiesPastSelfcare: "",
  activitiesPastProductivity: "",
  activitiesPastLeisure: "",
  activitiesDesiredSelfcare: "",
  activitiesDesiredProductivity: "",
  activitiesDesiredLeisure: "",
  desiredImprovements: "",
  problemsUser: "",
  problemsProfessional: "",
  goals: [],
};

export function OccupationalProfileTab({ patientId }: { patientId: string }) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [routineEditorOpen, setRoutineEditorOpen] = useState(false);

  const routineRecords = useRoutineRecords(patientId);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const res = await fetch(`/api/patients/${patientId}/occupational-profile`);
      const data = await res.json();
      setProfile({
        ...emptyProfile,
        ...(data ?? {}),
        familyComposition: parseJsonArray<FamilyMember>(data?.familyComposition),
        workHistory: parseJsonArray<WorkHistoryEntry>(data?.workHistory),
        weeklyRoutine: parseJsonArray<RoutineCell>(data?.weeklyRoutine),
        goals: Array.isArray(data?.goals)
          ? data.goals.map((g: any) => ({
              id: g.id,
              text: g.text,
              area: g.area,
              status: g.status,
              startDate: g.startDate ? g.startDate.slice(0, 10) : null,
              targetDate: g.targetDate ? g.targetDate.slice(0, 10) : null,
              evaluation: g.evaluation ?? "",
            }))
          : [],
      });
      setLoading(false);
    }

    loadProfile();
  }, [patientId]);

  function update(field: string, value: any) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  // The form keeps familyComposition/workHistory as in-memory arrays for
  // easy editing, but the database column is a JSON string — serialize
  // only at the save boundary, not throughout the component.
  function buildSavePayload() {
    return {
      ...profile,
      familyComposition: JSON.stringify(profile.familyComposition ?? []),
      workHistory: JSON.stringify(profile.workHistory ?? []),
      weeklyRoutine: JSON.stringify(profile.weeklyRoutine ?? []),
    };
  }

  async function save() {
    setSaving(true);

    try {
      const res = await fetch(`/api/patients/${patientId}/occupational-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload()),
      });

      if (!res.ok) throw new Error("SAVE_ERROR");

      const saved = await res.json();
      setProfile({
        ...emptyProfile,
        ...(saved ?? {}),
        familyComposition: parseJsonArray<FamilyMember>(saved?.familyComposition),
        workHistory: parseJsonArray<WorkHistoryEntry>(saved?.workHistory),
        weeklyRoutine: parseJsonArray<RoutineCell>(saved?.weeklyRoutine),
        goals: Array.isArray(saved?.goals)
          ? saved.goals.map((g: any) => ({
              id: g.id,
              text: g.text,
              area: g.area,
              status: g.status,
              targetDate: g.targetDate ? g.targetDate.slice(0, 10) : null,
            }))
          : [],
      });

      toast({
        title: "Perfil ocupacional guardado",
        description: "La información se ha actualizado correctamente.",
      });
    } catch {
      toast({
        title: "Error",
        description: "No se ha podido guardar el perfil ocupacional.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function generateReport() {
    setGeneratingReport(true);
    try {
      // Save first so the report always reflects what's currently on
      // screen, even if the person hasn't clicked "Guardar" yet.
      const saveRes = await fetch(`/api/patients/${patientId}/occupational-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload()),
      });
      if (!saveRes.ok) throw new Error("SAVE_ERROR");
      const saved = await saveRes.json();
      setProfile({
        ...emptyProfile,
        ...(saved ?? {}),
        familyComposition: parseJsonArray<FamilyMember>(saved?.familyComposition),
        workHistory: parseJsonArray<WorkHistoryEntry>(saved?.workHistory),
        weeklyRoutine: parseJsonArray<RoutineCell>(saved?.weeklyRoutine),
        goals: Array.isArray(saved?.goals)
          ? saved.goals.map((g: any) => ({
              id: g.id,
              text: g.text,
              area: g.area,
              status: g.status,
              targetDate: g.targetDate ? g.targetDate.slice(0, 10) : null,
            }))
          : [],
      });

      const res = await fetch(`/api/patients/${patientId}/occupational-profile/report`);
      if (!res.ok) throw new Error("REPORT_ERROR");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match?.[1] ?? "Perfil_ocupacional.pdf";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({
        title: "Informe generado",
        description: "El documento Word se ha descargado correctamente.",
      });
    } catch {
      toast({
        title: "Error",
        description: "No se ha podido generar el informe PDF.",
        variant: "destructive",
      });
    } finally {
      setGeneratingReport(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando perfil ocupacional…</p>;
  }

  return (
    <div className="space-y-4">
      <Section
        title="Datos generales"
        description="Información inicial de la valoración."
        icon={ClipboardList}
        defaultOpen
        profile={profile}
        fields={["documentsAttached", "referralResource", "interventionReason"]}
      >
        <Field label="Documentos que adjunta">
          <Textarea value={profile.documentsAttached ?? ""} onChange={(e) => update("documentsAttached", e.target.value)} className={!profile.documentsAttached ? "bg-muted/60" : ""} />
        </Field>
        <Field label="Recurso que deriva">
          <Input value={profile.referralResource ?? ""} onChange={(e) => update("referralResource", e.target.value)} className={!profile.referralResource ? "bg-muted/60" : ""} />
        </Field>
        <Field label="Motivo de intervención">
          <Textarea value={profile.interventionReason ?? ""} onChange={(e) => update("interventionReason", e.target.value)} className={!profile.interventionReason ? "bg-muted/60" : ""} />
        </Field>
      </Section>

      <Section
        title="Área social-familiar"
        description="Convivencia, red de apoyo y relaciones significativas."
        icon={Users}
        profile={profile}
        fields={[
          "drivingLicense",
          "currentlyDrives",
          "drivingReason",
          "maritalStatus",
          "partnerInfo",
          "livingSituation",
          "familyComposition",
          "supportNetwork",
          "bestRelationship",
          "worstRelationship",
        ]}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Carné de conducir">
            <Select value={profile.drivingLicense ?? ""} onValueChange={(v) => update("drivingLicense", v)}>
              <SelectTrigger className={!profile.drivingLicense ? "bg-muted/60" : ""}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sí">Sí</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="¿Conduce actualmente?">
            <Select
              value={profile.currentlyDrives === true ? "Sí" : profile.currentlyDrives === false ? "No" : ""}
              onValueChange={(v) => update("currentlyDrives", v === "Sí")}
            >
              <SelectTrigger className={profile.currentlyDrives === undefined ? "bg-muted/60" : ""}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sí">Sí</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Motivo si no conduce o información relevante">
          <Input value={profile.drivingReason ?? ""} onChange={(e) => update("drivingReason", e.target.value)} className={!profile.drivingReason ? "bg-muted/60" : ""} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Estado civil">
            <Input value={profile.maritalStatus ?? ""} onChange={(e) => update("maritalStatus", e.target.value)} className={!profile.maritalStatus ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Nombre y edad / información pareja">
            <Input value={profile.partnerInfo ?? ""} onChange={(e) => update("partnerInfo", e.target.value)} className={!profile.partnerInfo ? "bg-muted/60" : ""} />
          </Field>
        </div>

        <Field label="Convivencia actual">
          <Select value={profile.livingSituation ?? ""} onValueChange={(v) => update("livingSituation", v)}>
            <SelectTrigger className={!profile.livingSituation ? "bg-muted/60" : ""}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Casa propia">Casa propia</SelectItem>
              <SelectItem value="Casa familiar">Casa familiar</SelectItem>
              <SelectItem value="Casa de alquiler">Casa de alquiler</SelectItem>
              <SelectItem value="Residencia o piso tutelado">Residencia o piso tutelado</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <FamilyMembersEditor
          value={profile.familyComposition ?? []}
          onChange={(members) => update("familyComposition", members)}
        />

        <Field label="Red de apoyo / amistades">
          <Textarea
            rows={4}
            placeholder="Nombre, relación, frecuencia de contacto, vía de contacto..."
            value={profile.supportNetwork ?? ""}
            onChange={(e) => update("supportNetwork", e.target.value)}
            className={!profile.supportNetwork ? "bg-muted/60" : ""}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Con quién tiene mejor relación">
            <Input value={profile.bestRelationship ?? ""} onChange={(e) => update("bestRelationship", e.target.value)} className={!profile.bestRelationship ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Con quién tiene peor relación">
            <Input value={profile.worstRelationship ?? ""} onChange={(e) => update("worstRelationship", e.target.value)} className={!profile.worstRelationship ? "bg-muted/60" : ""} />
          </Field>
        </div>
      </Section>

      <Section
        title="Área laboral y económica"
        description="Formación, trayectoria laboral y autonomía económica."
        icon={Briefcase}
        profile={profile}
        fields={[
          "educationLevel",
          "otherEducation",
          "workHistory",
          "currentWorkSituation",
          "currentOccupation",
          "approximateIncome",
          "moneyManager",
          "incomeOrganization",
        ]}
      >
        <Field label="Estudios realizados">
          <Select value={profile.educationLevel ?? ""} onValueChange={(v) => update("educationLevel", v)}>
            <SelectTrigger className={!profile.educationLevel ? "bg-muted/60" : ""}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Sin escolarizar">Sin escolarizar</SelectItem>
              <SelectItem value="ESO">ESO</SelectItem>
              <SelectItem value="Bachillerato">Bachillerato</SelectItem>
              <SelectItem value="Formación Profesional">Formación Profesional</SelectItem>
              <SelectItem value="Carrera Universitaria">Carrera Universitaria</SelectItem>
              <SelectItem value="Especialización">Especialización</SelectItem>
              <SelectItem value="Otros">Otros</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Otros estudios, cursos o talleres">
          <Textarea value={profile.otherEducation ?? ""} onChange={(e) => update("otherEducation", e.target.value)} className={!profile.otherEducation ? "bg-muted/60" : ""} />
        </Field>

        <WorkHistoryEditor
          value={profile.workHistory ?? []}
          onChange={(entries) => update("workHistory", entries)}
        />

        <Field label="Situación laboral actual">
          <Input value={profile.currentWorkSituation ?? ""} onChange={(e) => update("currentWorkSituation", e.target.value)} className={!profile.currentWorkSituation ? "bg-muted/60" : ""} />
        </Field>

        <Field label="Trabajo u ocupación actual">
          <Textarea value={profile.currentOccupation ?? ""} onChange={(e) => update("currentOccupation", e.target.value)} className={!profile.currentOccupation ? "bg-muted/60" : ""} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Ingresos aproximados">
            <Input value={profile.approximateIncome ?? ""} onChange={(e) => update("approximateIncome", e.target.value)} className={!profile.approximateIncome ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Quién gestiona el dinero">
            <Input value={profile.moneyManager ?? ""} onChange={(e) => update("moneyManager", e.target.value)} className={!profile.moneyManager ? "bg-muted/60" : ""} />
          </Field>
        </div>

        <Field label="Organización de ingresos / autonomía económica">
          <Textarea value={profile.incomeOrganization ?? ""} onChange={(e) => update("incomeOrganization", e.target.value)} className={!profile.incomeOrganization ? "bg-muted/60" : ""} />
        </Field>
      </Section>

      <Section
        title="Hábitos y rutinas"
        description="Rutina diaria y planning semanal."
        icon={CalendarClock}
        profile={profile}
        fields={["dailyRoutine"]}
      >
        {/* Planning semanal — opens the full-screen editor */}
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Planning semanal de rutinas</p>
              <p className="text-xs text-muted-foreground">
                {(routineRecords.data?.length ?? 0) > 0
                  ? `${routineRecords.data!.length} registro${routineRecords.data!.length === 1 ? "" : "s"} guardado${routineRecords.data!.length === 1 ? "" : "s"}`
                  : "Sin registros guardados aún"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRoutineEditorOpen(true)}>
              <LayoutGrid className="w-4 h-4 mr-1.5" />
              Abrir planning
            </Button>
          </div>

          {/* Balance chart — shows aggregate of most recent record */}
          {(routineRecords.data?.length ?? 0) > 0 && (
            <RoutineBalanceFromRecords patientId={patientId} />
          )}
        </div>

        <Field label="Rutina de un día">
          <RichTextarea
            rows={6}
            placeholder="Describa la rutina habitual de un día típico del/la paciente..."
            value={profile.dailyRoutine ?? ""}
            onChange={(v) => update("dailyRoutine", v)}
          />
        </Field>
      </Section>

      {/* Full-screen weekly planning editor */}
      {routineEditorOpen && (
        <WeeklyRoutineEditor
          patientId={patientId}
          onClose={() => setRoutineEditorOpen(false)}
        />
      )}

      <Section
        title="Actividades realizadas y deseadas"
        description="Actividades que realizaba y las que le gustaría retomar o realizar actualmente."
        icon={Heart}
        profile={profile}
        fields={[
          "activitiesPastSelfcare",
          "activitiesPastProductivity",
          "activitiesPastLeisure",
          "activitiesDesiredSelfcare",
          "activitiesDesiredProductivity",
          "activitiesDesiredLeisure",
        ]}
      >
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold mb-2">Actividades que realizaba</p>
            <div className="space-y-3">
              <div className="rounded-lg border-l-4 border-l-teal-500 pl-3 space-y-1.5">
                <p className="text-xs font-medium text-teal-700">Cuidado de sí mismo</p>
                <p className="text-[11px] text-muted-foreground">Cuidado personal, movilidad, gestión comunitaria</p>
                <RichTextarea value={profile.activitiesPastSelfcare ?? ""} onChange={(v) => update("activitiesPastSelfcare", v)} rows={2} />
              </div>
              <div className="rounded-lg border-l-4 border-l-amber-500 pl-3 space-y-1.5">
                <p className="text-xs font-medium text-amber-700">Productividad</p>
                <p className="text-[11px] text-muted-foreground">Trabajo o voluntariado, manejo del hogar, estudios</p>
                <RichTextarea value={profile.activitiesPastProductivity ?? ""} onChange={(v) => update("activitiesPastProductivity", v)} rows={2} />
              </div>
              <div className="rounded-lg border-l-4 border-l-violet-500 pl-3 space-y-1.5">
                <p className="text-xs font-medium text-violet-700">Ocio</p>
                <p className="text-[11px] text-muted-foreground">Recreación tranquila, activa y socialización (adjuntar listado de intereses)</p>
                <RichTextarea value={profile.activitiesPastLeisure ?? ""} onChange={(v) => update("activitiesPastLeisure", v)} rows={2} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold mb-2">Actividades que le gustaría retomar o realizar</p>
            <div className="space-y-3">
              <div className="rounded-lg border-l-4 border-l-teal-500 pl-3 space-y-1.5">
                <p className="text-xs font-medium text-teal-700">Cuidado de sí mismo</p>
                <p className="text-[11px] text-muted-foreground">Cuidado personal, movilidad, gestión comunitaria</p>
                <RichTextarea value={profile.activitiesDesiredSelfcare ?? ""} onChange={(v) => update("activitiesDesiredSelfcare", v)} rows={2} />
              </div>
              <div className="rounded-lg border-l-4 border-l-amber-500 pl-3 space-y-1.5">
                <p className="text-xs font-medium text-amber-700">Productividad</p>
                <p className="text-[11px] text-muted-foreground">Trabajo o voluntariado, manejo del hogar, estudios</p>
                <RichTextarea value={profile.activitiesDesiredProductivity ?? ""} onChange={(v) => update("activitiesDesiredProductivity", v)} rows={2} />
              </div>
              <div className="rounded-lg border-l-4 border-l-violet-500 pl-3 space-y-1.5">
                <p className="text-xs font-medium text-violet-700">Ocio</p>
                <p className="text-[11px] text-muted-foreground">Recreación tranquila, activa y socialización (adjuntar listado de intereses)</p>
                <RichTextarea value={profile.activitiesDesiredLeisure ?? ""} onChange={(v) => update("activitiesDesiredLeisure", v)} rows={2} />
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Problemas detectados"
        description="Problemas identificados por el/la usuario/a y por el/la profesional."
        icon={ClipboardList}
        profile={profile}
        fields={["problemsUser", "problemsProfessional"]}
      >
        <Field label="Problemas detectados por el/la usuario/a">
          <RichTextarea rows={4} value={profile.problemsUser ?? ""} onChange={(v) => update("problemsUser", v)} placeholder="Problemas que el/la paciente identifica como principales..." />
        </Field>
        <Field label="Problemas detectados por el/la profesional">
          <RichTextarea rows={4} value={profile.problemsProfessional ?? ""} onChange={(v) => update("problemsProfessional", v)} placeholder="Problemas identificados por el/la terapeuta durante la evaluación..." />
        </Field>
      </Section>

      <Section
        title="Objetivos y planificación"
        description="Objetivos ocupacionales con seguimiento temporal."
        icon={Target}
        profile={profile}
        fields={["desiredImprovements"]}
      >
        <Field label="Qué le gustaría conseguir o mejorar">
          <RichTextarea rows={3} value={profile.desiredImprovements ?? ""} onChange={(v) => update("desiredImprovements", v)} />
        </Field>

        <GoalsEditor
          value={profile.goals ?? []}
          onChange={(goals) => update("goals", goals)}
        />
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={generateReport} disabled={generatingReport || saving}>
          <FileDown className="w-4 h-4 mr-1.5" />
          {generatingReport ? "Generando…" : "Generar informe PDF"}
        </Button>
        <Button onClick={save} disabled={saving || generatingReport}>
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? "Guardando…" : "Guardar perfil ocupacional"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  icon: Icon,
  defaultOpen = false,
  profile,
  fields,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  profile: Profile;
  fields: string[];
  children: React.ReactNode;
}) {
  const { filled, total } = countFilled(profile, fields);
  const isComplete = filled === total;
  const isEmpty = filled === 0;

  return (
    <details open={defaultOpen} className="group rounded-lg border bg-card shadow-sm overflow-hidden">
      <summary className="cursor-pointer list-none px-4 py-3 border-b bg-muted flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary shrink-0">
              <Icon className="w-4 h-4" />
            </span>
          )}
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={
              "text-xs rounded-full px-2 py-0.5 font-medium border " +
              (isComplete
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : isEmpty
                ? "bg-background text-muted-foreground border-border"
                : "bg-amber-100 text-amber-700 border-amber-200")
            }
            title={`${filled} de ${total} campos rellenados`}
          >
            {filled}/{total}
          </span>
          <span className="text-muted-foreground text-xs transition-transform group-open:rotate-90">▶</span>
        </div>
      </summary>
      <div className="p-4 space-y-4 bg-card">{children}</div>
    </details>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

// Repeatable list editor for family members — one row per person, with a
// free-text "Otros" column for whatever doesn't fit a dedicated field
// (support level, cohabitation, contact frequency, etc.) instead of
// modeling every possible attribute as its own column.
function FamilyMembersEditor({
  value,
  onChange,
}: {
  value: FamilyMember[];
  onChange: (members: FamilyMember[]) => void;
}) {
  function addRow() {
    onChange([...value, { name: "", relationship: "", occupation: "", notes: "" }]);
  }
  function updateRow(i: number, patch: Partial<FamilyMember>) {
    onChange(value.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function removeRow(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Composición familiar</Label>
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sin familiares añadidos.</p>
      )}
      <div className="space-y-2">
        {value.map((member, i) => (
          <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] gap-2 items-start">
            <Input placeholder="Nombre" value={member.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
            <Input placeholder="Relación (ej. Madre)" value={member.relationship} onChange={(e) => updateRow(i, { relationship: e.target.value })} />
            <Input placeholder="Ocupación" value={member.occupation} onChange={(e) => updateRow(i, { occupation: e.target.value })} />
            <Input placeholder="Otros (convivencia, apoyo, contacto...)" value={member.notes} onChange={(e) => updateRow(i, { notes: e.target.value })} />
            <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeRow(i)} aria-label="Quitar familiar">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir familiar
      </Button>
    </div>
  );
}

// Same repeatable-row pattern for work history.
function WorkHistoryEditor({
  value,
  onChange,
}: {
  value: WorkHistoryEntry[];
  onChange: (entries: WorkHistoryEntry[]) => void;
}) {
  function addRow() {
    onChange([...value, { company: "", role: "", year: "", notes: "" }]);
  }
  function updateRow(i: number, patch: Partial<WorkHistoryEntry>) {
    onChange(value.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
  }
  function removeRow(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Trabajos realizados</Label>
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sin trabajos añadidos.</p>
      )}
      <div className="space-y-2">
        {value.map((entry, i) => (
          <div key={i} className="grid grid-cols-[1.3fr_1.3fr_0.7fr_1.4fr_auto] gap-2 items-start">
            <Input placeholder="Empresa" value={entry.company} onChange={(e) => updateRow(i, { company: e.target.value })} />
            <Input placeholder="Funciones" value={entry.role} onChange={(e) => updateRow(i, { role: e.target.value })} />
            <Input placeholder="Año" value={entry.year} onChange={(e) => updateRow(i, { year: e.target.value })} />
            <Input placeholder="Otros" value={entry.notes} onChange={(e) => updateRow(i, { notes: e.target.value })} />
            <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeRow(i)} aria-label="Quitar trabajo">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir trabajo
      </Button>
    </div>
  );
}

// Goals editor: free text + status + optional target date + which profile
// area it relates to, replacing the old 3 fixed "Objetivo 1/2/3" boxes
// with an open-ended, trackable list.
const GOAL_STATUS_STYLES: Record<GoalStatus, string> = {
  "En curso": "bg-sky-100 text-sky-900 border-sky-200",
  "Conseguido": "bg-emerald-100 text-emerald-900 border-emerald-200",
  "Abandonado": "bg-zinc-100 text-zinc-700 border-zinc-200",
};

function GoalsEditor({
  value,
  onChange,
}: {
  value: Goal[];
  onChange: (goals: Goal[]) => void;
}) {
  function addRow() {
    onChange([...value, { text: "", area: "Cuidado de sí mismo", status: "En curso", startDate: new Date().toISOString().slice(0, 10), targetDate: null, evaluation: "" }]);
  }
  function updateRow(i: number, patch: Partial<Goal>) {
    onChange(value.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function removeRow(i: number) {
    const ok = confirm("¿Seguro que quieres eliminar este objetivo?");
    if (!ok) return;
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs">Objetivos</Label>
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sin objetivos añadidos.</p>
      )}
      <div className="space-y-3">
        {value.map((goal, i) => {
          const areaColor = GOAL_AREA_COLORS[goal.area] ?? "#6b7280";
          return (
            <div key={i} className="rounded-lg border overflow-hidden" style={{ borderLeftWidth: "4px", borderLeftColor: areaColor }}>
              <div className="p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Textarea
                      rows={2}
                      placeholder="Describe el objetivo…"
                      value={goal.text}
                      onChange={(e) => updateRow(i, { text: e.target.value })}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeRow(i)} aria-label="Quitar objetivo">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid sm:grid-cols-4 gap-2">
                  <Select value={goal.area} onValueChange={(v) => updateRow(i, { area: v as GoalArea })}>
                    <SelectTrigger className="h-8 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: areaColor }} />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_AREAS.map((a) => (
                        <SelectItem key={a} value={a}>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GOAL_AREA_COLORS[a] }} />
                            {a}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={goal.status} onValueChange={(v) => updateRow(i, { status: v as GoalStatus })}>
                    <SelectTrigger className={`h-8 text-xs ${GOAL_STATUS_STYLES[goal.status]}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GOAL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Inicio</p>
                    <Input type="date" className="h-8 text-xs" value={goal.startDate ?? ""} onChange={(e) => updateRow(i, { startDate: e.target.value || null })} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground">Fecha objetivo</p>
                    <Input type="date" className="h-8 text-xs" value={goal.targetDate ?? ""} onChange={(e) => updateRow(i, { targetDate: e.target.value || null })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Evaluación de la consecución</Label>
                  <Textarea
                    rows={2}
                    placeholder="Valoración del progreso hacia este objetivo..."
                    value={goal.evaluation ?? ""}
                    onChange={(e) => updateRow(i, { evaluation: e.target.value })}
                    className={!goal.evaluation ? "bg-muted/60" : ""}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir objetivo
      </Button>
    </div>
  );
}



// ─── Rich text area with bold/italic/underline + voice dictation ──────────────
// Uses contentEditable for inline formatting. Stores HTML.
// Voice dictation uses the Web Speech API (SpeechRecognition).
function RichTextarea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Sync external value on mount or when value changes and div is not focused
  useEffect(() => {
    if (ref.current && !focused) {
      if (ref.current.innerHTML !== value) {
        ref.current.innerHTML = value || "";
      }
    }
  }, [value, focused]);

  function handleFormat(cmd: "bold" | "italic" | "underline") {
    document.execCommand(cmd, false);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function toggleDictation() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Dictado no disponible", description: "Tu navegador no soporta reconocimiento de voz.", variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (event.results[event.results.length - 1].isFinal && ref.current) {
        // Append the final transcript to current content
        const current = ref.current.innerHTML;
        const separator = current && !current.endsWith(" ") && !current.endsWith("<br>") ? " " : "";
        ref.current.innerHTML = current + separator + transcript;
        onChange(ref.current.innerHTML);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    setIsListening(true);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  return (
    <div className={`rounded-md border ${focused ? "ring-2 ring-ring" : ""} ${!value ? "bg-muted/60" : ""}`}>
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30">
        <button type="button" className="px-1.5 py-0.5 rounded text-xs font-bold hover:bg-muted" onClick={() => handleFormat("bold")} title="Negrita"><b>N</b></button>
        <button type="button" className="px-1.5 py-0.5 rounded text-xs italic hover:bg-muted" onClick={() => handleFormat("italic")} title="Cursiva"><i>K</i></button>
        <button type="button" className="px-1.5 py-0.5 rounded text-xs underline hover:bg-muted" onClick={() => handleFormat("underline")} title="Subrayado"><u>S</u></button>
        <div className="flex-1" />
        <button
          type="button"
          className={`px-1.5 py-0.5 rounded text-xs hover:bg-muted flex items-center gap-1 ${isListening ? "text-red-500 bg-red-50" : "text-muted-foreground"}`}
          onClick={toggleDictation}
          title={isListening ? "Detener dictado" : "Dictar por voz"}
        >
          {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{isListening ? "Dictando…" : "Dictar"}</span>
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="px-3 py-2 text-sm outline-none min-h-[2.5rem] [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground"
        style={{ minHeight: `${rows * 1.5}rem` }}
        data-placeholder={placeholder ?? ""}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); if (ref.current) onChange(ref.current.innerHTML); }}
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
      />
    </div>
  );
}

// ─── Occupational balance charts ─────────────────────────────────────────────
// Two charts from the same cell data:
// 1. OTPF areas (9 categories) — detailed clinical breakdown.
// 2. Classic 3-group balance (Autocuidado/Productividad/Ocio) — uses the
//    per-cell "group" field, which is auto-set from OTPF area but
//    editable per cell.

function OccupationalBalanceCharts({ cells }: { cells: RoutineCell[] }) {
  const filled = cells.filter((c) => c.category);
  const totalSlots = filled.length;

  if (totalSlots === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Abre el planning y rellena celdas para ver el análisis de equilibrio ocupacional.
      </p>
    );
  }

  const totalHours = totalSlots * 0.5;

  // Chart 1: by OTPF area
  const otpfData = ROUTINE_CATEGORIES.map((cat) => {
    const slots = filled.filter((c) => c.category === cat).length;
    return {
      name: cat,
      label: ROUTINE_CATEGORY_LABELS[cat],
      hours: slots * 0.5,
      pct: ((slots / totalSlots) * 100).toFixed(1),
      fill: ROUTINE_CATEGORY_COLORS[cat],
    };
  }).filter((d) => d.hours > 0);

  // Chart 2: by balance group (uses cell.group, fallback to OTPF_TO_GROUP)
  const groupCounts: Record<BalanceGroup, number> = { Autocuidado: 0, Productividad: 0, Ocio: 0 };
  for (const c of filled) {
    const grp = (c.group as BalanceGroup) || (c.category ? OTPF_TO_GROUP[c.category] : null);
    if (grp && grp in groupCounts) groupCounts[grp as BalanceGroup] += 1;
  }
  const groupData = BALANCE_GROUPS.map((grp) => ({
    name: grp,
    hours: groupCounts[grp] * 0.5,
    pct: ((groupCounts[grp] / totalSlots) * 100).toFixed(1),
    fill: BALANCE_GROUP_COLORS[grp],
  })).filter((d) => d.hours > 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Por área OTPF</p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <PieChart width={150} height={150}>
            <Pie data={otpfData} cx={70} cy={70} innerRadius={38} outerRadius={62} dataKey="hours" strokeWidth={1.5}>
              {otpfData.map((e) => <Cell key={e.name} fill={e.fill} />)}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [`${(v as number).toFixed(1)} h`, otpfData.find((d) => d.name === n)?.label ?? n]} />
          </PieChart>
          <table className="text-xs w-full">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left pb-1 font-medium">Área</th>
                <th className="text-right pb-1 font-medium">h</th>
                <th className="text-right pb-1 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {otpfData.map((row) => (
                <tr key={row.name} className="border-b last:border-0">
                  <td className="py-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ backgroundColor: row.fill }} />
                    {row.label}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">{row.hours.toFixed(1)}</td>
                  <td className="py-0.5 text-right tabular-nums text-muted-foreground">{row.pct}%</td>
                </tr>
              ))}
              <tr className="font-medium border-t">
                <td className="pt-1">Total</td>
                <td className="pt-1 text-right tabular-nums">{totalHours.toFixed(1)}</td>
                <td className="pt-1 text-right text-muted-foreground">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Equilibrio ocupacional (3 grupos)</p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <PieChart width={150} height={150}>
            <Pie data={groupData} cx={70} cy={70} innerRadius={38} outerRadius={62} dataKey="hours" strokeWidth={1.5}>
              {groupData.map((e) => <Cell key={e.name} fill={e.fill} />)}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [`${(v as number).toFixed(1)} h`, n]} />
          </PieChart>
          <table className="text-xs w-full">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left pb-1 font-medium">Grupo</th>
                <th className="text-right pb-1 font-medium">h</th>
                <th className="text-right pb-1 font-medium">%</th>
                <th className="text-right pb-1 font-medium text-muted-foreground/60">Ref.</th>
              </tr>
            </thead>
            <tbody>
              {BALANCE_GROUPS.map((grp) => {
                const hours = groupCounts[grp] * 0.5;
                const pct = totalSlots > 0 ? ((groupCounts[grp] / totalSlots) * 100).toFixed(1) : "0.0";
                const ref = BALANCE_GROUP_REFERENCE[grp];
                const fill = BALANCE_GROUP_COLORS[grp];
                return (
                  <tr key={grp} className="border-b last:border-0">
                    <td className="py-0.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ backgroundColor: fill }} />
                      {grp}
                    </td>
                    <td className="py-0.5 text-right tabular-nums">{hours.toFixed(1)}</td>
                    <td className="py-0.5 text-right tabular-nums text-muted-foreground">{pct}%</td>
                    <td className="py-0.5 text-right tabular-nums text-muted-foreground/50">~{ref}%</td>
                  </tr>
                );
              })}
              <tr className="font-medium border-t">
                <td className="pt-1">Total</td>
                <td className="pt-1 text-right tabular-nums">{totalHours.toFixed(1)}</td>
                <td className="pt-1 text-right text-muted-foreground">100%</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5 italic">Ref. = porcentaje de referencia de equilibrio ocupacional (caso típico de adulto activo)</p>
      </div>
    </div>
  );
}

function RoutineBalanceFromRecords({ patientId }: { patientId: string }) {
  const records = useRoutineRecords(patientId);
  const latestId = records.data?.[0]?.id ?? null;
  const [cells, setCells] = useState<RoutineCell[]>([]);

  useEffect(() => {
    if (!latestId || !patientId) return;
    fetch(`/api/patients/${patientId}/routine-records/${latestId}`)
      .then((r) => r.json())
      .then((data) => {
        try { setCells(JSON.parse(data.cells)); } catch { setCells([]); }
      })
      .catch(() => setCells([]));
  }, [patientId, latestId]);

  if (!latestId) return null;
  const date = records.data?.[0]?.date;

  return (
    <div className="space-y-1.5">
      {date && <p className="text-xs text-muted-foreground">Registro más reciente: {date}</p>}
      <OccupationalBalanceCharts cells={cells} />
    </div>
  );
}
