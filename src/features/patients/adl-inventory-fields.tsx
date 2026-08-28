"use client";

// Rejilla de captura del "Inventario de AVDs" (escala cualitativa de Asociación).
// Es un componente controlado: recibe `data` y avisa de cada cambio por
// `onChange`. Todo el contenido clínico (secciones, ítems, semáforos) vive en
// src/lib/adl-inventory.ts — aquí solo está la interfaz.

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Plus, X, ChevronRight } from "lucide-react";
import {
  ADL_INVENTORY_SECTIONS,
  AUTONOMY_OPTIONS,
  MODIFICATION_OPTIONS,
  CONCLUSION_OPTIONS,
  TRAFFIC_LIGHT_COLORS,
  emptyAdlItemData,
  adlItemHasData,
  type AdlBlock,
  type AdlInventoryData,
  type AdlItemData,
  type AdlCustomRow,
  type TrafficLight,
} from "@/lib/adl-inventory";

const BLOCK_LABELS: Record<AdlBlock, string> = {
  AVD: "AVD básicas",
  AIVD: "AIVD (instrumentales)",
};

// Selector de semáforo (verde / amarillo / rojo) reutilizado por las columnas
// de "autonomía" y "modificaciones".
function TrafficPicker({
  value,
  options,
  onChange,
}: {
  value: TrafficLight | null;
  options: { value: TrafficLight; label: string; help?: string }[];
  onChange: (v: TrafficLight | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const c = TRAFFIC_LIGHT_COLORS[opt.value];
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.help ?? opt.label}
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all",
              selected ? "font-semibold ring-2 ring-offset-1" : "opacity-70 hover:opacity-100",
            )}
            style={
              selected
                ? { backgroundColor: c.bg, color: c.text, borderColor: c.border, boxShadow: `0 0 0 2px ${c.dot}33` }
                : { backgroundColor: "transparent", color: "inherit", borderColor: "var(--border)" }
            }
          >
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Los 6 campos de una fila (comunes a ítems fijos y filas "Otras").
function ItemFields({
  value,
  onChange,
}: {
  value: AdlItemData;
  onChange: (patch: Partial<AdlItemData>) => void;
}) {
  return (
    <div className="grid gap-2.5">
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Estado de autonomía</Label>
        <TrafficPicker value={value.autonomy} options={AUTONOMY_OPTIONS} onChange={(v) => onChange({ autonomy: v })} />
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Desempeño / cambios</Label>
          <Textarea
            rows={2}
            className="text-sm"
            placeholder="Cómo realiza la actividad y cambios respecto a la valoración anterior…"
            value={value.desempeno}
            onChange={(e) => onChange({ desempeno: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Apoyos</Label>
          <Textarea
            rows={2}
            className="text-sm"
            placeholder="Ayudas técnicas, adaptaciones, apoyo físico/supervisión…"
            value={value.apoyos}
            onChange={(e) => onChange({ apoyos: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox checked={value.vigilancia} onCheckedChange={(v) => onChange({ vigilancia: !!v })} />
          Vigilancia
        </label>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox checked={value.prioridad} onCheckedChange={(v) => onChange({ prioridad: !!v })} />
          Prioridad / objetivo
        </label>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Modificaciones respecto a valoración anterior
        </Label>
        <TrafficPicker value={value.modificacion} options={MODIFICATION_OPTIONS} onChange={(v) => onChange({ modificacion: v })} />
      </div>
    </div>
  );
}

export function AdlInventoryFields({
  data,
  onChange,
}: {
  data: AdlInventoryData;
  onChange: (next: AdlInventoryData) => void;
}) {
  // Cada sección (Alimentación, Aseo…) se muestra plegada y se despliega al
  // pulsar su cabecera, para acortar la escala. El estado guarda solo las
  // secciones abiertas; por defecto todas empiezan plegadas. Como el contenido
  // vive en `data` (componente controlado), plegar/desplegar nunca pierde datos.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function setAllSections(open: boolean) {
    if (!open) {
      setOpenSections({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const s of ADL_INVENTORY_SECTIONS) next[s.id] = true;
    setOpenSections(next);
  }

  const allOpen = ADL_INVENTORY_SECTIONS.every((s) => openSections[s.id]);

  // Nº de ítems (fijos + "Otras" con nombre) con algún dato en una sección.
  function sectionDataCount(sectionId: string): number {
    const section = ADL_INVENTORY_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return 0;
    const fixed = section.items.filter((it) => adlItemHasData(data.items[it.id])).length;
    const customs = data.customRows.filter(
      (r) => r.sectionId === sectionId && (adlItemHasData(r) || !!r.label.trim()),
    ).length;
    return fixed + customs;
  }

  function updateItem(itemId: string, patch: Partial<AdlItemData>) {
    onChange({
      ...data,
      items: { ...data.items, [itemId]: { ...data.items[itemId], ...patch } },
    });
  }

  function updateCustom(rowId: string, patch: Partial<AdlCustomRow>) {
    onChange({
      ...data,
      customRows: data.customRows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
    });
  }

  function addCustom(sectionId: string) {
    const row: AdlCustomRow = {
      ...emptyAdlItemData(),
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sectionId,
      label: "",
    };
    onChange({ ...data, customRows: [...data.customRows, row] });
  }

  function removeCustom(rowId: string) {
    onChange({ ...data, customRows: data.customRows.filter((r) => r.id !== rowId) });
  }

  // Render agrupado por bloque (AVD / AIVD).
  const blocks: AdlBlock[] = ["AVD", "AIVD"];

  return (
    <div className="sm:col-span-2 space-y-6">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => setAllSections(!allOpen)}
        >
          {allOpen ? "Plegar todo" : "Desplegar todo"}
        </Button>
      </div>

      {blocks.map((block) => (
        <div key={block} className="space-y-4">
          <h3 className="text-sm font-bold text-[#1a5c58] uppercase tracking-wide">{BLOCK_LABELS[block]}</h3>

          {ADL_INVENTORY_SECTIONS.filter((s) => s.block === block).map((section) => {
            const rows = data.customRows.filter((r) => r.sectionId === section.id);
            const open = !!openSections[section.id];
            const count = sectionDataCount(section.id);
            return (
              <div key={section.id} className="rounded-lg border bg-card">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={open}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2 text-left bg-muted/40 hover:bg-muted/60 transition-colors",
                    open && "border-b",
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <ChevronRight
                      className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
                    />
                    <span className="text-sm font-semibold truncate">{section.title}</span>
                  </span>
                  {count > 0 ? (
                    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-[#1a5c58]/10 border-[#1a5c58]/20 text-[#1a5c58]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1a5c58]" />
                      {count} con {count === 1 ? "dato" : "datos"}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                      Sin datos
                    </span>
                  )}
                </button>

                {open && (
                  <>
                    {section.note && (
                      <p className="px-3 pt-2 text-[11px] text-muted-foreground">{section.note}</p>
                    )}

                    <div className="p-2.5 space-y-2.5">
                      {section.items.map((item) => {
                        const filled = adlItemHasData(data.items[item.id]);
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "rounded-lg border px-3 py-2.5 space-y-2.5",
                              filled ? "bg-[#1a5c58]/[0.04] border-[#1a5c58]/25" : "bg-background",
                            )}
                          >
                            <p className="text-sm font-semibold flex items-center gap-2">
                              <span className="w-1 h-4 rounded-full bg-[#1a5c58] shrink-0" />
                              {item.label}
                            </p>
                            <ItemFields value={data.items[item.id]} onChange={(patch) => updateItem(item.id, patch)} />
                          </div>
                        );
                      })}

                      {rows.map((row) => (
                        <div
                          key={row.id}
                          className="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 space-y-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full bg-[#1a5c58]/50 shrink-0" />
                            <Input
                              className="text-sm h-8"
                              placeholder="Otra actividad (escribe cuál)…"
                              value={row.label}
                              onChange={(e) => updateCustom(row.id, { label: e.target.value })}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => removeCustom(row.id)}
                              aria-label="Quitar fila"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <ItemFields value={row} onChange={(patch) => updateCustom(row.id, patch)} />
                        </div>
                      ))}
                    </div>

                    {section.allowCustom && (
                      <div className="px-3 py-2 border-t">
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addCustom(section.id)}>
                          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir otra
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Percepción y conclusión (foco en autonomía — indicador de proyectos) */}
      <div className="rounded-lg border-2 border-[#1a5c58]/30 bg-[#1a5c58]/5 p-3 space-y-3">
        <h3 className="text-sm font-bold text-[#1a5c58]">Percepción y conclusión</h3>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Percepción de la persona sobre su autonomía
          </Label>
          <Textarea
            rows={2}
            className="text-sm bg-background"
            placeholder="Cómo percibe la persona su propia autonomía…"
            value={data.perception}
            onChange={(e) => onChange({ ...data, perception: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Conclusión de autonomía (comparando con la valoración anterior)
          </Label>
          <TrafficPicker
            value={data.conclusion}
            options={CONCLUSION_OPTIONS}
            onChange={(v) => onChange({ ...data, conclusion: v })}
          />
        </div>
      </div>
    </div>
  );
}
