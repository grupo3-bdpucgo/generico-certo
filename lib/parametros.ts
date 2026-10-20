// Leitura dos parâmetros de busca da URL, compartilhada entre páginas e rotas de API.

import type { FiltrosBusca } from "./busca";
import { TARJAS } from "./formatacao";
import { GRUPOS_FORMA } from "./normalizacao";
import { doseCanonica } from "./reordenacao";

export type Parametros = Record<string, string | string[] | undefined>;

export const POR_PAGINA = 12;

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const varios = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export interface ParametrosBusca {
  q: string;
  filtros: FiltrosBusca;
  pagina: number;
  /** Dose como o usuário digitou, para reexibir no formulário. */
  doseDigitada: string;
}

export function lerParametros(p: Parametros): ParametrosBusca {
  const precoBruto = um(p.precoMax).replace(",", ".");
  const preco = precoBruto ? Number(precoBruto) : NaN;
  const pagina = Math.max(1, Math.min(50, Number(um(p.pagina)) || 1));
  const forma = um(p.forma);
  const doseDigitada = um(p.dose).trim().slice(0, 30);
  const qtd = Number(um(p.qtd));
  return {
    q: um(p.q).trim().slice(0, 200),
    pagina,
    doseDigitada,
    filtros: {
      apenasGenericos: um(p.generico) === "1",
      precoMaximo: Number.isFinite(preco) && preco > 0 ? preco : undefined,
      tarjas: varios(p.tarja).filter((t) => TARJAS.includes(t)),
      forma: GRUPOS_FORMA.some(([v]) => v === forma) ? forma : undefined,
      dose: doseCanonica(doseDigitada) ?? undefined,
      quantidade: Number.isInteger(qtd) && qtd > 0 ? qtd : undefined,
    },
  };
}

export function lerDeUrl(url: URL): Parametros {
  const p: Parametros = {};
  for (const chave of new Set(url.searchParams.keys())) {
    const valores = url.searchParams.getAll(chave);
    p[chave] = valores.length > 1 ? valores : valores[0];
  }
  return p;
}

/** Monta a query string de volta, para links de paginação e de retorno. */
export function paraQueryString(b: ParametrosBusca, pagina = b.pagina): string {
  const s = new URLSearchParams();
  if (b.q) s.set("q", b.q);
  if (b.filtros.apenasGenericos) s.set("generico", "1");
  if (b.filtros.precoMaximo !== undefined) s.set("precoMax", String(b.filtros.precoMaximo));
  for (const t of b.filtros.tarjas ?? []) s.append("tarja", t);
  if (b.filtros.forma) s.set("forma", b.filtros.forma);
  if (b.doseDigitada) s.set("dose", b.doseDigitada);
  if (b.filtros.quantidade !== undefined) s.set("qtd", String(b.filtros.quantidade));
  if (pagina > 1) s.set("pagina", String(pagina));
  return s.toString();
}
