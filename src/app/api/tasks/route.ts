import { NextResponse } from "next/server";
import { requireProfessional } from "@/lib/server";
import { db as prisma } from "@/lib/db";
import { z } from "zod/v4";

const taskCreateSchema = z.object({
  text: z.string().min(1, "El texto es obligatorio").max(280),
  tags: z.array(z.string().max(30)).max(5).default([]),
});

// GET /api/tasks — lista SOLO las tareas del profesional autenticado.
export async function GET() {
  const prof = await requireProfessional();

  const tasks = await prisma.task.findMany({
    where: { professionalId: prof.id },
    orderBy: [{ done: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

// POST /api/tasks — crea una tarea nueva, propiedad de quien la crea.
export async function POST(req: Request) {
  const prof = await requireProfessional();

  const body = await req.json();
  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      professionalId: prof.id,
      text: parsed.data.text,
      tags: parsed.data.tags,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
