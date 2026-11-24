import Link from "next/link";
import { Logo } from "./Logo";

const cols = [
  ["shop", [["packs", "/packs"], ["market", "/market"], ["catalog", "/catalog"], ["live rips", "/live"], ["gift a pack", "/gift"]]],
  ["you", [["vault", "/vault"], ["predict", "/predict"], ["borrow", "/borrow"], ["scan", "/scan"], ["rewards", "/rewards"]]],
  ["soon", [["battles", "/battles"], ["fractional", "/fractional"], ["$cata", "/token"]]],
] as const;

export function Footer() {
  return (
    <footer className="mt-20 border-t border-ink/10 bg-surface sm:mt-32">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-14 sm:grid-cols-3 sm:gap-10 sm:py-16 md:grid-cols-5 md:px-8">
        <div className="col-span-2 sm:col-span-3 md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-muted">pull something real. graded cards on bnb chain, redeemable for the slab.</p>
          <p className="mt-4 inline-block rounded-full bg-cream px-3 py-1 font-mono text-[11px] text-muted">pay with bnb or usdt · card payments coming soon</p>
        </div>
        {cols.map(([t, ls]) => (
          <nav key={t} aria-label={t} className="flex flex-col gap-2 text-muted pointer-coarse:gap-0">
            <h2 className="font-mono text-xs font-normal uppercase tracking-widest text-ink pointer-coarse:mb-1">{t}</h2>
            {ls.map(([l, h]) => <Link key={h} href={h} className="rounded-full hover:text-pink pointer-coarse:py-2.5">{l}</Link>)}
          </nav>
        ))}
      </div>
      <div className="pb-safe mx-auto flex max-w-7xl flex-wrap justify-between gap-2 border-t border-ink/10 px-4 pt-6 font-mono text-[11px] text-muted md:px-8 md:pb-6">
        <span>© 2026 cata · bnb chain (56)</span>
        <span>all cards, prices and odds shown are sample data.</span>
      </div>
    </footer>
  );
}
