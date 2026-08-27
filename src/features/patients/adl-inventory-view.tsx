"use client";

// Vista de solo lectura de un "Inventario de AVDs" ya guardado. Muestra
// únicamente los ítems que tienen algún dato, agrupados por sección, más el
// bloque de percepción/conclusión. El contenido clínico vive en
// src/lib/adl-inventory.ts.

import {
  ADL_INVENTORY_SECTIONS,
  AUTONOMY_OPTIONS,
  MODIFICATION_OPTIONS,
  CONCLUSION_OPTIONS,
  TRAFFIC_LIGHT_COLORS,
  type AdlInventoryData,
  type AdlItemData,
  type TrafficLight,
} from "@/lib/adl-inventory";

type TrafficOption = { value: TrafficLight; label: string; help?: string };

function labelFor(value: TrafficLight, options: TrafficOption[]): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function Light({ value, options }: { value: TrafficLight | null; options: TrafficOption[] }) {
  if (!value) return null;
  const c = TRAFFIC_LIGHT_COLORS[value];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.dot }} />
      {labelFor(value, options)}
    </span>
  );
}

function hasData(d: AdlItemData | undefined): boolean {
  if (!d) return false;
  return (
    d.autonomy !== null ||
    d.modificacion !== null ||
    !!d.desempeno ||
    !!d.apoyos ||
    d.vigilancia ||
    d.prioridad
  );
}

function Row({ label, d }: { label: string; d: AdlItemData }) {
  return (
    <div className="px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Light value={d.autonomy} options={AUTONOMY_OPTIONS} />
          {d.vigilancia && (
            <span className="rounded-full border px-2 py-0.5 text-[11px] bg-amber-50 border-amber-200 text-amber-900">
              Vigilancia
            </span>
          )}
          {d.prioridad && (
            <span className="rounded-full border px-2 py-0.5 text-[11px] bg-[#1a5c58]/10 border-[#1a5c58]/20 text-[#1a5c58]">
              Prioridad
            </span>
          )}
        </div>
      </div>
      {d.desempeno && (
        <p className="text-xs">
          <span className="text-muted-foreground">Desempeño: </span>
          {d.desempeno}
        </p>
      )}
      {d.apoyos && (
        <p className="text-xs">
          <span className="text-muted-foreground">Apoyos: </span>
          {d.apoyos}
        </p>
      )}
      {d.modificacion && (
        <div>
          <Light value={d.modificacion} options={MODIFICATION_OPTIONS} />
        </div>
      )}
    </div>
  );
}

export function AdlInventoryView({ data }: { data: AdlInventoryData }) {
  const anyData =
    ADL_INVENTORY_SECTIONS.some((s) => s.items.some((it) => hasData(data.items[it.id]))) ||
    data.customRows.some((r) => hasData(r)) ||
    !!data.perception ||
    !!data.conclusion;

  if (!anyData) {
    return <p className="text-sm text-muted-foreground">Inventario sin datos registrados.</p>;
  }

  return (
    <div className="space-y-3">
      {ADL_INVENTORY_SECTIONS.map((section) => {
        const items = section.items.filter((it) => hasData(data.items[it.id]));
        const customs = data.customRows.filter((r) => r.sectionId === section.id && (hasData(r) || !!r.label));
        if (items.length === 0 && customs.length === 0) return null;
        return (
          <div key={section.id} className="rounded-lg border">
            <div className="px-3 py-1.5 border-b bg-muted/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</p>
            </div>
            <div className="divide-y">
              {items.map((it) => (
                <Row key={it.id} label={it.label} d={data.items[it.id]} />
              ))}
              {customs.map((r) => (
                <Row key={r.id} label={r.label || "Otra"} d={r} />
              ))}
            </div>
          </div>
        );
      })}

      {(data.perception || data.conclusion) && (
        <div className="rounded-lg border-2 border-[#1a5c58]/30 bg-[#1a5c58]/5 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1a5c58]">Percepción y conclusión</p>
          {data.perception && <p className="text-sm">{data.perception}</p>}
          {data.conclusion && <Light value={data.conclusion} options={CONCLUSION_OPTIONS} />}
        </div>
      )}
    </div>
  );
}
