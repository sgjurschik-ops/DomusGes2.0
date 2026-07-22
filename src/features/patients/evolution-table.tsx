"use client";

import { useMemo, useState, Fragment } from "react";
import { SCALE_GROUPS } from "@/lib/schemas";
import { formatDate } from "@/components/domain";

// Showing every date as its own column makes the table grow wider forever
// as evaluations pile up. By default we only show the most recent dates
// and let the professional expand to see the full history — the table
// stays scrollable (not paginated) once expanded, so nothing is hidden,
// just collapsed by default.
const DEFAULT_VISIBLE_DATES = 8;

type Assessment = {
  id: string;
  scale: string;
  score: string;
  date: string;
  notes?: string | null;
};

type Props = {
  assessments: Assessment[];
  onOpenAssessment: (id: string) => void;
};

export function EvolutionTable({ assessments, onOpenAssessment }: Props) {
  const [showAll, setShowAll] = useState(false);

  // Unique dates sorted chronologically (columns)
  const allDates = useMemo(() => {
    const set = new Set(assessments.map((a) => a.date.slice(0, 10)));
    return [...set].sort();
  }, [assessments]);

  const hasMore = allDates.length > DEFAULT_VISIBLE_DATES;
  const dates = showAll ? allDates : allDates.slice(-DEFAULT_VISIBLE_DATES);

  // Map: scale → date → assessment
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, Assessment>> = {};
    for (const a of assessments) {
      const dateKey = a.date.slice(0, 10);
      if (!m[a.scale]) m[a.scale] = {};
      // Keep the latest assessment per scale+date
      m[a.scale][dateKey] = a;
    }
    return m;
  }, [assessments]);

  // Only show groups/scales that have at least one assessment
  const visibleGroups = useMemo(() => {
    return SCALE_GROUPS
      .map((group) => ({
        label: group.label,
        scales: group.scales.filter((s) => matrix[s]),
      }))
      .filter((g) => g.scales.length > 0);
  }, [matrix]);

  if (dates.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Sin evaluaciones registradas todavía.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hasMore && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
          <span>
            {showAll
              ? `Mostrando el historial completo (${allDates.length} fechas)`
              : `Mostrando las últimas ${DEFAULT_VISIBLE_DATES} fechas de ${allDates.length}`}
          </span>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-primary hover:underline underline-offset-2 font-medium"
          >
            {showAll ? "Ver solo recientes" : "Ver histórico completo"}
          </button>
        </div>
      )}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm border-collapse" style={{ minWidth: Math.max(500, dates.length * 140 + 160) }}>
        <thead>
          <tr className="bg-muted/40">
            <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2 border-b sticky left-0 bg-muted/40 z-10" style={{ minWidth: 140 }}>
              Prueba
            </th>
            {dates.map((d) => (
              <th key={d} className="text-center text-xs font-medium text-muted-foreground px-3 py-2 border-b border-l" style={{ minWidth: 120 }}>
                {formatDate(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleGroups.map((group) => (
            <Fragment key={group.label}>
              <tr key={`header-${group.label}`} className="bg-muted/20">
                <td colSpan={dates.length + 1} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
                  {group.label}
                </td>
              </tr>
              {group.scales.map((scaleName) => (
                <tr key={scaleName} className="hover:bg-muted/10 transition-colors">
                  <td className="px-3 py-2 text-sm font-medium border-b sticky left-0 bg-background z-10">
                    {scaleName}
                  </td>
                  {dates.map((d) => {
                    const a = matrix[scaleName]?.[d];
                    if (!a) {
                      return (
                        <td key={d} className="px-3 py-2 text-center text-muted-foreground border-b border-l">
                          —
                        </td>
                      );
                    }
                    // Truncate long qualitative text
                    const display = a.score.length > 60 ? a.score.slice(0, 57) + "…" : a.score;
                    return (
                      <td key={d} className="px-3 py-2 border-b border-l">
                        <button
                          type="button"
                          onClick={() => onOpenAssessment(a.id)}
                          className="w-full text-left text-xs leading-relaxed hover:text-primary hover:underline underline-offset-2 transition-colors"
                          title={a.score}
                        >
                          {display}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
