"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { X, Save, Trash2, CalendarDays, Printer } from "lucide-react";
import {
  useRoutineRecords,
  useRoutineRecord,
  useSaveRoutineRecord,
  useDeleteRoutineRecord,
} from "@/hooks/api";

// ─── Occupational categories ──────────────────────────────────────────
export const ROUTINE_CATEGORIES = [
  "Cuidado personal (AVDs)", "Movilidad funcional", "Gestión comunitaria",
  "Trabajo remunerado/voluntario", "Manejo del hogar", "Juego/escuela",
  "Recreación tranquila", "Recreación activa", "Socialización",
] as const;
export type RoutineCategory = typeof ROUTINE_CATEGORIES[number];

export const BALANCE_GROUPS = ["Autocuidado", "Productividad", "Ocio"] as const;
export type BalanceGroup = typeof BALANCE_GROUPS[number];

export const BALANCE_GROUP_COLORS: Record<BalanceGroup, string> = {
  Autocuidado: "#f6a96a", Productividad: "#5a9fd4", Ocio: "#6dbb74",
};

export const BALANCE_GROUP_REFERENCE: Record<BalanceGroup, number> = {
  Autocuidado: 46, Productividad: 33, Ocio: 20,
};

export const OTPF_TO_GROUP: Record<RoutineCategory | string, BalanceGroup> = {
  "Cuidado personal (AVDs)": "Autocuidado",
  "Movilidad funcional": "Autocuidado",
  "Gestión comunitaria": "Autocuidado",
  "Trabajo remunerado/voluntario": "Productividad",
  "Manejo del hogar": "Productividad",
  "Juego/escuela": "Productividad",
  "Recreación tranquila": "Ocio",
  "Recreación activa": "Ocio",
  "Socialización": "Ocio",
  // Legacy category names (data saved before category rename)
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
  "Cuidado personal (AVDs)": "#E8B48C",
  "Movilidad funcional": "#9CCB9A",
  "Gestión comunitaria": "#93BFE8",
  "Trabajo remunerado/voluntario": "#D99999",
  "Manejo del hogar": "#E0C97A",
  "Juego/escuela": "#B79EDB",
  "Recreación tranquila": "#8FCEC0",
  "Recreación activa": "#E0AD79",
  "Socialización": "#D993BB",
};

export const ROUTINE_CATEGORY_LABELS: Record<RoutineCategory, string> = {
  "Cuidado personal (AVDs)": "Cuidado personal (AVDs)",
  "Movilidad funcional": "Movilidad funcional",
  "Gestión comunitaria": "Gestión comunitaria",
  "Trabajo remunerado/voluntario": "Trabajo remunerado/voluntario",
  "Manejo del hogar": "Manejo del hogar",
  "Juego/escuela": "Juego/escuela",
  "Recreación tranquila": "Recreación tranquila",
  "Recreación activa": "Recreación activa",
  "Socialización": "Socialización",
};

// Legacy colors for cells saved with old category names — matched in saturation
// to the new palette, grouped by the same balance group (Autocuidado/Productividad/Ocio)
export const LEGACY_CATEGORY_COLORS: Record<string, string> = {
  "AVD": "#E8B48C",
  "Gestión de la Salud": "#9CCB9A",
  "Descanso y Sueño": "#93BFE8",
  "AIVD": "#D99999",
  "Educación": "#E0C97A",
  "Trabajo": "#B79EDB",
  "Juego": "#8FCEC0",
  "Ocio / Tiempo Libre": "#E0AD79",
  "Participación Social": "#D993BB",
};

export const ROUTINE_CATEGORY_EXAMPLES: Record<RoutineCategory, string> = {
  "Cuidado personal (AVDs)": "Ej. vestirse, bañarse, alimentarse, abstinencia",
  "Movilidad funcional": "Ej. traslado interior, exterior",
  "Gestión comunitaria": "Ej. transporte, compras, finanzas",
  "Trabajo remunerado/voluntario": "Ej. encontrar/mantener un empleo, voluntariado",
  "Manejo del hogar": "Ej. limpieza, lavado de ropa, cocina",
  "Juego/escuela": "Ej. destreza en el juego, tareas escolares",
  "Recreación tranquila": "Ej. pasatiempos, manualidades, lectura",
  "Recreación activa": "Ej. deportes, paseos, viajes",
  "Socialización": "Ej. visitas, llamadas, fiestas, correspondencia",
};

export const ROUTINE_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const ROUTINE_DAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const HALF_HOUR_SLOTS = Array.from({ length: 48 }, (_, i) => i);

export function slotLabel(slot: number): string {
  const totalMins = 6 * 60 + slot * 30;
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
}

export interface RoutineCell {
  day: number;
  halfHour: number;
  activity: string;
  category: RoutineCategory | "";
  group: BalanceGroup | "";
}

// ─── PDF generation ───────────────────────────────────────────────────────────

// Draws a donut chart on a pdf-lib page using bezier arcs.
// Each slice is approximated with multiple small arc segments.
function drawDonut(
  page: any,
  cx: number, cy: number,
  outerR: number, innerR: number,
  slices: { pct: number; hex: string }[],
  rgb: (r: number, g: number, b: number) => any,
) {
  const TWO_PI = Math.PI * 2;
  let startAngle = -Math.PI / 2; // start at 12 o'clock

  for (const slice of slices) {
    if (slice.pct <= 0) continue;
    const angle = TWO_PI * (slice.pct / 100);
    const endAngle = startAngle + angle;
    const r = parseInt(slice.hex.slice(1, 3), 16) / 255;
    const g = parseInt(slice.hex.slice(3, 5), 16) / 255;
    const b = parseInt(slice.hex.slice(5, 7), 16) / 255;
    const color = rgb(r, g, b);

    // Approximate arc with line segments
    const steps = Math.max(8, Math.ceil((angle / TWO_PI) * 64));
    const outerPoints: { x: number; y: number }[] = [];
    const innerPoints: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = startAngle + (angle * i) / steps;
      outerPoints.push({ x: cx + Math.cos(a) * outerR, y: cy + Math.sin(a) * outerR });
      innerPoints.push({ x: cx + Math.cos(a) * innerR, y: cy + Math.sin(a) * innerR });
    }

    // Draw filled polygon: outer arc forward, inner arc backward
    const allPoints = [...outerPoints, ...[...innerPoints].reverse()];
    for (let i = 0; i < allPoints.length - 1; i++) {
      page.drawLine({
        start: allPoints[i], end: allPoints[i + 1],
        thickness: outerR - innerR + 0.5, color,
        opacity: 1,
      });
    }
    // Solid fill using thin radial lines
    for (let i = 0; i <= steps; i++) {
      const a = startAngle + (angle * i) / steps;
      page.drawLine({
        start: { x: cx + Math.cos(a) * innerR, y: cy + Math.sin(a) * innerR },
        end: { x: cx + Math.cos(a) * outerR, y: cy + Math.sin(a) * outerR },
        thickness: (TWO_PI * outerR * (angle / TWO_PI)) / steps + 0.5,
        color,
      });
    }

    startAngle = endAngle;
  }
}

async function generatePlanningPdf(cells: RoutineCell[], date: string, empty = false) {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 841.89; const H = 595.28; const MARGIN = 28;
  const COL_TIME = 36; const COL_DAY = (W - MARGIN * 2 - COL_TIME) / 7;
  const ROW_H = (H - MARGIN * 2 - 48 - 24) / 48;
  const page = pdfDoc.addPage([W, H]);

  page.drawText(`Planning semanal de rutinas${empty ? " (vacío)" : ""}`, {
    x: MARGIN, y: H - MARGIN - 12, size: 13, font: fontBold, color: rgb(0.1, 0.36, 0.34),
  });
  if (!empty && date) {
    page.drawText(`Fecha: ${date}`, { x: MARGIN, y: H - MARGIN - 26, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
  }

  const gridTop = H - MARGIN - 48;
  ROUTINE_DAYS.forEach((day, i) => {
    const x = MARGIN + COL_TIME + i * COL_DAY;
    page.drawRectangle({ x, y: gridTop, width: COL_DAY, height: 20, color: rgb(0.95, 0.95, 0.95) });
    page.drawText(day, { x: x + COL_DAY / 2 - 8, y: gridTop + 6, size: 8, font: fontBold });
  });

  HALF_HOUR_SLOTS.forEach((slot) => {
    const y = gridTop - (slot + 1) * ROW_H;
    const isFullHour = slot % 2 === 0;
    if (isFullHour) {
      page.drawText(slotLabel(slot), { x: MARGIN, y: y + ROW_H / 2 - 3, size: 6, font, color: rgb(0.4, 0.4, 0.4) });
    }
    ROUTINE_DAYS.forEach((_, day) => {
      const x = MARGIN + COL_TIME + day * COL_DAY;
      const cell = empty ? null : cells.find((c) => c.day === day && c.halfHour === slot);
      if (cell?.category) {
        const hex = ROUTINE_CATEGORY_COLORS[cell.category as RoutineCategory] ?? LEGACY_CATEGORY_COLORS[cell.category] ?? "#e5e5e5";
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        page.drawRectangle({ x: x + 0.5, y: y + 0.5, width: COL_DAY - 1, height: ROW_H - 1, color: rgb(r, g, b) });
      }
      if (cell?.activity) {
        const prevCell = !empty && slot > 0 ? cells.find((c) => c.day === day && c.halfHour === slot - 1) : null;
        const isContinuation = !!(prevCell?.activity === cell.activity && prevCell?.category === cell.category);
        if (!isContinuation) {
          const maxChars = Math.floor((COL_DAY - 4) / 2.6);
          const text = cell.activity.length > maxChars ? cell.activity.slice(0, maxChars - 1) + "…" : cell.activity;
          page.drawText(text, { x: x + 2, y: y + ROW_H / 2 - 3, size: 5.5, font, color: rgb(0.1, 0.1, 0.1) });
        }
      }
      page.drawLine({ start: { x, y }, end: { x: x + COL_DAY, y }, thickness: 0.2, color: rgb(0.8, 0.8, 0.8) });
      page.drawLine({ start: { x, y }, end: { x, y: y + ROW_H }, thickness: isFullHour ? 0.5 : 0.2, color: rgb(0.7, 0.7, 0.7) });
    });
  });

  page.drawRectangle({
    x: MARGIN + COL_TIME, y: gridTop - 48 * ROW_H,
    width: COL_DAY * 7, height: 48 * ROW_H + 20,
    borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.8,
  });

  if (!empty) {
    let lx = MARGIN; const ly = MARGIN - 8;
    ROUTINE_CATEGORIES.forEach((cat) => {
      const hex = ROUTINE_CATEGORY_COLORS[cat];
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      page.drawRectangle({ x: lx, y: ly, width: 8, height: 8, color: rgb(r, g, b) });
      page.drawText(cat, { x: lx + 10, y: ly + 1, size: 5.5, font, color: rgb(0.3, 0.3, 0.3) });
      lx += cat.length * 3.5 + 16;
    });
  }

  if (!empty && cells.length > 0) {
    const page2 = pdfDoc.addPage([595.28, 841.89]);
    const H2 = 841.89;

    page2.drawText("Análisis de equilibrio ocupacional", {
      x: MARGIN, y: H2 - MARGIN - 14, size: 14, font: fontBold, color: rgb(0.1, 0.36, 0.34),
    });
    if (date) page2.drawText(`Fecha: ${date}`, { x: MARGIN, y: H2 - MARGIN - 30, size: 9, font, color: rgb(0.4, 0.4, 0.4) });

    const filled = cells.filter((c) => c.category);
    const totalSlots = filled.length;
    const totalHours = totalSlots * 0.5;

    // ── Calculate group data ──────────────────────────────────────────────────
    const groupCounts: Record<BalanceGroup, number> = { Autocuidado: 0, Productividad: 0, Ocio: 0 };
    for (const c of filled) {
      const grp = (c.group as BalanceGroup) || (c.category ? OTPF_TO_GROUP[c.category as RoutineCategory] : null);
      if (grp && grp in groupCounts) groupCounts[grp as BalanceGroup]++;
    }
    const groupSlices = BALANCE_GROUPS.map((grp) => ({
      grp, hex: BALANCE_GROUP_COLORS[grp],
      pct: totalSlots > 0 ? (groupCounts[grp] / totalSlots) * 100 : 0,
      hours: groupCounts[grp] * 0.5,
    }));

    // ── Calculate OTPF data (dynamic: covers both new and legacy category names) ──
    const presentCats = Array.from(new Set(filled.map((c) => c.category).filter(Boolean))) as string[];
    const otpfSlices = presentCats.map((cat) => {
      const slots = filled.filter((c) => c.category === cat).length;
      const hex = ROUTINE_CATEGORY_COLORS[cat as RoutineCategory] ?? LEGACY_CATEGORY_COLORS[cat] ?? "#e5e5e5";
      return { cat, hex, pct: totalSlots > 0 ? (slots / totalSlots) * 100 : 0, hours: slots * 0.5 };
    }).filter((s) => s.hours > 0);

    // ── Donut chart 1: 3 groups (left side) ─────────────────────────────────
    const chart1CX = MARGIN + 75;
    const chart1CY = H2 - MARGIN - 100;
    drawDonut(page2, chart1CX, chart1CY, 65, 35, groupSlices.map((s) => ({ pct: s.pct, hex: s.hex })), rgb);

    page2.drawText("3 Grupos de equilibrio", {
      x: chart1CX - 55, y: chart1CY + 75, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2),
    });

    // Legend for chart 1
    let ly1 = chart1CY - 75;
    groupSlices.forEach((s) => {
      const r = parseInt(s.hex.slice(1, 3), 16) / 255;
      const g = parseInt(s.hex.slice(3, 5), 16) / 255;
      const b = parseInt(s.hex.slice(5, 7), 16) / 255;
      page2.drawRectangle({ x: chart1CX - 55, y: ly1, width: 10, height: 10, color: rgb(r, g, b) });
      page2.drawText(`${s.grp}: ${s.hours.toFixed(1)}h (${s.pct.toFixed(1)}%)  Ref: ~${BALANCE_GROUP_REFERENCE[s.grp]}%`, {
        x: chart1CX - 42, y: ly1 + 1, size: 8, font, color: rgb(0.2, 0.2, 0.2),
      });
      ly1 -= 16;
    });
    page2.drawText(`Total: ${totalHours.toFixed(1)}h`, {
      x: chart1CX - 55, y: ly1 - 4, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2),
    });

    // ── Donut chart 2: OTPF areas (right side) ─────────────────────────────
    const chart2CX = MARGIN + 380;
    const chart2CY = H2 - MARGIN - 100;
    drawDonut(page2, chart2CX, chart2CY, 65, 35, otpfSlices.map((s) => ({ pct: s.pct, hex: s.hex })), rgb);

    page2.drawText("Áreas OTPF", {
      x: chart2CX - 25, y: chart2CY + 75, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2),
    });

    // Legend for chart 2 (two columns)
    let ly2 = chart2CY - 75;
    const col2x = [chart2CX - 55, chart2CX + 115];
    otpfSlices.forEach((s, i) => {
      const colX = col2x[i % 2];
      if (i % 2 === 0 && i > 0) ly2 -= 14;
      if (i % 2 === 1 && i === 1) ly2 += 14; // reset to same row as previous
      const r = parseInt(s.hex.slice(1, 3), 16) / 255;
      const g = parseInt(s.hex.slice(3, 5), 16) / 255;
      const b = parseInt(s.hex.slice(5, 7), 16) / 255;
      page2.drawRectangle({ x: colX, y: ly2, width: 8, height: 8, color: rgb(r, g, b) });
      page2.drawText(`${s.cat}: ${s.hours.toFixed(1)}h (${s.pct.toFixed(1)}%)`, {
        x: colX + 11, y: ly2 + 1, size: 7, font, color: rgb(0.2, 0.2, 0.2),
      });
      if (i % 2 === 1) ly2 -= 13;
    });
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planning-${empty ? "vacio" : date}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Context menu ─────────────────────────────────────────────────────────────
interface ContextMenuState {
  x: number;
  y: number;
  selectedCells: { day: number; halfHour: number }[];
  pasteTarget?: { day: number; halfHour: number };
}

// ─── Main editor component ────────────────────────────────────────────────────
interface Props { patientId: string; onClose: () => void; }

export function WeeklyRoutineEditor({ patientId, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [cells, setCells] = useState<RoutineCell[]>([]);
  const [notes, setNotes] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [printing, setPrinting] = useState(false);

  const records = useRoutineRecords(patientId);
  const saveRecord = useSaveRoutineRecord(patientId);
  const deleteRecord = useDeleteRoutineRecord(patientId);
  const existingRecord = records.data?.find((r) => r.date === date);
  const recordDetail = useRoutineRecord(patientId, existingRecord?.id ?? null);

  const loadRecord = useCallback((data: { cells: string; notes: string | null } | null | undefined) => {
    if (data) {
      try { setCells(JSON.parse(data.cells)); } catch { setCells([]); }
      setNotes(data.notes ?? "");
    } else { setCells([]); setNotes(""); }
    setIsDirty(false);
  }, []);

  useEffect(() => {
    loadRecord(recordDetail.data ?? (existingRecord ? undefined : null));
  }, [recordDetail.data, existingRecord, loadRecord]);

  // ─── Range-select state ───────────────────────────────────────────────────────
  // dragDay/dragStart/dragEnd drive the visual highlight. To avoid re-rendering
  // all 336 cells on every mouseenter during a drag, we track the live drag
  // position in refs and only flush to state on mouseup (which triggers one
  // single re-render instead of one per cell the mouse passes over).
  const [dragDay, setDragDay] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const dragDayRef = useRef<number | null>(null);
  const dragEndRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rangeDraft, setRangeDraft] = useState<{ activity: string; category: RoutineCategory | ""; group: BalanceGroup | "" }>({ activity: "", category: "", group: "" });
  const [openCell, setOpenCell] = useState<{ day: number; halfHour: number } | null>(null);

  // ─── Context menu state ───────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const selection = dragDay !== null && dragStart !== null && dragEnd !== null
    ? { day: dragDay, from: Math.min(dragStart, dragEnd), to: Math.max(dragStart, dragEnd) }
    : null;
  const rangeReady = !isDragging && selection !== null && selection.from !== selection.to;

  // Cells in current selection
  const selectedCells = selection
    ? Array.from({ length: selection.to - selection.from + 1 }, (_, i) => ({
        day: selection.day, halfHour: selection.from + i,
      }))
    : [];

  useEffect(() => {
    if (!isDragging) return;
    function onUp() {
      // Flush ref values to state once on mouseup instead of on every mouseenter
      const finalEnd = dragEndRef.current;
      const finalDay = dragDayRef.current;
      setIsDragging(false);
      if (finalDay !== null && finalEnd !== null) {
        setDragDay(finalDay);
        setDragEnd(finalEnd);
      }
      if (dragStart === dragEndRef.current) {
        setDragDay(null); setDragStart(null); setDragEnd(null);
      }
    }
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, [isDragging, dragStart]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    function onDown() { setContextMenu(null); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [contextMenu]);

  function cellAt(day: number, halfHour: number) {
    return cells.find((c) => c.day === day && c.halfHour === halfHour);
  }

  function isCellSelected(day: number, halfHour: number) {
    if (!selection) return false;
    return day === selection.day && halfHour >= selection.from && halfHour <= selection.to;
  }

  function setCell(day: number, halfHour: number, patch: Partial<RoutineCell>) {
    const existing = cellAt(day, halfHour);
    const merged: RoutineCell = { day, halfHour, activity: existing?.activity ?? "", category: existing?.category ?? "", group: existing?.group ?? "", ...patch };
    if (patch.category && patch.category !== existing?.category && !("group" in patch)) {
      merged.group = OTPF_TO_GROUP[patch.category] ?? "";
    }
    const withoutThis = cells.filter((c) => !(c.day === day && c.halfHour === halfHour));
    setCells(!merged.activity.trim() && !merged.category ? withoutThis : [...withoutThis, merged]);
    setIsDirty(true);
  }

  function applyRange() {
    if (!selection) return;
    const slots: number[] = [];
    for (let s = selection.from; s <= selection.to; s++) slots.push(s);
    const withoutRange = cells.filter((c) => !(c.day === selection.day && slots.includes(c.halfHour)));
    const autoGroup: BalanceGroup | "" = rangeDraft.category ? (OTPF_TO_GROUP[rangeDraft.category] ?? "") : "";
    const filled = slots.map((s) => ({ day: selection.day, halfHour: s, activity: rangeDraft.activity.trim(), category: rangeDraft.category, group: autoGroup }));
    setCells([...withoutRange, ...filled]);
    setIsDirty(true);
    setDragDay(null); setDragStart(null); setDragEnd(null);
    setRangeDraft({ activity: "", category: "", group: "" });
  }

  function clearSelection() { setDragDay(null); setDragStart(null); setDragEnd(null); }

  // ─── Move block of selected cells ────────────────────────────────────────────
  // When dragging a selected cell, all selected cells move together.
  // The dragged cell is the "anchor" — destination offset is calculated
  // relative to where the user dropped it vs. where they picked it up.
  function moveBlock(anchorFromDay: number, anchorFromSlot: number, toDay: number, toSlot: number) {
    if (!selection) return;
    const slots = selectedCells;
    const dayOffset = toDay - anchorFromDay;
    const slotOffset = toSlot - anchorFromSlot;

    // Check bounds
    const newSlots = slots.map((s) => ({ day: s.day + dayOffset, halfHour: s.halfHour + slotOffset }));
    const outOfBounds = newSlots.some((s) => s.day < 0 || s.day > 6 || s.halfHour < 0 || s.halfHour > 47);
    if (outOfBounds) { toast({ title: "No cabe en esa posición", variant: "destructive" }); return; }

    // Check for collisions with non-selected cells
    const selectedKeys = new Set(slots.map((s) => `${s.day}-${s.halfHour}`));
    const destKeys = new Set(newSlots.map((s) => `${s.day}-${s.halfHour}`));
    const collisions = cells.filter((c) => {
      const key = `${c.day}-${c.halfHour}`;
      return !selectedKeys.has(key) && destKeys.has(key) && (c.activity || c.category);
    });
    if (collisions.length > 0) {
      if (!confirm(`${collisions.length} celda(s) del destino ya tienen contenido. ¿Sobrescribirlas?`)) return;
    }

    // Build new cells: keep non-selected cells that aren't in destination, then add moved
    const sourceCells = slots.map((s) => cellAt(s.day, s.halfHour)).filter(Boolean) as RoutineCell[];
    const withoutSelected = cells.filter((c) => !selectedKeys.has(`${c.day}-${c.halfHour}`) && !destKeys.has(`${c.day}-${c.halfHour}`));
    const movedCells = sourceCells.map((c, i) => ({ ...c, day: newSlots[i].day, halfHour: newSlots[i].halfHour }));
    setCells([...withoutSelected, ...movedCells]);
    setIsDirty(true);
    clearSelection();
  }

  // ─── Single cell move (no selection) ────────────────────────────────────────
  function moveCell(fromDay: number, fromSlot: number, toDay: number, toSlot: number) {
    const source = cellAt(fromDay, fromSlot);
    if (!source) return;
    const dest = cellAt(toDay, toSlot);
    if (dest && (dest.activity || dest.category)) {
      if (!confirm(`La celda de destino (${ROUTINE_DAYS_FULL[toDay]} ${slotLabel(toSlot)}) ya tiene "${dest.activity || dest.category}". ¿Sobrescribirla?`)) return;
    }
    const withoutBoth = cells.filter((c) => !(c.day === fromDay && c.halfHour === fromSlot) && !(c.day === toDay && c.halfHour === toSlot));
    setCells([...withoutBoth, { ...source, day: toDay, halfHour: toSlot }]);
    setIsDirty(true);
  }

  // ─── Context menu actions ─────────────────────────────────────────────────────
  function deleteSelected() {
    if (!contextMenu) return;
    const keys = new Set(contextMenu.selectedCells.map((s) => `${s.day}-${s.halfHour}`));
    setCells(cells.filter((c) => !keys.has(`${c.day}-${c.halfHour}`)));
    setIsDirty(true);
    clearSelection();
    setContextMenu(null);
  }

  function changeSelectedCategory(cat: RoutineCategory) {
    if (!contextMenu) return;
    const keys = new Set(contextMenu.selectedCells.map((s) => `${s.day}-${s.halfHour}`));
    const autoGroup = OTPF_TO_GROUP[cat] ?? "";
    setCells(cells.map((c) => keys.has(`${c.day}-${c.halfHour}`) ? { ...c, category: cat, group: autoGroup } : c));
    setIsDirty(true);
    setContextMenu(null);
  }

  // Clipboard for copy-paste between days
  const clipboardRef = useRef<RoutineCell[]>([]);
  const [clipboardCount, setClipboardCount] = useState(0);

  function copySelected() {
    if (!contextMenu) return;
    const keys = new Set(contextMenu.selectedCells.map((s) => `${s.day}-${s.halfHour}`));
    clipboardRef.current = cells.filter((c) => keys.has(`${c.day}-${c.halfHour}`));
    setClipboardCount(clipboardRef.current.length);
    toast({ title: `${clipboardRef.current.length} celda${clipboardRef.current.length !== 1 ? "s" : ""} copiada${clipboardRef.current.length !== 1 ? "s" : ""}. Clic derecho en la celda destino para pegar.` });
    setContextMenu(null);
  }

  function pasteAt(targetDay: number, targetSlot: number) {
    const copied = clipboardRef.current;
    if (copied.length === 0) return;
    // Find the top-left anchor of the copied block
    const minSlot = Math.min(...copied.map((c) => c.halfHour));
    const slotOffset = targetSlot - minSlot;
    const dayOffset = targetDay - copied[0].day;
    const pasted = copied.map((c) => ({
      ...c,
      day: c.day + dayOffset,
      halfHour: c.halfHour + slotOffset,
    })).filter((c) => c.day >= 0 && c.day <= 6 && c.halfHour >= 0 && c.halfHour <= 47);
    const pastedKeys = new Set(pasted.map((c) => `${c.day}-${c.halfHour}`));
    setCells([...cells.filter((c) => !pastedKeys.has(`${c.day}-${c.halfHour}`)), ...pasted]);
    setIsDirty(true);
    setContextMenu(null);
    toast({ title: "Pegado correctamente" });
  }

  function copyDayToWeekdays(sourceDay: number) {
    const sourceCells = cells.filter((c) => c.day === sourceDay);
    const weekdays = [1, 2, 3, 4];
    const withoutWeekdays = cells.filter((c) => !weekdays.includes(c.day));
    setCells([...withoutWeekdays, ...weekdays.flatMap((d) => sourceCells.map((c) => ({ ...c, day: d })))]);
    setIsDirty(true);
    toast({ title: "Copiado a martes–viernes" });
  }

  async function handleSave() {
    try {
      await saveRecord.mutateAsync({ date, cells: JSON.stringify(cells), notes: notes || undefined });
      setIsDirty(false);
      toast({ title: "Planning guardado", description: `Registro del ${date} guardado.` });
    } catch { toast({ title: "Error al guardar", variant: "destructive" }); }
  }

  async function handleDelete() {
    if (!existingRecord) return;
    if (!confirm(`¿Eliminar el registro del ${date}?`)) return;
    try {
      await deleteRecord.mutateAsync(existingRecord.id);
      setCells([]); setNotes(""); setIsDirty(false);
      toast({ title: "Registro eliminado" });
    } catch { toast({ title: "Error al eliminar", variant: "destructive" }); }
  }

  async function handlePrint(empty = false) {
    setPrinting(true);
    try { await generatePlanningPdf(cells, date, empty); }
    catch { toast({ title: "Error al generar PDF", variant: "destructive" }); }
    finally { setPrinting(false); }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" onClick={(e) => { if (e.button === 0) { setContextMenu(null); } }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar"><X className="w-4 h-4" /></Button>
          <h2 className="font-semibold text-base">Planning semanal de rutinas</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36 text-sm" />
          </div>
          {(records.data?.length ?? 0) > 0 && (
            <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={existingRecord?.id ?? ""}
              onChange={(e) => { const rec = records.data?.find((r) => r.id === e.target.value); if (rec) setDate(rec.date); }}>
              <option value="">Registros guardados…</option>
              {records.data?.map((r) => <option key={r.id} value={r.id}>{r.date}</option>)}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => handlePrint(true)} disabled={printing}>
            <Printer className="w-3.5 h-3.5 mr-1.5" />PDF vacío
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePrint(false)} disabled={printing || cells.length === 0}>
            <Printer className="w-3.5 h-3.5 mr-1.5" />PDF con datos
          </Button>
          {existingRecord && (
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive border-destructive/40">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />Borrar
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
          <span key={cat} className="flex items-center gap-1 text-xs">
            <span className="w-3 h-3 rounded-sm inline-block shrink-0" style={{ backgroundColor: ROUTINE_CATEGORY_COLORS[cat] }} />
            <span className="text-muted-foreground">{ROUTINE_CATEGORY_LABELS[cat]}</span>
          </span>
        ))}
        {selection && selectedCells.length > 1 && (
          <span className="ml-auto text-xs font-medium text-foreground">
            {selectedCells.length} celdas seleccionadas · clic derecho para opciones
          </span>
        )}
      </div>

      {/* Notes */}
      <div className="px-4 pt-2 pb-1 shrink-0">
        <Input placeholder="Notas sobre este registro (opcional)…" value={notes} onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }} className="h-8 text-sm" />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <table className="border-collapse text-xs w-full">
          <thead className="sticky top-0 z-10 bg-background">
            <tr>
              <th className="border-b border-r p-1 w-14 text-muted-foreground font-normal"></th>
              {ROUTINE_DAYS.map((dayName, day) => (
                <th key={day} className="border-b p-1 min-w-[110px] font-medium text-sm">
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{dayName}</span>
                    {day === 0 && (
                      <button type="button" onClick={() => copyDayToWeekdays(0)} className="text-[10px] text-muted-foreground underline decoration-dotted hover:text-foreground">
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
                  <td className="sticky left-0 bg-background border-r p-0.5 text-right text-muted-foreground whitespace-nowrap w-14 text-xs">
                    {isFullHour ? label : <span className="opacity-40">{label}</span>}
                  </td>
                  {ROUTINE_DAYS.map((_, day) => {
                    const cell = cellAt(day, slot);
                    const bg = cell?.category ? (ROUTINE_CATEGORY_COLORS[cell.category as RoutineCategory] ?? LEGACY_CATEGORY_COLORS[cell.category] ?? "#f0f0f0") : undefined;
                    const isOpen = openCell?.day === day && openCell?.halfHour === slot;
                    const selected = isCellSelected(day, slot);
                    const isRangeAnchor = rangeReady && selection && day === selection.day && slot === selection.to;
                    const hasContent = !!(cell?.activity || cell?.category);

                    // Cell merging: hide activity label if the cell above has the exact same activity+category
                    const prevCell = slot > 0 ? cellAt(day, slot - 1) : null;
                    const isContinuation = !!(hasContent && prevCell && prevCell.activity === cell!.activity && prevCell.category === cell!.category && prevCell.activity);
                    // Check if next cell continues this block (for bottom border hiding)
                    const nextCell = slot < 47 ? cellAt(day, slot + 1) : null;
                    const continuesBelow = !!(hasContent && nextCell && nextCell.activity === cell!.activity && nextCell.category === cell!.category && cell!.activity);

                    const isPartOfBlock = isContinuation || continuesBelow;
                    // For merged blocks: paint the td background directly so there are zero gaps
                    const tdBg = isPartOfBlock && bg ? bg : undefined;
                    const btnBg = isPartOfBlock ? "transparent" : bg;

                    return (
                      <td
                        key={day}
                        className={`relative p-0 ${isFullHour && !isContinuation ? "" : isContinuation ? "" : "border-t border-t-dashed border-border/30"}`}
                        style={{ backgroundColor: tdBg }}
                      >
                        <Popover
                          open={isOpen && !isDragging && !rangeReady}
                          onOpenChange={(o) => setOpenCell(o ? { day, halfHour: slot } : null)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              draggable={hasContent}
                              onDragStart={(e) => {
                                if (selected && selectedCells.length > 1) {
                                  e.dataTransfer.setData("text/plain", JSON.stringify({ type: "block", anchorDay: day, anchorSlot: slot }));
                                } else {
                                  e.dataTransfer.setData("text/plain", JSON.stringify({ type: "single", day, halfHour: slot }));
                                }
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const raw = e.dataTransfer.getData("text/plain");
                                if (!raw) return;
                                const data = JSON.parse(raw) as { type: string; day?: number; halfHour?: number; anchorDay?: number; anchorSlot?: number };
                                if (data.type === "block" && data.anchorDay !== undefined && data.anchorSlot !== undefined) {
                                  moveBlock(data.anchorDay, data.anchorSlot, day, slot);
                                } else if (data.type === "single" && data.day !== undefined && data.halfHour !== undefined) {
                                  if (data.day === day && data.halfHour === slot) return;
                                  moveCell(data.day, data.halfHour, day, slot);
                                }
                              }}
                              onMouseDown={(e) => {
                                if (e.button !== 0) return;
                                if (contextMenu) { setContextMenu(null); return; }
                                e.preventDefault();
                                setOpenCell(null);
                                dragDayRef.current = day;
                                dragEndRef.current = slot;
                                setDragDay(day); setDragStart(slot); setDragEnd(slot); setIsDragging(true);
                              }}
                              onMouseEnter={() => {
                                if (!isDragging || day !== dragDayRef.current) return;
                                dragEndRef.current = slot;
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const currentSelection = selection
                                  ? Array.from({ length: selection.to - selection.from + 1 }, (_, i) => ({
                                      day: selection.day, halfHour: selection.from + i,
                                    }))
                                  : [];
                                if (selected && currentSelection.length > 1) {
                                  setContextMenu({ x: e.clientX, y: e.clientY, selectedCells: currentSelection });
                                } else if (hasContent) {
                                  setDragDay(day); setDragStart(slot); setDragEnd(slot);
                                  setContextMenu({ x: e.clientX, y: e.clientY, selectedCells: [{ day, halfHour: slot }] });
                                } else if (clipboardCount > 0) {
                                  setContextMenu({ x: e.clientX, y: e.clientY, selectedCells: [], pasteTarget: { day, halfHour: slot } });
                                }
                              }}
                              className={`w-full text-left px-1.5 select-none text-xs font-medium ${
                                isPartOfBlock ? "rounded-none border-none" : "rounded-sm border border-transparent hover:border-border m-0.5"
                              } ${
                                isFullHour ? "h-8" : "h-7"
                              } ${selected
                                ? "!border-foreground ring-1 ring-foreground/40 ring-offset-0"
                                : ""
                              } ${hasContent ? "cursor-grab active:cursor-grabbing" : ""} ${isContinuation ? "" : "truncate"}`}
                              style={{ backgroundColor: btnBg }}
                              title={cell?.activity || undefined}
                            >
                              {isContinuation ? "" : (cell?.activity || "")}
                            </button>
                          </PopoverTrigger>

                          {/* Single-cell edit popover */}
                          <PopoverContent className="w-[28rem] space-y-3" side="right" align="start">
                            <p className="text-sm font-semibold">{ROUTINE_DAYS_FULL[day]} · {label}</p>
                            <Input placeholder="Actividad…" value={cell?.activity ?? ""}
                              onChange={(e) => setCell(day, slot, { activity: e.target.value })}
                              className="h-9 text-sm" autoFocus />
                            <div>
                              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Categoría</p>
                              <div className="grid grid-cols-3 gap-1.5">
                                {ROUTINE_CATEGORIES.map((cat) => (
                                  <button key={cat} type="button" onClick={() => setCell(day, slot, { category: cat })}
                                    title={ROUTINE_CATEGORY_EXAMPLES[cat]}
                                    className={`min-h-[2.5rem] py-1.5 rounded-md text-[11px] border-2 transition-all px-2 leading-tight ${cell?.category === cat ? "border-foreground/50" : "border-transparent"}`}
                                    style={{ backgroundColor: ROUTINE_CATEGORY_COLORS[cat] }}>{cat}</button>
                                ))}
                              </div>
                            </div>
                            {cell?.category && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Grupo de equilibrio <span className="italic font-normal">(auto — editable)</span></p>
                                <div className="flex gap-1.5">
                                  {BALANCE_GROUPS.map((grp) => (
                                    <button key={grp} type="button" onClick={() => setCell(day, slot, { group: grp })}
                                      className={`flex-1 h-8 rounded-md text-xs border-2 transition-all font-medium ${cell?.group === grp ? "border-foreground/50" : "border-transparent"}`}
                                      style={{ backgroundColor: BALANCE_GROUP_COLORS[grp] }}>{grp}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {cell && (cell.activity || cell.category) && (
                              <div className="flex items-center justify-end pt-1 border-t">
                                <button type="button" onClick={() => setCell(day, slot, { activity: "", category: "", group: "" })} className="text-xs text-destructive hover:underline">
                                  Vaciar celda
                                </button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>

                        {/* Range-fill popover */}
                        {isRangeAnchor && selection && (
                          <Popover open onOpenChange={(o) => { if (!o) clearSelection(); }}>
                            <PopoverTrigger asChild>
                              <span className="absolute inset-0 pointer-events-none" />
                            </PopoverTrigger>
                            <PopoverContent className="w-[28rem] space-y-3" side="right" align="start">
                              <p className="text-sm font-semibold">
                                {ROUTINE_DAYS_FULL[selection.day]} · {slotLabel(selection.from)} – {slotLabel(selection.to)} ({selection.to - selection.from + 1} franjas)
                              </p>
                              <Input placeholder="Actividad…" value={rangeDraft.activity}
                                onChange={(e) => setRangeDraft((d) => ({ ...d, activity: e.target.value }))}
                                className="h-9 text-sm" autoFocus
                                onKeyDown={(e) => { if (e.key === "Enter") applyRange(); }} />
                              <div>
                                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Categoría</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {ROUTINE_CATEGORIES.map((cat) => (
                                    <button key={cat} type="button"
                                      onClick={() => setRangeDraft((d) => ({ ...d, category: cat, group: OTPF_TO_GROUP[cat] ?? "" }))}
                                      title={ROUTINE_CATEGORY_EXAMPLES[cat]}
                                      className={`min-h-[2.5rem] py-1.5 rounded-md text-[11px] border-2 transition-all px-2 leading-tight ${rangeDraft.category === cat ? "border-foreground/50" : "border-transparent"}`}
                                      style={{ backgroundColor: ROUTINE_CATEGORY_COLORS[cat] }}>{cat}</button>
                                  ))}
                                </div>
                              </div>
                              {rangeDraft.category && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">Grupo de equilibrio <span className="italic font-normal">(auto — editable)</span></p>
                                  <div className="flex gap-1.5">
                                    {BALANCE_GROUPS.map((grp) => (
                                      <button key={grp} type="button" onClick={() => setRangeDraft((d) => ({ ...d, group: grp }))}
                                        className={`flex-1 h-8 rounded-md text-xs border-2 transition-all font-medium ${rangeDraft.group === grp ? "border-foreground/50" : "border-transparent"}`}
                                        style={{ backgroundColor: BALANCE_GROUP_COLORS[grp] }}>{grp}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={clearSelection}>Cancelar</Button>
                                <Button type="button" size="sm" onClick={applyRange}>Aplicar</Button>
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

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-[60] bg-popover border rounded-md shadow-lg py-1 min-w-[200px] text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.selectedCells.length > 0 && (
            <>
              <p className="px-3 py-1.5 text-xs text-muted-foreground border-b mb-1">
                {contextMenu.selectedCells.length} celda{contextMenu.selectedCells.length !== 1 ? "s" : ""} seleccionada{contextMenu.selectedCells.length !== 1 ? "s" : ""}
              </p>

              {/* Copy */}
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-accent"
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onClick={(e) => { e.stopPropagation(); copySelected(); }}
              >
                Copiar
              </button>

              {/* Change category */}
              <div className="px-3 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground border-t mt-1">Cambiar categoría:</div>
              <div className="max-h-52 overflow-y-auto">
                {ROUTINE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="w-full text-left px-3 py-1.5 hover:bg-accent flex items-center gap-2"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onClick={(e) => { e.stopPropagation(); changeSelectedCategory(cat); }}
                  >
                    <span className="w-3 h-3 rounded-sm inline-block shrink-0" style={{ backgroundColor: ROUTINE_CATEGORY_COLORS[cat] }} />
                    {cat}
                  </button>
                ))}
              </div>

              {/* Delete */}
              <div className="border-t mt-1 pt-1">
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-destructive hover:bg-accent"
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  onClick={(e) => { e.stopPropagation(); deleteSelected(); }}
                >
                  Borrar seleccionadas
                </button>
              </div>
            </>
          )}

          {/* Paste option (when right-clicking on empty cell with clipboard content) */}
          {contextMenu.pasteTarget && clipboardCount > 0 && (
            <>
              <p className="px-3 py-1.5 text-xs text-muted-foreground border-b mb-1">
                {clipboardCount} celda{clipboardCount !== 1 ? "s" : ""} en portapapeles
              </p>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 hover:bg-accent"
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (contextMenu.pasteTarget) pasteAt(contextMenu.pasteTarget.day, contextMenu.pasteTarget.halfHour);
                }}
              >
                Pegar aquí
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
