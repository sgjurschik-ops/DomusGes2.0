// Fetcher + TanStack Query hooks for all server state.
// Centralizes auth handling and error normalization.

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession, signOut } from "next-auth/react";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function fetcher<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    // session expired
    signOut({ redirect: false });
    throw new ApiError(401, null);
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export function useCurrentSession() {
  const { data, status, ...rest } = useSession();
  return {
    status,
    session: data,
    user: data?.user,
    isLoading: status === "loading",
  };
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordInput) =>
      fetcher<{ ok: true }>("/api/me/password", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  });
}

// ─── Patients ────────────────────────────────────────────────────────────────

import type { PatientDTO, VisitDTO, AssessmentDTO, AppointmentDTO, AppointmentStatus, SlotReservationDTO, ReservationCategoryDTO, ProfessionalDTO, AuditLogDTO } from "@/types/domain";
import type {
  PatientCreateInput, VisitCreateInput, VisitUpdateInput, AssessmentCreateInput, AssessmentUpdateInput,
  AppointmentCreateInput, SlotReservationCreateInput, SlotReservationUpdateInput, AppointmentUpdateInput, ProfessionalCreateInput, ProfessionalUpdateInput,
  ReservationCategoryCreateInput, ReservationCategoryUpdateInput, ChangePasswordInput,
} from "@/lib/schemas";

export const patientKeys = {
  all: ["patients"] as const,
  detail: (id: string) => ["patients", id] as const,
};

export function usePatients() {
  return useQuery<PatientDTO[]>({
    queryKey: patientKeys.all,
    queryFn: () => fetcher("/api/patients"),
  });
}

export function usePatient(id: string | null) {
  return useQuery<PatientDTO>({
    queryKey: id ? patientKeys.detail(id) : ["patients", "null"],
    queryFn: () => fetcher(`/api/patients/${id}`),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PatientCreateInput) =>
      fetcher<PatientDTO>("/api/patients", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: patientKeys.all }),
  });
}

export function useUpdatePatient() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PatientCreateInput> }) =>
      fetcher<PatientDTO>(`/api/patients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patientKeys.all });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
// ─── Visits ──────────────────────────────────────────────────────────────────

export function useVisits(patientId?: string) {
  return useQuery<VisitDTO[]>({
    queryKey: ["visits", patientId ?? "all"],
    queryFn: () => fetcher(`/api/visits${patientId ? `?patientId=${patientId}` : ""}`),
  });
}

export function useCreateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: VisitCreateInput) =>
      fetcher<VisitDTO>("/api/visits", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      if (vars.patientId) qc.invalidateQueries({ queryKey: patientKeys.detail(vars.patientId) });
    },
  });
}

export function useVisit(id: string | null) {
  return useQuery<VisitDTO>({
    queryKey: ["visits", "detail", id],
    queryFn: () => fetcher(`/api/visits/${id}`),
    enabled: !!id,
  });
}

export function useUpdateVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: VisitUpdateInput }) =>
      fetcher<VisitDTO>(`/api/visits/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: patientKeys.detail(d.patientId) });
    },
  });
}

export function useDeleteVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; patientId: string }) =>
      fetcher(`/api/visits/${id}`, { method: "DELETE" }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: patientKeys.detail(vars.patientId) });
    },
  });
}

// ─── Assessments ─────────────────────────────────────────────────────────────

export function useAssessments(patientId?: string) {
  return useQuery<AssessmentDTO[]>({
    queryKey: ["assessments", patientId ?? "all"],
    queryFn: () => fetcher(`/api/assessments${patientId ? `?patientId=${patientId}` : ""}`),
  });
}

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AssessmentCreateInput) =>
      fetcher<AssessmentDTO>("/api/assessments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["assessments"] });
      if (vars.patientId) qc.invalidateQueries({ queryKey: patientKeys.detail(vars.patientId) });
    },
  });
}

export function useAssessment(id: string | null) {
  return useQuery<AssessmentDTO>({
    queryKey: ["assessments", "detail", id],
    queryFn: () => fetcher(`/api/assessments/${id}`),
    enabled: !!id,
  });
}

export function useUpdateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssessmentUpdateInput }) =>
      fetcher<AssessmentDTO>(`/api/assessments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["assessments"] });
      qc.invalidateQueries({ queryKey: patientKeys.detail(d.patientId) });
    },
  });
}

export function useDeleteAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; patientId: string }) =>
      fetcher(`/api/assessments/${id}`, { method: "DELETE" }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["assessments"] });
      qc.invalidateQueries({ queryKey: patientKeys.detail(vars.patientId) });
    },
  });
}

// ─── Appointments ────────────────────────────────────────────────────────────

export function useAppointments(params?: { from?: string; to?: string; therapistId?: string }) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.therapistId) qs.set("therapistId", params.therapistId);
  const str = qs.toString();
  return useQuery<AppointmentDTO[]>({
    queryKey: ["appointments", params ?? {}],
    queryFn: () => fetcher(`/api/appointments${str ? `?${str}` : ""}`),
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AppointmentCreateInput) =>
      fetcher<AppointmentDTO>("/api/appointments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useMoveAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, start, durationMin }: { id: string; start: string; durationMin?: number }) =>
      fetcher<AppointmentDTO>(`/api/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ id, start, durationMin }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AppointmentUpdateInput }) =>
      fetcher<AppointmentDTO>(`/api/appointments/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      fetcher<AppointmentDTO>(`/api/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetcher(`/api/appointments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });
}

// ─── Slot reservations (blocked time, no patient) ─────────────────────────────

export function useReservations(params?: { from?: string; to?: string; therapistId?: string }) {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.therapistId) qs.set("therapistId", params.therapistId);
  const str = qs.toString();
  return useQuery<SlotReservationDTO[]>({
    queryKey: ["reservations", params ?? {}],
    queryFn: () => fetcher(`/api/reservations${str ? `?${str}` : ""}`),
  });
}

export function useCreateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SlotReservationCreateInput) =>
      fetcher<SlotReservationDTO>("/api/reservations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

export function useMoveReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, start, durationMin }: { id: string; start: string; durationMin?: number }) =>
      fetcher<SlotReservationDTO>(`/api/reservations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ id, start, durationMin }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

export function useUpdateReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SlotReservationUpdateInput }) =>
      fetcher<SlotReservationDTO>(`/api/reservations/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

export function useDeleteReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetcher(`/api/reservations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });
}

// ─── Reservation categories (personal, per-professional) ──────────────────────

export function useReservationCategories() {
  return useQuery<ReservationCategoryDTO[]>({
    queryKey: ["reservation-categories"],
    queryFn: () => fetcher("/api/reservation-categories"),
  });
}

export function useCreateReservationCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ReservationCategoryCreateInput) =>
      fetcher<ReservationCategoryDTO>("/api/reservation-categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservation-categories"] }),
  });
}

export function useUpdateReservationCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReservationCategoryUpdateInput }) =>
      fetcher<ReservationCategoryDTO>(`/api/reservation-categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservation-categories"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
    },
  });
}

export function useDeleteReservationCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetcher(`/api/reservation-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservation-categories"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
    },
  });
}

// ─── Professionals ───────────────────────────────────────────────────────────

export function useProfessionals() {
  return useQuery<ProfessionalDTO[]>({
    queryKey: ["professionals"],
    queryFn: () => fetcher("/api/professionals"),
  });
}

export function useCreateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfessionalCreateInput) =>
      fetcher<ProfessionalDTO>("/api/professionals", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["professionals"] }),
  });
}

export function useUpdateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProfessionalUpdateInput }) =>
      fetcher<ProfessionalDTO>(`/api/professionals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["professionals"] }),
  });
}

export function useResetProfessionalPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      fetcher(`/api/professionals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["professionals"] }),
  });
}

export function useDeleteProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetcher(`/api/professionals/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["professionals"] }),
  });
}
export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetcher(`/api/patients/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ─── Weekly routine records ───────────────────────────────────────────────────

export interface RoutineRecordSummary {
  id: string;
  date: string; // yyyy-mm-dd
  notes: string | null;
  createdAt: string;
}

export function useRoutineRecords(patientId: string) {
  return useQuery<RoutineRecordSummary[]>({
    queryKey: ["routine-records", patientId],
    queryFn: () => fetcher(`/api/patients/${patientId}/routine-records`),
    enabled: !!patientId,
  });
}

export function useRoutineRecord(patientId: string, recordId: string | null) {
  return useQuery<{ id: string; date: string; cells: string; notes: string | null }>({
    queryKey: ["routine-record", patientId, recordId],
    queryFn: () => fetcher(`/api/patients/${patientId}/routine-records/${recordId}`),
    enabled: !!patientId && !!recordId,
  });
}

export function useSaveRoutineRecord(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; cells: string; notes?: string }) =>
      fetcher(`/api/patients/${patientId}/routine-records`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routine-records", patientId] });
    },
  });
}

export function useDeleteRoutineRecord(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) =>
      fetcher(`/api/patients/${patientId}/routine-records/${recordId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routine-records", patientId] });
    },
  });
}

// ─── Audit log (admin) ───────────────────────────────────────────────────────

export function useAuditLog(limit = 100) {
  return useQuery<AuditLogDTO[]>({
    queryKey: ["audit", limit],
    queryFn: () => fetcher(`/api/audit?limit=${limit}`),
  });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardData {
  professional: { id: string; name: string; role: string; isAdmin: boolean };
  totals: {
    patients: number;
    activePatients: number;
    todayAppointments: number;
    weekAppointments: number;
    recentVisits: number;
  };
  bySpecialty: { label: string; value: number }[];
  byStatus: { label: string; value: number }[];
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => fetcher("/api/dashboard"),
  });
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export interface BillingData {
  period: { year: number; month: number };
  total: number;
  count: number;
  byTherapist: { name: string; count: number; amount: number }[];
  lines: {
    id: string;
    date: string;
    patientName: string;
    specialty: string;
    therapistName: string;
    type: string;
    amount: number;
    durationMin: number;
  }[];
}

export function useBilling(year?: number, month?: number) {
  const qs = new URLSearchParams();
  if (year) qs.set("year", String(year));
  if (month) qs.set("month", String(month));
  return useQuery<BillingData>({
    queryKey: ["billing", year, month],
    queryFn: () => fetcher(`/api/billing?${qs.toString()}`),
  });
}
