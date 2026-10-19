// Baixa o modelo de embeddings para ./models antes do build, para que ele vá dentro da função
// serverless em vez de ser baixado do Hugging Face a cada partida a frio. Sem chave e sem custo.
// Pula os arquivos que já existem. Roda no "npm run build" (local e na Vercel).

import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MODELO = process.env.EMBEDDING_MODEL ?? "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
const ARQUIVOS = ["config.json", "tokenizer.json", "tokenizer_config.json", "onnx/model_quantized.onnx"];
const DESTINO = join("models", MODELO);

for (const arquivo of ARQUIVOS) {
  const caminho = join(DESTINO, arquivo);
  if (existsSync(caminho) && statSync(caminho).size > 0) {
    console.log(`já existe  ${caminho} (${(statSync(caminho).size / 1048576).toFixed(1)} MB)`);
    continue;
  }
  mkdirSync(dirname(caminho), { recursive: true });
  const url = `https://huggingface.co/${MODELO}/resolve/main/${arquivo}`;
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`Falha ao baixar ${url}: ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(caminho));
  console.log(`baixado    ${caminho} (${(statSync(caminho).size / 1048576).toFixed(1)} MB)`);
}
