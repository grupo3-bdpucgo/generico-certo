// Vetor esparso de trigramas de caracteres (camada lexical da busca híbrida).
// Cada trigrama vira um índice fixo (alfabeto de 37 símbolos, 37^3 = 50.653 dimensões possíveis),
// então não há vocabulário a manter. O peso IDF é aplicado pelo próprio Qdrant (modifier "idf").
// No documento cada trigrama vale 1/sqrt(n), sendo n o número de trigramas distintos: sem essa
// normalização, textos longos (vacinas com dezenas de sorotipos) somavam pontos em qualquer consulta.
// Na consulta cada trigrama vale 1. "não" é mantido de propósito ("antialérgico que não dá sono").

import { semAcento } from "./normalizacao";

export interface VetorEsparso {
  indices: number[];
  values: number[];
}

export const PALAVRAS_VAZIAS = new Set(
  "a o e de da do das dos que pra para pro com sem em no na um uma me meu minha por remedio remedios medicamento".split(" "),
);

const ALFABETO = " abcdefghijklmnopqrstuvwxyz0123456789";
const BASE = ALFABETO.length;

function normalizar(texto: string): string[] {
  return semAcento(texto.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((p) => p && !PALAVRAS_VAZIAS.has(p));
}

function indiceTrigrama(t: string): number {
  return ALFABETO.indexOf(t[0]) * BASE * BASE + ALFABETO.indexOf(t[1]) * BASE + ALFABETO.indexOf(t[2]);
}

function trigramas(texto: string): number[] {
  const conjunto = new Set<number>();
  for (const palavra of normalizar(texto)) {
    const p = ` ${palavra} `;
    for (let i = 0; i + 3 <= p.length; i++) conjunto.add(indiceTrigrama(p.slice(i, i + 3)));
  }
  return [...conjunto].sort((a, b) => a - b);
}

/** "dorflex" -> trigramas " do", "dor", "orf", "rfl", "fle", "lex", "ex ". */
export function vetorTrigramasDocumento(texto: string): VetorEsparso {
  const indices = trigramas(texto);
  const peso = 1 / Math.sqrt(indices.length || 1);
  return { indices, values: indices.map(() => peso) };
}

export function vetorTrigramasConsulta(texto: string): VetorEsparso {
  const indices = trigramas(texto);
  return { indices, values: indices.map(() => 1) };
}

/** Texto da camada lexical: nome comercial, substâncias e termos populares do dicionário. */
export function textoLexical(m: { produto: string; substancia: string[]; termos_populares: string[] }): string {
  return `${m.produto} ${m.substancia.join(" ")} ${m.termos_populares.join(" ")}`;
}
