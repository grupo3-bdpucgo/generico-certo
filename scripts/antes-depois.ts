// Roda as três consultas da linha de base (docs/baseline-denso-puro.md) nos três motores vetoriais
// e grava docs/antes-depois.md. Uso: npx tsx --env-file-if-exists=.env.local scripts/antes-depois.ts

import { writeFileSync } from "node:fs";
import { buscarVetorial, type MotorVetorial } from "../lib/busca";
import { embedConsulta } from "../lib/embeddings";

const CONSULTAS = ["dorflex", "remédio pra dor de cabeça", "antialérgico que não dá sono"];
const MOTORES: [MotorVetorial, string][] = [
  ["denso_base", "Denso puro, sem enriquecimento"],
  ["denso", "Denso puro, com enriquecimento"],
  ["hibrido", "Híbrido (denso enriquecido + trigramas, RRF)"],
];

// Aquecimento: carrega o modelo e abre a conexão antes de medir.
await buscarVetorial("aquecimento", "denso", { limite: 1, gerarVetor: embedConsulta });

const brl = (n: number) => n.toFixed(2).replace(".", ",");
let md =
  "# Antes e depois: três consultas nos motores vetoriais\n\n" +
  `Gerado em ${new Date().toLocaleString("pt-BR")} por scripts/antes-depois.ts. Top 5 de cada motor, sem nenhum ` +
  "filtro, como na linha de base. No híbrido o escore é o da fusão RRF, que depende só das " +
  "posições e não é comparável à similaridade de cosseno.\n";

for (const consulta of CONSULTAS) {
  md += `\n## "${consulta}"\n`;
  console.log(`\n=== "${consulta}"`);
  for (const [motor, rotulo] of MOTORES) {
    const r = await buscarVetorial(consulta, motor, { limite: 5, filtros: { ocultarHospitalares: false }, gerarVetor: embedConsulta });
    md += `\n**${rotulo}** (embedding ${r.tempoEmbeddingMs.toFixed(0)} ms, Qdrant ${r.tempoBancoMs.toFixed(0)} ms)\n\n`;
    md += "| Posição | Escore | Produto | Substância | Selo | PMC (R$) |\n|---|---|---|---|---|---|\n";
    console.log(`-- ${rotulo} (${r.tempoBancoMs.toFixed(0)} ms)`);
    r.resultados.forEach((x, i) => {
      const m = x.medicamento;
      const escore = motor === "hibrido" ? x.score.toFixed(3) : `${(x.score * 100).toFixed(1)}%`;
      md += `| ${i + 1} | ${escore.replace(".", ",")} | ${m.produto} | ${m.substancia.join(" + ")} | ${m.selo} | ${brl(m.pmc)} |\n`;
      console.log(`   ${i + 1}. ${escore.padStart(6)}  ${m.produto} | ${m.substancia.join(" + ")} | ${m.selo} | R$ ${brl(m.pmc)}`);
    });
  }
}

writeFileSync("docs/antes-depois.md", md);
console.log("\nGerado docs/antes-depois.md");
