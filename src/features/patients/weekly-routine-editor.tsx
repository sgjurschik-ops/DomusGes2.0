"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { X, Save, ChevronLeft, ChevronRight, Trash2, CalendarDays } from "lucide-react";
import {
  useRoutineRecords,
  useRoutineRecord,
  useSaveRoutineRecord,
  useDeleteRoutineRecord,
} from "@/hooks/api";

// ─── OTEP 2020 occupational categories ───────────────────────────────────────
// Based on the Occupational Therapy Practice Framework (OTPF-4), the
// standard classification used in occupational therapy clinical practice.
export const ROUTINE_CATEGORIES = [
  "AVD",
  "AIVD",
  "Gestión de la Salud",
  "Descanso y Sueño",
  "Educación",
  "Trabajo",
  "Juego",
  "Ocio / Tiempo Libre",
  "Participación Social",
] as const;
export type RoutineCategory = typeof ROUTINE_CATEGORIES[number];

// The 3 classic occupational balance groups used in clinical reports.
export const BALANCE_GROUPS = ["Autocuidado", "Productividad", "Ocio"] as const;
export type BalanceGroup = typeof BALANCE_GROUPS[number];

export const BALANCE_GROUP_COLORS: Record<BalanceGroup, string> = {
  Autocuidado: "#f6a96a",
  Productividad: "#5a9fd4",
  Ocio: "#6dbb74",
};

// Default mapping from OTPF area to balance group, based on standard
// occupational therapy classification. AIVD and Participación Social are
// assigned "Productividad" by default but the therapist can override them
// per cell, since both can also belong to other groups depending on context.
export const OTPF_TO_GROUP: Record<RoutineCategory, BalanceGroup> = {
  "AVD": "Autocuidado",
  "AIVD": "Productividad",
  "Gestión de la Salud": "Autocuidado",
  "Descanso y Sueño": "Autocuidado",
  "Educación": "Productividad",
  "Trabajo": "Productividad",
  "Juego": "Ocio",
  "Ocio / Tiempo Libre": "Ocio",
  "Participación Social": "Productividad",
};

export const ROUTINE_CATEGORY_COLORS: Record<RoutineCategory, string> = {
  "AVD": "#f6c5a0",
  "AIVD": "#f6e4a0",
  "Gestión de la Salud": "#b8e0b8",
  "Descanso y Sueño": "#b8d0f0",
  "Educación": "#d4b8f0",
  "Trabajo": "#f0b8b8",
  "Juego": "#f0d4b8",
  "Ocio / Tiempo Libre": "#b8f0e4",
  "Participación Social": "#f0b8d4",
};

export const ROUTINE_CATEGORY_LABELS: Record<RoutineCategory, string> = {
  "AVD": "Actividades de la Vida Diaria",
  "AIVD": "Actividades Instrumentales de la Vida Diaria",
  "Gestión de la Salud": "Gestión de la Salud",
  "Descanso y Sueño": "Descanso y Sueño",
  "Educación": "Educación",
  "Trabajo": "Trabajo",
  "Juego": "Juego",
  "Ocio / Tiempo Libre": "Ocio / Tiempo Libre",
  "Participación Social": "Participación Social",
};

export const ROUTINE_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const ROUTINE_DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// 48 half-hour slots starting at 07:00 (slot 0 = 07:00, slot 1 = 07:30…)
export const HALF_HOUR_SLOTS = Array.from({ length: 48 }, (_, i) => i);

export function slotLabel(slot: number): string {
  const totalMins = 7 * 60 + slot * 30;
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
}

export interface RoutineCell {
  day: number;       // 0=Lun..6=Dom
  halfHour: number;  // 0=07:00, 1=07:30 … 47=06:30
  activity: string;
  category: RoutineCategory | "";
  group: BalanceGroup | "";  // auto-set from category but manually overridable
}

// ─── Main editor component ────────────────────────────────────────────────────

interface Props {
  patientId: string;
  onClose: () => void;
}

export function WeeklyRoutineEditor({ patientId, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [cells, setCells] = useState<RoutineCell[]>([]);
  const [notes, setNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const records = useRoutineRecords(patientId);
  const saveRecord = useSaveRoutineRecord(patientId);
  const deleteRecord = useDeleteRoutineRecord(patientId);

  // Load existing record when date changes
  const existingRecord = records.data?.find((r) => r.date === date);
  const recordDetail = useRoutineRecord(patientId, existingRecord?.id ?? null);

  const loadRecord = useCallback((data: { cells: string; notes: string | null } | null | undefined) => {
    if (data) {
      try {
        const parsed = JSON.parse(data.cells);
        setCells(parsed);
      } catch {
        setCells([]);
      }
      setNotes(data.notes ?? "");
    } else {
      setCells([]);
      setNotes("");
    }
    setIsDirty(false);
  }, []);

  useEffect(() => {
    loadRecord(recordDetail.data ?? (existingRecord ? undefined : null));
  }, [recordDetail.data, existingRecord, loadRecord]);

  // ─── Drag-to-select range state ─────────────────────────────────────────────
  const [dragDay, setDragDay] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rangeDraft, setRangeDraft] = useState<{ activity: string; category: RoutineCategory | ""; group: BalanceGroup | "" }>({
    activity: "",
    category: "",
    group: "",
  });
  const [openCell, setOpenCell] = useState<{ day: number; halfHour: number } | null>(null);

  const selection = dragDay !== null && dragStart !== null && dragEnd !== null
    ? { day: dragDay, from: Math.min(dragStart, dragEnd), to: Math.max(dragStart, dragEnd) }
    : null;
  const rangeReady = !isDragging && selection !== null && selection.from !== selection.to;

  useEffect(() => {
    if (!isDragging) return;
    function onUp() {
      setIsDragging(false);
      if (dragStart === dragEnd) {
        setDragDay(null);
        setDragStart(null);
        setDragEnd(null);
      }
    }
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [isDragging, dragStart, dragEnd]);

  // ─── Cell helpers ────────────────────────────────────────────────────────────
  function cellAt(day: number, halfHour: number): RoutineCell | undefined {
    return cells.find((c) => c.day === day && c.halfHour === halfHour);
  }

  function isCellSelected(day: number, halfHour: number): boolean {
    if (!selection) return false;
    return day === selection.day && halfHour >= selection.from && halfHour <= selection.to;
  }

  function setCell(day: number, halfHour: number, patch: Partial<RoutineCell>) {
    const existing = cellAt(day, halfHour);
    const merged: RoutineCell = {
      day, halfHour,
      activity: existing?.activity ?? "",
      category: existing?.category ?? "",
      group: existing?.group ?? "",
      ...patch,
    };
    // Auto-set group when category changes, unless the patch explicitly
    // sets group (meaning the therapist overrode it manually).
    if (patch.category && patch.category !== existing?.category && !("group" in patch)) {
      merged.group = OTPF_TO_GROUP[patch.category] ?? "";
    }
    const withoutThis = cells.filter((c) => !(c.day === day && c.halfHour === halfHour));
    if (!merged.activity.trim() && !merged.category) {
      setCells(withoutThis);
    } else {
      setCells([...withoutThis, merged]);
    }
    setIsDirty(true);
  }

  function applyRange() {
    if (!selection) return;
    const slots: number[] = [];
    for (let s = selection.from; s <= selection.to; s++) slots.push(s);
    const withoutRange = cells.filter(
      (c) => !(c.day === selection.day && slots.includes(c.halfHour)),
    );
    const autoGroup: BalanceGroup | "" = rangeDraft.category ? (OTPF_TO_GROUP[rangeDraft.category] ?? "") : "";
    const filled = slots.map((s) => ({
      day: selection.day,
      halfHour: s,
      activity: rangeDraft.activity.trim(),
      category: rangeDraft.category,
      group: autoGroup,
    }));
    setCells([...withoutRange, ...filled]);
    setIsDirty(true);
    setDragDay(null);
    setDragStart(null);
    setDragEnd(null);
    setRangeDraft({ activity: "", category: "", group: "" });
  }

  function clearSelection() {
    setDragDay(null);
    setDragStart(null);
    setDragEnd(null);
  }

  function moveCell(fromDay: number, fromSlot: number, toDay: number, toSlot: number) {
    const source = cellAt(fromDay, fromSlot);
    if (!source) return;
    const dest = cellAt(toDay, toSlot);
    if (dest && (dest.activity || dest.category)) {
      const ok = confirm(
        `La celda de destino (${ROUTINE_DAYS_FULL[toDay]} ${slotLabel(toSlot)}) ya tiene "${dest.activity || dest.category}". ¿Sobrescribirla?`,
      );
      if (!ok) return;
    }
    const withoutBoth = cells.filter(
      (c) => !(c.day === fromDay && c.halfHour === fromSlot) && !(c.day === toDay && c.halfHour === toSlot),
    );
    setCells([...withoutBoth, { ...source, day: toDay, halfHour: toSlot }]);
    setIsDirty(true);
  }

  function copyDayToWeekdays(sourceDay: number) {
    const sourceCells = cells.filter((c) => c.day === sourceDay);
    const weekdays = [1, 2, 3, 4];
    const withoutWeekdays = cells.filter((c) => !weekdays.includes(c.day));
    const copied = weekdays.flatMap((d) => sourceCells.map((c) => ({ ...c, day: d })));
    setCells([...withoutWeekdays, ...copied]);
    setIsDirty(true);
    toast({ title: "Copiado a martes–viernes" });
  }

  async function handleSave() {
    try {
      await saveRecord.mutateAsync({
        date,
        cells: JSON.stringify(cells),
        notes: notes || undefined,
      });
      setIsDirty(false);
      toast({ title: "Planning guardado", description: `Registro del ${date} guardado correctamente.` });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!existingRecord) return;
    const ok = confirm(`¿Eliminar el registro del ${date}? Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
      await deleteRecord.mutateAsync(existingRecord.id);
      setCells([]);
      setNotes("");
      setIsDirty(false);
      toast({ title: "Registro eliminado" });
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="w-4 h-4" />
          </Button>
          <h2 className="font-semibold text-base">Planning semanal de rutinas</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Date navigation */}
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 w-36 text-sm"
            />
          </div>

          {/* Existing records selector */}
          {(records.data?.length ?? 0) > 0 && (
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={existingRecord?.id ?? ""}
              onChange={(e) => {
                const rec = records.data?.find((r) => r.id === e.target.value);
                if (rec) setDate(rec.date);
              }}
            >
              <option value="">Registros guardados…</option>
              {records.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.date}
                </option>
              ))}
            </select>
          )}

          {existingRecord && (
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive border-destructive/40">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Borrar registro
            </Button>
          )}

          <Button size="sm" onClick={handleSave} disabled={saveRecord.isPending}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saveRecord.isPending ? "Guardando…" : isDirty ? "Guardar *" : "Guardado"}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-muted/30 shrink-0">
        {ROUTINE_CATEGORIES.map((cat) => (
          <span key={cat} className="flex items-center gap-1 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ backgroundColor: ROUTINE_CATEGORY_COLORS[cat] }} />
            <span className="text-muted-foreground">{ROUTINE_CATEGORY_LABELS[cat]}</span>
          </span>
        ))}
      </div>

      {/* Notes */}
      <div className="px-4 pt-2 pb-1 shrink-0">
        <Input
          placeholder="Notas sobre este registro (opcional)…"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
          className="h-8 text-sm"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <table className="border-collapse text-[11px] w-full">
          <thead className="sticky top-0 z-10 bg-background">
            <tr>
              <th className="border-b border-r p-1 w-12 text-muted-foreground font-normal"></th>
              {ROUTINE_DAYS.map((dayName, day) => (
                <th key={day} className="border-b p-1 min-w-[100px] font-medium">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{dayName}</span>
                    {day === 0 && (
                      <button
                        type="button"
                        onClick={() => copyDayToWeekdays(0)}
                        className="text-[9px] text-muted-foreground underline decoration-dotted hover:text-foreground"
                      >
                        copiar a Mar–Vie
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HALF_HOUR_SLOTS.map((slot) => {
              const label = slotLabel(slot);
              const isFullHour = slot % 2 === 0;
              return (
                <tr key={slot} className={isFullHour ? "border-t border-t-border/60" : ""}>
                  <td className="sticky left-0 bg-background border-r p-0.5 text-right text-muted-foreground whitespace-nowrap w-12">
                    {isFullHour ? label : <span className="opacity-40">{label}</span>}
                  </td>
                  {ROUTINE_DAYS.map((_, day) => {
                    const cell = cellAt(day, slot);
                    const bg = cell?.category ? ROUTINE_CATEGORY_COLORS[cell.category] : undefined;
                    const isOpen = openCell?.day === day && openCell?.halfHour === slot;
                    const selected = isCellSelected(day, slot);
                    const isRangeAnchor = rangeReady && selection &&
                      day === selection.day && slot === selection.to;

                    return (
                      <td key={day} className={`p-0.5 align-top relative ${isFullHour ? "" : "border-t border-t-dashed border-border/30"}`}>
                        <Popover
                          open={isOpen && !isDragging && !rangeReady}
                          onOpenChange={(o) => setOpenCell(o ? { day, halfHour: slot } : null)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              draggable={!!(cell?.activity || cell?.category)}
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", JSON.stringify({ day, halfHour: slot }));
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const raw = e.dataTransfer.getData("text/plain");
                                if (!raw) return;
                                const src = JSON.parse(raw) as { day: number; halfHour: number };
                                if (src.day === day && src.halfHour === slot) return;
                                moveCell(src.day, src.halfHour, day, slot);
                              }}
                              onMouseDown={(e) => {
                                if (cell?.activity || cell?.category) return;
                                e.preventDefault();
                                setOpenCell(null);
                                setDragDay(day);
                                setDragStart(slot);
                                setDragEnd(slot);
                                setIsDragging(true);
                              }}
                              onMouseEnter={() => {
                                if (!isDragging || day !== dragDay) return;
                                setDragEnd(slot);
                              }}
                              className={`w-full rounded-sm border text-left px-1 truncate select-none ${
                                isFullHour ? "h-7" : "h-6"
                              } ${selected
                                ? "border-foreground ring-1 ring-foreground/40"
                                : "border-transparent hover:border-border"
                              } ${cell?.activity || cell?.category ? "cursor-grab active:cursor-grabbing" : ""}`}
                              style={{ backgroundColor: bg }}
                              title={cell?.activity || undefined}
                            >
                              {cell?.activity || ""}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 space-y-2.5" side="right" align="start">
                            <p className="text-xs font-medium">
                              {ROUTINE_DAYS_FULL[day]} · {label}
                            </p>
                            <Input
                              placeholder="Actividad…"
                              value={cell?.activity ?? ""}
                              onChange={(e) => setCell(day, slot, { activity: e.target.value })}
                              className="h-8 text-xs"
                              autoFocus
                            />
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-1">Área OTPF</p>
                              <div className="grid grid-cols-3 gap-1">
                                {ROUTINE_CATEGORIES.map((cat) => (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCell(day, slot, { category: cat })}
                                    className={`h-7 rounded-md text-[9px] border-2 transition-all px-0.5 leading-tight ${
                                      cell?.category === cat ? "border-foreground/50" : "border-transparent"
                                    }`}
                                    style={{ backgroundColor: ROUTINE_CATEGORY_COLORS[cat] }}
                                  >
                                    {cat}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {cell?.category && (
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-1">
                                  Grupo de equilibrio
                                  <span className="ml-1 italic">(auto — editable)</span>
                                </p>
                                <div className="flex gap-1">
                                  {BALANCE_GROUPS.map((grp) => (
                                    <button
                                      key={grp}
                                      type="button"
                                      onClick={() => setCell(day, slot, { group: grp })}
                                      className={`flex-1 h-7 rounded-md text-[9px] border-2 transition-all ${
                                        cell?.group === grp ? "border-foreground/50" : "border-transparent"
                                      }`}
                                      style={{ backgroundColor: BALANCE_GROUP_COLORS[grp] }}
                                    >
                                      {grp}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {cell && (cell.activity || cell.category) && (
                              <div className="flex items-center justify-end pt-1 border-t">
                                <button
                                  type="button"
                                  onClick={() => setCell(day, slot, { activity: "", category: "", group: "" })}
                                  className="text-[11px] text-destructive hover:underline"
                                >
                                  Vaciar celda
                                </button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>

                        {isRangeAnchor && selection && (
                          <Popover open onOpenChange={(o) => { if (!o) clearSelection(); }}>
                            <PopoverTrigger asChild>
                              <span className="absolute inset-0 pointer-events-none" />
                            </PopoverTrigger>
                            <PopoverContent className="w-72 space-y-2.5" side="right" align="start">
                              <p className="text-xs font-medium">
                                {ROUTINE_DAYS_FULL[selection.day]} · {slotLabel(selection.from)} – {slotLabel(selection.to)} ({selection.to - selection.from + 1} franjas)
                              </p>
                              <Input
                                placeholder="Actividad…"
                                value={rangeDraft.activity}
                                onChange={(e) => setRangeDraft((d) => ({ ...d, activity: e.target.value }))}
                                className="h-8 text-xs"
                                autoFocus
                                onKeyDown={(e) => { if (e.key === "Enter") applyRange(); }}
                              />
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-1">Área OTPF</p>
                                <div className="grid grid-cols-3 gap-1">
                                  {ROUTINE_CATEGORIES.map((cat) => (
                                    <button
                                      key={cat}
                                      type="button"
                                      onClick={() => setRangeDraft((d) => ({
                                        ...d,
                                        category: cat,
                                        group: OTPF_TO_GROUP[cat] ?? "",
                                      }))}
                                      className={`h-7 rounded-md text-[9px] border-2 transition-all px-0.5 leading-tight ${
                                        rangeDraft.category === cat ? "border-foreground/50" : "border-transparent"
                                      }`}
                                      style={{ backgroundColor: ROUTINE_CATEGORY_COLORS[cat] }}
                                    >
                                      {cat}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {rangeDraft.category && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-1">
                                    Grupo de equilibrio
                                    <span className="ml-1 italic">(auto — editable)</span>
                                  </p>
                                  <div className="flex gap-1">
                                    {BALANCE_GROUPS.map((grp) => (
                                      <button
                                        key={grp}
                                        type="button"
                                        onClick={() => setRangeDraft((d) => ({ ...d, group: grp }))}
                                        className={`flex-1 h-7 rounded-md text-[9px] border-2 transition-all ${
                                          rangeDraft.group === grp ? "border-foreground/50" : "border-transparent"
                                        }`}
                                        style={{ backgroundColor: BALANCE_GROUP_COLORS[grp] }}
                                      >
                                        {grp}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={clearSelection}>
                                  Cancelar
                                </Button>
                                <Button type="button" size="sm" className="h-7 text-xs" onClick={applyRange}>
                                  Aplicar
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
