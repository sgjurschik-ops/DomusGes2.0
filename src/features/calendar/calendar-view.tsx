"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  addWeeks,
  addMonths,
  isSameDay,
  isSameMonth,
  addMinutes,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, X, Clock, MapPin } from "lucide-react";

import {
  useAppointments,
  useCreateAppointment,
  useDeleteAppointment,
  usePatients,
  useProfessionals,
} from "@/hooks/api";
import { useNav } from "@/store/nav";
import { toast } from "@/hooks/use-toast";
import { Avatar } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  appointmentCreateSchema,
  type AppointmentCreateInput,
  APPOINTMENT_TYPES,
} from "@/lib/schemas";
import type { AppointmentDTO } from "@/types/domain";

type ViewMode = "month" | "week" | "day";
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_PX = 56; // height of one hour row in week/day view

// ─── helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function apptsForDay(appts: AppointmentDTO[] | undefined, day: Date): AppointmentDTO[] {
  return (appts ?? []).filter((a) => isSameDay(new Date(a.start), day));
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CalendarView() {
  const today = new Date();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(today);
  const [filterTherapistId, setFilterTherapistId] = useState<string>("all");
  const [selectedAppt, setSelectedAppt] = useState<AppointmentDTO | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState<{ date: string; time: string }>({
    date: format(today, "yyyy-MM-dd"),
    time: "10:00",
  });

  const { data: professionals } = useProfessionals();

  // Compute the visible window for fetching appointments.
  const { from, to } = useMemo(() => {
    if (view === "month") {
      const s = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
      const e = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
      return { from: s, to: e };
    }
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = endOfWeek(cursor, { weekStartsOn: 1 });
      return { from: s, to: e };
    }
    return { from: cursor, to: cursor };
  }, [view, cursor]);

  const { data: appts, isLoading } = useAppointments({
    from: from.toISOString(),
    to: to.toISOString(),
    therapistId: filterTherapistId === "all" ? undefined : filterTherapistId,
  });

  const navigate = (dir: "prev" | "next" | "today") => {
    if (dir === "today") {
      setCursor(new Date());
      return;
    }
    const step = dir === "next" ? 1 : -1;
    if (view === "month") setCursor(addMonths(cursor, step));
    else if (view === "week") setCursor(addWeeks(cursor, step));
    else setCursor(addDays(cursor, step));
  };

  const openCreate = (date?: Date, time?: string) => {
    setCreatePreset({
      date: format(date ?? new Date(), "yyyy-MM-dd"),
      time: time ?? "10:00",
    });
    setCreateOpen(true);
  };

  const title = useMemo(() => {
    if (view === "month") return format(cursor, "MMMM yyyy", { locale: es });
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = endOfWeek(cursor, { weekStartsOn: 1 });
      return `${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM yyyy", { locale: es })}`;
    }
    return format(cursor, "EEEE d 'de' MMMM yyyy", { locale: es });
  }, [view, cursor]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("prev")}
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("today")}>
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("next")}
            aria-label="Siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold capitalize ml-2">{title}</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterTherapistId} onValueChange={setFilterTherapistId}>
            <SelectTrigger aria-label="Filtrar por terapeuta" className="w-[200px]">
              <SelectValue placeholder="Todos los terapeutas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los terapeutas</SelectItem>
              {(professionals ?? []).filter((p) => p.isActive).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="month">Mes</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="day">Día</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button size="sm" onClick={() => openCreate()}>
            <Plus className="w-4 h-4 mr-1" />
            Nueva cita
          </Button>
        </div>
      </div>

      {/* Calendar body */}
      {isLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : view === "month" ? (
        <MonthView cursor={cursor} appts={appts ?? []} onSelect={setSelectedAppt} onCreate={openCreate} />
      ) : view === "week" ? (
        <WeekView cursor={cursor} appts={appts ?? []} onSelect={setSelectedAppt} onCreate={openCreate} />
      ) : (
        <DayView cursor={cursor} appts={appts ?? []} onSelect={setSelectedAppt} onCreate={openCreate} />
      )}

      {/* Detail dialog */}
      <AppointmentDetailDialog
        appt={selectedAppt}
        onClose={() => setSelectedAppt(null)}
      />

      {/* Create dialog */}
      <CreateAppointmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        preset={createPreset}
      />
    </div>
  );
}

// ─── Month view ──────────────────────────────────────────────────────────────

function MonthView({
  cursor,
  appts,
  onSelect,
  onCreate,
}: {
  cursor: Date;
  appts: AppointmentDTO[];
  onSelect: (a: AppointmentDTO) => void;
  onCreate: (date?: Date) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const today = new Date();

  return (
    <Card className="p-2 sm:p-4">
      <div
        className="grid grid-cols-7 gap-1"
        role="grid"
        aria-label="Vista mensual"
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-xs font-medium text-muted-foreground text-center py-2"
            role="columnheader"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const dayAppts = apptsForDay(appts, day).sort(
            (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
          );
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const overflow = Math.max(0, dayAppts.length - 3);
          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              aria-current={isToday ? "date" : undefined}
              className={`min-h-[92px] sm:min-h-[110px] rounded-md border p-1.5 flex flex-col gap-1 group ${
                inMonth ? "bg-card" : "bg-muted/30"
              } ${isToday ? "border-primary ring-1 ring-primary" : "border-border"}`}
            >
              <button
                onClick={() => onCreate(day)}
                className="self-start text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center transition-colors hover:bg-muted"
                aria-label={`Añadir cita el ${format(day, "d 'de' MMMM", { locale: es })}`}
              >
                <span
                  className={
                    isToday
                      ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                      : ""
                  }
                >
                  {format(day, "d")}
                </span>
              </button>

              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                {dayAppts.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onSelect(a)}
                    className="text-left text-[11px] leading-tight px-1.5 py-0.5 rounded truncate font-medium transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: hexToRgba(a.patientColor, 0.2),
                      border: `2px solid ${a.patientColor}`,
                      color: a.patientColor,
                    }}
                    title={`${a.patientName} · ${format(new Date(a.start), "HH:mm")}`}
                  >
                    <span className="font-semibold">
                      {format(new Date(a.start), "HH:mm")}
                    </span>{" "}
                    {a.patientName}
                  </button>
                ))}
                {overflow > 0 && (
                  <span className="text-[11px] text-muted-foreground px-1.5">
                    +{overflow} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Week view ───────────────────────────────────────────────────────────────

function WeekView({
  cursor,
  appts,
  onSelect,
  onCreate,
}: {
  cursor: Date;
  appts: AppointmentDTO[];
  onSelect: (a: AppointmentDTO) => void;
  onCreate: (date?: Date, time?: string) => void;
}) {
  const weekStart = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  return (
    <Card className="p-2 sm:p-4">
      <div className="overflow-x-auto">
        <div
          className="min-w-[760px]"
          role="grid"
          aria-label="Vista semanal"
        >
          {/* Header row */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] sticky top-0 bg-card z-10">
            <div />
            {days.map((d) => {
              const isToday = isSameDay(d, today);
              return (
                <div
                  key={d.toISOString()}
                  role="columnheader"
                  className={`text-center py-2 border-b border-border ${
                    isToday ? "text-primary" : "text-foreground"
                  }`}
                >
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    {WEEKDAYS[(d.getDay() + 6) % 7]}
                  </div>
                  <div
                    className={`text-base font-semibold inline-flex items-center justify-center w-7 h-7 rounded-full ${
                      isToday ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {format(d, "d")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
            {/* Hours column */}
            <div className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  className="text-[11px] text-muted-foreground text-right pr-2 border-t border-border"
                  style={{ height: HOUR_PX }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((d) => (
              <DayColumn
                key={d.toISOString()}
                day={d}
                appts={apptsForDay(appts, d)}
                onSelect={onSelect}
                onCreate={onCreate}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Day view ────────────────────────────────────────────────────────────────

function DayView({
  cursor,
  appts,
  onSelect,
  onCreate,
}: {
  cursor: Date;
  appts: AppointmentDTO[];
  onSelect: (a: AppointmentDTO) => void;
  onCreate: (date?: Date, time?: string) => void;
}) {
  const today = new Date();
  const dayAppts = apptsForDay(appts, cursor);
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  return (
    <Card className="p-2 sm:p-4">
      <div className="overflow-x-auto">
        <div className="min-w-[360px]" role="grid" aria-label="Vista diaria">
          <div className="grid grid-cols-[80px_1fr]">
            <div
              className={`text-center py-2 border-b border-border ${
                isSameDay(cursor, today) ? "text-primary" : ""
              }`}
            >
              <div className="text-xs font-medium uppercase text-muted-foreground">
                {format(cursor, "EEE", { locale: es })}
              </div>
              <div
                className={`text-base font-semibold inline-flex items-center justify-center w-8 h-8 rounded-full ${
                  isSameDay(cursor, today) ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {format(cursor, "d")}
              </div>
            </div>
            <div className="border-b border-border" />
          </div>

          <div className="grid grid-cols-[80px_1fr] relative">
            <div className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  className="text-xs text-muted-foreground text-right pr-3 pt-1 border-t border-border"
                  style={{ height: HOUR_PX }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            <DayColumn
              day={cursor}
              appts={dayAppts}
              onSelect={onSelect}
              onCreate={onCreate}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Day column (shared by week and day views) ───────────────────────────────

function DayColumn({
  day,
  appts,
  onSelect,
  onCreate,
}: {
  day: Date;
  appts: AppointmentDTO[];
  onSelect: (a: AppointmentDTO) => void;
  onCreate: (date?: Date, time?: string) => void;
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  return (
    <div
      role="gridcell"
      className="relative border-l border-border"
      style={{ height: (HOUR_END - HOUR_START + 1) * HOUR_PX }}
    >
      {/* Hour slots */}
      {hours.map((h) => {
        const slotDate = new Date(day);
        slotDate.setHours(h, 0, 0, 0);
        return (
          <button
            key={h}
            onClick={() => onCreate(slotDate, `${String(h).padStart(2, "0")}:00`)}
            className="block w-full border-t border-border hover:bg-accent/40 transition-colors"
            style={{ height: HOUR_PX }}
            aria-label={`Añadir cita a las ${String(h).padStart(2, "0")}:00`}
          />
        );
      })}

      {/* Appointments */}
      {appts.map((a) => {
        const start = new Date(a.start);
        const startMins = start.getHours() * 60 + start.getMinutes();
        const offsetMin = startMins - HOUR_START * 60;
        if (offsetMin + a.durationMin <= 0) return null;
        const top = Math.max(0, (offsetMin / 60) * HOUR_PX);
        const height = (a.durationMin / 60) * HOUR_PX - 2;
        const end = addMinutes(start, a.durationMin);
        return (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            className="absolute left-1 right-1 rounded-md px-2 py-1 text-left overflow-hidden transition-transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-ring"
            style={{
              top,
              height: Math.max(20, height),
              backgroundColor: hexToRgba(a.patientColor, 0.2),
              border: `2px solid ${a.patientColor}`,
              color: a.patientColor,
            }}
            aria-label={`Cita de ${a.patientName} ${format(start, "HH:mm")}–${format(end, "HH:mm")}`}
          >
            <p className="text-[11px] font-semibold leading-tight truncate">
              {format(start, "HH:mm")}–{format(end, "HH:mm")}
            </p>
            <p className="text-[11px] font-medium leading-tight truncate">
              {a.patientName}
            </p>
            <p className="text-[10px] opacity-80 truncate">{a.type}</p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Detail dialog ───────────────────────────────────────────────────────────

function AppointmentDetailDialog({
  appt,
  onClose,
}: {
  appt: AppointmentDTO | null;
  onClose: () => void;
}) {
  const del = useDeleteAppointment();
  const { selectPatient, navigate } = useNav();

  async function handleDelete() {
    if (!appt) return;
    try {
      await del.mutateAsync(appt.id);
      toast({ title: "Cita eliminada" });
      onClose();
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  }

  if (!appt) return null;
  const start = new Date(appt.start);
  const end = addMinutes(start, appt.durationMin);

  return (
    <Dialog open={!!appt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar name={appt.patientName} color={appt.patientColor} size={36} />
            <div>
              <div className="text-base">{appt.patientName}</div>
              <div className="text-xs text-muted-foreground font-normal">{appt.type}</div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalle de la cita de {appt.patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>
              {format(start, "EEEE d 'de' MMMM", { locale: es })} ·{" "}
              {format(start, "HH:mm")}–{format(end, "HH:mm")} ({appt.durationMin} min)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Terapeuta:</span>
            <span className="font-medium">{appt.therapistName}</span>
          </div>
          {appt.patientAddress && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <span>{appt.patientAddress}</span>
            </div>
          )}
          {appt.notes && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p className="text-xs text-muted-foreground mb-1">Notas</p>
              {appt.notes}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              selectPatient(appt.patientId);
              navigate("patient-detail");
            }}
          >
            Ver paciente
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="w-4 h-4 mr-1" /> Cerrar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={del.isPending}
            >
              Eliminar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create dialog ───────────────────────────────────────────────────────────

function CreateAppointmentDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset: { date: string; time: string };
}) {
  const create = useCreateAppointment();
  const { data: patients } = usePatients();
  const { data: professionals } = useProfessionals();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof appointmentCreateSchema>, any, z.output<typeof appointmentCreateSchema>>({
    resolver: zodResolver(appointmentCreateSchema),
    defaultValues: {
      patientId: "",
      therapistId: "",
      date: preset.date,
      time: preset.time,
      durationMin: 45,
      type: "Sesión",
      notes: "",
    },
  });

  // Sync preset whenever dialog opens
  useEffect(() => {
    if (open) {
      reset({
        patientId: "",
        therapistId: "",
        date: preset.date,
        time: preset.time,
        durationMin: 45,
        type: "Sesión",
        notes: "",
      });
    }
  }, [open, preset, reset]);

  async function onSubmit(values: AppointmentCreateInput) {
    try {
      const created = await create.mutateAsync(values);
      toast({ title: "Cita creada", description: created.patientName });
      onOpenChange(false);
    } catch {
      toast({ title: "Error al crear cita", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
          <DialogDescription>Programa una nueva sesión o valoración.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Paciente" error={errors.patientId?.message} required>
            <Controller
              control={control}
              name="patientId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Paciente">
                    <SelectValue placeholder="Selecciona paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(patients ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Terapeuta" error={errors.therapistId?.message} required>
            <Controller
              control={control}
              name="therapistId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Terapeuta">
                    <SelectValue placeholder="Selecciona terapeuta" />
                  </SelectTrigger>
                  <SelectContent>
                    {(professionals ?? []).filter((p) => p.isActive).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" error={errors.date?.message} required>
              <Input type="date" {...register("date")} />
            </Field>
            <Field label="Hora" error={errors.time?.message} required>
              <Input type="time" {...register("time")} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duración (min)" error={errors.durationMin?.message} required>
              <Input type="number" min={15} max={240} step={5} {...register("durationMin")} />
            </Field>
            <Field label="Tipo" error={errors.type?.message} required>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Tipo de cita">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPOINTMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field label="Notas" error={errors.notes?.message}>
            <Textarea rows={2} {...register("notes")} placeholder="Opcional" />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Guardando…" : "Crear cita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
