// Acesso ao Qdrant Cloud e definição da collection "medicamentos" (papel: DBA).

import { QdrantClient } from "@qdrant/js-client-rest";
import { DIMENSAO } from "./embeddings";

export const COLLECTION = process.env.QDRANT_COLLECTION ?? "medicamentos";

// Vetores nomeados de cada ponto:
//  denso_base  texto só com dados da CMED (linha de base do experimento)
//  denso       texto enriquecido com o dicionário de indicações
//  lexical     esparso, trigramas de produto + substância, com IDF calculado pelo Qdrant
export const VETOR = { base: "denso_base", denso: "denso", lexical: "lexical" } as const;

// Parâmetros do HNSW: m = arestas por nó; ef_construct = tamanho da fila na construção.
// Para ~11 mil pontos, m=16 e ef_construct=128 dão recall alto sem pesar no cluster free.
export const HNSW = { m: 16, ef_construct: 128 };
export const EF_BUSCA = 128;

export const INDICES_PAYLOAD = {
  tipo_produto: "keyword",
  selo: "keyword",
  tarja: "keyword",
  generico: "bool",
  restricao_hospitalar: "bool",
  pmc: "float",
  preco_por_unidade: "float",
  chave_equivalencia: "keyword",
  chave_equivalencia_ampla: "keyword",
} as const;

const global_ = globalThis as unknown as { __qdrant?: QdrantClient };

export function qdrant(): QdrantClient {
  if (!global_.__qdrant) {
    const url = process.env.QDRANT_URL;
    if (!url) throw new Error("QDRANT_URL não definida (veja .env.local.example)");
    global_.__qdrant = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY, timeout: 30_000 });
  }
  return global_.__qdrant;
}

export async function criarCollection(recriar = false): Promise<void> {
  const cliente = qdrant();
  const { exists } = await cliente.collectionExists(COLLECTION);
  if (exists && recriar) await cliente.deleteCollection(COLLECTION);
  if (!exists || recriar) {
    await cliente.createCollection(COLLECTION, {
      vectors: {
        [VETOR.base]: { size: DIMENSAO, distance: "Cosine" },
        [VETOR.denso]: { size: DIMENSAO, distance: "Cosine" },
      },
      sparse_vectors: { [VETOR.lexical]: { modifier: "idf" } },
      hnsw_config: HNSW,
    });
  }
  for (const [campo, tipo] of Object.entries(INDICES_PAYLOAD)) {
    await cliente.createPayloadIndex(COLLECTION, { field_name: campo, field_schema: tipo, wait: true });
  }
}
