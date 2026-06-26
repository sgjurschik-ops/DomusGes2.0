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
  "EVN",
  "PHQ-9",
  "GAD-7",
  "Mini-Mental",
  "FIM",
] as const;

// Scales with a structured, item-by-item form (score is computed, not
// typed in by hand). Any scale not in this list keeps the free-text score
// field as before.
export const STRUCTURED_SCALES = ["Barthel", "Lawton-Brody", "VAVDI"] as const;
export type StructuredScale = (typeof STRUCTURED_SCALES)[number];

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

// ─── Professional ────────────────────────────────────────────────────────────

export const professionalCreateSchema = z
  .object({
    name: z.string().min(2, "El nombre es obligatorio"),
    email: z.string().email("Email no válido"),
    role: z.enum(PROFESSIONAL_ROLES, { error: "Rol no válido" }),
    numColegiado: z.string().optional().default(""),
    phone: z.string().optional().default(""),
    color: z.string().default("#1a5c58"),
    isAdmin: z.boolean().default(false),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
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
  durationMin: z.coerce.number().int().min(15).max(240).default(45),
  notes: z.string().min(1, "Las notas clínicas son obligatorias"),
  interventions: z.array(z.string()).default([]),
});
export type VisitCreateInput = z.infer<typeof visitCreateSchema>;

export const visitUpdateSchema = z.object({
  therapistId: z.string().min(1, "Terapeuta obligatorio"),
  date: z.string().min(1, "La fecha es obligatoria"),
  time: z.string().min(1, "La hora es obligatoria"),
  durationMin: z.coerce.number().int().min(15).max(240).default(45),
  notes: z.string().min(1, "Las notas clínicas son obligatorias"),
  interventions: z.array(z.string()).default([]),
});
export type VisitUpdateInput = z.infer<typeof visitUpdateSchema>;

// ─── Assessment ──────────────────────────────────────────────────────────────

export const assessmentCreateSchema = z.object({
  patientId: z.string().min(1, "Paciente obligatorio"),
  therapistId: z.string().min(1, "Terapeuta obligatorio"),
  scale: z.enum(ASSESSMENT_SCALES),
  score: z.string().min(1, "La puntuación es obligatoria"),
  // Only present for structured scales (Barthel, Lawton-Brody, VAVDI): a
  // map of item id -> score for that item, used to recompute the total
  // and let the report show the per-item breakdown later if needed.
  itemScores: z.record(z.string(), z.number()).optional(),
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
  notes: z.string().optional().default(""),
  date: z.string().min(1, "La fecha es obligatoria"),
});
export type AssessmentUpdateInput = z.infer<typeof assessmentUpdateSchema>;

// ─── Appointment ─────────────────────────────────────────────────────────────

export const appointmentCreateSchema = z.object({
  patientId: z.string().min(1, "Paciente obligatorio"),
  therapistId: z.string().min(1, "Terapeuta obligatorio"),
  date: z.string().min(1, "La fecha es obligatoria"),
  time: z.string().min(1, "La hora es obligatoria"),
  durationMin: z.coerce.number().int().min(15).max(240).default(45),
  type: z.enum(APPOINTMENT_TYPES).default("Sesión"),
  notes: z.string().optional().default(""),
});
export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;

export const appointmentMoveSchema = z.object({
  id: z.string(),
  start: z.string(), // ISO datetime
});
export type AppointmentMoveInput = z.infer<typeof appointmentMoveSchema>;
