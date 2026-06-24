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

// ─── Patients ────────────────────────────────────────────────────────────────

import type { PatientDTO, VisitDTO, AssessmentDTO, AppointmentDTO, ProfessionalDTO, AuditLogDTO } from "@/types/domain";
import type {
  PatientCreateInput, VisitCreateInput, AssessmentCreateInput,
  AppointmentCreateInput, ProfessionalCreateInput, ProfessionalUpdateInput,
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
    mutationFn: ({ id, start }: { id: string; start: string }) =>
      fetcher<AppointmentDTO>(`/api/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ id, start }),
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
