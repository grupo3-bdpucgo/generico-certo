// Motores de busca vetorial sobre o Qdrant (papel: Backend 1).
//  denso_base  vetor denso do texto só com dados da CMED (linha de base)
//  denso       vetor denso do texto enriquecido
//  hibrido     denso enriquecido + esparso de trigramas, fundidos por RRF numa única chamada

import { embedConsulta } from "./embeddings";
import { vetorTrigramasConsulta } from "./lexical";
import { COLLECTION, EF_BUSCA, VETOR, qdrant } from "./qdrant";
import type { Medicamento } from "./normalizacao";

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
  medicamento: Omit<Medicamento, "id">;
}

export interface RespostaBusca {
  motor: MotorVetorial;
  resultados: ResultadoBusca[];
  tempoEmbeddingMs: number;
  tempoBancoMs: number;
}

// Quantos candidatos cada ramo entrega para a fusão RRF.
const CANDIDATOS_FUSAO = 50;

export function filtroQdrant(f: FiltrosBusca = {}) {
  const must: object[] = [];
  if (f.apenasGenericos) must.push({ key: "generico", match: { value: true } });
  if (f.precoMaximo !== undefined) must.push({ key: "pmc", range: { lte: f.precoMaximo } });
  if (f.tarjas?.length) must.push({ key: "tarja", match: { any: f.tarjas } });
  if (f.ocultarHospitalares ?? true) must.push({ key: "restricao_hospitalar", match: { value: false } });
  return must.length ? { must } : undefined;
}

export async function buscarVetorial(
  consulta: string,
  motor: MotorVetorial,
  opcoes: { filtros?: FiltrosBusca; limite?: number; deslocamento?: number } = {},
): Promise<RespostaBusca> {
  const limite = opcoes.limite ?? 10;
  const offset = opcoes.deslocamento ?? 0;
  const filter = filtroQdrant(opcoes.filtros);
  const params = { hnsw_ef: EF_BUSCA };

  const t0 = performance.now();
  const vetor = await embedConsulta(consulta);
  const tempoEmbeddingMs = performance.now() - t0;

  const t1 = performance.now();
  const resposta =
    motor === "hibrido"
      ? await qdrant().query(COLLECTION, {
          prefetch: [
            { query: vetor, using: VETOR.denso, limit: CANDIDATOS_FUSAO, filter, params },
            { query: vetorTrigramasConsulta(consulta), using: VETOR.lexical, limit: CANDIDATOS_FUSAO, filter },
          ],
          query: { fusion: "rrf" },
          limit: limite,
          offset,
          with_payload: true,
        })
      : await qdrant().query(COLLECTION, {
          query: vetor,
          using: motor === "denso" ? VETOR.denso : VETOR.base,
          filter,
          params,
          limit: limite,
          offset,
          with_payload: true,
        });
  const tempoBancoMs = performance.now() - t1;

  return {
    motor,
    tempoEmbeddingMs,
    tempoBancoMs,
    resultados: resposta.points.map((p) => ({
      id: Number(p.id),
      score: p.score,
      medicamento: p.payload as unknown as Omit<Medicamento, "id">,
    })),
  };
}
