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
import { Search, Plus, Users } from "lucide-react";
import type { Specialty, PatientStatus } from "@/types/domain";

const SPECIALTY_FILTERS: ("Todas" | Specialty)[] = ["Todas", "Fisioterapia", "Psicología", "T. Ocupacional"];
const STATUS_FILTERS: ("Todos" | PatientStatus)[] = ["Todos", "Activo", "En seguimiento", "Alta", "Pausado"];

export function PatientsListView() {
  const { data: patients, isLoading } = usePatients();
  const { user } = useCurrentSession();
  const { navigate, selectPatient } = useNav();
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState<"Todas" | Specialty>("Todas");
  const [status, setStatus] = useState<"Todos" | PatientStatus>("Todos");

  const filtered = useMemo(() => {
    if (!patients) return [];
    const term = q.trim().toLowerCase();
    return patients.filter((p) => {
      if (specialty !== "Todas" && p.specialty !== specialty) return false;
      if (status !== "Todos" && p.status !== status) return false;
      if (term && !p.fullName.toLowerCase().includes(term) && !p.diagnosis?.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [patients, q, specialty, status]);

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
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por especialidad">
            <SelectValue placeholder="Especialidad" />
          </SelectTrigger>
          <SelectContent>
            {SPECIALTY_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Card
              key={p.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              role="button"
              tabIndex={0}
              onClick={() => {
                selectPatient(p.id);
                navigate("patient-detail");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectPatient(p.id);
                  navigate("patient-detail");
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
      )}
    </div>
  );
}
