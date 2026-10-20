// Auditoria da equivalência entre apresentações (data/dados.json), sem acessar os bancos.
// Procura casos em que equivalentes podem estar separados por diferenças de escrita da CMED ou por
// falhas de leitura da apresentação. Gera docs/auditoria-equivalencia.md para revisão do grupo.
// Uso: npx tsx scripts/auditar-equivalencia.ts

import { readFileSync, writeFileSync } from "node:fs";
import type { Medicamento } from "../lib/normalizacao";

const dados: Medicamento[] = JSON.parse(readFileSync("data/dados.json", "utf-8")).filter((m: Medicamento) => !m.restricao_hospitalar);
const chaveSubst = (m: Medicamento) => m.chave_equivalencia.split(" | ")[0];

let md = `# Auditoria da equivalência\n\nGerado por scripts/auditar-equivalencia.ts em ${new Date().toLocaleString("pt-BR")}, sobre ${dados.length} apresentações elegíveis (sem uso hospitalar).\n`;
const log = (s: string) => {
  md += `${s}\n`;
  console.log(s);
};

// ---------------------------------------------------------------- 1. mesma marca, nomes diferentes
log("\n## 1. Mesma marca e laboratório com mais de um nome de substância\n");
const porMarca = new Map<string, Set<string>>();
for (const m of dados) {
  const k = `${m.produto} | ${m.laboratorio}`;
  if (!porMarca.has(k)) porMarca.set(k, new Set());
  porMarca.get(k)!.add(chaveSubst(m));
}
const palavrasDe = (s: string) => new Set(s.split(/[^A-Z0-9]+/).filter((p) => p.length >= 4));
const marcasSuspeitas = [...porMarca].filter(([, subs]) => {
  if (subs.size < 2) return false;
  // Suspeito quando os nomes compartilham alguma palavra de 4+ letras ou têm o mesmo número de substâncias
  const lista = [...subs];
  return lista.some((a, i) =>
    lista.slice(i + 1).some((b) => {
      const pa = palavrasDe(a), pb = palavrasDe(b);
      const comuns = [...pa].filter((p) => pb.has(p)).length;
      return comuns > 0 || a.split(" + ").length === b.split(" + ").length;
    }),
  );
});
log(`${marcasSuspeitas.length} marcas com mais de um conjunto de substâncias que se parecem:\n`);
for (const [marca, subs] of marcasSuspeitas) log(`- **${marca}**: ${[...subs].map((s) => `\`${s}\``).join(" · ")}`);

// ---------------------------------------------------------------- 2. nomes quase iguais
log("\n## 2. Nomes de substância que diferem só por espaço, hífen ou pontuação\n");
const compacto = (s: string) => s.replace(/[^A-Z0-9]/g, "");
const porCompacto = new Map<string, Set<string>>();
const ocorrencias = new Map<string, number>();
for (const m of dados) {
  // Nomes como estão na chave de equivalência (depois de sinônimos e unificação de grafia).
  for (const s of chaveSubst(m).split(" + ")) {
    const c = compacto(s);
    if (!porCompacto.has(c)) porCompacto.set(c, new Set());
    porCompacto.get(c)!.add(s);
    ocorrencias.set(s, (ocorrencias.get(s) ?? 0) + 1);
  }
}
const variantesEscrita = [...porCompacto.values()].filter((v) => v.size > 1);
log(`${variantesEscrita.length} grupos:\n`);
for (const v of variantesEscrita) log(`- ${[...v].map((s) => `\`${s}\` (${ocorrencias.get(s)})`).join(" · ")}`);

log("\n### 2b. Nomes parecidos (distância de edição até 2, palavras de 6+ letras)\n");
function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const nomes = [...ocorrencias.keys()].filter((s) => s.length >= 6);
const parecidos: [string, string, number][] = [];
for (let i = 0; i < nomes.length; i++)
  for (let j = i + 1; j < nomes.length; j++) {
    const a = nomes[i], b = nomes[j];
    if (compacto(a) === compacto(b)) continue;
    const dist = distancia(a, b);
    if (dist <= 2) parecidos.push([a, b, dist]);
  }
log(`${parecidos.length} pares (muitos são substâncias diferentes de verdade, como sais distintos; revisar um a um):\n`);
for (const [a, b, dist] of parecidos) log(`- \`${a}\` (${ocorrencias.get(a)}) ~ \`${b}\` (${ocorrencias.get(b)}), distância ${dist}`);

// ---------------------------------------------------------------- 3. formas diferentes
log("\n## 3. Mesma substância, dose e quantidade com formas escritas de jeitos diferentes\n");
const porSemForma = new Map<string, Map<string, Medicamento[]>>();
for (const m of dados) {
  const [subs, dose, forma, qtd] = m.chave_equivalencia.split(" | ");
  const k = `${subs} | ${dose} | ${qtd}`;
  if (!porSemForma.has(k)) porSemForma.set(k, new Map());
  const formas = porSemForma.get(k)!;
  if (!formas.has(forma)) formas.set(forma, []);
  formas.get(forma)!.push(m);
}
const paresForma = new Map<string, number>();
for (const formas of porSemForma.values()) {
  if (formas.size < 2) continue;
  const lista = [...formas.keys()].sort();
  for (let i = 0; i < lista.length; i++)
    for (let j = i + 1; j < lista.length; j++) {
      const k = `${lista[i]}  ×  ${lista[j]}`;
      paresForma.set(k, (paresForma.get(k) ?? 0) + 1);
    }
}
const pares = [...paresForma].sort((a, b) => b[1] - a[1]);
log(`${pares.length} pares de formas que separam grupos com mesma substância, dose e quantidade (vezes em que ocorrem):\n`);
for (const [par, n] of pares) log(`- ${n} × \`${par}\``);

// ---------------------------------------------------------------- 4. leitura da apresentação
log("\n## 4. Apresentações em que a leitura falhou\n");
const semDose = dados.filter((m) => !m.dosagem);
const semQtd = dados.filter((m) => !m.quantidade);
const formaEstranha = dados.filter((m) => !m.forma || /^[^A-Z]/.test(m.forma));
log(`- sem dosagem: ${semDose.length}`);
log(`- sem quantidade: ${semQtd.length}`);
log(`- forma vazia ou começando com símbolo: ${formaEstranha.length}`);
for (const m of formaEstranha.slice(0, 30)) log(`  - ${m.produto}: \`${m.apresentacao}\` → forma \`${m.forma}\``);

// ---------------------------------------------------------------- 5. referência sem equivalente
log("\n## 5. Referência sem nenhum equivalente na mesma caixa, mas com a mesma substância em outra apresentação\n");
const tamanhoGrupo = new Map<string, number>();
for (const m of dados) tamanhoGrupo.set(m.chave_equivalencia, (tamanhoGrupo.get(m.chave_equivalencia) ?? 0) + 1);
const outrosDaSubst = new Map<string, Medicamento[]>();
for (const m of dados) {
  const k = chaveSubst(m);
  if (!outrosDaSubst.has(k)) outrosDaSubst.set(k, []);
  outrosDaSubst.get(k)!.push(m);
}
const refSozinha = dados.filter(
  (m) => m.selo === "Referência" && tamanhoGrupo.get(m.chave_equivalencia) === 1 &&
    outrosDaSubst.get(chaveSubst(m))!.some((o) => o.laboratorio !== m.laboratorio && o.dosagem === m.dosagem),
);
log(`${refSozinha.length} apresentações de referência sozinhas na caixa, embora outro laboratório tenha a mesma substância e dose (a diferença está na forma ou na quantidade):\n`);
for (const m of refSozinha.slice(0, 40)) {
  const outros = outrosDaSubst.get(chaveSubst(m))!.filter((o) => o.laboratorio !== m.laboratorio && o.dosagem === m.dosagem);
  const formas = [...new Set(outros.map((o) => `${o.chave_equivalencia.split(" | ")[2]} x${o.quantidade}`))].slice(0, 4);
  log(`- ${m.produto} ${m.dosagem} \`${m.chave_equivalencia.split(" | ").slice(2).join(" | ")}\` · outros: ${formas.map((f) => `\`${f}\``).join(", ")}`);
}

writeFileSync("docs/auditoria-equivalencia.md", md);
console.log("\nGerado docs/auditoria-equivalencia.md");
