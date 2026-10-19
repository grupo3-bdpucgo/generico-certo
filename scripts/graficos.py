"""Gera as figuras do benchmark a partir de benchmark/resultados.json (papel: Data Analyst).

Saída em docs/figuras/: PDF vetorial (usado no relatório, compila no Overleaf) e PNG 300 dpi.
Uso: python scripts/graficos.py   (requer matplotlib)

Convenções: cada motor tem sempre a mesma cor (slots 1 a 5 da paleta categórica, ordem fixa);
como três dessas cores ficam abaixo de 3:1 de contraste sobre o fundo, todo valor é rotulado
diretamente. Mapas de calor usam uma única rampa sequencial azul. As figuras usam as 25
consultas que não foram usadas no desenvolvimento; a tabela do relatório traz também as 28.
"""

import json
import statistics
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "docs" / "figuras"
SAIDA.mkdir(parents=True, exist_ok=True)
R = json.loads((RAIZ / "benchmark" / "resultados.json").read_text(encoding="utf-8"))

MOTORES = ["denso_base", "denso", "hibrido", "ilike", "fulltext"]
NOMES = {
    "denso_base": "Denso\nbase",
    "denso": "Denso\nenriquecido",
    "hibrido": "Híbrido\n(RRF)",
    "ilike": "PostgreSQL\nILIKE",
    "fulltext": "PostgreSQL\nfull text",
}
NOMES_LINHA = {
    "denso_base": "Denso sem enriquecimento",
    "denso": "Denso com enriquecimento",
    "hibrido": "Híbrido (RRF)",
    "ilike": "PostgreSQL ILIKE",
    "fulltext": "PostgreSQL full text",
}
CORES = dict(zip(MOTORES, ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"]))
CATEGORIAS = {
    "nome_comercial": "Nome comercial",
    "erro_digitacao": "Erro de digitação",
    "variacao_nomenclatura": "Variação de nomenclatura",
    "principio_ativo": "Princípio ativo",
    "coloquial": "Coloquial",
    "mista": "Mista",
}
TEXTO, TEXTO_2, GRADE, FUNDO = "#0b0b0b", "#52514e", "#e4e3df", "#ffffff"
RAMPA = LinearSegmentedColormap.from_list(
    "azul", ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]
)

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 9,
    "axes.edgecolor": GRADE,
    "axes.labelcolor": TEXTO_2,
    "axes.titlesize": 10,
    "axes.titleweight": "bold",
    "axes.titlecolor": TEXTO,
    "xtick.color": TEXTO_2,
    "ytick.color": TEXTO,
    "figure.facecolor": FUNDO,
    "axes.facecolor": FUNDO,
    "savefig.facecolor": FUNDO,
})

pct = lambda v: f"{v * 100:.0f}%".replace(".", ",")
dec = lambda v, c=1: f"{v:.{c}f}".replace(".", ",")
SEM_DEV = R["agregados"]["sem_desenvolvimento"]


def limpar_eixos(ax, eixo_valor="x"):
    for lado in ("top", "right", "left" if eixo_valor == "x" else "bottom"):
        ax.spines[lado].set_visible(False)
    ax.grid(axis=eixo_valor, color=GRADE, linewidth=0.6)
    ax.set_axisbelow(True)
    ax.tick_params(length=0)


def salvar(fig, nome):
    for ext in ("pdf", "png"):
        fig.savefig(SAIDA / f"{nome}.{ext}", dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"docs/figuras/{nome}.pdf/.png")


def barras_horizontais(ax, valores, titulo, linha_acaso=None, formato=pct, limite=1.0):
    ordem = list(reversed(MOTORES))
    y = range(len(ordem))
    ax.barh(y, [valores[m] for m in ordem], color=[CORES[m] for m in ordem], height=0.62, edgecolor=FUNDO, linewidth=2)
    for i, m in enumerate(ordem):
        ax.text(valores[m] + limite * 0.015, i, formato(valores[m]), va="center", color=TEXTO, fontsize=9)
    ax.set_yticks(list(y), [NOMES_LINHA[m] for m in ordem])
    ax.set_xlim(0, limite * 1.12)
    ax.set_title(titulo, loc="left")
    if linha_acaso is not None:
        ax.axvline(linha_acaso, color=TEXTO_2, linestyle=(0, (3, 2)), linewidth=1)
        ax.text(linha_acaso, -0.55, f" acaso {pct(linha_acaso)}", color=TEXTO_2, fontsize=8, va="center")
        ax.set_ylim(-0.75, len(ordem) - 0.5)
    if formato is pct:
        ax.xaxis.set_major_formatter(lambda v, _: pct(v))
    limpar_eixos(ax)


# Figura 1: acerto no top 5, simples e ponderado pela dificuldade
fig, eixos = plt.subplots(1, 2, figsize=(8.2, 3.0), sharey=True)
barras_horizontais(eixos[0], {m: SEM_DEV[m]["acerto_top5"] for m in MOTORES}, "Acerto no top 5",
                   SEM_DEV["denso"]["acaso_top5_medio"])
barras_horizontais(eixos[1], {m: SEM_DEV[m]["acerto_top5_ponderado"] for m in MOTORES},
                   "Acerto no top 5 ponderado por (1 - p_acaso)")
fig.tight_layout(w_pad=2)
salvar(fig, "fig1-acerto-por-motor")

# Figura 2: evolução da busca vetorial (antes e depois)
fig, eixos = plt.subplots(1, 3, figsize=(8.2, 2.6))
etapas = ["denso_base", "denso", "hibrido"]
for ax, (chave, titulo, fmt) in zip(eixos, [
    ("acerto_top5_ponderado", "Acerto no top 5 ponderado", pct),
    ("mrr_top10", "MRR@10", lambda v: dec(v, 2)),
    ("nao_encontrados_top10", "Consultas sem acerto no top 10", lambda v: f"{v:.0f}"),
]):
    vals = [SEM_DEV[m][chave] for m in etapas]
    ax.bar(range(3), vals, color=[CORES[m] for m in etapas], width=0.6, edgecolor=FUNDO, linewidth=2)
    topo = max(vals) if max(vals) > 0 else 1
    for i, v in enumerate(vals):
        ax.text(i, v + topo * 0.03, fmt(v), ha="center", color=TEXTO, fontsize=9)
    ax.set_xticks(range(3), [NOMES[m] for m in etapas], fontsize=8)
    ax.set_ylim(0, topo * 1.2)
    ax.set_yticks([])
    ax.set_title(titulo, loc="left", fontsize=9)
    limpar_eixos(ax, "y")
    ax.spines["left"].set_visible(False)
    ax.grid(False)
fig.tight_layout(w_pad=1.5)
salvar(fig, "fig2-evolucao-vetorial")

# Figura 3: acerto no top 5 por categoria e motor (mapa de calor)
por_cat = R["agregados"]["por_categoria_sem_desenvolvimento"]
cats = [c for c in CATEGORIAS if c in por_cat and por_cat[c]["hibrido"]["consultas"] > 0]
matriz = [[por_cat[c][m]["acerto_top5"] for m in MOTORES] for c in cats]
fig, ax = plt.subplots(figsize=(7.2, 3.1))
ax.imshow(matriz, cmap=RAMPA, vmin=0, vmax=1, aspect="auto")
for i, linha in enumerate(matriz):
    for j, v in enumerate(linha):
        ax.text(j, i, pct(v), ha="center", va="center", color="#ffffff" if v >= 0.55 else TEXTO, fontsize=9)
ax.set_xticks(range(len(MOTORES)), [NOMES[m] for m in MOTORES], fontsize=8)
ax.set_yticks(range(len(cats)), [f"{CATEGORIAS[c]} (n={por_cat[c]['hibrido']['consultas']})" for c in cats])
ax.tick_params(length=0)
ax.xaxis.tick_top()
for lado in ax.spines.values():
    lado.set_visible(False)
ax.set_xticks([x - 0.5 for x in range(1, len(MOTORES))], minor=True)
ax.set_yticks([y - 0.5 for y in range(1, len(cats))], minor=True)
ax.grid(which="minor", color=FUNDO, linewidth=2)
ax.tick_params(which="minor", length=0)
fig.tight_layout()
salvar(fig, "fig3-acerto-por-categoria")

# Figura 4: tempo de resposta do banco por consulta (mediana de 5 repetições)
consultas_novas = {c["id"] for c in R["consultas"] if not c["desenvolvimento"]}
fig, ax = plt.subplots(figsize=(7.6, 2.9))
ordem = list(reversed(MOTORES))
maximo = 0
for i, m in enumerate(ordem):
    tempos = [x["tempo_banco_ms"] for x in R["medicoes"] if x["motor"] == m and x["consulta_id"] in consultas_novas]
    maximo = max(maximo, max(tempos))
    deslocamentos = [((k % 5) - 2) * 0.07 for k in range(len(tempos))]
    ax.scatter(tempos, [i + d for d in deslocamentos], s=22, color=CORES[m], edgecolor=FUNDO, linewidth=1, zorder=3)
    med = statistics.median(tempos)
    ax.plot([med, med], [i - 0.32, i + 0.32], color=TEXTO, linewidth=2, zorder=4)
    ax.text(med, i + 0.36, f"mediana {dec(med, 0)} ms", ha="center", fontsize=8, color=TEXTO)
ax.set_yticks(range(len(ordem)), [NOMES_LINHA[m] for m in ordem])
ax.set_xlim(0, maximo * 1.08)
ax.set_ylim(-0.6, len(ordem) - 0.2)
ax.set_xlabel("tempo de resposta do banco (ms, mediana de 5 repetições por consulta)")
limpar_eixos(ax)
fig.tight_layout()
salvar(fig, "fig4-tempo-de-resposta")

# Figura 5: posição do primeiro resultado correto, por consulta e motor
consultas = sorted(R["consultas"], key=lambda c: (list(CATEGORIAS).index(c["categoria"]), c["id"]))
pos = {(x["consulta_id"], x["motor"]): x["posicao_primeiro_correto"] for x in R["medicoes"]}
fig, ax = plt.subplots(figsize=(7.4, 8.2))
for i, c in enumerate(consultas):
    for j, m in enumerate(MOTORES):
        p = pos[(c["id"], m)]
        if p is None:
            cor, rotulo, tinta = "#f1f0ed", "–", TEXTO_2
        else:
            cor = RAMPA(1 - (p - 1) / 9 * 0.85)
            rotulo, tinta = str(p), "#ffffff" if p <= 4 else TEXTO
        ax.add_patch(plt.Rectangle((j, i), 1, 1, facecolor=cor, edgecolor=FUNDO, linewidth=2))
        ax.text(j + 0.5, i + 0.5, rotulo, ha="center", va="center", color=tinta, fontsize=8)
ax.set_xlim(0, len(MOTORES))
ax.set_ylim(len(consultas), 0)
ax.set_xticks([j + 0.5 for j in range(len(MOTORES))], [NOMES[m] for m in MOTORES], fontsize=8)
ax.xaxis.tick_top()
ax.set_yticks(
    [i + 0.5 for i in range(len(consultas))],
    [f"#{c['id']} {c['consulta']}{' *' if c['desenvolvimento'] else ''}" for c in consultas],
    fontsize=8,
)
ax.tick_params(length=0)
for lado in ax.spines.values():
    lado.set_visible(False)
anterior = None
for i, c in enumerate(consultas):
    if c["categoria"] != anterior:
        if anterior is not None:
            ax.axhline(i, color=TEXTO_2, linewidth=0.8)
        anterior = c["categoria"]
fig.text(0.01, 0.005, "Número = posição do primeiro resultado correto no top 10; – = nenhum correto no top 10; "
         "* = consulta usada no desenvolvimento.", fontsize=7.5, color=TEXTO_2)
fig.tight_layout(rect=(0, 0.02, 1, 1))
salvar(fig, "fig5-posicao-por-consulta")
