export default function Carregando() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6" aria-busy="true">
      <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-tinta-2" role="status">
        <span className="inline-block size-4 animate-spin rounded-full border-2 border-tinta-3 border-t-transparent" aria-hidden />
        Comparando preços entre equivalentes…
      </p>
      <div className="h-72 animate-pulse rounded-md border border-linha bg-papel" aria-hidden />
      <div className="mt-8 flex gap-3" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-64 w-48 shrink-0 animate-pulse rounded-md border border-linha bg-papel" />
        ))}
      </div>
    </main>
  );
}
