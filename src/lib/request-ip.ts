// IP del cliente que hace la petición, para el registro de auditoría.
// En Vercel llega en la cabecera x-forwarded-for (la primera IP es la del
// usuario). Fuera de una petición (scripts, tareas) devuelve null.

import { headers } from "next/headers";

export async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() || null;
    return h.get("x-real-ip");
  } catch {
    return null;
  }
}
