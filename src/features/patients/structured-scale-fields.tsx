"use client";

import {
  STRUCTURED_SCALE_DEFINITIONS,
  VAVDI_BLOCKS,
  computeScaleTotal,
  generateAreaSummaryData,
  formatScaleScore,
  TUG_AIDS,
  TUG_ASSISTANCE,
  type ScaleItem,
} from "@/lib/scales";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AreaSummaryView } from "./area-summary-view";

type Props = {
  scale: string;
  itemScores: Record<string, number>;
  onChange: (itemScores: Record<string, number>) => void;
};

const MEASUREMENT_SCALES = ["9HPT", "Box and Block", "TUG", "JAMAR", "Minnesota"];

// Renders the item-by-item form for a structured scale (Barthel,
// Lawton-Brody, VAVDI) or a measurement scale (9HPT, Box and Block, TUG),
// and shows the live computed total + interpretation underneath.
export function StructuredScaleFields({ scale, itemScores, onChange }: Props) {
  // Measurement scales — specific form fields
  if (MEASUREMENT_SCALES.includes(scale)) {
    return <MeasurementScaleFields scale={scale} itemScores={itemScores} onChange={onChange} />;
  }

  const def = STRUCTURED_SCALE_DEFINITIONS[scale];
  if (!def) return null;

  function setItem(itemId: string, value: number) {
    onChange({ ...itemScores, [itemId]: value });
  }

  const total = computeScaleTotal(scale, itemScores);
  const answeredCount = def.items.filter((i) => itemScores[i.id] !== undefined).length;
  const isComplete = answeredCount === def.items.length;
  const areaSummaryData = isComplete ? generateAreaSummaryData(scale, itemScores) : null;

  return (
    <div className="sm:col-span-2 space-y-4">
      <p className="text-xs text-muted-foreground">{def.description}</p>

      {scale === "VAVDI" ? (
        VAVDI_BLOCKS.map((block) => (
          <div key={block.title} className="space-y-3">
            <p className="text-xs font-semibold text-foreground">{block.title}</p>
            <div className="space-y-3">
              {block.items.map((item) => (
                <ScaleItemRow
                  key={item.id}
                  item={item}
                  value={itemScores[item.id]}
                  onChange={(v) => setItem(item.id, v)}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="space-y-3">
          {def.items.map((item) => (
            <ScaleItemRow
              key={item.id}
              item={item}
              value={itemScores[item.id]}
              onChange={(v) => setItem(item.id, v)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {answeredCount}/{def.items.length} ítems respondidos
          </p>
          <p className="text-sm font-semibold">
            Puntuación total: {total}/{def.maxScore}
          </p>
        </div>
        <p
          className={
            "text-sm font-medium " + (isComplete ? "text-foreground" : "text-muted-foreground italic")
          }
        >
          {isComplete ? def.interpret(total) : "Responde todos los ítems para ver la interpretación"}
        </p>
      </div>

      {areaSummaryData && <AreaSummaryView data={areaSummaryData} />}
    </div>
  );
}

function ScaleItemRow({
  item,
  value,
  onChange,
}: {
  item: ScaleItem;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{item.label}</Label>
      <Select value={value !== undefined ? String(value) : ""} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className={"w-full " + (value === undefined ? "bg-muted/60" : "")}>
          <SelectValue placeholder="Seleccionar" />
        </SelectTrigger>
        <SelectContent>
          {item.options.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              {opt.description ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block w-full text-left">{opt.value} — {opt.label}</span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-sm leading-relaxed p-3">
                    {opt.description}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <>{opt.value} — {opt.label}</>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Measurement scale form fields ──────────────────────────────────────────
function MeasurementScaleFields({ scale, itemScores, onChange }: Props) {
  function set(key: string, value: number | string) {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (!isNaN(num)) onChange({ ...itemScores, [key]: num });
  }

  const score = formatScaleScore(scale, itemScores);

  if (scale === "9HPT") {
    return (
      <div className="sm:col-span-2 space-y-4">
        <p className="text-xs text-muted-foreground">
          Nine Hole Peg Test — Evalúa la destreza manual fina y la coordinación de cada miembro superior. Cuanto menor sea el tiempo, mejor destreza manual.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mano dominante (segundos)</Label>
            <Input type="number" step="0.1" min="0" placeholder="Ej. 18.5"
              value={itemScores["dominant"] ?? ""} onChange={(e) => set("dominant", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mano no dominante (segundos)</Label>
            <Input type="number" step="0.1" min="0" placeholder="Ej. 22.3"
              value={itemScores["nonDominant"] ?? ""} onChange={(e) => set("nonDominant", e.target.value)} />
          </div>
        </div>
        {score && <p className="text-sm font-medium bg-accent/40 rounded-md px-3 py-2">{score}</p>}
      </div>
    );
  }

  if (scale === "Box and Block") {
    return (
      <div className="sm:col-span-2 space-y-4">
        <p className="text-xs text-muted-foreground">
          Box and Block Test — Evalúa la destreza manual gruesa y la velocidad de manipulación. Cuanto mayor sea el número de bloques trasladados en 60 segundos, mejor rendimiento.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Mano dominante (bloques en 60s)</Label>
            <Input type="number" step="1" min="0" placeholder="Ej. 45"
              value={itemScores["dominant"] ?? ""} onChange={(e) => set("dominant", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mano no dominante (bloques en 60s)</Label>
            <Input type="number" step="1" min="0" placeholder="Ej. 38"
              value={itemScores["nonDominant"] ?? ""} onChange={(e) => set("nonDominant", e.target.value)} />
          </div>
        </div>
        {score && <p className="text-sm font-medium bg-accent/40 rounded-md px-3 py-2">{score}</p>}
      </div>
    );
  }

  if (scale === "TUG") {
    return (
      <div className="sm:col-span-2 space-y-4">
        <p className="text-xs text-muted-foreground">
          Timed Up and Go — Evalúa la movilidad funcional y el equilibrio dinámico. Cuanto menor sea el tiempo, mejor movilidad funcional.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tiempo (segundos)</Label>
            <Input type="number" step="0.1" min="0" placeholder="Ej. 12.5"
              value={itemScores["time"] ?? ""} onChange={(e) => set("time", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ayuda técnica</Label>
            <Select value={itemScores["aid_idx"] !== undefined ? String(itemScores["aid_idx"]) : ""} onValueChange={(v) => set("aid_idx", parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {TUG_AIDS.map((aid, i) => <SelectItem key={aid} value={String(i)}>{aid}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nivel de asistencia</Label>
            <Select value={itemScores["assist_idx"] !== undefined ? String(itemScores["assist_idx"]) : ""} onValueChange={(v) => set("assist_idx", parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {TUG_ASSISTANCE.map((a, i) => <SelectItem key={a} value={String(i)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {score && <p className="text-sm font-medium bg-accent/40 rounded-md px-3 py-2">{score}</p>}
      </div>
    );
  }

  if (scale === "JAMAR") {
    return (
      <div className="sm:col-span-2 space-y-4">
        <p className="text-xs text-muted-foreground">
          Dinamometría JAMAR — Evalúa la fuerza de prensión. Registra hasta 3 intentos por mano (kg). Se recomienda registrar al menos 1 intento por lado.
        </p>
        {[1, 2, 3].map((attempt) => (
          <div key={attempt} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Intento {attempt}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">MSD (kg)</Label>
                <Input type="number" step="0.5" min="0" placeholder="Ej. 35"
                  value={itemScores[`msd_${attempt}`] ?? ""} onChange={(e) => set(`msd_${attempt}`, e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">MSI (kg)</Label>
                <Input type="number" step="0.5" min="0" placeholder="Ej. 22"
                  value={itemScores[`msi_${attempt}`] ?? ""} onChange={(e) => set(`msi_${attempt}`, e.target.value)} />
              </div>
            </div>
          </div>
        ))}
        {score && <p className="text-sm font-medium bg-accent/40 rounded-md px-3 py-2">{score}</p>}
      </div>
    );
  }

  if (scale === "Minnesota") {
    return (
      <div className="sm:col-span-2 space-y-4">
        <p className="text-xs text-muted-foreground">
          Minnesota Rate of Manipulation Test — Evalúa la destreza manipulativa. Registra el tiempo (en segundos) de cada prueba por mano.
        </p>
        {[1, 2, 3].map((trial) => (
          <div key={trial} className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Prueba {trial}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">MSD (segundos)</Label>
                <Input type="number" step="0.1" min="0" placeholder='Ej. 19'
                  value={itemScores[`p${trial}_msd`] ?? ""} onChange={(e) => set(`p${trial}_msd`, e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">MSI (segundos)</Label>
                <Input type="number" step="0.1" min="0" placeholder='Ej. 23'
                  value={itemScores[`p${trial}_msi`] ?? ""} onChange={(e) => set(`p${trial}_msi`, e.target.value)} />
              </div>
            </div>
          </div>
        ))}
        {score && <p className="text-sm font-medium bg-accent/40 rounded-md px-3 py-2">{score}</p>}
      </div>
    );
  }

  return null;
}
