import { COR_SELO } from "./Embalagem";

export default function Selo({ selo, className = "" }: { selo: string; className?: string }) {
  const cor = COR_SELO[selo] ?? { fundo: "#5f6368", tinta: "#ffffff" };
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${className}`}
      style={{ background: cor.fundo, color: cor.tinta }}
    >
      {selo}
    </span>
  );
}
