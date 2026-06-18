"use client";

import { useEffect } from "react";
import { useCurrentSession } from "@/hooks/api";
import { useNav } from "@/store/nav";
import { Sidebar, SidebarToggle } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const VIEW_TITLES: Record<string, string> = {
  dashboard: "Inicio",
  today: "Ruta de hoy",
  patients: "Pacientes",
  "patient-detail": "Paciente",
  "new-visit": "Nueva visita",
  "new-patient": "Nuevo paciente",
  calendar: "Agenda",
  equipo: "Equipo",
  reports: "Informes",
  settings: "Ajustes",
  "admin-users": "Gestión de usuarios",
  facturacion: "Facturación",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, isLoading } = useCurrentSession();
  const { view, navigate, newVisitPatientId } = useNav();

  // Redirect non-admin users away from admin views client-side as a defense
  // in depth (server enforces it too via requireAdmin()).
  // The router refresh after login already handles initial routing.

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    // The page.tsx will render the login view; nothing to do here.
    return null;
  }

  const title = VIEW_TITLES[view] ?? "DomusGes";
  const showNewPatient = view === "patients";
  const showNewVisit = view === "patient-detail" || view === "today";

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
            {showNewVisit && (
              <Button
                size="sm"
                onClick={() => {
                  if (view === "patient-detail") {
                    // current selected patient
                    useNav.getState().setNewVisitPatient(useNav.getState().selectedPatientId);
                  }
                  navigate("new-visit");
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Nueva visita
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
