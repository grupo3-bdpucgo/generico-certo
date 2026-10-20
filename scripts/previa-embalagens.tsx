// Gera uma folha PNG com ilustrações de caixa (components/Embalagem.tsx) para revisar o desenho sem
// subir o site. Usa o sharp, que já é dependência do Transformers.js.
// Uso: npx tsx scripts/previa-embalagens.tsx [saida.png]

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import Embalagem from "../components/Embalagem";
import type { Medicamento } from "../lib/normalizacao";

const dados: Medicamento[] = JSON.parse(readFileSync("data/dados.json", "utf-8"));
const achar = (produto: string, f: (m: Medicamento) => boolean = () => true) =>
  dados.find((m) => m.produto === produto && !m.restricao_hospitalar && f(m));

const amostra = [
  achar("DORFLEX DIP", (m) => m.quantidade_num === 10),
  achar("DIPIRONA", (m) => m.laboratorio.startsWith("CIMED") && m.dosagem === "1000 MG"),
  achar("ATROVERAN DIP"),
  achar("NOVALGINA", (m) => /COM/.test(m.forma)),
  achar("PREGABALINA", (m) => m.selo === "Genérico"),
  achar("RIVOTRIL", (m) => /COM/.test(m.forma)),
  achar("DIPIRONA MONOIDRATADA", (m) => /GOT|SOL OR/.test(m.forma)),
  achar("TRANSPULMIN XAROPE ADULTO"),
  achar("NISTATINA", (m) => /CREM|POM/.test(m.forma)),
  achar("STAMARIL"),
  achar("FLORATIL", (m) => /CAP/.test(m.forma)),
  achar("AMOXICILINA", (m) => /SUS/.test(m.forma)),
  // Dosagem longa (três substâncias) ao lado do ícone.
  achar("DORFLEX", (m) => /SOL/.test(m.forma)),
  achar("TRANSPULMIN XAROPE INFANTIL"),
].filter((m): m is Medicamento => Boolean(m));

const COLUNAS = 4;
const L = 360;
const A = 252;
const celulas = amostra
  .map((m, i) => {
    // O conversor não conhece a fonte do site (variável CSS): cai direto no Arial.
    const svg = renderToStaticMarkup(<Embalagem m={m} uid={i} />)
      .replace("var(--font-caixa), ", "").replace("<svg", `<svg x="${(i % COLUNAS) * (L + 16) + 16}" y="${Math.floor(i / COLUNAS) * (A + 16) + 16}" width="${L}" height="${A}"`);
    return svg;
  })
  .join("");
const largura = COLUNAS * (L + 16) + 16;
const altura = Math.ceil(amostra.length / COLUNAS) * (A + 16) + 16;
const folha = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}"><rect width="100%" height="100%" fill="#efece6"/>${celulas}</svg>`;
const saida = process.argv[2] ?? "previa-embalagens.png";
await sharp(Buffer.from(folha)).png().toFile(saida);
console.log(`${amostra.length} caixas em ${saida}`);
