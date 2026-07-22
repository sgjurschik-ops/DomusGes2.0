"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { signOut } from "next-auth/react";
import { useCurrentSession } from "@/hooks/api";
import { useNav } from "@/store/nav";
import { useCenter } from "@/store/center";
import { RESOURCES } from "@/lib/schemas";
import { Sidebar, SidebarToggle } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, Clock, Activity } from "lucide-react";

const VIEW_TITLES: Record<string, string> = {
  dashboard: "Inicio",
  today: "Ruta de hoy",
  patients: "Pacientes",
  "patient-detail": "Paciente",
  "new-patient": "Nuevo paciente",
  calendar: "Agenda",
  equipo: "Equipo",
  reports: "Informes",
  settings: "Ajustes",
  "admin-users": "Gestión de usuarios",
  facturacion: "Facturación",
};

// ─── Idle timeout ────────────────────────────────────────────────────────────
// Logs the user out after IDLE_TIMEOUT_MS of no activity.
// Shows a warning WARN_BEFORE_MS before the timeout.

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;  // 15 minutes
const WARN_BEFORE_MS = 60 * 1000;        // warn 1 minute before

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove", "mousedown", "keydown", "touchstart", "scroll", "click",
];

function useIdleTimeout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const resetTimers = useCallback(() => {
    setShowWarning(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current);

    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true);
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);

    timerRef.current = setTimeout(() => {
      signOut({ callbackUrl: "/" });
    }, IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    resetTimers();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimers, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimers);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    };
  }, [resetTimers]);

  return { showWarning, dismissWarning: resetTimers };
}

// ─── App shell ───────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, isLoading } = useCurrentSession();
  const { view, navigate } = useNav();
  const { showWarning, dismissWarning } = useIdleTimeout();
  const { activeResource, setActiveResource } = useCenter();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  // Right after logging in, ask which center to work in for this session
  // — everything (pacientes, agenda, inicio) is scoped to it from here on,
  // instead of mixing patients from different centers together. Can be
  // changed anytime from the sidebar without needing to log out.
  if (!activeResource) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center mx-auto">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">¿En qué centro vas a trabajar?</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Podrás cambiarlo en cualquier momento desde el menú lateral.
            </p>
          </div>
          <div className="space-y-2">
            {RESOURCES.map((r) => (
              <button
                key={r.key}
                onClick={() => setActiveResource(r.key)}
                className="w-full rounded-lg border px-4 py-3 text-sm font-medium text-left hover:border-primary hover:bg-primary/5 transition-colors"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const title = VIEW_TITLES[view] ?? "DomusGes";
  const showNewPatient = view === "patients";

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
          <div className="flex items-center gap-3 px-4 lg:px-6 py-3">
            <SidebarToggle />
            <h1 className="text-lg font-semibold text-foreground flex-1 truncate">{title}</h1>
            {showNewPatient && (
              <Button size="sm" onClick={() => navigate("new-patient")}>
                <Plus className="w-4 h-4 mr-1" /> Nuevo paciente
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>

      {/* Idle timeout warning */}
      {showWarning && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-background rounded-xl shadow-xl p-6 max-w-sm mx-4 text-center space-y-4">
            <Clock className="w-10 h-10 text-amber-500 mx-auto" />
            <div>
              <p className="font-semibold">Sesión a punto de expirar</p>
              <p className="text-sm text-muted-foreground mt-1">
                Por seguridad, tu sesión se cerrará en menos de un minuto por inactividad.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" size="sm" onClick={() => signOut({ redirect: false })}>
                Cerrar sesión
              </Button>
              <Button size="sm" onClick={dismissWarning}>
                Seguir trabajando
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
