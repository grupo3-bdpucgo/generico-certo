// Regera os três vetores (denso, denso_base e lexical) só dos pontos cujo texto mudou depois de uma
// correção na normalização, e atualiza data/vetores-base.json. Evita reingerir a base inteira.
// Uso: npx tsx --env-file-if-exists=.env.local scripts/regerar-vetores.ts dados-antigos.json
//      (compara com data/dados.json e regera os ids com texto_embedding ou texto_enriquecido diferentes)

import { readFileSync, writeFileSync } from "node:fs";
import { embedLote } from "../lib/embeddings";
import { textoLexical, vetorTrigramasDocumento } from "../lib/lexical";
import { COLLECTION, VETOR, qdrant } from "../lib/qdrant";
import type { Medicamento } from "../lib/normalizacao";

const antigos: Medicamento[] = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const dados: Medicamento[] = JSON.parse(readFileSync("data/dados.json", "utf-8"));
const porId = new Map(antigos.map((m) => [m.id, m]));
const alvo = dados.filter((m) => {
  const a = porId.get(m.id);
  return !a || a.texto_embedding !== m.texto_embedding || a.texto_enriquecido !== m.texto_enriquecido || textoLexical(a) !== textoLexical(m);
});
if (!alvo.length) {
  console.log("Nenhum texto mudou.");
  process.exit(0);
}

const densos = await embedLote(alvo.map((m) => m.texto_enriquecido));
const bases = await embedLote(alvo.map((m) => m.texto_embedding));
await qdrant().updateVectors(COLLECTION, {
  wait: true,
  points: alvo.map((m, i) => ({
    id: m.id,
    vector: { [VETOR.denso]: densos[i], [VETOR.base]: bases[i], [VETOR.lexical]: vetorTrigramasDocumento(textoLexical(m)) },
  })),
});
const arquivoBase = JSON.parse(readFileSync("data/vetores-base.json", "utf-8"));
alvo.forEach((m, i) => (arquivoBase[m.id] = bases[i]));
writeFileSync("data/vetores-base.json", JSON.stringify(arquivoBase));
console.log(`Vetores regerados em ${alvo.length} pontos: ${alvo.map((m) => `${m.id} ${m.produto}`).join(", ")}`);
