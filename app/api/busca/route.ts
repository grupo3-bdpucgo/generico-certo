// GET /api/busca?q=...&generico=1&precoMax=30&tarja=Tarja%20Vermelha&pagina=1  (papel: Backend 1)
// Busca semântica híbrida com filtros e paginação.

import { NextResponse } from "next/server";
import { MAX_RESULTADOS_HIBRIDO, buscarVetorial, type MotorVetorial } from "@/lib/busca";
import { POR_PAGINA, lerDeUrl, lerParametros } from "@/lib/parametros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOTORES: MotorVetorial[] = ["hibrido", "denso", "denso_base"];

export async function GET(req: Request) {
  const inicio = performance.now();
  const url = new URL(req.url);
  const busca = lerParametros(lerDeUrl(url));
  if (!busca.q) return NextResponse.json({ erro: "Informe o parâmetro q." }, { status: 400 });
  const motor = (url.searchParams.get("motor") ?? "hibrido") as MotorVetorial;
  if (!MOTORES.includes(motor)) return NextResponse.json({ erro: `motor deve ser um de: ${MOTORES.join(", ")}` }, { status: 400 });

  try {
    // Lista inteira (até 100 itens: o híbrido funde 50 + 50 candidatos, sem corte por similaridade)
    // numa chamada só, para informar o total e o número de páginas.
    const r = await buscarVetorial(busca.q, motor, {
      filtros: busca.filtros,
      limite: MAX_RESULTADOS_HIBRIDO,
      comSimilaridade: true,
      reordenar: url.searchParams.get("reordenar") !== "0",
    });
    const total = r.resultados.length;
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    const pagina = Math.min(busca.pagina, totalPaginas);
    return NextResponse.json({
      consulta: busca.q,
      motor,
      filtros: busca.filtros,
      pagina,
      porPagina: POR_PAGINA,
      total,
      totalPaginas,
      temMais: pagina < totalPaginas,
      tempos: { embeddingMs: r.tempoEmbeddingMs, bancoMs: r.tempoBancoMs, servidorMs: r.tempoServidorMs },
      resultados: r.resultados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
    }, {
      // Tempo total do handler, para separar o custo da aplicação do custo da plataforma e da rede.
      headers: {
        "Server-Timing": `embedding;dur=${r.tempoEmbeddingMs.toFixed(1)}, qdrant;dur=${r.tempoBancoMs.toFixed(1)}, handler;dur=${(performance.now() - inicio).toFixed(1)}`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Falha ao consultar o Qdrant." }, { status: 502 });
  }
}
