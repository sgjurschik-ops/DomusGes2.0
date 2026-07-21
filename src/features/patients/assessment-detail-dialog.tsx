"use client";

import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useAssessment,
  useUpdateAssessment,
  useDeleteAssessment,
} from "@/hooks/api";
import {
  assessmentUpdateSchema,
  type AssessmentUpdateInput,
  ASSESSMENT_SCALES,
  STRUCTURED_SCALES,
  QUALITATIVE_SCALES,
  SCALE_GROUPS,
} from "@/lib/schemas";
import { formatScaleScore, STRUCTURED_SCALE_DEFINITIONS, computeScaleSubscales } from "@/lib/scales";
import { StructuredScaleFields } from "./structured-scale-fields";
import { CopmFields, formatCopmScore, type CopmData } from "./copm-fields";
import { AreaSummaryView } from "./area-summary-view";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Pencil, BarChart3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/components/domain";

type Props = {
  assessmentId: string;
  patientId: string;
  onClose: () => void;
};

export function AssessmentDetailDialog({ assessmentId, patientId, onClose }: Props) {
  const { data: assessment, isLoading } = useAssessment(assessmentId);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={isEditing ? "max-w-4xl sm:max-w-4xl min-w-0 max-h-[85vh] overflow-y-auto" : "max-w-2xl sm:max-w-2xl min-w-0 max-h-[85vh] overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle>Detalle de la evaluación</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Corrige los datos registrados. Los cambios se guardan al pulsar "Guardar cambios".'
              : "Resumen de la evaluación registrada."}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !assessment ? (
          <p className="text-sm text-muted-foreground py-6">Cargando evaluación…</p>
        ) : isEditing ? (
          <AssessmentEditForm
            assessmentId={assessmentId}
            patientId={patientId}
            assessment={assessment}
            onCancel={() => setIsEditing(false)}
            onSaved={onClose}
          />
        ) : (
          <AssessmentSummary
            assessment={assessment}
            onEdit={() => setIsEditing(true)}
            onClose={onClose}
            patientId={patientId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── COPM read-only summary ──────────────────────────────────────────────────

const AREA_META: Record<string, { title: string; color: string }> = {
  selfcare: { title: "Cuidado de sí mismo", color: "bg-teal-500" },
  productivity: { title: "Productividad", color: "bg-amber-500" },
  leisure: { title: "Ocio", color: "bg-violet-500" },
};

function CopmSummary({
  assessment,
}: {
  assessment: { score: string; itemScores?: Record<string, number> | null; areaSummary?: unknown };
}) {
  // areaSummary holds the full COPM data structure
  const data = assessment.areaSummary as {
    problems?: { uid: string; areaId: string; subcatId: string; description: string; importance?: number }[];
    selected?: { uid: string; performance?: number; satisfaction?: number; performance2?: number; satisfaction2?: number }[];
  } | null;

  if (!data?.problems || data.problems.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/40 px-4 py-3">
        <p className="text-sm font-semibold">{assessment.score}</p>
      </div>
    );
  }

  const selectedUids = new Set((data.selected ?? []).map((s) => s.uid));
  const selectedMap = new Map((data.selected ?? []).map((s) => [s.uid, s]));

  // Group by area
  const byArea: Record<string, typeof data.problems> = {};
  for (const p of data.problems) {
    if (!p.description?.trim()) continue;
    (byArea[p.areaId] ??= []).push(p);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/40 px-4 py-3">
        <p className="text-sm font-semibold">{assessment.score}</p>
      </div>

      {/* Visual problem map */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-semibold">Problemas identificados</p>
        </div>
        {Object.entries(byArea).map(([areaId, probs]) => {
          const meta = AREA_META[areaId] ?? { title: areaId, color: "bg-gray-400" };
          return (
            <div key={areaId} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-sm ${meta.color}`} />
                <span className="text-xs font-medium">{meta.title}</span>
              </div>
              {probs.map((prob) => {
                const isSelected = selectedUids.has(prob.uid);
                const sel = selectedMap.get(prob.uid);
                return (
                  <div key={prob.uid} className="pl-5 flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? meta.color : "bg-muted-foreground/30"}`} />
                    <span className={isSelected ? "font-medium" : "text-muted-foreground"}>
                      {prob.description}
                    </span>
                    <span className="text-muted-foreground">Imp: {prob.importance ?? "—"}</span>
                    {isSelected && sel && (
                      <span className="text-muted-foreground">
                        · Des: {sel.performance ?? "—"} · Sat: {sel.satisfaction ?? "—"}
                        {sel.performance2 !== undefined && (
                          <> · Des₂: {sel.performance2} · Sat₂: {sel.satisfaction2 ?? "—"}</>
                        )}
                      </span>
                    )}
                    {isSelected && <span className="text-amber-500 font-bold">★</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Read-only summary ───────────────────────────────────────────────────────

function AssessmentSummary({
  assessment,
  onEdit,
  onClose,
  patientId,
}: {
  assessment: NonNullable<ReturnType<typeof useAssessment>["data"]>;
  onEdit: () => void;
  onClose: () => void;
  patientId: string;
}) {
  const remove = useDeleteAssessment();
  const def = STRUCTURED_SCALE_DEFINITIONS[assessment.scale];
  const isCopm = assessment.scale === "COPM";
  const subscaleTotals = assessment.itemScores
    ? computeScaleSubscales(assessment.scale, assessment.itemScores)
    : null;

  async function handleDelete() {
    const ok = confirm("¿Seguro que quieres eliminar esta evaluación? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: assessment.id, patientId });
      toast({ title: "Evaluación eliminada" });
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "No se ha podido eliminar la evaluación.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{assessment.scale}</span>
        <span className="text-muted-foreground">{formatDate(assessment.date)} · {assessment.therapistName}</span>
      </div>

      {isCopm ? (
        <CopmSummary assessment={assessment} />
      ) : def && assessment.itemScores ? (
        <>
          <div className="rounded-lg border bg-muted/40 px-4 py-3">
            <p className="text-sm font-semibold">{assessment.score}</p>
          </div>
          {subscaleTotals && (
            <div className="grid sm:grid-cols-3 gap-2">
              {subscaleTotals.map((s) => (
                <div key={s.title} className="rounded-lg border px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">{s.title}</p>
                  <p className="text-sm font-semibold">{s.total}/{s.maxScore}</p>
                </div>
              ))}
            </div>
          )}
          <ul className="divide-y divide-border rounded-lg border">
            {def.items.map((item) => {
              const score = assessment.itemScores?.[item.id];
              const opt = item.options.find((o) => o.value === score);
              const itemMax = Math.max(...item.options.map((o) => o.value));
              return (
                <li key={item.id} className="px-3 py-2 text-sm">
                  <p className="text-muted-foreground">{item.label}</p>
                  <p className="font-medium mt-0.5">
                    {opt ? (
                      <>
                        {opt.value}/{itemMax}{" "}
                        <span className="text-muted-foreground font-normal">— {opt.shortLabel}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="rounded-lg border bg-muted/40 px-4 py-3">
          <p className="text-sm font-semibold font-mono">{assessment.score}</p>
        </div>
      )}

      {!isCopm && assessment.areaSummary && <AreaSummaryView data={assessment.areaSummary} />}

      {assessment.notes && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Notas</p>
          <p className="text-sm whitespace-pre-wrap">{assessment.notes}</p>
        </div>
      )}

      <DialogFooter className="flex items-center justify-between sm:justify-between">
        <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={remove.isPending}>
          <Trash2 className="w-4 h-4 mr-1.5" />
          Eliminar
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" size="sm" onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-1.5" />
            Editar
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}

// ─── Edit form ───────────────────────────────────────────────────────────────

function AssessmentEditForm({
  assessmentId,
  patientId,
  assessment,
  onCancel,
  onSaved,
}: {
  assessmentId: string;
  patientId: string;
  assessment: NonNullable<ReturnType<typeof useAssessment>["data"]>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const update = useUpdateAssessment();
  const [itemScores, setItemScores] = useState<Record<string, number>>(assessment.itemScores ?? {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [copmData, setCopmData] = useState<any>(assessment.areaSummary ?? null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AssessmentUpdateInput>({
    resolver: zodResolver(assessmentUpdateSchema) as Resolver<AssessmentUpdateInput>,
    defaultValues: {
      scale: assessment.scale as AssessmentUpdateInput["scale"],
      score: assessment.score,
      notes: assessment.notes ?? "",
      date: assessment.date.slice(0, 10),
    },
  });

  const scale = watch("scale");
  const isCopm = scale === "COPM";
  const isStructured = (STRUCTURED_SCALES as readonly string[]).includes(scale);
  const isQualitative = (QUALITATIVE_SCALES as readonly string[]).includes(scale);

  useEffect(() => {
    if (isCopm) {
      setValue("score", formatCopmScore(itemScores), { shouldValidate: false });
    } else if (isStructured) {
      setValue("score", formatScaleScore(scale, itemScores), { shouldValidate: false });
    }
  }, [isStructured, isCopm, scale, itemScores, setValue]);

  async function onSubmit(values: AssessmentUpdateInput) {
    try {
      const payload = isCopm
        ? { ...values, itemScores, areaSummary: copmData }
        : isStructured
          ? { ...values, itemScores }
          : values;
      await update.mutateAsync({ id: assessmentId, data: payload });
      toast({ title: "Evaluación actualizada" });
      onSaved();
    } catch {
      toast({
        title: "Error",
        description: "No se ha podido actualizar la evaluación.",
        variant: "destructive",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="scale" className="text-xs">Escala</Label>
        <Select
          value={scale}
          onValueChange={(v) => {
            setValue("scale", v as AssessmentUpdateInput["scale"]);
            setItemScores({});
          }}
        >
          <SelectTrigger id="scale"><SelectValue /></SelectTrigger>
          <SelectContent>
                {SCALE_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel className="text-xs text-muted-foreground font-semibold">{group.label}</SelectLabel>
                    {group.scales.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
        </Select>
      </div>

      {isStructured ? (
        <input type="hidden" {...register("score")} />
      ) : isQualitative ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="score" className="text-xs">Observaciones</Label>
          <Textarea id="score" rows={4}
            placeholder="Describe los hallazgos de la exploración…"
            {...register("score")} />
          {errors.score && <p className="text-xs text-destructive">{errors.score.message}</p>}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="score" className="text-xs">Puntuación</Label>
          <Input id="score" placeholder="p. ej. 5/10, 18/27" {...register("score")} />
          {errors.score && <p className="text-xs text-destructive">{errors.score.message}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="date" className="text-xs">Fecha</Label>
        <Input id="date" type="date" {...register("date")} />
        {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
      </div>

      {isCopm ? (
        <CopmFields
          itemScores={itemScores}
          onChange={setItemScores}
          onProblemsChange={setCopmData}
          showReeval
          initialData={assessment.areaSummary as CopmData | null}
        />
      ) : isStructured ? (
        <StructuredScaleFields scale={scale} itemScores={itemScores} onChange={setItemScores} />
      ) : null}

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="notes" className="text-xs">Notas (opcional)</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <DialogFooter className="sm:col-span-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={update.isPending}>
          {update.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </DialogFooter>
    </form>
  );
}
