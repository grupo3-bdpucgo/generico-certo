// Formatação para a interface: dinheiro, porcentagem, quantidade por extenso e rótulos.

import { expandirForma, semAcento } from "./normalizacao";

const REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export const brl = (n: number) => REAIS.format(n);
export const pct = (fracao: number, casas = 0) =>
  `${(fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;
export const numero = (n: number) => NUMERO.format(n);

/** Preço por unidade com mais casas quando é pequeno: "R$ 0,6040". */
export function brlUnidade(n: number): string {
  return n < 1
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n)
    : brl(n);
}

const PLURAL: Record<string, string> = {
  comprimido: "comprimidos", "cápsula": "cápsulas", "drágea": "drágeas", pastilha: "pastilhas",
  "supositório": "supositórios", goma: "gomas", "frasco-ampola": "frascos-ampola", ampola: "ampolas",
  envelope: "envelopes", seringa: "seringas", bolsa: "bolsas", frasco: "frascos", carpule: "carpules",
  strip: "strips", dose: "doses", unidade: "unidades",
};

// Qualificadores da forma farmacêutica, no singular e no plural, por gênero do substantivo.
const QUALIFICADORES: [RegExp, { m: [string, string]; f: [string, string] }][] = [
  [/\bREV\b/, { m: ["revestido", "revestidos"], f: ["revestida", "revestidas"] }],
  [/\bEFERV\b|\bEFEV\b/, { m: ["efervescente", "efervescentes"], f: ["efervescente", "efervescentes"] }],
  [/\bMAST\b/, { m: ["mastigável", "mastigáveis"], f: ["mastigável", "mastigáveis"] }],
  [/\bORODISP\b/, { m: ["orodispersível", "orodispersíveis"], f: ["orodispersível", "orodispersíveis"] }],
  [/\bDISPER\b/, { m: ["dispersível", "dispersíveis"], f: ["dispersível", "dispersíveis"] }],
  [/\bDURA\b/, { m: ["duro", "duros"], f: ["dura", "duras"] }],
  [/\bMOLE\b/, { m: ["mole", "moles"], f: ["mole", "moles"] }],
  [/\bLIB PROL\b/, { m: ["de liberação prolongada", "de liberação prolongada"], f: ["de liberação prolongada", "de liberação prolongada"] }],
  [/\bLIB RETARD\b/, { m: ["de liberação retardada", "de liberação retardada"], f: ["de liberação retardada", "de liberação retardada"] }],
];
const FEMININOS = new Set(["cápsula", "drágea", "pastilha", "goma", "ampola", "seringa", "bolsa", "dose", "unidade"]);
const MEDIDAS = new Set(["mL", "L", "g", "mg"]);

/** "20 comprimidos revestidos", "100 mL de xarope", "1 cápsula dura". */
export function quantidadePorExtenso(m: { forma: string; quantidade_num: number | null; unidade: string }): string {
  const forma = expandirForma(m.forma);
  if (m.quantidade_num === null) return forma;
  const n = m.quantidade_num;
  if (MEDIDAS.has(m.unidade)) return `${numero(n)} ${m.unidade} de ${forma}`;
  const singular = n === 1;
  const nome = singular ? m.unidade : (PLURAL[m.unidade] ?? m.unidade);
  const genero = FEMININOS.has(m.unidade) ? "f" : "m";
  const quals = QUALIFICADORES.filter(([re]) => re.test(m.forma)).map(([, q]) => q[genero][singular ? 0 : 1]);
  return [numero(n), nome, ...quals].join(" ");
}

/**
 * Dosagem como escrita na apresentação ("35 MG + 300 MG + 50 MG"). O campo dosagem guarda a forma
 * canônica, com os valores ordenados, que serve para agrupar equivalentes mas não para exibir.
 */
export function dosagemExibicao(m: { apresentacao: string; forma: string; dosagem: string }): string {
  const primeira = m.forma.split(" ")[0];
  if (!primeira) return m.dosagem;
  const texto = semAcento(m.apresentacao.toUpperCase()).replace(/\s+/g, " ");
  const i = ` ${texto} `.indexOf(` ${primeira} `);
  const trecho = i > 0 ? texto.slice(0, i).trim() : "";
  return trecho && /\d/.test(trecho) ? trecho : m.dosagem;
}

/** Rótulo curto para a unidade do preço: "por comprimido", "por mL". */
export function porUnidade(unidade: string): string {
  return `por ${unidade}`;
}

export function rotuloTarja(t: string): string {
  return t === "Tarja Sem Tarja" ? "Sem tarja" : t;
}

export const TARJAS = ["Tarja Sem Tarja", "Tarja Vermelha", "Tarja Vermelha sob restrição", "Tarja Preta", "Não informada"];
