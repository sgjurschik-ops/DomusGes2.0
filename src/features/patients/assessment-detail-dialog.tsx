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
import { formatScaleScore } from "@/lib/scales";
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
import { Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Props = {
  assessmentId: string;
  patientId: string;
  onClose: () => void;
};

// Lets the professional open a previously saved assessment from the
// history list, review/edit its answers (item by item for structured
// scales), add or change notes, and save or delete it.
export function AssessmentDetailDialog({ assessmentId, patientId, onClose }: Props) {
  const { data: assessment, isLoading } = useAssessment(assessmentId);
  const update = useUpdateAssessment();
  const remove = useDeleteAssessment();
  const [itemScores, setItemScores] = useState<Record<string, number>>({});

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AssessmentUpdateInput>({
    resolver: zodResolver(assessmentUpdateSchema) as Resolver<AssessmentUpdateInput>,
    defaultValues: { scale: "VAVDI", score: "", notes: "", date: "" },
  });

  useEffect(() => {
    if (!assessment) return;
    reset({
      scale: assessment.scale,
      score: assessment.score,
      notes: assessment.notes ?? "",
      date: assessment.date.slice(0, 10),
    });
    setItemScores(assessment.itemScores ?? {});
  }, [assessment, reset]);

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
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "No se ha podido actualizar la evaluación.",
        variant: "destructive",
      });
    }
  }

  async function handleDelete() {
    const ok = confirm("¿Seguro que quieres eliminar esta evaluación? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: assessmentId, patientId });
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de la evaluación</DialogTitle>
          <DialogDescription>
            Revisa o corrige los datos registrados. Los cambios se guardan al pulsar &quot;Guardar cambios&quot;.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !assessment ? (
          <p className="text-sm text-muted-foreground py-6">Cargando evaluación…</p>
        ) : (
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

            <DialogFooter className="sm:col-span-2 flex items-center justify-between sm:justify-between">
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={remove.isPending}>
                <Trash2 className="w-4 h-4 mr-1.5" />
                Eliminar
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={update.isPending}>
                  {update.isPending ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
