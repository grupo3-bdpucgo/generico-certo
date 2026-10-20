# Relatório técnico: como compilar no Overleaf

O relatório está em `docs/relatorio.tex`, na classe **abnTeX2**, e foi escrito para compilar com **pdfLaTeX + BibTeX**. Não é preciso instalar LaTeX no computador: o Overleaf já tem todos os pacotes usados.

## Arquivos que vão para o Overleaf

Suba a pasta `docs/` mantendo esta estrutura:

```
relatorio.tex          documento principal
referencias.bib        referências em ABNT (lidas pelo abntex2cite)
puc.png                logo da PUC Goiás usada na capa
figuras/
  fig1-acerto-por-motor.pdf
  fig2-evolucao-vetorial.pdf
  fig3-acerto-por-categoria.pdf
  fig4-tempo-de-resposta.pdf
  fig5-posicao-por-consulta.pdf
```

Os PNGs da pasta `figuras/` e os arquivos `.md` não são usados pelo `.tex` e podem ficar de fora.

## Passo a passo

1. No Overleaf, clique em **New Project > Upload Project** e envie um `.zip` com o conteúdo da pasta `docs/` (os arquivos acima, com `relatorio.tex` na raiz do zip). Para gerar o zip no Windows, selecione os arquivos dentro de `docs/`, clique com o botão direito e escolha *Compactar para arquivo ZIP*.
2. Abra o menu do projeto (ícone no canto superior esquerdo) e confira:
   - **Compiler:** `pdfLaTeX`
   - **Main document:** `relatorio.tex`
   - **TeX Live version:** a mais recente disponível
3. Clique em **Recompile**. O Overleaf roda o `latexmk`, que executa pdfLaTeX, BibTeX e pdfLaTeX de novo até as referências e o sumário estabilizarem. Na primeira vez pode levar cerca de um minuto.

Se as citações aparecerem como `[?]` ou o sumário vier vazio, clique em **Recompile** mais uma vez. Se continuar, use *Logs and output files > Clear cached files* e recompile.

## Logo da PUC Goiás

O arquivo `puc.png` é a logo oficial da PUC Goiás (brasão com "PUC GOIÁS"), a mesma de `public/puc-logo.png`. Na capa ela aparece com 3,4 cm de largura; para mudar, edite `\includegraphics[width=3.4cm]{puc.png}` no começo do `.tex`.

## Atualizar as figuras

As figuras são geradas a partir de `benchmark/resultados.json`:

```bash
python scripts/graficos.py        # na raiz do repositório; requer matplotlib
```

Depois, envie de novo os PDFs de `docs/figuras/` para o Overleaf (arraste para a pasta `figuras/` do projeto, substituindo os antigos). Os números das tabelas do capítulo 6 foram copiados da execução final do benchmark; se o benchmark for refeito, atualize também as Tabelas de acurácia, evolução, negação e tempos.

## Pacotes usados

Todos fazem parte do TeX Live: `abntex2` (classe e `abntex2cite`), `newtx` (fonte Times), `listings`, `tikz`, `amsmath`, `amssymb`, `graphicx`, `xcolor`, `array`, `microtype`, `seqsplit` e `indentfirst`.

## Se precisar de uma versão em Word

Se o grupo não conseguir compilar no Overleaf, peça uma versão `.docx` com a mesma estrutura (capa, sumário, capítulos, tabelas e figuras).
