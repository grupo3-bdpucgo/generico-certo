import Link from "next/link";
import { redirect } from "next/navigation";
import FormBusca from "@/components/FormBusca";
import { lerParametros, type Parametros } from "@/lib/parametros";

// Página inicial sem busca: não carrega o modelo de embeddings, então a função fica pequena.
// Os resultados ficam em /buscar.

const EXEMPLOS = ["dorflex", "remédio para enjoo", "omeprazol 20 mg", "dipirona gotas", "pomada para micose"];

export default async function Home({ searchParams }: { searchParams: Promise<Parametros> }) {
  const sp = await searchParams;
  // Compatibilidade com links antigos do tipo /?q=...
  if (sp.q) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of [v].flat()) if (x) qs.append(k, x);
    redirect(`/buscar?${qs}`);
  }
  const busca = lerParametros({});

  return (
    <main>
      <section className="bg-noite pb-8 text-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-10 pb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-home.webp" alt="Genérico Certo" width={960} height={409} className="h-auto w-full max-w-[520px]" />
          <h1 className="mt-2 mb-7 text-center text-lg text-white/85 sm:text-xl">
            Descubra o genérico equivalente e quanto você economiza
          </h1>
          <FormBusca busca={busca} grande />
          <p className="mt-5 flex flex-wrap justify-center gap-x-2 gap-y-1 text-sm text-white/70">
            <span>Experimente:</span>
            {EXEMPLOS.map((e, i) => (
              <span key={e}>
                <Link href={`/buscar?q=${encodeURIComponent(e)}`} className="text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
                  {e}
                </Link>
                {i < EXEMPLOS.length - 1 && ","}
              </span>
            ))}
          </p>
        </div>
      </section>
    </main>
  );
}
