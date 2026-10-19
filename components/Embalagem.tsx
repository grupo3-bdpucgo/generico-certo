// Ilustração SVG em estilo de embalagem, montada só com os campos do registro da CMED.
// A fonte oficial não fornece imagens. A ilustração é própria e estilizada: não reproduz a
// embalagem real nem a identidade visual de nenhum laboratório.
//  - fundo: cor suave derivada de um hash das substâncias canônicas (equivalentes ficam iguais)
//  - faixa lateral: cor do selo (genérico, similar, referência, outros)
//  - ícone da forma farmacêutica no canto

import { dosagemExibicao, quantidadePorExtenso } from "@/lib/formatacao";
import type { MedicamentoResumo } from "@/lib/normalizacao";

type Dados = Pick<
  MedicamentoResumo,
  | "produto" | "dosagem" | "apresentacao" | "forma" | "quantidade_num" | "unidade" | "laboratorio" | "selo"
  | "chave_equivalencia_ampla"
>;

export const COR_SELO: Record<string, { fundo: string; tinta: string }> = {
  "Genérico": { fundo: "#f2b705", tinta: "#3d2e00" },
  Similar: { fundo: "#1d4ed8", tinta: "#ffffff" },
  "Referência": { fundo: "#6d28d9", tinta: "#ffffff" },
};
const COR_OUTRO = { fundo: "#5f6368", tinta: "#ffffff" };

/** FNV-1a de 32 bits: estável entre servidor e navegador. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Fundo claro (L 94%) com texto quase preto: contraste acima de 14:1 em qualquer matiz. */
export function coresDaSubstancia(chaveAmpla: string) {
  const substancias = chaveAmpla.split(" | ")[0] ?? chaveAmpla;
  const matiz = hash(substancias) % 360;
  return {
    fundo: `hsl(${matiz} 62% 94%)`,
    tampa: `hsl(${matiz} 48% 86%)`,
    borda: `hsl(${matiz} 28% 70%)`,
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
  if (linhas.length > maxLinhas) {
    const cortadas = linhas.slice(0, maxLinhas);
    cortadas[maxLinhas - 1] = `${cortadas[maxLinhas - 1].slice(0, porLinha - 1)}…`;
    return cortadas;
  }
  return linhas.map((l) => (l.length > porLinha + 2 ? `${l.slice(0, porLinha)}…` : l));
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
      return (
        // Comprimido em perspectiva (face, espessura e sulco). Um círculo cortado por uma
        // diagonal seria lido como sinal de proibido.
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
  const selo = COR_SELO[m.selo] ?? COR_OUTRO;
  const clip = `emb-${uid}`;

  const nome = m.produto;
  const tamanho = nome.length <= 10 ? 21 : nome.length <= 18 ? 17 : 14.5;
  const porLinha = Math.floor(158 / (tamanho * 0.62));
  const linhasNome = quebrarLinhas(nome, porLinha, 3);
  const yNome = 46;
  const yDosagem = yNome + (linhasNome.length - 1) * tamanho * 1.08 + 20;
  const descricao = quantidadePorExtenso(m);
  const dosagem = dosagemExibicao(m);
  const laboratorio = m.laboratorio.length > 40 ? `${m.laboratorio.slice(0, 39)}…` : m.laboratorio;
  const rotuloSelo = (m.selo === "Não informado" ? "Outro" : m.selo).toUpperCase();

  return (
    <svg
      viewBox="0 0 240 150"
      className={className}
      role="img"
      aria-label={`Ilustração da embalagem de ${m.produto}, ${dosagem}, ${descricao}, ${m.laboratorio}`}
    >
      {titulo && <title>{`${m.produto} ${dosagem}`}</title>}
      <defs>
        <clipPath id={clip}>
          <rect x="3" y="3" width="234" height="144" rx="14" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect x="3" y="3" width="234" height="144" fill={cores.fundo} />
        <rect x="3" y="3" width="234" height="15" fill={cores.tampa} />
        <path d="M3 18H237" stroke={cores.borda} strokeWidth="1" strokeDasharray="3 3" />
        <rect x="3" y="3" width="21" height="144" fill={selo.fundo} />
        <text
          transform="translate(17.5 75) rotate(-90)"
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="700"
          letterSpacing="1.4"
          fill={selo.tinta}
        >
          {rotuloSelo}
        </text>
      </g>
      <rect x="3" y="3" width="234" height="144" rx="14" fill="none" stroke={cores.borda} strokeWidth="1.5" />

      <g transform="translate(196 25)">
        <circle cx="16" cy="16" r="17" fill="#ffffff" fillOpacity="0.75" />
        <DesenhoIcone tipo={iconeDaForma(m.forma)} cor={cores.icone} />
      </g>

      <text x="34" y={yNome} fontSize={tamanho} fontWeight="800" fill="#141417" letterSpacing="-0.2">
        {linhasNome.map((linha, i) => (
          <tspan key={i} x="34" dy={i === 0 ? 0 : tamanho * 1.08}>
            {linha}
          </tspan>
        ))}
      </text>
      <text x="34" y={yDosagem} fontSize="12.5" fontWeight="700" fill="#26262b">
        {dosagem.length > 30 ? `${dosagem.slice(0, 29)}…` : dosagem || " "}
      </text>
      <text x="34" y={yDosagem + 16} fontSize="10.5" fill="#33333a">
        {descricao.length > 38 ? `${descricao.slice(0, 37)}…` : descricao}
      </text>
      <text x="34" y="138" fontSize="8.5" fill="#4b4b52">
        {laboratorio}
      </text>
    </svg>
  );
}
