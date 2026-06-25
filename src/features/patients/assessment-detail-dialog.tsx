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
} from "@/lib/schemas";
import { formatScaleScore, STRUCTURED_SCALE_DEFINITIONS } from "@/lib/scales";
import { StructuredScaleFields } from "./structured-scale-fields";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/components/domain";

type Props = {
  assessmentId: string;
  patientId: string;
  onClose: () => void;
};

// Lets the professional open a previously saved assessment from the
// history list. Opens in a compact, read-only summary (scale, date, every
// item's score, total, interpretation, notes) — editing the full item form
// inside the narrow dialog caused long option labels to overlap across the
// 2-column grid, so editing is a deliberate second step via "Editar",
// which switches to the same form used to create an assessment.
export function AssessmentDetailDialog({ assessmentId, patientId, onClose }: Props) {
  const { data: assessment, isLoading } = useAssessment(assessmentId);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={isEditing ? "max-w-4xl max-h-[85vh] overflow-y-auto" : "max-w-2xl max-h-[85vh] overflow-y-auto"}>
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

      {def && assessment.itemScores ? (
        <>
          <div className="rounded-lg border bg-muted/40 px-4 py-3">
            <p className="text-sm font-semibold">{assessment.score}</p>
          </div>
          <ul className="divide-y divide-border rounded-lg border">
            {def.items.map((item) => {
              const score = assessment.itemScores?.[item.id];
              const opt = item.options.find((o) => o.value === score);
              // Each item's own max (not the scale's max) — Barthel items
              // have different ranges per item (e.g. "Baño" 0-5 vs.
              // "Alimentación" 0-10), so this must come from that item's
              // own options, not a shared constant.
              const itemMax = Math.max(...item.options.map((o) => o.value));
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-muted-foreground truncate">{item.label}</span>
                  <span className="font-medium shrink-0 text-right">
                    {opt ? (
                      <>
                        {opt.value}/{itemMax} <span className="text-muted-foreground">— {opt.shortLabel}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AssessmentUpdateInput>({
    resolver: zodResolver(assessmentUpdateSchema) as Resolver<AssessmentUpdateInput>,
    defaultValues: {
      scale: assessment.scale,
      score: assessment.score,
      notes: assessment.notes ?? "",
      date: assessment.date.slice(0, 10),
    },
  });

  const scale = watch("scale");
  const isStructured = (STRUCTURED_SCALES as readonly string[]).includes(scale);

  useEffect(() => {
    if (isStructured) {
      setValue("score", formatScaleScore(scale, itemScores), { shouldValidate: false });
    }
  }, [isStructured, scale, itemScores, setValue]);

  async function onSubmit(values: AssessmentUpdateInput) {
    try {
      const payload = isStructured ? { ...values, itemScores } : values;
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
            {ASSESSMENT_SCALES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isStructured ? (
        <input type="hidden" {...register("score")} />
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

      {isStructured && (
        <StructuredScaleFields scale={scale} itemScores={itemScores} onChange={setItemScores} />
      )}

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

