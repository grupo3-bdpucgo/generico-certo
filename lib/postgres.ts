// Base relacional equivalente no PostgreSQL (Neon), usada no comparativo (papel: Data Analyst).
//  ilike     cada palavra da consulta precisa aparecer no texto enriquecido (sem acento, sem caixa)
//  fulltext  tsvector em português com unaccent e pesos (produto A, substância B, resto C),
//            ranqueado por ts_rank_cd; se a consulta com E lógico não achar nada, relaxa para OU

import pg from "pg";
import type { FiltrosBusca, ResultadoBusca } from "./busca";
import type { Medicamento } from "./normalizacao";

export type MotorRelacional = "ilike" | "fulltext";

export interface RespostaRelacional {
  motor: MotorRelacional;
  resultados: ResultadoBusca[];
  tempoBancoMs: number;
  /** Só no full text: true quando foi preciso relaxar de E para OU. */
  relaxado?: boolean;
}

// NUMERIC chega como string no node-postgres; os preços cabem com folga em double.
pg.types.setTypeParser(1700, (v) => Number(v));

const global_ = globalThis as unknown as { __pgPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!global_.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL não definida (veja .env.local.example)");
    global_.__pgPool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
  }
  return global_.__pgPool;
}

export const COLUNAS = [
  "id", "ggrem", "produto", "substancia", "laboratorio", "cnpj", "apresentacao", "classe",
  "tipo_produto", "selo", "pmc", "pf", "registro", "ean", "tarja", "generico", "restricao_hospitalar",
  "dosagem", "forma", "quantidade", "quantidade_num", "unidade", "preco_por_unidade",
  "chave_equivalencia", "chave_equivalencia_ampla", "termos_populares", "texto_embedding", "texto_enriquecido",
] as const;

const SELECT = COLUNAS.join(", ");

function filtroSql(f: FiltrosBusca = {}, params: unknown[]): string {
  const partes: string[] = [];
  if (f.apenasGenericos) partes.push("generico");
  if (f.precoMaximo !== undefined) {
    params.push(f.precoMaximo);
    partes.push(`pmc <= $${params.length}`);
  }
  if (f.tarjas?.length) {
    params.push(f.tarjas);
    partes.push(`tarja = ANY($${params.length}::text[])`);
  }
  if (f.ocultarHospitalares ?? true) partes.push("NOT restricao_hospitalar");
  return partes.length ? ` AND ${partes.join(" AND ")}` : "";
}

function paraResultado(linha: Record<string, unknown>, score: number): ResultadoBusca {
  const { id, rank: _rank, ...resto } = linha;
  return { id: Number(id), score, medicamento: resto as unknown as Omit<Medicamento, "id"> };
}

/** Palavras da consulta sem acento e em minúsculas; nenhuma é descartada (busca literal). */
export function palavrasConsulta(consulta: string): string[] {
  return consulta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export async function buscarIlike(
  consulta: string,
  opcoes: { filtros?: FiltrosBusca; limite?: number; deslocamento?: number } = {},
): Promise<RespostaRelacional> {
  const palavras = palavrasConsulta(consulta);
  if (!palavras.length) return { motor: "ilike", resultados: [], tempoBancoMs: 0 };
  const params: unknown[] = [palavras.map((p) => `%${p}%`), `${palavras[0]}%`];
  const where = filtroSql(opcoes.filtros, params);
  params.push(opcoes.limite ?? 10, opcoes.deslocamento ?? 0);
  // Sem ranking de relevância: primeiro quem tem o produto começando pela 1ª palavra, depois nomes curtos.
  const sql = `
    SELECT ${SELECT} FROM medicamentos
    WHERE f_unaccent(lower(texto_enriquecido)) LIKE ALL($1::text[])${where}
    ORDER BY (f_unaccent(lower(produto)) LIKE $2) DESC, length(produto), pmc
    LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const t = performance.now();
  const { rows } = await pool().query(sql, params);
  const tempoBancoMs = performance.now() - t;
  return { motor: "ilike", tempoBancoMs, resultados: rows.map((r) => paraResultado(r, 1)) };
}

export async function buscarFullText(
  consulta: string,
  opcoes: { filtros?: FiltrosBusca; limite?: number; deslocamento?: number } = {},
): Promise<RespostaRelacional> {
  const executar = async (tsquery: string) => {
    const params: unknown[] = [consulta];
    const where = filtroSql(opcoes.filtros, params);
    params.push(opcoes.limite ?? 10, opcoes.deslocamento ?? 0);
    const sql = `
      WITH q AS (SELECT ${tsquery} AS tq)
      SELECT ${SELECT}, ts_rank_cd(busca, q.tq) AS rank FROM medicamentos, q
      WHERE busca @@ q.tq${where}
      ORDER BY rank DESC, pmc
      LIMIT $${params.length - 1} OFFSET $${params.length}`;
    return pool().query(sql, params);
  };

  const t = performance.now();
  let { rows } = await executar("websearch_to_tsquery('pt_unaccent', $1)");
  let relaxado = false;
  if (!rows.length) {
    // OU entre os lexemas da consulta (stopwords já removidas pelo dicionário português).
    ({ rows } = await executar(
      "(SELECT coalesce(to_tsquery('pt_unaccent', string_agg(lexeme, ' | ')), ''::tsquery) FROM unnest(to_tsvector('pt_unaccent', $1)))",
    ));
    relaxado = true;
  }
  const tempoBancoMs = performance.now() - t;
  return {
    motor: "fulltext",
    tempoBancoMs,
    relaxado,
    resultados: rows.map((r) => paraResultado(r, Number(r.rank))),
  };
}
