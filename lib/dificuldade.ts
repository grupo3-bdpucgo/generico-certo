// Medidas de dificuldade de cada consulta do benchmark, independentes dos motores.

import { PALAVRAS_VAZIAS } from "./lexical";
import { semAcento, type DicionarioIndicacoes } from "./normalizacao";

/** Palavras sem acento e em minúsculas; hifenizadas contam como uma só ("anti-inflamatório"). */
export function palavras(texto: string): string[] {
  return semAcento(texto.toLowerCase())
    .replace(/-/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Palavras de conteúdo da consulta (sem palavras vazias) que aparecem em algum termo do dicionário. */
export function palavrasNoDicionario(consulta: string, dic: DicionarioIndicacoes): string[] {
  const vocabulario = new Set(
    [...Object.values(dic.classes), ...Object.values(dic.substancias)].flat().flatMap(palavras),
  );
  return [...new Set(palavras(consulta).filter((p) => !PALAVRAS_VAZIAS.has(p) && vocabulario.has(p)))];
}

/**
 * Probabilidade de um motor que sorteasse k resultados distintos ao acaso, entre N registros
 * elegíveis, acertar pelo menos um dos K válidos: 1 - C(N-K, k) / C(N, k).
 */
export function probabilidadeAcaso(N: number, K: number, k = 5): number {
  if (K <= 0) return 0;
  if (N - K < k) return 1;
  let erraTodos = 1;
  for (let i = 0; i < k; i++) erraTodos *= (N - K - i) / (N - i);
  return 1 - erraTodos;
}
