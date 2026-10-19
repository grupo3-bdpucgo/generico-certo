import Link from "next/link";
import { notFound } from "next/navigation";
import Embalagem from "@/components/Embalagem";
import Selo from "@/components/Selo";
import { compararEquivalentes, type ItemComparacao } from "@/lib/comparacao";
import { brl, brlUnidade, pct, porUnidade, quantidadePorExtenso, rotuloTarja } from "@/lib/formatacao";
import { classeSemCodigo } from "@/lib/normalizacao";

export const dynamic = "force-dynamic";

function Economia({ item, base, porUnidadeDe }: { item: ItemComparacao; base: number; porUnidadeDe?: string }) {
  if (item.medicamento.id === base) {
    return <p className="text-xs font-semibold text-tinta-2">Você escolheu este</p>;
  }
  const e = item.economia;
  if (!e) return null;
  const sufixo = porUnidadeDe ? ` ${porUnidade(porUnidadeDe)}` : "";
  const valor = porUnidadeDe ? brlUnidade(Math.abs(e.reais)) : brl(Math.abs(e.reais));
  if (e.reais > 0.005) {
    return (
      <p className="rounded-md bg-economia-fundo px-2 py-1 text-xs font-semibold text-economia">
        Você economiza {valor}
        {sufixo} ({pct(e.fracao)})
      </p>
    );
  }
  if (e.reais < -0.005) {
    return (
      <p className="text-xs text-tinta-3">
        {valor}
        {sufixo} a mais
      </p>
    );
  }
  return <p className="text-xs text-tinta-3">Mesmo preço</p>;
}

function Caixa({ item, base, modo }: { item: ItemComparacao; base: number; modo: "caixa" | "unidade" }) {
  const m = item.medicamento;
  const escolhido = m.id === base;
  return (
    <li className="w-48 shrink-0 snap-start">
      <Link
        href={`/medicamento/${m.id}`}
        className={`flex h-full flex-col gap-2 rounded-xl border bg-papel p-3 transition hover:border-tinta-3 ${escolhido ? "border-tinta ring-2 ring-tinta" : "border-linha"}`}
      >
        <Embalagem m={m} uid={`${modo}-${m.id}`} className="w-full" titulo={false} />
        <div className="flex items-center justify-between gap-1">
          <Selo selo={m.selo} />
          {m.generico && modo === "caixa" && <span className="text-[10px] text-tinta-3">intercambiável</span>}
        </div>
        <p className="text-sm leading-tight font-bold">{m.produto}</p>
        <p className="line-clamp-1 text-[11px] text-tinta-2" title={m.laboratorio}>
          {m.laboratorio}
        </p>
        <div className="mt-auto">
          {modo === "caixa" ? (
            <p className="numeros text-2xl font-extrabold">{brl(m.pmc)}</p>
          ) : (
            <>
              <p className="numeros text-xl leading-tight font-extrabold">{brlUnidade(m.preco_por_unidade!)}</p>
              <p className="text-xs font-semibold text-tinta-2">{porUnidade(m.unidade)}</p>
              <p className="numeros text-[11px] text-tinta-3">
                {quantidadePorExtenso(m)} · {brl(m.pmc)}
              </p>
            </>
          )}
          <div className="mt-1.5">
            <Economia item={item} base={base} porUnidadeDe={modo === "unidade" ? m.unidade : undefined} />
          </div>
        </div>
      </Link>
    </li>
  );
}

export default async function PaginaMedicamento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) notFound();
  const c = await compararEquivalentes(numero);
  if (!c) notFound();

  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) for (const x of [v].flat()) if (x) sp.append(k, x);
  const voltar = sp.get("q") ? `/buscar?${sp}` : "/";
  const b = c.base;
  const unidade = b.unidade;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Link href={voltar} className="text-sm font-medium text-tinta-2 hover:text-marca">
        ← Voltar à busca
      </Link>

      <section className="mt-4 grid gap-6 rounded-2xl border border-linha bg-papel p-5 md:grid-cols-[minmax(0,340px)_1fr]">
        <Embalagem m={b} uid="base" className="w-full" />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold">{b.produto}</h1>
            <Selo selo={b.selo} />
          </div>
          <p className="text-sm text-tinta-2">{b.laboratorio}</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-tinta-3">Princípio ativo</dt>
            <dd>{b.substancia.join(" + ")}</dd>
            <dt className="text-tinta-3">Apresentação</dt>
            <dd>{b.apresentacao}</dd>
            <dt className="text-tinta-3">Classe</dt>
            <dd>{classeSemCodigo(b.classe) || "não informada"}</dd>
            <dt className="text-tinta-3">Tarja</dt>
            <dd>{rotuloTarja(b.tarja)}</dd>
          </dl>
          <p className="numeros mt-2 text-3xl font-extrabold">
            {brl(b.pmc)}
            {b.preco_por_unidade !== null && (
              <span className="ml-2 text-sm font-semibold text-tinta-2">
                {brlUnidade(b.preco_por_unidade)} {porUnidade(unidade)}
              </span>
            )}
          </p>

          {c.melhorMesmaCaixa ? (
            <p className="mt-2 rounded-xl bg-economia-fundo p-3 text-economia">
              <strong className="text-lg">
                Você economiza {brl(c.melhorMesmaCaixa.economia!.reais)} ({pct(c.melhorMesmaCaixa.economia!.fracao)})
              </strong>
              <br />
              <span className="text-sm">
                levando {c.melhorMesmaCaixa.medicamento.produto} ({c.melhorMesmaCaixa.medicamento.selo.toLowerCase()},{" "}
                {c.melhorMesmaCaixa.medicamento.laboratorio}), na mesma caixa.
              </span>
            </p>
          ) : (
            <p className="mt-2 rounded-xl bg-fundo p-3 text-sm text-tinta-2">
              {c.mesmaCaixa.length > 1
                ? "Este já é o mais barato entre os equivalentes da mesma caixa."
                : "Não há outro medicamento equivalente nesta mesma caixa na lista da CMED."}
            </p>
          )}
          {c.melhorPorUnidade && c.melhorPorUnidade.medicamento.id !== c.melhorMesmaCaixa?.medicamento.id && (
            <p className="text-sm text-tinta-2">
              Em outra caixa, o menor preço {porUnidade(c.melhorPorUnidade.medicamento.unidade)} é{" "}
              <strong className="text-tinta">{brlUnidade(c.melhorPorUnidade.medicamento.preco_por_unidade!)}</strong> (
              {c.melhorPorUnidade.medicamento.produto}, {quantidadePorExtenso(c.melhorPorUnidade.medicamento)}),{" "}
              {pct(c.melhorPorUnidade.economia!.fracao)} a menos {porUnidade(c.melhorPorUnidade.medicamento.unidade)}.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">Equivalentes na mesma caixa ({c.mesmaCaixa.length})</h2>
        <p className="mb-3 text-sm text-tinta-2">
          Mesmo princípio ativo, dosagem, forma e quantidade ({quantidadePorExtenso(b)}), do mais barato para o mais caro.
        </p>
        <ul className="flex snap-x gap-3 overflow-x-auto pb-3">
          {c.mesmaCaixa.map((item) => (
            <Caixa key={item.medicamento.id} item={item} base={b.id} modo="caixa" />
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Equivalentes em outras caixas ({c.qualquerCaixa.length})</h2>
        <p className="mb-3 text-sm text-tinta-2">
          Mesmo princípio ativo, dosagem e forma em embalagens de outro tamanho, ordenados pelo preço {porUnidade(unidade)}.
        </p>
        {c.qualquerCaixa.length ? (
          <ul className="flex snap-x gap-3 overflow-x-auto pb-3">
            {c.qualquerCaixa.map((item) => (
              <Caixa key={item.medicamento.id} item={item} base={b.id} modo="unidade" />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tinta-3">Nenhuma outra caixa encontrada.</p>
        )}
      </section>

      <aside className="mt-6 space-y-1 rounded-xl border border-linha bg-papel p-4 text-xs leading-relaxed text-tinta-2">
        <p>
          A equivalência é calculada a partir dos dados da CMED (princípio ativo, dosagem e forma farmacêutica). Pela Lei nº
          9.787/1999, o genérico é intercambiável com o medicamento de referência e, pelas regras da CMED, deve custar no
          mínimo 35% menos que ele. Confirme a troca com o farmacêutico, principalmente entre similares.
        </p>
        <p>As ilustrações são geradas a partir dos dados do registro: a lista oficial não fornece imagens das embalagens.</p>
      </aside>
    </main>
  );
}
