import { COR_SELO } from "./Embalagem";

export default function Selo({ selo, className = "" }: { selo: string; className?: string }) {
  const cor = COR_SELO[selo] ?? { fundo: "#5f6368", tinta: "#ffffff" };
  return (
    <span
      className={`inline-flex items-center rounded-sm px-1.5 py-px text-[10.5px] font-bold uppercase tracking-wider ${className}`}
      style={{ background: cor.fundo, color: cor.tinta }}
    >
      {selo}
    </span>
  );
}
