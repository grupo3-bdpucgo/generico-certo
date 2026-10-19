// Funções de normalização da Lista de Preços CMED/ANVISA.
// Usadas pelo script de limpeza e reaproveitadas pelo site e pelo benchmark.

export interface Medicamento {
  id: number;
  ggrem: string;
  produto: string;
  substancia: string[];
  laboratorio: string;
  cnpj: string | null;
  apresentacao: string;
  classe: string | null;
  tipo_produto: string | null;
  selo: string;
  pmc: number;
  pf: number | null;
  registro: string | null;
  ean: string | null;
  tarja: string;
  generico: boolean;
  restricao_hospitalar: boolean;
  dosagem: string;
  forma: string;
  quantidade: string;
  quantidade_num: number | null;
  chave_equivalencia: string;
  texto_embedding: string;
}

/** Campos vazios da planilha chegam como "    -     ". */
export function limparCampo(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  if (s === "" || s === "-") return null;
  return s;
}

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Converte número no padrão brasileiro: "27,22", "1.250", "1.234,56", "1,0". */
export function numeroBR(v: unknown): number | null {
  const s = limparCampo(v);
  if (!s) return null;
  let t = s.replace(/[^\d.,]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Nome da coluna de preço para a alíquota. A planilha usa "PF 0%" e "PMC 0 %". */
export function colunaPreco(tipo: "PMC" | "PF", aliquota: string): string {
  const a = aliquota.replace(".", ",");
  if (a === "0") return tipo === "PF" ? "PF 0%" : "PMC 0 %";
  return `${tipo} ${a} %`;
}

// ---------------------------------------------------------------- substâncias

const DESCRITORES_HIDRATACAO =
  /\b(ANIDRA|ANIDRO|MONOIDRATADA|MONOIDRATADO|MONO-HIDRATADA|MONO-HIDRATADO|DI-HIDRATADA|DI-HIDRATADO|DIIDRATADA|DIIDRATADO|TRI-HIDRATADA|TRI-HIDRATADO|TRIIDRATADA|TRIIDRATADO|HEMI-HIDRATADA|HEMI-HIDRATADO|HEMIIDRATADA|HEMIIDRATADO|SESQUI-HIDRATADA|SESQUI-HIDRATADO|PENTA-HIDRATADA|PENTA-HIDRATADO|HIDRATADA|HIDRATADO)\b/g;

export function separarSubstancias(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(";")
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Forma canônica de uma substância para a chave de equivalência. */
export function substanciaCanonica(s: string): string {
  return semAcento(s.toUpperCase())
    .replace(DESCRITORES_HIDRATACAO, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------- apresentação

const UNIDADE =
  /^(MG|G|MCG|UG|ML|L|UI|U|MUI|MEQ|MMOL|%|UFC|UTR|KUI|DOSE|DOSES|GOTA|GOTAS|BILHOES|MILHOES)(\/[A-Z0-9,.]+)*$/;
const NUMERO = /^\d[\d.,]*$/;
const PARADA_FORMA = new Set([
  "CT", "CX", "BL", "FR", "BG", "DISP", "ENV", "FA", "AMP", "BIS", "STR", "SACH",
  "SACHE", "POTE", "TB", "LATA", "CARP", "SER", "BOLS", "X", "FLAC", "KIT", "EST",
  "BL+", "CJ", "FRAS", "SIST", "CAN", "APLIC", "EMB",
]);

function tokenizar(apresentacao: string): string[] {
  return semAcento(apresentacao.toUpperCase())
    .replace(/(\d)([A-Z%])/g, "$1 $2")
    .replace(/([+()])/g, " $1 ")
    .split(/\s+/)
    .filter(Boolean);
}

function formatarNumero(n: number): string {
  return String(Number(n.toFixed(4)));
}

export interface PartesApresentacao {
  dosagem: string;
  forma: string;
  formaBase: string;
  quantidade: string;
  quantidadeNum: number | null;
}

/**
 * Extrai dosagem, forma farmacêutica e quantidade da apresentação.
 * "300 MG + 35 MG + 50 MG COM CT BL AL PLAS AMB X 36" e
 * "(35 + 300 + 50) MG COM REV CT BL AL X 36" geram a mesma dosagem "300 MG + 35 MG + 50 MG".
 */
export function analisarApresentacao(apresentacao: string): PartesApresentacao {
  const tokens = tokenizar(apresentacao);
  let i = 0;
  const itens: string[] = [];
  let pendentes: number[] = [];

  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "+" || t === "(" || t === ")") continue;
    if (NUMERO.test(t)) {
      const n = numeroBR(t);
      if (n !== null) pendentes.push(n);
      continue;
    }
    if (UNIDADE.test(t)) {
      const [base, ...resto] = t.split("/");
      const fator = base === "G" ? 1000 : 1;
      const unidade = [base === "G" ? "MG" : base, ...resto].join("/");
      for (const n of pendentes) itens.push(`${formatarNumero(n * fator)} ${unidade}`);
      pendentes = [];
      continue;
    }
    break;
  }
  for (const n of pendentes) itens.push(formatarNumero(n));

  const formaTokens: string[] = [];
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (PARADA_FORMA.has(t) || NUMERO.test(t) || t === "+" || t === "(") break;
    formaTokens.push(t);
  }
  const forma = formaTokens.join(" ");
  const formaBase = formaTokens
    .map((t) => (t === "DRG" ? "COM" : t))
    .filter((t) => !["REV", "DURA", "MOLE"].includes(t))
    .join(" ");

  const normal = tokens.join(" ");
  let quantidade = "";
  let quantidadeNum: number | null = null;
  const porX = [...normal.matchAll(/\bX (\d[\d.,]*)(?: (ML|L|G|MG|UN|DOSES?))?\b/g)];
  if (porX.length) {
    const m = porX[porX.length - 1];
    quantidadeNum = numeroBR(m[1]);
    quantidade = [quantidadeNum !== null ? formatarNumero(quantidadeNum) : m[1], m[2]]
      .filter(Boolean)
      .join(" ");
  } else {
    const m = normal.match(/\b(?:CT|CX) (\d+) (FA|AMP|FR|BOLS|SER|CARP|ENV|BL|STR)\b/);
    if (m) {
      quantidadeNum = Number(m[1]);
      quantidade = `${m[1]} ${m[2]}`;
    }
  }

  return { dosagem: itens.sort().join(" + "), forma, formaBase, quantidade, quantidadeNum };
}

// ---------------------------------------------------------------- texto e rótulos

const EXPANSAO_FORMA: Record<string, string> = {
  COM: "comprimido", REV: "revestido", CAP: "cápsula", DURA: "dura", MOLE: "mole",
  DRG: "drágea", SOL: "solução", OR: "oral", SUS: "suspensão", XPE: "xarope",
  CREM: "creme", DERM: "dermatológico", POM: "pomada", INJ: "injetável",
  GOT: "gotas", EFERV: "efervescente", LIB: "liberação", PROL: "prolongada",
  RETARD: "retardada", MAST: "mastigável", PO: "pó", LIOF: "liofilizado",
  NAS: "nasal", OFT: "oftálmica", SPR: "spray", INAL: "inalatória", TOP: "tópico",
  VAG: "vaginal", GEL: "gel", LOC: "loção", SHAMP: "xampu", PAS: "pastilha",
  ORODISP: "orodispersível", DISPER: "dispersível", SUP: "supositório", IV: "intravenosa",
  IM: "intramuscular", SC: "subcutânea", EMU: "emulsão", AER: "aerossol", GRAN: "granulado",
};

export function expandirForma(forma: string): string {
  return forma
    .split(" ")
    .map((t) => EXPANSAO_FORMA[t] ?? t.toLowerCase())
    .join(" ");
}

export function seloDoTipo(tipo: string | null): string {
  switch (tipo) {
    case "Genérico": return "Genérico";
    case "Similar": return "Similar";
    case "Novo": return "Referência";
    case null: return "Não informado";
    default: return tipo;
  }
}

export function normalizarTarja(t: string | null): string {
  if (!t || t.startsWith("-")) return "Não informada";
  return t;
}

/** Remove o código ATC da classe: "D7B2 - CORTICOESTERÓIDES..." -> "CORTICOESTERÓIDES...". */
export function classeSemCodigo(classe: string | null): string {
  return (classe ?? "").replace(/^[A-Z0-9]+\s*-\s*/, "").trim();
}

export function montarTextoEmbedding(m: {
  produto: string;
  substancia: string[];
  classe: string | null;
  dosagem: string;
  forma: string;
}): string {
  return [
    m.produto,
    m.substancia.join(", "),
    classeSemCodigo(m.classe),
    [m.dosagem, expandirForma(m.forma)].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(". ")
    .toLowerCase();
}
