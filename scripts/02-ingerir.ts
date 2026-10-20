// Etapa 2 (Data Engineer + DBA): gera embeddings em lote e envia para o Qdrant.
// Cada ponto recebe três vetores nomeados (ver lib/qdrant.ts).
// Uso: npm run ingerir                 (recria a collection)
//      npm run ingerir -- --manter      (só faz upsert na collection existente)
//      npm run ingerir -- --so-lexical  (regrava apenas o vetor esparso, sem gerar embeddings)
//      npm run ingerir -- --so-payload  (atualiza só campos de payload e índices, sem gerar embeddings)
//
// Os vetores da linha de base (texto sem enriquecimento) são lidos de data/vetores-base.json
// quando o arquivo existe, para não recalcular; senão são gerados a partir de texto_embedding.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { embedLote, provedorEmbeddings } from "../lib/embeddings";
import { textoLexical, vetorTrigramasDocumento } from "../lib/lexical";
import { COLLECTION, HNSW, INDICES_PAYLOAD, VETOR, criarCollection, qdrant } from "../lib/qdrant";
import type { Medicamento } from "../lib/normalizacao";

const LOTE_EMBEDDING = 64;
const LOTE_UPLOAD = 256;
const ARQUIVO_BASE = "data/vetores-base.json";
const recriar = !process.argv.includes("--manter");

const dados: Medicamento[] = JSON.parse(readFileSync("data/dados.json", "utf-8"));

if (process.argv.includes("--so-payload")) {
  const t = Date.now();
  const campos = ["forma_grupo", "doses"] as const;
  for (let i = 0; i < dados.length; i += 500) {
    const operations = dados.slice(i, i + 500).map((m) => ({
      set_payload: { payload: Object.fromEntries(campos.map((c) => [c, m[c]])), points: [m.id] },
    }));
    await qdrant().batchUpdate(COLLECTION, { wait: true, operations });
  }
  await criarCollection(false); // cria os índices que faltarem
  console.log(`Payload (${campos.join(", ")}) atualizado em ${dados.length} pontos e índices conferidos (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  process.exit(0);
}

if (process.argv.includes("--so-lexical")) {
  const t = Date.now();
  for (let i = 0; i < dados.length; i += LOTE_UPLOAD) {
    const points = dados
      .slice(i, i + LOTE_UPLOAD)
      .map((m) => ({ id: m.id, vector: { [VETOR.lexical]: vetorTrigramasDocumento(textoLexical(m)) } }));
    await qdrant().updateVectors(COLLECTION, { wait: true, points });
  }
  console.log(`Vetor ${VETOR.lexical} regravado em ${dados.length} pontos (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  process.exit(0);
}
const provedor = provedorEmbeddings();
const vetoresBase: Record<number, number[]> | null = existsSync(ARQUIVO_BASE)
  ? JSON.parse(readFileSync(ARQUIVO_BASE, "utf-8"))
  : null;
console.log(`${dados.length} registros | modelo ${provedor.modelo} (${provedor.dimensao} dims) | collection "${COLLECTION}"`);
console.log(`Vetores da linha de base: ${vetoresBase ? `reaproveitados de ${ARQUIVO_BASE}` : "serão gerados"}`);

const t0 = Date.now();
await criarCollection(recriar);
console.log(
  `Collection ${recriar ? "recriada" : "verificada"}: vetores ${Object.values(VETOR).join(", ")}; ` +
    `HNSW m=${HNSW.m}, ef_construct=${HNSW.ef_construct}; ${Object.keys(INDICES_PAYLOAD).length} índices de payload`,
);

let tempoEmbedding = 0;
let tempoUpload = 0;
type VetoresPonto = Record<string, number[] | { indices: number[]; values: number[] }>;
let pendentes: { id: number; vector: VetoresPonto; payload: Record<string, unknown> }[] = [];
const novosBase: Record<number, number[]> = {};

async function enviar() {
  if (!pendentes.length) return;
  const t = Date.now();
  await qdrant().upsert(COLLECTION, { wait: true, points: pendentes });
  tempoUpload += Date.now() - t;
  pendentes = [];
}

for (let i = 0; i < dados.length; i += LOTE_EMBEDDING) {
  const lote = dados.slice(i, i + LOTE_EMBEDDING);
  const t = Date.now();
  const densos = await embedLote(lote.map((m) => m.texto_enriquecido));
  const faltantes = vetoresBase ? [] : await embedLote(lote.map((m) => m.texto_embedding));
  tempoEmbedding += Date.now() - t;

  lote.forEach((m, j) => {
    const { id, ...payload } = m;
    const base = vetoresBase ? vetoresBase[id] : faltantes[j];
    if (!base) throw new Error(`Vetor de linha de base ausente para o id ${id}`);
    if (!vetoresBase) novosBase[id] = base;
    pendentes.push({
      id,
      vector: { [VETOR.base]: base, [VETOR.denso]: densos[j], [VETOR.lexical]: vetorTrigramasDocumento(textoLexical(m)) },
      payload,
    });
  });
  if (pendentes.length >= LOTE_UPLOAD) await enviar();

  const feitos = Math.min(i + LOTE_EMBEDDING, dados.length);
  if (feitos % 1024 < LOTE_EMBEDDING || feitos === dados.length) {
    console.log(`  ${feitos}/${dados.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
}
await enviar();
if (!vetoresBase) writeFileSync(ARQUIVO_BASE, JSON.stringify(novosBase));

const { count } = await qdrant().count(COLLECTION, { exact: true });
const info = await qdrant().getCollection(COLLECTION);
const total = Date.now() - t0;

console.log(`\nPontos na collection: ${count} | status ${info.status} | segmentos ${info.segments_count}`);
console.log(`Tempo total ${(total / 1000).toFixed(1)} s (embeddings ${(tempoEmbedding / 1000).toFixed(1)} s, upload ${(tempoUpload / 1000).toFixed(1)} s)`);

writeFileSync(
  "data/ingestao-stats.json",
  JSON.stringify(
    {
      data: new Date().toISOString(),
      registros: dados.length,
      pontos: count,
      modelo: provedor.modelo,
      dimensao: provedor.dimensao,
      vetores: VETOR,
      hnsw: HNSW,
      vetores_base_reaproveitados: Boolean(vetoresBase),
      tempo_total_ms: total,
      tempo_embeddings_ms: tempoEmbedding,
      tempo_upload_ms: tempoUpload,
    },
    null,
    2,
  ),
);
