import type { AreaSummaryData } from "@/types/domain";
import { CircleCheck, AlertCircle } from "lucide-react";

// Renders the rule-based area summary (Barthel/VAVDI) as two clearly
// separated, colored columns per clinical block — strengths in green,
// areas to work on in amber/red — so the professional can tell at a
// glance what's preserved vs. what needs attention, instead of having to
// read a full paragraph to mentally separate the two.
export function AreaSummaryView({ data }: { data: AreaSummaryData }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 space-y-3">
      <p className="text-xs font-semibold text-primary">Conclusión por áreas</p>
      {data.blocks.map((block) => (
        <div key={block.title}>
          <p className="text-xs font-semibold mb-1.5">{block.title}</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 mb-1">
                <CircleCheck className="w-3.5 h-3.5" /> Buen desempeño
              </p>
              {block.strengths.length > 0 ? (
                <ul className="text-xs space-y-0.5 list-disc list-inside text-foreground">
                  {block.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">Ninguna</p>
              )}
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1 mb-1">
                <AlertCircle className="w-3.5 h-3.5" /> A trabajar
              </p>
              {block.toWork.length > 0 ? (
                <ul className="text-xs space-y-0.5 list-disc list-inside text-foreground">
                  {block.toWork.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">Ninguna</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
