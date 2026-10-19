import type { NextConfig } from "next";

const config: NextConfig = {
  // Transformers.js usa o binário nativo do onnxruntime-node; não deve ser empacotado pelo bundler.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
};

export default config;
