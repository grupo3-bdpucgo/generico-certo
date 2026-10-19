// Constantes do modelo de embeddings, num módulo sem dependências: assim lib/qdrant.ts não importa
// lib/embeddings.ts e as rotas que só leem o Qdrant não levam o modelo para dentro da função.

export const MODELO_PADRAO = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const DIMENSAO = 384;
