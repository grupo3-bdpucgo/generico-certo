// GET /api/comparativo?q=...  (papel: Data Analyst)
// A mesma consulta nos cinco motores (três no Qdrant, dois no PostgreSQL), com tempos e, para as
// consultas do benchmark, a marcação de cada resultado pelo gabarito.

import { NextResponse } from "next/server";
import { compararMotores } from "@/lib/comparativo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 200);
  if (!q) return NextResponse.json({ erro: "Informe o parâmetro q." }, { status: 400 });
  return NextResponse.json({ consulta: q, ...(await compararMotores(q)) });
}
