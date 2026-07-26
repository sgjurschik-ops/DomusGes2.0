import { NextResponse } from "next/server";
import { getProfessional } from "@/lib/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

const messageCreateSchema = z.object({
  toId: z.string().min(1),
  subject: z.string().min(1, "El asunto es obligatorio").max(120),
  body: z.string().min(1, "El mensaje no puede estar vacío"),
});

// GET /api/messages?box=inbox|sent
export async function GET(req: Request) {
  const prof = await getProfessional();
  if (!prof) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const box = searchParams.get("box") ?? "inbox";

  const messages = await prisma.message.findMany({
    where: box === "sent" ? { fromId: prof.id } : { toId: prof.id },
    include: {
      from: { select: { id: true, name: true, color: true } },
      to:   { select: { id: true, name: true, color: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(messages);
}

// POST /api/messages — send a new message
export async function POST(req: Request) {
  const prof = await getProfessional();
  if (!prof) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = messageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  const { toId, subject, body: msgBody } = parsed.data;

  // Verify recipient exists
  const recipient = await prisma.professional.findUnique({ where: { id: toId } });
  if (!recipient) return NextResponse.json({ error: "Destinatario no encontrado" }, { status: 404 });

  const message = await prisma.message.create({
    data: { fromId: prof.id, toId, subject, body: msgBody },
    include: {
      from: { select: { id: true, name: true, color: true } },
      to:   { select: { id: true, name: true, color: true } },
    },
  });

  return NextResponse.json(message, { status: 201 });
}
