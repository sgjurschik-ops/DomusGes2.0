// Client-side navigation store.
// The app lives at a single / route (sandbox constraint), so view switching
// happens via Zustand. URL hash is mirrored so back/forward and refresh
// preserve the current view.

"use client";

import { create } from "zustand";
import type { View } from "@/types/domain";

interface NavState {
  view: View;
  selectedPatientId: string | null;
  newVisitPatientId: string | null;
  sidebarOpen: boolean;
  calendarSelectedDate: string | null; // ISO yyyy-mm-dd for calendar/today
  // Actions
  navigate: (view: View) => void;
  selectPatient: (patientId: string | null) => void;
  setNewVisitPatient: (patientId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setCalendarSelectedDate: (date: string | null) => void;
  back: () => void;
}

const VALID_VIEWS: View[] = [
  "dashboard", "patients", "patient-detail", "new-visit", "new-patient",
  "equipo", "calendar", "reports", "settings", "today", "admin-users", "facturacion",
];

// Read initial view from URL hash (e.g. #patients/p1)
function readHashState(): { view: View; selectedPatientId: string | null } {
  if (typeof window === "undefined") return { view: "dashboard", selectedPatientId: null };
  const h = window.location.hash.replace(/^#\/?/, "");
  const [view, id] = h.split("/");
  const v = (VALID_VIEWS as string[]).includes(view) ? (view as View) : "dashboard";
  return { view: v, selectedPatientId: id ?? null };
}

function writeHashState(view: View, patientId: string | null) {
  if (typeof window === "undefined") return;
  const hash = patientId ? `#/${view}/${patientId}` : `#/${view}`;
  if (window.location.hash !== hash) {
    window.history.pushState(null, "", hash);
  }
}

const initial = readHashState();

export const useNav = create<NavState>((set, get) => ({
  view: initial.view,
  selectedPatientId: initial.selectedPatientId,
  newVisitPatientId: null,
  sidebarOpen: false,
  calendarSelectedDate: null,
  navigate: (view) => {
    writeHashState(view, view === "patient-detail" ? get().selectedPatientId : null);
    set({ view, sidebarOpen: false });
  },
  selectPatient: (patientId) => {
    set({ selectedPatientId: patientId });
    if (patientId) writeHashState("patient-detail", patientId);
  },
  setNewVisitPatient: (patientId) => set({ newVisitPatientId: patientId }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setCalendarSelectedDate: (date) => set({ calendarSelectedDate: date }),
  back: () => {
    const v = get().view;
    if (v === "new-visit" && get().selectedPatientId) set({ view: "patient-detail" });
    else if (v === "new-patient" || v === "patient-detail" || v === "new-visit") {
      set({ view: "patients" });
      writeHashState("patients", null);
    } else {
      set({ view: "dashboard" });
      writeHashState("dashboard", null);
    }
  },
}));

// Subscribe to hash changes (back/forward buttons)
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    const next = readHashState();
    useNav.setState({
      view: next.view,
      selectedPatientId: next.selectedPatientId,
    });
  });
}
