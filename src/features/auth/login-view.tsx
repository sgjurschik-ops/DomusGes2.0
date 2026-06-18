"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, Eye, EyeOff, KeyRound } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/schemas";

export function LoginView() {
  const router = useRouter();
  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    setSubmitting(true);
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setSubmitting(false);
    if (res?.error) {
      setServerError("Email o contraseña incorrectos.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-primary/10 via-background to-accent/30">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Activity className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">DomusGes</h1>
            <p className="text-xs text-muted-foreground">Seguimiento de pacientes</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Iniciar sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ana@domusges.es"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                />
                {errors.email && (
                  <p id="email-error" className="text-xs text-destructive" role="alert">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    className="pr-10"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="text-xs text-destructive" role="alert">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {serverError && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Entrando…" : "Entrar"}
              </Button>
            </form>

            <div className="mt-6 rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                <KeyRound className="w-3.5 h-3.5" /> Acceso demo
              </div>
              <p><span className="font-mono">admin@domusges.es</span> · <span className="font-mono">admin2026</span></p>
              <p><span className="font-mono">ana@domusges.es</span> · <span className="font-mono">demo2026</span></p>
              <p className="mt-1 italic">(en producción estas credenciales se eliminan y cada usuario usa la suya.)</p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          ¿Has olvidado tu contraseña? Contacta con el administrador de tu centro.
        </p>
      </div>
    </div>
  );
}
