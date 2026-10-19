// Comparação de preços entre equivalentes (papel: Backend 2).
// Mesma caixa: mesma chave_equivalencia (substâncias + dosagem + forma + quantidade), ordenada por PMC.
// Qualquer caixa: mesma chave_equivalencia_ampla com outra quantidade, ordenada por preço por unidade.
// A economia é sempre calculada em relação ao medicamento escolhido pelo usuário.

import { COLLECTION, qdrant } from "./qdrant";
import type { Medicamento } from "./normalizacao";

export type MedicamentoComId = Medicamento;

export interface Economia {
  reais: number;
  fracao: number;
}

export interface ItemComparacao {
  medicamento: MedicamentoComId;
  /** Positiva quando o item é mais barato que o escolhido. */
  economia: Economia | null;
}

export interface Comparacao {
  base: MedicamentoComId;
  mesmaCaixa: ItemComparacao[];
  qualquerCaixa: ItemComparacao[];
  /** Equivalente mais barato da mesma caixa, quando mais barato que o escolhido. */
  melhorMesmaCaixa: ItemComparacao | null;
  /** Menor preço por unidade entre todas as caixas, quando mais barato que o escolhido. */
  melhorPorUnidade: ItemComparacao | null;
}

const LIMITE_GRUPO = 300;
// Os textos de indexação não são exibidos; ficam fora da resposta.
const PAYLOAD = { exclude: ["texto_embedding", "texto_enriquecido", "termos_populares"] };

function paraMedicamento(p: { id: string | number; payload?: Record<string, unknown> | null }): MedicamentoComId {
  return { id: Number(p.id), ...(p.payload as unknown as Omit<Medicamento, "id">) };
}

export async function obterMedicamento(id: number): Promise<MedicamentoComId | null> {
  const [p] = await qdrant().retrieve(COLLECTION, { ids: [id], with_payload: PAYLOAD, with_vector: false });
  return p ? paraMedicamento(p) : null;
}

async function grupo(campo: "chave_equivalencia" | "chave_equivalencia_ampla", valor: string) {
  const { points } = await qdrant().scroll(COLLECTION, {
    filter: {
      must: [
        { key: campo, match: { value: valor } },
        { key: "restricao_hospitalar", match: { value: false } },
      ],
    },
    limit: LIMITE_GRUPO,
    with_payload: PAYLOAD,
    with_vector: false,
  });
  return points.map(paraMedicamento);
}

function economia(base: number | null, item: number | null): Economia | null {
  if (base === null || item === null || base <= 0) return null;
  return { reais: base - item, fracao: (base - item) / base };
}

export async function compararEquivalentes(id: number): Promise<Comparacao | null> {
  const base = await obterMedicamento(id);
  if (!base) return null;

  const [mesma, ampla] = await Promise.all([
    grupo("chave_equivalencia", base.chave_equivalencia),
    grupo("chave_equivalencia_ampla", base.chave_equivalencia_ampla),
  ]);

  const mesmaCaixa = mesma
    .sort((a, b) => a.pmc - b.pmc || a.id - b.id)
    .map((m) => ({ medicamento: m, economia: economia(base.pmc, m.pmc) }));

  const idsMesma = new Set(mesma.map((m) => m.id));
  const qualquerCaixa = ampla
    .filter((m) => !idsMesma.has(m.id) && m.preco_por_unidade !== null)
    .sort((a, b) => a.preco_por_unidade! - b.preco_por_unidade! || a.id - b.id)
    .map((m) => ({ medicamento: m, economia: economia(base.preco_por_unidade, m.preco_por_unidade) }));

  const maisBarato = (xs: ItemComparacao[]) => {
    const melhor = xs.find((x) => x.medicamento.id !== base.id);
    return melhor && melhor.economia && melhor.economia.reais > 0.005 ? melhor : null;
  };
  const todasPorUnidade = [...mesmaCaixa, ...qualquerCaixa]
    .filter((x) => x.medicamento.preco_por_unidade !== null)
    .map((x) => ({ ...x, economia: economia(base.preco_por_unidade, x.medicamento.preco_por_unidade) }))
    .sort((a, b) => a.medicamento.preco_por_unidade! - b.medicamento.preco_por_unidade!);

  return {
    base,
    mesmaCaixa,
    qualquerCaixa,
    melhorMesmaCaixa: maisBarato(mesmaCaixa),
    melhorPorUnidade: maisBarato(todasPorUnidade),
  };
}
