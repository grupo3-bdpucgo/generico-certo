// Formulário GET: funciona sem JavaScript e a URL da busca pode ser compartilhada.

import { TARJAS, rotuloTarja } from "@/lib/formatacao";
import { GRUPOS_FORMA } from "@/lib/normalizacao";
import type { ParametrosBusca } from "@/lib/parametros";

export default function FormBusca({ busca, grande = false }: { busca: ParametrosBusca; grande?: boolean }) {
  const f = busca.filtros;
  const temFiltro = Boolean(f.apenasGenericos || f.precoMaximo !== undefined || f.tarjas?.length);
  return (
    <form action="/buscar" method="get" role="search" className="w-full">
      <label htmlFor="q" className="sr-only">
        Nome do remédio, princípio ativo ou sintoma
      </label>
      <div className="flex overflow-hidden rounded-xl bg-papel shadow-lg ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-marca">
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={busca.q}
          placeholder="Ex.: dorflex, dipirona gotas, alergia sem sonolência"
          autoComplete="off"
          required
          className={`min-w-0 flex-1 bg-transparent px-4 text-tinta placeholder:text-tinta-3 focus:outline-none ${grande ? "py-4 text-lg" : "py-3 text-base"}`}
        />
        <button
          type="submit"
          className="bg-marca px-5 font-semibold text-white transition hover:bg-marca-escura sm:px-7"
        >
          Buscar
        </button>
      </div>

      {/* Apresentação: visível sempre, tudo em "–" (sem preferência) por padrão. */}
      <fieldset className="mt-3 grid grid-cols-1 gap-2 text-sm text-white/90 sm:grid-cols-3">
        <legend className="sr-only">Apresentação do remédio</legend>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/70">Forma</span>
          <select name="forma" defaultValue={f.forma ?? ""} className="rounded-md bg-papel px-2 py-1.5 text-tinta">
            <option value="">–</option>
            {GRUPOS_FORMA.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/70">Dosagem</span>
          <input
            name="dose"
            defaultValue={busca.doseDigitada}
            placeholder="–  (ex.: 75 mg, 500 mg/ml)"
            autoComplete="off"
            className="rounded-md bg-papel px-2 py-1.5 text-tinta placeholder:text-tinta-3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-white/70">Unidades na caixa</span>
          <input
            name="qtd"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            defaultValue={f.quantidade ?? ""}
            placeholder="–  (ex.: 30)"
            className="rounded-md bg-papel px-2 py-1.5 text-tinta placeholder:text-tinta-3"
          />
        </label>
      </fieldset>
      {busca.doseDigitada && !f.dose && (
        <p className="mt-1 text-xs text-white/70">Não entendi a dosagem “{busca.doseDigitada}”; ela foi ignorada. Use, por exemplo, 75 mg.</p>
      )}

      <details className="group mt-3 text-sm text-white/90" open={temFiltro}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 py-0.5 font-medium select-none hover:text-white">
          <span className="transition group-open:rotate-90" aria-hidden>
            ▸
          </span>
          Mais filtros{temFiltro ? " (ativos)" : ""}
        </summary>
        <div className="mt-2 grid gap-4 rounded-xl bg-noite-2 p-4 sm:grid-cols-[auto_auto_1fr]">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="generico" value="1" defaultChecked={f.apenasGenericos} className="size-4 accent-marca" />
            Só genéricos
          </label>
          <label className="flex items-center gap-2">
            Preço máximo
            <span className="flex items-center rounded-md bg-papel text-tinta">
              <span className="pl-2 text-tinta-3">R$</span>
              <input
                type="number"
                name="precoMax"
                min="0"
                step="0.01"
                inputMode="decimal"
                defaultValue={f.precoMaximo ?? ""}
                className="w-24 bg-transparent px-2 py-1 focus:outline-none"
              />
            </span>
          </label>
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <legend className="sr-only">Tarja</legend>
            <span className="text-white/70">Tarja:</span>
            {TARJAS.map((t) => (
              <label key={t} className="flex items-center gap-1.5">
                <input type="checkbox" name="tarja" value={t} defaultChecked={f.tarjas?.includes(t)} className="size-4 accent-marca" />
                {rotuloTarja(t)}
              </label>
            ))}
          </fieldset>
        </div>
      </details>
    </form>
  );
}
