// Ilustração SVG simples de uma caixa de medicamento, montada só com os campos do registro da CMED
// (a fonte oficial não fornece imagens): um retângulo na cor da marca com
//  - nome, dosagem, princípio ativo, conteúdo ("Contém 20 comprimidos") e via de uso
//  - tarja vermelha ou preta com a frase de venda, conforme o campo TARJA
//  - faixa amarela com "G", identificação obrigatória dos genéricos (Lei nº 9.787/1999), só neles
// A cor vem de uma paleta fixa, escolhida pelo nome da marca (nos genéricos, pelo laboratório,
// que costuma usar a mesma cor em toda a linha). Não usa logotipo nem identidade visual real de
// laboratório: o laboratório aparece só como texto.

import { dosagemExibicao, quantidadePorExtenso } from "@/lib/formatacao";
import type { MedicamentoResumo } from "@/lib/normalizacao";

type Dados = Pick<
  MedicamentoResumo,
  | "produto" | "dosagem" | "apresentacao" | "forma" | "quantidade_num" | "unidade" | "laboratorio" | "selo"
  | "chave_equivalencia_ampla" | "substancia" | "tarja"
>;

/** Cores dos selos usados nos cards e badges (o amarelo é reservado ao genérico). */
export const COR_SELO: Record<string, { fundo: string; tinta: string }> = {
  "Genérico": { fundo: "#ffd200", tinta: "#1a1a1a" },
  Similar: { fundo: "#1d4ed8", tinta: "#ffffff" },
  "Referência": { fundo: "#6d28d9", tinta: "#ffffff" },
};

// Cores de caixa, todas escuras o bastante para texto branco. Sem amarelo, reservado ao genérico.
const PALETA = [
  "#0f7d8c", "#c2185b", "#1f4e9c", "#2e7d32", "#d2541b", "#7b1e3a", "#5b2a86",
  "#c62828", "#35577d", "#00695c", "#9c1f5e", "#283593", "#8e3b14", "#4e6b1f",
];

const FONTE = "var(--font-caixa), Arial, Helvetica, sans-serif";

/** FNV-1a de 32 bits: estável entre servidor e navegador. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function quebrarLinhas(texto: string, porLinha: number, maxLinhas: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/)) {
    const candidata = atual ? `${atual} ${palavra}` : palavra;
    if (candidata.length <= porLinha || !atual) atual = candidata;
    else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  const cortar = (l: string) => (l.length > porLinha + 1 ? `${l.slice(0, porLinha)}…` : l);
  if (linhas.length > maxLinhas) {
    const cortadas = linhas.slice(0, maxLinhas);
    cortadas[maxLinhas - 1] = `${cortadas[maxLinhas - 1].slice(0, porLinha - 1)}…`;
    return cortadas;
  }
  return linhas.map(cortar);
}

const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Via de uso, como aparece nas caixas ("USO ORAL"), deduzida da forma farmacêutica. */
export function viaDeUso(forma: string, apresentacao = ""): string | null {
  const t = ` ${forma} `;
  const a = ` ${apresentacao.toUpperCase()} `;
  if (/ OFT /.test(t)) return "USO OFTÁLMICO";
  if (/ NAS /.test(t)) return "USO NASAL";
  if (/ VAG /.test(t)) return "USO VAGINAL";
  if (/ INAL | AER /.test(t)) return "USO INALATÓRIO";
  // Liofilizado só é injetável com indicação de injeção, infusão, frasco-ampola ou ampola.
  if (/ (INJ|INFUS) /.test(t) || / (INJ|INFUS) /.test(a) || (/ LIOF /.test(t) && / (FA|AMP) /.test(a))) return "USO INJETÁVEL";
  // Pó em envelope ou sachê é para dissolver e beber.
  if (/ PO /.test(t) && / (ENV|ENVL|SACH|SACHE) /.test(a)) return "USO ORAL";
  if (/ SUP /.test(t)) return "USO RETAL";
  // Antes do tópico: "CAP GEL DURA" é cápsula gelatinosa, não gel de uso na pele.
  if (/ (COM|CAP|CAPS|DRG|PAS|GOMA|OR|ORAL) /.test(t)) return "USO ORAL";
  if (/ (DERM|TOP|CREM|POM|GEL|LOC|SHAMP|XAMP) /.test(t)) return "USO TÓPICO";
  if (/ (COM|CAP|DRG|PAS|GOMA|XPE|OR|GOT|EFERV|MAST|GRAN) /.test(t)) return "USO ORAL";
  return null;
}

/** Frase da tarja, como impressa nas caixas (uma ou duas linhas). */
function fraseTarja(tarja: string): { cor: string; linhas: string[] } | null {
  const venda = "VENDA SOB PRESCRIÇÃO MÉDICA";
  const retencao = "SÓ PODE SER VENDIDO COM RETENÇÃO DA RECEITA";
  if (tarja === "Tarja Vermelha") return { cor: "#d4202a", linhas: [venda] };
  if (tarja === "Tarja Vermelha sob restrição") return { cor: "#d4202a", linhas: [venda, retencao] };
  if (tarja === "Tarja Preta") return { cor: "#111111", linhas: [venda, retencao] };
  return null;
}

const capitalizar = (s: string) => s.toLowerCase();

export default function Embalagem({
  m,
  uid,
  className,
  titulo = true,
}: {
  m: Dados;
  /** Identificador único na página, para o clipPath. */
  uid: string | number;
  className?: string;
  titulo?: boolean;
}) {
  const generico = m.selo === "Genérico";
  const cor = PALETA[hash(generico ? m.laboratorio : `${m.produto}|${m.laboratorio}`) % PALETA.length];
  const tarja = fraseTarja(m.tarja);
  const via = viaDeUso(m.forma, m.apresentacao);
  const clip = `emb-${uid}`;

  // Retângulo de (2, 2) a (238, 166) no viewBox 240 x 168; tarja e faixa do genérico embaixo.
  const ALTURA_G = generico ? 26 : 0;
  const ALTURA_TARJA = tarja ? (tarja.linhas.length > 1 ? 20 : 13) : 0;
  const Y_G = 166 - ALTURA_G;
  const Y_TARJA = Y_G - ALTURA_TARJA;
  const TX = 14;

  const nome = m.produto;
  const tamanho = nome.length <= 10 ? 21 : nome.length <= 16 ? 17 : 14;
  const linhasNome = quebrarLinhas(nome, Math.floor(212 / (tamanho * 0.64)), 2);
  const yNome = 40;
  const yDose = yNome + (linhasNome.length - 1) * tamanho * 1.05 + 17;
  const dosagem = dosagemExibicao(m);
  const substancias = m.substancia.map(capitalizar).join(" + ");
  const mostrarSubstancia = substancias && substancias.toUpperCase() !== nome.toUpperCase();
  const ySubst = yDose + 14;
  const conteudo = `Contém ${quantidadePorExtenso(m)}`;
  const yConteudo = Y_TARJA - (via ? 15 : 7);

  return (
    <svg
      viewBox="0 0 240 168"
      className={className}
      role="img"
      style={{ fontFamily: FONTE }}
      aria-label={`Ilustração da caixa de ${m.produto}, ${dosagem}, ${conteudo.toLowerCase()}, medicamento ${m.selo.toLowerCase()}, ${m.laboratorio}`}
    >
      {titulo && <title>{`${m.produto} ${dosagem}`}</title>}
      <defs>
        <clipPath id={clip}>
          <rect x="2" y="2" width="236" height="164" rx="4" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x="2" y="2" width="236" height="164" fill={cor} />
        {tarja && (
          <g>
            <rect x="2" y={Y_TARJA} width="236" height={ALTURA_TARJA} fill={tarja.cor} />
            {tarja.linhas.map((linha, i) => (
              <text key={i} x="120" y={Y_TARJA + 9 + i * 7.5} textAnchor="middle" fontSize={i === 0 ? 6.8 : 6} fontWeight="700" fill="#ffffff" letterSpacing="0.2">
                {linha}
              </text>
            ))}
          </g>
        )}
        {generico && (
          <g>
            <rect x="2" y={Y_G} width="236" height={ALTURA_G} fill="#ffd200" />
            <text x={TX - 2} y={Y_G + 22} fontSize="25" fontWeight="900" fill="#1b3f94">
              G
            </text>
            <text x={TX + 20} y={Y_G + 11} fontSize="7" fontWeight="700" fill="#111111">
              Medicamento
            </text>
            <text x={TX + 20} y={Y_G + 22} fontSize="11.5" fontWeight="900" fill="#111111">
              Genérico
            </text>
            <text x="230" y={Y_G + 22} textAnchor="end" fontSize="6" fontWeight="700" fill="#111111">
              Lei nº 9.787/99
            </text>
          </g>
        )}
      </g>

      <text x={TX} y="19" fontSize="6.3" fontWeight="700" fill="#ffffff" fillOpacity="0.8" letterSpacing="0.3">
        {cortar(m.laboratorio.toUpperCase(), 50)}
      </text>
      <text x={TX} y={yNome} fontSize={tamanho} fontWeight="800" fill="#ffffff">
        {linhasNome.map((linha, i) => (
          <tspan key={i} x={TX} dy={i === 0 ? 0 : tamanho * 1.05}>
            {linha}
          </tspan>
        ))}
      </text>
      {dosagem && (
        <text x={TX} y={yDose} fontSize="12" fontWeight="700" fill="#ffffff">
          {cortar(dosagem, 34)}
        </text>
      )}
      {mostrarSubstancia && ySubst < yConteudo - 9 && (
        <text x={TX} y={ySubst} fontSize="8" fill="#ffffff" fillOpacity="0.9">
          {cortar(substancias, 48)}
        </text>
      )}
      <text x={TX} y={yConteudo} fontSize="8.5" fontWeight="600" fill="#ffffff">
        {cortar(conteudo, 44)}
      </text>
      {via && (
        <text x={TX} y={Y_TARJA - 6} fontSize="6.6" fontWeight="700" fill="#ffffff" letterSpacing="0.4">
          {via}
        </text>
      )}
    </svg>
  );
}
