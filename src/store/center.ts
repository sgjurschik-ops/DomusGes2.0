// Client-side "centro activo" (recurso) store.
//
// Lets a professional scope the whole app to one center at a time
// (Domicilio / Asociación EM / …) instead of seeing every patient mixed
// together, while still being able to switch centers from within the app.
// Persisted in localStorage per device — same idea as the sidebar-collapsed
// preference in store/nav.ts.

"use client";

import { create } from "zustand";
import { RESOURCE_KEYS } from "@/lib/schemas";

const ACTIVE_RESOURCE_KEY = "domusges:activeResource";

function readActiveResource(): string | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(ACTIVE_RESOURCE_KEY);
  return saved && (RESOURCE_KEYS as readonly string[]).includes(saved) ? saved : null;
}

function writeActiveResource(resource: string | null) {
  if (typeof window === "undefined") return;
  if (resource) {
    window.localStorage.setItem(ACTIVE_RESOURCE_KEY, resource);
  } else {
    window.localStorage.removeItem(ACTIVE_RESOURCE_KEY);
  }
}

interface CenterState {
  /** null = no se ha elegido centro todavía (se pedirá al entrar). */
  activeResource: string | null;
  setActiveResource: (resource: string) => void;
  /** Vuelve a preguntar qué centro usar (p. ej. desde un botón "Cambiar de centro"). */
  clearActiveResource: () => void;
}

export const useCenter = create<CenterState>((set) => ({
  activeResource: readActiveResource(),
  setActiveResource: (resource) => {
    writeActiveResource(resource);
    set({ activeResource: resource });
  },
  clearActiveResource: () => {
    writeActiveResource(null);
    set({ activeResource: null });
  },
}));
