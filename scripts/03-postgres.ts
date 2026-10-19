// Etapa 3 (Data Analyst): cria e popula a base relacional equivalente no PostgreSQL (Neon).
// Mesmos 11.001 registros e mesmo texto enriquecido do Qdrant, para a comparação ser justa.
// Uso: npm run postgres

import { readFileSync } from "node:fs";
import { COLUNAS, buscarFullText, buscarIlike, pool } from "../lib/postgres";
import type { Medicamento } from "../lib/normalizacao";

const LOTE = 500;
const dados: Medicamento[] = JSON.parse(readFileSync("data/dados.json", "utf-8"));
const db = pool();

const DDL = `
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() é STABLE; o wrapper IMMUTABLE permite usá-lo em índice.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- array_to_string() também é STABLE; o vetor de substâncias entra na coluna gerada por este wrapper.
CREATE OR REPLACE FUNCTION f_juntar(text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT array_to_string($1, ' ') $$;

-- Configuração de busca textual em português que também remove acentos.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'pt_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION pt_unaccent (COPY = portuguese);
    ALTER TEXT SEARCH CONFIGURATION pt_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;
  END IF;
END $$;

DROP TABLE IF EXISTS medicamentos;
CREATE TABLE medicamentos (
  id                       integer PRIMARY KEY,
  ggrem                    text NOT NULL UNIQUE,
  produto                  text NOT NULL,
  substancia               text[] NOT NULL,
  laboratorio              text NOT NULL,
  cnpj                     text,
  apresentacao             text NOT NULL,
  classe                   text,
  tipo_produto             text,
  selo                     text NOT NULL,
  pmc                      numeric(10,2) NOT NULL CHECK (pmc > 0),
  pf                       numeric(10,2),
  registro                 text,
  ean                      text,
  tarja                    text NOT NULL,
  generico                 boolean NOT NULL,
  restricao_hospitalar     boolean NOT NULL,
  dosagem                  text NOT NULL,
  forma                    text NOT NULL,
  quantidade               text NOT NULL,
  quantidade_num           numeric,
  unidade                  text NOT NULL,
  preco_por_unidade        numeric(14,4),
  chave_equivalencia       text NOT NULL,
  chave_equivalencia_ampla text NOT NULL,
  termos_populares         text[] NOT NULL,
  texto_embedding          text NOT NULL,
  texto_enriquecido        text NOT NULL,
  busca tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('pt_unaccent', produto), 'A') ||
    setweight(to_tsvector('pt_unaccent', f_juntar(substancia)), 'B') ||
    setweight(to_tsvector('pt_unaccent', texto_enriquecido), 'C')
  ) STORED
);
`;

const INDICES = `
CREATE INDEX medicamentos_busca_gin  ON medicamentos USING gin (busca);
CREATE INDEX medicamentos_texto_trgm ON medicamentos USING gin (f_unaccent(lower(texto_enriquecido)) gin_trgm_ops);
CREATE INDEX medicamentos_chave      ON medicamentos (chave_equivalencia);
CREATE INDEX medicamentos_chave_ampla ON medicamentos (chave_equivalencia_ampla);
CREATE INDEX medicamentos_pmc        ON medicamentos (pmc);
CREATE INDEX medicamentos_tarja      ON medicamentos (tarja);
ANALYZE medicamentos;
`;

const t0 = performance.now();
await db.query(DDL);
console.log("Esquema criado (extensões unaccent e pg_trgm, configuração pt_unaccent, tabela medicamentos)");

for (let i = 0; i < dados.length; i += LOTE) {
  const lote = dados.slice(i, i + LOTE);
  const params: unknown[] = [];
  const linhas = lote.map((m) => {
    const marcadores = COLUNAS.map((c) => {
      params.push(m[c as keyof Medicamento]);
      return `$${params.length}`;
    });
    return `(${marcadores.join(", ")})`;
  });
  await db.query(`INSERT INTO medicamentos (${COLUNAS.join(", ")}) VALUES ${linhas.join(", ")}`, params);
}
const tCarga = performance.now() - t0;
await db.query(INDICES);
const tTotal = performance.now() - t0;

const { rows: [stats] } = await db.query(`
  SELECT count(*)::int AS linhas,
         count(DISTINCT chave_equivalencia)::int AS chaves,
         count(*) FILTER (WHERE generico)::int AS genericos,
         pg_size_pretty(pg_total_relation_size('medicamentos')) AS tamanho
  FROM medicamentos`);
console.log(`Linhas carregadas: ${stats.linhas} de ${dados.length} | chaves ${stats.chaves} | genéricos ${stats.genericos} | tamanho com índices ${stats.tamanho}`);
console.log(`Carga ${(tCarga / 1000).toFixed(1)} s | com índices ${(tTotal / 1000).toFixed(1)} s`);

// Amostra das três consultas da linha de base. Aquecimento antes de medir: o Neon free
// suspende o computador quando ocioso e a primeira consulta pode levar segundos.
for (let i = 0; i < 3; i++) {
  await buscarIlike("aquecimento");
  await buscarFullText("aquecimento");
}

const brl = (n: number) => n.toFixed(2).replace(".", ",");
for (const consulta of ["dorflex", "remédio pra dor de cabeça", "antialérgico que não dá sono"]) {
  console.log(`\n=== "${consulta}"`);
  for (const r of [await buscarIlike(consulta, { limite: 5, filtros: { ocultarHospitalares: false } }),
                   await buscarFullText(consulta, { limite: 5, filtros: { ocultarHospitalares: false } })]) {
    const extra = r.relaxado ? ", relaxado para OU" : "";
    console.log(`-- ${r.motor} (${r.tempoBancoMs.toFixed(0)} ms${extra}, ${r.resultados.length} resultados)`);
    r.resultados.forEach((x, i) => {
      const m = x.medicamento;
      const escore = r.motor === "fulltext" ? x.score.toFixed(3).padStart(6) : "     -";
      console.log(`   ${i + 1}. ${escore}  ${m.produto} | ${m.substancia.join(" + ").slice(0, 60)} | ${m.selo} | R$ ${brl(m.pmc)}`);
    });
  }
}

await db.end();
