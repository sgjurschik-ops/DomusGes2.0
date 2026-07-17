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
  Pencil,
  Eye,
  type LucideIcon,
} from "lucide-react";
import {
  ROUTINE_CATEGORY_COLORS,
  ROUTINE_CATEGORY_LABELS,
  LEGACY_CATEGORY_COLORS,
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
import { RichTextarea } from "@/components/rich-textarea";

type Profile = Record<string, any>;

function countFilled(profile: Profile, fields: string[]) {
  const filled = fields.filter((f) => {
    const v = profile[f];
    if (v === undefined || v === null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;
  return { filled, total: fields.length };
}

const ALL_PROFILE_FIELDS = [
  "summary",
  "drivingLicense", "currentlyDrives", "drivingReason", "maritalStatus",
  "partnerInfo", "livingSituation", "familyComposition", "supportNetwork",
  "educationLevel", "otherEducation", "workHistory", "currentOccupation", "economicManagement",
  "dailyRoutineMorningWeekday", "dailyRoutineAfternoonWeekday",
  "dailyRoutineMorningWeekend", "dailyRoutineAfternoonWeekend",
  "activitiesPastSelfcare", "activitiesPastProductivity", "activitiesPastLeisure",
  "activitiesDesiredSelfcare", "activitiesDesiredProductivity", "activitiesDesiredLeisure",
  "desiredImprovements",
  "problemsUser", "problemsProfessional",
];

export function getProfileCompletion(profile: Record<string, any>): { filled: number; total: number } {
  return countFilled(profile, ALL_PROFILE_FIELDS);
}

const GOAL_AREAS = ["Cuidado de sí mismo", "Productividad", "Ocio"] as const;
type GoalArea = typeof GOAL_AREAS[number];
const GOAL_AREA_COLORS: Record<GoalArea, string> = {
  "Cuidado de sí mismo": "#5DCAA5",
  "Productividad": "#EF9F27",
  "Ocio": "#8b5cf6",
};

const GOAL_SCOPES = ["Con el paciente", "Con la familia/entorno", "Coordinación profesional"] as const;
type GoalScope = typeof GOAL_SCOPES[number];
const GOAL_SCOPE_COLORS: Record<GoalScope, string> = {
  "Con el paciente": "#4A6D8C",
  "Con la familia/entorno": "#8B6F5A",
  "Coordinación profesional": "#6B5A8C",
};
const GOAL_STATUSES = ["En curso", "Conseguido", "Abandonado"] as const;
type GoalStatus = typeof GOAL_STATUSES[number];

interface Goal {
  id?: string;
  text: string;
  area: GoalArea;
  scope: GoalScope;
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

interface SupportContact {
  name: string;
  relationship: string;
  frequency: string;
  notes: string;
}

interface WorkHistoryEntry {
  company: string;
  role: string;
  year: string;
  notes: string;
}

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
  summary: "",
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
  economicManagement: "",
  weeklyRoutine: [] as RoutineCell[],
  dailyRoutine: "",
  dailyRoutineMorningWeekday: "",
  dailyRoutineAfternoonWeekday: "",
  dailyRoutineMorningWeekend: "",
  dailyRoutineAfternoonWeekend: "",
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
  // Per-section editing state
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});

  const routineRecords = useRoutineRecords(patientId);

  function toggleEditing(key: string) {
    setEditingSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function isEditing(key: string) { return !!editingSections[key]; }
  async function saveSection(key: string) {
    await save();
    setEditingSections((prev) => ({ ...prev, [key]: false }));
  }

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const res = await fetch(`/api/patients/${patientId}/occupational-profile`);
      const data = await res.json();
      setProfile({
        ...emptyProfile,
        ...(data ?? {}),
        familyComposition: parseJsonArray<FamilyMember>(data?.familyComposition),
        supportNetwork: parseJsonArray<SupportContact>(data?.supportNetwork),
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

  function buildSavePayload() {
    return {
      ...profile,
      familyComposition: JSON.stringify(profile.familyComposition ?? []),
      supportNetwork: JSON.stringify(profile.supportNetwork ?? []),
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
        supportNetwork: parseJsonArray<SupportContact>(saved?.supportNetwork),
        workHistory: parseJsonArray<WorkHistoryEntry>(saved?.workHistory),
        weeklyRoutine: parseJsonArray<RoutineCell>(saved?.weeklyRoutine),
        goals: Array.isArray(saved?.goals)
          ? saved.goals.map((g: any) => ({
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
      toast({ title: "Perfil ocupacional guardado", description: "La información se ha actualizado correctamente." });
    } catch {
      toast({ title: "Error", description: "No se ha podido guardar el perfil ocupacional.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function generateReport() {
    setGeneratingReport(true);
    try {
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
        supportNetwork: parseJsonArray<SupportContact>(saved?.supportNetwork),
        workHistory: parseJsonArray<WorkHistoryEntry>(saved?.workHistory),
        weeklyRoutine: parseJsonArray<RoutineCell>(saved?.weeklyRoutine),
        goals: Array.isArray(saved?.goals)
          ? saved.goals.map((g: any) => ({
              id: g.id, text: g.text, area: g.area, status: g.status,
              targetDate: g.targetDate ? g.targetDate.slice(0, 10) : null,
            }))
          : [],
      });
      window.open(`/api/patients/${patientId}/occupational-profile/report`, "_blank");
      toast({ title: "Informe generado", description: "Se ha abierto en una nueva pestana. Usa Cmd+P para guardar como PDF." });
    } catch {
      toast({ title: "Error", description: "No se ha podido generar el informe Word.", variant: "destructive" });
    } finally {
      setGeneratingReport(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando perfil ocupacional…</p>;
  }

  return (
    <div className="space-y-4">
      {/* ─── 1. Datos generales ─── */}
      <Section title="Datos generales" description="Resumen general de la valoración." icon={ClipboardList} color="blue" defaultOpen profile={profile} fields={["summary"]}
        editing={isEditing("general")} onToggleEdit={() => toggleEditing("general")}
        onSave={() => saveSection("general")} saving={saving}>
        {isEditing("general") ? (
          <Field label="Resumen">
            <RichTextarea rows={5} value={profile.summary ?? ""} onChange={(v) => update("summary", v)} placeholder="Resumen general del caso — más adelante la IA podrá generarlo automáticamente a partir de los demás apartados." />
          </Field>
        ) : (
          <ReadOnlyHtml value={profile.summary} placeholder="Sin resumen aún." />
        )}
      </Section>

      {/* ─── 2. Área social-familiar ─── */}
      <Section title="Área social-familiar" description="Convivencia, red de apoyo y relaciones significativas." icon={Users} color="purple" profile={profile}
        fields={["drivingLicense", "currentlyDrives", "drivingReason", "maritalStatus", "partnerInfo", "livingSituation", "familyComposition", "supportNetwork"]}
        editing={isEditing("social")} onToggleEdit={() => toggleEditing("social")}
        onSave={() => saveSection("social")} saving={saving}>
        {/* Dropdowns — always interactive */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Carné de conducir">
            <Select value={profile.drivingLicense ?? ""} onValueChange={(v) => update("drivingLicense", v)}>
              <SelectTrigger className={!profile.drivingLicense ? "border-dashed border-muted-foreground/40" : ""}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sí">Sí</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="¿Conduce actualmente?">
            <Select value={profile.currentlyDrives === true ? "Sí" : profile.currentlyDrives === false ? "No" : ""} onValueChange={(v) => update("currentlyDrives", v === "Sí")}>
              <SelectTrigger className={profile.currentlyDrives === undefined ? "border-dashed border-muted-foreground/40" : ""}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sí">Sí</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Motivo si no conduce o información relevante">
          <Input value={profile.drivingReason ?? ""} onChange={(e) => update("drivingReason", e.target.value)} className={!profile.drivingReason ? "border-dashed border-muted-foreground/40" : ""} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Estado civil">
            <Select value={profile.maritalStatus ?? ""} onValueChange={(v) => update("maritalStatus", v)}>
              <SelectTrigger className={!profile.maritalStatus ? "border-dashed border-muted-foreground/40" : ""}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Soltero/a">Soltero/a</SelectItem>
                <SelectItem value="Casado/a">Casado/a</SelectItem>
                <SelectItem value="Divorciado/a">Divorciado/a</SelectItem>
                <SelectItem value="Viudo/a">Viudo/a</SelectItem>
                <SelectItem value="Pareja de hecho">Pareja de hecho</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nombre y edad / información pareja">
            <Input value={profile.partnerInfo ?? ""} onChange={(e) => update("partnerInfo", e.target.value)} className={!profile.partnerInfo ? "border-dashed border-muted-foreground/40" : ""} />
          </Field>
        </div>
        <Field label="Convivencia actual">
          <Select value={profile.livingSituation ?? ""} onValueChange={(v) => update("livingSituation", v)}>
            <SelectTrigger className={!profile.livingSituation ? "border-dashed border-muted-foreground/40" : ""}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Casa propia">Casa propia</SelectItem>
              <SelectItem value="Casa familiar">Casa familiar</SelectItem>
              <SelectItem value="Casa de alquiler">Casa de alquiler</SelectItem>
              <SelectItem value="Residencia o piso tutelado">Residencia o piso tutelado</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {/* Family & Support — view/edit toggle */}
        {isEditing("social") ? (
          <>
            <FamilyMembersEditor value={profile.familyComposition ?? []} onChange={(members) => update("familyComposition", members)} />
            <SupportNetworkEditor value={profile.supportNetwork ?? []} onChange={(contacts) => update("supportNetwork", contacts)} />
          </>
        ) : (
          <>
            <ReadOnlyTable label="Composición familiar" items={Array.isArray(profile.familyComposition) ? profile.familyComposition : []}
              columns={[
                { header: "Nombre", render: (m: FamilyMember) => m.name },
                { header: "Relación", render: (m: FamilyMember) => m.relationship },
                { header: "Ocupación", render: (m: FamilyMember) => m.occupation },
                { header: "Notas", render: (m: FamilyMember) => m.notes },
              ]} emptyText="Sin familiares añadidos." />
            <ReadOnlyTable label="Red de apoyo / amistades" items={Array.isArray(profile.supportNetwork) ? profile.supportNetwork : []}
              columns={[
                { header: "Nombre", render: (c: SupportContact) => c.name },
                { header: "Relación", render: (c: SupportContact) => c.relationship },
                { header: "Frecuencia", render: (c: SupportContact) => c.frequency },
                { header: "Notas", render: (c: SupportContact) => c.notes },
              ]} emptyText="Sin contactos de apoyo." />
          </>
        )}
      </Section>

      {/* ─── 3. Área laboral y económica ─── */}
      <Section title="Área laboral y económica" description="Formación, trayectoria laboral y autonomía económica." icon={Briefcase} color="orange" profile={profile}
        fields={["educationLevel", "otherEducation", "workHistory", "currentOccupation", "economicManagement"]}
        editing={isEditing("work")} onToggleEdit={() => toggleEditing("work")}
        onSave={() => saveSection("work")} saving={saving}>
        <Field label="Estudios realizados">
          <Select value={profile.educationLevel ?? ""} onValueChange={(v) => update("educationLevel", v)}>
            <SelectTrigger className={!profile.educationLevel ? "border-dashed border-muted-foreground/40" : ""}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
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
          <Textarea value={profile.otherEducation ?? ""} onChange={(e) => update("otherEducation", e.target.value)} className={!profile.otherEducation ? "border-dashed border-muted-foreground/40" : ""} />
        </Field>

        {isEditing("work") ? (
          <WorkHistoryEditor value={profile.workHistory ?? []} onChange={(entries) => update("workHistory", entries)} />
        ) : (
          <ReadOnlyTable label="Trabajos realizados" items={Array.isArray(profile.workHistory) ? profile.workHistory : []}
            columns={[
              { header: "Empresa", render: (w: WorkHistoryEntry) => w.company },
              { header: "Funciones", render: (w: WorkHistoryEntry) => w.role },
              { header: "Año", render: (w: WorkHistoryEntry) => w.year },
              { header: "Notas", render: (w: WorkHistoryEntry) => w.notes },
            ]} emptyText="Sin trabajos añadidos." />
        )}

        {isEditing("work") ? (
          <>
            <Field label="Trabajo u ocupación actual">
              <Textarea value={profile.currentOccupation ?? ""} onChange={(e) => update("currentOccupation", e.target.value)} className={!profile.currentOccupation ? "border-dashed border-muted-foreground/40" : ""} />
            </Field>
            <Field label="Gestión económica">
              <RichTextarea rows={3} value={profile.economicManagement ?? ""} onChange={(v) => update("economicManagement", v)} placeholder="Quién gestiona el dinero, organización de ingresos, autonomía económica..." />
            </Field>
          </>
        ) : (
          <>
            <ReadOnlyField label="Trabajo u ocupación actual" value={profile.currentOccupation} />
            <ReadOnlyHtml label="Gestión económica" value={profile.economicManagement} placeholder="Sin completar." />
          </>
        )}
      </Section>

      {/* ─── 4. Hábitos y rutinas ─── */}
      <Section title="Hábitos y rutinas" description="Rutina diaria y planning semanal." icon={CalendarClock} color="yellow" profile={profile}
        fields={["dailyRoutineMorningWeekday", "dailyRoutineAfternoonWeekday", "dailyRoutineMorningWeekend", "dailyRoutineAfternoonWeekend"]}
        editing={isEditing("habits")} onToggleEdit={() => toggleEditing("habits")}
        onSave={() => saveSection("habits")} saving={saving}>
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
          {(routineRecords.data?.length ?? 0) > 0 && (
            <RoutineBalanceFromRecords patientId={patientId} />
          )}
        </div>

        {isEditing("habits") ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lunes a viernes</p>
              <Field label="Mañana">
                <RichTextarea rows={3} value={profile.dailyRoutineMorningWeekday ?? ""} onChange={(v) => update("dailyRoutineMorningWeekday", v)} placeholder="Rutina de mañana entre semana..." />
              </Field>
              <Field label="Tarde">
                <RichTextarea rows={3} value={profile.dailyRoutineAfternoonWeekday ?? ""} onChange={(v) => update("dailyRoutineAfternoonWeekday", v)} placeholder="Rutina de tarde entre semana..." />
              </Field>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fin de semana</p>
              <Field label="Mañana">
                <RichTextarea rows={3} value={profile.dailyRoutineMorningWeekend ?? ""} onChange={(v) => update("dailyRoutineMorningWeekend", v)} placeholder="Rutina de mañana el fin de semana..." />
              </Field>
              <Field label="Tarde">
                <RichTextarea rows={3} value={profile.dailyRoutineAfternoonWeekend ?? ""} onChange={(v) => update("dailyRoutineAfternoonWeekend", v)} placeholder="Rutina de tarde el fin de semana..." />
              </Field>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lunes a viernes</p>
              <ReadOnlyHtml label="Mañana" value={profile.dailyRoutineMorningWeekday} placeholder="Sin completar." />
              <ReadOnlyHtml label="Tarde" value={profile.dailyRoutineAfternoonWeekday} placeholder="Sin completar." />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fin de semana</p>
              <ReadOnlyHtml label="Mañana" value={profile.dailyRoutineMorningWeekend} placeholder="Sin completar." />
              <ReadOnlyHtml label="Tarde" value={profile.dailyRoutineAfternoonWeekend} placeholder="Sin completar." />
            </div>
          </div>
        )}
      </Section>

      {routineEditorOpen && (
        <WeeklyRoutineEditor patientId={patientId} onClose={() => setRoutineEditorOpen(false)} />
      )}

      {/* ─── 5. Actividades realizadas y deseadas ─── */}
      <Section title="Actividades realizadas y deseadas" description="Actividades que realizaba y las que le gustaría retomar o realizar actualmente." icon={Heart} color="green" profile={profile}
        fields={["activitiesPastSelfcare", "activitiesPastProductivity", "activitiesPastLeisure", "activitiesDesiredSelfcare", "activitiesDesiredProductivity", "activitiesDesiredLeisure"]}
        editing={isEditing("activities")} onToggleEdit={() => toggleEditing("activities")}
        onSave={() => saveSection("activities")} saving={saving}>
        {isEditing("activities") ? (
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold mb-2">Actividades que realizaba</p>
              <AreaBlock color="teal" label="Cuidado de sí mismo" desc="Cuidado personal, movilidad, gestión comunitaria" value={profile.activitiesPastSelfcare ?? ""} onChange={(v) => update("activitiesPastSelfcare", v)} />
              <AreaBlock color="amber" label="Productividad" desc="Trabajo o voluntariado, manejo del hogar, estudios" value={profile.activitiesPastProductivity ?? ""} onChange={(v) => update("activitiesPastProductivity", v)} />
              <AreaBlock color="violet" label="Ocio" desc="Recreación tranquila, activa y socialización" value={profile.activitiesPastLeisure ?? ""} onChange={(v) => update("activitiesPastLeisure", v)} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold mb-2">Actividades que le gustaría retomar o realizar</p>
              <AreaBlock color="teal" label="Cuidado de sí mismo" desc="Cuidado personal, movilidad, gestión comunitaria" value={profile.activitiesDesiredSelfcare ?? ""} onChange={(v) => update("activitiesDesiredSelfcare", v)} />
              <AreaBlock color="amber" label="Productividad" desc="Trabajo o voluntariado, manejo del hogar, estudios" value={profile.activitiesDesiredProductivity ?? ""} onChange={(v) => update("activitiesDesiredProductivity", v)} />
              <AreaBlock color="violet" label="Ocio" desc="Recreación tranquila, activa y socialización" value={profile.activitiesDesiredLeisure ?? ""} onChange={(v) => update("activitiesDesiredLeisure", v)} />
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Actividades que realizaba</p>
              <ReadOnlyHtmlColored label="Cuidado de sí mismo" value={profile.activitiesPastSelfcare} color="teal" />
              <ReadOnlyHtmlColored label="Productividad" value={profile.activitiesPastProductivity} color="amber" />
              <ReadOnlyHtmlColored label="Ocio" value={profile.activitiesPastLeisure} color="violet" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Actividades deseadas</p>
              <ReadOnlyHtmlColored label="Cuidado de sí mismo" value={profile.activitiesDesiredSelfcare} color="teal" />
              <ReadOnlyHtmlColored label="Productividad" value={profile.activitiesDesiredProductivity} color="amber" />
              <ReadOnlyHtmlColored label="Ocio" value={profile.activitiesDesiredLeisure} color="violet" />
            </div>
          </div>
        )}
      </Section>

      {/* ─── 6. Problemas detectados ─── */}
      <Section title="Problemas detectados" description="Problemas identificados por el/la usuario/a y por el/la profesional." icon={ClipboardList} color="orange" profile={profile}
        fields={["problemsUser", "problemsProfessional"]}
        editing={isEditing("problems")} onToggleEdit={() => toggleEditing("problems")}
        onSave={() => saveSection("problems")} saving={saving}>
        {isEditing("problems") ? (
          <>
            <Field label="Problemas detectados por el/la usuario/a">
              <RichTextarea rows={4} value={profile.problemsUser ?? ""} onChange={(v) => update("problemsUser", v)} placeholder="Problemas que el/la paciente identifica como principales..." />
            </Field>
            <Field label="Problemas detectados por el/la profesional">
              <RichTextarea rows={4} value={profile.problemsProfessional ?? ""} onChange={(v) => update("problemsProfessional", v)} placeholder="Problemas identificados por el/la terapeuta durante la evaluación..." />
            </Field>
          </>
        ) : (
          <>
            <ReadOnlyHtml label="Por el/la usuario/a" value={profile.problemsUser} placeholder="Sin completar." />
            <ReadOnlyHtml label="Por el/la profesional" value={profile.problemsProfessional} placeholder="Sin completar." />
          </>
        )}
      </Section>

      {/* ─── 7. Objetivos y planificación ─── */}
      <Section title="Objetivos y planificación" description="Objetivos ocupacionales con seguimiento temporal." icon={Target} color="blue" profile={profile}
        fields={["desiredImprovements"]}
        editing={isEditing("goals")} onToggleEdit={() => toggleEditing("goals")}
        onSave={() => saveSection("goals")} saving={saving}>
        {isEditing("goals") ? (
          <>
            <Field label="Qué le gustaría conseguir o mejorar">
              <RichTextarea rows={3} value={profile.desiredImprovements ?? ""} onChange={(v) => update("desiredImprovements", v)} />
            </Field>
            <GoalsEditor value={profile.goals ?? []} onChange={(goals) => update("goals", goals)} />
          </>
        ) : (
          <>
            <ReadOnlyHtml label="Qué le gustaría conseguir" value={profile.desiredImprovements} placeholder="Sin completar." />
            <ReadOnlyGoals goals={profile.goals ?? []} />
          </>
        )}
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

// ─── Helper components ──────────────────────────────────────────────────────

type ChipColor = "blue" | "green" | "orange" | "purple" | "yellow";

const CHIP_VARS: Record<ChipColor, { bg: string; text: string }> = {
  blue: { bg: "var(--chip-blue-bg)", text: "var(--chip-blue-text)" },
  green: { bg: "var(--chip-green-bg)", text: "var(--chip-green-text)" },
  orange: { bg: "var(--chip-orange-bg)", text: "var(--chip-orange-text)" },
  purple: { bg: "var(--chip-purple-bg)", text: "var(--chip-purple-text)" },
  yellow: { bg: "var(--chip-yellow-bg)", text: "var(--chip-yellow-text)" },
};

function Section({
  title, description, icon: Icon, color = "blue", defaultOpen = false, profile, fields, children, editing, onToggleEdit, onSave, saving,
}: {
  title: string; description?: string; icon?: LucideIcon; color?: ChipColor; defaultOpen?: boolean;
  profile: Profile; fields: string[]; children: React.ReactNode;
  editing?: boolean; onToggleEdit?: () => void; onSave?: () => void; saving?: boolean;
}) {
  const { filled, total } = countFilled(profile, fields);
  const isComplete = filled === total;
  const isEmpty = filled === 0;
  const chip = CHIP_VARS[color];

  return (
    <details open={defaultOpen} className="group rounded-lg border bg-card shadow-sm overflow-hidden">
      <summary className="cursor-pointer list-none px-4 py-3 border-b bg-muted flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="flex items-center justify-center w-8 h-8 rounded-md shrink-0" style={{ backgroundColor: chip.bg, color: chip.text }}>
              <Icon className="w-4 h-4" />
            </span>
          )}
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs rounded-full px-2 py-0.5 font-medium"
            style={isComplete ? { backgroundColor: "var(--chip-green-bg)", color: "var(--chip-green-text)" } : isEmpty ? { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" } : { backgroundColor: "var(--chip-yellow-bg)", color: "var(--chip-yellow-text)" }}
            title={`${filled} de ${total} campos rellenados`}>
            {filled}/{total}
          </span>
          <span className="text-muted-foreground text-xs transition-transform group-open:rotate-90">▶</span>
        </div>
      </summary>
      <div className="p-4 space-y-4 bg-card">
        {children}
        {onToggleEdit && (
          <div className="flex justify-end gap-2 pt-2">
            {editing && onSave && (
              <Button type="button" variant="default" size="sm" className="h-7 px-3 text-xs" disabled={saving} onClick={onSave}>
                <Save className="w-3.5 h-3.5 mr-1" />
                {saving ? "Guardando…" : "Guardar"}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" className="h-7 px-3 text-xs" onClick={onToggleEdit}>
              {editing ? <><Eye className="w-3.5 h-3.5 mr-1" />Ver</> : <><Pencil className="w-3.5 h-3.5 mr-1" />Editar</>}
            </Button>
          </div>
        )}
      </div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">{label}</Label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <p className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">{label}</p>
      {value?.trim() ? (
        <p className="text-sm bg-muted/40 rounded-md px-3 py-2">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic border border-dashed border-muted-foreground/40 rounded-md px-3 py-2">Sin completar.</p>
      )}
    </div>
  );
}

function ReadOnlyHtml({ label, value, placeholder = "Sin completar." }: { label?: string; value?: string; placeholder?: string }) {
  const hasValue = value && value.replace(/<[^>]*>/g, "").trim();
  return (
    <div className="space-y-1">
      {label && <p className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">{label}</p>}
      {hasValue ? (
        <div className="text-sm prose prose-sm max-w-none bg-muted/40 rounded-md px-3 py-2" dangerouslySetInnerHTML={{ __html: value! }} />
      ) : (
        <p className="text-sm text-muted-foreground italic border border-dashed border-muted-foreground/40 rounded-md px-3 py-2">{placeholder}</p>
      )}
    </div>
  );
}

function ReadOnlyTable<T>({
  label, items, columns, emptyText,
}: {
  label: string;
  items: T[];
  columns: { header: string; render: (item: T) => string }[];
  emptyText: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">{label}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic border border-dashed border-muted-foreground/40 rounded-md px-3 py-2">{emptyText}</p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--chip-blue-bg)" }}>
                {columns.map((col) => (
                  <th key={col.header} className="text-left font-medium px-3 py-1.5" style={{ color: "var(--chip-blue-text)" }}>{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-t">
                  {columns.map((col) => {
                    const val = col.render(item);
                    return (
                      <td key={col.header} className="px-3 py-2 align-top">
                        {val ? val : <span className="text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


const GOAL_STATUS_STYLES: Record<GoalStatus, string> = {
  "En curso": "bg-sky-100 text-sky-900",
  "Conseguido": "bg-emerald-100 text-emerald-900",
  "Abandonado": "bg-zinc-100 text-zinc-700",
};

function ReadOnlyGoals({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) return <p className="text-sm text-muted-foreground italic border border-dashed border-muted-foreground/40 rounded-md px-3 py-2">Sin objetivos añadidos.</p>;
  return (
    <div className="space-y-2">
      <p className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">Objetivos</p>
      {goals.map((g, i) => {
        const areaColor = GOAL_AREA_COLORS[g.area] ?? "#6b7280";
        return (
          <div key={i} className="rounded-lg border bg-muted/40 p-3 space-y-1" style={{ borderLeftWidth: "4px", borderLeftColor: areaColor }}>
            <p className="text-sm font-medium">{g.text || "Sin descripción"}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: areaColor }}>{g.area}</span>
              {g.scope && <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: GOAL_SCOPE_COLORS[g.scope as GoalScope] ?? "#6b7280", backgroundColor: `${GOAL_SCOPE_COLORS[g.scope as GoalScope] ?? "#6b7280"}18` }}>{g.scope}</span>}
              <span className={`text-xs rounded-full px-2 py-0.5 ${GOAL_STATUS_STYLES[g.status]}`}>{g.status}</span>
              {g.startDate && <span className="text-xs text-muted-foreground">Inicio: {g.startDate}</span>}
              {g.targetDate && <span className="text-xs text-muted-foreground">Objetivo: {g.targetDate}</span>}
            </div>
            {g.evaluation && <p className="text-xs text-muted-foreground mt-1">{g.evaluation}</p>}
          </div>
        );
      })}
    </div>
  );
}

const AREA_GROUP_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  teal: { border: "#5DCAA5", text: "#0F6E56", bg: "#E1F5EE" },
  amber: { border: "#EF9F27", text: "#854F0B", bg: "#FAEEDA" },
  violet: { border: "#8b5cf6", text: "#534AB7", bg: "#EEEDFE" },
};

function AreaBlock({ color, label, desc, value, onChange }: { color: string; label: string; desc: string; value: string; onChange: (v: string) => void }) {
  const c = AREA_GROUP_COLORS[color] ?? AREA_GROUP_COLORS.teal;
  return (
    <div className="rounded-lg pl-3 space-y-1.5" style={{ borderLeft: `4px solid ${c.border}` }}>
      <p className="inline-block text-xs font-bold px-2 py-0.5 rounded" style={{ color: c.text, backgroundColor: c.bg }}>{label}</p>
      <p className="text-[11px] text-muted-foreground">{desc}</p>
      <RichTextarea value={value} onChange={onChange} rows={2} />
    </div>
  );
}

function ReadOnlyHtmlColored({ label, value, color, placeholder = "Sin completar." }: { label: string; value?: string; color: string; placeholder?: string }) {
  const c = AREA_GROUP_COLORS[color] ?? AREA_GROUP_COLORS.teal;
  const hasValue = value && value.replace(/<[^>]*>/g, "").trim();
  return (
    <div className="rounded-lg pl-3 space-y-1" style={{ borderLeft: `4px solid ${c.border}` }}>
      <p className="inline-block text-[11px] uppercase tracking-wide font-bold px-2 py-0.5 rounded" style={{ color: c.text, backgroundColor: c.bg }}>{label}</p>
      {hasValue ? (
        <div className="text-sm prose prose-sm max-w-none rounded-md px-3 py-2" style={{ backgroundColor: c.bg }} dangerouslySetInnerHTML={{ __html: value! }} />
      ) : (
        <p className="text-sm text-muted-foreground italic border border-dashed border-muted-foreground/40 rounded-md px-3 py-2">{placeholder}</p>
      )}
    </div>
  );
}

// ─── List editors ────────────────────────────────────────────────────────────

function FamilyMembersEditor({ value, onChange }: { value: FamilyMember[]; onChange: (members: FamilyMember[]) => void }) {
  function addRow() { onChange([...value, { name: "", relationship: "", occupation: "", notes: "" }]); }
  function updateRow(i: number, patch: Partial<FamilyMember>) { onChange(value.map((m, idx) => (idx === i ? { ...m, ...patch } : m))); }
  function removeRow(i: number) { onChange(value.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-1.5">
      <Label className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">Composición familiar</Label>
      {value.length === 0 && <p className="text-xs text-muted-foreground italic">Sin familiares añadidos.</p>}
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

function SupportNetworkEditor({ value, onChange }: { value: SupportContact[]; onChange: (contacts: SupportContact[]) => void }) {
  function addRow() { onChange([...value, { name: "", relationship: "", frequency: "", notes: "" }]); }
  function updateRow(i: number, patch: Partial<SupportContact>) { onChange(value.map((c, idx) => (idx === i ? { ...c, ...patch } : c))); }
  function removeRow(i: number) { onChange(value.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-1.5">
      <Label className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">Red de apoyo / amistades</Label>
      {value.length === 0 && <p className="text-xs text-muted-foreground italic">Sin contactos de apoyo añadidos.</p>}
      <div className="space-y-2">
        {value.map((contact, i) => (
          <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] gap-2 items-start">
            <Input placeholder="Nombre" value={contact.name} onChange={(e) => updateRow(i, { name: e.target.value })} />
            <Input placeholder="Relación (ej. Amigo)" value={contact.relationship} onChange={(e) => updateRow(i, { relationship: e.target.value })} />
            <Input placeholder="Frecuencia contacto" value={contact.frequency} onChange={(e) => updateRow(i, { frequency: e.target.value })} />
            <Input placeholder="Otros (vía de contacto, nivel apoyo...)" value={contact.notes} onChange={(e) => updateRow(i, { notes: e.target.value })} />
            <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => removeRow(i)} aria-label="Quitar contacto">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir contacto
      </Button>
    </div>
  );
}

function WorkHistoryEditor({ value, onChange }: { value: WorkHistoryEntry[]; onChange: (entries: WorkHistoryEntry[]) => void }) {
  function addRow() { onChange([...value, { company: "", role: "", year: "", notes: "" }]); }
  function updateRow(i: number, patch: Partial<WorkHistoryEntry>) { onChange(value.map((w, idx) => (idx === i ? { ...w, ...patch } : w))); }
  function removeRow(i: number) { onChange(value.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-1.5">
      <Label className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">Trabajos realizados</Label>
      {value.length === 0 && <p className="text-xs text-muted-foreground italic">Sin trabajos añadidos.</p>}
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

function GoalsEditor({ value, onChange }: { value: Goal[]; onChange: (goals: Goal[]) => void }) {
  function addRow() {
    onChange([...value, { text: "", area: "Cuidado de sí mismo", scope: "Con el paciente", status: "En curso", startDate: new Date().toISOString().slice(0, 10), targetDate: null, evaluation: "" }]);
  }
  function updateRow(i: number, patch: Partial<Goal>) { onChange(value.map((g, idx) => (idx === i ? { ...g, ...patch } : g))); }
  function removeRow(i: number) {
    const ok = confirm("¿Seguro que quieres eliminar este objetivo?");
    if (!ok) return;
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <Label className="inline-block text-[11px] uppercase tracking-wide font-bold text-foreground bg-muted px-2 py-0.5 rounded">Objetivos</Label>
      {value.length === 0 && <p className="text-xs text-muted-foreground italic">Sin objetivos añadidos.</p>}
      <div className="space-y-3">
        {value.map((goal, i) => {
          const areaColor = GOAL_AREA_COLORS[goal.area] ?? "#6b7280";
          return (
            <div key={i} className="rounded-lg border overflow-hidden" style={{ borderLeftWidth: "4px", borderLeftColor: areaColor }}>
              <div className="p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Textarea rows={2} placeholder="Describe el objetivo…" value={goal.text} onChange={(e) => updateRow(i, { text: e.target.value })} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeRow(i)} aria-label="Quitar objetivo">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-5 gap-2">
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
                  <Select value={goal.scope ?? "Con el paciente"} onValueChange={(v) => updateRow(i, { scope: v as GoalScope })}>
                    <SelectTrigger className="h-8 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: GOAL_SCOPE_COLORS[goal.scope as GoalScope] ?? "#9CA3AF" }} />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {GOAL_SCOPES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: GOAL_SCOPE_COLORS[s] }} />
                            {s}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={goal.status} onValueChange={(v) => updateRow(i, { status: v as GoalStatus })}>
                    <SelectTrigger className={`h-8 text-xs ${GOAL_STATUS_STYLES[goal.status]}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GOAL_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
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
                  <Textarea rows={2} placeholder="Valoración del progreso hacia este objetivo..." value={goal.evaluation ?? ""} onChange={(e) => updateRow(i, { evaluation: e.target.value })} className={!goal.evaluation ? "border-dashed border-muted-foreground/40" : ""} />
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

// ─── Occupational balance charts ─────────────────────────────────────────────
function OccupationalBalanceCharts({ cells }: { cells: RoutineCell[] }) {
  const filled = cells.filter((c) => c.category);
  const totalSlots = filled.length;

  if (totalSlots === 0) {
    return <p className="text-xs text-muted-foreground italic">Abre el planning y rellena celdas para ver el análisis de equilibrio ocupacional.</p>;
  }

  const totalHours = totalSlots * 0.5;

  const presentCats = Array.from(new Set(filled.map((c) => c.category).filter(Boolean))) as string[];
  const otpfData = presentCats.map((cat) => {
    const slots = filled.filter((c) => c.category === cat).length;
    const fill = ROUTINE_CATEGORY_COLORS[cat as RoutineCategory] ?? LEGACY_CATEGORY_COLORS[cat] ?? "#e5e5e5";
    const label = ROUTINE_CATEGORY_LABELS[cat as RoutineCategory] ?? cat;
    return { name: cat, label, hours: slots * 0.5, pct: ((slots / totalSlots) * 100).toFixed(1), fill };
  }).filter((d) => d.hours > 0);

  const groupCounts: Record<BalanceGroup, number> = { Autocuidado: 0, Productividad: 0, Ocio: 0 };
  for (const c of filled) {
    const grp = (c.group as BalanceGroup) || (c.category ? OTPF_TO_GROUP[c.category] : null);
    if (grp && grp in groupCounts) groupCounts[grp as BalanceGroup] += 1;
  }
  const groupData = BALANCE_GROUPS.map((grp) => ({
    name: grp, hours: groupCounts[grp] * 0.5, pct: ((groupCounts[grp] / totalSlots) * 100).toFixed(1), fill: BALANCE_GROUP_COLORS[grp],
  })).filter((d) => d.hours > 0);

  // Build Grupo → Categoría → actividades identificadas (deduplicated, in order of appearance)
  const activityTree: { group: BalanceGroup; category: string; label: string; activities: string[] }[] = [];
  for (const grp of BALANCE_GROUPS) {
    const catsInGroup = presentCats.filter((cat) => ((OTPF_TO_GROUP[cat] as BalanceGroup) ?? null) === grp);
    for (const cat of catsInGroup) {
      const seen = new Set<string>();
      const activities: string[] = [];
      for (const c of filled) {
        if (c.category !== cat || !c.activity?.trim()) continue;
        const name = c.activity.trim();
        if (!seen.has(name)) { seen.add(name); activities.push(name); }
      }
      if (activities.length > 0) {
        activityTree.push({ group: grp, category: cat, label: ROUTINE_CATEGORY_LABELS[cat as RoutineCategory] ?? cat, activities });
      }
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Por categoría</p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <PieChart width={150} height={150}>
            <Pie data={otpfData} cx={70} cy={70} innerRadius={38} outerRadius={62} dataKey="hours" strokeWidth={1.5}>
              {otpfData.map((e) => <Cell key={e.name} fill={e.fill} />)}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [`${(v as number).toFixed(1)} h`, otpfData.find((d) => d.name === n)?.label ?? n]} />
          </PieChart>
          <table className="text-xs w-full">
            <thead><tr className="text-muted-foreground border-b"><th className="text-left pb-1 font-medium">Categoría</th><th className="text-right pb-1 font-medium">h</th><th className="text-right pb-1 font-medium">%</th></tr></thead>
            <tbody>
              {otpfData.map((row) => (
                <tr key={row.name} className="border-b last:border-0">
                  <td className="py-0.5 flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ backgroundColor: row.fill }} />{row.label}</td>
                  <td className="py-0.5 text-right tabular-nums">{row.hours.toFixed(1)}</td>
                  <td className="py-0.5 text-right tabular-nums text-muted-foreground">{row.pct}%</td>
                </tr>
              ))}
              <tr className="font-medium border-t"><td className="pt-1">Total</td><td className="pt-1 text-right tabular-nums">{totalHours.toFixed(1)}</td><td className="pt-1 text-right text-muted-foreground">100%</td></tr>
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
            <thead><tr className="text-muted-foreground border-b"><th className="text-left pb-1 font-medium">Grupo</th><th className="text-right pb-1 font-medium">h</th><th className="text-right pb-1 font-medium">%</th><th className="text-right pb-1 font-medium text-muted-foreground/60">Ref.</th></tr></thead>
            <tbody>
              {BALANCE_GROUPS.map((grp) => {
                const hours = groupCounts[grp] * 0.5;
                const pct = totalSlots > 0 ? ((groupCounts[grp] / totalSlots) * 100).toFixed(1) : "0.0";
                const ref = BALANCE_GROUP_REFERENCE[grp];
                const fill = BALANCE_GROUP_COLORS[grp];
                return (
                  <tr key={grp} className="border-b last:border-0">
                    <td className="py-0.5 flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm inline-block shrink-0" style={{ backgroundColor: fill }} />{grp}</td>
                    <td className="py-0.5 text-right tabular-nums">{hours.toFixed(1)}</td>
                    <td className="py-0.5 text-right tabular-nums text-muted-foreground">{pct}%</td>
                    <td className="py-0.5 text-right tabular-nums text-muted-foreground/50">~{ref}%</td>
                  </tr>
                );
              })}
              <tr className="font-medium border-t"><td className="pt-1">Total</td><td className="pt-1 text-right tabular-nums">{totalHours.toFixed(1)}</td><td className="pt-1 text-right text-muted-foreground">100%</td><td></td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5 italic">Ref. = porcentaje de referencia de equilibrio ocupacional (caso típico de adulto activo)</p>

        {activityTree.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Actividades identificadas</p>
            <div className="space-y-2">
              {BALANCE_GROUPS.map((grp) => {
                const rows = activityTree.filter((r) => r.group === grp);
                if (rows.length === 0) return null;
                return (
                  <div key={grp} className="rounded-md border overflow-hidden">
                    <div className="px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: BALANCE_GROUP_COLORS[grp], color: "#1a1a1a" }}>{grp}</div>
                    <table className="w-full text-xs">
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.category} className="border-t first:border-t-0">
                            <td className="py-1 px-2.5 text-muted-foreground whitespace-nowrap align-top w-1/3">{r.label}</td>
                            <td className="py-1 px-2.5">{r.activities.join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
      .then((data) => { try { setCells(JSON.parse(data.cells)); } catch { setCells([]); } })
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
