"use client";

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useCreatePatient,
  useProfessionals,
  usePatient,
  useUpdatePatient,
} from "@/hooks/api";
import { useNav } from "@/store/nav";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import {
  patientCreateSchema,
  type PatientCreateInput,
  SPECIALTIES,
  PATIENT_STATUSES,
} from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { Avatar } from "@/components/domain";

type Props = {
  mode?: "create" | "edit";
};

export function NewPatientForm({ mode = "create" }: Props) {
  const isEdit = mode === "edit";

  const create = useCreatePatient();
  const update = useUpdatePatient();
  const { data: professionals } = useProfessionals();
  const { back, selectPatient, navigate, selectedPatientId } = useNav();
  const { data: patient, isLoading: isLoadingPatient } = usePatient(
    isEdit ? selectedPatientId : null,
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<PatientCreateInput>({
    resolver: zodResolver(patientCreateSchema) as Resolver<PatientCreateInput>,
    defaultValues: {
      firstName: "",
      lastName: "",
      birthDate: "",
      specialty: "T. Ocupacional",
      status: "Activo",
      phone: "",
      address: "",
      diagnosis: "",
      objective: "",
      startDate: new Date().toISOString().slice(0, 10),
      referentName: "",
      referentPhone: "",
      therapistIds: [],
    },
  });

  useEffect(() => {
    if (!isEdit || !patient) return;

    reset({
      firstName: patient.firstName ?? "",
      lastName: patient.lastName ?? "",
      birthDate: patient.birthDate?.slice(0, 10) ?? "",
      specialty: patient.specialty,
      status: patient.status,
      phone: patient.phone ?? "",
      address: patient.address ?? "",
      diagnosis: patient.diagnosis ?? "",
      objective: patient.objective ?? "",
      startDate: patient.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      referentName: patient.referentName ?? "",
      referentPhone: patient.referentPhone ?? "",
      therapistIds: patient.therapistIds ?? [],
    });
  }, [isEdit, patient, reset]);

  async function onSubmit(values: PatientCreateInput) {
    try {
      if (isEdit) {
        if (!selectedPatientId) return;

        const updated = await update.mutateAsync({
          id: selectedPatientId,
          data: values,
        });

        toast({ title: "Paciente actualizado", description: updated.fullName });
        selectPatient(updated.id);
        navigate("patient-detail");
        return;
      }

      const created = await create.mutateAsync(values);
      toast({ title: "Paciente creado", description: created.fullName });
      selectPatient(created.id);
      navigate("patient-detail");
    } catch (e: any) {
      toast({
        title: isEdit ? "Error al actualizar paciente" : "Error al crear paciente",
        description: e?.body?.error === "VALIDATION" ? "Revisa los campos." : "Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  }

  const firstName = watch("firstName");
  const lastName = watch("lastName");
  const isPending = create.isPending || update.isPending;

  if (isEdit && isLoadingPatient) {
    return <p className="text-sm text-muted-foreground">Cargando datos del paciente…</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button
        onClick={back}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3">
              <Avatar name={`${firstName} ${lastName}`} size={32} />
              {isEdit ? "Editar paciente" : "Datos personales"}
            </CardTitle>
            <CardDescription>
              {isEdit ? "Modifica los datos registrados del paciente." : "Información básica del paciente."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Field label="Nombre" error={errors.firstName?.message} required>
              <Input id="firstName" {...register("firstName")} />
            </Field>
            <Field label="Apellidos" error={errors.lastName?.message} required>
              <Input id="lastName" {...register("lastName")} />
            </Field>
            <Field label="Fecha de nacimiento" error={errors.birthDate?.message} required>
              <Input id="birthDate" type="date" {...register("birthDate")} />
            </Field>
            <Field label="Teléfono" error={errors.phone?.message}>
              <Input id="phone" placeholder="6XX XXX XXX" {...register("phone")} />
            </Field>
            <Field label="Dirección" error={errors.address?.message} className="sm:col-span-2">
              <Input id="address" placeholder="Calle, número, piso, ciudad" {...register("address")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información clínica</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Field label="Especialidad" error={errors.specialty?.message} required>
              <Controller
                control={control}
                name="specialty"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="specialty"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SPECIALTIES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Estado" error={errors.status?.message} required>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PATIENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Diagnóstico / motivo de derivación" error={errors.diagnosis?.message} className="sm:col-span-2">
              <Input id="diagnosis" placeholder="p. ej. Fractura de cadera derecha" {...register("diagnosis")} />
            </Field>
            <Field label="Objetivo terapéutico" error={errors.objective?.message} className="sm:col-span-2">
              <Textarea id="objective" rows={2} {...register("objective")} />
            </Field>
            <Field label="Fecha de inicio" error={errors.startDate?.message} required>
              <Input id="startDate" type="date" {...register("startDate")} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referente y terapeutas asignados</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Field label="Nombre del referente familiar" error={errors.referentName?.message}>
              <Input id="referentName" {...register("referentName")} />
            </Field>
            <Field label="Teléfono del referente" error={errors.referentPhone?.message}>
              <Input id="referentPhone" {...register("referentPhone")} />
            </Field>
            <div className="sm:col-span-2 space-y-2">
              <Label>Terapeutas asignados</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                {(professionals ?? []).filter((p) => p.isActive).map((p) => (
                  <Controller
                    key={p.id}
                    control={control}
                    name="therapistIds"
                    render={({ field }) => {
                      const checked = field.value?.includes(p.id);
                      return (
                        <label
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                            checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              if (v) field.onChange([...(field.value ?? []), p.id]);
                              else field.onChange((field.value ?? []).filter((id: string) => id !== p.id));
                            }}
                          />
                          <Avatar name={p.name} color={p.color} size={28} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.role}</p>
                          </div>
                        </label>
                      );
                    }}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={back}>Cancelar</Button>
          <Button type="submit" disabled={isPending}>
            <Save className="w-4 h-4 mr-1.5" />
            {isPending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear paciente"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  required,
  className,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}