import Link from "next/link";
import Embalagem from "./Embalagem";
import Selo from "./Selo";
import { brl, brlUnidade, porUnidade } from "@/lib/formatacao";
import type { ResultadoBusca } from "@/lib/busca";

export default function CardMedicamento({ r, voltar }: { r: ResultadoBusca; voltar: string }) {
  const m = r.medicamento;
  return (
    <Link
      href={`/medicamento/${r.id}${voltar ? `?${voltar}` : ""}`}
      className="group flex flex-col overflow-hidden rounded-md border border-linha bg-papel transition-colors hover:border-tinta"
    >
      <div className="border-b border-linha bg-prateleira px-5 pt-5 pb-3">
        <Embalagem m={m} uid={`card-${r.id}`} className="w-full" titulo={false} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base leading-tight font-bold text-tinta">{m.produto}</h3>
          <Selo selo={m.selo} className="shrink-0" />
        </div>
        <p className="text-xs text-tinta-2">{m.laboratorio}</p>
        <p className="line-clamp-2 text-xs text-tinta-3" title={m.apresentacao}>
          {m.apresentacao}
        </p>
        {/* Sem percentual de similaridade aqui: ao lado do preço ele seria lido como desconto
            (a similaridade aparece só em /comparativo). O preço da CMED é um teto, não o preço de
            balcão, então fica pequeno e rotulado; o destaque é o convite para comparar. */}
        <div className="mt-auto flex flex-col gap-1 pt-2">
          <p className="text-sm font-semibold text-marca-escura underline decoration-1 underline-offset-2">Ver equivalentes e economia</p>
          <p className="numeros text-[11px] leading-snug text-marca-escura">
            Preço máximo: até {brl(m.pmc)}
            {m.preco_por_unidade !== null && (
              <>
                {" "}
                · {brlUnidade(m.preco_por_unidade)} {porUnidade(m.unidade)}
              </>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
