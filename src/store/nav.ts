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
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  calendarSelectedDate: string | null; // ISO yyyy-mm-dd for calendar/today
  // Actions
  navigate: (view: View) => void;
  selectPatient: (patientId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCalendarSelectedDate: (date: string | null) => void;
  back: () => void;
}

const VALID_VIEWS: View[] = [
  "dashboard", "patients", "patient-detail", "new-patient", "edit-patient",
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

// Reads the saved sidebar collapsed preference so it persists across page
// reloads and sessions, not just while navigating within one visit.
const SIDEBAR_COLLAPSED_KEY = "domusges:sidebarCollapsed";
function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}
function writeSidebarCollapsed(collapsed: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
}

const initial = readHashState();

export const useNav = create<NavState>((set, get) => ({
  view: initial.view,
  selectedPatientId: initial.selectedPatientId,
  sidebarOpen: false,
  sidebarCollapsed: readSidebarCollapsed(),
  calendarSelectedDate: null,
  navigate: (view) => {
    writeHashState(view, view === "patient-detail" ? get().selectedPatientId : null);
    set({ view, sidebarOpen: false });
  },
  selectPatient: (patientId) => {
    set({ selectedPatientId: patientId });
    if (patientId) writeHashState("patient-detail", patientId);
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => {
    writeSidebarCollapsed(collapsed);
    set({ sidebarCollapsed: collapsed });
  },
  setCalendarSelectedDate: (date) => set({ calendarSelectedDate: date }),
  back: () => {
    const v = get().view;
    if (v === "new-patient" || v === "edit-patient" || v === "patient-detail") {
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
