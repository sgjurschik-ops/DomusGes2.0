"use client";

import { useMemo } from "react";
import { usePatients, useVisits } from "@/hooks/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { SpecialtyBadge } from "@/components/domain";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Activity, Users, TrendingUp, BarChart3, PieChart as PieIcon, Trophy,
} from "lucide-react";
import type { PatientStatus, Specialty } from "@/types/domain";

const SPECIALTY_COLORS: Record<Specialty, string> = {
  "Fisioterapia": "#1a5c58",
  "Psicología": "#5b3fa0",
  "T. Ocupacional": "#c17f3a",
};
const STATUS_COLORS: Record<PatientStatus, string> = {
  "Activo": "#10b981",
  "En seguimiento": "#0ea5e9",
  "Alta": "#71717a",
  "Pausado": "#f59e0b",
};

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function ReportsView() {
  const { data: patients, isLoading: loadingPatients } = usePatients();
  const { data: visits, isLoading: loadingVisits } = useVisits();

  const isLoading = loadingPatients || loadingVisits;

  const derived = useMemo(() => {
    const now = Date.now();
    const cutoff = now - NINETY_DAYS_MS;
    const patientSpecialty = new Map<string, Specialty>();
    (patients ?? []).forEach((p) => patientSpecialty.set(p.id, p.specialty));

    const visits90 = (visits ?? []).filter((v) => {
      const t = new Date(v.date).getTime();
      return !Number.isNaN(t) && t >= cutoff && t <= now;
    });

    // Visits by specialty (last 90 days)
    const bySpecialtyMap = new Map<Specialty, number>();
    visits90.forEach((v) => {
      const sp = patientSpecialty.get(v.patientId);
      if (!sp) return;
      bySpecialtyMap.set(sp, (bySpecialtyMap.get(sp) ?? 0) + 1);
    });
    const bySpecialty = (Object.keys(SPECIALTY_COLORS) as Specialty[]).map((s) => ({
      label: s,
      value: bySpecialtyMap.get(s) ?? 0,
    }));

    // Patients by status
    const byStatusMap = new Map<PatientStatus, number>();
    (patients ?? []).forEach((p) => {
      byStatusMap.set(p.status, (byStatusMap.get(p.status) ?? 0) + 1);
    });
    const byStatus = (Object.keys(STATUS_COLORS) as PatientStatus[])
      .map((s) => ({ label: s, value: byStatusMap.get(s) ?? 0 }))
      .filter((s) => s.value > 0);

    // Patients with activity in the period (for average)
    const patientsWithVisits90 = new Set(visits90.map((v) => v.patientId)).size;
    const activePatients = (patients ?? []).filter((p) => p.status === "Activo").length;
    const avgVisits = patientsWithVisits90 > 0
      ? visits90.length / patientsWithVisits90
      : 0;

    // Top 10 patients by totalVisits (all-time)
    const top = [...(patients ?? [])]
      .sort((a, b) => b.totalVisits - a.totalVisits)
      .slice(0, 10);

    return {
      activePatients,
      visits90: visits90.length,
      avgVisits,
      bySpecialty,
      byStatus,
      top,
    };
  }, [patients, visits]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Informes clínicos</h2>
        <p className="text-sm text-muted-foreground">
          Visión agregada de actividad asistencial (últimos 90 días).
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <KpiCard
          label="Pacientes activos"
          icon={Users}
          value={isLoading ? null : derived.activePatients}
          hint="Total en seguimiento activo"
        />
        <KpiCard
          label="Visitas (90 días)"
          icon={Activity}
          value={isLoading ? null : derived.visits90}
          hint="Sesiones registradas"
        />
        <KpiCard
          label="Media visitas / paciente"
          icon={TrendingUp}
          value={isLoading ? null : derived.avgVisits.toFixed(1)}
          hint="Sobre pacientes con actividad"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Visitas por especialidad
            </CardTitle>
            <CardDescription className="text-xs">Últimos 90 días</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : derived.bySpecialty.every((s) => s.value === 0) ? (
              <EmptyChart label="No hay visitas en los últimos 90 días" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={derived.bySpecialty}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    formatter={(v: number | string) => [`${v} visitas`, "Visitas"]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {derived.bySpecialty.map((s) => (
                      <Cell key={s.label} fill={SPECIALTY_COLORS[s.label]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-primary" />
              Pacientes por estado
            </CardTitle>
            <CardDescription className="text-xs">Distribución actual</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : derived.byStatus.length === 0 ? (
              <EmptyChart label="No hay pacientes registrados" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={derived.byStatus}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {derived.byStatus.map((s) => (
                      <Cell key={s.label} fill={STATUS_COLORS[s.label]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | string, n: string) => [`${v} pacientes`, n]} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top patients table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            Top 10 pacientes por número de visitas
          </CardTitle>
          <CardDescription className="text-xs">
            Histórico acumulado por paciente
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : derived.top.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Sin pacientes</p>
              <p className="text-xs text-muted-foreground">
                Aún no hay pacientes para mostrar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-right">#</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead className="text-right">Visitas</TableHead>
                  <TableHead>Última visita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {derived.top.map((p, i) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{p.fullName}</TableCell>
                    <TableCell><SpecialtyBadge specialty={p.specialty} /></TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {p.totalVisits}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.lastVisitDate
                        ? format(new Date(p.lastVisitDate), "dd MMM yyyy", { locale: es })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number | string | null;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </p>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        {value === null ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-3xl font-bold text-foreground tabular-nums">{value}</p>
        )}
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-center">
      <BarChart3 className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
