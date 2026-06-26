"use client";

import { useDashboard, useAppointments } from "@/hooks/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, formatRelative, SpecialtyBadge, StatusBadge } from "@/components/domain";
import { useCurrentSession } from "@/hooks/api";
import { useNav } from "@/store/nav";
import { Users, CalendarDays, MapPin, Activity, ChevronRight, TrendingUp } from "lucide-react";
import Link from "next/link";

export function DashboardView() {
  const { data, isLoading } = useDashboard();
  const { user } = useCurrentSession();
  const { navigate } = useNav();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const { data: todaysAppts } = useAppointments({
    from: startOfDay.toISOString(),
    to: endOfDay.toISOString(),
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
  })();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          {greeting}, {user?.name?.split(" ")[0] ?? ""}.
        </h2>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("es-ES", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Pacientes activos"
          value={isLoading ? null : data?.totals.activePatients ?? null}
          total={isLoading ? null : data?.totals.patients ?? null}
          icon={Users}
          onClick={() => navigate("patients")}
        />
        <KpiCard
          label="Citas hoy"
          value={isLoading ? null : data?.totals.todayAppointments ?? null}
          icon={MapPin}
          onClick={() => navigate("today")}
        />
        <KpiCard
          label="Citas esta semana"
          value={isLoading ? null : data?.totals.weekAppointments ?? null}
          icon={CalendarDays}
          onClick={() => navigate("calendar")}
        />
        <KpiCard
          label="Seguimientos últimos 30 días"
          value={isLoading ? null : data?.totals.recentVisits ?? null}
          icon={Activity}
          onClick={() => navigate("reports")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's appointments */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Próximas citas</CardTitle>
            <button
              className="text-xs text-primary hover:underline flex items-center"
              onClick={() => navigate("calendar")}
            >
              Ver agenda <ChevronRight className="w-3 h-3" />
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {!todaysAppts ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : todaysAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">
                No hay citas programadas para hoy.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {todaysAppts.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => {
                        useNav.getState().selectPatient(a.patientId);
                        navigate("patient-detail");
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left transition-colors"
                    >
                      <div className="text-sm font-mono font-medium text-foreground shrink-0 w-14">
                        {new Date(a.start).toLocaleTimeString("es-ES", {
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                      <Avatar name={a.patientName} color={a.patientColor} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.patientName}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.patientAddress ?? "Sin dirección"}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{a.type}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Distribution by specialty */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Por especialidad
            </CardTitle>
            <CardDescription className="text-xs">Distribución de pacientes</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ul className="space-y-3">
                {data.bySpecialty.map((s) => {
                  const total = data.totals.patients || 1;
                  const pct = Math.round((s.value / total) * 100);
                  return (
                    <li key={s.label}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <SpecialtyBadge specialty={s.label as any} />
                        <span className="text-muted-foreground">
                          {s.value} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Estado de pacientes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="flex flex-wrap gap-4">
              {data.byStatus.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <StatusBadge status={s.label as any} />
                  <span className="text-sm font-semibold">{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  total,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: number | null;
  total?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex items-baseline gap-1.5">
          {value === null ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            <p className="text-3xl font-bold text-foreground">{value}</p>
          )}
          {total !== undefined && total !== null && (
            <span className="text-xs text-muted-foreground">/ {total}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
