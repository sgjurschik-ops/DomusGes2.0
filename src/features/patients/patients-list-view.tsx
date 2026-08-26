"use client";

import { useState, useMemo } from "react";
import { usePatients } from "@/hooks/api";
import { useNav } from "@/store/nav";
import { useCurrentSession } from "@/hooks/api";
import { useCenter } from "@/store/center";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Avatar, SpecialtyBadge, StatusBadge, ResourceBadge, EmCategoryBadge, emCategoryAvatarColor, formatRelative } from "@/components/domain";
import { Search, Plus, Users, AlertTriangle, SlidersHorizontal, X, ArrowUp, ArrowDown } from "lucide-react";
import type { Specialty, PatientStatus, PatientDTO } from "@/types/domain";
import { RESOURCE_KEYS, EM_CATEGORIES, EM_RESOURCE_KEY } from "@/lib/schemas";

const SPECIALTY_FILTERS: ("Todas" | Specialty)[] = ["Todas", "Fisioterapia", "Psicología", "T. Ocupacional"];
const STATUS_FILTERS: ("Todos" | PatientStatus)[] = ["Todos", "Activo", "En seguimiento", "Alta", "Pausado"];
const RESOURCE_FILTERS: ("Todos" | (typeof RESOURCE_KEYS)[number])[] = ["Todos", ...RESOURCE_KEYS];
const EM_CATEGORY_FILTERS: ("Todas" | (typeof EM_CATEGORIES)[number])[] = ["Todas", ...EM_CATEGORIES];

// Días naturales transcurridos desde la fecha de inicio (alta) del/de la
// usuario/a — cuánto lleva en la asociación / centro de día.
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d >= 0 ? d : 0;
}

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
  const { activeResource } = useCenter();
  // "Módulo de Asociación EM": cuando el centro de trabajo activo es EM.
  const isEM = activeResource === EM_RESOURCE_KEY;
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState<"Todas" | Specialty>("Todas");
  const [status, setStatus] = useState<"Todos" | PatientStatus>("Todos");
  const [resource, setResource] = useState<"Todos" | (typeof RESOURCE_KEYS)[number]>("Todos");
  const [emCat, setEmCat] = useState<"Todas" | (typeof EM_CATEGORIES)[number]>("Todas");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const filtered = useMemo(() => {
    if (!patients) return [];
    const term = q.trim().toLowerCase();
    const base = patients.filter((p) => {
      if (specialty !== "Todas" && p.specialty !== specialty) return false;
      if (status !== "Todos" && p.status !== status) return false;
      if (resource !== "Todos" && p.resource !== resource) return false;
      // El filtro de clasificación solo aplica dentro del módulo EM.
      if (isEM && emCat !== "Todas" && p.emCategory !== emCat) return false;
      if (term && !p.fullName.toLowerCase().includes(term) && !p.diagnosis?.toLowerCase().includes(term)) return false;
      return true;
    });
    return sortPatients(base, sortKey, sortDir);
  }, [patients, q, specialty, status, resource, isEM, emCat, sortKey, sortDir]);

  function openPatient(id: string) {
    selectPatient(id);
    navigate("patient-detail");
  }

  // Filtros activos del panel (para el contador del botón y los "chips").
  // La clasificación EM NO cuenta aquí: tiene su propio selector siempre visible.
  const activeCount =
    (specialty !== "Todas" ? 1 : 0) +
    (status !== "Todos" ? 1 : 0) +
    (resource !== "Todos" ? 1 : 0);

  const chips: { label: string; clear: () => void }[] = [];
  if (specialty !== "Todas") chips.push({ label: `Especialidad: ${specialty}`, clear: () => setSpecialty("Todas") });
  if (status !== "Todos") chips.push({ label: `Estado: ${status}`, clear: () => setStatus("Todos") });
  if (resource !== "Todos") chips.push({ label: `Recurso: ${resource}`, clear: () => setResource("Todos") });

  function clearAll() {
    setSpecialty("Todas");
    setStatus("Todos");
    setResource("Todos");
  }

  return (
    <div className="space-y-4">
      {/* Búsqueda + filtros */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o diagnóstico…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              aria-label="Buscar usuarios/as"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filtros y orden</span>
                <span className="sm:hidden">Filtros</span>
                {activeCount > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold w-5 h-5">
                    {activeCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Especialidad</Label>
                <Select value={specialty} onValueChange={(v) => setSpecialty(v as typeof specialty)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTY_FILTERS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Recurso</Label>
                <Select value={resource} onValueChange={(v) => setResource(v as typeof resource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOURCE_FILTERS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-1.5">
                <Label className="text-xs">Ordenar por</Label>
                <div className="flex gap-2">
                  <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                        <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSortDir((d) => (d === 1 ? -1 : 1))}
                    aria-label={sortDir === 1 ? "Orden ascendente" : "Orden descendente"}
                    title={sortDir === 1 ? "Ascendente (A→Z, menor→mayor)" : "Descendente (Z→A, mayor→menor)"}
                    className="shrink-0"
                  >
                    {sortDir === 1 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {activeCount > 0 && (
                <Button variant="ghost" size="sm" className="w-full justify-center text-muted-foreground" onClick={clearAll}>
                  <X className="w-3.5 h-3.5 mr-1.5" /> Limpiar filtros
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Selector rápido de clasificación (solo módulo EM): pulsar uno u otro */}
        {isEM && (
          <div className="inline-flex rounded-lg border bg-muted/50 p-0.5">
            {EM_CATEGORY_FILTERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEmCat(c)}
                aria-pressed={emCat === c}
                className={cn(
                  "px-3.5 py-1.5 text-sm rounded-md transition-colors",
                  emCat === c
                    ? "bg-background shadow-sm font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Chips de filtros activos: dejan claro de un vistazo qué se está filtrando */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 hover:bg-muted pl-2.5 pr-1.5 py-1 text-xs transition-colors"
                aria-label={`Quitar filtro ${chip.label}`}
              >
                {chip.label}
                <X className="w-3 h-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="ml-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Limpiar todo
            </button>
          </div>
        )}
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
          <p className="text-sm font-medium text-foreground mb-1">No hay usuarios/as</p>
          <p className="text-xs text-muted-foreground mb-4">
            {q || specialty !== "Todas" || status !== "Todos" || resource !== "Todos" || (isEM && emCat !== "Todas")
              ? "Prueba a cambiar los filtros de búsqueda."
              : "Añade tu primer usuario/a para empezar."}
          </p>
          <Button size="sm" onClick={() => navigate("new-patient")}>
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo/a usuario/a
          </Button>
        </Card>
      ) : (
        <>
          {/* Desktop: column table */}
          <Card className="hidden lg:block overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2.5">Usuario/a</th>
                  <th className="text-left font-medium px-4 py-2.5 w-20">Edad</th>
                  {isEM && <th className="text-left font-medium px-4 py-2.5 w-24">Días</th>}
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
                          <Avatar name={p.fullName} color={emCategoryAvatarColor(p.emCategory)} size={36} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{p.fullName}</p>
                              {p.specialty !== "T. Ocupacional" && <SpecialtyBadge specialty={p.specialty} />}
                              {p.status !== "Activo" && <StatusBadge status={p.status} />}
                              {!activeResource && <ResourceBadge resource={p.resource} />}
                              {isEM && <EmCategoryBadge category={p.emCategory} />}
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
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{p.age} años</td>
                      {isEM && (
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {daysSince(p.startDate) !== null ? `${daysSince(p.startDate)} días` : "—"}
                        </td>
                      )}
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
                  <Avatar name={p.fullName} color={emCategoryAvatarColor(p.emCategory)} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{p.fullName}</p>
                      <span className="text-xs text-muted-foreground">{p.age} años</span>
                      {isEM && daysSince(p.startDate) !== null && (
                        <span className="text-xs text-muted-foreground">· {daysSince(p.startDate)} días</span>
                      )}
                      {p.specialty !== "T. Ocupacional" && <SpecialtyBadge specialty={p.specialty} />}
                      {p.status !== "Activo" && <StatusBadge status={p.status} />}
                      {!activeResource && <ResourceBadge resource={p.resource} />}
                      {isEM && <EmCategoryBadge category={p.emCategory} />}
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
