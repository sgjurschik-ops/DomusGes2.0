// /api/audit — admin only
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/server";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

  const rows = await db.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { professional: { select: { name: true } } },
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      professionalId: r.professionalId,
      professionalName: r.professional?.name ?? null,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    })),
  );
  void admin;
}
