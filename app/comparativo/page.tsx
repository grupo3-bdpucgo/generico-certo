import Link from "next/link";
import resultadosJson from "@/benchmark/resultados.json";
import Selo from "@/components/Selo";
import { compararMotores, consultasDoBenchmark, INFO_MOTOR, MOTORES, type Motor, type ResultadoMotor } from "@/lib/comparativo";
import { brl, pct } from "@/lib/formatacao";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comparativo · Genérico Certo" };

const CATEGORIAS: Record<string, string> = {
  nome_comercial: "Nome comercial",
  erro_digitacao: "Erro de digitação",
  variacao_nomenclatura: "Variação de nomenclatura",
  principio_ativo: "Princípio ativo",
  coloquial: "Coloquial",
  mista: "Mista",
};

interface Agregado {
  consultas: number;
  acerto_top5: number;
  acerto_top5_ponderado: number;
  acaso_top5_medio: number;
  mrr_top10: number;
  precisao_top5: number;
  posicao_media: number | null;
  nao_encontrados_top10: number;
  tempo_servidor_mediana_ms: number;
  tempo_banco_mediana_ms: number;
  tempo_embedding_mediana_ms: number;
}
const R = resultadosJson as unknown as {
  gerado_em: string;
  agregados: {
    todas: Record<Motor, Agregado>;
    sem_desenvolvimento: Record<Motor, Agregado>;
    por_categoria_sem_desenvolvimento: Record<string, Record<Motor, Agregado>>;
  };
};

const ms = (n: number | null, casas = 0) => (n === null ? "–" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas })} ms`);

function Coluna({ r }: { r: ResultadoMotor }) {
  const info = INFO_MOTOR[r.motor];
  const acertos = r.resultados.slice(0, 5).filter((x) => x.correto).length;
  const temGabarito = r.resultados.some((x) => x.correto !== null);
  return (
    <section className="flex w-72 shrink-0 flex-col overflow-hidden rounded-md border border-linha bg-papel xl:w-auto">
      <header className="border-b border-linha p-3" style={{ borderTop: `4px solid ${info.cor}` }}>
        <p className="text-[11px] font-semibold tracking-wide text-tinta-3 uppercase">{info.banco}</p>
        <h3 className="font-bold">{info.nome}</h3>
        <p className="mt-0.5 text-xs leading-snug text-tinta-2">{info.descricao}</p>
        <dl className="numeros mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
          <dt className="text-tinta-3">no servidor</dt>
          <dd className="text-right font-semibold">{ms(r.tempoServidorMs, 2)}</dd>
          <dt className="text-tinta-3">ponta a ponta</dt>
          <dd className="text-right font-semibold">{ms(r.tempoBancoMs)}</dd>
          <dt className="text-tinta-3">embedding</dt>
          <dd className="text-right">{r.tempoEmbeddingMs ? ms(r.tempoEmbeddingMs) : "não usa"}</dd>
        </dl>
        {r.relaxado && <p className="mt-1 text-[11px] text-tinta-2">Nada com E lógico: relaxado para OU.</p>}
        {temGabarito && (
          <p className="mt-1 text-xs font-semibold">
            {acertos} de 5 corretos no top 5
          </p>
        )}
      </header>
      {r.erro ? (
        <p className="p-3 text-sm text-marca-escura">A consulta falhou.</p>
      ) : r.resultados.length === 0 ? (
        <p className="p-3 text-sm text-tinta-3">Nenhum resultado.</p>
      ) : (
        <ol className="divide-y divide-linha text-sm">
          {r.resultados.map((x, i) => (
            <li key={x.id} className={`flex gap-2 p-2.5 ${i >= 5 ? "opacity-60" : ""}`}>
              <span className="numeros w-5 shrink-0 text-right text-xs font-semibold text-tinta-3">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/medicamento/${x.id}`} className="leading-tight font-semibold hover:underline">
                  {x.medicamento.produto}
                </Link>
                <p className="truncate text-[11px] text-tinta-2" title={x.medicamento.substancia.join(" + ")}>
                  {x.medicamento.substancia.join(" + ")}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Selo selo={x.medicamento.selo} className="!text-[9px]" />
                  <span className="numeros text-xs">{brl(x.medicamento.pmc)}</span>
                </div>
                {x.similaridade != null && (
                  <p className="numeros mt-0.5 text-[11px] text-tinta-3" title="Similaridade de cosseno entre a consulta e o vetor denso do item">
                    {pct(x.similaridade)} de similaridade
                  </p>
                )}
              </div>
              {x.correto !== null && (
                <span
                  className={`shrink-0 text-sm font-bold ${x.correto ? "text-economia" : "text-tinta-3"}`}
                  title={x.correto ? "Correto pelo gabarito" : "Fora do gabarito"}
                  aria-label={x.correto ? "correto" : "incorreto"}
                >
                  {x.correto ? "✓" : "✗"}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Barra({ valor, cor, rotulo }: { valor: number; cor: string; rotulo: string }) {
  return (
    <div className="flex items-center gap-2" title={rotulo}>
      <div className="h-3 flex-1 overflow-hidden rounded-sm bg-fundo">
        <div className="h-full rounded-sm" style={{ width: `${Math.max(0, Math.min(1, valor)) * 100}%`, background: cor }} />
      </div>
      <span className="numeros w-12 text-right text-xs font-semibold">{rotulo}</span>
    </div>
  );
}

export default async function Comparativo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = String([sp.q].flat()[0] ?? "").trim().slice(0, 200);
  const dados = q ? await compararMotores(q) : null;
  const consultas = consultasDoBenchmark();
  const ag = R.agregados.sem_desenvolvimento;
  const agTodas = R.agregados.todas;

  return (
    <main>
      <section className="bg-noite pt-6 pb-8 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h1 className="text-2xl font-extrabold">Comparativo: busca vetorial × relacional</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/80">
            A mesma consulta nos cinco motores, com os mesmos 11.001 medicamentos da CMED: três no Qdrant (banco vetorial) e dois
            no PostgreSQL. Quando a consulta é uma das 28 do benchmark, cada resultado é marcado pelo gabarito.
          </p>
          <form action="/comparativo" method="get" className="mt-4 flex max-w-2xl overflow-hidden rounded-md bg-papel ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-marca">
            <label htmlFor="qc" className="sr-only">Consulta</label>
            <input id="qc" name="q" type="search" required defaultValue={q} placeholder="Digite uma consulta ou escolha uma abaixo" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-tinta focus:outline-none" />
            <button className="bg-marca px-6 font-semibold text-white hover:bg-marca-escura">Comparar</button>
          </form>
          <div className="mt-4 space-y-1.5 text-xs">
            {Object.entries(CATEGORIAS).map(([cat, nome]) => {
              const lista = consultas.filter((c) => c.categoria === cat);
              if (!lista.length) return null;
              return (
                <p key={cat} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-40 shrink-0 text-white/60">{nome}</span>
                  {lista.map((c) => (
                    <Link
                      key={c.id}
                      href={`/comparativo?q=${encodeURIComponent(c.consulta)}`}
                      className={`rounded-sm px-2 py-0.5 hover:bg-white/20 ${q === c.consulta ? "bg-marca text-white" : "bg-noite-2 text-white/90"}`}
                      title={c.desenvolvimento ? "Usada durante o desenvolvimento" : `Consulta #${c.id} do benchmark`}
                    >
                      {c.consulta}
                      {c.desenvolvimento ? " *" : ""}
                    </Link>
                  ))}
                </p>
              );
            })}
            <p className="pt-1 text-white/50">* usada durante o desenvolvimento</p>
          </div>
        </div>
      </section>

      {dados && (
        <section className="mx-auto max-w-[96rem] px-4 py-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">“{q}”</h2>
            {dados.teste ? (
              <p className="text-sm text-tinta-2">
                Consulta #{dados.teste.id} ({CATEGORIAS[dados.teste.categoria]}). Gabarito: {dados.teste.gabarito.descricao}.
              </p>
            ) : (
              <p className="text-sm text-tinta-3">Consulta livre: sem gabarito, os resultados não são marcados.</p>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3 xl:grid xl:grid-cols-5 xl:overflow-visible">
            {dados.motores.map((r) => (
              <Coluna key={r.motor} r={r} />
            ))}
          </div>
          <p className="mt-2 text-xs text-tinta-3">
            “No servidor” é o tempo de processamento informado pelo próprio banco (campo time do Qdrant; planejamento + execução
            do EXPLAIN ANALYZE no PostgreSQL). “Ponta a ponta” inclui a rede até os clusters em São Paulo. Uma única execução,
            sem aquecimento: para números confiáveis, veja o benchmark abaixo.
          </p>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-6">
        <h2 className="text-xl font-extrabold">Resultado do benchmark</h2>
        <p className="mt-1 max-w-3xl text-sm text-tinta-2">
          25 consultas escritas depois do congelamento do dicionário (commit aa9df01), em seis categorias, com gabarito por
          princípio ativo ou classe terapêutica. Cada consulta rodou 5 vezes por motor, depois de uma passada completa de
          aquecimento descartada; os tempos são medianas. A média ponderada dá peso 1 − p ao acerto de cada consulta, sendo p a
          chance de um sorteio ao acaso acertar no top 5 (em média {pct(ag.hibrido.acaso_top5_medio, 1)}).
        </p>

        <div className="mt-4 overflow-x-auto rounded-md border border-linha bg-papel">
          <table className="numeros w-full min-w-[760px] text-sm">
            <thead className="bg-fundo text-left text-xs text-tinta-2">
              <tr>
                <th className="p-3 font-semibold">Motor</th>
                <th className="p-3 font-semibold">Acerto no top 5</th>
                <th className="p-3 font-semibold">Ponderado</th>
                <th className="p-3 font-semibold">MRR@10</th>
                <th className="p-3 font-semibold">Precisão top 5</th>
                <th className="p-3 text-right font-semibold">Sem acerto (top 10)</th>
                <th className="p-3 text-right font-semibold">Servidor</th>
                <th className="p-3 text-right font-semibold">Ponta a ponta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {MOTORES.map((m) => {
                const a = ag[m];
                const info = INFO_MOTOR[m];
                return (
                  <tr key={m} className={m === "hibrido" ? "bg-economia-fundo/60" : ""}>
                    <td className="p-3">
                      <span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: info.cor }} aria-hidden />
                      <span className="font-semibold">{info.nome}</span>
                      <span className="ml-1 text-xs text-tinta-3">{info.banco}</span>
                    </td>
                    <td className="w-40 p-3"><Barra valor={a.acerto_top5} cor={info.cor} rotulo={pct(a.acerto_top5)} /></td>
                    <td className="p-3">{pct(a.acerto_top5_ponderado)}</td>
                    <td className="w-36 p-3"><Barra valor={a.mrr_top10} cor={info.cor} rotulo={a.mrr_top10.toFixed(2).replace(".", ",")} /></td>
                    <td className="p-3">{a.precisao_top5.toFixed(2).replace(".", ",")}</td>
                    <td className="p-3 text-right">{a.nao_encontrados_top10} de {a.consultas}</td>
                    <td className="p-3 text-right">{ms(a.tempo_servidor_mediana_ms, 2)}</td>
                    <td className="p-3 text-right">{ms(a.tempo_banco_mediana_ms)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-tinta-3">
          Com as 3 consultas usadas no desenvolvimento (28 no total), o acerto no top 5 fica em{" "}
          {MOTORES.map((m) => `${INFO_MOTOR[m].nome.toLowerCase()} ${pct(agTodas[m].acerto_top5)}`).join(", ")}.
        </p>

        <h3 className="mt-8 font-bold">Acerto no top 5 por categoria</h3>
        <div className="mt-2 overflow-x-auto rounded-md border border-linha bg-papel">
          <table className="numeros w-full min-w-[640px] text-sm">
            <thead className="bg-fundo text-xs text-tinta-2">
              <tr>
                <th className="p-3 text-left font-semibold">Categoria</th>
                {MOTORES.map((m) => (
                  <th key={m} className="p-3 font-semibold">{INFO_MOTOR[m].nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(CATEGORIAS).map(([cat, nome]) => {
                const linha = R.agregados.por_categoria_sem_desenvolvimento[cat];
                if (!linha || !linha.hibrido.consultas) return null;
                return (
                  <tr key={cat} className="border-t border-linha">
                    <td className="p-3">
                      {nome} <span className="text-xs text-tinta-3">(n={linha.hibrido.consultas})</span>
                    </td>
                    {MOTORES.map((m) => {
                      const v = linha[m].acerto_top5;
                      return (
                        <td key={m} className="p-1.5 text-center">
                          <span
                            className="block rounded-md py-1.5 font-semibold"
                            style={{ background: `rgba(37,106,191,${0.08 + v * 0.8})`, color: v >= 0.55 ? "#fff" : "#16161a" }}
                          >
                            {pct(v)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid gap-4 text-sm leading-relaxed text-tinta-2 md:grid-cols-2">
          <div className="rounded-md border border-linha bg-papel p-4">
            <h3 className="mb-1 font-bold text-tinta">Por que o site usa o híbrido</h3>
            <p>
              O híbrido acerta mais no top 5 ({pct(ag.hibrido.acerto_top5)} contra {pct(ag.fulltext.acerto_top5)} do full text),
              mas com precisão menor ({ag.hibrido.precisao_top5.toFixed(2).replace(".", ",")} contra{" "}
              {ag.fulltext.precisao_top5.toFixed(2).replace(".", ",")}): traz mais acertos junto com mais ruído. Para quem procura
              um remédio, encontrar o certo importa mais que ter os cinco resultados limpos, e o híbrido é o único que vai bem
              tanto em nome comercial quanto em erro de digitação e linguagem coloquial.
            </p>
          </div>
          <div className="rounded-md border border-linha bg-papel p-4">
            <h3 className="mb-1 font-bold text-tinta">Como ler os tempos</h3>
            <p>
              No servidor, os motores vetoriais levam de 1 a 3 ms e o full text menos de 1 ms; o ILIKE custa cerca de 45 ms por
              varrer o texto. O tempo ponta a ponta é dominado pela rede até São Paulo, e respostas maiores do Qdrant pagam um
              atraso fixo de cerca de 40 ms no TCP. No full text, as consultas relaxadas de E para OU fazem duas idas ao banco.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
