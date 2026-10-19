# Antes e depois: três consultas nos motores vetoriais

Gerado em 19/10/2026, 16:27:08 por scripts/antes-depois.ts. Top 5 de cada motor, sem nenhum filtro, como na linha de base. No híbrido o escore é o da fusão RRF, que depende só das posições e não é comparável à similaridade de cosseno.

## "dorflex"

**Denso puro, sem enriquecimento** (embedding 11 ms, Qdrant 34 ms)

| Posição | Escore | Produto | Substância | Selo | PMC (R$) |
|---|---|---|---|---|---|
| 1 | 53,9% | DOXURAN | MESILATO DE DOXAZOSINA | Similar | 27,20 |
| 2 | 52,9% | DOXICLIN | CLORIDRATO DE DOXICICLINA | Similar | 47,00 |
| 3 | 52,9% | DOXICLIN | CLORIDRATO DE DOXICICLINA | Similar | 47,07 |
| 4 | 52,0% | DOXURAN | MESILATO DE DOXAZOSINA | Similar | 54,25 |
| 5 | 50,4% | DOBUTREX | CLORIDRATO DE DOBUTAMINA | Referência | 1414,00 |

**Denso puro, com enriquecimento** (embedding 8 ms, Qdrant 31 ms)

| Posição | Escore | Produto | Substância | Selo | PMC (R$) |
|---|---|---|---|---|---|
| 1 | 52,5% | DORICIN | DIPIRONA + CITRATO DE ORFENADRINA + CAFEÍNA ANIDRA | Similar | 21,65 |
| 2 | 51,7% | DORICIN | CITRATO DE ORFENADRINA + CAFEÍNA ANIDRA + DIPIRONA MONOIDRATADA | Similar | 29,20 |
| 3 | 51,7% | DORICIN | CITRATO DE ORFENADRINA + CAFEÍNA ANIDRA + DIPIRONA MONOIDRATADA | Similar | 240,50 |
| 4 | 51,7% | DORICIN | CITRATO DE ORFENADRINA + CAFEÍNA ANIDRA + DIPIRONA MONOIDRATADA | Similar | 39,94 |
| 5 | 51,7% | DORICIN | CITRATO DE ORFENADRINA + CAFEÍNA ANIDRA + DIPIRONA MONOIDRATADA | Similar | 19,22 |

**Híbrido (denso enriquecido + trigramas, RRF)** (embedding 7 ms, Qdrant 34 ms)

| Posição | Escore | Produto | Substância | Selo | PMC (R$) |
|---|---|---|---|---|---|
| 1 | 0,500 | DORICIN | DIPIRONA + CITRATO DE ORFENADRINA + CAFEÍNA ANIDRA | Similar | 21,65 |
| 2 | 0,500 | DORFLEX DIP | DIPIRONA MONOIDRATADA | Similar | 17,64 |
| 3 | 0,333 | DORFLEX UNO | DIPIRONA MONOIDRATADA | Similar | 31,82 |
| 4 | 0,333 | DORICIN | CITRATO DE ORFENADRINA + CAFEÍNA ANIDRA + DIPIRONA MONOIDRATADA | Similar | 19,22 |
| 5 | 0,250 | DORFLEX UNO | DIPIRONA MONOIDRATADA | Similar | 19,64 |

## "remédio pra dor de cabeça"

**Denso puro, sem enriquecimento** (embedding 10 ms, Qdrant 37 ms)

| Posição | Escore | Produto | Substância | Selo | PMC (R$) |
|---|---|---|---|---|---|
| 1 | 59,9% | VERTIGIUM | DICLORIDRATO DE FLUNARIZINA | Similar | 17,05 |
| 2 | 59,8% | MIGRAINEX | CAFEÍNA ANIDRA + ÁCIDO ACETILSALICÍLICO + PARACETAMOL | Similar | 63,25 |
| 3 | 57,0% | VERTIX | DICLORIDRATO DE FLUNARIZINA | Similar | 14,50 |
| 4 | 56,2% | VERTIZAN | DICLORIDRATO DE FLUNARIZINA | Similar | 16,49 |
| 5 | 54,8% | NUVIGIL | ARMODAFINILA | Referência | 704,98 |

**Denso puro, com enriquecimento** (embedding 10 ms, Qdrant 33 ms)

| Posição | Escore | Produto | Substância | Selo | PMC (R$) |
|---|---|---|---|---|---|
| 1 | 70,7% | MAXALGINA | DIPIRONA MONOIDRATADA | Similar | 31,22 |
| 2 | 70,0% | TYLENOL | PARACETAMOL | Referência | 236,54 |
| 3 | 70,0% | TYLENOL | PARACETAMOL | Referência | 23,80 |
| 4 | 68,5% | DIPIRONA SODICA | DIPIRONA | Genérico | 66,09 |
| 5 | 68,5% | DIPIRONA SODICA | DIPIRONA | Genérico | 293,00 |

**Híbrido (denso enriquecido + trigramas, RRF)** (embedding 12 ms, Qdrant 33 ms)

| Posição | Escore | Produto | Substância | Selo | PMC (R$) |
|---|---|---|---|---|---|
| 1 | 0,567 | MAXALGINA | DIPIRONA MONOIDRATADA | Similar | 31,22 |
| 2 | 0,543 | PARACETAMOL | PARACETAMOL | Genérico | 25,51 |
| 3 | 0,450 | DIPIRONA SODICA | DIPIRONA | Genérico | 293,00 |
| 4 | 0,444 | TYLENOL | PARACETAMOL | Referência | 23,80 |
| 5 | 0,375 | TYLENOL | PARACETAMOL | Referência | 236,54 |

## "antialérgico que não dá sono"

**Denso puro, sem enriquecimento** (embedding 15 ms, Qdrant 39 ms)

| Posição | Escore | Produto | Substância | Selo | PMC (R$) |
|---|---|---|---|---|---|
| 1 | 63,9% | DORMEC | ÁCIDO ACETILSALICÍLICO | Similar | 35,99 |
| 2 | 58,8% | TOPERMA | LIDOCAÍNA | Referência | 629,13 |
| 3 | 58,8% | TOPERMA | LIDOCAÍNA | Referência | 209,71 |
| 4 | 57,4% | PASSAJÁ | TIMOL + MENTOL + CÂNFORA + CLORIDRATO DE PROCAÍNA | Similar | 232,65 |
| 5 | 56,9% | CROMOGLICATO | CROMOGLICATO DE SODIO | Referência | 17,75 |

**Denso puro, com enriquecimento** (embedding 13 ms, Qdrant 31 ms)

| Posição | Escore | Produto | Substância | Selo | PMC (R$) |
|---|---|---|---|---|---|
| 1 | 71,5% | DORMIRE | MALEATO DE MIDAZOLAM | Similar | 94,17 |
| 2 | 71,4% | DORMONID | MALEATO DE MIDAZOLAM | Referência | 79,85 |
| 3 | 70,4% | RELESTAT | CLORIDRATO DE EPINASTINA | Referência | 84,82 |
| 4 | 69,5% | ZOLFEST D | HEMITARTARATO DE ZOLPIDEM | Referência | 115,80 |
| 5 | 69,2% | PRYSMA | ESZOPICLONA | Referência | 94,02 |

**Híbrido (denso enriquecido + trigramas, RRF)** (embedding 8 ms, Qdrant 78 ms)

| Posição | Escore | Produto | Substância | Selo | PMC (R$) |
|---|---|---|---|---|---|
| 1 | 0,750 | RELESTAT | CLORIDRATO DE EPINASTINA | Referência | 84,82 |
| 2 | 0,500 | DORMIRE | MALEATO DE MIDAZOLAM | Similar | 94,17 |
| 3 | 0,333 | DORMONID | MALEATO DE MIDAZOLAM | Referência | 79,85 |
| 4 | 0,333 | PROFERGAN | PROMETAZINA | Similar | 26,90 |
| 5 | 0,250 | BILASTINA | BILASTINA | Genérico | 49,55 |
