"use client";

import { useState } from "react";
import { useBilling } from "@/hooks/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { SpecialtyBadge } from "@/components/domain";
import { Receipt, Euro, CalendarClock, Users, TrendingUp } from "lucide-react";
import type { Specialty } from "@/types/domain";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;
const YEARS = [2024, 2025, 2026] as const;

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function BillingView() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const { data, isLoading } = useBilling(year, month);

  const ticket = data && data.count > 0 ? data.total / data.count : 0;
  const monthLabel = MONTHS[month - 1];

  return (
    <div className="space-y-6">
      {/* Header + month picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Facturación</h2>
          <p className="text-sm text-muted-foreground">
            Resumen económico de sesiones y valoraciones.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40" aria-label="Mes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28" aria-label="Año">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <KpiCard
          label="Total facturado"
          icon={Euro}
          value={isLoading ? null : eur.format(data?.total ?? 0)}
          hint={`${monthLabel} ${year}`}
        />
        <KpiCard
          label="Nº sesiones"
          icon={CalendarClock}
          value={isLoading ? null : String(data?.count ?? 0)}
          hint="Sesiones del periodo"
        />
        <KpiCard
          label="Ticket medio"
          icon={TrendingUp}
          value={isLoading ? null : eur.format(ticket)}
          hint="Por sesión"
        />
      </div>

      {/* By therapist table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Por terapeuta
          </CardTitle>
          <CardDescription className="text-xs">
            Desglose de sesiones e importe por profesional ({monthLabel} {year})
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data || data.byTherapist.length === 0 ? (
            <EmptyBilling />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Terapeuta</TableHead>
                  <TableHead className="text-right">Sesiones</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byTherapist.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.count}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {eur.format(t.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Lines table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Líneas de facturación
          </CardTitle>
          <CardDescription className="text-xs">
            Detalle de cada sesión del periodo
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !data || data.lines.length === 0 ? (
            <EmptyBilling />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Terapeuta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(l.date), "dd MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="font-medium">{l.patientName}</TableCell>
                    <TableCell>
                      <SpecialtyBadge specialty={l.specialty as Specialty} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.therapistName}</TableCell>
                    <TableCell>{l.type}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.durationMin} min</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {eur.format(l.amount)}
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
  value: string | null;
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
          <Skeleton className="h-8 w-32" />
        ) : (
          <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        )}
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyBilling() {
  return (
    <div className="p-10 text-center">
      <Receipt className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm font-medium text-foreground mb-1">Sin datos de facturación</p>
      <p className="text-xs text-muted-foreground">
        No hay sesiones registradas para el periodo seleccionado.
      </p>
    </div>
  );
}
