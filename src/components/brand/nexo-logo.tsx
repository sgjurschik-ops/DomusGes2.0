// Marca de la app: nombre e icono (neurona en estrella sobre fondo cobre).
// Único sitio donde viven: si algún día se cambian, se cambian aquí.

import { cn } from "@/lib/utils";

export const APP_NAME = "Nexo";
export const APP_TAGLINE = "Gestión clínica";
export const NEXO_COPPER = "#a5552a";

const MAIN_BRANCHES = "M12 12L12 6.4M12 12L17.33 10.27M12 12L15.29 16.53M12 12L8.71 16.53M12 12L6.67 10.27";
const SUB_BRANCHES = "M12 6.4L10.4 3.4M12 6.4L13.6 3.4M17.33 10.27L19.69 7.82M17.33 10.27L20.68 10.86M15.29 16.53L18.35 18.02M15.29 16.53L15.76 19.9M8.71 16.53L8.24 19.9M8.71 16.53L5.65 18.02M6.67 10.27L3.32 10.86M6.67 10.27L4.31 7.82";

// Solo el dibujo de la neurona, en el color del texto (currentColor).
export function NexoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" className={className} aria-hidden>
      <path d={MAIN_BRANCHES} strokeWidth={1.8} />
      <path d={SUB_BRANCHES} strokeWidth={1.4} />
      <circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Icono completo: neurona blanca sobre cuadrado cobre con esquinas redondeadas.
export function NexoLogo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0 text-white", className)}
      style={{ width: size, height: size, backgroundColor: NEXO_COPPER, borderRadius: Math.round(size * 0.24) }}
      aria-hidden
    >
      <NexoMark className="w-[62%] h-[62%]" />
    </span>
  );
}
