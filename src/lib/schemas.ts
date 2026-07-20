// Zod schemas — single source of truth for form validation AND API request validation.
// Each schema produces a TS type via z.infer so forms and endpoints agree.

import { z } from "zod";

// ─── Constants ───────────────────────────────────────────────────────────────

export const SPECIALTIES = ["Fisioterapia", "Psicología", "T. Ocupacional"] as const;
export const PATIENT_STATUSES = ["Activo", "En seguimiento", "Alta", "Pausado"] as const;
export const PROFESSIONAL_ROLES = [
  "Fisioterapeuta",
  "Terapeuta Ocupacional",
  "Psicólogo/a Clínico/a",
  "Enfermero/a",
  "Médico/a",
  "Trabajador/a Social",
  "Logopeda",
  "Auxiliar de Enfermería",
  "TCAE",
  "Administrador",
  "Otro",
] as const;
export const APPOINTMENT_TYPES = ["Sesión", "Valoración", "Seguimiento", "Coordinación"] as const;
export const APPOINTMENT_STATUSES = [
  "programada",
  "completada",
  "cancelada",
  "no_show",
] as const;
export const ASSESSMENT_SCALES = [
  "VAVDI",
  "Barthel",
  "Lawton-Brody",
  "COPM",
  "9HPT",
  "Box and Block",
  "TUG",
  "JAMAR",
  "Minnesota",
  "Monofilamentos",
  "Esterognosia",
  "Propiocepción",
] as const;

// Scales with a structured, item-by-item form (score is computed, not
// typed in by hand). Any scale not in this list keeps the free-text score
// field as before.
export const STRUCTURED_SCALES = ["Barthel", "Lawton-Brody", "VAVDI", "COPM", "9HPT", "Box and Block", "TUG", "JAMAR", "Minnesota"] as const;
export type StructuredScale = (typeof STRUCTURED_SCALES)[number];

// Qualitative scales — observation text only, no numeric score.
export const QUALITATIVE_SCALES = ["Monofilamentos", "Esterognosia", "Propiocepción"] as const;
export type QualitativeScale = (typeof QUALITATIVE_SCALES)[number];

export const PROFESSIONAL_COLORS = [
  "#1a5c58", // brand teal
  "#5b3fa0",
  "#c17f3a",
  "#b03060",
  "#2a6b3f",
  "#1a5c80",
  "#7c3a3a",
  "#5c5c8a",
];

// ─── Login ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Email no válido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Introduce tu contraseña actual"),
    newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ─── Professional ────────────────────────────────────────────────────────────

export const professionalCreateSchema = z
  .object({
    name: z.string().min(2, "El nombre es obligatorio"),
    email: z.string().optional().default(""),
    role: z.enum(PROFESSIONAL_ROLES, { error: "Rol no válido" }),
    numColegiado: z.string().optional().default(""),
    phone: z.string().optional().default(""),
    color: z.string().default("#1a5c58"),
    isAdmin: z.boolean().default(false),
    userRole: z.enum(["admin", "therapist", "guest"]).default("therapist"),
    password: z.string().optional().default(""),
    confirmPassword: z.string().optional().default(""),
  })
  .superRefine((d, ctx) => {
    // Non-guest accounts require a valid email
    if (d.userRole !== "guest") {
      if (!d.email || !d.email.includes("@")) {
        ctx.addIssue({ code: "custom", path: ["email"], message: "Email no válido" });
      }
    }
    // Non-guest accounts require a password of at least 8 chars
    if (d.userRole !== "guest") {
      if (!d.password || d.password.length < 8) {
        ctx.addIssue({ code: "custom", path: ["password"], message: "Mínimo 8 caracteres" });
      }
      if (d.password !== d.confirmPassword) {
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Las contraseñas no coinciden" });
      }
    }
  });
export type ProfessionalCreateInput = z.infer<typeof professionalCreateSchema>;

export const professionalUpdateSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  email: z.string().email("Email no válido"),
  role: z.enum(PROFESSIONAL_ROLES),
  numColegiado: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  color: z.string().default("#1a5c58"),
  isActive: z.boolean().default(true),
  isAdmin: z.boolean().default(false),
  userRole: z.enum(["admin", "therapist", "guest"]).default("therapist"),
});
export type ProfessionalUpdateInput = z.infer<typeof professionalUpdateSchema>;

// ─── Patient ─────────────────────────────────────────────────────────────────

export const patientCreateSchema = z.object({
  firstName: z.string().min(2, "El nombre es obligatorio"),
  lastName: z.string().min(2, "Los apellidos son obligatorios"),
  birthDate: z.string().min(1, "La fecha de nacimiento es obligatoria"),
  specialty: z.enum(SPECIALTIES),
  status: z.enum(PATIENT_STATUSES).default("Activo"),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  diagnosis: z.string().optional().default(""),
  objective: z.string().optional().default(""),
  alerts: z.array(z.string().min(1).max(60)).default([]),
  startDate: z.string().min(1, "La fecha de inicio es obligatoria"),
  referentName: z.string().optional().default(""),
  referentPhone: z.string().optional().default(""),
  therapistIds: z.array(z.string()).default([]),
});
export type PatientCreateInput = z.infer<typeof patientCreateSchema>;

// ─── Visit ───────────────────────────────────────────────────────────────────

export const visitCreateSchema = z.object({
  patientId: z.string().min(1, "Paciente obligatorio"),
  therapistId: z.string().min(1, "Terapeuta obligatorio"),
  date: z.string().min(1, "La fecha es obligatoria"),
  time: z.string().min(1, "La hora es obligatoria"),
  durationMin: z.coerce.number().int().min(15).max(240).default(60),
  title: z.string().min(1, "El título es obligatorio"),
  notes: z.string().min(1, "Las notas clínicas son obligatorias"),
  interventions: z.array(z.string()).default([]),
  goalIds: z.array(z.string()).default([]),
  tasks: z.array(z.object({ id: z.string(), text: z.string(), completed: z.boolean() })).default([]),
});
export type VisitCreateInput = z.infer<typeof visitCreateSchema>;

export const visitUpdateSchema = z.object({
  therapistId: z.string().min(1, "Terapeuta obligatorio"),
  date: z.string().min(1, "La fecha es obligatoria"),
  time: z.string().min(1, "La hora es obligatoria"),
  durationMin: z.coerce.number().int().min(15).max(240).default(60),
  title: z.string().min(1, "El título es obligatorio"),
  notes: z.string().min(1, "Las notas clínicas son obligatorias"),
  interventions: z.array(z.string()).default([]),
  goalIds: z.array(z.string()).default([]),
  tasks: z.array(z.object({ id: z.string(), text: z.string(), completed: z.boolean() })).default([]),
});
export type VisitUpdateInput = z.infer<typeof visitUpdateSchema>;

// ─── Assessment ──────────────────────────────────────────────────────────────

export const assessmentCreateSchema = z.object({
  patientId: z.string().min(1, "Paciente obligatorio"),
  therapistId: z.string().min(1, "Terapeuta obligatorio"),
  scale: z.enum(ASSESSMENT_SCALES),
  score: z.string().min(1, "La puntuación es obligatoria"),
  // Only present for structured scales (Barthel, Lawton-Brody, VAVDI, COPM):
  // a map of item id -> score for that item, used to recompute the total
  // and let the report show the per-item breakdown later if needed.
  itemScores: z.record(z.string(), z.number()).optional(),
  // For COPM: stores problem descriptions; for Barthel/VAVDI: strengths/areas.
  areaSummary: z.any().optional(),
  notes: z.string().optional().default(""),
  date: z.string().min(1, "La fecha es obligatoria"),
});
export type AssessmentCreateInput = z.infer<typeof assessmentCreateSchema>;

// Editing an existing assessment never changes which patient/therapist it
// belongs to — only the scale's answers, date or notes.
export const assessmentUpdateSchema = z.object({
  scale: z.enum(ASSESSMENT_SCALES),
  score: z.string().min(1, "La puntuación es obligatoria"),
  itemScores: z.record(z.string(), z.number()).optional(),
  areaSummary: z.any().optional(),
  notes: z.string().optional().default(""),
  date: z.string().min(1, "La fecha es obligatoria"),
});
export type AssessmentUpdateInput = z.infer<typeof assessmentUpdateSchema>;

// ─── Appointment ─────────────────────────────────────────────────────────────

// Computes minutes between two "HH:mm" strings on the same day. Used by the
// schemas below so the person only ever types a start and an end time —
// duration is always derived, never typed in directly.
function diffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export const appointmentCreateSchema = z
  .object({
    patientId: z.string().min(1, "Paciente obligatorio"),
    therapistId: z.string().min(1, "Terapeuta obligatorio"),
    date: z.string().min(1, "La fecha es obligatoria"),
    time: z.string().min(1, "La hora de inicio es obligatoria"),
    endTime: z.string().min(1, "La hora de fin es obligatoria"),
    type: z.enum(APPOINTMENT_TYPES).default("Sesión"),
    notes: z.string().optional().default(""),
  })
  .refine((d) => diffMinutes(d.time, d.endTime) >= 15, {
    message: "La hora de fin debe ser al menos 15 minutos después del inicio",
    path: ["endTime"],
  })
  .transform((d) => ({ ...d, durationMin: diffMinutes(d.time, d.endTime) }));
export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;

export const appointmentMoveSchema = z.object({
  id: z.string(),
  start: z.string(), // ISO datetime
  durationMin: z.coerce.number().int().min(15).max(480).optional(),
});
export type AppointmentMoveInput = z.infer<typeof appointmentMoveSchema>;

export const appointmentStatusUpdateSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
});
export type AppointmentStatusUpdateInput = z.infer<typeof appointmentStatusUpdateSchema>;

export const appointmentUpdateSchema = z
  .object({
    patientId: z.string().min(1, "Paciente obligatorio"),
    therapistId: z.string().min(1, "Terapeuta obligatorio"),
    date: z.string().min(1, "La fecha es obligatoria"),
    time: z.string().min(1, "La hora de inicio es obligatoria"),
    endTime: z.string().min(1, "La hora de fin es obligatoria"),
    type: z.enum(APPOINTMENT_TYPES).default("Sesión"),
    notes: z.string().optional().default(""),
  })
  .refine((d) => diffMinutes(d.time, d.endTime) >= 15, {
    message: "La hora de fin debe ser al menos 15 minutos después del inicio",
    path: ["endTime"],
  })
  .transform((d) => ({ ...d, durationMin: diffMinutes(d.time, d.endTime) }));
export type AppointmentUpdateInput = z.infer<typeof appointmentUpdateSchema>;

export const slotReservationCreateSchema = z
  .object({
    therapistId: z.string().min(1, "Terapeuta obligatorio"),
    categoryId: z.string().optional(),
    title: z.string().min(1, "El título es obligatorio"),
    date: z.string().min(1, "La fecha es obligatoria"),
    time: z.string().min(1, "La hora de inicio es obligatoria"),
    endTime: z.string().min(1, "La hora de fin es obligatoria"),
  })
  .refine((d) => diffMinutes(d.time, d.endTime) >= 15, {
    message: "La hora de fin debe ser al menos 15 minutos después del inicio",
    path: ["endTime"],
  })
  .transform((d) => ({ ...d, durationMin: diffMinutes(d.time, d.endTime) }));
export type SlotReservationCreateInput = z.infer<typeof slotReservationCreateSchema>;

export const slotReservationUpdateSchema = z
  .object({
    therapistId: z.string().min(1, "Terapeuta obligatorio"),
    categoryId: z.string().optional(),
    title: z.string().min(1, "El título es obligatorio"),
    date: z.string().min(1, "La fecha es obligatoria"),
    time: z.string().min(1, "La hora de inicio es obligatoria"),
    endTime: z.string().min(1, "La hora de fin es obligatoria"),
  })
  .refine((d) => diffMinutes(d.time, d.endTime) >= 15, {
    message: "La hora de fin debe ser al menos 15 minutos después del inicio",
    path: ["endTime"],
  })
  .transform((d) => ({ ...d, durationMin: diffMinutes(d.time, d.endTime) }));
export type SlotReservationUpdateInput = z.infer<typeof slotReservationUpdateSchema>;

export const slotReservationMoveSchema = z.object({
  id: z.string(),
  start: z.string(), // ISO datetime
  durationMin: z.coerce.number().int().min(15).max(480).optional(),
});
export type SlotReservationMoveInput = z.infer<typeof slotReservationMoveSchema>;

// ─── Reservation categories (per-professional labels with a color, used to
// tag slot reservations as e.g. "Trabajo", "Personal", "Vacaciones") ────────

export const reservationCategoryCreateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(40, "Máximo 40 caracteres"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
});
export type ReservationCategoryCreateInput = z.infer<typeof reservationCategoryCreateSchema>;

export const reservationCategoryUpdateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(40, "Máximo 40 caracteres"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
});
export type ReservationCategoryUpdateInput = z.infer<typeof reservationCategoryUpdateSchema>;
