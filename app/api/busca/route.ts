// GET /api/busca?q=...&generico=1&precoMax=30&tarja=Tarja%20Vermelha&pagina=1  (papel: Backend 1)
// Busca semântica híbrida com filtros e paginação.

import { NextResponse } from "next/server";
import { buscarVetorial, type MotorVetorial } from "@/lib/busca";
import { POR_PAGINA, lerDeUrl, lerParametros } from "@/lib/parametros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOTORES: MotorVetorial[] = ["hibrido", "denso", "denso_base"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const busca = lerParametros(lerDeUrl(url));
  if (!busca.q) return NextResponse.json({ erro: "Informe o parâmetro q." }, { status: 400 });
  const motor = (url.searchParams.get("motor") ?? "hibrido") as MotorVetorial;
  if (!MOTORES.includes(motor)) return NextResponse.json({ erro: `motor deve ser um de: ${MOTORES.join(", ")}` }, { status: 400 });

  try {
    const r = await buscarVetorial(busca.q, motor, {
      filtros: busca.filtros,
      limite: POR_PAGINA + 1,
      deslocamento: (busca.pagina - 1) * POR_PAGINA,
      comSimilaridade: true,
    });
    return NextResponse.json({
      consulta: busca.q,
      motor,
      filtros: busca.filtros,
      pagina: busca.pagina,
      porPagina: POR_PAGINA,
      temMais: r.resultados.length > POR_PAGINA,
      tempos: { embeddingMs: r.tempoEmbeddingMs, bancoMs: r.tempoBancoMs, servidorMs: r.tempoServidorMs },
      resultados: r.resultados.slice(0, POR_PAGINA),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Falha ao consultar o Qdrant." }, { status: 502 });
  }
}
