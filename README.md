# Genérico Certo

**Descubra o genérico equivalente e quanto você economiza.**

Projeto acadêmico de banco de dados vetorial da disciplina de Tópicos de Bancos de Dados (Ciência da Computação, PUC Goiás, 2026). Site: <https://generico-certo.vercel.app>

Muita gente deixa de comprar remédio por achar caro, sem saber que existe genérico do mesmo princípio ativo bem mais barato. O obstáculo é o vocabulário: a pessoa conhece o nome comercial ("Dorflex") e não o princípio ativo ("dipirona + citrato de orfenadrina + cafeína"), e a busca por texto exato falha. No Genérico Certo a pessoa escreve do jeito que sabe (nome comercial, princípio ativo, erro de digitação ou o sintoma) e recebe, por similaridade semântica, os medicamentos equivalentes ordenados por preço, com a economia em reais e em porcentagem.

Os dados são a Lista de Preços de Medicamentos da CMED/ANVISA (arquivo PMC, edição de 09/10/2026), com 11.001 apresentações comercializadas em 2025 e com preço máximo ao consumidor válido. Os valores exibidos são o teto legal (PMC com ICMS de 19%, alíquota de Goiás); o preço na farmácia pode ser menor. A ferramenta é informativa e não substitui orientação médica ou farmacêutica.

## Para o grupo: onde olhar cada coisa

- Código do trabalho: <https://github.com/grupo3-bdpucgo/generico-certo>
- Site no ar: <https://generico-certo.vercel.app>

Dá para ler tudo direto pelo navegador, sem baixar nada e sem ter conta.

| Arquivo | O que tem |
|---|---|
| [`docs/relatorio.pdf`](docs/relatorio.pdf) | o relatório pronto para ler (o GitHub abre o PDF no navegador) |
| [`docs/relatorio.tex`](docs/relatorio.tex) | o código-fonte do relatório, em LaTeX |
| `README.md` | esta página: visão geral do projeto e como rodar |
| [`lib/busca.ts`](lib/busca.ts) | a busca híbrida (vetorial + trigramas) |
| [`lib/qdrant.ts`](lib/qdrant.ts) | a configuração do banco vetorial |
| [`lib/postgres.ts`](lib/postgres.ts) | a busca relacional, usada na comparação |
| [`scripts/`](scripts/) `01` a `04` | limpeza, ingestão, base relacional e benchmark |
| [`benchmark/resultados.json`](benchmark/resultados.json) | os números do experimento |
| [`docs/figuras/`](docs/figuras/) | os gráficos |

Quem quiser rodar na máquina precisa do arquivo de configuração com as chaves (`.env.local`), que não fica no repositório: peça ao Brunno.

## Como funciona

```
 data/cmed.xlsx ──01-limpar──► data/dados.json ──02-ingerir──► Qdrant Cloud (collection "medicamentos")
 (CMED/ANVISA)     normaliza,      11.001 registros,  embeddings      vetores: denso_base, denso, lexical
                   filtra, chaves  texto enriquecido  (Transformers.js) payload + 12 índices
                        │
                        └─────────────03-postgres──► PostgreSQL (Neon): mesma base, ILIKE e full text

 Next.js (Vercel) ── /buscar      busca híbrida (denso + trigramas, fusão RRF)
                  ── /medicamento comparação de preços entre equivalentes
                  ── /comparativo os 5 motores lado a lado + resultado do benchmark
```

- **Busca padrão do site: híbrida.** Vetor denso (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 384 dimensões, cosseno, índice HNSW) para significado e linguagem coloquial, mais um vetor esparso de trigramas de caracteres para nomes comerciais e erros de digitação, fundidos por *Reciprocal Rank Fusion* numa única chamada da Query API do Qdrant.
- **Dicionário de indicações** (`data/dicionario-indicacoes.json`): termos leigos por classe terapêutica e substância ("dor, febre", "azia"), curados pelo grupo. É conhecimento externo à CMED, sem valor clínico, congelado no commit `aa9df01` antes do benchmark.
- **Equivalência:** `chave_equivalencia` (substâncias canônicas + dosagem + forma + quantidade) compara caixas iguais; `chave_equivalencia_ampla` (sem a quantidade) compara caixas de tamanhos diferentes pelo preço por unidade.
- **Ilustrações:** a CMED não fornece imagens; cada embalagem é um SVG gerado dos campos do registro.

## Resultado do benchmark

25 consultas de teste escritas depois do congelamento do dicionário (mais 3 usadas no desenvolvimento), em seis categorias. Detalhes em `benchmark/` e no relatório (`docs/relatorio.tex`).

| Motor | Banco | Acerto no top 5 | MRR@10 | Precisão no top 5 | Tempo no servidor |
|---|---|---|---|---|---|
| Denso sem enriquecimento | Qdrant | 28% | 0,17 | 0,16 | 1,5 ms |
| Denso com enriquecimento | Qdrant | 40% | 0,29 | 0,25 | 1,4 ms |
| **Híbrido (RRF)** | Qdrant | **80%** | **0,66** | 0,42 | 2,9 ms |
| ILIKE | PostgreSQL | 36% | 0,36 | 0,35 | 45,1 ms |
| Full text | PostgreSQL | 68% | 0,65 | **0,64** | 0,4 ms |

## Pré-requisitos

- Node.js 22 ou superior
- Conta no [Qdrant Cloud](https://cloud.qdrant.io) (cluster free) e no [Neon](https://neon.tech) (PostgreSQL free), de preferência na mesma região (usamos AWS São Paulo, `sa-east-1`)
- Python 3.10+ com `matplotlib`, só para gerar as figuras do benchmark
- Opcional: [Vercel CLI](https://vercel.com/docs/cli) para o deploy

## Setup

```bash
npm install
cp .env.local.example .env.local      # preencha QDRANT_URL, QDRANT_API_KEY e DATABASE_URL
```

Baixe a Lista de Preços (arquivo PMC em formato xlsx) em <https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos> e salve como `data/cmed.xlsx`. A pasta `data/` não é versionada, exceto o dicionário de indicações.

Variáveis de ambiente (`.env.local`):

| Variável | Uso |
|---|---|
| `QDRANT_URL`, `QDRANT_API_KEY` | cluster do Qdrant Cloud |
| `QDRANT_COLLECTION` | nome da collection (padrão `medicamentos`) |
| `DATABASE_URL` | conexão *pooled* do Neon, com `sslmode=verify-full` |
| `ALIQUOTA_ICMS` | alíquota usada nas colunas `PMC xx %` e `PF xx %` (padrão `19`, Goiás) |
| `EMBEDDING_MODEL` | modelo do Transformers.js (padrão `Xenova/paraphrase-multilingual-MiniLM-L12-v2`) |

## Pipeline de dados

Rode na ordem. Cada script imprime o que fez e onde gravou.

| Comando | O que faz | Tempo aproximado |
|---|---|---|
| `npm run limpar` | lê a aba "Lista PMC", converte preços, descarta não comercializados e sem PMC, gera chaves e textos em `data/dados.json` | 20 s |
| `npm run ingerir` | cria a collection (3 vetores nomeados, HNSW, índices de payload) e envia os 11.001 pontos | 10 min |
| `npm run ingerir -- --so-lexical` | regrava só o vetor esparso, sem gerar embeddings | 5 s |
| `npm run postgres` | cria a base relacional equivalente no Neon (unaccent, pg_trgm, tsvector) e mostra uma amostra | 5 s |
| `npx tsx scripts/verificar-consultas.ts` | confere viabilidade do gabarito e vazamento para o dicionário, sem rodar motores | 2 s |
| `npm run benchmark` | 28 consultas nos 5 motores, 5 repetições, grava `benchmark/resultados.json` | 4 min |
| `npx tsx --env-file-if-exists=.env.local scripts/verificar-determinismo.ts` | confirma que os 5 motores devolvem o mesmo top 10 em execuções repetidas | 3 min |
| `python scripts/graficos.py` | gera as figuras em `docs/figuras/` (PDF e PNG) | 10 s |

Na primeira ingestão os vetores da linha de base (`denso_base`) são guardados em `data/vetores-base.json`; as ingestões seguintes reaproveitam esse arquivo.

## Rodar o site

```bash
npm run dev           # http://localhost:3000 (resultados em /buscar?q=...)
npm run build         # baixa o modelo para ./models e gera o build de produção
npm run tamanho-funcoes   # tamanho rastreado de cada função serverless (limite da Vercel: 250 MB)
```

APIs:

- `GET /api/busca?q=...&generico=1&precoMax=30&tarja=Tarja%20Vermelha&pagina=1`
- `GET /api/comparar/{id}`: equivalentes da mesma caixa e de outras caixas, com a economia
- `GET /api/comparativo?q=...`: a consulta nos 5 motores, com tempos e marcação pelo gabarito

## Deploy (Vercel)

O projeto fica no time **Grupo3BDPUCGO** (identificador `grupo3-bdpucgo`), com as funções na região de São Paulo (`gru1`, em `vercel.json`), a mesma do Qdrant e do Neon. Cadastre em *Settings > Environment Variables* as variáveis `QDRANT_URL`, `QDRANT_API_KEY`, `DATABASE_URL` e `ALIQUOTA_ICMS`, e publique:

```bash
npx vercel link --scope grupo3-bdpucgo
npx vercel --prod --scope grupo3-bdpucgo
```

O build baixa o modelo de embeddings para `./models` (`scripts/baixar-modelo.mjs`) e o empacota na função com o binário Linux x64 do `onnxruntime-node`, sem chave nem custo de API. A maior função fica em cerca de 193 MB. Só `/buscar`, `/comparativo` e `/api/busca` levam o modelo: o Next compara as chaves de `outputFileTracingIncludes` com `contains: true`, e uma chave `"/"` levaria o modelo para todas as rotas, passando do limite de 12 funções do plano Hobby.

Em produção, a primeira requisição de uma instância nova leva cerca de 3,7 s (2,3 s para carregar o modelo); com a instância ativa, o processamento dentro da função fica entre 25 e 120 ms. O cabeçalho `Server-Timing` de `/api/busca` mostra esses tempos.

## Estrutura

```
data/        cmed.xlsx (não versionado) e dicionario-indicacoes.json
scripts/     01-limpar, 02-ingerir, 03-postgres, 04-benchmark e utilitários
lib/         embeddings, qdrant, busca, lexical, postgres, comparacao, normalizacao, gabarito
app/         páginas e rotas de API (Next.js App Router)
components/  Embalagem (SVG), CardMedicamento, FormBusca, Selo
benchmark/   consultas.json (gabarito) e resultados.json
docs/        relatório técnico (LaTeX), figuras e registros da linha de base
```

## Divisão por papéis

Os commits seguem o prefixo do papel (`feat(dba): ...`, `feat(data-engineer): ...`). A coluna de integrantes é preenchida pelo grupo.

| Papel | Responsabilidades | Principais arquivos | Integrante |
|---|---|---|---|
| 1. DBA | Qdrant Cloud, collection com vetores nomeados, HNSW, índices de payload, busca híbrida e tuning | `lib/qdrant.ts`, `lib/lexical.ts`, `scripts/02-ingerir.ts` | |
| 2. Data Engineer | limpeza do xlsx, normalização, chaves de equivalência, dicionário de indicações, embeddings e carga | `scripts/01-limpar.ts`, `lib/normalizacao.ts`, `lib/embeddings.ts`, `data/dicionario-indicacoes.json` | |
| 3. Backend 1 | API de busca semântica, filtros, paginação e similaridade | `lib/busca.ts`, `lib/parametros.ts`, `app/api/busca` | |
| 4. Backend 2 | API de comparação de preços e cálculo de economia | `lib/comparacao.ts`, `app/api/comparar` | |
| 5. Data Analyst | base relacional equivalente, benchmark, gabarito, gráficos e análise | `scripts/03-postgres.ts`, `lib/postgres.ts`, `scripts/04-benchmark.ts`, `lib/gabarito.ts`, `lib/dificuldade.ts`, `scripts/graficos.py`, `benchmark/` | |
| 6. Frontend | interface, ilustração SVG, página comparativa e deploy na Vercel | `app/`, `components/`, `next.config.ts` | |
| 7. Documentação e QA | relatório técnico, slides, testes de determinismo e de consultas | `docs/`, `scripts/verificar-*.ts` | |

## Integrantes

- Arthur de Oliveira Machado
- Bruna Gouveia de Morais
- Brunno Pedrosa Mesquita
- Gabriel Alves Gomes
- Gabriel Magela
- Guilherme Gabriel
- Pedro Eduardo Peixoto
