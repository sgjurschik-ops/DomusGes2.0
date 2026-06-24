"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

type Profile = Record<string, any>;

// Each section declares which profile fields belong to it, so we can show a
// "filled / total" indicator on the collapsed header without guessing.
function countFilled(profile: Profile, fields: string[]) {
  const filled = fields.filter((f) => {
    const v = profile[f];
    if (v === undefined || v === null) return false;
    if (typeof v === "string") return v.trim() !== "";
    return true; // booleans (e.g. currentlyDrives) count as filled once set
  }).length;
  return { filled, total: fields.length };
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
  dailyRoutine: "",
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
  shortTermGoal1: "",
  shortTermGoal2: "",
  shortTermGoal3: "",
};

export function OccupationalProfileTab({ patientId }: { patientId: string }) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const res = await fetch(`/api/patients/${patientId}/occupational-profile`);
      const data = await res.json();
      setProfile({ ...emptyProfile, ...(data ?? {}) });
      setLoading(false);
    }

    loadProfile();
  }, [patientId]);

  function update(field: string, value: any) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);

    try {
      const res = await fetch(`/api/patients/${patientId}/occupational-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) throw new Error("SAVE_ERROR");

      const saved = await res.json();
      setProfile({ ...emptyProfile, ...(saved ?? {}) });

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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando perfil ocupacional…</p>;
  }

  return (
    <div className="space-y-4">
      <Section
        title="Datos generales"
        description="Información inicial de la valoración."
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

        <Field label="Composición familiar">
          <Textarea
            rows={4}
            placeholder="Ejemplo: Madre — convive — apoyo alto / Hermana — contacto semanal..."
            value={profile.familyComposition ?? ""}
            onChange={(e) => update("familyComposition", e.target.value)}
            className={!profile.familyComposition ? "bg-muted/60" : ""}
          />
        </Field>

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

        <Field label="Trabajos realizados">
          <Textarea
            rows={4}
            placeholder="Trabajo — año — duración..."
            value={profile.workHistory ?? ""}
            onChange={(e) => update("workHistory", e.target.value)}
            className={!profile.workHistory ? "bg-muted/60" : ""}
          />
        </Field>

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
        profile={profile}
        fields={[
          "dailyRoutine",
          "selfCare",
          "leisure",
          "domesticTasks",
          "physicalActivity",
          "responsibilities",
          "socialParticipation",
        ]}
      >
        <Field label="Día normal con horarios aproximados">
          <Textarea rows={5} value={profile.dailyRoutine ?? ""} onChange={(e) => update("dailyRoutine", e.target.value)} className={!profile.dailyRoutine ? "bg-muted/60" : ""} />
        </Field>

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
        profile={profile}
        fields={["desiredImprovements", "shortTermGoal1", "shortTermGoal2", "shortTermGoal3"]}
      >
        <Field label="Qué le gustaría conseguir o mejorar">
          <Textarea rows={3} value={profile.desiredImprovements ?? ""} onChange={(e) => update("desiredImprovements", e.target.value)} className={!profile.desiredImprovements ? "bg-muted/60" : ""} />
        </Field>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Objetivo 1">
            <Textarea value={profile.shortTermGoal1 ?? ""} onChange={(e) => update("shortTermGoal1", e.target.value)} className={!profile.shortTermGoal1 ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Objetivo 2">
            <Textarea value={profile.shortTermGoal2 ?? ""} onChange={(e) => update("shortTermGoal2", e.target.value)} className={!profile.shortTermGoal2 ? "bg-muted/60" : ""} />
          </Field>
          <Field label="Objetivo 3">
            <Textarea value={profile.shortTermGoal3 ?? ""} onChange={(e) => update("shortTermGoal3", e.target.value)} className={!profile.shortTermGoal3 ? "bg-muted/60" : ""} />
          </Field>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
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
  defaultOpen = false,
  profile,
  fields,
  children,
}: {
  title: string;
  description?: string;
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
      <summary className="cursor-pointer list-none px-4 py-3 border-b bg-accent/60 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
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