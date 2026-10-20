// Reordenação dos resultados do híbrido pelo que a pessoa escreveu de forma explícita.
//
// Motivação (consulta "pregabalina 75 mg 30 capsulas"): o ramo denso não conhece nomes raros e
// coloca a furosemida no topo; o lexical acerta. Na fusão RRF os dois primeiros empatam e a lista
// sai intercalada. Além disso, dosagem e quantidade digitadas não pesam em nenhum ramo.
//
// Regras, em ordem de prioridade (o escore RRF só desempata dentro de cada nível):
//  1. nome: a consulta contém uma palavra que é nome de produto ou de princípio ativo do item
//     (palavras de sal, descritores químicos e formas farmacêuticas não contam)
//  2. apresentação: quantos itens explícitos batem (dosagem "75 mg", quantidade "30 cápsulas",
//     forma "cápsula")
// Quando a consulta não tem nome nem apresentação (linguagem coloquial), a ordem não muda.

import { semAcento, type MedicamentoResumo } from "./normalizacao";

// Vocabulário que não identifica um medicamento: sais, descritores de hidratação e de forma.
const NAO_IDENTIFICA = new Set(
  (
    "cloridrato dicloridrato bromidrato maleato sodio sodico sodica potassio potassico potassica calcio calcico calcica " +
    "magnesio acido sulfato acetato fosfato besilato citrato succinato fumarato hemifumarato tartarato hemitartarato " +
    "dipropionato propionato valerato oxalato carbonato nitrato mesilato dimesilato cloreto hidroxido lactato gluconato " +
    "butilbrometo brometo bissulfato monoidratado monoidratada diidratado diidratada dihidratado dihidratada " +
    "trihidratado trihidratada hemihidratado hemihidratada anidro anidra base " +
    "comprimido comprimidos capsula capsulas dragea drageas xarope gotas pomada creme solucao suspensao spray " +
    "injetavel infantil adulto pediatrico oral topico gel locao generico similar referencia remedio medicamento"
  ).split(" "),
);

const FORMAS: [RegExp, RegExp][] = [
  [/^(capsula|capsulas|caps|cap)$/, /\bCAP\b/],
  [/^(comprimido|comprimidos|comp|cp|cpr)$/, /\b(COM|DRG)\b/],
  [/^(dragea|drageas)$/, /\b(DRG|COM)\b/],
  [/^xarope$/, /\bXPE\b/],
  [/^gotas?$/, /\bGOT\b/],
  [/^pomada$/, /\bPOM\b/],
  [/^creme$/, /\bCREM\b/],
  [/^(suspensao)$/, /\bSUS\b/],
  [/^(injetavel|ampola)$/, /\b(INJ|LIOF)\b/],
  [/^spray$/, /\bSPR\b/],
  [/^gel$/, /\bGEL\b/],
];

const UNIDADE_DOSE: Record<string, string> = { mg: "MG", g: "G", mcg: "MCG", ug: "MCG", ml: "ML", ui: "UI", "%": "%" };

const DOSE = /(\d+(?:\.\d+)?)\s*(mg|mcg|ug|ml|ui|g|%)(?:\s*\/\s*(ml|g|dose))?(?![a-z])/g;

function formatarDose(n: number, unidade: string, por?: string): string {
  const u = UNIDADE_DOSE[unidade];
  // g vira mg, como na dosagem canônica ("1 G" -> "1000 MG")
  const [valor, un] = u === "G" ? [n * 1000, "MG"] : [n, u];
  const texto = `${Number(valor.toFixed(4))} ${un}`;
  return por ? `${texto}/${por.toUpperCase()}` : texto;
}

/**
 * Dose digitada no filtro, no formato canônico da base: "75" e "75 mg" -> "75 MG";
 * "1 g" -> "1000 MG"; "0,5 mg/ml" -> "0.5 MG/ML". Sem unidade, assume mg.
 */
export function doseCanonica(texto: string): string | null {
  const t = semAcento(texto.toLowerCase()).replace(/,/g, ".").trim();
  if (!t) return null;
  if (/^\d+(?:\.\d+)?$/.test(t)) return formatarDose(Number(t), "mg");
  const m = [...t.matchAll(DOSE)][0];
  return m ? formatarDose(Number(m[1]), m[2], m[3]) : null;
}

function palavras(texto: string): string[] {
  return semAcento(texto.toLowerCase()).replace(/-/g, "").split(/[^a-z0-9%]+/).filter(Boolean);
}

export interface IntencaoConsulta {
  nomes: string[];
  doses: string[];
  quantidade: number | null;
  /** Números sem unidade ("paracetamol 750"): valem como dose em mg ou, se não bater, quantidade. */
  numerosSoltos: number[];
  /** Testadas contra forma + apresentação (gotas aparecem como "GOT" na apresentação). */
  formas: RegExp[];
  generico: boolean;
}

const QUANTIDADE = /(?:\bx\s*|\bcom\s+)?(\d+)\s*(capsulas?|caps|comprimidos?|comp|drageas?|unidades?|envelopes?|saches?)\b/;

/** O que a consulta pede de forma explícita: nomes, doses ("75 MG"), quantidade e forma. */
export function lerIntencao(consulta: string): IntencaoConsulta {
  const texto = semAcento(consulta.toLowerCase()).replace(/,/g, ".");
  const doses = [...texto.matchAll(DOSE)].map((m) => formatarDose(Number(m[1]), m[2], m[3]));
  const q = texto.match(QUANTIDADE) ?? texto.match(/\bx\s*(\d+)\b/);
  const quantidade = q ? Number(q[1]) : null;
  // O que sobra depois de tirar doses com unidade e a quantidade explícita.
  const resto = texto.replace(DOSE, " ").replace(QUANTIDADE, " ").replace(/\bx\s*\d+\b/, " ");
  const numerosSoltos = [...resto.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((m) => Number(m[1]));
  const ps = palavras(consulta);
  const formas = FORMAS.filter(([re]) => ps.some((p) => re.test(p))).map(([, f]) => f);
  const nomes = ps.filter((p) => p.length >= 4 && !/^\d/.test(p) && !NAO_IDENTIFICA.has(p));
  const generico = ps.some((p) => /^genericos?$/.test(p));
  return { nomes, doses, quantidade, numerosSoltos, formas, generico };
}

function palavrasDoItem(m: Pick<MedicamentoResumo, "produto" | "substancia">): Set<string> {
  return new Set(palavras(`${m.produto} ${m.substancia.join(" ")}`));
}

interface Reordenavel {
  id: number;
  score: number;
  medicamento: Pick<
    MedicamentoResumo,
    "produto" | "substancia" | "dosagem" | "forma" | "apresentacao" | "quantidade_num" | "generico"
  >;
}

/** Reordena mantendo a ordem do RRF dentro de cada nível de correspondência. */
export function reordenar<T extends Reordenavel>(consulta: string, itens: T[]): T[] {
  const i = lerIntencao(consulta);
  const algoExplicito =
    i.nomes.length || i.doses.length || i.quantidade !== null || i.numerosSoltos.length || i.formas.length || i.generico;
  if (!algoExplicito) return itens;
  const nota = (x: T) => {
    const m = x.medicamento;
    const doItem = palavrasDoItem(m);
    const nome = i.nomes.some((n) => doItem.has(n)) ? 1 : 0;
    const dosesItem = m.dosagem.split(" + ");
    const dose = i.doses.length && i.doses.every((d) => dosesItem.includes(d)) ? 1 : 0;
    const qtd = i.quantidade !== null && m.quantidade_num === i.quantidade ? 1 : 0;
    const solto = i.numerosSoltos.some((n) => dosesItem.includes(`${n} MG`) || m.quantidade_num === n) ? 1 : 0;
    const textoForma = `${m.forma} ${semAcento(m.apresentacao.toUpperCase())}`;
    const forma = i.formas.length && i.formas.some((f) => f.test(textoForma)) ? 1 : 0;
    const generico = i.generico && m.generico ? 1 : 0;
    return { nome, apresentacao: dose + qtd + solto + forma + generico };
  };
  const notas = new Map(itens.map((x) => [x.id, nota(x)]));
  return [...itens].sort((a, b) => {
    const na = notas.get(a.id)!;
    const nb = notas.get(b.id)!;
    return nb.nome - na.nome || nb.apresentacao - na.apresentacao || b.score - a.score || a.id - b.id;
  });
}
