// Ilustração SVG em estilo de caixa de medicamento, montada só com os campos do registro da CMED
// (a fonte oficial não fornece imagens). Segue os elementos de uma embalagem brasileira:
//  - nome, dosagem, princípio ativo, conteúdo ("Contém 20 comprimidos") e via de uso
//  - tarja vermelha ou preta com a frase de venda, conforme o campo TARJA
//  - faixa inferior pelo tipo: a faixa amarela com "G" é a identificação obrigatória dos genéricos
//    (Lei nº 9.787/1999) e só aparece neles; similar, referência e demais tipos usam o mesmo formato
//    em outras cores, para não se confundirem com o genérico
//  - faixa fina no topo com a cor das substâncias canônicas (equivalentes ficam com a mesma cor)
// Não usa logotipo nem identidade visual de laboratório: o laboratório aparece só como texto.

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

// Faixa inferior da caixa por tipo de produto.
const FAIXA: Record<string, { fundo: string; letra: string; corLetra: string; linha1: string; linha2: string; rodape?: string }> = {
  "Genérico": { fundo: "#ffd200", letra: "G", corLetra: "#1b3f94", linha1: "Medicamento", linha2: "Genérico", rodape: "Lei nº 9.787/99" },
  Similar: { fundo: "#dbe6fd", letra: "S", corLetra: "#1d4ed8", linha1: "Medicamento", linha2: "Similar" },
  "Referência": { fundo: "#ece4fd", letra: "R", corLetra: "#6d28d9", linha1: "Medicamento de", linha2: "Referência" },
  "Biológico": { fundo: "#e8eaed", letra: "B", corLetra: "#3c4043", linha1: "Medicamento", linha2: "Biológico" },
  "Específico": { fundo: "#e8eaed", letra: "E", corLetra: "#3c4043", linha1: "Medicamento", linha2: "Específico" },
  "Fitoterápico": { fundo: "#e6f2e6", letra: "F", corLetra: "#2e6b2e", linha1: "Medicamento", linha2: "Fitoterápico" },
};
const FAIXA_OUTRO = { fundo: "#e8eaed", letra: "M", corLetra: "#3c4043", linha1: "Medicamento", linha2: "Tipo não informado" };

const FONTE = "Arial, Helvetica, sans-serif";

/** FNV-1a de 32 bits: estável entre servidor e navegador. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Cor das substâncias canônicas: equivalentes ficam com a mesma cor. */
export function coresDaSubstancia(chaveAmpla: string) {
  const substancias = chaveAmpla.split(" | ")[0] ?? chaveAmpla;
  const matiz = hash(substancias) % 360;
  return {
    faixa: `hsl(${matiz} 55% 62%)`,
    fundo: `hsl(${matiz} 40% 98%)`,
    borda: `hsl(${matiz} 20% 78%)`,
    icone: `hsl(${matiz} 35% 32%)`,
  };
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

/** Via de uso, como aparece nas caixas ("USO ORAL"), deduzida da forma farmacêutica. */
export function viaDeUso(forma: string): string | null {
  const t = ` ${forma} `;
  if (/ OFT /.test(t)) return "USO OFTÁLMICO";
  if (/ NAS /.test(t)) return "USO NASAL";
  if (/ VAG /.test(t)) return "USO VAGINAL";
  if (/ INAL | AER /.test(t)) return "USO INALATÓRIO";
  if (/ INJ |LIOF/.test(t)) return "USO INJETÁVEL";
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

type Icone = "comprimido" | "capsula" | "bisnaga" | "frasco" | "gotas" | "ampola" | "spray" | "supositorio" | "generico";

function iconeDaForma(forma: string): Icone {
  const t = ` ${forma} `;
  if (/ (SPR|AER|INAL) /.test(t)) return "spray";
  if (/ SUP /.test(t)) return "supositorio";
  if (/ CAP /.test(t)) return "capsula";
  if (/ (COM|DRG|PAS|GOMA) /.test(t)) return "comprimido";
  if (/ (CREM|POM|GEL|UNG) /.test(t)) return "bisnaga";
  if (/ GOT /.test(t)) return "gotas";
  if (/ (INJ|LIOF|AMP) /.test(t)) return "ampola";
  if (/ (SOL|SUS|XPE|EMU|ELX|LOC|SHAMP|XAMP) /.test(t)) return "frasco";
  return "generico";
}

function DesenhoIcone({ tipo, cor }: { tipo: Icone; cor: string }) {
  const traco = { stroke: cor, strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (tipo) {
    case "comprimido":
      // Comprimido em perspectiva (face, espessura e sulco): um círculo cortado por uma diagonal
      // seria lido como sinal de proibido.
      return (
        <g {...traco}>
          <ellipse cx="16" cy="13" rx="10.5" ry="5.5" />
          <path d="M5.5 13v4.5c0 3 4.7 5.5 10.5 5.5s10.5-2.5 10.5-5.5V13" />
          <path d="M10 13h12" />
        </g>
      );
    case "capsula":
      return (
        <g {...traco} transform="rotate(-40 16 16)">
          <rect x="5" y="11" width="22" height="10" rx="5" />
          <path d="M16 11v10" />
          <path d="M16 11h6a5 5 0 0 1 0 10h-6z" fill={cor} fillOpacity="0.35" />
        </g>
      );
    case "bisnaga":
      return (
        <g {...traco}>
          <path d="M9 6h14l-2 17h-10z" />
          <rect x="12.5" y="23" width="7" height="4" rx="1" />
          <path d="M10.5 10h11" />
        </g>
      );
    case "frasco":
      return (
        <g {...traco}>
          <rect x="12" y="4" width="8" height="4" rx="1" />
          <path d="M13 8v3l-4 3v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V14l-4-3V8" />
          <path d="M9 18h14" />
        </g>
      );
    case "gotas":
      return (
        <g {...traco}>
          <path d="M16 5c4 6 7 9.5 7 13a7 7 0 0 1-14 0c0-3.5 3-7 7-13z" />
          <path d="M13 19a3 3 0 0 0 3 3" />
        </g>
      );
    case "ampola":
      return (
        <g {...traco}>
          <path d="M14 4h4v5l2 3v14a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V12l2-3z" />
          <path d="M12 12h8M13 19h6" />
        </g>
      );
    case "spray":
      return (
        <g {...traco}>
          <rect x="10" y="12" width="10" height="16" rx="2" />
          <path d="M12 12V8h6v4M18 8h3" />
          <circle cx="25" cy="6" r="0.6" fill={cor} />
          <circle cx="26.5" cy="9" r="0.6" fill={cor} />
          <circle cx="24.5" cy="11.5" r="0.6" fill={cor} />
        </g>
      );
    case "supositorio":
      return (
        <g {...traco}>
          <path d="M16 4c4 3 6 8 6 14v8h-12v-8c0-6 2-11 6-14z" />
        </g>
      );
    default:
      return (
        <g {...traco}>
          <rect x="7" y="9" width="18" height="16" rx="2" />
          <path d="M16 13v8M12 17h8" />
        </g>
      );
  }
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
  const cores = coresDaSubstancia(m.chave_equivalencia_ampla);
  const faixa = FAIXA[m.selo] ?? FAIXA_OUTRO;
  const tarja = fraseTarja(m.tarja);
  const via = viaDeUso(m.forma);
  const clip = `emb-${uid}`;

  // Áreas verticais da caixa (viewBox 240 x 168).
  const Y_FAIXA = 128;
  const ALTURA_TARJA = tarja ? (tarja.linhas.length > 1 ? 21 : 14) : 0;
  const Y_TARJA = Y_FAIXA - ALTURA_TARJA;
  const limiteTexto = tarja ? Y_TARJA - 4 : Y_FAIXA - 4;

  const nome = m.produto;
  const tamanho = nome.length <= 10 ? 20 : nome.length <= 17 ? 16.5 : 14;
  const porLinha = Math.floor(176 / (tamanho * 0.6));
  const linhasNome = quebrarLinhas(nome, porLinha, 2);
  const yNome = 38;
  const yDosagem = yNome + (linhasNome.length - 1) * tamanho * 1.05 + 17;
  const dosagem = dosagemExibicao(m);
  const conteudo = `Contém ${quantidadePorExtenso(m)}`;
  const substancias = m.substancia.map(capitalizar).join(" + ");
  const mostrarSubstancia = substancias && substancias.toUpperCase() !== nome.toUpperCase();
  const linhasSubst = mostrarSubstancia ? quebrarLinhas(substancias, 46, 1) : [];
  const ySubst = yDosagem + 14;
  const yConteudo = ySubst + (linhasSubst.length ? 13 : 0);
  const yVia = yConteudo + 12;
  const laboratorio = m.laboratorio.length > 46 ? `${m.laboratorio.slice(0, 45)}…` : m.laboratorio;

  return (
    <svg
      viewBox="0 0 240 168"
      className={className}
      role="img"
      style={{ fontFamily: FONTE }}
      aria-label={`Ilustração da caixa de ${m.produto}, ${dosagem}, ${conteudo.toLowerCase()}, ${faixa.linha1} ${faixa.linha2}, ${m.laboratorio}`}
    >
      {titulo && <title>{`${m.produto} ${dosagem}`}</title>}
      <defs>
        <clipPath id={clip}>
          <rect x="2" y="2" width="236" height="164" rx="7" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x="2" y="2" width="236" height="164" fill={cores.fundo} />
        <rect x="2" y="2" width="236" height="7" fill={cores.faixa} />

        {tarja && (
          <g>
            <rect x="2" y={Y_TARJA} width="236" height={ALTURA_TARJA} fill={tarja.cor} />
            {tarja.linhas.map((linha, i) => (
              <text
                key={i}
                x="120"
                y={Y_TARJA + 9.6 + i * 8}
                textAnchor="middle"
                fontSize={i === 0 ? 7 : 6.3}
                fontWeight="700"
                fill="#ffffff"
                letterSpacing="0.2"
              >
                {linha}
              </text>
            ))}
          </g>
        )}

        <rect x="2" y={Y_FAIXA} width="236" height="40" fill={faixa.fundo} />
        <text x="12" y={Y_FAIXA + 33} fontSize="38" fontWeight="900" fill={faixa.corLetra}>
          {faixa.letra}
        </text>
        <text x="46" y={Y_FAIXA + 16} fontSize="9.5" fontWeight="700" fill="#111111">
          {faixa.linha1}
        </text>
        <text x="46" y={Y_FAIXA + 31} fontSize={faixa.linha2.length > 12 ? 13 : 16} fontWeight="900" fill="#111111">
          {faixa.linha2}
        </text>
        {faixa.rodape && (
          <text x="230" y={Y_FAIXA + 31} textAnchor="end" fontSize="7" fontWeight="700" fill="#111111">
            {faixa.rodape}
          </text>
        )}
      </g>
      <rect x="2" y="2" width="236" height="164" rx="7" fill="none" stroke={cores.borda} strokeWidth="1.5" />

      <g transform="translate(203 15)">
        <circle cx="16" cy="16" r="15" fill="#ffffff" stroke={cores.borda} strokeWidth="1" />
        <DesenhoIcone tipo={iconeDaForma(m.forma)} cor={cores.icone} />
      </g>

      <text x="12" y={yNome} fontSize={tamanho} fontWeight="900" fill="#111111" letterSpacing="-0.2">
        {linhasNome.map((linha, i) => (
          <tspan key={i} x="12" dy={i === 0 ? 0 : tamanho * 1.05}>
            {linha}
          </tspan>
        ))}
      </text>
      <text x="12" y={yDosagem} fontSize="12" fontWeight="700" fill="#1f1f1f">
        {dosagem.length > 32 ? `${dosagem.slice(0, 31)}…` : dosagem || " "}
      </text>
      {linhasSubst.length > 0 && ySubst < limiteTexto && (
        <text x="12" y={ySubst} fontSize="8.5" fill="#3a3a3a">
          {linhasSubst[0]}
        </text>
      )}
      {yConteudo < limiteTexto && (
        <text x="12" y={yConteudo} fontSize="9" fill="#1f1f1f">
          {conteudo.length > 44 ? `${conteudo.slice(0, 43)}…` : conteudo}
        </text>
      )}
      {via && yVia < limiteTexto && (
        <text x="12" y={yVia} fontSize="7.5" fontWeight="700" fill="#1f1f1f" letterSpacing="0.3">
          {via}
        </text>
      )}
      <text x="12" y="19.5" fontSize="6.5" fontWeight="700" fill="#55555c" letterSpacing="0.2">
        {laboratorio}
      </text>
    </svg>
  );
}
