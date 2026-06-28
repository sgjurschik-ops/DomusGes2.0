// Centralized domain types for DomusGes
// These mirror Prisma models but are decoupled so the API can evolve
// without forcing every consumer to import @prisma/client.

export type Specialty = "Fisioterapia" | "Psicología" | "T. Ocupacional";
export type PatientStatus = "Activo" | "En seguimiento" | "Alta" | "Pausado";

export type ProfessionalRole =
  | "Fisioterapeuta"
  | "Terapeuta Ocupacional"
  | "Psicólogo/a Clínico/a"
  | "Enfermero/a"
  | "Médico/a"
  | "Trabajador/a Social"
  | "Logopeda"
  | "Auxiliar de Enfermería"
  | "TCAE"
  | "Administrador"
  | "Otro";

export type AppointmentType = "Sesión" | "Valoración" | "Seguimiento" | "Coordinación";
export type AppointmentStatus = "programada" | "completada" | "cancelada" | "no_show";

export type AssessmentScale =
  | "EVN" // Escala Visual Numérica (dolor)
  | "Barthel" // AVD básicas
  | "Lawton-Brody" // AVD instrumentales
  | "VAVDI" // AVD básicas + instrumentales, nivel de apoyo
  | "PHQ-9" // Depresión
  | "GAD-7" // Ansiedad
  | "Mini-Mental" // Estado cognitivo
  | "FIM"; // Independencia funcional

// View identifiers for client-side navigation.
// The app is a single / route; views are switched via Zustand store.
export type View =
  | "dashboard"
  | "patients"
  | "patient-detail"
  | "new-visit"
  | "new-patient"
  | "edit-patient"
  | "equipo"
  | "calendar"
  | "reports"
  | "settings"
  | "today"
  | "admin-users"
  | "facturacion";

// ─── API DTOs (no DB internals) ──────────────────────────────────────────────

export interface ProfessionalDTO {
  id: string;
  email: string;
  name: string;
  role: string;
  numColegiado: string | null;
  phone: string | null;
  isActive: boolean;
  isAdmin: boolean;
  color: string;
  joinedAt: string; // ISO
}

export interface PatientDTO {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string; // ISO date
  age: number;
  specialty: Specialty;
  status: PatientStatus;
  phone: string | null;
  address: string | null;
  diagnosis: string | null;
  objective: string | null;
  alerts: string[];
  startDate: string; // ISO
  referentName: string | null;
  referentPhone: string | null;
  color: string;
  therapistIds: string[];
  therapistNames: string[];
  totalVisits: number;
  lastVisitDate: string | null;
  nextAppointmentDate: string | null;
}

export interface VisitDTO {
  id: string;
  patientId: string;
  patientName: string;
  therapistId: string;
  therapistName: string;
  date: string; // ISO
  durationMin: number;
  title: string | null; // Null for visits created before this field existed
  notes: string;
  interventions: string[];
  score: number | null;
  createdAt: string;
}

export interface AreaSummaryBlock {
  title: string;
  strengths: string[];
  toWork: string[];
}
export interface AreaSummaryData {
  blocks: AreaSummaryBlock[];
}

export interface AssessmentDTO {
  id: string;
  patientId: string;
  patientName: string;
  therapistId: string;
  therapistName: string;
  scale: AssessmentScale;
  score: string;
  itemScores: Record<string, number> | null;
  areaSummary: AreaSummaryData | null;
  notes: string | null;
  date: string;
}

export interface AppointmentDTO {
  id: string;
  patientId: string;
  patientName: string;
  patientColor: string;
  patientAddress: string | null;
  therapistId: string;
  therapistName: string;
  start: string; // ISO
  durationMin: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes: string | null;
}

export interface SlotReservationDTO {
  id: string;
  therapistId: string;
  therapistName: string;
  therapistColor: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  title: string;
  start: string; // ISO
  durationMin: number;
}

export interface ReservationCategoryDTO {
  id: string;
  professionalId: string;
  name: string;
  color: string;
}

export interface AuditLogDTO {
  id: string;
  professionalId: string | null;
  professionalName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}
