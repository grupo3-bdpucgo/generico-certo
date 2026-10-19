// Motores de busca vetorial sobre o Qdrant (papel: Backend 1).
//  denso_base  vetor denso do texto só com dados da CMED (linha de base)
//  denso       vetor denso do texto enriquecido
//  hibrido     denso enriquecido + esparso de trigramas, fundidos por RRF numa única chamada

import { embedConsulta } from "./embeddings";
import { vetorTrigramasConsulta } from "./lexical";
import { CAMPOS_EXIBIDOS, type MedicamentoResumo } from "./normalizacao";
import { EF_BUSCA, VETOR, consultarQdrant } from "./qdrant";

export type MotorVetorial = "denso_base" | "denso" | "hibrido";

export interface FiltrosBusca {
  apenasGenericos?: boolean;
  precoMaximo?: number;
  tarjas?: string[];
  /** Esconde apresentações de uso restrito a hospitais (padrão: true). */
  ocultarHospitalares?: boolean;
}

export interface ResultadoBusca {
  id: number;
  score: number;
  /** Cosseno entre a consulta e o vetor denso do item (só quando pedido). */
  similaridade?: number | null;
  medicamento: MedicamentoResumo;
}

export interface RespostaBusca {
  motor: MotorVetorial;
  resultados: ResultadoBusca[];
  tempoEmbeddingMs: number;
  /** Ponta a ponta, medido no cliente: inclui rede. */
  tempoBancoMs: number;
  /** Tempo de processamento informado pelo próprio Qdrant. */
  tempoServidorMs: number;
}

// Quantos candidatos cada ramo entrega para a fusão RRF.
const CANDIDATOS_FUSAO = 50;
// Folga além do corte, para que o desempate não dependa da ordem em que o Qdrant devolve empatados.
const FOLGA_DESEMPATE = 10;

/**
 * Ordem determinística: escore decrescente e, no empate, id crescente. A RRF produz empates
 * exatos (o 1º de cada ramo recebe o mesmo escore) e o Qdrant não garante a ordem entre eles;
 * sem isso, duas execuções iguais podiam trocar as posições 1 e 2. O critério é cego ao conteúdo.
 */
function ordenar<T extends { id: number; score: number }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => b.score - a.score || a.id - b.id);
}

export function filtroQdrant(f: FiltrosBusca = {}) {
  const must: object[] = [];
  if (f.apenasGenericos) must.push({ key: "generico", match: { value: true } });
  if (f.precoMaximo !== undefined) must.push({ key: "pmc", range: { lte: f.precoMaximo } });
  if (f.tarjas?.length) must.push({ key: "tarja", match: { any: f.tarjas } });
  if (f.ocultarHospitalares ?? true) must.push({ key: "restricao_hospitalar", match: { value: false } });
  return must.length ? { must } : undefined;
}

/** Cosseno entre a consulta e o vetor denso de cada id, numa chamada pequena (sem payload). */
async function similaridades(vetor: number[], using: string, ids: number[]): Promise<Map<number, number>> {
  if (!ids.length) return new Map();
  const { points } = await consultarQdrant({
    query: vetor,
    using,
    filter: { must: [{ has_id: ids }] },
    limit: ids.length,
    with_payload: false,
  });
  return new Map(points.map((p) => [Number(p.id), p.score]));
}

export async function buscarVetorial(
  consulta: string,
  motor: MotorVetorial,
  opcoes: { filtros?: FiltrosBusca; limite?: number; deslocamento?: number; comSimilaridade?: boolean } = {},
): Promise<RespostaBusca> {
  const limite = opcoes.limite ?? 10;
  const offset = opcoes.deslocamento ?? 0;
  const filter = filtroQdrant(opcoes.filtros);
  const params = { hnsw_ef: EF_BUSCA };
  const buscar = offset + limite + FOLGA_DESEMPATE;
  const usingDenso = motor === "denso_base" ? VETOR.base : VETOR.denso;

  const t0 = performance.now();
  const vetor = await embedConsulta(consulta);
  const tempoEmbeddingMs = performance.now() - t0;

  const corpo =
    motor === "hibrido"
      ? {
          prefetch: [
            { query: vetor, using: VETOR.denso, limit: CANDIDATOS_FUSAO, filter, params },
            { query: vetorTrigramasConsulta(consulta), using: VETOR.lexical, limit: CANDIDATOS_FUSAO, filter },
          ],
          query: { fusion: "rrf" },
          limit: buscar,
          with_payload: CAMPOS_EXIBIDOS,
        }
      : { query: vetor, using: usingDenso, filter, params, limit: buscar, with_payload: CAMPOS_EXIBIDOS };

  const t1 = performance.now();
  const { points, tempoServidorMs } = await consultarQdrant(corpo);
  const tempoBancoMs = performance.now() - t1;

  const resultados: ResultadoBusca[] = ordenar(
    points.map((p) => ({ id: Number(p.id), score: p.score, medicamento: p.payload as unknown as MedicamentoResumo })),
  ).slice(offset, offset + limite);

  if (opcoes.comSimilaridade) {
    const cos = motor === "hibrido" ? await similaridades(vetor, usingDenso, resultados.map((r) => r.id)) : null;
    for (const r of resultados) r.similaridade = cos ? (cos.get(r.id) ?? null) : r.score;
  }

  return { motor, tempoEmbeddingMs, tempoBancoMs, tempoServidorMs, resultados };
}
