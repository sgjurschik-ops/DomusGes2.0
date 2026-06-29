"use client";

import { useState, useMemo } from "react";
import { usePatients } from "@/hooks/api";
import { useNav } from "@/store/nav";
import { useCurrentSession } from "@/hooks/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, SpecialtyBadge, StatusBadge, formatRelative } from "@/components/domain";
import { Search, Plus, Users, AlertTriangle } from "lucide-react";
import type { Specialty, PatientStatus, PatientDTO } from "@/types/domain";

const SPECIALTY_FILTERS: ("Todas" | Specialty)[] = ["Todas", "Fisioterapia", "Psicología", "T. Ocupacional"];
const STATUS_FILTERS: ("Todos" | PatientStatus)[] = ["Todos", "Activo", "En seguimiento", "Alta", "Pausado"];

type SortKey = "name" | "age" | "lastVisit" | "nextAppt";
const SORT_LABELS: Record<SortKey, string> = {
  name: "Nombre",
  age: "Edad",
  lastVisit: "Última visita",
  nextAppt: "Próxima cita",
};

// null/missing dates always sort to the end regardless of direction, so
// "sin cita" or "sin visitas" patients don't jump to the top when sorting
// descending by date.
function compareDatesWithNullsLast(a: string | null, b: string | null, dir: 1 | -1): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return (new Date(a).getTime() - new Date(b).getTime()) * dir;
}

function sortPatients(patients: PatientDTO[], sortKey: SortKey, dir: 1 | -1): PatientDTO[] {
  const sorted = [...patients];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "name":
        return a.fullName.localeCompare(b.fullName, "es") * dir;
      case "age":
        return (a.age - b.age) * dir;
      case "lastVisit":
        return compareDatesWithNullsLast(a.lastVisitDate, b.lastVisitDate, dir);
      case "nextAppt":
        return compareDatesWithNullsLast(a.nextAppointmentDate, b.nextAppointmentDate, dir);
    }
  });
  return sorted;
}

// A patient hasn't been seen in a while — flagged in amber in the "última
// visita" column so it stands out without needing a separate alert.
const STALE_VISIT_DAYS = 45;
function isStaleVisit(iso: string | null): boolean {
  if (!iso) return false;
  const diffDays = (Date.now() - new Date(iso).getTime()) / 86400000;
  return diffDays > STALE_VISIT_DAYS;
}

export function PatientsListView() {
  const { data: patients, isLoading } = usePatients();
  const { user } = useCurrentSession();
  const { navigate, selectPatient } = useNav();
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState<"Todas" | Specialty>("Todas");
  const [status, setStatus] = useState<"Todos" | PatientStatus>("Todos");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const filtered = useMemo(() => {
    if (!patients) return [];
    const term = q.trim().toLowerCase();
    const base = patients.filter((p) => {
      if (specialty !== "Todas" && p.specialty !== specialty) return false;
      if (status !== "Todos" && p.status !== status) return false;
      if (term && !p.fullName.toLowerCase().includes(term) && !p.diagnosis?.toLowerCase().includes(term)) return false;
      return true;
    });
    return sortPatients(base, sortKey, sortDir);
  }, [patients, q, specialty, status, sortKey, sortDir]);

  function openPatient(id: string) {
    selectPatient(id);
    navigate("patient-detail");
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o diagnóstico…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Buscar pacientes"
          />
        </div>
        <Select value={specialty} onValueChange={(v) => setSpecialty(v as typeof specialty)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por especialidad">
            <SelectValue placeholder="Especialidad" />
          </SelectTrigger>
          <SelectContent>
            {SPECIALTY_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortKey}
          onValueChange={(v) => setSortKey(v as SortKey)}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Ordenar por">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>Ordenar por: {SORT_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortDir((d) => (d === 1 ? -1 : 1))}
          aria-label={sortDir === 1 ? "Orden ascendente" : "Orden descendente"}
          title={sortDir === 1 ? "Ascendente" : "Descendente"}
        >
          {sortDir === 1 ? "↑" : "↓"}
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No hay pacientes</p>
          <p className="text-xs text-muted-foreground mb-4">
            {q || specialty !== "Todas" || status !== "Todos"
              ? "Prueba a cambiar los filtros de búsqueda."
              : "Añade tu primer paciente para empezar."}
          </p>
          <Button size="sm" onClick={() => navigate("new-patient")}>
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo paciente
          </Button>
        </Card>
      ) : (
        <>
          {/* Desktop: column table */}
          <Card className="hidden lg:block overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2.5">Paciente</th>
                  <th className="text-left font-medium px-4 py-2.5 w-20">Edad</th>
                  <th className="text-left font-medium px-4 py-2.5 w-40">Última visita</th>
                  <th className="text-left font-medium px-4 py-2.5 w-40">Próxima cita</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const stale = isStaleVisit(p.lastVisitDate);
                  return (
                    <tr
                      key={p.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => openPatient(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openPatient(p.id);
                        }
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={p.fullName} color={p.color} size={36} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{p.fullName}</p>
                              <SpecialtyBadge specialty={p.specialty} />
                              <StatusBadge status={p.status} />
                              {(p.alerts ?? []).slice(0, 2).map((alert) => (
                                <span
                                  key={alert}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-100 border border-amber-300 text-amber-900 whitespace-nowrap"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {alert}
                                </span>
                              ))}
                              {(p.alerts ?? []).length > 2 && (
                                <span className="text-[11px] text-muted-foreground">
                                  +{(p.alerts ?? []).length - 2}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {p.diagnosis ?? "Sin diagnóstico"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{p.age} años</td>
                      <td className={`px-4 py-3 whitespace-nowrap ${stale ? "text-amber-700 font-medium" : "text-muted-foreground"}`}>
                        {formatRelative(p.lastVisitDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatRelative(p.nextAppointmentDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile: cards */}
          <div className="grid gap-3 lg:hidden">
            {filtered.map((p) => (
              <Card
                key={p.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openPatient(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openPatient(p.id);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={p.fullName} color={p.color} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{p.fullName}</p>
                      <span className="text-xs text-muted-foreground">{p.age} años</span>
                      <SpecialtyBadge specialty={p.specialty} />
                      <StatusBadge status={p.status} />
                    </div>
                    {(p.alerts ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(p.alerts ?? []).map((alert) => (
                          <span
                            key={alert}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-100 border border-amber-300 text-amber-900"
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {alert}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {p.diagnosis ?? "Sin diagnóstico"}
                    </p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-[11px] text-muted-foreground uppercase">Próxima cita</p>
                    <p className="text-xs font-medium">{formatRelative(p.nextAppointmentDate)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {p.totalVisits} visitas
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
