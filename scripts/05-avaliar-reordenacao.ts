// Avalia a reordenação do híbrido (lib/reordenacao.ts) nas mesmas consultas do benchmark, sem
// alterar benchmark/resultados.json (a execução congelada usada no relatório).
// A reordenação foi criada depois do benchmark, a partir de uma consulta fora do conjunto de teste
// ("pregabalina 75 mg 30 capsulas"); estes números servem para verificar que ela não piora o motor.
// Uso: npx tsx --env-file-if-exists=.env.local scripts/05-avaliar-reordenacao.ts

import { readFileSync, writeFileSync } from "node:fs";
import { buscarVetorial } from "../lib/busca";
import { correto, type ConsultaTeste } from "../lib/gabarito";

const { consultas }: { consultas: ConsultaTeste[] } = JSON.parse(readFileSync("benchmark/consultas.json", "utf-8"));
const VARIANTES = [
  ["hibrido", false],
  ["hibrido_reordenado", true],
] as const;

const linhas: Record<string, { id: number; pos: number | null; top5: number }[]> = {};
for (const [nome, reordenar] of VARIANTES) {
  linhas[nome] = [];
  for (const c of consultas) {
    const r = await buscarVetorial(c.consulta, "hibrido", { limite: 10, reordenar });
    const marcas = r.resultados.map((x) => correto(x.medicamento, c.gabarito));
    const pos = marcas.indexOf(true);
    linhas[nome].push({ id: c.id, pos: pos >= 0 ? pos + 1 : null, top5: marcas.slice(0, 5).filter(Boolean).length });
  }
}

const agregar = (filtro: (c: ConsultaTeste) => boolean) =>
  Object.fromEntries(
    VARIANTES.map(([nome]) => {
      const ids = new Set(consultas.filter(filtro).map((c) => c.id));
      const ms = linhas[nome].filter((l) => ids.has(l.id));
      return [
        nome,
        {
          consultas: ms.length,
          acerto_top5: ms.filter((m) => m.pos !== null && m.pos <= 5).length / ms.length,
          mrr_top10: ms.reduce((s, m) => s + (m.pos ? 1 / m.pos : 0), 0) / ms.length,
          precisao_top5: ms.reduce((s, m) => s + m.top5, 0) / (5 * ms.length),
        },
      ];
    }),
  );

const resultado = {
  gerado_em: new Date().toISOString(),
  nota: "Reordenação criada depois do benchmark; avaliação separada, não substitui benchmark/resultados.json.",
  sem_desenvolvimento: agregar((c) => !c.desenvolvimento),
  todas: agregar(() => true),
  por_consulta: consultas.map((c) => ({
    id: c.id,
    consulta: c.consulta,
    hibrido: linhas.hibrido.find((l) => l.id === c.id)!.pos,
    hibrido_reordenado: linhas.hibrido_reordenado.find((l) => l.id === c.id)!.pos,
  })),
};
writeFileSync("benchmark/reordenacao.json", JSON.stringify(resultado, null, 2));

for (const [rotulo, ag] of [["sem desenvolvimento", resultado.sem_desenvolvimento], ["todas", resultado.todas]] as const) {
  console.log(`-- ${rotulo}`);
  for (const [nome] of VARIANTES) {
    const a = ag[nome];
    console.log(`${nome.padEnd(20)} acerto@5 ${(a.acerto_top5 * 100).toFixed(0)}% | MRR@10 ${a.mrr_top10.toFixed(3)} | precisão@5 ${a.precisao_top5.toFixed(3)}`);
  }
}
const mudaram = resultado.por_consulta.filter((p) => p.hibrido !== p.hibrido_reordenado);
console.log(`\nConsultas em que a posição do 1º correto mudou: ${mudaram.length}`);
for (const p of mudaram) console.log(`  #${p.id} ${p.consulta}: ${p.hibrido ?? "-"} -> ${p.hibrido_reordenado ?? "-"}`);
