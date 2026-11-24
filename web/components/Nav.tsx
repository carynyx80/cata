"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const links = ["packs", "market", "catalog", "predict", "vault"];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-cream/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-8">
        <Link href="/" aria-label="cata home"><Logo /></Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link key={l} href={`/${l}`}
              className={`rounded-full px-3.5 py-1.5 text-[15px] transition-colors hover:bg-ink/5 ${path === "/" + l ? "bg-ink/5 text-ink" : "text-muted"}`}>
              {l}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1 font-mono text-[11px] text-muted md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F0B90B]" /> bnb chain
          </span>
          <span className="hidden rounded-full bg-soft px-3 py-1 font-mono text-[11px] text-deep md:block">$cata soon</span>
          <button className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface transition-all hover:-translate-y-0.5 hover:bg-deep active:translate-y-0">
            connect wallet
          </button>
        </div>
      </div>
    </header>
  );
}
