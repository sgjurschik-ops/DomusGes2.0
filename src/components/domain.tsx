// Shared domain UI atoms. Extracted so they can be reused across views
// and stay consistent (the original app had these inline, duplicated).

"use client";

import { cn } from "@/lib/utils";
import type { Specialty, PatientStatus } from "@/types/domain";

const SPECIALTY_STYLES: Record<Specialty, string> = {
  Fisioterapia: "bg-emerald-100 text-emerald-900 border-emerald-200",
  Psicología: "bg-violet-100 text-violet-900 border-violet-200",
  "T. Ocupacional": "bg-amber-100 text-amber-900 border-amber-200",
};

export function SpecialtyBadge({ specialty, className }: { specialty: Specialty; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        SPECIALTY_STYLES[specialty],
        className,
      )}
    >
      {specialty}
    </span>
  );
}

const STATUS_STYLES: Record<PatientStatus, string> = {
  Activo: "bg-emerald-100 text-emerald-900 border-emerald-200",
  "En seguimiento": "bg-sky-100 text-sky-900 border-sky-200",
  Alta: "bg-zinc-100 text-zinc-700 border-zinc-200",
  Pausado: "bg-amber-100 text-amber-900 border-amber-200",
};

export function StatusBadge({ status, className }: { status: PatientStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

export function Avatar({
  name,
  color = "#1a5c58",
  size = 36,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0", className)}
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function ScoreDots({ score, max = 10 }: { score: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Puntuación ${score} de ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full",
            i < score ? "bg-emerald-600" : "bg-zinc-200",
          )}
        />
      ))}
    </span>
  );
}

// Map a date to a relative Spanish label like "Hoy 10:30" or "Mañana 11:00" or "03 jun 2026".
export function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startTarget.getTime() - startToday.getTime()) / 86400000);
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Hoy, ${time}`;
  if (diffDays === 1) return `Mañana, ${time}`;
  if (diffDays === -1) return `Ayer, ${time}`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
