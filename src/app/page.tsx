"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useCurrentSession } from "@/hooks/api";
import { useNav } from "@/store/nav";
import { AppShell } from "@/components/layout/app-shell";
import { LoginView } from "@/features/auth/login-view";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { PatientsListView } from "@/features/patients/patients-list-view";
import { PatientDetailView } from "@/features/patients/patient-detail-view";
import { NewPatientForm } from "@/features/patients/new-patient-form";
import { NewVisitForm } from "@/features/visits/new-visit-form";
import { CalendarView } from "@/features/calendar/calendar-view";
import { TeamView } from "@/features/team/team-view";
import { BillingView } from "@/features/billing/billing-view";
import { ReportsView } from "@/features/reports/reports-view";
import { SettingsView } from "@/features/settings/settings-view";
import { AdminUsersView } from "@/features/admin/admin-users-view";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

// Leaflet touches `window` at import time — must load client-only.
const TodayView = dynamic(
  () => import("@/features/today/today-view").then((m) => m.TodayView),
  { ssr: false, loading: () => <div className="text-sm text-muted-foreground p-8">Cargando mapa…</div> },
);

export default function Home() {
  const { status, user, isLoading } = useCurrentSession();
  const { view } = useNav();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginView />;
  }

  // Authenticated — render the shell + current view
  return (
    <AppShell>
      {view === "dashboard" && <DashboardView />}
      {view === "today" && <TodayView />}
      {view === "patients" && <PatientsListView />}
      {view === "patient-detail" && <PatientDetailView />}
      {view === "new-patient" && <NewPatientForm />}
      {view === "edit-patient" && <NewPatientForm mode="edit" />}
      {view === "new-visit" && <NewVisitForm />}
      {view === "calendar" && <CalendarView />}
      {view === "equipo" && <TeamView />}
      {view === "facturacion" && <BillingView />}
      {view === "reports" && <ReportsView />}
      {view === "settings" && <SettingsView />}
      {view === "admin-users" &&
        (user?.isAdmin ? (
          <AdminUsersView />
        ) : (
          <AccessDenied />
        ))}
    </AppShell>
  );
}

function AccessDenied() {
  return (
    <div className="flex items-center justify-center py-16">
      <Card className="max-w-md">
        <CardContent className="p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="font-medium mb-1">Acceso restringido</p>
          <p className="text-sm text-muted-foreground">
            No tienes permisos para acceder a esta sección.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
