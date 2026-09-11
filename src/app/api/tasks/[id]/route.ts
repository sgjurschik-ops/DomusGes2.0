import { NextResponse } from "next/server";
import { requireProfessional } from "@/lib/server";
import { db as prisma } from "@/lib/db";
import { z } from "zod/v4";

const taskUpdateSchema = z.object({
  text: z.string().min(1).max(280).optional(),
  tags: z.array(z.string().max(30)).max(5).optional(),
  done: z.boolean().optional(),
});

// PATCH /api/tasks/[id] — editar texto/etiquetas o marcar hecha/pendiente.
// Igual que las QuickNotes: SOLO quien la creó puede tocarla.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const prof = await requireProfessional();
  const { id } = await params;

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.professionalId !== prof.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = taskUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  const data: { text?: string; tags?: string[]; done?: boolean; completedAt?: Date | null } = {};
  if (parsed.data.text !== undefined) data.text = parsed.data.text;
  if (parsed.data.tags !== undefined) data.tags = parsed.data.tags;
  if (parsed.data.done !== undefined) {
    data.done = parsed.data.done;
    data.completedAt = parsed.data.done ? new Date() : null;
  }

  const task = await prisma.task.update({ where: { id }, data });
  return NextResponse.json(task);
}

// DELETE /api/tasks/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const prof = await requireProfessional();
  const { id } = await params;

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.professionalId !== prof.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
