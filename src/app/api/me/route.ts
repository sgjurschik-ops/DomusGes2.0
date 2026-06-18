// GET /api/me — returns current professional profile (or 401)
import { NextResponse } from "next/server";
import { getCurrentProfessional } from "@/lib/server";

export async function GET() {
  const prof = await getCurrentProfessional();
  if (!prof) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json(prof);
}
