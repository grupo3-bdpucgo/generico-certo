// Confere o conjunto de consultas antes do benchmark, sem rodar nenhum motor:
//  1. viabilidade: quantos registros da base satisfazem cada gabarito
//  2. vazamento: a consulta aparece literalmente no dicionário, ou contém um termo de várias palavras dele
// Uso: npx tsx scripts/verificar-consultas.ts

import { readFileSync } from "node:fs";
import { correto, type ConsultaTeste } from "../lib/gabarito";
import { semAcento, type DicionarioIndicacoes, type Medicamento } from "../lib/normalizacao";

const dados: Medicamento[] = JSON.parse(readFileSync("data/dados.json", "utf-8"));
const dic: DicionarioIndicacoes = JSON.parse(readFileSync("data/dicionario-indicacoes.json", "utf-8"));
const { consultas }: { consultas: ConsultaTeste[] } = JSON.parse(readFileSync("benchmark/consultas.json", "utf-8"));

// Palavras hifenizadas ("anti-inflamatório") contam como uma palavra só.
const norm = (s: string) => semAcento(s.toLowerCase()).replace(/-/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const termos = [...Object.values(dic.classes), ...Object.values(dic.substancias)].flat().map(norm);
const termosCompostos = [...new Set(termos.filter((t) => t.includes(" ")))];

let problemas = 0;
console.log("id | categoria       | dev | registros válidos | vazamento | consulta");
for (const c of consultas) {
  const q = norm(c.consulta);
  const validos = dados.filter((m) => correto(m, c.gabarito)).length;
  const consultaNoDicionario = termos.some((t) => t.includes(q));
  const termoNaConsulta = termosCompostos.filter((t) => ` ${q} `.includes(` ${t} `));
  const vazou = consultaNoDicionario || termoNaConsulta.length > 0;
  if (!validos || (vazou && !c.desenvolvimento)) problemas++;
  const detalhe = consultaNoDicionario ? "consulta no dicionário" : termoNaConsulta.length ? `contém "${termoNaConsulta.join('", "')}"` : "não";
  console.log(
    `${String(c.id).padStart(2)} | ${c.categoria.padEnd(15)} | ${c.desenvolvimento ? "sim" : "   "} | ${String(validos).padStart(17)} | ${detalhe.padEnd(9)} | ${c.consulta}`,
  );
}
console.log(`\n${consultas.length} consultas, ${consultas.filter((c) => !c.desenvolvimento).length} novas; problemas: ${problemas}`);
process.exitCode = problemas ? 1 : 0;
