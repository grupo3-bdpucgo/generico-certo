// Geração de embeddings atrás de uma interface única.
// Para trocar por uma API externa, basta implementar ProvedorEmbeddings e mudar criarProvedor().

export interface ProvedorEmbeddings {
  readonly modelo: string;
  readonly dimensao: number;
  /** Vetores normalizados (norma 1), prontos para distância de cosseno. */
  gerar(textos: string[]): Promise<number[][]>;
}

export const MODELO_PADRAO = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const DIMENSAO = 384;

// Transformers.js rodando localmente (Node), com o modelo quantizado em 8 bits.
// O mesmo dtype precisa ser usado na ingestão e na consulta.
class ProvedorTransformers implements ProvedorEmbeddings {
  readonly dimensao = DIMENSAO;
  private extrator: Promise<(textos: string[], opcoes: object) => Promise<{ tolist(): number[][] }>> | null = null;

  constructor(readonly modelo: string) {}

  private carregar() {
    if (!this.extrator) {
      this.extrator = (async () => {
        const { pipeline, env } = await import("@huggingface/transformers");
        const { existsSync } = await import("node:fs");
        const { join } = await import("node:path");
        // Modelo empacotado em ./models pelo scripts/baixar-modelo.mjs (vai dentro da função na Vercel).
        // Se a pasta existir, nada é baixado da internet em tempo de execução.
        const pastaModelos = join(process.cwd(), "models");
        env.localModelPath = pastaModelos;
        env.allowLocalModels = true;
        env.allowRemoteModels = !existsSync(join(pastaModelos, this.modelo));
        // Na Vercel só /tmp é gravável.
        env.cacheDir = process.env.VERCEL ? "/tmp/transformers-cache" : "./.cache/transformers";
        const p = await pipeline("feature-extraction", this.modelo, { dtype: "q8" });
        return p as unknown as (textos: string[], opcoes: object) => Promise<{ tolist(): number[][] }>;
      })();
    }
    return this.extrator;
  }

  async gerar(textos: string[]): Promise<number[][]> {
    const extrator = await this.carregar();
    const saida = await extrator(textos, { pooling: "mean", normalize: true });
    return saida.tolist();
  }
}

function criarProvedor(): ProvedorEmbeddings {
  return new ProvedorTransformers(process.env.EMBEDDING_MODEL ?? MODELO_PADRAO);
}

// Singleton global para sobreviver ao hot reload do Next.js em desenvolvimento.
const global_ = globalThis as unknown as { __provedorEmbeddings?: ProvedorEmbeddings };

export function provedorEmbeddings(): ProvedorEmbeddings {
  return (global_.__provedorEmbeddings ??= criarProvedor());
}

/** Os textos indexados estão em minúsculas; a consulta segue o mesmo padrão. */
export function prepararConsulta(texto: string): string {
  return texto.trim().toLowerCase();
}

export async function embedLote(textos: string[]): Promise<number[][]> {
  return provedorEmbeddings().gerar(textos);
}

export async function embedConsulta(texto: string): Promise<number[]> {
  const [vetor] = await provedorEmbeddings().gerar([prepararConsulta(texto)]);
  return vetor;
}
