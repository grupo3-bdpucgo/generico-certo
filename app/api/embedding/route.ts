// POST /api/embedding  { "texto": "..." }  ->  { "vetor": [384 números], "ms": ... }  (papel: Backend 1)
// Única função que carrega o modelo de embeddings. /buscar, /comparativo, /api/busca e
// /api/comparativo pedem o vetor da consulta aqui (lib/vetor-consulta.ts).

import { NextResponse } from "next/server";
import { embedConsulta } from "@/lib/embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { texto } = (await req.json().catch(() => ({}))) as { texto?: unknown };
  if (typeof texto !== "string" || !texto.trim() || texto.length > 500) {
    return NextResponse.json({ erro: "Informe texto (até 500 caracteres)." }, { status: 400 });
  }
  const inicio = performance.now();
  const vetor = await embedConsulta(texto);
  const ms = performance.now() - inicio;
  return NextResponse.json({ vetor, ms }, { headers: { "Server-Timing": `embedding;dur=${ms.toFixed(1)}` } });
}
