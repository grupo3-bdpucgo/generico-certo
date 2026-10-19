// Etapa 2 (Data Engineer + DBA): gera embeddings em lote e envia para o Qdrant.
// Uso: npm run ingerir            (recria a collection)
//      npm run ingerir -- --manter (só faz upsert na collection existente)

import { readFileSync, writeFileSync } from "node:fs";
import { embedConsulta, embedLote, provedorEmbeddings } from "../lib/embeddings";
import { COLLECTION, EF_BUSCA, HNSW, INDICES_PAYLOAD, criarCollection, qdrant } from "../lib/qdrant";
import type { Medicamento } from "../lib/normalizacao";

const LOTE_EMBEDDING = 64;
const LOTE_UPLOAD = 256;
const recriar = !process.argv.includes("--manter");

const dados: Medicamento[] = JSON.parse(readFileSync("data/dados.json", "utf-8"));
const provedor = provedorEmbeddings();
console.log(`${dados.length} registros | modelo ${provedor.modelo} (${provedor.dimensao} dims) | collection "${COLLECTION}"`);

const t0 = Date.now();
await criarCollection(recriar);
console.log(`Collection ${recriar ? "recriada" : "verificada"} com HNSW m=${HNSW.m}, ef_construct=${HNSW.ef_construct} e ${Object.keys(INDICES_PAYLOAD).length} índices de payload`);

let tempoEmbedding = 0;
let tempoUpload = 0;
let pendentes: { id: number; vector: number[]; payload: Record<string, unknown> }[] = [];

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
  const vetores = await embedLote(lote.map((m) => m.texto_embedding));
  tempoEmbedding += Date.now() - t;

  lote.forEach((m, j) => {
    const { id, ...payload } = m;
    pendentes.push({ id, vector: vetores[j], payload });
  });
  if (pendentes.length >= LOTE_UPLOAD) await enviar();

  const feitos = Math.min(i + LOTE_EMBEDDING, dados.length);
  if (feitos % 1024 < LOTE_EMBEDDING || feitos === dados.length) {
    console.log(`  ${feitos}/${dados.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
}
await enviar();

const { count } = await qdrant().count(COLLECTION, { exact: true });
const info = await qdrant().getCollection(COLLECTION);
const total = Date.now() - t0;

console.log(`\nPontos na collection: ${count} | status ${info.status} | segmentos ${info.segments_count}`);
console.log(`Tempo total ${(total / 1000).toFixed(1)} s (embeddings ${(tempoEmbedding / 1000).toFixed(1)} s, upload ${(tempoUpload / 1000).toFixed(1)} s)`);

// Teste rápido de sanidade.
for (const consulta of ["dorflex", "remédio pra dor de cabeça", "antialérgico que não dá sono"]) {
  const t = Date.now();
  const vetor = await embedConsulta(consulta);
  const { points } = await qdrant().query(COLLECTION, {
    query: vetor,
    limit: 5,
    with_payload: true,
    params: { hnsw_ef: EF_BUSCA },
  });
  console.log(`\n"${consulta}" (${Date.now() - t} ms)`);
  for (const p of points) {
    const m = p.payload as unknown as Medicamento;
    console.log(`  ${(p.score * 100).toFixed(1)}%  ${m.produto} | ${m.substancia.join(" + ")} | ${m.selo} | R$ ${m.pmc}`);
  }
}

writeFileSync(
  "data/ingestao-stats.json",
  JSON.stringify(
    {
      data: new Date().toISOString(),
      registros: dados.length,
      pontos: count,
      modelo: provedor.modelo,
      dimensao: provedor.dimensao,
      hnsw: HNSW,
      tempo_total_ms: total,
      tempo_embeddings_ms: tempoEmbedding,
      tempo_upload_ms: tempoUpload,
    },
    null,
    2,
  ),
);
