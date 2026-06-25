"use client";

import {
  STRUCTURED_SCALE_DEFINITIONS,
  VAVDI_BLOCKS,
  computeScaleTotal,
  type ScaleItem,
} from "@/lib/scales";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Props = {
  scale: string;
  itemScores: Record<string, number>;
  onChange: (itemScores: Record<string, number>) => void;
};

// Renders the item-by-item form for a structured scale (Barthel,
// Lawton-Brody, VAVDI) and shows the live computed total + interpretation
// underneath, so the professional never has to add up points by hand.
export function StructuredScaleFields({ scale, itemScores, onChange }: Props) {
  const def = STRUCTURED_SCALE_DEFINITIONS[scale];
  if (!def) return null;

  function setItem(itemId: string, value: number) {
    onChange({ ...itemScores, [itemId]: value });
  }

  const total = computeScaleTotal(scale, itemScores);
  const answeredCount = def.items.filter((i) => itemScores[i.id] !== undefined).length;
  const isComplete = answeredCount === def.items.length;

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
              {opt.value} — {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
