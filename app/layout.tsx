import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Archivo, com eixo de largura: o nome nas ilustrações de caixa usa a versão condensada.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-caixa" });

export const metadata: Metadata = {
  title: "Genérico Certo",
  description: "Descubra o genérico equivalente e quanto você economiza",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={archivo.variable}>
      <body className="min-h-screen pb-20">
        <header className="bg-noite text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
            <Link href="/" aria-label="Genérico Certo, página inicial">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-cabecalho.webp" alt="Genérico Certo" width={140} height={60} className="h-12 w-auto" />
            </Link>
            <nav className="flex gap-1 text-sm font-medium">
              <Link href="/" className="rounded-md px-3 py-2 text-white/85 hover:bg-noite-2 hover:text-white">
                Buscar
              </Link>
              <Link href="/comparativo" className="rounded-md px-3 py-2 text-white/85 hover:bg-noite-2 hover:text-white">
                Comparativo
              </Link>
            </nav>
          </div>
        </header>

        {children}

        <footer
          role="contentinfo"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-linha bg-papel/95 backdrop-blur"
        >
          <p className="mx-auto max-w-6xl px-4 py-2.5 text-xs leading-snug text-tinta-2">
            <strong className="font-semibold text-tinta">Ferramenta informativa.</strong> Os valores são o teto legal
            definido pela CMED (preço máximo ao consumidor com ICMS de 19%) e o preço na farmácia pode ser menor. Não
            substitui orientação médica ou farmacêutica.
          </p>
        </footer>
      </body>
    </html>
  );
}
