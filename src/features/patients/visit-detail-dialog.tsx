"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useVisit, useUpdateVisit, useDeleteVisit, useProfessionals } from "@/hooks/api";
import { visitUpdateSchema, type VisitUpdateInput } from "@/lib/schemas";
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
import { RichTextarea } from "@/components/rich-textarea";
import { ClinicalNotes } from "@/components/clinical-notes";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Pencil, X, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/components/domain";

type Props = {
  visitId: string;
  patientId: string;
  onClose: () => void;
};

// Same pattern as AssessmentDetailDialog: opens read-only, "Editar" switches
// to the edit form, both inside one dialog so the person never leaves the
// "Visitas" tab.
export function VisitDetailDialog({ visitId, patientId, onClose }: Props) {
  const { data: visit, isLoading } = useVisit(visitId);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={isEditing ? "max-w-4xl sm:max-w-4xl min-w-0 max-h-[85vh] overflow-y-auto" : "max-w-2xl sm:max-w-2xl min-w-0 max-h-[85vh] overflow-y-auto"}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar seguimiento" : "Detalle del seguimiento"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Corrige los datos registrados. Los cambios se guardan al pulsar "Guardar cambios".'
              : "Resumen del seguimiento registrado."}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !visit ? (
          <p className="text-sm text-muted-foreground py-6">Cargando seguimiento…</p>
        ) : isEditing ? (
          <VisitEditForm
            visitId={visitId}
            patientId={patientId}
            visit={visit}
            onCancel={() => setIsEditing(false)}
            onSaved={onClose}
          />
        ) : (
          <VisitSummary
            visit={visit}
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

function VisitSummary({
  visit,
  onEdit,
  onClose,
  patientId,
}: {
  visit: NonNullable<ReturnType<typeof useVisit>["data"]>;
  onEdit: () => void;
  onClose: () => void;
  patientId: string;
}) {
  const remove = useDeleteVisit();

  async function handleDelete() {
    const ok = confirm("¿Seguro que quieres eliminar este seguimiento? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: visit.id, patientId });
      toast({ title: "Seguimiento eliminado" });
      onClose();
    } catch {
      toast({
        title: "Error",
        description: "No se ha podido eliminar el seguimiento.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-base">{visit.title ?? "Seguimiento"}</p>
        <div className="flex items-center justify-between text-sm mt-0.5">
          <span className="text-muted-foreground">{formatDateTime(visit.date)}</span>
          <span className="text-muted-foreground">{visit.durationMin} min · {visit.therapistName}</span>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 px-4 py-3">
        <ClinicalNotes html={visit.notes} />
      </div>

      {(visit.interventions ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(visit.interventions ?? []).map((it, i) => (
            <Badge key={i} variant="outline" className="text-[11px]">{it}</Badge>
          ))}
        </div>
      )}

      {(visit.tasks ?? []).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Tareas asignadas</p>
          {visit.tasks.map((task) => (
            <div key={task.id} className={`flex items-center gap-2 text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}>
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${task.completed ? "bg-green-100 border-green-400 text-green-600" : "border-muted-foreground/30"}`}>
                {task.completed && <span className="text-[10px]">✓</span>}
              </span>
              {task.text}
            </div>
          ))}
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

function VisitEditForm({
  visitId,
  patientId,
  visit,
  onCancel,
  onSaved,
}: {
  visitId: string;
  patientId: string;
  visit: NonNullable<ReturnType<typeof useVisit>["data"]>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const update = useUpdateVisit();
  const { data: professionals } = useProfessionals();
  const [interventionInput, setInterventionInput] = useState("");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof visitUpdateSchema>, any, z.output<typeof visitUpdateSchema>>({
    resolver: zodResolver(visitUpdateSchema),
    defaultValues: {
      therapistId: visit.therapistId,
      date: visit.date.slice(0, 10),
      time: visit.date.slice(11, 16),
      durationMin: visit.durationMin,
      title: visit.title ?? "",
      notes: visit.notes,
      interventions: visit.interventions,
    },
  });

  const interventions = watch("interventions");

  function addIntervention() {
    const t = interventionInput.trim();
    if (!t) return;
    setValue("interventions", [...(interventions ?? []), t]);
    setInterventionInput("");
  }
  function removeIntervention(idx: number) {
    setValue("interventions", (interventions ?? []).filter((_, i) => i !== idx));
  }

  async function onSubmit(values: VisitUpdateInput) {
    try {
      await update.mutateAsync({ id: visitId, data: values });
      toast({ title: "Seguimiento actualizado" });
      onSaved();
    } catch {
      toast({
        title: "Error",
        description: "No se ha podido actualizar el seguimiento.",
        variant: "destructive",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 min-w-0">
      <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1.2fr_1fr] gap-3">
        <div className="space-y-1.5 col-span-2 sm:col-span-1 min-w-0">
          <Label className="text-xs">Terapeuta <span className="text-destructive">*</span></Label>
          <Controller
            control={control}
            name="therapistId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Selecciona un terapeuta" /></SelectTrigger>
                <SelectContent>
                  {(professionals ?? []).filter((p) => p.isActive).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} · {p.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.therapistId && <p className="text-xs text-destructive">{errors.therapistId.message}</p>}
        </div>

        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs">Duración</Label>
          <Input type="number" min={15} max={240} step={15} className="px-2" {...register("durationMin")} />
          {errors.durationMin && <p className="text-xs text-destructive">{errors.durationMin.message}</p>}
        </div>

        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs">Fecha <span className="text-destructive">*</span></Label>
          <Input type="date" className="px-2" {...register("date")} />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>

        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs">Hora <span className="text-destructive">*</span></Label>
          <Input type="time" className="px-2" {...register("time")} />
          {errors.time && <p className="text-xs text-destructive">{errors.time.message}</p>}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Título del seguimiento <span className="text-destructive">*</span></Label>
        <Input placeholder="p. ej. Primera valoración, Revisión mensual…" {...register("title")} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Notas clínicas <span className="text-destructive">*</span></Label>
        <Controller control={control} name="notes"
          render={({ field }) => <RichTextarea rows={10} value={field.value ?? ""} onChange={field.onChange} placeholder="Notas clínicas..." />} />
        {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Intervenciones realizadas</Label>
        <div className="flex gap-2">
          <Input
            placeholder="p. ej. Ejercicios activos asistidos"
            value={interventionInput}
            onChange={(e) => setInterventionInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addIntervention();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addIntervention}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {(interventions ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(interventions ?? []).map((it, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {it}
                <button type="button" onClick={() => removeIntervention(i)} aria-label={`Quitar ${it}`}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <DialogFooter>
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
