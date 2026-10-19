// Soma os arquivos que o Next.js rastreia (.nft.json) para cada função do build de produção,
// para estimar o tamanho de cada função serverless antes do deploy (limite da Vercel: 250 MB).
// Uso: npx next build && node scripts/tamanho-funcoes.mjs
// Binários nativos de outros sistemas são listados à parte: a Vercel roda em Linux x64.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const RAIZ = ".next/server/app";
const nfts = [];
(function varrer(dir) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) varrer(p);
    else if (/(page|route)\.js\.nft\.json$/.test(nome)) nfts.push(p);
  }
})(RAIZ);

const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;
const outroSistema = (p) => /onnxruntime-node[\\/]bin[\\/]napi-v\d+[\\/](win32|darwin)|[\\/]linux[\\/]arm64[\\/]/.test(p);

for (const arquivo of nfts) {
  const { files } = JSON.parse(readFileSync(arquivo, "utf-8"));
  const base = dirname(arquivo);
  let total = 0;
  let nativosOutros = 0;
  const porPacote = {};
  for (const f of files) {
    const p = resolve(base, f);
    if (!existsSync(p) || !statSync(p).isFile()) continue;
    const tamanho = statSync(p).size;
    if (outroSistema(p)) {
      nativosOutros += tamanho;
      continue;
    }
    total += tamanho;
    const m = p.split(/[\\/]/).join("/").match(/node_modules\/((@[^/]+\/)?[^/]+)/);
    const pacote = m ? m[1] : "(aplicação)";
    porPacote[pacote] = (porPacote[pacote] ?? 0) + tamanho;
  }
  const maiores = Object.entries(porPacote)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k} ${mb(v)}`)
    .join(", ");
  console.log(
    `${relative(RAIZ, arquivo).replace(/\.nft\.json$/, "").padEnd(32)} ${mb(total).padStart(9)} (Linux x64)` +
      `  + ${mb(nativosOutros)} de binários de outros sistemas | ${maiores}`,
  );
}
