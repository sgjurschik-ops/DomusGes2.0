"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { ChevronLeft, ChevronRight, Plus, X, Clock, MapPin, Pencil, Lock, AlertTriangle, Trash2, Copy, Check, Calendar as CalendarIcon } from "lucide-react";

import {
  useAppointments,
  useCreateAppointment,
  useUpdateAppointment,
  useUpdateAppointmentStatus,
  useMoveAppointment,
  useDeleteAppointment,
  useReservations,
  useCreateReservation,
  useUpdateReservation,
  useReservationCategories,
  useCreateReservationCategory,
  useUpdateReservationCategory,
  useDeleteReservationCategory,
  useMoveReservation,
  useDeleteReservation,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  appointmentCreateSchema,
  type AppointmentCreateInput,
  appointmentUpdateSchema,
  type AppointmentUpdateInput,
  slotReservationCreateSchema,
  type SlotReservationCreateInput,
  slotReservationUpdateSchema,
  type SlotReservationUpdateInput,
  APPOINTMENT_TYPES,
  APPOINTMENT_STATUSES,
} from "@/lib/schemas";
import type { AppointmentDTO, AppointmentStatus, SlotReservationDTO, ReservationCategoryDTO } from "@/types/domain";

type ViewMode = "month" | "week" | "day";
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_PX = 40; // height of one hour row in week/day view (compact)
const SNAP_MIN = 15; // drag-and-drop snaps to 15-minute increments

// ─── helpers ─────────────────────────────────────────────────────────────────

function apptsForDay(appts: AppointmentDTO[] | undefined, day: Date): AppointmentDTO[] {
  return (appts ?? []).filter((a) => isSameDay(new Date(a.start), day));
}

function reservationsForDay(rs: SlotReservationDTO[] | undefined, day: Date): SlotReservationDTO[] {
  return (rs ?? []).filter((r) => isSameDay(new Date(r.start), day));
}

// Whether two [start, start+duration) ranges overlap, used to flag a
// reservation that collides with an appointment (visual warning only — we
// don't block saving, per the agreed behavior).
function rangesOverlap(
  aStart: Date,
  aDurationMin: number,
  bStart: Date,
  bDurationMin: number,
): boolean {
  const aEnd = addMinutes(aStart, aDurationMin).getTime();
  const bEnd = addMinutes(bStart, bDurationMin).getTime();
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}

// Google Calendar-style overlap layout: events that overlap in time are
// assigned to side-by-side "lanes" within their overlap group, each lane
// narrower and slightly offset so every event stays at least partially
// visible instead of one fully hiding behind another. Two events that
// don't overlap each other directly but each overlap a third (e.g. A+B
// and B+C) still share one group, since B's lane choice constrains both.
//
// Returns, for each item (by its original index), the lane it was
// assigned and the total lane count of its group — from these two numbers
// the caller derives a width percentage and left offset.
function computeOverlapLayout<T>(
  items: T[],
  getStart: (item: T) => Date,
  getDurationMin: (item: T) => number,
): { lane: number; laneCount: number }[] {
  const n = items.length;
  const result: { lane: number; laneCount: number }[] = items.map(() => ({ lane: 0, laneCount: 1 }));
  if (n === 0) return result;

  const order = items
    .map((item, i) => ({ i, start: getStart(item), end: addMinutes(getStart(item), getDurationMin(item)) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Union-find to group items that are connected through any chain of
  // overlaps, even if two particular items don't directly overlap.
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let a = 0; a < order.length; a++) {
    for (let b = a + 1; b < order.length; b++) {
      if (order[b].start.getTime() >= order[a].end.getTime()) break;
      union(order[a].i, order[b].i);
    }
  }

  const groups = new Map<number, number[]>();
  for (const { i } of order) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  for (const indices of groups.values()) {
    if (indices.length === 1) continue; // common case: no overlap, default lane 0/1 stands
    const sorted = [...indices].sort(
      (ia, ib) => getStart(items[ia]).getTime() - getStart(items[ib]).getTime(),
    );
    const laneEndTimes: number[] = []; // end time currently occupying each lane
    const laneOf = new Map<number, number>();
    for (const idx of sorted) {
      const start = getStart(items[idx]).getTime();
      const end = addMinutes(getStart(items[idx]), getDurationMin(items[idx])).getTime();
      let lane = laneEndTimes.findIndex((endTime) => endTime <= start);
      if (lane === -1) {
        lane = laneEndTimes.length;
        laneEndTimes.push(end);
      } else {
        laneEndTimes[lane] = end;
      }
      laneOf.set(idx, lane);
    }
    const laneCount = laneEndTimes.length;
    for (const idx of sorted) {
      result[idx] = { lane: laneOf.get(idx)!, laneCount };
    }
  }

  return result;
}

// Translates a lane assignment into left/width percentages with the
// partial-overlap look from the reference screenshot: lanes don't split
// the column into equal, non-touching slices — each successive lane
// starts further right and is narrower, while still overlapping the
// previous one by a fixed margin so part of every event stays visible
// no matter how many share the slot.
function computeLaneStyle(lane: number, laneCount: number): { left: string; width: string } {
  if (laneCount <= 1) return { left: "4px", width: "calc(100% - 8px)" };
  const stepPct = 100 / (laneCount + 1); // each lane shifts by less than a full share, creating the overlap
  const widthPct = 100 - stepPct * (laneCount - 1) * 0.6; // later lanes still wide enough to read
  return {
    left: `calc(${lane * stepPct}% + 4px)`,
    width: `calc(${Math.max(widthPct, 55)}% - 8px)`,
  };
}

// Adds `minutes` to a "HH:mm" string, used only to seed a sensible default
// end time (start + 45min) when a create dialog first opens.
function addMinutesToTimeStr(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

// Human-readable duration label ("1h 30min") shown next to the end-time
// field as the start/end times change, so the person sees the derived
// duration without ever typing it in directly. Returns null while the
// fields don't form a valid positive range yet (e.g. end before start).
function computeDurationLabel(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

// Minutes elapsed since midnight, refreshed every minute, so the "current
// time" line in week/day view stays accurate if the page is left open.

// Generates "HH:mm" options every 15 minutes across the day, used by
// TimeSelect so people pick a start/end time from a dropdown instead of
// typing it in by hand. Starts at 00:00 and covers the full 24h so an
// existing appointment/reservation outside the usual 7–20h agenda window
// (e.g. one entered before this feature existed) still has its exact time
// available as an option.
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}
const TIME_OPTIONS = generateTimeOptions();

// Spanish display labels for each appointment status, used by both the
// quick status picker and the calendar block styling.
const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  programada: "Programada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No asistió",
};

// Dropdown for picking a time in 15-minute steps. If the current value
// doesn't fall on a 15-minute mark (e.g. an older record saved at :05),
// it's still included as an extra option so the field never silently
// shows something different from what's actually saved.
function TimeSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const options = TIME_OPTIONS.includes(value) || !value
    ? TIME_OPTIONS
    : [...TIME_OPTIONS, value].sort();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue placeholder="Hora" />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function useNowMinutes(): number {
  const [minutes, setMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return minutes;
}

// ─── Main component ──────────────────────────────────────────────────────────

export function CalendarView() {
  const today = new Date();
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState<Date>(today);
  const [filterTherapistId, setFilterTherapistId] = useState<string>("all");
  const [miniCalOpen, setMiniCalOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentDTO | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<SlotReservationDTO | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reservationOpen, setReservationOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState<{ date: string; time: string }>({
    date: format(today, "yyyy-MM-dd"),
    time: "10:00",
  });

  const { data: professionals } = useProfessionals();
  const moveAppt = useMoveAppointment();
  const moveReservation = useMoveReservation();
  const createAppt = useCreateAppointment();
  const createReservation = useCreateReservation();

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

  const { data: reservations } = useReservations({
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

  const openCreateAppt = (date?: Date, time?: string) => {
    setCreatePreset({
      date: format(date ?? new Date(), "yyyy-MM-dd"),
      time: time ?? "10:00",
    });
    setCreateOpen(true);
  };

  const openCreateReservation = (date?: Date, time?: string) => {
    setCreatePreset({
      date: format(date ?? new Date(), "yyyy-MM-dd"),
      time: time ?? "10:00",
    });
    setReservationOpen(true);
  };

  async function handleDropAppt(id: string, newStart: Date) {
    try {
      await moveAppt.mutateAsync({ id, start: newStart.toISOString() });
      toast({ title: "Cita movida" });
    } catch {
      toast({ title: "Error al mover la cita", variant: "destructive" });
    }
  }

  async function handleDropReservation(id: string, newStart: Date) {
    try {
      await moveReservation.mutateAsync({ id, start: newStart.toISOString() });
      toast({ title: "Reserva movida" });
    } catch {
      toast({ title: "Error al mover la reserva", variant: "destructive" });
    }
  }

  async function handleResizeAppt(id: string, newStart: Date, newDurationMin: number) {
    try {
      await moveAppt.mutateAsync({ id, start: newStart.toISOString(), durationMin: newDurationMin });
    } catch {
      toast({ title: "Error al cambiar la duración", variant: "destructive" });
    }
  }

  async function handleResizeReservation(id: string, newStart: Date, newDurationMin: number) {
    try {
      await moveReservation.mutateAsync({ id, start: newStart.toISOString(), durationMin: newDurationMin });
    } catch {
      toast({ title: "Error al cambiar la duración", variant: "destructive" });
    }
  }

  async function handleDuplicateAppt(a: AppointmentDTO) {
    try {
      const newStart = addMinutes(new Date(a.start), 60);
      await createAppt.mutateAsync({
        patientId: a.patientId,
        therapistId: a.therapistId,
        date: format(newStart, "yyyy-MM-dd"),
        time: format(newStart, "HH:mm"),
        endTime: format(addMinutes(newStart, a.durationMin), "HH:mm"),
        type: a.type,
        notes: a.notes ?? "",
      } as any);
      toast({ title: "Cita duplicada" });
    } catch {
      toast({ title: "Error al duplicar la cita", variant: "destructive" });
    }
  }

  async function handleDuplicateReservation(r: SlotReservationDTO) {
    try {
      const newStart = addMinutes(new Date(r.start), 60);
      await createReservation.mutateAsync({
        therapistId: r.therapistId,
        categoryId: r.categoryId ?? undefined,
        title: r.title,
        date: format(newStart, "yyyy-MM-dd"),
        time: format(newStart, "HH:mm"),
        endTime: format(addMinutes(newStart, r.durationMin), "HH:mm"),
      } as any);
      toast({ title: "Reserva duplicada" });
    } catch {
      toast({ title: "Error al duplicar la reserva", variant: "destructive" });
    }
  }

  const title = useMemo(() => {
    if (view === "month") return format(cursor, "MMMM yyyy", { locale: es });
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = endOfWeek(cursor, { weekStartsOn: 1 });
      return `${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM yyyy", { locale: es })}`;
    }
    return format(cursor, "EEEE d 'de' MMMM yyyy", { locale: es });
  }, [view, cursor]);

  const sharedViewProps = {
    appts: appts ?? [],
    reservations: reservations ?? [],
    onSelectAppt: setSelectedAppt,
    onSelectReservation: setSelectedReservation,
    onCreateAppt: openCreateAppt,
    onCreateReservation: openCreateReservation,
    onDropAppt: handleDropAppt,
    onDropReservation: handleDropReservation,
    onResizeAppt: handleResizeAppt,
    onResizeReservation: handleResizeReservation,
    onDuplicateAppt: handleDuplicateAppt,
    onDuplicateReservation: handleDuplicateReservation,
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-semibold capitalize">{title}</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => openCreateAppt()}>
              <Plus className="w-4 h-4 mr-1" />
              Nueva cita
            </Button>
            <Button size="sm" variant="outline" onClick={() => openCreateReservation()}>
              <Lock className="w-4 h-4 mr-1" />
              Reserva de espacio
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b">
          <div className="flex items-center gap-1.5">
            <Popover open={miniCalOpen} onOpenChange={setMiniCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Abrir calendario"
                >
                  <CalendarIcon className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={cursor}
                  onSelect={(d) => {
                    if (d) {
                      setCursor(d);
                      setMiniCalOpen(false);
                    }
                  }}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigate("prev")}
              aria-label="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-7" onClick={() => navigate("today")}>
              Hoy
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigate("next")}
              aria-label="Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="month">Mes</TabsTrigger>
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="day">Día</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={filterTherapistId} onValueChange={setFilterTherapistId}>
              <SelectTrigger aria-label="Filtrar por terapeuta" className="w-[200px] h-8 text-muted-foreground">
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
          </div>
        </div>
      </div>

      {/* Calendar body */}
      {isLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : view === "month" ? (
        <MonthView cursor={cursor} {...sharedViewProps} />
      ) : view === "week" ? (
        <WeekView cursor={cursor} {...sharedViewProps} />
      ) : (
        <DayView cursor={cursor} {...sharedViewProps} />
      )}

      {/* Detail dialogs */}
      <AppointmentDetailDialog
        appt={selectedAppt}
        onClose={() => setSelectedAppt(null)}
      />
      <ReservationDetailDialog
        reservation={selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />

      {/* Create dialogs */}
      <AppointmentFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        preset={createPreset}
      />
      <ReservationFormDialog
        mode="create"
        open={reservationOpen}
        onOpenChange={setReservationOpen}
        preset={createPreset}
      />
    </div>
  );
}

// ─── Shared view props type ──────────────────────────────────────────────────

type SharedViewProps = {
  appts: AppointmentDTO[];
  reservations: SlotReservationDTO[];
  onSelectAppt: (a: AppointmentDTO) => void;
  onSelectReservation: (r: SlotReservationDTO) => void;
  onCreateAppt: (date?: Date, time?: string) => void;
  onCreateReservation: (date?: Date, time?: string) => void;
  onDropAppt: (id: string, newStart: Date) => void;
  onDropReservation: (id: string, newStart: Date) => void;
  onResizeAppt: (id: string, newStart: Date, newDurationMin: number) => void;
  onResizeReservation: (id: string, newStart: Date, newDurationMin: number) => void;
  onDuplicateAppt: (a: AppointmentDTO) => void;
  onDuplicateReservation: (r: SlotReservationDTO) => void;
};

// ─── Empty-slot trigger: hover tooltip with the hour + click menu ───────────
//
// Wraps an empty calendar cell/slot. Hovering shows a small "HH:mm" tooltip;
// clicking opens a tiny menu to choose "Nueva cita" or "Reserva de espacio"
// instead of jumping straight into a form.

// ─── Resize handle: thin draggable strip at the top/bottom edge of an
// appointment or reservation block in week/day view ──────────────────────
//
// Invisible at rest, shown as a subtle bar on hover of the parent block
// (via the parent's `group` class), with a row-resize cursor. Dragging it
// is handled entirely by the parent DayColumn (global mousemove/mouseup),
// this just reports the mousedown that starts the gesture.

function ResizeHandle({
  position,
  onStart,
}: {
  position: "top" | "bottom";
  onStart: () => void;
}) {
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onStart();
      }}
      className={`absolute left-0 right-0 h-2 cursor-row-resize z-10 flex items-center justify-center ${
        position === "top" ? "-top-1" : "-bottom-1"
      }`}
    >
      <div className="w-6 h-[3px] rounded-full bg-foreground/0 group-hover:bg-foreground/25 transition-colors" />
    </div>
  );
}

function EmptySlotTrigger({
  label,
  onCreateAppt,
  onCreateReservation,
  className,
  style,
}: {
  label: string;
  onCreateAppt: () => void;
  onCreateReservation: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={`relative block w-full text-left ${className ?? ""}`}
          style={style}
          aria-label={`Añadir en ${label}`}
        >
          {hover && (
            <span className="pointer-events-none absolute z-20 left-1 top-0 -translate-y-1/2 bg-popover border border-border rounded px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm whitespace-nowrap">
              {label}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={onCreateAppt}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva cita
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreateReservation}>
          <Lock className="w-4 h-4 mr-2" />
          Reserva de espacio
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Month view ──────────────────────────────────────────────────────────────

function MonthView({
  cursor,
  appts,
  reservations,
  onSelectAppt,
  onSelectReservation,
  onCreateAppt,
  onCreateReservation,
  onDropAppt,
  onDropReservation,
  onDuplicateAppt,
  onDuplicateReservation,
}: SharedViewProps & { cursor: Date }) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const today = new Date();
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

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
          const dayReservations = reservationsForDay(reservations, day);
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, today);
          const dayKey = day.toISOString();
          const isDragOver = dragOverDay === dayKey;
          const totalItems = dayAppts.length + dayReservations.length;
          const overflow = Math.max(0, totalItems - 3);

          return (
            <div
              key={dayKey}
              role="gridcell"
              aria-current={isToday ? "date" : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDay(dayKey);
              }}
              onDragLeave={() => setDragOverDay((d) => (d === dayKey ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverDay(null);
                const raw = e.dataTransfer.getData("text/plain");
                if (!raw) return;
                const payload = JSON.parse(raw) as { kind: "appt" | "reservation"; id: string; start: string };
                const original = new Date(payload.start);
                const newStart = new Date(day);
                newStart.setHours(original.getHours(), original.getMinutes(), 0, 0);
                if (payload.kind === "appt") onDropAppt(payload.id, newStart);
                else onDropReservation(payload.id, newStart);
              }}
              className={`min-h-[92px] sm:min-h-[110px] rounded-md border p-1.5 flex flex-col gap-1 group ${
                inMonth ? "bg-card" : "bg-muted/30"
              } ${isDragOver ? "ring-2 ring-primary bg-accent/40" : isToday ? "bg-accent/40 border-border" : "border-border"}`}
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => onCreateAppt(day)}
                  className="self-start text-xs font-medium rounded-full w-6 h-6 flex items-center justify-center transition-colors hover:bg-muted"
                  aria-label={`Añadir cita el ${format(day, "d 'de' MMMM", { locale: es })}`}
                >
                  <span className={isToday ? "font-semibold" : ""}>{format(day, "d")}</span>
                </button>
                <EmptySlotTrigger
                  label={format(day, "d MMM", { locale: es })}
                  onCreateAppt={() => onCreateAppt(day)}
                  onCreateReservation={() => onCreateReservation(day)}
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>

              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                {dayReservations.slice(0, 3).map((r) => {
                  const overlapsAppt = dayAppts.some((a) =>
                    rangesOverlap(new Date(r.start), r.durationMin, new Date(a.start), a.durationMin),
                  );
                  return (
                    <ContextMenu key={r.id}>
                      <ContextMenuTrigger asChild>
                        <button
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              "text/plain",
                              JSON.stringify({ kind: "reservation", id: r.id, start: r.start }),
                            );
                          }}
                          onClick={() => onSelectReservation(r)}
                          className={`flex items-center gap-1.5 text-left text-[12px] leading-tight px-1.5 py-0.5 rounded border truncate transition-colors hover:opacity-80 ${
                            overlapsAppt
                              ? "bg-amber-50 border-amber-300"
                              : r.categoryColor
                                ? "border-transparent"
                                : "bg-muted/60 border-border"
                          }`}
                          style={
                            !overlapsAppt && r.categoryColor
                              ? { backgroundColor: `${r.categoryColor}33`, borderColor: `${r.categoryColor}80` }
                              : undefined
                          }
                          title={`${r.title} · ${format(new Date(r.start), "HH:mm")}${r.categoryName ? ` · ${r.categoryName}` : ""}${overlapsAppt ? " · Se solapa con una cita" : ""}`}
                        >
                          <Lock className="w-3 h-3 shrink-0 text-muted-foreground" />
                          <span className="font-semibold shrink-0">{format(new Date(r.start), "HH:mm")}</span>
                          <span className="truncate text-foreground/80">{r.title}</span>
                          {overlapsAppt && <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600 ml-auto" />}
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => onDuplicateReservation(r)}>
                          <Copy className="w-4 h-4 mr-2" /> Duplicar reserva
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => onSelectReservation(r)}>
                          <Pencil className="w-4 h-4 mr-2" /> Editar reserva
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
                {dayAppts.slice(0, Math.max(0, 3 - dayReservations.length)).map((a) => (
                  <ContextMenu key={a.id}>
                    <ContextMenuTrigger asChild>
                      <button
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "text/plain",
                            JSON.stringify({ kind: "appt", id: a.id, start: a.start }),
                          );
                        }}
                        onClick={() => onSelectAppt(a)}
                        className={`relative flex items-center gap-1.5 text-left text-[12px] leading-tight px-1.5 py-0.5 rounded border truncate transition-colors hover:bg-muted/60 cursor-grab active:cursor-grabbing ${
                          a.status === "cancelada"
                            ? "bg-muted/40 border-border opacity-60"
                            : a.status === "no_show"
                              ? "bg-red-50 border-red-200"
                              : "bg-card border-border"
                        }`}
                        title={`${a.patientName} · ${format(new Date(a.start), "HH:mm")} · ${APPOINTMENT_STATUS_LABELS[a.status]}`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: a.patientColor }}
                        />
                        <span className={`font-semibold shrink-0 ${a.status === "cancelada" ? "line-through" : ""}`}>
                          {format(new Date(a.start), "HH:mm")}
                        </span>
                        <span className={`truncate text-foreground/90 ${a.status === "cancelada" ? "line-through" : ""}`}>
                          {a.patientName}
                        </span>
                        {a.status === "completada" && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                            <Check className="w-2 h-2 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => onDuplicateAppt(a)}>
                        <Copy className="w-4 h-4 mr-2" /> Duplicar cita
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => onSelectAppt(a)}>
                        <Pencil className="w-4 h-4 mr-2" /> Editar cita
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
                {overflow > 0 && (
                  <span className="text-[12px] text-muted-foreground px-1.5">
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
  reservations,
  onSelectAppt,
  onSelectReservation,
  onCreateAppt,
  onCreateReservation,
  onDropAppt,
  onDropReservation,
  onResizeAppt,
  onResizeReservation,
  onDuplicateAppt,
  onDuplicateReservation,
}: SharedViewProps & { cursor: Date }) {
  const weekStart = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  return (
    <Card className="p-2 sm:p-4">
      <div className="overflow-x-auto">
        <div
          className="min-w-[640px]"
          role="grid"
          aria-label="Vista semanal"
        >
          {/* Header row */}
          <div className="grid grid-cols-[44px_repeat(7,1fr)] sticky top-0 bg-card z-10">
            <div />
            {days.map((d) => {
              const isToday = isSameDay(d, today);
              return (
                <div
                  key={d.toISOString()}
                  role="columnheader"
                  className={`text-center py-1 border-b border-border rounded-t-md ${
                    isToday ? "text-primary bg-accent/40" : "text-foreground"
                  }`}
                >
                  <div className="text-[11px] font-medium uppercase text-muted-foreground">
                    {WEEKDAYS[(d.getDay() + 6) % 7]}
                  </div>
                  <div
                    className={`text-xs font-semibold inline-flex items-center justify-center w-5 h-5 rounded-full ${
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
          <div className="grid grid-cols-[44px_repeat(7,1fr)] relative">
            {/* Hours column */}
            <div className="relative">
              {hours.map((h) => (
                <div
                  key={h}
                  className="text-[11px] text-muted-foreground text-right pr-1.5 border-t border-border"
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
                reservations={reservationsForDay(reservations, d)}
                onSelectAppt={onSelectAppt}
                onSelectReservation={onSelectReservation}
                onCreateAppt={onCreateAppt}
                onCreateReservation={onCreateReservation}
                onDropAppt={onDropAppt}
                onDropReservation={onDropReservation}
                onResizeAppt={onResizeAppt}
                onResizeReservation={onResizeReservation}
                onDuplicateAppt={onDuplicateAppt}
                onDuplicateReservation={onDuplicateReservation}
                compact
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
  reservations,
  onSelectAppt,
  onSelectReservation,
  onCreateAppt,
  onCreateReservation,
  onDropAppt,
  onDropReservation,
  onResizeAppt,
  onResizeReservation,
  onDuplicateAppt,
  onDuplicateReservation,
}: SharedViewProps & { cursor: Date }) {
  const today = new Date();
  const dayAppts = apptsForDay(appts, cursor);
  const dayReservations = reservationsForDay(reservations, cursor);
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  return (
    <Card className="p-2 sm:p-4">
      <div className="overflow-x-auto">
        <div className="min-w-[360px]" role="grid" aria-label="Vista diaria">
          <div className="grid grid-cols-[64px_1fr]">
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

          <div className="grid grid-cols-[64px_1fr] relative">
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
              reservations={dayReservations}
              onSelectAppt={onSelectAppt}
              onSelectReservation={onSelectReservation}
              onCreateAppt={onCreateAppt}
              onCreateReservation={onCreateReservation}
              onDropAppt={onDropAppt}
              onDropReservation={onDropReservation}
              onResizeAppt={onResizeAppt}
              onResizeReservation={onResizeReservation}
              onDuplicateAppt={onDuplicateAppt}
              onDuplicateReservation={onDuplicateReservation}
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
  reservations,
  onSelectAppt,
  onSelectReservation,
  onCreateAppt,
  onCreateReservation,
  onDropAppt,
  onDropReservation,
  onResizeAppt,
  onResizeReservation,
  onDuplicateAppt,
  onDuplicateReservation,
  compact = false,
}: {
  day: Date;
  appts: AppointmentDTO[];
  reservations: SlotReservationDTO[];
  onSelectAppt: (a: AppointmentDTO) => void;
  onSelectReservation: (r: SlotReservationDTO) => void;
  onCreateAppt: (date?: Date, time?: string) => void;
  onCreateReservation: (date?: Date, time?: string) => void;
  onDropAppt: (id: string, newStart: Date) => void;
  onDropReservation: (id: string, newStart: Date) => void;
  onResizeAppt: (id: string, newStart: Date, newDurationMin: number) => void;
  onResizeReservation: (id: string, newStart: Date, newDurationMin: number) => void;
  onDuplicateAppt: (a: AppointmentDTO) => void;
  onDuplicateReservation: (r: SlotReservationDTO) => void;
  compact?: boolean;
}) {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
  const nowMinutes = useNowMinutes();
  const isToday = isSameDay(day, new Date());
  const nowOffsetMin = nowMinutes - HOUR_START * 60;
  const showNowLine = isToday && nowOffsetMin >= 0 && nowOffsetMin <= (HOUR_END - HOUR_START) * 60;
  const nowTop = (nowOffsetMin / 60) * HOUR_PX;
  const colRef = useRef<HTMLDivElement>(null);
  const [dragOverMin, setDragOverMin] = useState<number | null>(null);

  // Combine appointments and reservations into one timeline for overlap
  // layout purposes — they occupy the same visual column, so a reservation
  // overlapping an appointment needs to make room for it just as much as
  // two appointments would for each other.
  type LaneItem = { kind: "appt" | "reservation"; id: string; start: Date; durationMin: number };
  const laneItems: LaneItem[] = useMemo(
    () => [
      ...appts.map((a) => ({ kind: "appt" as const, id: a.id, start: new Date(a.start), durationMin: a.durationMin })),
      ...reservations.map((r) => ({
        kind: "reservation" as const,
        id: r.id,
        start: new Date(r.start),
        durationMin: r.durationMin,
      })),
    ],
    [appts, reservations],
  );
  const overlapLayout = useMemo(
    () => computeOverlapLayout(laneItems, (it) => it.start, (it) => it.durationMin),
    [laneItems],
  );
  function laneFor(kind: "appt" | "reservation", id: string): { lane: number; laneCount: number } {
    const idx = laneItems.findIndex((it) => it.kind === kind && it.id === id);
    return idx === -1 ? { lane: 0, laneCount: 1 } : overlapLayout[idx];
  }

  // Resize-by-dragging-the-edge state. Tracks which block is being resized,
  // which edge (top = change start, bottom = change end/duration), and a
  // live preview of the in-progress start/duration so the block redraws
  // immediately as the mouse moves, before the request to save it resolves.
  const [resizing, setResizing] = useState<{
    kind: "appt" | "reservation";
    id: string;
    edge: "top" | "bottom";
    originalStartMin: number;
    originalDurationMin: number;
    previewStartMin: number;
    previewDurationMin: number;
  } | null>(null);

  // The browser fires a native "click" right after "mouseup", even when
  // that mouseup ends a drag. By the time the click handler below runs,
  // `resizing` state has already been cleared by onUp, so checking
  // `!resizing` there is too late to suppress it. This ref is set the
  // instant a resize finishes and is checked (then cleared) by onClick,
  // so the one click that follows a resize gesture is swallowed without
  // affecting any other click.
  const justResizedRef = useRef(false);

  function minutesFromPointerY(clientY: number): number {
    const rect = colRef.current?.getBoundingClientRect();
    if (!rect) return HOUR_START * 60;
    const y = clientY - rect.top;
    const rawMin = HOUR_START * 60 + (y / HOUR_PX) * 60;
    return Math.max(HOUR_START * 60, Math.round(rawMin / SNAP_MIN) * SNAP_MIN);
  }

  function startFromMinutes(min: number): Date {
    const d = new Date(day);
    d.setHours(0, min, 0, 0);
    return d;
  }

  function beginResize(
    kind: "appt" | "reservation",
    id: string,
    edge: "top" | "bottom",
    startMin: number,
    durationMin: number,
  ) {
    setResizing({
      kind,
      id,
      edge,
      originalStartMin: startMin,
      originalDurationMin: durationMin,
      previewStartMin: startMin,
      previewDurationMin: durationMin,
    });
  }

  useEffect(() => {
    if (!resizing) return;

    function onMove(e: MouseEvent) {
      const pointerMin = minutesFromPointerY(e.clientY);
      setResizing((r) => {
        if (!r) return r;
        if (r.edge === "bottom") {
          const newDuration = Math.max(SNAP_MIN, pointerMin - r.originalStartMin);
          return { ...r, previewDurationMin: newDuration };
        }
        // Top edge: moving the start while keeping the end fixed.
        const endMin = r.originalStartMin + r.originalDurationMin;
        const newStart = Math.min(pointerMin, endMin - SNAP_MIN);
        return { ...r, previewStartMin: newStart, previewDurationMin: endMin - newStart };
      });
    }

    function onUp() {
      justResizedRef.current = true;
      setResizing((r) => {
        if (!r) return null;
        const newStart = startFromMinutes(r.previewStartMin);
        if (r.kind === "appt") onResizeAppt(r.id, newStart, r.previewDurationMin);
        else onResizeReservation(r.id, newStart, r.previewDurationMin);
        return null;
      });
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [resizing?.id]);

  function handleBlockClick(openDetail: () => void) {
    if (justResizedRef.current) {
      justResizedRef.current = false;
      return;
    }
    openDetail();
  }

  return (
    <div
      ref={colRef}
      role="gridcell"
      className="relative border-l border-border"
      style={{ height: (HOUR_END - HOUR_START + 1) * HOUR_PX }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOverMin(minutesFromPointerY(e.clientY));
      }}
      onDragLeave={() => setDragOverMin(null)}
      onDrop={(e) => {
        e.preventDefault();
        const min = dragOverMin ?? minutesFromPointerY(e.clientY);
        setDragOverMin(null);
        const raw = e.dataTransfer.getData("text/plain");
        if (!raw) return;
        const payload = JSON.parse(raw) as { kind: "appt" | "reservation"; id: string; start: string };
        const newStart = startFromMinutes(min);
        if (payload.kind === "appt") onDropAppt(payload.id, newStart);
        else onDropReservation(payload.id, newStart);
      }}
    >
      {/* Hour slots: each hour is split into 4 quarter-hour hover/click
          targets so the tooltip and the create-menu reflect the exact slot
          under the cursor instead of only the top of the hour. */}
      {hours.map((h) => (
        <div key={h} className="relative" style={{ height: HOUR_PX }}>
          {[0, 15, 30, 45].map((m) => {
            const slotDate = new Date(day);
            slotDate.setHours(h, m, 0, 0);
            return (
              <div
                key={m}
                className="absolute left-0 right-0"
                style={{ top: (m / 60) * HOUR_PX, height: HOUR_PX / 4 }}
              >
                <EmptySlotTrigger
                  label={`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`}
                  onCreateAppt={() => onCreateAppt(slotDate, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)}
                  onCreateReservation={() =>
                    onCreateReservation(slotDate, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
                  }
                  className="h-full w-full hover:bg-accent/40 transition-colors"
                />
              </div>
            );
          })}
          <div className="absolute top-0 left-0 right-0 border-t border-border pointer-events-none" />
        </div>
      ))}

      {/* Drag-over indicator line */}
      {dragOverMin !== null && (
        <div
          className="absolute left-0 right-0 border-t-2 border-primary z-20 pointer-events-none"
          style={{ top: ((dragOverMin - HOUR_START * 60) / 60) * HOUR_PX }}
        />
      )}

      {/* Current time line */}
      {showNowLine && (
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ top: nowTop }}
          aria-hidden="true"
        >
          <div className="relative h-0 border-t-[1.5px] border-orange-500">
            <span className="absolute -left-[3px] -top-[4px] w-2 h-2 rounded-full bg-orange-500" />
          </div>
        </div>
      )}

      {/* Reservations (rendered behind appointments, same lane) */}
      {reservations.map((r) => {
        const start = new Date(r.start);
        const startMins = start.getHours() * 60 + start.getMinutes();
        const isResizingThis = resizing?.kind === "reservation" && resizing.id === r.id;
        const effectiveStartMin = isResizingThis ? resizing.previewStartMin : startMins;
        const effectiveDuration = isResizingThis ? resizing.previewDurationMin : r.durationMin;
        const offsetMin = effectiveStartMin - HOUR_START * 60;
        if (offsetMin + effectiveDuration <= 0) return null;
        const top = Math.max(0, (offsetMin / 60) * HOUR_PX);
        const height = (effectiveDuration / 60) * HOUR_PX - 2;
        const effectiveStart = startFromMinutes(effectiveStartMin);
        const end = addMinutes(effectiveStart, effectiveDuration);
        const overlapsAppt = appts.some((a) =>
          rangesOverlap(effectiveStart, effectiveDuration, new Date(a.start), a.durationMin),
        );
        const { lane, laneCount } = laneFor("reservation", r.id);
        const laneStyle = computeLaneStyle(lane, laneCount);
        return (
          <ContextMenu key={r.id}>
            <ContextMenuTrigger asChild>
              <div
                draggable={!resizing}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "reservation", id: r.id, start: r.start }));
                }}
                onClick={() => handleBlockClick(() => onSelectReservation(r))}
                role="button"
                tabIndex={0}
                className={`group absolute rounded-md px-1.5 py-1 text-left overflow-visible border z-[5] cursor-grab active:cursor-grabbing transition-transform hover:scale-[1.01] hover:z-20 focus:outline-none focus:ring-2 focus:ring-ring ${
                  overlapsAppt
                    ? "bg-amber-50 border-amber-300"
                    : r.categoryColor
                      ? "border-transparent"
                      : "bg-muted/70 border-border"
                }`}
                style={{
                  top,
                  height: Math.max(18, height),
                  left: laneStyle.left,
                  width: laneStyle.width,
                  zIndex: 5 + lane,
                  ...(!overlapsAppt && r.categoryColor
                    ? { backgroundColor: `${r.categoryColor}33`, borderColor: `${r.categoryColor}80` }
                    : {}),
                }}
                aria-label={`Reserva de espacio "${r.title}" ${format(effectiveStart, "HH:mm")}–${format(end, "HH:mm")}${r.categoryName ? `, ${r.categoryName}` : ""}${overlapsAppt ? ", se solapa con una cita" : ""}`}
              >
                <ResizeHandle
                  position="top"
                  onStart={() => beginResize("reservation", r.id, "top", startMins, r.durationMin)}
                />
                <div className="overflow-hidden h-full">
                  <p className="text-[11px] font-semibold leading-tight truncate flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 shrink-0" />
                    {format(effectiveStart, "HH:mm")}–{format(end, "HH:mm")}
                    {overlapsAppt && <AlertTriangle className="w-2.5 h-2.5 text-amber-600 ml-auto shrink-0" />}
                  </p>
                  <p className="text-[11px] font-medium leading-tight truncate text-foreground/80">{r.title}</p>
                </div>
                <ResizeHandle
                  position="bottom"
                  onStart={() => beginResize("reservation", r.id, "bottom", startMins, r.durationMin)}
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onDuplicateReservation(r)}>
                <Copy className="w-4 h-4 mr-2" /> Duplicar reserva
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onSelectReservation(r)}>
                <Pencil className="w-4 h-4 mr-2" /> Editar reserva
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}

      {/* Appointments */}
      {appts.map((a) => {
        const start = new Date(a.start);
        const startMins = start.getHours() * 60 + start.getMinutes();
        const isResizingThis = resizing?.kind === "appt" && resizing.id === a.id;
        const effectiveStartMin = isResizingThis ? resizing.previewStartMin : startMins;
        const effectiveDuration = isResizingThis ? resizing.previewDurationMin : a.durationMin;
        const offsetMin = effectiveStartMin - HOUR_START * 60;
        if (offsetMin + effectiveDuration <= 0) return null;
        const top = Math.max(0, (offsetMin / 60) * HOUR_PX);
        const height = (effectiveDuration / 60) * HOUR_PX - 2;
        const effectiveStart = startFromMinutes(effectiveStartMin);
        const end = addMinutes(effectiveStart, effectiveDuration);
        const { lane, laneCount } = laneFor("appt", a.id);
        const laneStyle = computeLaneStyle(lane, laneCount);
        return (
          <ContextMenu key={a.id}>
            <ContextMenuTrigger asChild>
              <div
                draggable={!resizing}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "appt", id: a.id, start: a.start }));
                }}
                onClick={() => handleBlockClick(() => onSelectAppt(a))}
                role="button"
                tabIndex={0}
                className={`group absolute rounded-md px-1.5 py-1 text-left overflow-visible border z-[6] cursor-grab active:cursor-grabbing transition-transform hover:scale-[1.01] hover:z-20 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring ${
                  a.status === "cancelada"
                    ? "bg-muted/40 border-border opacity-60"
                    : a.status === "no_show"
                      ? "bg-red-50 border-red-200"
                      : "bg-card border-border"
                }`}
                style={{
                  top,
                  height: Math.max(18, height),
                  left: laneStyle.left,
                  width: laneStyle.width,
                  zIndex: 6 + lane,
                  borderLeft: `3px solid ${a.patientColor}`,
                }}
                aria-label={`Cita de ${a.patientName} ${format(effectiveStart, "HH:mm")}–${format(end, "HH:mm")}, ${APPOINTMENT_STATUS_LABELS[a.status]}`}
              >
                <ResizeHandle
                  position="top"
                  onStart={() => beginResize("appt", a.id, "top", startMins, a.durationMin)}
                />
                {a.status === "completada" && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-600 flex items-center justify-center shrink-0 z-10">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </span>
                )}
                <div className="overflow-hidden h-full">
                  <p className={`text-[11px] font-semibold leading-tight truncate ${a.status === "cancelada" ? "line-through" : ""}`}>
                    {format(effectiveStart, "HH:mm")}–{format(end, "HH:mm")}
                  </p>
                  <p className={`text-[11px] font-medium leading-tight truncate ${a.status === "cancelada" ? "line-through" : ""}`}>
                    {a.patientName}
                  </p>
                  {!compact && <p className="text-[11px] opacity-80 truncate">{a.type}</p>}
                </div>
                <ResizeHandle
                  position="bottom"
                  onStart={() => beginResize("appt", a.id, "bottom", startMins, a.durationMin)}
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onDuplicateAppt(a)}>
                <Copy className="w-4 h-4 mr-2" /> Duplicar cita
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onSelectAppt(a)}>
                <Pencil className="w-4 h-4 mr-2" /> Editar cita
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}

// ─── Appointment detail dialog ────────────────────────────────────────────────

function AppointmentDetailDialog({
  appt,
  onClose,
}: {
  appt: AppointmentDTO | null;
  onClose: () => void;
}) {
  if (!appt) return null;
  // Keying on appt.id resets internal state (isEditing) automatically
  // whenever a different appointment is selected, without needing an
  // effect to manually reset it.
  return <AppointmentDetailDialogInner key={appt.id} appt={appt} onClose={onClose} />;
}

function AppointmentDetailDialogInner({
  appt,
  onClose,
}: {
  appt: AppointmentDTO;
  onClose: () => void;
}) {
  const del = useDeleteAppointment();
  const updateStatus = useUpdateAppointmentStatus();
  const { selectPatient, navigate } = useNav();
  const [isEditing, setIsEditing] = useState(false);

  async function handleStatusChange(status: AppointmentStatus) {
    try {
      await updateStatus.mutateAsync({ id: appt.id, status });
      toast({ title: "Estado actualizado" });
    } catch {
      toast({ title: "Error al actualizar el estado", variant: "destructive" });
    }
  }

  async function handleDelete() {
    try {
      await del.mutateAsync(appt.id);
      toast({ title: "Cita eliminada" });
      onClose();
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  }

  if (isEditing) {
    return (
      <AppointmentFormDialog
        mode="edit"
        appt={appt}
        open
        onOpenChange={(o) => {
          if (!o) {
            setIsEditing(false);
            onClose();
          }
        }}
        onCancelEdit={() => setIsEditing(false)}
      />
    );
  }

  const start = new Date(appt.start);
  const end = addMinutes(start, appt.durationMin);

  return (
    <Dialog open={!!appt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <Select value={appt.status} onValueChange={(v) => handleStatusChange(v as AppointmentStatus)}>
          <SelectTrigger
            className={`absolute top-3 right-10 h-6 w-auto gap-1 border-none px-2 text-[12px] font-medium shadow-none focus:ring-0 ${
              appt.status === "completada"
                ? "bg-green-100 text-green-800"
                : appt.status === "cancelada"
                  ? "bg-muted text-muted-foreground"
                  : appt.status === "no_show"
                    ? "bg-red-100 text-red-800"
                    : "bg-muted/60 text-muted-foreground"
            }`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {APPOINTMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {APPOINTMENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="w-4 h-4 mr-1" /> Editar
            </Button>
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

// ─── Reservation detail dialog ───────────────────────────────────────────────

function ReservationDetailDialog({
  reservation,
  onClose,
}: {
  reservation: SlotReservationDTO | null;
  onClose: () => void;
}) {
  if (!reservation) return null;
  // Keying on reservation.id resets internal state (isEditing) automatically
  // whenever a different reservation is selected.
  return (
    <ReservationDetailDialogInner key={reservation.id} reservation={reservation} onClose={onClose} />
  );
}

function ReservationDetailDialogInner({
  reservation,
  onClose,
}: {
  reservation: SlotReservationDTO;
  onClose: () => void;
}) {
  const del = useDeleteReservation();
  const [isEditing, setIsEditing] = useState(false);

  async function handleDelete() {
    try {
      await del.mutateAsync(reservation.id);
      toast({ title: "Reserva eliminada" });
      onClose();
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  }

  if (isEditing) {
    return (
      <ReservationFormDialog
        mode="edit"
        reservation={reservation}
        open
        onOpenChange={(o) => {
          if (!o) {
            setIsEditing(false);
            onClose();
          }
        }}
        onCancelEdit={() => setIsEditing(false)}
      />
    );
  }

  const start = new Date(reservation.start);
  const end = addMinutes(start, reservation.durationMin);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            {reservation.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalle de la reserva de espacio &quot;{reservation.title}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span>
              {format(start, "EEEE d 'de' MMMM", { locale: es })} ·{" "}
              {format(start, "HH:mm")}–{format(end, "HH:mm")} ({reservation.durationMin} min)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Terapeuta:</span>
            <span className="font-medium">{reservation.therapistName}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="w-4 h-4 mr-1" /> Editar
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Cerrar
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={del.isPending}>
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Appointment form dialog (create & edit) ─────────────────────────────────

function AppointmentFormDialog({
  mode,
  appt,
  open,
  onOpenChange,
  preset,
  onCancelEdit,
}: {
  mode: "create" | "edit";
  appt?: AppointmentDTO;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset?: { date: string; time: string };
  onCancelEdit?: () => void;
}) {
  const create = useCreateAppointment();
  const update = useUpdateAppointment();
  const { data: patients } = usePatients();
  const { data: professionals } = useProfessionals();

  const schema = mode === "edit" ? appointmentUpdateSchema : appointmentCreateSchema;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<
    z.input<typeof appointmentCreateSchema> | z.input<typeof appointmentUpdateSchema>,
    any,
    AppointmentCreateInput | AppointmentUpdateInput
  >({
    resolver: zodResolver(schema as any),
    defaultValues:
      mode === "edit" && appt
        ? {
            patientId: appt.patientId,
            therapistId: appt.therapistId,
            date: format(new Date(appt.start), "yyyy-MM-dd"),
            time: format(new Date(appt.start), "HH:mm"),
            endTime: format(addMinutes(new Date(appt.start), appt.durationMin), "HH:mm"),
            type: appt.type,
            notes: appt.notes ?? "",
          }
        : {
            patientId: "",
            therapistId: "",
            date: preset?.date ?? format(new Date(), "yyyy-MM-dd"),
            time: preset?.time ?? "10:00",
            endTime: preset?.time ? addMinutesToTimeStr(preset.time, 45) : "10:45",
            type: "Sesión",
            notes: "",
          },
  });

  // Sync defaults whenever the dialog opens (new preset, or a different
  // appointment being edited).
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && appt) {
      reset({
        patientId: appt.patientId,
        therapistId: appt.therapistId,
        date: format(new Date(appt.start), "yyyy-MM-dd"),
        time: format(new Date(appt.start), "HH:mm"),
        endTime: format(addMinutes(new Date(appt.start), appt.durationMin), "HH:mm"),
        type: appt.type,
        notes: appt.notes ?? "",
      });
    } else if (mode === "create") {
      reset({
        patientId: "",
        therapistId: "",
        date: preset?.date ?? format(new Date(), "yyyy-MM-dd"),
        time: preset?.time ?? "10:00",
        endTime: preset?.time ? addMinutesToTimeStr(preset.time, 45) : "10:45",
        type: "Sesión",
        notes: "",
      });
    }
  }, [open, mode, appt?.id, preset?.date, preset?.time]);

  const watchedStartTime = watch("time");
  const watchedEndTime = watch("endTime");
  const computedDuration = computeDurationLabel(watchedStartTime, watchedEndTime);

  async function onSubmit(values: AppointmentCreateInput | AppointmentUpdateInput) {
    try {
      if (mode === "edit" && appt) {
        await update.mutateAsync({ id: appt.id, data: values as AppointmentUpdateInput });
        toast({ title: "Cita actualizada" });
      } else {
        const created = await create.mutateAsync(values as AppointmentCreateInput);
        toast({ title: "Cita creada", description: created.patientName });
      }
      onOpenChange(false);
    } catch {
      toast({ title: mode === "edit" ? "Error al actualizar la cita" : "Error al crear cita", variant: "destructive" });
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar cita" : "Nueva cita"}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? "Corrige los datos de la cita." : "Programa una nueva sesión o valoración."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" error={errors.date?.message} required>
              <Input type="date" {...register("date")} />
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

          <div className="grid grid-cols-[1.2fr_1.2fr_0.8fr] gap-2 items-end">
            <Field label="Hora inicio" error={errors.time?.message} required>
              <Controller
                control={control}
                name="time"
                render={({ field }) => (
                  <TimeSelect value={field.value} onChange={field.onChange} ariaLabel="Hora inicio" />
                )}
              />
            </Field>
            <Field label="Hora fin" error={errors.endTime?.message} required>
              <Controller
                control={control}
                name="endTime"
                render={({ field }) => (
                  <TimeSelect value={field.value} onChange={field.onChange} ariaLabel="Hora fin" />
                )}
              />
            </Field>
            <Field label="Duración">
              <span className="flex h-9 items-center justify-center rounded-md bg-muted/40 px-2 text-sm text-muted-foreground whitespace-nowrap">
                {computedDuration ?? "—"}
              </span>
            </Field>
          </div>

          <Field label="Notas" error={errors.notes?.message}>
            <Textarea rows={2} {...register("notes")} placeholder="Opcional" />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => (mode === "edit" ? onCancelEdit?.() : onOpenChange(false))}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Crear cita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reservation form dialog (create & edit — title + time range) ───────────

function ReservationFormDialog({
  mode,
  reservation,
  open,
  onOpenChange,
  preset,
  onCancelEdit,
}: {
  mode: "create" | "edit";
  reservation?: SlotReservationDTO;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  preset?: { date: string; time: string };
  onCancelEdit?: () => void;
}) {
  const create = useCreateReservation();
  const update = useUpdateReservation();
  const { data: professionals } = useProfessionals();
  const { data: categories } = useReservationCategories();

  const schema = mode === "edit" ? slotReservationUpdateSchema : slotReservationCreateSchema;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<
    z.input<typeof slotReservationCreateSchema> | z.input<typeof slotReservationUpdateSchema>,
    any,
    SlotReservationCreateInput | SlotReservationUpdateInput
  >({
    resolver: zodResolver(schema as any),
    defaultValues:
      mode === "edit" && reservation
        ? {
            therapistId: reservation.therapistId,
            categoryId: reservation.categoryId ?? undefined,
            title: reservation.title,
            date: format(new Date(reservation.start), "yyyy-MM-dd"),
            time: format(new Date(reservation.start), "HH:mm"),
            endTime: format(addMinutes(new Date(reservation.start), reservation.durationMin), "HH:mm"),
          }
        : {
            therapistId: "",
            categoryId: undefined,
            title: "",
            date: preset?.date ?? format(new Date(), "yyyy-MM-dd"),
            time: preset?.time ?? "10:00",
            endTime: addMinutesToTimeStr(preset?.time ?? "10:00", 45),
          },
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && reservation) {
      reset({
        therapistId: reservation.therapistId,
        categoryId: reservation.categoryId ?? undefined,
        title: reservation.title,
        date: format(new Date(reservation.start), "yyyy-MM-dd"),
        time: format(new Date(reservation.start), "HH:mm"),
        endTime: format(addMinutes(new Date(reservation.start), reservation.durationMin), "HH:mm"),
      });
    } else if (mode === "create") {
      reset({
        therapistId: "",
        categoryId: undefined,
        title: "",
        date: preset?.date ?? format(new Date(), "yyyy-MM-dd"),
        time: preset?.time ?? "10:00",
        endTime: addMinutesToTimeStr(preset?.time ?? "10:00", 45),
      });
    }
  }, [open, mode, reservation?.id, preset?.date, preset?.time]);

  const watchedStartTime = watch("time");
  const watchedEndTime = watch("endTime");
  const computedDuration = computeDurationLabel(watchedStartTime, watchedEndTime);
  const watchedCategoryId = watch("categoryId");

  async function onSubmit(values: SlotReservationCreateInput | SlotReservationUpdateInput) {
    try {
      if (mode === "edit" && reservation) {
        await update.mutateAsync({ id: reservation.id, data: values as SlotReservationUpdateInput });
        toast({ title: "Reserva actualizada" });
      } else {
        await create.mutateAsync(values as SlotReservationCreateInput);
        toast({ title: "Reserva creada" });
      }
      onOpenChange(false);
    } catch {
      toast({
        title: mode === "edit" ? "Error al actualizar la reserva" : "Error al crear la reserva",
        variant: "destructive",
      });
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            {mode === "edit" ? "Editar reserva de espacio" : "Reserva de espacio"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Corrige los datos de la reserva."
              : "Bloquea un rato para que no se pueda confundir con una cita disponible."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Título" error={errors.title?.message} required>
            <Input placeholder="p. ej. Roco, Formación, Reunión de equipo…" {...register("title")} />
          </Field>

          <Field label="Categoría" error={(errors as any).categoryId?.message}>
            <CategoryPicker
              categories={categories ?? []}
              value={watchedCategoryId}
              onChange={(id) => setValue("categoryId", id, { shouldDirty: true })}
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

          <Field label="Fecha" error={errors.date?.message} required>
            <Input type="date" {...register("date")} />
          </Field>

          <div className="grid grid-cols-[1.2fr_1.2fr_0.8fr] gap-2 items-end">
            <Field label="Hora inicio" error={errors.time?.message} required>
              <Controller
                control={control}
                name="time"
                render={({ field }) => (
                  <TimeSelect value={field.value} onChange={field.onChange} ariaLabel="Hora inicio" />
                )}
              />
            </Field>
            <Field label="Hora fin" error={errors.endTime?.message} required>
              <Controller
                control={control}
                name="endTime"
                render={({ field }) => (
                  <TimeSelect value={field.value} onChange={field.onChange} ariaLabel="Hora fin" />
                )}
              />
            </Field>
            <Field label="Duración">
              <span className="flex h-9 items-center justify-center rounded-md bg-muted/40 px-2 text-sm text-muted-foreground whitespace-nowrap">
                {computedDuration ?? "—"}
              </span>
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => (mode === "edit" ? onCancelEdit?.() : onOpenChange(false))}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Crear reserva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category picker: pick an existing personal category, or create/edit/
// delete one inline without leaving the reservation form ───────────────────

const CATEGORY_COLOR_PALETTE = [
  "#a8c5b3", // sage
  "#b8a9d9", // lavender
  "#e8b896", // peach
  "#9fc5d9", // sky
  "#d9a9b8", // rose
  "#c9c08f", // sand
  "#a9c9c0", // mint
  "#d9c2a9", // tan
];

function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: ReservationCategoryDTO[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const createCategory = useCreateReservationCategory();
  const updateCategory = useUpdateReservationCategory();
  const deleteCategory = useDeleteReservationCategory();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(CATEGORY_COLOR_PALETTE[0]);

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setDraftName("");
    setDraftColor(CATEGORY_COLOR_PALETTE[0]);
  }

  function startEdit(cat: ReservationCategoryDTO) {
    setEditingId(cat.id);
    setCreating(false);
    setDraftName(cat.name);
    setDraftColor(cat.color);
  }

  async function saveDraft() {
    const name = draftName.trim();
    if (!name) return;
    try {
      if (editingId) {
        await updateCategory.mutateAsync({ id: editingId, data: { name, color: draftColor } });
      } else {
        const created = await createCategory.mutateAsync({ name, color: draftColor });
        onChange(created.id);
      }
      setCreating(false);
      setEditingId(null);
    } catch {
      toast({ title: "Error al guardar la categoría", variant: "destructive" });
    }
  }

  async function removeCategory(id: string) {
    const ok = confirm("¿Eliminar esta categoría? Las reservas que la usan se quedarán sin categoría.");
    if (!ok) return;
    try {
      await deleteCategory.mutateAsync(id);
      if (value === id) onChange(undefined);
    } catch {
      toast({ title: "Error al eliminar la categoría", variant: "destructive" });
    }
  }

  const isEditorOpen = creating || editingId !== null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
            !value ? "border-foreground/40 bg-muted" : "border-border text-muted-foreground hover:bg-muted/50"
          }`}
        >
          Sin categoría
        </button>
        {categories.map((cat) => (
          <div key={cat.id} className="group relative">
            <button
              type="button"
              onClick={() => onChange(cat.id)}
              className={`flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-xs border transition-colors ${
                value === cat.id ? "border-foreground/40" : "border-border hover:bg-muted/50"
              }`}
              style={{ backgroundColor: value === cat.id ? `${cat.color}33` : undefined }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </button>
            <button
              type="button"
              onClick={() => startEdit(cat)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-card border border-border opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              aria-label={`Editar categoría ${cat.name}`}
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {!isEditorOpen && (
          <button
            type="button"
            onClick={startCreate}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-dashed border-border text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <Plus className="w-3 h-3" /> Nueva
          </button>
        )}
      </div>

      {isEditorOpen && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2.5">
          <Input
            placeholder="Nombre (p. ej. Trabajo, Personal, Vacaciones…)"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            {CATEGORY_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraftColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  draftColor === c ? "ring-2 ring-offset-1 ring-foreground/50 scale-110" : ""
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive h-7 px-2"
                onClick={() => removeCategory(editingId)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  setCreating(false);
                  setEditingId(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7"
                onClick={saveDraft}
                disabled={!draftName.trim() || createCategory.isPending || updateCategory.isPending}
              >
                Guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
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
