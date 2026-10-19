# Linha de base: busca densa pura, sem enriquecimento

Registro das consultas que motivaram a busca híbrida e o dicionário de indicações. Estes resultados foram obtidos em 19/10/2026, antes de qualquer alteração, e servem como linha de base no relatório técnico (Capítulo 6).

## Configuração

- Base: Lista de Preços CMED/ANVISA de 09/10/2026, 11.001 registros após a limpeza
- Collection: medicamentos, vetor único de 384 dimensões, distância de cosseno
- Índice HNSW: m = 16, ef_construct = 128, hnsw_ef = 128 na consulta
- Modelo: Xenova/paraphrase-multilingual-MiniLM-L12-v2 (Transformers.js, quantizado em 8 bits)
- Texto vetorizado: produto, substâncias, classe terapêutica sem código, dosagem e forma farmacêutica por extenso, tudo em minúsculas
- Sem vetor esparso e sem dicionário de indicações
- Cluster Qdrant Cloud free, AWS sa-east-1

## Consulta 1: "dorflex"

Resultado esperado: o próprio DORFLEX e equivalentes (dipirona + orfenadrina + cafeína).

Tempo da consulta no Qdrant: 255 ms (primeira chamada, inclui abertura da conexão).

| Posição | Similaridade | Produto | Substância | Classe terapêutica | Selo | PMC 19% (R$) |
|---|---|---|---|---|---|---|
| 1 | 53,9% | DOXURAN | MESILATO DE DOXAZOSINA | C2A2 - ANTI-HIPERTENSIVOS PURO-AÇÃO PERIFÉRICA | Similar | 27,20 |
| 2 | 52,9% | DOXICLIN | CLORIDRATO DE DOXICICLINA | J1A - TETRACICLINAS E ASSOCIAÇÕES | Similar | 47,07 |
| 3 | 52,9% | DOXICLIN | CLORIDRATO DE DOXICICLINA | J1A - TETRACICLINAS E ASSOCIAÇÕES | Similar | 47,00 |
| 4 | 52,0% | DOXURAN | MESILATO DE DOXAZOSINA | C2A2 - ANTI-HIPERTENSIVOS PURO-AÇÃO PERIFÉRICA | Similar | 54,25 |
| 5 | 50,4% | DOBUTREX | CLORIDRATO DE DOBUTAMINA | C1C2 - AGENTES CARDÍACOS DOPAMINÉRGICOS | Referência | 1414,00 |

## Consulta 2: "remédio pra dor de cabeça"

Resultado esperado: analgésicos e antipiréticos (dipirona, paracetamol, AAS, associações para enxaqueca).

Tempo da consulta no Qdrant: 38 ms.

| Posição | Similaridade | Produto | Substância | Classe terapêutica | Selo | PMC 19% (R$) |
|---|---|---|---|---|---|---|
| 1 | 59,9% | VERTIGIUM | DICLORIDRATO DE FLUNARIZINA | N7C - ANTIVERTIGINOSOS | Similar | 17,05 |
| 2 | 59,8% | MIGRAINEX | CAFEÍNA ANIDRA + ÁCIDO ACETILSALICÍLICO + PARACETAMOL | N2B2 - ANALGÉSICOS NÃO NARCÓTICOS E ANTIPIRÉTICOS ISENTOS DE PRESCRIÇÃO | Similar | 63,25 |
| 3 | 57,0% | VERTIX | DICLORIDRATO DE FLUNARIZINA | C4A2 - ANTAGONISTAS DO CÁLCIO COM AÇÃO CEREBRAL | Similar | 14,50 |
| 4 | 56,2% | VERTIZAN | DICLORIDRATO DE FLUNARIZINA | C4A2 - ANTAGONISTAS DO CÁLCIO COM AÇÃO CEREBRAL | Similar | 16,49 |
| 5 | 54,8% | NUVIGIL | ARMODAFINILA | N6B - PSICOESTIMULANTES | Referência | 704,98 |

## Consulta 3: "antialérgico que não dá sono"

Resultado esperado: anti-histamínicos de segunda geração (loratadina, desloratadina, fexofenadina, bilastina etc.).

Tempo da consulta no Qdrant: 44 ms.

| Posição | Similaridade | Produto | Substância | Classe terapêutica | Selo | PMC 19% (R$) |
|---|---|---|---|---|---|---|
| 1 | 63,9% | DORMEC | ÁCIDO ACETILSALICÍLICO | N2B2 - ANALGÉSICOS NÃO NARCÓTICOS E ANTIPIRÉTICOS ISENTOS DE PRESCRIÇÃO | Similar | 35,99 |
| 2 | 58,8% | TOPERMA | LIDOCAÍNA | N1B3 - ANESTÉSICOS LOCAIS TÓPICOS | Referência | 629,13 |
| 3 | 58,8% | TOPERMA | LIDOCAÍNA | N1B3 - ANESTÉSICOS LOCAIS TÓPICOS | Referência | 209,71 |
| 4 | 57,4% | PASSAJÁ | TIMOL + MENTOL + CÂNFORA + CLORIDRATO DE PROCAÍNA | N1B3 - ANESTÉSICOS LOCAIS TÓPICOS | Similar | 232,65 |
| 5 | 56,9% | CROMOGLICATO | CROMOGLICATO DE SODIO | S1G2 - ANTIALÉRGICOS OFTAMOLÓGICOS, ESTABILISADORES DE MASTÓCITOS | Referência | 17,75 |

## Diagnóstico

1. **Nome comercial.** "dorflex" não tem significado para o modelo. O tokenizador o quebra em subpalavras e o vetor fica próximo de nomes com grafia parecida (DOXURAN, DOXICLIN, DOBUTREX), sem relação terapêutica. Nenhum dos cinco resultados contém as substâncias do Dorflex.
2. **Linguagem coloquial.** Em "remédio pra dor de cabeça" apenas o segundo resultado (MIGRAINEX) é adequado. VERTIGIUM, VERTIX e VERTIZAN são antivertiginosos e NUVIGIL é um promotor de vigília. A base não descreve para que serve cada classe em termos populares.
3. **Atributo ausente na base.** Em "antialérgico que não dá sono" nenhum resultado é anti-histamínico. A classe R6A (anti-histamínicos sistêmicos) não contém a palavra "alergia", e a informação de que um medicamento não causa sonolência não existe na CMED. O primeiro resultado, DORMEC, aparece provavelmente pela proximidade com "dormir".

Esses três casos justificaram duas decisões de modelagem: a busca híbrida (vetor denso combinado com vetor esparso de trigramas, fundidos por RRF) e o dicionário de indicações em linguagem leiga (data/dicionario-indicacoes.json).
