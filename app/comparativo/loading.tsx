export default function Carregando() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8" aria-busy="true">
      <p className="flex items-center gap-2 text-sm font-semibold text-tinta-2" role="status">
        <span className="inline-block size-4 animate-spin rounded-full border-2 border-tinta-3 border-t-transparent" aria-hidden />
        Executando a consulta nos cinco motores…
      </p>
      <div className="mt-4 grid gap-3 xl:grid-cols-5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-96 animate-pulse rounded-md border border-linha bg-papel" />
        ))}
      </div>
    </main>
  );
}
