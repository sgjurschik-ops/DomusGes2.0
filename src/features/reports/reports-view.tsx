"use client";

import { useMemo, useState } from "react";
import { usePatients, useVisits, useAssessments, useAppointments, useProfessionals } from "@/hooks/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SpecialtyBadge, ResourceBadge } from "@/components/domain";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Activity, Users, TrendingUp, BarChart3, PieChart as PieIcon, Trophy, Download,
  ClipboardList, Calendar,
} from "lucide-react";
import type { PatientStatus, Specialty } from "@/types/domain";
import { PATIENT_STATUSES, SPECIALTIES, ASSESSMENT_SCALES, RESOURCES } from "@/lib/schemas";

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

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Resumen</TabsTrigger>
          <TabsTrigger value="listados"><ClipboardList className="w-3.5 h-3.5 mr-1.5" />Listados</TabsTrigger>
        </TabsList>

        {/* ── RESUMEN ── */}
        <TabsContent value="resumen" className="space-y-6 mt-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <KpiCard label="Usuarios/as activos/as" icon={Users} value={isLoading ? null : derived.activePatients} hint="Total en seguimiento activo" />
            <KpiCard label="Seguimientos (90 días)" icon={Activity} value={isLoading ? null : derived.visits90} hint="Sesiones registradas" />
            <KpiCard label="Media seguimientos / usuario/a" icon={TrendingUp} value={isLoading ? null : derived.avgVisits.toFixed(1)} hint="Sobre usuarios/as con actividad" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Seguimientos por especialidad</CardTitle>
                <CardDescription className="text-xs">Últimos 90 días</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (<Skeleton className="h-64 w-full" />) : derived.bySpecialty.every((s) => s.value === 0) ? (<EmptyChart label="No hay seguimientos en los últimos 90 días" />) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={derived.bySpecialty} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} formatter={(v: number | string) => [`${v} seguimientos`, "Seguimientos"]} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {derived.bySpecialty.map((s) => (<Cell key={s.label} fill={SPECIALTY_COLORS[s.label]} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><PieIcon className="w-4 h-4 text-primary" />Usuarios/as por estado</CardTitle>
                <CardDescription className="text-xs">Distribución actual</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (<Skeleton className="h-64 w-full" />) : derived.byStatus.length === 0 ? (<EmptyChart label="No hay usuarios/as registrados/as" />) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={derived.byStatus} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {derived.byStatus.map((s) => (<Cell key={s.label} fill={STATUS_COLORS[s.label]} />))}
                      </Pie>
                      <Tooltip formatter={(v: number | string, n: string) => [`${v} usuarios/as`, n]} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" />Top 10 usuarios/as por número de seguimientos</CardTitle>
              <CardDescription className="text-xs">Histórico acumulado por usuario/a</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-10 w-full" />))}</div>
              ) : derived.top.length === 0 ? (
                <div className="p-10 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">Sin usuarios/as</p>
                  <p className="text-xs text-muted-foreground">Aún no hay usuarios/as para mostrar.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-right">#</TableHead>
                      <TableHead>Usuario/a</TableHead>
                      <TableHead>Especialidad</TableHead>
                      <TableHead className="text-right">Seguimientos</TableHead>
                      <TableHead>Último seguimiento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {derived.top.map((p, i) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.fullName}</TableCell>
                        <TableCell><SpecialtyBadge specialty={p.specialty} /></TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{p.totalVisits}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {p.lastVisitDate ? format(new Date(p.lastVisitDate), "dd MMM yyyy", { locale: es }) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── LISTADOS ── */}
        <TabsContent value="listados" className="mt-4">
          <ListadosView />
        </TabsContent>
      </Tabs>
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

// ─── CSV helper ──────────────────────────────────────────────────────────────
function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Shared toolbar ──────────────────────────────────────────────────────────
function FilterBar({ children, count, onExport }: { children: React.ReactNode; count: number; onExport: () => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-3">
      {children}
      <span className="text-xs text-muted-foreground ml-1">{count} registro{count !== 1 ? "s" : ""}</span>
      <Button variant="outline" size="sm" className="ml-auto h-8 text-xs gap-1.5" onClick={onExport}>
        <Download className="w-3.5 h-3.5" /> Exportar CSV
      </Button>
    </div>
  );
}

// ─── ListadosView ─────────────────────────────────────────────────────────────
function ListadosView() {
  const { data: patients, isLoading: lp } = usePatients();
  const { data: visits, isLoading: lv } = useVisits();
  const { data: assessments, isLoading: la } = useAssessments();
  const { data: professionals } = useProfessionals();
  const now = new Date();
  const isoFrom = `${now.getFullYear()}-01-01`;
  const isoTo   = `${now.getFullYear()}-12-31`;
  const { data: appointments, isLoading: lap } = useAppointments({ from: isoFrom, to: isoTo });

  // ── Usuarios filters ──
  const [uSearch, setUSearch] = useState("");
  const [uResource, setUResource] = useState("all");
  const [uStatus, setUStatus] = useState("all");
  const [uSpecialty, setUSpecialty] = useState("all");

  // ── Seguimientos filters ──
  const [vResource, setVResource] = useState("all");
  const [vTherapist, setVTherapist] = useState("all");
  const [vFrom, setVFrom] = useState("");
  const [vTo, setVTo] = useState("");

  // ── Valoraciones filters ──
  const [aScale, setAScale] = useState("all");
  const [aPatient, setAPatient] = useState("all");
  const [aFrom, setAFrom] = useState("");
  const [aTo, setATo] = useState("");

  // ── Citas filters ──
  const [cResource, setCResource] = useState("all");
  const [cTherapist, setCTherapist] = useState("all");
  const [cStatus, setCStatus] = useState("all");

  const patientResourceMap = useMemo(() => {
    const m = new Map<string, string | null>();
    (patients ?? []).forEach((p) => m.set(p.id, p.resource));
    return m;
  }, [patients]);

  // ── Filtered usuarios ──
  const filteredUsers = useMemo(() => {
    return (patients ?? []).filter((p) => {
      if (uResource !== "all" && p.resource !== uResource) return false;
      if (uStatus !== "all" && p.status !== uStatus) return false;
      if (uSpecialty !== "all" && p.specialty !== uSpecialty) return false;
      if (uSearch && !p.fullName.toLowerCase().includes(uSearch.toLowerCase())) return false;
      return true;
    });
  }, [patients, uResource, uStatus, uSpecialty, uSearch]);

  // ── Filtered seguimientos ──
  const filteredVisits = useMemo(() => {
    return (visits ?? []).filter((v) => {
      if (vTherapist !== "all" && v.therapistId !== vTherapist) return false;
      if (vResource !== "all" && patientResourceMap.get(v.patientId) !== vResource) return false;
      if (vFrom && v.date < vFrom) return false;
      if (vTo && v.date > vTo) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [visits, vTherapist, vResource, vFrom, vTo, patientResourceMap]);

  // ── Filtered valoraciones ──
  const filteredAssessments = useMemo(() => {
    return (assessments ?? []).filter((a) => {
      if (aScale !== "all" && a.scale !== aScale) return false;
      if (aPatient !== "all" && a.patientId !== aPatient) return false;
      if (aFrom && a.date < aFrom) return false;
      if (aTo && a.date > aTo) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [assessments, aScale, aPatient, aFrom, aTo]);

  // ── Filtered citas ──
  const filteredAppointments = useMemo(() => {
    return (appointments ?? []).filter((a) => {
      if (cResource !== "all" && a.patientResource !== cResource) return false;
      if (cTherapist !== "all" && a.therapistId !== cTherapist) return false;
      if (cStatus !== "all" && a.status !== cStatus) return false;
      return true;
    }).sort((a, b) => b.start.localeCompare(a.start));
  }, [appointments, cResource, cTherapist, cStatus]);

  const fmtDate = (d: string) => { try { return format(new Date(d), "dd MMM yyyy", { locale: es }); } catch { return d; } };
  const fmtDateTime = (d: string) => { try { return format(new Date(d), "dd MMM yyyy HH:mm", { locale: es }); } catch { return d; } };

  // ── CSV exports ──
  function exportUsers() {
    downloadCSV("usuarios.csv",
      filteredUsers.map((p) => [p.fullName, String(p.age), p.specialty, p.status, p.resource ?? "", p.diagnosis ?? "", fmtDate(p.startDate), String(p.totalVisits), p.lastVisitDate ? fmtDate(p.lastVisitDate) : "", p.therapistNames.join(", "), p.phone ?? ""]),
      ["Nombre", "Edad", "Especialidad", "Estado", "Centro", "Diagnóstico", "Inicio", "Seguimientos", "Última visita", "Terapeutas", "Teléfono"]
    );
  }
  function exportVisits() {
    downloadCSV("seguimientos.csv",
      filteredVisits.map((v) => [v.patientName, fmtDate(v.date), String(v.durationMin), v.therapistName, v.title ?? "", v.interventions.join("; ")]),
      ["Usuario/a", "Fecha", "Duración (min)", "Terapeuta", "Título", "Intervenciones"]
    );
  }
  function exportAssessments() {
    downloadCSV("valoraciones.csv",
      filteredAssessments.map((a) => [a.patientName, a.scale, a.score, fmtDate(a.date), a.therapistName, a.notes ?? ""]),
      ["Usuario/a", "Escala", "Puntuación", "Fecha", "Terapeuta", "Notas"]
    );
  }
  function exportAppointments() {
    downloadCSV("citas.csv",
      filteredAppointments.map((a) => [a.patientName, fmtDateTime(a.start), String(a.durationMin), a.therapistName, a.type, a.status, a.patientResource ?? ""]),
      ["Usuario/a", "Inicio", "Duración (min)", "Terapeuta", "Tipo", "Estado", "Centro"]
    );
  }

  const selClass = "h-8 text-xs";

  return (
    <Tabs defaultValue="usuarios">
      <TabsList className="mb-4">
        <TabsTrigger value="usuarios"><Users className="w-3.5 h-3.5 mr-1.5" />Usuarios/as</TabsTrigger>
        <TabsTrigger value="seguimientos"><Activity className="w-3.5 h-3.5 mr-1.5" />Seguimientos</TabsTrigger>
        <TabsTrigger value="valoraciones"><ClipboardList className="w-3.5 h-3.5 mr-1.5" />Valoraciones</TabsTrigger>
        <TabsTrigger value="citas"><Calendar className="w-3.5 h-3.5 mr-1.5" />Citas</TabsTrigger>
      </TabsList>

      {/* ── USUARIOS ── */}
      <TabsContent value="usuarios">
        <FilterBar count={filteredUsers.length} onExport={exportUsers}>
          <Input placeholder="Buscar nombre…" value={uSearch} onChange={(e) => setUSearch(e.target.value)} className="h-8 text-xs w-40" />
          <Select value={uResource} onValueChange={setUResource}>
            <SelectTrigger className={selClass} style={{ width: 150 }}><SelectValue placeholder="Centro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los centros</SelectItem>
              {RESOURCES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={uStatus} onValueChange={setUStatus}>
            <SelectTrigger className={selClass} style={{ width: 140 }}><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {PATIENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={uSpecialty} onValueChange={setUSpecialty}>
            <SelectTrigger className={selClass} style={{ width: 160 }}><SelectValue placeholder="Especialidad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {SPECIALTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterBar>
        <Card>
          <CardContent className="p-0">
            {lp ? <Skeleton className="h-64 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Edad</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Diagnóstico</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead className="text-right">Seguimientos</TableHead>
                    <TableHead>Última visita</TableHead>
                    <TableHead>Terapeuta/s</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Sin resultados.</TableCell></TableRow>
                  ) : filteredUsers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.fullName}</TableCell>
                      <TableCell>{p.age}</TableCell>
                      <TableCell>{p.resource ? <ResourceBadge resource={p.resource} className="text-[11px] py-0" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: STATUS_COLORS[p.status] + "22", color: STATUS_COLORS[p.status] }}>{p.status}</span></TableCell>
                      <TableCell className="text-muted-foreground text-xs">{p.diagnosis ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{fmtDate(p.startDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.totalVisits}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{p.lastVisitDate ? fmtDate(p.lastVisitDate) : "—"}</TableCell>
                      <TableCell className="text-xs">{p.therapistNames.join(", ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── SEGUIMIENTOS ── */}
      <TabsContent value="seguimientos">
        <FilterBar count={filteredVisits.length} onExport={exportVisits}>
          <Select value={vResource} onValueChange={setVResource}>
            <SelectTrigger className={selClass} style={{ width: 150 }}><SelectValue placeholder="Centro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los centros</SelectItem>
              {RESOURCES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={vTherapist} onValueChange={setVTherapist}>
            <SelectTrigger className={selClass} style={{ width: 170 }}><SelectValue placeholder="Terapeuta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(professionals ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <input type="date" value={vFrom} onChange={(e) => setVFrom(e.target.value)} className="h-8 text-xs border border-border rounded-md px-2 bg-background" title="Desde" />
          <input type="date" value={vTo} onChange={(e) => setVTo(e.target.value)} className="h-8 text-xs border border-border rounded-md px-2 bg-background" title="Hasta" />
        </FilterBar>
        <Card>
          <CardContent className="p-0">
            {lv ? <Skeleton className="h-64 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario/a</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Terapeuta</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Intervenciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVisits.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sin resultados.</TableCell></TableRow>
                  ) : filteredVisits.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.patientName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(v.date)}</TableCell>
                      <TableCell className="text-xs">{v.durationMin} min</TableCell>
                      <TableCell className="text-xs">{v.therapistName}</TableCell>
                      <TableCell className="text-xs">{v.title ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.interventions.join(", ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── VALORACIONES ── */}
      <TabsContent value="valoraciones">
        <FilterBar count={filteredAssessments.length} onExport={exportAssessments}>
          <Select value={aScale} onValueChange={setAScale}>
            <SelectTrigger className={selClass} style={{ width: 160 }}><SelectValue placeholder="Escala" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las escalas</SelectItem>
              {ASSESSMENT_SCALES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={aPatient} onValueChange={setAPatient}>
            <SelectTrigger className={selClass} style={{ width: 170 }}><SelectValue placeholder="Usuario/a" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos/as</SelectItem>
              {(patients ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
          <input type="date" value={aFrom} onChange={(e) => setAFrom(e.target.value)} className="h-8 text-xs border border-border rounded-md px-2 bg-background" title="Desde" />
          <input type="date" value={aTo} onChange={(e) => setATo(e.target.value)} className="h-8 text-xs border border-border rounded-md px-2 bg-background" title="Hasta" />
        </FilterBar>
        <Card>
          <CardContent className="p-0">
            {la ? <Skeleton className="h-64 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario/a</TableHead>
                    <TableHead>Escala</TableHead>
                    <TableHead>Puntuación</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Terapeuta</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssessments.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sin resultados.</TableCell></TableRow>
                  ) : filteredAssessments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.patientName}</TableCell>
                      <TableCell><span className="text-xs font-medium">{a.scale}</span></TableCell>
                      <TableCell className="font-mono text-xs">{a.score}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(a.date)}</TableCell>
                      <TableCell className="text-xs">{a.therapistName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{a.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── CITAS ── */}
      <TabsContent value="citas">
        <FilterBar count={filteredAppointments.length} onExport={exportAppointments}>
          <Select value={cResource} onValueChange={setCResource}>
            <SelectTrigger className={selClass} style={{ width: 150 }}><SelectValue placeholder="Centro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los centros</SelectItem>
              {RESOURCES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cTherapist} onValueChange={setCTherapist}>
            <SelectTrigger className={selClass} style={{ width: 170 }}><SelectValue placeholder="Terapeuta" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(professionals ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cStatus} onValueChange={setCStatus}>
            <SelectTrigger className={selClass} style={{ width: 140 }}><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="completada">Completada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
        <Card>
          <CardContent className="p-0">
            {lap ? <Skeleton className="h-64 w-full" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario/a</TableHead>
                    <TableHead>Inicio</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Terapeuta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sin resultados.</TableCell></TableRow>
                  ) : filteredAppointments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.patientName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(a.start)}</TableCell>
                      <TableCell className="text-xs">{a.durationMin} min</TableCell>
                      <TableCell className="text-xs">{a.therapistName}</TableCell>
                      <TableCell className="text-xs">{a.type}</TableCell>
                      <TableCell>{a.patientResource ? <ResourceBadge resource={a.patientResource} className="text-[11px] py-0" /> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                      <TableCell><span className="text-xs capitalize">{a.status}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
