import Link from "next/link";
import { Logo } from "./Logo";

const cols = [
  ["shop", [["packs", "/packs"], ["market", "/market"], ["catalog", "/catalog"], ["live rips", "/live"], ["gift a pack", "/gift"]]],
  ["you", [["vault", "/vault"], ["predict", "/predict"], ["borrow", "/borrow"], ["scan", "/scan"], ["rewards", "/rewards"]]],
  ["soon", [["battles", "/battles"], ["fractional", "/fractional"], ["$cata", "/token"]]],
] as const;

export function Footer() {
  return (
    <footer className="mt-32 border-t border-ink/10 bg-surface">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-16 md:grid-cols-5 md:px-8">
        <div className="col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-muted">pull something real. graded cards on bnb chain, redeemable for the slab.</p>
          <p className="mt-4 inline-block rounded-full bg-cream px-3 py-1 font-mono text-[11px] text-muted">pay with bnb or usdt · card payments coming soon</p>
        </div>
        {cols.map(([t, ls]) => (
          <div key={t} className="flex flex-col gap-2 text-muted">
            <span className="font-mono text-xs uppercase tracking-widest text-ink">{t}</span>
            {ls.map(([l, h]) => <Link key={h} href={h} className="hover:text-pink">{l}</Link>)}
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 border-t border-ink/10 px-4 py-6 font-mono text-[11px] text-muted md:px-8">
        <span>© 2026 cata · bnb chain (56)</span>
        <span>all cards, prices and odds shown are sample data.</span>
      </div>
    </footer>
  );
}
