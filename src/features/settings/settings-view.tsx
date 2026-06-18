"use client";

// Settings: personal profile (name/phone/color), centre info (admin, localStorage),
// and account actions (sign out, delete).

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signOut } from "next-auth/react";
import {
  useCurrentSession,
  useProfessionals,
  useUpdateProfessional,
  ApiError,
} from "@/hooks/api";
import { toast } from "@/hooks/use-toast";
import { Avatar, formatDate } from "@/components/domain";
import {
  professionalUpdateSchema,
  type ProfessionalUpdateInput,
  PROFESSIONAL_COLORS,
} from "@/lib/schemas";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Save,
  LogOut,
  UserX,
  Mail,
  Phone,
  ShieldCheck,
  Building2,
} from "lucide-react";

const CENTRE_STORAGE_KEY = "domusges.settings.centre";

interface CentreSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
}

const DEFAULT_CENTRE: CentreSettings = {
  name: "",
  address: "",
  phone: "",
  email: "",
};

export function SettingsView() {
  const { user } = useCurrentSession();
  const [tab, setTab] = useState<string>("profile");

  if (!user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestiona tu perfil y la configuración del centro.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="profile">Mi perfil</TabsTrigger>
          <TabsTrigger value="centre" disabled={!user.isAdmin}>
            Centro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-6">
          <ProfileTab userId={user.id} />
          <AccountSection />
        </TabsContent>

        <TabsContent value="centre" className="mt-4 space-y-6">
          {user.isAdmin ? (
            <CentreTab />
          ) : (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Solo los administradores pueden editar la configuración del centro.
            </Card>
          )}
          <AccountSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Profile tab ─────────────────────────────────────────────────────────────

const profileSchema = professionalUpdateSchema.pick({ name: true, phone: true, color: true });
type ProfileForm = z.output<typeof profileSchema>;

function ProfileTab({ userId }: { userId: string }) {
  const { data: professionals, isLoading } = useProfessionals();
  const update = useUpdateProfessional();
  const me = professionals?.find((p) => p.id === userId);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<z.input<typeof profileSchema>, any, ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: me?.name ?? "",
      phone: me?.phone ?? "",
      color: me?.color ?? PROFESSIONAL_COLORS[0],
    },
    values: me
      ? {
          name: me.name,
          phone: me.phone ?? "",
          color: me.color,
        }
      : undefined,
  });

  async function onSubmit(values: ProfileForm) {
    if (!me) return;
    try {
      await update.mutateAsync({
        id: me.id,
        data: {
          name: values.name,
          email: me.email,
          role: me.role as ProfessionalUpdateInput["role"],
          numColegiado: me.numColegiado ?? "",
          phone: values.phone,
          color: values.color,
          isActive: me.isActive,
          isAdmin: me.isAdmin,
        },
      });
      toast({ title: "Perfil actualizado" });
      reset(values);
    } catch (e) {
      toast({
        title: "Error al guardar",
        description: errorMessage(e),
        variant: "destructive",
      });
    }
  }

  if (isLoading || !me) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mi perfil</CardTitle>
        <CardDescription className="text-xs">
          Actualiza tus datos de contacto. El email y el rol los gestiona el administrador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Identity summary */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40">
          <Avatar name={me.name} color={me.color} size={56} />
          <div className="min-w-0">
            <p className="text-base font-semibold truncate">{me.name}</p>
            <p className="text-sm text-muted-foreground truncate">{me.email}</p>
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              <Badge variant="secondary" className="text-xs">
                {me.role}
              </Badge>
              {me.isAdmin && (
                <Badge className="text-xs gap-0.5">
                  <ShieldCheck className="w-3 h-3" /> Admin
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Miembro desde {formatDate(me.joinedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Editable form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-xs">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input id="profile-name" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone" className="text-xs">
                Teléfono
              </Label>
              <Input id="profile-phone" placeholder="6XX XXX XXX" {...register("phone")} />
              {errors.phone && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>

          {/* Read-only fields */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-email" className="text-xs">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="profile-email"
                  value={me.email}
                  readOnly
                  disabled
                  className="pl-9 bg-muted/50"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Solicita el cambio al administrador.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-role" className="text-xs">
                Rol
              </Label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="profile-role"
                  value={me.role}
                  readOnly
                  disabled
                  className="pl-9 bg-muted/50"
                />
              </div>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label className="text-xs">Color identificativo</Label>
            <Controller
              control={control}
              name="color"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color identificativo">
                  {PROFESSIONAL_COLORS.map((c) => {
                    const selected = field.value === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => field.onChange(c)}
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
              )}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={update.isPending || !isDirty}>
              <Save className="w-4 h-4 mr-1.5" />
              {update.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Centre tab (admin, localStorage) ────────────────────────────────────────

function readCentre(): CentreSettings {
  if (typeof window === "undefined") return DEFAULT_CENTRE;
  try {
    const raw = window.localStorage.getItem(CENTRE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CentreSettings>;
      return { ...DEFAULT_CENTRE, ...parsed };
    }
  } catch {
    // ignore malformed entries
  }
  return DEFAULT_CENTRE;
}

function CentreTab() {
  // Lazy initializer: CentreTab only mounts after the user (admin) clicks the
  // "Centro" tab, so this runs client-side only — no hydration mismatch.
  const [centre, setCentre] = useState<CentreSettings>(readCentre);

  function update<K extends keyof CentreSettings>(key: K, value: CentreSettings[K]) {
    setCentre((prev) => ({ ...prev, [key]: value }));
  }

  function onSave() {
    try {
      localStorage.setItem(CENTRE_STORAGE_KEY, JSON.stringify(centre));
      toast({ title: "Ajustes guardados" });
    } catch {
      toast({
        title: "No se pudo guardar",
        description: "El navegador no permite almacenar ajustes.",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Datos del centro
        </CardTitle>
        <CardDescription className="text-xs">
          Información de contacto del centro. Se guarda localmente en este dispositivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="centre-name" className="text-xs">
              Nombre del centro
            </Label>
            <Input
              id="centre-name"
              value={centre.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="p. ej. Centro de Rehabilitación Domus"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="centre-address" className="text-xs">
              Dirección
            </Label>
            <Input
              id="centre-address"
              value={centre.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Calle, número, piso, ciudad"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="centre-phone" className="text-xs">
              Teléfono
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="centre-phone"
                value={centre.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="9XX XXX XXX"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="centre-email" className="text-xs">
              Email de contacto
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="centre-email"
                type="email"
                value={centre.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="info@centro.es"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave}>
            <Save className="w-4 h-4 mr-1.5" /> Guardar ajustes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Account section ─────────────────────────────────────────────────────────

function AccountSection() {
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOutEverywhere() {
    setSigningOut(true);
    try {
      // Placeholder: real "all devices" revocation requires a server-side
      // token bump. For now this just ends the local session.
      await signOut({ redirect: false });
      toast({ title: "Sesión cerrada" });
    } catch {
      toast({
        title: "No se pudo cerrar la sesión",
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cuenta</CardTitle>
        <CardDescription className="text-xs">
          Acciones relacionadas con tu acceso a DomusGes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap p-3 rounded-lg border">
          <div>
            <p className="text-sm font-medium">Cerrar sesión en todos los dispositivos</p>
            <p className="text-xs text-muted-foreground">
              Finaliza tu sesión activa en este navegador.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={onSignOutEverywhere}
            disabled={signingOut}
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            {signingOut ? "Cerrando…" : "Cerrar sesión"}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap p-3 rounded-lg border">
          <div>
            <p className="text-sm font-medium">Eliminar mi cuenta</p>
            <p className="text-xs text-muted-foreground">
              La eliminación de cuentas la gestiona el administrador del centro.
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} aria-label="Eliminar cuenta deshabilitado">
                <Button variant="destructive" disabled className="pointer-events-none">
                  <UserX className="w-4 h-4 mr-1.5" /> Eliminar cuenta
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Contacta con el administrador</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Error helper ────────────────────────────────────────────────────────────

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: string; message?: string } | null;
    if (body?.error === "VALIDATION") return "Revisa los campos del formulario.";
    if (e.status === 403) return "No tienes permisos para esta acción.";
    return body?.message ?? body?.error ?? "Inténtalo de nuevo.";
  }
  return "Inténtalo de nuevo.";
}
