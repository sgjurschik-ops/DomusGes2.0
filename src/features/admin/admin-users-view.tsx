"use client";

// Admin: manage professionals (CRUD + reset password) and audit log.
// Rendered only when the parent has already verified user.isAdmin === true,
// but we still gate defensively here in case of stale session.

import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCurrentSession,
  useProfessionals,
  useCreateProfessional,
  useUpdateProfessional,
  useResetProfessionalPassword,
  useDeleteProfessional,
  useAuditLog,
  ApiError,
} from "@/hooks/api";
import { toast } from "@/hooks/use-toast";
import { Avatar, formatDateTime } from "@/components/domain";
import {
  professionalCreateSchema,
  type ProfessionalCreateInput,
  professionalUpdateSchema,
  type ProfessionalUpdateInput,
  PROFESSIONAL_ROLES,
  PROFESSIONAL_COLORS,
} from "@/lib/schemas";
import type { ProfessionalDTO } from "@/types/domain";
import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  KeyRound,
  Trash2,
  Eye,
  EyeOff,
  ShieldAlert,
  ShieldCheck,
  History,
} from "lucide-react";

type ModalState =
  | { kind: "create" }
  | { kind: "edit"; prof: ProfessionalDTO }
  | { kind: "reset"; prof: ProfessionalDTO }
  | { kind: "delete"; prof: ProfessionalDTO }
  | null;

export function AdminUsersView() {
  const { user } = useCurrentSession();
  const { data: professionals, isLoading } = useProfessionals();

  const [modal, setModal] = useState<ModalState>(null);

  // Defense-in-depth: the parent already gates on isAdmin, but the session
  // might be stale; show a friendly message instead of leaking admin UI.
  if (user && !user.isAdmin) {
    return (
      <Card className="p-10 text-center max-w-md mx-auto">
        <ShieldAlert className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-base font-semibold">Acceso restringido</p>
        <p className="text-sm text-muted-foreground mt-1">
          Solo los administradores pueden gestionar usuarios.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de usuarios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Crea, edita y desactiva profesionales del centro.
          </p>
        </div>
        <Button onClick={() => setModal({ kind: "create" })}>
          <Plus className="w-4 h-4 mr-1.5" /> Crear usuario
        </Button>
      </header>

      {/* Professionals table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profesionales</CardTitle>
          <CardDescription className="text-xs">
            {professionals?.length ?? 0} usuarios en total
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !professionals || professionals.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No hay usuarios todavía. Crea el primero con el botón superior.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profesional</TableHead>
                    <TableHead className="hidden md:table-cell">Rol</TableHead>
                    <TableHead className="hidden lg:table-cell">N.º colegiado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {professionals.map((prof) => (
                    <TableRow key={prof.id}>
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <Avatar name={prof.name} color={prof.color} size={36} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium truncate">{prof.name}</p>
                              {(prof.userRole === "admin" || prof.isAdmin) && (
                                <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                                  🛡️ Admin
                                </Badge>
                              )}
                              {prof.userRole === "guest" && (
                                <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 py-0 text-muted-foreground">
                                  👤 Invitado
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {prof.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {prof.role}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {prof.numColegiado || "—"}
                      </TableCell>
                      <TableCell>
                        <ActiveToggle prof={prof} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label={`Editar ${prof.name}`}
                            onClick={() => setModal({ kind: "edit", prof })}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            aria-label={`Restablecer contraseña de ${prof.name}`}
                            onClick={() => setModal({ kind: "reset", prof })}
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:hover:bg-transparent"
                            aria-label={
                              user?.id === prof.id
                                ? "No puedes eliminar tu propia cuenta"
                                : `Eliminar ${prof.name}`
                            }
                            disabled={user?.id === prof.id}
                            title={
                              user?.id === prof.id
                                ? "No puedes eliminar tu propia cuenta"
                                : undefined
                            }
                            onClick={() => setModal({ kind: "delete", prof })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit log */}
      <AuditLogCard />

      {/* Modals */}
      {modal?.kind === "create" && (
        <CreateUserDialog onClose={() => setModal(null)} />
      )}
      {modal?.kind === "edit" && (
        <EditUserDialog prof={modal.prof} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "reset" && (
        <ResetPasswordDialog prof={modal.prof} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "delete" && (
        <DeleteUserDialog
          prof={modal.prof}
          isSelf={user?.id === modal.prof.id}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── Active toggle ───────────────────────────────────────────────────────────

function ActiveToggle({ prof }: { prof: ProfessionalDTO }) {
  const update = useUpdateProfessional();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const value = optimistic ?? prof.isActive;

  async function toggle(next: boolean) {
    setOptimistic(next);
    try {
      await update.mutateAsync({
        id: prof.id,
        data: {
          name: prof.name,
          email: prof.email,
          role: prof.role as ProfessionalUpdateInput["role"],
          numColegiado: prof.numColegiado ?? "",
          phone: prof.phone ?? "",
          color: prof.color,
          isActive: next,
          isAdmin: prof.isAdmin,
          userRole: (prof.userRole ?? (prof.isAdmin ? "admin" : "therapist")) as ProfessionalUpdateInput["userRole"],
        },
      });
      toast({
        title: next ? "Usuario activado" : "Usuario desactivado",
        description: prof.name,
      });
    } catch (e) {
      toast({
        title: "No se pudo actualizar",
        description: errorMessage(e),
        variant: "destructive",
      });
    } finally {
      setOptimistic(null);
    }
  }

  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <Switch
        checked={value}
        onCheckedChange={toggle}
        disabled={update.isPending || optimistic !== null}
        aria-label={`Activar/desactivar ${prof.name}`}
      />
      <span className={cn("text-xs", value ? "text-emerald-700" : "text-muted-foreground")}>
        {value ? "Activo" : "Inactivo"}
      </span>
    </label>
  );
}

// ─── Audit log card ──────────────────────────────────────────────────────────

function AuditLogCard() {
  const { data, isLoading } = useAuditLog(50);
  const rows = (data ?? []).slice(0, 20);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4" /> Registro de actividad
        </CardTitle>
        <CardDescription className="text-xs">
          Últimas 20 acciones registradas en el sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Aún no hay actividad registrada.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead className="hidden sm:table-cell">Entidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.professionalName ?? "Sistema"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {log.entityType}
                      {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Color picker ────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (c: string) => void;
}) {
  const current = value ?? "";
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color identificativo">
      {PROFESSIONAL_COLORS.map((c) => {
        const selected = current === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            role="radio"
            aria-checked={selected}
            aria-label={`Color ${c}`}
            className={cn(
              "w-8 h-8 rounded-full border-2 transition-all",
              selected
                ? "border-foreground ring-2 ring-offset-2 ring-foreground/30 scale-110"
                : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: c }}
          />
        );
      })}
    </div>
  );
}

// ─── Field helper ────────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Password input with show/hide ───────────────────────────────────────────

function PasswordInput({
  id,
  autoComplete,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        className="pr-10"
        {...rest}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </Button>
    </div>
  );
}

// ─── Create user dialog ──────────────────────────────────────────────────────

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateProfessional();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof professionalCreateSchema>, any, ProfessionalCreateInput>({
    resolver: zodResolver(professionalCreateSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "Terapeuta Ocupacional",
      numColegiado: "",
      phone: "",
      color: PROFESSIONAL_COLORS[0],
      isAdmin: false,
      userRole: "therapist",
      password: "",
      confirmPassword: "",
    },
  });

  const selectedUserRole = useWatch({ control, name: "userRole" });
  const isGuest = selectedUserRole === "guest";

  async function onSubmit(values: ProfessionalCreateInput) {
    try {
      await create.mutateAsync(values);
      toast({ title: "Usuario creado", description: values.name });
      reset();
      onClose();
    } catch (e) {
      toast({
        title: "Error al crear usuario",
        description: errorMessage(e),
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>
            Registra un nuevo profesional en el centro.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nombre" htmlFor="name" error={errors.name?.message} required>
              <Input id="name" autoComplete="name" {...register("name")} />
            </Field>
            {!isGuest && (
              <Field label="Email" htmlFor="email" error={errors.email?.message} required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                />
              </Field>
            )}
            <Field label="Rol" htmlFor="role" error={errors.role?.message} required>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFESSIONAL_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="N.º colegiado" htmlFor="numColegiado" error={errors.numColegiado?.message}>
              <Input id="numColegiado" placeholder="12345" {...register("numColegiado")} />
            </Field>
            <Field label="Teléfono" htmlFor="phone" error={errors.phone?.message}>
              <Input id="phone" placeholder="6XX XXX XXX" {...register("phone")} />
            </Field>
            <Field label="Color identificativo">
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <ColorPicker value={field.value} onChange={field.onChange} />
                )}
              />
            </Field>
          </div>

          <Controller
            control={control}
            name="userRole"
            render={({ field }) => (
              <div className="space-y-2">
                <p className="text-sm font-medium">Nivel de acceso</p>
                <div className="grid gap-2">
                  {([
                    { value: "admin", label: "Administrador", icon: "🛡️", desc: "Gestiona usuarios, datos de contacto y facturación. Sin acceso a datos clínicos." },
                    { value: "therapist", label: "Terapeuta", icon: "🩺", desc: "Acceso clínico completo a sus pacientes. Puede ver (no editar) los de otros terapeutas." },
                    { value: "guest", label: "Invitado", icon: "👤", desc: "Solo ve y edita sus propios pacientes. Ideal para probar la aplicación." },
                  ] as const).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        field.value === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        className="mt-0.5"
                        checked={field.value === opt.value}
                        onChange={() => field.onChange(opt.value)}
                      />
                      <div>
                        <p className="text-sm font-medium">{opt.icon} {opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          />

          {isGuest ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              👤 El perfil invitado no necesita email ni contraseña. Se generarán automáticamente y podrán cambiarse después desde Ajustes.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Contraseña"
                htmlFor="password"
                error={errors.password?.message}
                required
              >
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  {...register("password")}
                />
              </Field>
              <Field
                label="Repetir contraseña"
                htmlFor="confirmPassword"
                error={errors.confirmPassword?.message}
                required
              >
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  {...register("confirmPassword")}
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creando…" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit user dialog ────────────────────────────────────────────────────────

function EditUserDialog({
  prof,
  onClose,
}: {
  prof: ProfessionalDTO;
  onClose: () => void;
}) {
  const update = useUpdateProfessional();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<z.input<typeof professionalUpdateSchema>, any, ProfessionalUpdateInput>({
    resolver: zodResolver(professionalUpdateSchema),
    defaultValues: {
      name: prof.name,
      email: prof.email,
      role: prof.role as ProfessionalUpdateInput["role"],
      numColegiado: prof.numColegiado ?? "",
      phone: prof.phone ?? "",
      color: prof.color,
      isActive: prof.isActive,
      isAdmin: prof.isAdmin,
      userRole: (prof.userRole ?? (prof.isAdmin ? "admin" : "therapist")) as ProfessionalUpdateInput["userRole"],
    },
  });

  async function onSubmit(values: ProfessionalUpdateInput) {
    try {
      await update.mutateAsync({ id: prof.id, data: values });
      toast({ title: "Usuario actualizado", description: values.name });
      onClose();
    } catch (e) {
      toast({
        title: "Error al actualizar",
        description: errorMessage(e),
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            Modifica los datos de <span className="font-medium">{prof.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nombre" htmlFor="edit-name" error={errors.name?.message} required>
              <Input id="edit-name" {...register("name")} />
            </Field>
            <Field label="Email" htmlFor="edit-email" error={errors.email?.message} required>
              <Input id="edit-email" type="email" {...register("email")} />
            </Field>
            <Field label="Rol" htmlFor="edit-role" error={errors.role?.message} required>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFESSIONAL_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label="N.º colegiado"
              htmlFor="edit-numColegiado"
              error={errors.numColegiado?.message}
            >
              <Input id="edit-numColegiado" {...register("numColegiado")} />
            </Field>
            <Field label="Teléfono" htmlFor="edit-phone" error={errors.phone?.message}>
              <Input id="edit-phone" {...register("phone")} />
            </Field>
            <Field label="Color identificativo">
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <ColorPicker value={field.value} onChange={field.onChange} />
                )}
              />
            </Field>
          </div>

          <Controller
            control={control}
            name="userRole"
            render={({ field }) => (
              <div className="space-y-2">
                <p className="text-sm font-medium">Nivel de acceso</p>
                <div className="grid gap-2">
                  {([
                    { value: "admin", label: "Administrador", icon: "🛡️", desc: "Gestiona usuarios, datos de contacto y facturación. Sin acceso a datos clínicos." },
                    { value: "therapist", label: "Terapeuta", icon: "🩺", desc: "Acceso clínico completo a sus pacientes. Puede ver (no editar) los de otros terapeutas." },
                    { value: "guest", label: "Invitado", icon: "👤", desc: "Solo ve y edita sus propios pacientes. Ideal para probar la aplicación." },
                  ] as const).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        field.value === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="radio"
                        className="mt-0.5"
                        checked={field.value === opt.value}
                        onChange={() => field.onChange(opt.value)}
                      />
                      <div>
                        <p className="text-sm font-medium">{opt.icon} {opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset password dialog ───────────────────────────────────────────────────

function ResetPasswordDialog({
  prof,
  onClose,
}: {
  prof: ProfessionalDTO;
  onClose: () => void;
}) {
  const reset = useResetProfessionalPassword();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);

  const mismatch = password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;
  const invalid = mismatch || tooShort;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (invalid || password.length === 0) return;
    try {
      await reset.mutateAsync({ id: prof.id, password });
      toast({ title: "Contraseña restablecida", description: prof.name });
      onClose();
    } catch (err) {
      toast({
        title: "Error al restablecer",
        description: errorMessage(err),
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            Define una nueva contraseña para <span className="font-medium">{prof.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nueva contraseña" htmlFor="new-password" required>
            <div className="relative">
              <Input
                id="new-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={show}
                onClick={() => setShow((s) => !s)}
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            {touched && tooShort && (
              <p className="text-xs text-destructive" role="alert">
                Mínimo 8 caracteres.
              </p>
            )}
          </Field>
          <Field
            label="Repetir contraseña"
            htmlFor="new-password-confirm"
            required
            error={
              touched && mismatch ? "Las contraseñas no coinciden." : undefined
            }
          >
            <Input
              id="new-password-confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={reset.isPending}>
              {reset.isPending ? "Guardando…" : "Restablecer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete user dialog (AlertDialog) ────────────────────────────────────────

function DeleteUserDialog({
  prof,
  isSelf,
  onClose,
}: {
  prof: ProfessionalDTO;
  isSelf: boolean;
  onClose: () => void;
}) {
  const del = useDeleteProfessional();

  async function onConfirm() {
    try {
      await del.mutateAsync(prof.id);
      toast({ title: "Usuario eliminado", description: prof.name });
      onClose();
    } catch (e) {
      toast({
        title: "Error al eliminar",
        description: errorMessage(e),
        variant: "destructive",
      });
    }
  }

  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a eliminar a <span className="font-medium text-foreground">{prof.name}</span> (
            {prof.email}). Esta acción no se puede deshacer.
            {isSelf && (
              <span className="block mt-2 text-destructive">
                No puedes eliminar tu propia cuenta.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={del.isPending || isSelf}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {del.isPending ? "Eliminando…" : "Eliminar definitivamente"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Error helper ────────────────────────────────────────────────────────────

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: string; message?: string } | null;
    if (body?.error === "VALIDATION") return "Revisa los campos del formulario.";
    if (e.status === 403) return "No tienes permisos para esta acción.";
    if (e.status === 409) return "Ya existe un usuario con ese email.";
    return body?.message ?? body?.error ?? "Inténtalo de nuevo.";
  }
  return "Inténtalo de nuevo.";
}


