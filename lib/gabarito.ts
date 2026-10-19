// Avaliação de resultados contra o gabarito do benchmark (benchmark/consultas.json).

import { codigoClasse, semAcento, substanciaCanonica } from "./normalizacao";

export interface Gabarito {
  descricao: string;
  alvo: {
    produto_igual?: string[];
    substancias_todas?: string[];
    mesmo_numero?: boolean;
    substancias_qualquer?: string[];
    classes?: string[];
  };
  exige?: { generico?: boolean; forma_contem?: string[]; dosagem_contem?: string };
}

export interface ConsultaTeste {
  id: number;
  categoria: "nome_comercial" | "erro_digitacao" | "principio_ativo" | "coloquial" | "mista";
  consulta: string;
  desenvolvimento: boolean;
  gabarito: Gabarito;
}

export interface CamposAvaliados {
  produto: string;
  substancia: string[];
  classe: string | null;
  generico: boolean;
  forma: string;
  dosagem: string;
}

const temPalavra = (texto: string, trecho: string) =>
  new RegExp(`(^|[^A-Z])${trecho}([^A-Z]|$)`).test(texto);

export function correto(m: CamposAvaliados, g: Gabarito): boolean {
  const subs = m.substancia.map(substanciaCanonica);
  const produto = semAcento(m.produto.toUpperCase()).trim();
  const classe = codigoClasse(m.classe) ?? "";
  const a = g.alvo;

  const porProduto = a.produto_igual?.some((p) => produto === p) ?? false;
  const porTodas =
    a.substancias_todas !== undefined &&
    a.substancias_todas.every((t) => subs.some((s) => temPalavra(s, t))) &&
    (!a.mesmo_numero || subs.length === a.substancias_todas.length);
  const porQualquer = a.substancias_qualquer?.some((t) => subs.some((s) => temPalavra(s, t))) ?? false;
  const porClasse = a.classes?.some((c) => classe.startsWith(c)) ?? false;
  if (!(porProduto || porTodas || porQualquer || porClasse)) return false;

  const e = g.exige ?? {};
  if (e.generico !== undefined && m.generico !== e.generico) return false;
  if (e.forma_contem && !e.forma_contem.some((f) => m.forma.includes(f))) return false;
  if (e.dosagem_contem && !m.dosagem.includes(e.dosagem_contem)) return false;
  return true;
}
