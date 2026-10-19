// Etapa 4 (Data Analyst): roda as consultas de benchmark/consultas.json nos cinco motores
// e grava benchmark/resultados.json.
// Uso: npm run benchmark
//
// Procedimento de medição:
//  - aquecimento: RODADAS_AQUECIMENTO consultas genéricas descartadas por motor e, em seguida, uma
//    passada completa pelas consultas do conjunto, também descartada, antes de medir (o Neon free
//    suspende o computador quando ocioso e a primeira consulta leva segundos; o Qdrant e o modelo
//    de embeddings também têm custo de primeira chamada)
//  - revisão do procedimento (19/10/2026): a primeira execução usava só as 5 consultas genéricas;
//    o cache frio do vetor "denso", recém-regravado, deixou as consultas 1 a 16 do denso enriquecido
//    e do híbrido entre 70 e 85 ms e inflou o p95. A passada completa foi acrescentada e só o tempo
//    foi refeito (a acurácia não muda, os motores são determinísticos)
//  - cada consulta roda REPETICOES vezes por motor, alternando os motores; o tempo reportado é a mediana
//  - a acurácia vem da primeira repetição (os cinco motores são determinísticos)
//  - três tempos por consulta: embedding (no cliente), banco ponta a ponta (no cliente, inclui rede)
//    e banco no servidor (campo "time" do Qdrant; planejamento + execução do EXPLAIN ANALYZE no
//    PostgreSQL). A segunda revisão (19/10/2026) acrescentou o tempo de servidor: respostas do
//    Qdrant acima de ~1,5 KB ganhavam +40 ms fixos no cliente (interação entre o algoritmo de Nagle
//    e o ACK atrasado do TCP), o que media a pilha de rede e não o motor. Os dois bancos passaram a
//    devolver o mesmo conjunto reduzido de campos (CAMPOS_EXIBIDOS)
//
// Dificuldade: para cada consulta, a probabilidade de acerto no top 5 de um motor que sorteasse
// resultados ao acaso (p_acaso). A média ponderada usa peso 1 - p_acaso, para que consultas com
// gabarito amplo, em que qualquer motor acerta, valham menos que as difíceis.

import { readFileSync, writeFileSync } from "node:fs";
import { buscarVetorial, type ResultadoBusca } from "../lib/busca";
import { palavrasNoDicionario, probabilidadeAcaso } from "../lib/dificuldade";
import { embedConsulta } from "../lib/embeddings";
import { correto, type ConsultaTeste } from "../lib/gabarito";
import type { DicionarioIndicacoes, Medicamento } from "../lib/normalizacao";
import { buscarFullText, buscarIlike, pool } from "../lib/postgres";

const MOTORES = ["denso_base", "denso", "hibrido", "ilike", "fulltext"] as const;
type Motor = (typeof MOTORES)[number];
const ROTULOS: Record<Motor, string> = {
  denso_base: "Denso puro (sem enriquecimento)",
  denso: "Denso puro (com enriquecimento)",
  hibrido: "Híbrido (denso + trigramas, RRF)",
  ilike: "PostgreSQL ILIKE",
  fulltext: "PostgreSQL full text",
};
const LIMITE = 10;
const REPETICOES = 5;
const RODADAS_AQUECIMENTO = 5;

const { consultas }: { consultas: ConsultaTeste[] } = JSON.parse(readFileSync("benchmark/consultas.json", "utf-8"));
const dados: Medicamento[] = JSON.parse(readFileSync("data/dados.json", "utf-8"));
const dic: DicionarioIndicacoes = JSON.parse(readFileSync("data/dicionario-indicacoes.json", "utf-8"));

// Mesmo universo que os motores enxergam com o filtro padrão do site.
const elegiveis = dados.filter((m) => !m.restricao_hospitalar);
const dificuldade = Object.fromEntries(
  consultas.map((c) => {
    const validos = elegiveis.filter((m) => correto(m, c.gabarito)).length;
    const coincidentes = palavrasNoDicionario(c.consulta, dic);
    return [c.id, { registros_validos: validos, p_acaso_top5: probabilidadeAcaso(elegiveis.length, validos), palavras_no_dicionario: coincidentes }];
  }),
);

// O EXPLAIN ANALYZE roda depois da consulta medida, então não interfere no tempo ponta a ponta.
let medirServidor = false;

async function executar(motor: Motor, consulta: string) {
  if (motor === "ilike" || motor === "fulltext") {
    const opcoes = { limite: LIMITE, medirServidor };
    const r = motor === "ilike" ? await buscarIlike(consulta, opcoes) : await buscarFullText(consulta, opcoes);
    return { resultados: r.resultados, tempoBancoMs: r.tempoBancoMs, tempoServidorMs: r.tempoServidorMs ?? 0, tempoEmbeddingMs: 0, relaxado: r.relaxado ?? false };
  }
  const r = await buscarVetorial(consulta, motor, { limite: LIMITE });
  return { resultados: r.resultados, tempoBancoMs: r.tempoBancoMs, tempoServidorMs: r.tempoServidorMs, tempoEmbeddingMs: r.tempoEmbeddingMs, relaxado: false };
}

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const percentil = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const arred = (n: number, c = 2) => Number(n.toFixed(c));

console.log(`Aquecimento: ${RODADAS_AQUECIMENTO} consultas descartadas por motor`);
await embedConsulta("aquecimento do modelo");
for (let i = 0; i < RODADAS_AQUECIMENTO; i++) {
  for (const motor of MOTORES) await executar(motor, `aquecimento ${i}`);
}
medirServidor = true;
console.log(`Aquecimento: passada completa descartada pelas ${consultas.length} consultas em cada motor`);
for (const motor of MOTORES) {
  for (const c of consultas) await executar(motor, c.consulta);
}

interface Medicao {
  consulta_id: number;
  motor: Motor;
  acerto_top5: boolean;
  posicao_primeiro_correto: number | null;
  rr: number;
  corretos_top5: number;
  total_resultados: number;
  relaxado: boolean;
  tempo_banco_ms: number;
  tempo_banco_ms_amostras: number[];
  tempo_servidor_ms: number;
  tempo_servidor_ms_amostras: number[];
  tempo_embedding_ms: number;
  top5: { produto: string; substancia: string; selo: string; pmc: number; correto: boolean }[];
}
const medicoes: Medicao[] = [];

for (const c of consultas) {
  const tempos: Record<Motor, { banco: number[]; servidor: number[]; emb: number[] }> = Object.fromEntries(
    MOTORES.map((m) => [m, { banco: [], servidor: [], emb: [] }]),
  ) as never;
  const primeira: Partial<Record<Motor, { resultados: ResultadoBusca[]; relaxado: boolean }>> = {};

  for (let rep = 0; rep < REPETICOES; rep++) {
    for (const motor of MOTORES) {
      const r = await executar(motor, c.consulta);
      tempos[motor].banco.push(r.tempoBancoMs);
      tempos[motor].servidor.push(r.tempoServidorMs);
      tempos[motor].emb.push(r.tempoEmbeddingMs);
      if (rep === 0) primeira[motor] = { resultados: r.resultados, relaxado: r.relaxado };
    }
  }

  const linha: string[] = [];
  for (const motor of MOTORES) {
    const { resultados, relaxado } = primeira[motor]!;
    const marcas = resultados.map((x) => correto(x.medicamento, c.gabarito));
    const pos = marcas.indexOf(true);
    medicoes.push({
      consulta_id: c.id,
      motor,
      acerto_top5: marcas.slice(0, 5).some(Boolean),
      posicao_primeiro_correto: pos >= 0 ? pos + 1 : null,
      rr: pos >= 0 ? arred(1 / (pos + 1), 4) : 0,
      corretos_top5: marcas.slice(0, 5).filter(Boolean).length,
      total_resultados: resultados.length,
      relaxado,
      tempo_banco_ms: arred(mediana(tempos[motor].banco)),
      tempo_banco_ms_amostras: tempos[motor].banco.map((t) => arred(t)),
      tempo_servidor_ms: arred(mediana(tempos[motor].servidor), 3),
      tempo_servidor_ms_amostras: tempos[motor].servidor.map((t) => arred(t, 3)),
      tempo_embedding_ms: arred(mediana(tempos[motor].emb)),
      top5: resultados.slice(0, 5).map((x, i) => ({
        produto: x.medicamento.produto,
        substancia: x.medicamento.substancia.join(" + "),
        selo: x.medicamento.selo,
        pmc: x.medicamento.pmc,
        correto: marcas[i],
      })),
    });
    linha.push(`${motor} ${pos >= 0 ? `#${pos + 1}` : "--"}`);
  }
  console.log(`${String(c.id).padStart(2)} ${c.consulta.padEnd(44)} ${linha.join(" | ")}`);
}

function agregar(filtro: (c: ConsultaTeste) => boolean) {
  const ids = new Set(consultas.filter(filtro).map((c) => c.id));
  return Object.fromEntries(
    MOTORES.map((motor) => {
      const ms = medicoes.filter((m) => m.motor === motor && ids.has(m.consulta_id));
      const achados = ms.filter((m) => m.posicao_primeiro_correto !== null);
      const bancos = ms.map((m) => m.tempo_banco_ms);
      const peso = (m: Medicao) => 1 - dificuldade[m.consulta_id].p_acaso_top5;
      const somaPesos = ms.reduce((s, m) => s + peso(m), 0);
      return [
        motor,
        {
          consultas: ms.length,
          acerto_top5: arred(ms.filter((m) => m.acerto_top5).length / ms.length, 4),
          acerto_top5_ponderado: arred(ms.reduce((s, m) => s + (m.acerto_top5 ? peso(m) : 0), 0) / somaPesos, 4),
          acaso_top5_medio: arred(ms.reduce((s, m) => s + dificuldade[m.consulta_id].p_acaso_top5, 0) / ms.length, 4),
          mrr_top10: arred(ms.reduce((s, m) => s + m.rr, 0) / ms.length, 4),
          posicao_media: achados.length ? arred(achados.reduce((s, m) => s + m.posicao_primeiro_correto!, 0) / achados.length) : null,
          nao_encontrados_top10: ms.length - achados.length,
          precisao_top5: arred(ms.reduce((s, m) => s + m.corretos_top5, 0) / (5 * ms.length), 4),
          sem_resultado: ms.filter((m) => m.total_resultados === 0).length,
          tempo_banco_mediana_ms: arred(mediana(bancos)),
          tempo_banco_p95_ms: arred(percentil(bancos, 95)),
          tempo_servidor_mediana_ms: arred(mediana(ms.map((m) => m.tempo_servidor_ms)), 3),
          tempo_servidor_p95_ms: arred(percentil(ms.map((m) => m.tempo_servidor_ms), 95), 3),
          tempo_embedding_mediana_ms: arred(mediana(ms.map((m) => m.tempo_embedding_ms))),
        },
      ];
    }),
  );
}

const categorias = [...new Set(consultas.map((c) => c.categoria))];
const resultado = {
  gerado_em: new Date().toISOString(),
  procedimento: {
    limite: LIMITE,
    repeticoes: REPETICOES,
    rodadas_aquecimento: RODADAS_AQUECIMENTO,
    aquecimento: "5 consultas genéricas + uma passada completa pelo conjunto, por motor, descartadas",
    revisao:
      "Na primeira execução o aquecimento tinha só as 5 consultas genéricas; o cache frio do vetor denso " +
      "recém-gravado inflava o p95 do denso enriquecido e do híbrido. A passada completa foi acrescentada " +
      "e o tempo foi medido de novo; a acurácia não muda.",
    filtros: "padrão do site: oculta apresentações de uso restrito hospitalar",
    tempo:
      "mediana das repetições; tempo_banco = ponta a ponta no cliente (inclui rede); tempo_servidor = " +
      "campo time do Qdrant ou Planning + Execution Time do EXPLAIN ANALYZE no PostgreSQL",
    campos_devolvidos: "CAMPOS_EXIBIDOS (iguais nos dois bancos)",
    registros_elegiveis: elegiveis.length,
    ponderacao: "acerto_top5_ponderado usa peso 1 - p_acaso_top5 por consulta",
  },
  motores: ROTULOS,
  consultas: consultas.map((c) => ({ ...c, ...dificuldade[c.id] })),
  agregados: {
    todas: agregar(() => true),
    sem_desenvolvimento: agregar((c) => !c.desenvolvimento),
    por_categoria: Object.fromEntries(categorias.map((cat) => [cat, agregar((c) => c.categoria === cat)])),
    por_categoria_sem_desenvolvimento: Object.fromEntries(
      categorias.map((cat) => [cat, agregar((c) => c.categoria === cat && !c.desenvolvimento)]),
    ),
  },
  medicoes,
};
writeFileSync("benchmark/resultados.json", JSON.stringify(resultado, null, 2));

console.log("\nMotor                              | acerto@5 | MRR@10 | pos. média | não achou | ponta a ponta | servidor");
for (const [rotulo, ag] of [["todas", resultado.agregados.todas], ["sem desenvolvimento", resultado.agregados.sem_desenvolvimento]] as const) {
  console.log(`-- ${rotulo}`);
  for (const motor of MOTORES) {
    const a = ag[motor];
    console.log(
      `${ROTULOS[motor].padEnd(34)} | ${(a.acerto_top5 * 100).toFixed(0).padStart(7)}% | ${(a.acerto_top5_ponderado * 100).toFixed(1).padStart(8)}% | ${a.mrr_top10.toFixed(3)} | ${String(a.posicao_media ?? "-").padStart(10)} | ${String(a.nao_encontrados_top10).padStart(9)} | ${a.tempo_banco_mediana_ms} ms | ${a.tempo_servidor_mediana_ms} ms`,
    );
  }
}
console.log("\nGerado benchmark/resultados.json");
await pool().end();
