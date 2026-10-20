// Mostrado na hora em que a busca é enviada, enquanto o servidor gera o embedding e consulta o
// Qdrant (numa instância nova, a carga do modelo leva alguns segundos).

export default function Carregando() {
  return (
    <main aria-busy="true">
      <section className="bg-noite pt-4 pb-8 text-white">
        <div className="mx-auto max-w-3xl px-4">
          <div className="h-12 animate-pulse rounded-md bg-noite-2" />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-6">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-tinta-2" role="status">
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-tinta-3 border-t-transparent" aria-hidden />
          Buscando medicamentos parecidos…
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="h-80 animate-pulse rounded-md border border-linha bg-papel" />
          ))}
        </ul>
      </section>
    </main>
  );
}
