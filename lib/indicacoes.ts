// Indicação escrita na consulta: reconhece sintomas e problemas de saúde em linguagem leiga e os
// traduz em classes terapêuticas da Lista CMED. Usado só pelo site (híbrido com reordenação).
//
// Motivação (consultas "ânsia de vômito", "vômito", "azia depois de comer"): o ramo denso põe no topo
// itens sem relação (BENEFIX, LUGANO), o lexical acerta só quando a consulta é a palavra exata do
// dicionário, e a fusão RRF empata o 1º de cada ramo. Em "azia depois de comer" nenhum dos 100
// candidatos era antiácido.
//
// Fontes dos conceitos:
//  - data/dicionario-indicacoes.json: cada termo popular vale para as classes e substâncias em que
//    aparece. O código da classe vale como prefixo ("N2C" cobre N2C1, N2C2 e N2C9).
//  - data/expansao-consulta.json: sinônimos leigos e problemas que o dicionário não cobre.
//
// A busca usa os conceitos de duas formas: um terceiro ramo de candidatos, filtrado pelas classes
// (lib/busca.ts), e um nível de ordenação logo abaixo do nome (lib/reordenacao.ts).

import classesCmed from "../data/classes-terapeuticas.json";
import dicionario from "../data/dicionario-indicacoes.json";
import expansao from "../data/expansao-consulta.json";
import { PALAVRAS_VAZIAS } from "./lexical";
import { codigoClasse, semAcento } from "./normalizacao";

interface Conceito {
  termo: string;
  palavras: string[];
  /** Códigos de classe, ou prefixos deles. */
  classes: Set<string>;
  /** Trechos de nome de substância (maiúsculas, sem acento), como no dicionário. */
  substancias: Set<string>;
}

/** Sem plural e sem "e" final, para que "vômitos", "gases" e "vermes" batam com o singular. */
function radical(p: string): string {
  return p.length >= 4 ? p.replace(/s$/, "").replace(/e$/, "") : p;
}

// A forma farmacêutica fica com a regra de apresentação da reordenação: "xarope para tosse" é o
// conceito "tosse" (expectorantes e antitussígenos), não só os antitussígenos em que o dicionário o pôs.
const FORMAS = new Set("xarope gota pomada creme spray comprimido capsula solucao suspensao gel".split(" ").map(radical));

function palavrasConsulta(texto: string): string[] {
  return semAcento(texto.toLowerCase())
    .replace(/-/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p && !PALAVRAS_VAZIAS.has(p))
    .map(radical)
    .filter((p) => !FORMAS.has(p));
}

const CONCEITOS: Conceito[] = (() => {
  const porTermo = new Map<string, Conceito>();
  const conceito = (termo: string) => {
    const palavras = palavrasConsulta(termo);
    const chave = palavras.join(" ");
    if (!porTermo.has(chave)) porTermo.set(chave, { termo, palavras, classes: new Set(), substancias: new Set() });
    return porTermo.get(chave)!;
  };
  for (const [codigo, termos] of Object.entries(dicionario.classes)) for (const t of termos) conceito(t).classes.add(codigo);
  for (const [trecho, termos] of Object.entries(dicionario.substancias)) for (const t of termos) conceito(t).substancias.add(trecho);
  for (const e of expansao.expressoes) for (const t of e.expressoes) for (const c of e.classes) conceito(t).classes.add(c);
  return [...porTermo.values()].filter((c) => c.palavras.length);
})();

/** Posições da consulta em que o conceito aparece, na ordem, com no máximo uma palavra no meio. */
function posicoes(consulta: string[], conceito: string[]): number[] | null {
  for (let inicio = 0; inicio < consulta.length; inicio++) {
    if (consulta[inicio] !== conceito[0]) continue;
    const achadas = [inicio];
    let i = inicio;
    for (const p of conceito.slice(1)) {
      const j = consulta.indexOf(p, i + 1);
      if (j < 0 || j - i > 2) break;
      achadas.push(j);
      i = j;
    }
    if (achadas.length === conceito.length) return achadas;
  }
  return null;
}

/**
 * Conceitos presentes na consulta. Quando um está contido em outro mais longo ("dor" dentro de
 * "dor de estômago"), fica só o mais longo.
 */
export function conceitosDaConsulta(consulta: string): Conceito[] {
  const ps = palavrasConsulta(consulta);
  const achados = CONCEITOS.flatMap((c) => {
    const pos = posicoes(ps, c.palavras);
    return pos ? [{ c, pos: new Set(pos) }] : [];
  });
  return achados
    .filter((a) => !achados.some((b) => b.pos.size > a.pos.size && [...a.pos].every((p) => b.pos.has(p))))
    .map((a) => a.c);
}

/** Nomes completos das classes da Lista CMED cobertas pelos conceitos, para o filtro do Qdrant. */
export function classesDosConceitos(conceitos: Conceito[]): string[] {
  const prefixos = conceitos.flatMap((c) => [...c.classes]);
  return classesCmed.filter((nome) => {
    const codigo = codigoClasse(nome) ?? "";
    return prefixos.some((p) => codigo.startsWith(p));
  });
}

/** Quantos dos conceitos o item atende, pela classe ou pela substância. */
export function conceitosAtendidos(
  conceitos: Conceito[],
  m: { classe: string | null; substancia: string[] },
): number {
  const codigo = codigoClasse(m.classe) ?? "";
  const substancias = m.substancia.map((s) => semAcento(s.toUpperCase()));
  return conceitos.filter(
    (c) =>
      (codigo && [...c.classes].some((p) => codigo.startsWith(p))) ||
      [...c.substancias].some((t) => {
        const re = new RegExp(`(^|[^A-Z])${t}([^A-Z]|$)`);
        return substancias.some((s) => re.test(s));
      }),
  ).length;
}
