// Etapa 1 (Data Engineer): lê a aba "Lista PMC" da CMED, normaliza, filtra e gera data/dados.json.
// Uso: npm run limpar

import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import {
  analisarApresentacao,
  colunaPreco,
  grupoForma,
  limparCampo,
  montarTextoEmbedding,
  montarTextoEnriquecido,
  normalizarTarja,
  numeroBR,
  seloDoTipo,
  separarSubstancias,
  substanciaCanonica,
  termosPopulares,
  unidadeDoPreco,
  type DicionarioIndicacoes,
  type Medicamento,
} from "../lib/normalizacao";

const ARQUIVO = "data/cmed.xlsx";
const DICIONARIO = "data/dicionario-indicacoes.json";
const SAIDA = "data/dados.json";
const ABA = "Lista PMC";
const ALIQUOTA = process.env.ALIQUOTA_ICMS ?? "19";

const COL_PMC = colunaPreco("PMC", ALIQUOTA);
const COL_PF = colunaPreco("PF", ALIQUOTA);

const dicionario: DicionarioIndicacoes = JSON.parse(readFileSync(DICIONARIO, "utf-8"));
console.log(`Lendo ${ARQUIVO} (aba "${ABA}"), alíquota ${ALIQUOTA}%: ${COL_PMC} / ${COL_PF}`);
const wb = XLSX.read(readFileSync(ARQUIVO), { dense: true });
const aba = wb.Sheets[ABA];
if (!aba) throw new Error(`Aba "${ABA}" não encontrada. Abas: ${wb.SheetNames.join(", ")}`);

const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: null, raw: false });
if (!(COL_PMC in linhas[0])) throw new Error(`Coluna "${COL_PMC}" não existe na planilha`);

const descarte = { naoComercializado: 0, semPmc: 0, ggremDuplicado: 0 };
const vistos = new Set<string>();
const saida: Medicamento[] = [];

for (const l of linhas) {
  if (limparCampo(l["COMERCIALIZAÇÃO 2025"]) !== "Sim") {
    descarte.naoComercializado++;
    continue;
  }
  const pmc = numeroBR(l[COL_PMC]);
  if (pmc === null || pmc <= 0) {
    descarte.semPmc++;
    continue;
  }
  const ggrem = limparCampo(l["CÓDIGO GGREM"]) ?? "";
  if (vistos.has(ggrem)) {
    descarte.ggremDuplicado++;
    continue;
  }
  vistos.add(ggrem);

  const produto = limparCampo(l["PRODUTO"]) ?? "";
  const apresentacao = limparCampo(l["APRESENTAÇÃO"]) ?? "";
  const substancia = separarSubstancias(limparCampo(l["SUBSTÂNCIA"]));
  const classe = limparCampo(l["CLASSE TERAPÊUTICA"]);
  const tipo = limparCampo(l["TIPO DE PRODUTO (STATUS DO PRODUTO)"]);
  const partes = analisarApresentacao(apresentacao);
  const textoBase = montarTextoEmbedding({ produto, substancia, classe, dosagem: partes.dosagem, forma: partes.forma });

  const substanciasChave = [...new Set(substancia.map(substanciaCanonica))].sort();
  const termos = termosPopulares(dicionario, classe, substanciasChave);
  // estrita: mesma caixa; ampla: qualquer caixa (comparada por preço por unidade)
  const chaveAmpla = [substanciasChave.join(" + "), partes.dosagem, partes.formaBase].join(" | ");
  const chave = [chaveAmpla, partes.quantidade].join(" | ");
  const precoPorUnidade =
    partes.quantidadeNum && partes.quantidadeNum > 0 ? Number((pmc / partes.quantidadeNum).toFixed(4)) : null;

  saida.push({
    id: saida.length + 1,
    ggrem,
    produto,
    substancia,
    laboratorio: limparCampo(l["LABORATÓRIO"]) ?? "",
    cnpj: limparCampo(l["CNPJ"]),
    apresentacao,
    classe,
    tipo_produto: tipo,
    selo: seloDoTipo(tipo),
    pmc,
    pf: numeroBR(l[COL_PF]),
    registro: limparCampo(l["REGISTRO"]),
    ean: limparCampo(l["EAN 1"]),
    tarja: normalizarTarja(limparCampo(l["TARJA"])),
    generico: tipo === "Genérico",
    restricao_hospitalar: limparCampo(l["RESTRIÇÃO HOSPITALAR"]) === "Sim",
    dosagem: partes.dosagem,
    forma: partes.forma,
    quantidade: partes.quantidade,
    quantidade_num: partes.quantidadeNum,
    unidade: unidadeDoPreco(partes.forma, partes.quantidade),
    forma_grupo: grupoForma(partes.forma, apresentacao),
    doses: partes.dosagem ? partes.dosagem.split(" + ") : [],
    preco_por_unidade: precoPorUnidade,
    chave_equivalencia: chave,
    chave_equivalencia_ampla: chaveAmpla,
    termos_populares: termos,
    texto_embedding: textoBase,
    texto_enriquecido: montarTextoEnriquecido(textoBase, termos),
  });
}

writeFileSync(SAIDA, JSON.stringify(saida));

// ---------------------------------------------------------------- relatório no console
const contar = (f: (m: Medicamento) => string) =>
  Object.fromEntries(
    Object.entries(
      saida.reduce<Record<string, number>>((acc, m) => ((acc[f(m)] = (acc[f(m)] ?? 0) + 1), acc), {}),
    ).sort((a, b) => b[1] - a[1]),
  );
const grupos = contar((m) => m.chave_equivalencia);
const gruposComGenerico = new Set(saida.filter((m) => m.generico).map((m) => m.chave_equivalencia));
const gruposMultiplos = Object.entries(grupos).filter(([, n]) => n > 1);
const gruposAmplos = contar((m) => m.chave_equivalencia_ampla);
const amplosComGenerico = new Set(saida.filter((m) => m.generico).map((m) => m.chave_equivalencia_ampla));

console.log(`\nRegistros lidos:            ${linhas.length}`);
console.log(`Descartados (não comerc.):  ${descarte.naoComercializado}`);
console.log(`Descartados (sem PMC):      ${descarte.semPmc}`);
console.log(`Descartados (GGREM dup.):   ${descarte.ggremDuplicado}`);
console.log(`Registros finais:           ${saida.length}`);
console.log(`Chaves de equivalência:     ${Object.keys(grupos).length} (${gruposMultiplos.length} com 2+ itens, ${gruposComGenerico.size} com genérico)`);
console.log(`Chaves amplas (sem caixa):  ${Object.keys(gruposAmplos).length} (${Object.values(gruposAmplos).filter((n) => n > 1).length} com 2+ itens, ${amplosComGenerico.size} com genérico)`);
console.log(`Com termos populares:       ${saida.filter((m) => m.termos_populares.length).length} (${((100 * saida.filter((m) => m.termos_populares.length).length) / saida.length).toFixed(1)}%)`);
console.log(`Sem dosagem extraída:       ${saida.filter((m) => !m.dosagem).length}`);
console.log(`Sem quantidade extraída:    ${saida.filter((m) => !m.quantidade).length}`);
console.log("Por unidade:", contar((m) => m.unidade));
console.log("Por grupo de forma:", contar((m) => m.forma_grupo));
console.log("Por selo:", contar((m) => m.selo));
console.log("Por tarja:", contar((m) => m.tarja));
console.log(`\nGerado ${SAIDA}`);
