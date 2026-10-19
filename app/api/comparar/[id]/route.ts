// GET /api/comparar/2188  (papel: Backend 2)
// Equivalentes da mesma caixa e de qualquer caixa, com a economia em relação ao medicamento escolhido.

import { NextResponse } from "next/server";
import { compararEquivalentes } from "@/lib/comparacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ erro: "id inválido" }, { status: 400 });
  try {
    const c = await compararEquivalentes(id);
    if (!c) return NextResponse.json({ erro: "Medicamento não encontrado" }, { status: 404 });
    return NextResponse.json(c);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Falha ao consultar o Qdrant." }, { status: 502 });
  }
}
