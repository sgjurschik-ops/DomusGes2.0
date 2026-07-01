"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  type LucideIcon,
} from "lucide-react";

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
  "Datos generales",
  "Social-familiar",
  "Laboral y económica",
  "Hábitos y rutinas",
  "Intereses y motivaciones",
] as const;
type GoalArea = typeof GOAL_AREAS[number];
const GOAL_STATUSES = ["En curso", "Conseguido", "Abandonado"] as const;
type GoalStatus = typeof GOAL_STATUSES[number];

interface Goal {
  id?: string;
  text: string;
  area: GoalArea;
  status: GoalStatus;
  targetDate: string | null; // yyyy-mm-dd or null
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

// Weekly occupational-balance grid (168 cells: 7 days × 24 hours, starting
// at 07:00 like a standard weekly routine sheet). Each cell records a
// short free-text activity plus a category that colors the cell and
// drives the autocuidado/productivo/ocio balance report.
const ROUTINE_CATEGORIES = ["Autocuidado", "Productivo", "Ocio"] as const;
type RoutineCategory = typeof ROUTINE_CATEGORIES[number];
const ROUTINE_CATEGORY_COLORS: Record<RoutineCategory, string> = {
  Autocuidado: "#fde2c8",
  Productivo: "#bcdcf7",
  Ocio: "#c9eccb",
};
const ROUTINE_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
// Hours displayed top-to-bottom, starting at 07:00 and wrapping to 06:00
// the next day — matches how people naturally describe "my day" (wake up
// to going back to sleep) rather than a literal midnight-to-midnight grid.
const ROUTINE_HOURS = Array.from({ length: 24 }, (_, i) => (7 + i) % 24);

interface RoutineCell {
  day: number; // 0=Lunes..6=Domingo
  hour: number; // 0-23
  activity: string;
  category: RoutineCategory | "";
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
  selfCare: "",
  domesticTasks: "",
  responsibilities: "",
  leisure: "",
  physicalActivity: "",
  socialParticipation: "",
  leisureActivitiesCurrent: "",
  leisureActivitiesPast: "",
  sportsCurrent: "",
  sportsPast: "",
  trainingCurrent: "",
  trainingPast: "",
  desiredImprovements: "",
  goals: [],
};

export function OccupationalProfileTab({ patientId }: { patientId: string }) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

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
              targetDate: g.targetDate ? g.targetDate.slice(0, 10) : null,
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
      const fileName = match?.[1] ?? "Perfil_ocupacional.docx";

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
        description: "No se ha podido generar el informe Word.",
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
        description="Rutina diaria y participación ocupacional."
        icon={CalendarClock}
        profile={profile}
        fields={[
          "weeklyRoutine",
          "selfCare",
          "leisure",
          "domesticTasks",
          "physicalActivity",
          "responsibilities",
          "socialParticipation",
        ]}
      >
        <WeeklyRoutineEditor
          value={profile.weeklyRoutine ?? []}
          onChange={(cells) => update("weeklyRoutine", cells)}
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Autocuidado">
            <Textarea value={profile.selfCare ?? ""} onChange={(e) => update("selfCare", e.target.value)} className={!profile.selfCare ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Ocio">
            <Textarea value={profile.leisure ?? ""} onChange={(e) => update("leisure", e.target.value)} className={!profile.leisure ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Tareas domésticas">
            <Textarea value={profile.domesticTasks ?? ""} onChange={(e) => update("domesticTasks", e.target.value)} className={!profile.domesticTasks ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Actividad física">
            <Textarea value={profile.physicalActivity ?? ""} onChange={(e) => update("physicalActivity", e.target.value)} className={!profile.physicalActivity ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Responsabilidades">
            <Textarea value={profile.responsibilities ?? ""} onChange={(e) => update("responsibilities", e.target.value)} className={!profile.responsibilities ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Participación social">
            <Textarea value={profile.socialParticipation ?? ""} onChange={(e) => update("socialParticipation", e.target.value)} className={!profile.socialParticipation ? "bg-muted/60" : ""} />
          </Field>
        </div>
      </Section>

      <Section
        title="Intereses y motivaciones"
        description="Actividades actuales, abandonadas y posibles intereses a recuperar."
        icon={Heart}
        profile={profile}
        fields={[
          "leisureActivitiesCurrent",
          "leisureActivitiesPast",
          "sportsCurrent",
          "sportsPast",
          "trainingCurrent",
          "trainingPast",
        ]}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Actividades de ocio que realiza actualmente">
            <Textarea value={profile.leisureActivitiesCurrent ?? ""} onChange={(e) => update("leisureActivitiesCurrent", e.target.value)} className={!profile.leisureActivitiesCurrent ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Actividades de ocio que ya no realiza">
            <Textarea value={profile.leisureActivitiesPast ?? ""} onChange={(e) => update("leisureActivitiesPast", e.target.value)} className={!profile.leisureActivitiesPast ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Deportes actuales">
            <Textarea value={profile.sportsCurrent ?? ""} onChange={(e) => update("sportsCurrent", e.target.value)} className={!profile.sportsCurrent ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Deportes que ya no realiza">
            <Textarea value={profile.sportsPast ?? ""} onChange={(e) => update("sportsPast", e.target.value)} className={!profile.sportsPast ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Cursos o formación actual">
            <Textarea value={profile.trainingCurrent ?? ""} onChange={(e) => update("trainingCurrent", e.target.value)} className={!profile.trainingCurrent ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Cursos o formación que ya no realiza">
            <Textarea value={profile.trainingPast ?? ""} onChange={(e) => update("trainingPast", e.target.value)} className={!profile.trainingPast ? "bg-muted/60" : ""} />
          </Field>
        </div>
      </Section>

      <Section
        title="Objetivos y planificación"
        description="Objetivos ocupacionales y planificación inicial."
        icon={Target}
        profile={profile}
        fields={["desiredImprovements"]}
      >
        <Field label="Qué le gustaría conseguir o mejorar">
          <Textarea rows={3} value={profile.desiredImprovements ?? ""} onChange={(e) => update("desiredImprovements", e.target.value)} className={!profile.desiredImprovements ? "bg-muted/60" : ""} />
        </Field>

        <GoalsEditor
          value={profile.goals ?? []}
          onChange={(goals) => update("goals", goals)}
        />
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={generateReport} disabled={generatingReport || saving}>
          <FileDown className="w-4 h-4 mr-1.5" />
          {generatingReport ? "Generando…" : "Generar informe Word"}
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
    onChange([...value, { text: "", area: "Datos generales", status: "En curso", targetDate: null }]);
  }
  function updateRow(i: number, patch: Partial<Goal>) {
    onChange(value.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function removeRow(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Objetivos</Label>
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sin objetivos añadidos.</p>
      )}
      <div className="space-y-2">
        {value.map((goal, i) => (
          <div key={i} className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Textarea
                rows={2}
                placeholder="Describe el objetivo…"
                value={goal.text}
                onChange={(e) => updateRow(i, { text: e.target.value })}
                className="flex-1"
              />
              <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeRow(i)} aria-label="Quitar objetivo">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <Select value={goal.area} onValueChange={(v) => updateRow(i, { area: v as GoalArea })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
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
              <Input
                type="date"
                className="h-8 text-xs"
                value={goal.targetDate ?? ""}
                onChange={(e) => updateRow(i, { targetDate: e.target.value || null })}
              />
            </div>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir objetivo
      </Button>
    </div>
  );
}

// Weekly occupational-balance grid: 7 days × 24 hours (168 cells). Each
// cell is a small colored square; clicking it opens a popover to set the
// activity text and category, rather than showing an inline input+select
// in every cell, which would be unusable at this density. Two shortcuts
// make filling 168 cells practical: copying an entire day-column to the
// weekday columns, and copying a single cell to other days at the same
// hour.
// ─── Occupational balance chart ──────────────────────────────────────────────
// Calculates hours and % per category from the weekly routine grid and
// renders a donut chart + summary table, matching the clinical "equilibrio
// ocupacional" analysis tool the therapist uses.

const BALANCE_COLORS: Record<RoutineCategory, string> = {
  Autocuidado: "#f6a96a",
  Productivo: "#5a9fd4",
  Ocio: "#6dbb74",
};

function OccupationalBalanceChart({ cells }: { cells: RoutineCell[] }) {
  const filled = cells.filter((c) => c.category);
  const totalHours = filled.length;

  const counts = ROUTINE_CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = filled.filter((c) => c.category === cat).length;
    return acc;
  }, {});

  if (totalHours === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Rellena celdas de la rejilla para ver el análisis de equilibrio ocupacional.
      </p>
    );
  }

  const data = ROUTINE_CATEGORIES.map((cat) => ({
    name: cat,
    hours: counts[cat],
    pct: totalHours > 0 ? ((counts[cat] / totalHours) * 100).toFixed(1) : "0.0",
    fill: BALANCE_COLORS[cat],
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <PieChart width={180} height={180}>
          <Pie
            data={data}
            cx={85}
            cy={85}
            innerRadius={50}
            outerRadius={80}
            dataKey="hours"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value} h (${data.find((d) => d.name === name)?.pct}%)`,
              name,
            ]}
          />
        </PieChart>

        <table className="text-sm w-full max-w-xs">
          <thead>
            <tr className="text-xs text-muted-foreground border-b">
              <th className="text-left pb-1.5 font-medium">Categoría</th>
              <th className="text-right pb-1.5 font-medium">Horas</th>
              <th className="text-right pb-1.5 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name} className="border-b last:border-0">
                <td className="py-1.5 flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm inline-block shrink-0"
                    style={{ backgroundColor: row.fill }}
                  />
                  {row.name}
                </td>
                <td className="py-1.5 text-right tabular-nums">{row.hours}</td>
                <td className="py-1.5 text-right tabular-nums text-muted-foreground">{row.pct}%</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="pt-2">Total registrado</td>
              <td className="pt-2 text-right tabular-nums">{totalHours}</td>
              <td className="pt-2 text-right tabular-nums text-muted-foreground">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WeeklyRoutineEditor({
  value,
  onChange,
}: {
  value: RoutineCell[];
  onChange: (cells: RoutineCell[]) => void;
}) {
  const [openCell, setOpenCell] = useState<{ day: number; hour: number } | null>(null);
  const [copySourceDay, setCopySourceDay] = useState<number | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<Set<number>>(new Set());

  // Click-and-drag range selection: mousedown on a cell starts a drag,
  // mouseenter on cells in the *same column* while dragging extends the
  // selection, mouseup opens a single popover to fill the whole range at
  // once. A plain click without dragging still edits just one cell,
  // handled by the existing per-cell Popover further down.
  const [dragDay, setDragDay] = useState<number | null>(null);
  const [dragStartHour, setDragStartHour] = useState<number | null>(null);
  const [dragEndHour, setDragEndHour] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rangeDraft, setRangeDraft] = useState<{ activity: string; category: RoutineCategory | "" }>({
    activity: "",
    category: "",
  });

  const selection = dragDay !== null && dragStartHour !== null && dragEndHour !== null
    ? { day: dragDay, from: Math.min(dragStartHour, dragEndHour), to: Math.max(dragStartHour, dragEndHour) }
    : null;
  // The fill panel only shows for a genuine multi-cell drag, once the
  // mouse button has been released — while still dragging, the cells
  // just highlight without opening anything yet.
  const rangeReady = !isDragging && selection !== null && selection.from !== selection.to;

  function cellAt(day: number, hour: number): RoutineCell | undefined {
    return value.find((c) => c.day === day && c.hour === hour);
  }

  function isCellSelected(day: number, hour: number): boolean {
    if (!selection) return false;
    return day === selection.day && hour >= selection.from && hour <= selection.to;
  }

  function startDrag(day: number, hour: number) {
    setOpenCell(null);
    setDragDay(day);
    setDragStartHour(hour);
    setDragEndHour(hour);
    setIsDragging(true);
  }

  function extendDrag(day: number, hour: number) {
    if (!isDragging || day !== dragDay) return;
    setDragEndHour(hour);
  }

  function endDrag() {
    if (!isDragging) return;
    setIsDragging(false);
    // A "drag" that never left its starting cell is just a click — clear
    // the range so the normal single-cell popover handles it instead.
    if (dragStartHour === dragEndHour) {
      setDragDay(null);
      setDragStartHour(null);
      setDragEndHour(null);
      return;
    }
    setRangeDraft({ activity: "", category: "" });
  }

  function clearSelection() {
    setDragDay(null);
    setDragStartHour(null);
    setDragEndHour(null);
  }

  function moveCell(fromDay: number, fromHour: number, toDay: number, toHour: number) {
    const source = cellAt(fromDay, fromHour);
    if (!source) return;
    const dest = cellAt(toDay, toHour);
    if (dest && (dest.activity || dest.category)) {
      const ok = confirm(
        `La celda de destino (${ROUTINE_DAYS[toDay]} ${String(toHour).padStart(2, "0")}:00) ya tiene "${dest.activity || dest.category}". ¿Sobrescribirla?`,
      );
      if (!ok) return;
    }
    const withoutBoth = value.filter(
      (c) => !(c.day === fromDay && c.hour === fromHour) && !(c.day === toDay && c.hour === toHour),
    );
    onChange([...withoutBoth, { ...source, day: toDay, hour: toHour }]);
  }

  function applyRange() {
    if (!selection) return;
    const text = rangeDraft.activity.trim();
    if (!text && !rangeDraft.category) {
      clearSelection();
      return;
    }
    const hours: number[] = [];
    for (let h = selection.from; h <= selection.to; h++) hours.push(h);
    const withoutRange = value.filter((c) => !(c.day === selection.day && hours.includes(c.hour)));
    const filled = hours.map((h) => ({
      day: selection.day,
      hour: h,
      activity: text,
      category: rangeDraft.category,
    }));
    onChange([...withoutRange, ...filled]);
    clearSelection();
  }

  useEffect(() => {
    if (!isDragging) return;
    function onUp() {
      endDrag();
    }
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [isDragging, dragStartHour, dragEndHour]);

  function setCell(day: number, hour: number, patch: Partial<RoutineCell>) {
    const existing = cellAt(day, hour);
    const next: RoutineCell = {
      day,
      hour,
      activity: existing?.activity ?? "",
      category: existing?.category ?? "",
      ...patch,
    };
    const withoutThis = value.filter((c) => !(c.day === day && c.hour === hour));
    // Drop fully-empty cells instead of storing them, so saved JSON stays
    // proportional to how much of the routine was actually described.
    if (!next.activity.trim() && !next.category) {
      onChange(withoutThis);
    } else {
      onChange([...withoutThis, next]);
    }
  }

  function copyColumnToWeekdays(sourceDay: number) {
    const sourceCells = value.filter((c) => c.day === sourceDay);
    const weekdays = [1, 2, 3, 4]; // Tue–Fri, relative to a Monday source
    const withoutWeekdays = value.filter((c) => !weekdays.includes(c.day));
    const copied = weekdays.flatMap((targetDay) =>
      sourceCells.map((c) => ({ ...c, day: targetDay })),
    );
    onChange([...withoutWeekdays, ...copied]);
    toast({ title: "Día copiado a martes–viernes" });
  }

  function copyCellToDays(sourceDay: number, hour: number, targetDays: number[]) {
    const source = cellAt(sourceDay, hour);
    if (!source) return;
    const withoutTargets = value.filter((c) => !(targetDays.includes(c.day) && c.hour === hour));
    const copied = targetDays.map((d) => ({ ...source, day: d }));
    onChange([...withoutTargets, ...copied]);
    setCopySourceDay(null);
    setCopyTargetDays(new Set());
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Rutina semanal (equilibrio ocupacional)</Label>
      <p className="text-xs text-muted-foreground">
        Haz clic en una celda para editarla, o arrastra sobre varias horas seguidas del mismo día para rellenarlas todas a la vez.
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="border-collapse text-[11px] w-full">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card border-b border-r p-1 w-12 text-muted-foreground font-normal"></th>
              {ROUTINE_DAYS.map((dayName, day) => (
                <th key={day} className="border-b p-1 min-w-[88px] font-medium">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{dayName.slice(0, 3)}</span>
                    {day === 0 && (
                      <button
                        type="button"
                        onClick={() => copyColumnToWeekdays(0)}
                        className="text-[9px] text-muted-foreground underline decoration-dotted hover:text-foreground"
                        title="Copiar Lunes a Martes–Viernes"
                      >
                        copiar a Mar–Vie
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROUTINE_HOURS.map((hour) => (
              <tr key={hour}>
                <td className="sticky left-0 bg-card border-r p-1 text-right text-muted-foreground whitespace-nowrap">
                  {String(hour).padStart(2, "0")}:00
                </td>
                {ROUTINE_DAYS.map((_, day) => {
                  const cell = cellAt(day, hour);
                  const bg = cell?.category ? ROUTINE_CATEGORY_COLORS[cell.category] : undefined;
                  const isOpen = openCell?.day === day && openCell?.hour === hour;
                  const selected = isCellSelected(day, hour);
                  // The range-fill popover anchors to the last cell of the
                  // drag so it appears floating next to the selection, not
                  // as a fixed block below the table.
                  const isRangeAnchor = rangeReady && selection &&
                    day === selection.day && hour === selection.to;
                  return (
                    <td key={day} className="border-t p-0.5 align-top relative">
                      <Popover
                        open={isOpen && !isDragging && !rangeReady}
                        onOpenChange={(o) => setOpenCell(o ? { day, hour } : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            draggable={!!(cell?.activity || cell?.category)}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", JSON.stringify({ day, hour }));
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const raw = e.dataTransfer.getData("text/plain");
                              if (!raw) return;
                              const source = JSON.parse(raw) as { day: number; hour: number };
                              if (source.day === day && source.hour === hour) return;
                              moveCell(source.day, source.hour, day, hour);
                            }}
                            onMouseDown={(e) => {
                              // Filled cells are draggable (to move them) —
                              // letting the native HTML5 drag start cleanly
                              // means NOT calling preventDefault or starting
                              // a range-selection drag here. Only empty
                              // cells use the mouse-based range selection.
                              if (cell?.activity || cell?.category) return;
                              e.preventDefault();
                              startDrag(day, hour);
                            }}
                            onMouseEnter={() => extendDrag(day, hour)}
                            onClick={() => {
                              // A genuine click (no drag) still opens the
                              // single-cell popover via Radix's own trigger
                              // handling; nothing extra needed here.
                            }}
                            className={`w-full h-7 rounded-sm border text-left px-1 truncate select-none ${
                              selected ? "border-foreground ring-1 ring-foreground/40" : "border-transparent hover:border-border"
                            } ${cell?.activity || cell?.category ? "cursor-grab active:cursor-grabbing" : ""}`}
                            style={{ backgroundColor: bg }}
                            title={cell?.activity || undefined}
                          >
                            {cell?.activity || ""}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 space-y-2.5" side="right" align="start">
                          <p className="text-xs font-medium">
                            {ROUTINE_DAYS[day]} · {String(hour).padStart(2, "0")}:00
                          </p>
                          <Input
                            placeholder="Actividad (ej. Desayuno, Trabajo…)"
                            value={cell?.activity ?? ""}
                            onChange={(e) => setCell(day, hour, { activity: e.target.value })}
                            className="h-8 text-xs"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            {ROUTINE_CATEGORIES.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setCell(day, hour, { category: cat })}
                                className={`flex-1 h-7 rounded-md text-[10px] border-2 transition-all ${
                                  cell?.category === cat ? "border-foreground/50" : "border-transparent"
                                }`}
                                style={{ backgroundColor: ROUTINE_CATEGORY_COLORS[cat] }}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                          {cell && (cell.activity || cell.category) && (
                            <div className="flex items-center justify-between pt-1 border-t">
                              <button
                                type="button"
                                onClick={() => {
                                  setCopySourceDay(day);
                                  setCopyTargetDays(new Set());
                                }}
                                className="text-[11px] text-muted-foreground hover:text-foreground underline decoration-dotted"
                              >
                                Copiar esta hora a otros días…
                              </button>
                              <button
                                type="button"
                                onClick={() => setCell(day, hour, { activity: "", category: "" })}
                                className="text-[11px] text-destructive hover:underline"
                              >
                                Vaciar
                              </button>
                            </div>
                          )}
                          {copySourceDay === day && (
                            <div className="space-y-1.5 pt-1">
                              <div className="flex flex-wrap gap-1">
                                {ROUTINE_DAYS.map((dayName, d) =>
                                  d === day ? null : (
                                    <label key={d} className="flex items-center gap-1 text-[10px]">
                                      <input
                                        type="checkbox"
                                        checked={copyTargetDays.has(d)}
                                        onChange={(e) => {
                                          const next = new Set(copyTargetDays);
                                          if (e.target.checked) next.add(d);
                                          else next.delete(d);
                                          setCopyTargetDays(next);
                                        }}
                                      />
                                      {dayName.slice(0, 3)}
                                    </label>
                                  ),
                                )}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                className="h-6 text-[11px] w-full"
                                disabled={copyTargetDays.size === 0}
                                onClick={() => copyCellToDays(day, hour, Array.from(copyTargetDays))}
                              >
                                Copiar
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>

                      {isRangeAnchor && selection && (
                        <Popover open onOpenChange={(o) => { if (!o) clearSelection(); }}>
                          <PopoverTrigger asChild>
                            <span className="absolute inset-0 pointer-events-none" />
                          </PopoverTrigger>
                          <PopoverContent className="w-64 space-y-2.5" side="right" align="start">
                            <p className="text-xs font-medium">
                              {ROUTINE_DAYS[selection.day]} · {String(selection.from).padStart(2, "0")}:00 – {String(selection.to).padStart(2, "0")}:00 ({selection.to - selection.from + 1} h)
                            </p>
                            <Input
                              placeholder="Actividad (ej. Trabajo, Estudio…)"
                              value={rangeDraft.activity}
                              onChange={(e) => setRangeDraft((d) => ({ ...d, activity: e.target.value }))}
                              className="h-8 text-xs"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") applyRange(); }}
                            />
                            <div className="flex gap-1.5">
                              {ROUTINE_CATEGORIES.map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => setRangeDraft((d) => ({ ...d, category: cat }))}
                                  className={`flex-1 h-7 rounded-md text-[10px] border-2 transition-all ${
                                    rangeDraft.category === cat ? "border-foreground/50" : "border-transparent"
                                  }`}
                                  style={{ backgroundColor: ROUTINE_CATEGORY_COLORS[cat] }}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                                Cancelar
                              </Button>
                              <Button type="button" size="sm" className="h-7 text-xs" onClick={applyRange}>
                                Aplicar a {selection.to - selection.from + 1} h
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {ROUTINE_CATEGORIES.map((cat) => (
          <span key={cat} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: ROUTINE_CATEGORY_COLORS[cat] }} />
            {cat}
          </span>
        ))}
      </div>

      <div className="border-t pt-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Equilibrio ocupacional</p>
        <OccupationalBalanceChart cells={value} />
      </div>
    </div>
  );
}