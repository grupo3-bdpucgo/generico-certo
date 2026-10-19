import Link from "next/link";
import CardMedicamento from "@/components/CardMedicamento";
import FormBusca from "@/components/FormBusca";
import { buscarVetorial, type RespostaBusca } from "@/lib/busca";
import { duracao } from "@/lib/formatacao";
import { POR_PAGINA, lerParametros, paraQueryString, type Parametros } from "@/lib/parametros";

export const dynamic = "force-dynamic";

const EXEMPLOS = ["dorflex", "remédio para enjoo", "omeprazol 20 mg", "dipirona gotas", "pomada para micose"];

export default async function Buscar({ searchParams }: { searchParams: Promise<Parametros> }) {
  const busca = lerParametros(await searchParams);

  let resposta: RespostaBusca | null = null;
  let erro: string | null = null;
  if (busca.q) {
    try {
      // O site usa o motor híbrido; a escolha de motor fica só em /comparativo.
      resposta = await buscarVetorial(busca.q, "hibrido", {
        filtros: busca.filtros,
        limite: POR_PAGINA + 1,
        deslocamento: (busca.pagina - 1) * POR_PAGINA,
      });
    } catch (e) {
      console.error(e);
      erro = "Não foi possível consultar o banco agora. Tente de novo em instantes.";
    }
  }
  const resultados = resposta?.resultados.slice(0, POR_PAGINA) ?? [];
  const temMais = (resposta?.resultados.length ?? 0) > POR_PAGINA;
  const voltar = paraQueryString(busca);

  return (
    <main>
      <section className="bg-noite pb-8 text-white">
        <div className={`mx-auto flex max-w-3xl flex-col items-center px-4 ${busca.q ? "pt-4" : "pt-10 pb-6"}`}>
          {!busca.q && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-home.webp" alt="Genérico Certo" width={960} height={409} className="h-auto w-full max-w-[520px]" />
              <h1 className="mt-2 mb-7 text-center text-lg text-white/85 sm:text-xl">
                Descubra o genérico equivalente e quanto você economiza
              </h1>
            </>
          )}
          <FormBusca busca={busca} grande={!busca.q} />
          {!busca.q && (
            <p className="mt-5 flex flex-wrap justify-center gap-2 text-sm text-white/70">
              <span>Experimente:</span>
              {EXEMPLOS.map((e) => (
                <Link key={e} href={`/buscar?q=${encodeURIComponent(e)}`} className="rounded-full bg-noite-2 px-3 py-0.5 text-white/90 hover:bg-white/15">
                  {e}
                </Link>
              ))}
            </p>
          )}
        </div>
      </section>

      {busca.q && (
        <section className="mx-auto max-w-6xl px-4 py-6" aria-live="polite">
          {erro && <p className="rounded-lg border border-marca/30 bg-marca/5 p-4 text-marca-escura">{erro}</p>}
          {resposta && (
            <>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">
                  {resultados.length ? `Resultados para “${busca.q}”` : `Nada encontrado para “${busca.q}”`}
                </h2>
                <p className="numeros text-xs text-tinta-3">
                  {resultados.length} {resultados.length === 1 ? "resultado" : "resultados"} nesta página · página {busca.pagina} ·
                  tempo da busca: {duracao(resposta.tempoEmbeddingMs + resposta.tempoBancoMs)}
                </p>
              </div>
              {!resultados.length && (
                <p className="text-sm text-tinta-2">Tente outro nome, o princípio ativo ou retire algum filtro.</p>
              )}
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {resultados.map((r) => (
                  <li key={r.id} className="flex">
                    <CardMedicamento r={r} voltar={voltar} />
                  </li>
                ))}
              </ul>
              {(busca.pagina > 1 || temMais) && (
                <nav className="mt-6 flex justify-center gap-3 text-sm font-semibold" aria-label="Paginação">
                  {busca.pagina > 1 && (
                    <Link href={`/buscar?${paraQueryString(busca, busca.pagina - 1)}`} className="rounded-lg border border-linha bg-papel px-4 py-2 hover:border-tinta-3">
                      ← Anterior
                    </Link>
                  )}
                  {temMais && (
                    <Link href={`/buscar?${paraQueryString(busca, busca.pagina + 1)}`} className="rounded-lg border border-linha bg-papel px-4 py-2 hover:border-tinta-3">
                      Próxima →
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
