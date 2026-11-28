// Shared domain UI atoms. Extracted so they can be reused across views
// and stay consistent (the original app had these inline, duplicated).

"use client";

import { cn } from "@/lib/utils";
import type { Specialty, PatientStatus } from "@/types/domain";

const SPECIALTY_STYLES: Record<Specialty, string> = {
  Fisioterapia: "bg-emerald-100 text-emerald-900 border-emerald-200",
  Psicología: "bg-violet-100 text-violet-900 border-violet-200",
  Neuropsicología: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
  "T. Ocupacional": "bg-orange-100 text-orange-900 border-orange-300",
  "Trabajo Social": "bg-blue-100 text-blue-900 border-blue-200",
  "Terapeuta Petö": "bg-indigo-100 text-indigo-900 border-indigo-200",
  Cuidados: "bg-cyan-100 text-cyan-900 border-cyan-200",
  Logopedia: "bg-rose-100 text-rose-900 border-rose-200",
};

// Abreviaturas para sitios con poco espacio (listado de usuarios/as). El
// nombre completo sigue disponible como tooltip (title) para no perder
// claridad.
const SPECIALTY_ABBR: Record<Specialty, string> = {
  Fisioterapia: "FT",
  Psicología: "PS",
  Neuropsicología: "NPS",
  "T. Ocupacional": "TO",
  "Trabajo Social": "TS",
  "Terapeuta Petö": "PET",
  Cuidados: "CU",
  Logopedia: "LOG",
};
export { SPECIALTY_ABBR };

export function SpecialtyBadge({
  specialty,
  className,
  compact,
}: {
  specialty: Specialty;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      title={compact ? specialty : undefined}
      className={cn(
        // La versión compacta usa esquinas casi rectas (en vez de la
        // pastilla redondeada del resto de etiquetas) para distinguirse a
        // simple vista como "profesional/perfil" y no confundirse con
        // estado/recurso/clasificación en el listado.
        compact
          ? "inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[11px] font-bold tracking-wide"
          : "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        SPECIALTY_STYLES[specialty],
        className,
      )}
    >
      {compact ? SPECIALTY_ABBR[specialty] : specialty}
    </span>
  );
}

// Color de cada especialidad para su sigla en el listado (fg) y fondos suaves (bg).
const SPECIALTY_AVATAR_TONES: Record<Specialty, { fg: string; bg: string }> = {
  Fisioterapia: { fg: "#2f6b45", bg: "#e4f1e8" },
  Psicología: { fg: "#5b3bb0", bg: "#ece7fa" },
  Neuropsicología: { fg: "#93306d", bg: "#f6e6ef" },
  "T. Ocupacional": { fg: "#9a4612", bg: "#fbebdf" },
  "Trabajo Social": { fg: "#1f5694", bg: "#e5eef8" },
  "Terapeuta Petö": { fg: "#3f48ad", bg: "#e8eafb" },
  Cuidados: { fg: "#0d6577", bg: "#e0f2f5" },
  Logopedia: { fg: "#a12424", bg: "#f9e5e5" },
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    // Ignora palabras que no empiezan por letra, p. ej. "(Aranzazu)".
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Sigla de la especialidad en su color, sin fondo (p. ej. "TO" en cobre).
// Es el toque de color del profesional en el listado; el nombre completo
// aparece al pasar el ratón.
export function SpecialtyCode({ specialty, className }: { specialty: Specialty; className?: string }) {
  const tone = SPECIALTY_AVATAR_TONES[specialty];
  return (
    <span
      title={specialty}
      className={cn("font-semibold tracking-wide", className)}
      style={{ color: tone?.fg }}
    >
      {SPECIALTY_ABBR[specialty]}
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

const RESOURCE_STYLES: Record<string, string> = {
  Domicilio: "bg-teal-100 text-teal-900 border-teal-200",
  "Asociación EM": "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200",
};

// `resource` is nullable (patients created before this field existed).
// Renders a distinct, slightly urgent style when unset so it stands out
// as something to fill in, rather than looking like a normal badge.
export function ResourceBadge({ resource, className }: { resource: string | null; className?: string }) {
  if (!resource) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-900 border-amber-300",
          className,
        )}
      >
        Sin recurso asignado
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        RESOURCE_STYLES[resource] ?? "bg-zinc-100 text-zinc-700 border-zinc-200",
        className,
      )}
    >
      {resource}
    </span>
  );
}

// Clasificación interna del recurso "Asociación EM" (Centro de día / Asociación).
const EM_CATEGORY_STYLES: Record<string, string> = {
  "Centro de día": "bg-rose-100 text-rose-900 border-rose-200",
  "Asociación": "bg-teal-100 text-teal-900 border-teal-200",
};
// Colores identificativos de la clasificación EM para los AVATARES (círculos).
// Un único sitio donde viven estos colores: si algún día quieres cambiarlos,
// se cambian aquí y afectan a toda la app.
//   Centro de día → burdeos   |   Asociación → azul verdoso
export const EM_CATEGORY_AVATAR_COLORS: Record<string, string> = {
  "Centro de día": "#8a2846", // burdeos
  "Asociación": "#0f766e",    // azul verdoso (teal)
};
// Color neutro para quien no tiene clasificación EM (Domicilio, o EM sin
// clasificar todavía). Así el avatar deja de ser un color aleatorio.
export const UNCLASSIFIED_AVATAR_COLOR = "#64748b";

// Devuelve el color de avatar que corresponde a una clasificación EM.
export function emCategoryAvatarColor(category: string | null | undefined): string {
  return (category && EM_CATEGORY_AVATAR_COLORS[category]) || UNCLASSIFIED_AVATAR_COLOR;
}

// Versión suave (fondo pastel + iniciales en color) para el listado de
// usuarios/as: distingue Centro de día y Asociación de un vistazo.
//   Centro de día → burdeos   |   Asociación → azul verdoso   |   resto → gris
const EM_CATEGORY_AVATAR_TONES: Record<string, { fg: string; bg: string }> = {
  "Centro de día": { fg: "#8a2846", bg: "#f6e3ea" },
  "Asociación": { fg: "#0f6b63", bg: "#dcefec" },
};
const UNCLASSIFIED_AVATAR_TONE = { fg: "#475569", bg: "#eceff2" };

export function CategoryAvatar({
  name,
  category,
  size = 36,
  className,
}: {
  name: string;
  category: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const tone = (category && EM_CATEGORY_AVATAR_TONES[category]) || UNCLASSIFIED_AVATAR_TONE;
  return (
    <span
      title={category ?? undefined}
      className={cn("inline-flex items-center justify-center rounded-full font-semibold shrink-0", className)}
      style={{ backgroundColor: tone.bg, color: tone.fg, width: size, height: size, fontSize: Math.round(size * 0.34) }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

export function EmCategoryBadge({ category, className }: { category: string | null; className?: string }) {
  if (!category) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        EM_CATEGORY_STYLES[category] ?? "bg-zinc-100 text-zinc-700 border-zinc-200",
        className,
      )}
    >
      {category}
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
