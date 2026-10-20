// Confere se os cinco motores devolvem exatamente o mesmo top 10 em execuções repetidas.
// Uso: npx tsx --env-file-if-exists=.env.local scripts/verificar-determinismo.ts [execuções]

import { readFileSync } from "node:fs";
import { buscarVetorial } from "../lib/busca";
import { embedConsulta } from "../lib/embeddings";
import type { ConsultaTeste } from "../lib/gabarito";
import { buscarFullText, buscarIlike, pool } from "../lib/postgres";

const EXECUCOES = Number(process.argv[2] ?? 3);
const MOTORES = ["denso_base", "denso", "hibrido", "ilike", "fulltext"] as const;
const { consultas }: { consultas: ConsultaTeste[] } = JSON.parse(readFileSync("benchmark/consultas.json", "utf-8"));

async function ids(motor: (typeof MOTORES)[number], q: string): Promise<string> {
  const r =
    motor === "ilike" ? await buscarIlike(q, { limite: 10 })
    : motor === "fulltext" ? await buscarFullText(q, { limite: 10 })
    : await buscarVetorial(q, motor, { limite: 10, gerarVetor: embedConsulta });
  return r.resultados.map((x) => x.id).join(",");
}

const divergencias: Record<string, number> = Object.fromEntries(MOTORES.map((m) => [m, 0]));
for (const c of consultas) {
  for (const motor of MOTORES) {
    const vistos = new Set<string>();
    for (let i = 0; i < EXECUCOES; i++) vistos.add(await ids(motor, c.consulta));
    if (vistos.size > 1) {
      divergencias[motor]++;
      console.log(`#${c.id} ${motor}: ${vistos.size} ordens diferentes em ${EXECUCOES} execuções`);
    }
  }
}
console.log(`\n${consultas.length} consultas x ${EXECUCOES} execuções. Consultas com top 10 divergente por motor:`, divergencias);
process.exitCode = Object.values(divergencias).some((n) => n > 0) ? 1 : 0;
await pool().end();
