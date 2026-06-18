"use client";

import { useMemo, useState } from "react";
import { useProfessionals } from "@/hooks/api";
import { PROFESSIONAL_ROLES } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, formatDate } from "@/components/domain";
import type { ProfessionalRole } from "@/types/domain";
import { Phone, Mail, IdCard, Users, ShieldCheck } from "lucide-react";

type RoleFilter = "Todos" | ProfessionalRole;
type ActiveFilter = "Todos" | "Activos" | "Inactivos";

export function TeamView() {
  const { data: professionals, isLoading } = useProfessionals();
  const [role, setRole] = useState<RoleFilter>("Todos");
  const [active, setActive] = useState<ActiveFilter>("Todos");

  const filtered = useMemo(() => {
    if (!professionals) return [];
    return professionals.filter((p) => {
      if (role !== "Todos" && p.role !== role) return false;
      if (active === "Activos" && !p.isActive) return false;
      if (active === "Inactivos" && p.isActive) return false;
      return true;
    });
  }, [professionals, role, active]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
          <SelectTrigger className="w-full sm:w-64" aria-label="Filtrar por rol">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos los roles</SelectItem>
            {PROFESSIONAL_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={active} onValueChange={(v) => setActive(v as ActiveFilter)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos los estados</SelectItem>
            <SelectItem value="Activos">Activos</SelectItem>
            <SelectItem value="Inactivos">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No hay profesionales</p>
          <p className="text-xs text-muted-foreground">
            {role !== "Todos" || active !== "Todos"
              ? "Prueba a cambiar los filtros de búsqueda."
              : "Aún no se ha dado de alta ningún profesional."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Avatar name={p.name} color={p.color} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      {p.isAdmin && (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheck className="w-3 h-3" /> Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.role}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={p.isActive ? "default" : "outline"}>
                    {p.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    Alta: {formatDate(p.joinedAt)}
                  </span>
                </div>

                <dl className="space-y-1.5 text-xs">
                  {p.numColegiado && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IdCard className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      <span className="truncate">Nº colegiado: {p.numColegiado}</span>
                    </div>
                  )}
                  {p.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      <a href={`tel:${p.phone}`} className="truncate hover:underline">
                        {p.phone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    <a href={`mailto:${p.email}`} className="truncate hover:underline">
                      {p.email}
                    </a>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
