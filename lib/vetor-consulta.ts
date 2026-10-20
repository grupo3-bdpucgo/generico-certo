// Vetor denso da consulta, do jeito que o site o obtém. O modelo fica só na rota /api/embedding (ver
// next.config.ts): cada função que o carrega ocupa 342 MB na Vercel, então as páginas e as outras
// rotas pedem o vetor a ela por HTTP. Os scripts não passam por aqui: usam lib/embeddings.ts direto.

export type GeradorVetor = (consulta: string) => Promise<number[]>;

async function urlBase(): Promise<string> {
  // Em produção, o domínio público: as URLs de cada deploy ficam atrás da proteção da Vercel.
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  // Em desenvolvimento e em previews, o mesmo endereço pelo qual a página foi pedida.
  const { headers } = await import("next/headers");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

export const vetorPelaRota: GeradorVetor = async (consulta) => {
  const resp = await fetch(`${await urlBase()}/api/embedding`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texto: consulta }),
    cache: "no-store",
  });
  if (!resp.ok) throw new Error(`/api/embedding respondeu ${resp.status}`);
  return ((await resp.json()) as { vetor: number[] }).vetor;
};
