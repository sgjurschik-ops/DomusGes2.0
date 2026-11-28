// Registro de auditoría: quién hizo qué, sobre qué ficha, cuándo y desde qué IP.
// Separado de server.ts para poder usarlo también desde auth.ts (inicio de
// sesión) sin crear una importación circular.

import { db } from "@/lib/db";
import { getClientIp } from "@/lib/request-ip";

export async function audit(
  professionalId: string | null,
  action: string,
  entityType: string,
  entityId: string | null = null,
  metadata: Record<string, unknown> = {},
  ipAddress: string | null = null,
) {
  try {
    await db.auditLog.create({
      data: {
        professionalId,
        action,
        entityType,
        entityId,
        metadata: JSON.stringify(metadata),
        ipAddress: ipAddress ?? (await getClientIp()),
      },
    });
  } catch (err) {
    console.error("[audit] failed to write log:", err);
  }
}
