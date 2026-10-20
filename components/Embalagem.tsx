// Ilustração SVG de uma caixa de medicamento, montada só com os campos do registro da CMED
// (a fonte oficial não fornece imagens). Segue os elementos de uma embalagem brasileira:
//  - caixa inteira na cor da marca, desenhada em perspectiva (frente, topo e lateral)
//  - nome, dosagem em destaque, princípio ativo, conteúdo ("Contém 20 comprimidos") e via de uso
//  - desenho do conteúdo (comprimidos, cápsulas, frasco, bisnaga...) pela forma farmacêutica
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

/** Mistura duas cores #rrggbb (t = 0 devolve a primeira, t = 1 a segunda). */
function misturar(a: string, b: string, t: number): string {
  const c = (s: string, i: number) => parseInt(s.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * t).toString(16).padStart(2, "0")).join("")}`;
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

type Conteudo = "comprimido" | "capsula" | "bisnaga" | "frasco" | "gotas" | "ampola" | "spray" | "supositorio" | "blister";

function conteudoDaForma(forma: string): Conteudo {
  const t = ` ${forma} `;
  if (/ (SPR|AER|INAL) /.test(t)) return "spray";
  if (/ SUP /.test(t)) return "supositorio";
  if (/ CAP /.test(t)) return "capsula";
  if (/ (COM|DRG|PAS|GOMA) /.test(t)) return "comprimido";
  if (/ (CREM|POM|GEL|UNG) /.test(t)) return "bisnaga";
  if (/ GOT /.test(t)) return "gotas";
  if (/ (INJ|LIOF|AMP) /.test(t)) return "ampola";
  if (/ (SOL|SUS|XPE|EMU|ELX|LOC|SHAMP|XAMP) /.test(t)) return "frasco";
  return "blister";
}

// Desenhos preenchidos do conteúdo, numa área de 48 x 40, como as fotos de comprimido das caixas.
const CONTORNO = { stroke: "#000000", strokeOpacity: 0.22, strokeWidth: 0.8 };

function DesenhoConteudo({ tipo, cor }: { tipo: Conteudo; cor: string }) {
  const sombra = <ellipse cx="25" cy="37" rx="20" ry="3" fill="#000000" opacity="0.2" />;
  const clara = misturar(cor, "#ffffff", 0.55);
  switch (tipo) {
    case "comprimido": {
      // Dois comprimidos vistos de lado: face, espessura e sulco.
      const comprimido = (cx: number, cy: number, rx: number, ry: number) => (
        <g>
          <path d={`M${cx - rx} ${cy}v3.5a${rx} ${ry} 0 0 0 ${2 * rx} 0V${cy}`} fill="#dcdcdc" {...CONTORNO} />
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#ffffff" {...CONTORNO} />
          <path d={`M${cx - rx * 0.6} ${cy}h${rx * 1.2}`} stroke="#000000" strokeOpacity="0.18" strokeWidth="1" />
        </g>
      );
      return (
        <g>
          {sombra}
          {comprimido(32, 20, 11, 6)}
          {comprimido(19, 28, 13, 7)}
        </g>
      );
    }
    case "capsula": {
      const capsula = (x: number, y: number, giro: number) => (
        <g transform={`rotate(${giro} ${x + 15} ${y + 6})`}>
          <path d={`M${x + 15} ${y}h-9a6 6 0 0 0 0 12h9z`} fill="#ffffff" {...CONTORNO} />
          <path d={`M${x + 15} ${y}h9a6 6 0 0 1 0 12h-9z`} fill={clara} {...CONTORNO} />
          <path d={`M${x + 4} ${y + 3}h8`} stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      );
      return (
        <g>
          {sombra}
          {capsula(14, 8, 25)}
          {capsula(4, 20, -12)}
        </g>
      );
    }
    case "gotas":
      // Frasco conta-gotas com uma gota caindo.
      return (
        <g>
          {sombra}
          <path d="M19 2h6l1 7h-8z" fill="#f2f2f2" {...CONTORNO} />
          <rect x="16" y="9" width="12" height="6" rx="1.5" fill={misturar(cor, "#000000", 0.35)} />
          <rect x="11" y="15" width="22" height="22" rx="4" fill="#ffffff" {...CONTORNO} />
          <rect x="11" y="21" width="22" height="9" fill={clara} />
          <path d="M40 18c2.5 3.5 4 5.5 4 7.5a4 4 0 0 1-8 0c0-2 1.5-4 4-7.5z" fill="#ffffff" {...CONTORNO} />
        </g>
      );
    case "frasco":
      return (
        <g>
          {sombra}
          <rect x="17" y="1" width="14" height="7" rx="1.5" fill={misturar(cor, "#000000", 0.35)} />
          <path d="M19 8h10v3c4 1 7 3 7 7v16a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V18c0-4 3-6 7-7z" fill="#ffffff" {...CONTORNO} />
          <rect x="12" y="20" width="24" height="11" fill={clara} />
        </g>
      );
    case "bisnaga":
      // Bisnaga deitada: fundo dobrado à esquerda, tampa à direita.
      return (
        <g>
          {sombra}
          <g transform="rotate(-14 24 22)">
            <path d="M4 12l1.5 2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2h4c10-2 20-4 26-6v-8C28 16 18 14 8 12z" fill="#ffffff" {...CONTORNO} />
            <path d="M14 13.6c7 1.2 13 2.6 18 4v8.8c-5 1.4-11 2.8-18 4z" fill={clara} />
            <rect x="34" y="17" width="4" height="10" fill="#e6e6e6" {...CONTORNO} />
            <rect x="38" y="16" width="9" height="12" rx="1.5" fill={misturar(cor, "#000000", 0.35)} />
          </g>
        </g>
      );
    case "ampola":
      return (
        <g>
          {sombra}
          {[12, 28].map((x) => (
            <g key={x}>
              <path d={`M${x + 2} 2h4v6l3 4v22a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V12l3-4z`} fill="#ffffff" fillOpacity="0.9" {...CONTORNO} />
              <rect x={x - 1} y="20" width="10" height="7" fill={clara} />
            </g>
          ))}
        </g>
      );
    case "spray":
      return (
        <g>
          {sombra}
          <path d="M20 1h6v5h-6z" fill="#f2f2f2" {...CONTORNO} />
          <rect x="17" y="6" width="12" height="5" rx="1" fill={misturar(cor, "#000000", 0.35)} />
          <rect x="14" y="11" width="18" height="26" rx="4" fill="#ffffff" {...CONTORNO} />
          <rect x="14" y="18" width="18" height="10" fill={clara} />
          {[[33, 3], [37, 6], [34, 8]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="1" fill="#ffffff" />
          ))}
        </g>
      );
    case "supositorio":
      return (
        <g>
          {sombra}
          {[10, 26].map((x) => (
            <path key={x} d={`M${x + 6} 6c4 3 6 9 6 16v12h-12V22c0-7 2-13 6-16z`} fill="#ffffff" {...CONTORNO} />
          ))}
        </g>
      );
    default:
      // Cartela com bolhas.
      return (
        <g>
          {sombra}
          <rect x="4" y="8" width="40" height="27" rx="3" fill="#e6e6e6" {...CONTORNO} />
          {[0, 1, 2].flatMap((i) =>
            [0, 1].map((j) => <ellipse key={`${i}${j}`} cx={12 + i * 12} cy={16 + j * 11} rx="4.5" ry="3.5" fill="#ffffff" {...CONTORNO} />),
          )}
        </g>
      );
  }
}

/** Grafismo da frente da caixa; varia por marca para as caixas não ficarem iguais. */
function Grafismo({ tipo, x0, y0, x1, y1, cor }: { tipo: number; x0: number; y0: number; x1: number; y1: number; cor: string }) {
  const w = x1 - x0;
  const h = y1 - y0;
  const claro = misturar(cor, "#ffffff", 0.18);
  const escuro = misturar(cor, "#000000", 0.18);
  if (tipo === 0) {
    // Onda atravessando a caixa.
    const onda = `M${x0} ${y0 + h * 0.62}C${x0 + w * 0.3} ${y0 + h * 0.42} ${x0 + w * 0.62} ${y0 + h * 0.86} ${x1} ${y0 + h * 0.5}`;
    return (
      <g>
        <path d={`${onda}V${y1}H${x0}z`} fill={escuro} />
        <path d={onda} fill="none" stroke={claro} strokeWidth="3" />
      </g>
    );
  }
  if (tipo === 1) {
    // Faixa diagonal.
    return (
      <g>
        <path d={`M${x0 + w * 0.58} ${y0}H${x0 + w * 0.8}L${x0 + w * 0.42} ${y1}H${x0 + w * 0.2}z`} fill={claro} opacity="0.55" />
        <path d={`M${x0 + w * 0.84} ${y0}H${x0 + w * 0.9}L${x0 + w * 0.52} ${y1}H${x0 + w * 0.46}z`} fill={claro} opacity="0.55" />
      </g>
    );
  }
  // Círculo grande saindo pelo canto.
  return (
    <g>
      <circle cx={x1 - w * 0.08} cy={y0 + h * 0.62} r={h * 0.55} fill={escuro} />
      <circle cx={x1 - w * 0.08} cy={y0 + h * 0.62} r={h * 0.38} fill="none" stroke={claro} strokeWidth="2.5" />
    </g>
  );
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
  const semente = hash(generico ? m.laboratorio : `${m.produto}|${m.laboratorio}`);
  const cor = PALETA[semente % PALETA.length];
  const topo = misturar(cor, "#ffffff", 0.28);
  const lado = misturar(cor, "#000000", 0.3);
  const tarja = fraseTarja(m.tarja);
  const via = viaDeUso(m.forma, m.apresentacao);
  const clip = `emb-${uid}`;

  // Caixa em perspectiva no viewBox 240 x 168: frente de (X0, Y0) a (X1, Y1), profundidade DX x DY.
  const [X0, Y0, X1, Y1, DX, DY] = [4, 14, 222, 164, 14, 10];
  const ALTURA_G = generico ? 26 : 0;
  const ALTURA_TARJA = tarja ? (tarja.linhas.length > 1 ? 20 : 13) : 0;
  const Y_G = Y1 - ALTURA_G;
  const Y_TARJA = Y_G - ALTURA_TARJA;
  const Y_BASE = Y_TARJA; // fim da área de texto
  const TX = X0 + 10;

  const nome = m.produto;
  const tamanho = nome.length <= 10 ? 21 : nome.length <= 16 ? 17 : 14;
  const linhasNome = quebrarLinhas(nome, Math.floor(196 / (tamanho * 0.62)), 2);
  const yNome = Y0 + 34;
  const dosagem = dosagemExibicao(m);
  const doseEmSelo = dosagem.length > 0 && dosagem.length <= 16;
  const yDose = yNome + (linhasNome.length - 1) * tamanho * 1.05 + 8;
  const larguraDose = dosagem.length * 6.9 + 12;
  const substancias = m.substancia.map(capitalizar).join(" + ");
  const mostrarSubstancia = substancias && substancias.toUpperCase() !== nome.toUpperCase();
  const ySubst = yDose + (doseEmSelo ? 17 : 12) + 11;
  const conteudo = `Contém ${quantidadePorExtenso(m)}`;
  const yConteudo = Y_BASE - (via ? 15 : 7);
  // A área do desenho do conteúdo fica no canto inferior direito, acima da tarja.
  const yDesenho = Y_BASE - 56;
  const substanciaCabe = mostrarSubstancia && ySubst < yConteudo - 9;
  const substanciaCurta = ySubst > yDesenho - 2;

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
          <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
        </clipPath>
      </defs>

      {/* Topo e lateral */}
      <path d={`M${X0} ${Y0}L${X0 + DX} ${Y0 - DY}H${X1 + DX}L${X1} ${Y0}z`} fill={topo} stroke="#000000" strokeOpacity="0.25" strokeWidth="0.8" strokeLinejoin="round" />
      <path d={`M${X1} ${Y0}L${X1 + DX} ${Y0 - DY}V${Y1 - DY}L${X1} ${Y1}z`} fill={lado} stroke="#000000" strokeOpacity="0.25" strokeWidth="0.8" strokeLinejoin="round" />
      {tarja && (
        <path d={`M${X1} ${Y_TARJA}L${X1 + DX} ${Y_TARJA - DY}V${Y_G - DY}L${X1} ${Y_G}z`} fill={misturar(tarja.cor, "#000000", 0.3)} />
      )}
      {generico && <path d={`M${X1} ${Y_G}L${X1 + DX} ${Y_G - DY}V${Y1 - DY}L${X1} ${Y1}z`} fill="#c9a400" />}

      {/* Frente */}
      <g clipPath={`url(#${clip})`}>
        <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill={cor} />
        <Grafismo tipo={Math.floor(semente / PALETA.length) % 3} x0={X0} y0={Y0} x1={X1} y1={Y_BASE} cor={cor} />

        {tarja && (
          <g>
            <rect x={X0} y={Y_TARJA} width={X1 - X0} height={ALTURA_TARJA} fill={tarja.cor} />
            {tarja.linhas.map((linha, i) => (
              <text key={i} x={(X0 + X1) / 2} y={Y_TARJA + 9 + i * 7.5} textAnchor="middle" fontSize={i === 0 ? 6.8 : 6} fontWeight="700" fill="#ffffff" letterSpacing="0.2">
                {linha}
              </text>
            ))}
          </g>
        )}

        {generico && (
          <g>
            <rect x={X0} y={Y_G} width={X1 - X0} height={ALTURA_G} fill="#ffd200" />
            <text x={TX - 2} y={Y_G + 22} fontSize="25" fontWeight="900" fill="#1b3f94">
              G
            </text>
            <text x={TX + 20} y={Y_G + 11} fontSize="7" fontWeight="700" fill="#111111">
              Medicamento
            </text>
            <text x={TX + 20} y={Y_G + 22} fontSize="11.5" fontWeight="900" fill="#111111">
              Genérico
            </text>
            <text x={X1 - 8} y={Y_G + 22} textAnchor="end" fontSize="6" fontWeight="700" fill="#111111">
              Lei nº 9.787/99
            </text>
          </g>
        )}
      </g>
      <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="none" stroke="#000000" strokeOpacity="0.25" strokeWidth="0.8" />

      <g transform={`translate(${X1 - 70} ${yDesenho}) scale(1.3)`}>
        <DesenhoConteudo tipo={conteudoDaForma(m.forma)} cor={cor} />
      </g>

      <text x={TX} y={Y0 + 12} fontSize="6.3" fontWeight="700" fill="#ffffff" fillOpacity="0.8" letterSpacing="0.3">
        {cortar(m.laboratorio.toUpperCase(), 46)}
      </text>
      <text x={TX} y={yNome} fontSize={tamanho} fontWeight="900" fill="#ffffff" letterSpacing="-0.2" style={{ fontStretch: "condensed" }}>
        {linhasNome.map((linha, i) => (
          <tspan key={i} x={TX} dy={i === 0 ? 0 : tamanho * 1.05}>
            {linha}
          </tspan>
        ))}
      </text>
      {doseEmSelo ? (
        <g>
          <rect x={TX} y={yDose} width={larguraDose} height="16" rx="8" fill="#ffffff" />
          <text x={TX + larguraDose / 2} y={yDose + 11.6} textAnchor="middle" fontSize="11" fontWeight="800" fill={cor}>
            {dosagem}
          </text>
        </g>
      ) : (
        dosagem && (
          <text x={TX} y={yDose + 9} fontSize="10" fontWeight="800" fill="#ffffff">
            {cortar(dosagem, 34)}
          </text>
        )
      )}
      {substanciaCabe && (
        <text x={TX} y={ySubst} fontSize="8" fill="#ffffff" fillOpacity="0.92">
          {cortar(substancias, substanciaCurta ? 30 : 44)}
        </text>
      )}
      <text x={TX} y={yConteudo} fontSize={conteudo.length > 30 ? 7.4 : 8.5} fontWeight="600" fill="#ffffff">
        {cortar(conteudo, 38)}
      </text>
      {via && (
        <text x={TX} y={Y_BASE - 6} fontSize="6.6" fontWeight="800" fill="#ffffff" letterSpacing="0.4">
          {via}
        </text>
      )}
    </svg>
  );
}
