import Link from "next/link";
import { notFound } from "next/navigation";
import Embalagem from "@/components/Embalagem";
import Selo from "@/components/Selo";
import { compararEquivalentes, type ItemComparacao } from "@/lib/comparacao";
import { brl, brlUnidade, pct, porUnidade, quantidadePorExtenso, rotuloTarja } from "@/lib/formatacao";
import { classeSemCodigo } from "@/lib/normalizacao";

export const dynamic = "force-dynamic";

// Os valores da CMED são tetos (o preço de fábrica é uma fração quase fixa do máximo), então a
// comparação mais confiável entre equivalentes é a relativa: "X% mais barato". O teto aparece
// pequeno, em vermelho, como limite legal.

/** Diferença relativa em relação ao escolhido, em destaque. */
function Diferenca({ item, base, porUnidadeDe }: { item: ItemComparacao; base: number; porUnidadeDe?: string }) {
  if (item.medicamento.id === base) {
    return <p className="text-lg leading-tight font-extrabold text-tinta">Você escolheu este</p>;
  }
  const e = item.economia;
  if (!e) return null;
  const sufixo = porUnidadeDe ? ` ${porUnidade(porUnidadeDe)}` : "";
  if (e.fracao > 0.005) {
    return (
      <p className="text-economia">
        <span className="numeros text-2xl leading-tight font-extrabold">{pct(e.fracao)}</span>
        <span className="block text-xs font-semibold">mais barato{sufixo}</span>
      </p>
    );
  }
  if (e.fracao < -0.005) {
    return (
      <p className="text-tinta-2">
        <span className="numeros text-2xl leading-tight font-extrabold">{pct(-e.fracao)}</span>
        <span className="block text-xs font-semibold">mais caro{sufixo}</span>
      </p>
    );
  }
  return <p className="text-lg leading-tight font-extrabold text-tinta-2">Mesmo preço</p>;
}

/** Teto legal da CMED, pequeno e em vermelho. */
function PrecoMaximo({ valor, unidade, porUnidadeValor }: { valor: number; unidade?: string; porUnidadeValor?: number | null }) {
  return (
    <p className="numeros text-[11px] leading-snug text-marca-escura">
      Preço máximo: até {brl(valor)}
      {porUnidadeValor != null && unidade && (
        <>
          {" "}
          · {brlUnidade(porUnidadeValor)} {porUnidade(unidade)}
        </>
      )}
    </p>
  );
}

function Caixa({ item, base, modo, consulta }: { item: ItemComparacao; base: number; modo: "caixa" | "unidade"; consulta: string }) {
  const m = item.medicamento;
  const escolhido = m.id === base;
  return (
    <li className="w-48 shrink-0 snap-start">
      <Link
        href={`/medicamento/${m.id}${consulta}`}
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
        <div className="mt-auto flex flex-col gap-1">
          <Diferenca item={item} base={base} porUnidadeDe={modo === "unidade" ? m.unidade : undefined} />
          {modo === "unidade" && <p className="text-[11px] text-tinta-3">{quantidadePorExtenso(m)}</p>}
          <PrecoMaximo
            valor={m.pmc}
            unidade={modo === "unidade" ? m.unidade : undefined}
            porUnidadeValor={modo === "unidade" ? m.preco_por_unidade : undefined}
          />
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
  // A busca de origem segue para as caixinhas, para o "voltar" continuar funcionando ao navegar
  // entre equivalentes. Sem busca de origem (link direto ou vindo do comparativo), oferece nova busca.
  const temBusca = Boolean(sp.get("q"));
  const voltar = temBusca ? `/buscar?${sp}` : "/";
  const consulta = temBusca ? `?${sp}` : "";
  const b = c.base;
  const unidade = b.unidade;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Link href={voltar} className="text-sm font-medium text-tinta-2 hover:text-marca">
        {temBusca ? `← Voltar aos resultados de “${sp.get("q")}”` : "← Nova busca"}
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
          {c.melhorMesmaCaixa ? (
            <p className="mt-2 rounded-xl bg-economia-fundo p-3 text-economia">
              <strong className="text-2xl">{pct(c.melhorMesmaCaixa.economia!.fracao)} mais barato</strong>
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
              Em outra caixa sai{" "}
              <strong className="text-tinta">
                {pct(c.melhorPorUnidade.economia!.fracao)} mais barato {porUnidade(c.melhorPorUnidade.medicamento.unidade)}
              </strong>
              : {c.melhorPorUnidade.medicamento.produto} ({c.melhorPorUnidade.medicamento.selo.toLowerCase()},{" "}
              {quantidadePorExtenso(c.melhorPorUnidade.medicamento)}).
            </p>
          )}

          <div className="mt-1 border-t border-linha pt-2">
            <PrecoMaximo valor={b.pmc} unidade={unidade} porUnidadeValor={b.preco_por_unidade} />
            <p className="mt-0.5 text-[11px] leading-snug text-tinta-3">
              É o teto definido pela CMED: a farmácia não pode cobrar mais que isso. Na prática o preço costuma ser bem menor,
              principalmente nos genéricos, por isso a comparação entre equivalentes é feita em porcentagem.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold">Equivalentes na mesma caixa ({c.mesmaCaixa.length})</h2>
        <p className="mb-3 text-sm text-tinta-2">
          Mesmo princípio ativo, dosagem, forma e quantidade ({quantidadePorExtenso(b)}), do mais barato para o mais caro.
        </p>
        <ul className="flex snap-x gap-3 overflow-x-auto pb-3">
          {c.mesmaCaixa.map((item) => (
            <Caixa key={item.medicamento.id} item={item} base={b.id} modo="caixa" consulta={consulta} />
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
              <Caixa key={item.medicamento.id} item={item} base={b.id} modo="unidade" consulta={consulta} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tinta-3">Nenhuma outra caixa encontrada.</p>
        )}
      </section>

      <aside className="mt-6 space-y-1 rounded-xl border border-linha bg-papel p-4 text-xs leading-relaxed text-tinta-2">
        <p>
          A equivalência é calculada a partir dos dados da CMED (princípio ativo, dosagem e forma farmacêutica). Pela Lei nº
          9.787/1999, o genérico é intercambiável com o medicamento de referência. Pela Resolução CM-CMED nº 3/2025 (art.
          24), o preço fábrica do genérico não pode passar de 65% do preço do referência, ou seja, ele entra no mercado
          custando pelo menos 35% menos. Confirme a troca com o farmacêutico, principalmente entre similares.
        </p>
        <p>As ilustrações são geradas a partir dos dados do registro: a lista oficial não fornece imagens das embalagens.</p>
      </aside>
    </main>
  );
}
