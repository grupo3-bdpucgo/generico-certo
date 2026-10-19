import type { NextConfig } from "next";

// Rotas que geram embeddings da consulta (Transformers.js + onnxruntime-node).
const ROTAS_COM_MODELO = ["/", "/comparativo", "/api/busca", "/api/comparativo"];

const config: NextConfig = {
  // Transformers.js usa o binário nativo do onnxruntime-node; não deve ser empacotado pelo bundler.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  // O onnxruntime-node é carregado dinamicamente e o rastreador do Next não o detecta: incluímos à
  // mão só o binário Linux x64 (ambiente da Vercel) e o modelo baixado por scripts/baixar-modelo.mjs.
  outputFileTracingIncludes: Object.fromEntries(
    ROTAS_COM_MODELO.map((rota) => [
      rota,
      [
        "./models/**/*",
        "./node_modules/onnxruntime-node/package.json",
        "./node_modules/onnxruntime-node/dist/**/*.js",
        "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**/*",
        "./node_modules/onnxruntime-common/**/*.{js,json}",
      ],
    ]),
  ),
  // Fora da função: cache antigo de modelo dentro de node_modules e binários de outros sistemas.
  outputFileTracingExcludes: {
    "/**": [
      "./node_modules/@huggingface/transformers/.cache/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/{win32,darwin}/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*",
      "./node_modules/onnxruntime-web/**/*",
      "./data/**/*",
      "./docs/**/*",
    ],
  },
};

export default config;
