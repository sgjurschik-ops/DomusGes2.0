import { NextResponse } from "next/server";
import { getProfessional } from "@/lib/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/messages/[id] — mark as read
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const prof = await getProfessional();
  if (!prof) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const message = await prisma.message.findUnique({ where: { id } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (message.toId !== prof.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.message.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return NextResponse.json(updated);
}

// DELETE /api/messages/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const prof = await getProfessional();
  if (!prof) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const message = await prisma.message.findUnique({ where: { id } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only sender or recipient can delete
  if (message.fromId !== prof.id && message.toId !== prof.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.message.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
