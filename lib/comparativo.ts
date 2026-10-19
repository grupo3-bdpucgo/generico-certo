// Executa a mesma consulta nos cinco motores, para a página /comparativo e a rota /api/comparativo.

import consultasJson from "@/benchmark/consultas.json";
import { buscarVetorial, type ResultadoBusca } from "./busca";
import { semAcento } from "./normalizacao";
import { correto, type ConsultaTeste } from "./gabarito";
import { buscarFullText, buscarIlike } from "./postgres";

export const MOTORES = ["denso_base", "denso", "hibrido", "ilike", "fulltext"] as const;
export type Motor = (typeof MOTORES)[number];

export const INFO_MOTOR: Record<Motor, { nome: string; banco: string; descricao: string; cor: string }> = {
  denso_base: {
    nome: "Denso sem enriquecimento",
    banco: "Qdrant",
    descricao: "Linha de base: embedding do texto com dados da CMED, HNSW e cosseno.",
    cor: "#2a78d6",
  },
  denso: {
    nome: "Denso com enriquecimento",
    banco: "Qdrant",
    descricao: "Embedding do texto com os termos populares do dicionário de indicações.",
    cor: "#eb6834",
  },
  hibrido: {
    nome: "Híbrido (RRF)",
    banco: "Qdrant",
    descricao: "Denso enriquecido + vetor esparso de trigramas, fundidos por RRF. Padrão do site.",
    cor: "#1baf7a",
  },
  ilike: {
    nome: "ILIKE",
    banco: "PostgreSQL",
    descricao: "Cada palavra precisa aparecer no texto enriquecido (sem acento). Sem ranking.",
    cor: "#eda100",
  },
  fulltext: {
    nome: "Full text",
    banco: "PostgreSQL",
    descricao: "tsvector em português com unaccent e pesos, ts_rank_cd; relaxa de E para OU.",
    cor: "#e87ba4",
  },
};

export interface ResultadoMotor {
  motor: Motor;
  resultados: (ResultadoBusca & { correto: boolean | null })[];
  tempoEmbeddingMs: number;
  tempoBancoMs: number;
  tempoServidorMs: number | null;
  relaxado: boolean;
  erro?: string;
}

const CONSULTAS = (consultasJson as { consultas: ConsultaTeste[] }).consultas;
const normalizar = (s: string) => semAcento(s.toLowerCase()).replace(/\s+/g, " ").trim();

/** Consulta do benchmark com o mesmo texto, se houver: permite marcar acertos pelo gabarito. */
export function consultaDoBenchmark(q: string): ConsultaTeste | null {
  const n = normalizar(q);
  return CONSULTAS.find((c) => normalizar(c.consulta) === n) ?? null;
}

export function consultasDoBenchmark(): ConsultaTeste[] {
  return CONSULTAS;
}

export async function compararMotores(q: string, limite = 10): Promise<{ teste: ConsultaTeste | null; motores: ResultadoMotor[] }> {
  const teste = consultaDoBenchmark(q);
  const motores: ResultadoMotor[] = [];
  // Em sequência, para que um motor não dispute rede e CPU com outro durante a medição.
  for (const motor of MOTORES) {
    try {
      const r =
        motor === "ilike"
          ? { ...(await buscarIlike(q, { limite, medirServidor: true })), tempoEmbeddingMs: 0 }
          : motor === "fulltext"
            ? { ...(await buscarFullText(q, { limite, medirServidor: true })), tempoEmbeddingMs: 0 }
            : await buscarVetorial(q, motor, { limite });
      motores.push({
        motor,
        tempoEmbeddingMs: r.tempoEmbeddingMs,
        tempoBancoMs: r.tempoBancoMs,
        tempoServidorMs: r.tempoServidorMs ?? null,
        relaxado: "relaxado" in r ? Boolean(r.relaxado) : false,
        resultados: r.resultados.map((x) => ({ ...x, correto: teste ? correto(x.medicamento, teste.gabarito) : null })),
      });
    } catch (e) {
      console.error(e);
      motores.push({ motor, resultados: [], tempoEmbeddingMs: 0, tempoBancoMs: 0, tempoServidorMs: null, relaxado: false, erro: "falhou" });
    }
  }
  return { teste, motores };
}
