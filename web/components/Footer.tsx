import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-32 border-t border-ink/10 bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-4 md:px-8">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-muted">pull something real. graded cards on bnb chain, redeemable for the slab.</p>
        </div>
        <div className="flex flex-col gap-2 text-muted">
          <span className="font-mono text-xs uppercase tracking-widest text-ink">shop</span>
          {["packs", "market", "catalog"].map((l) => <Link key={l} href={`/${l}`} className="hover:text-pink">{l}</Link>)}
        </div>
        <div className="flex flex-col gap-2 text-muted">
          <span className="font-mono text-xs uppercase tracking-widest text-ink">you</span>
          {["vault", "predict"].map((l) => <Link key={l} href={`/${l}`} className="hover:text-pink">{l}</Link>)}
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 border-t border-ink/10 px-4 py-6 font-mono text-[11px] text-muted md:px-8">
        <span>© 2026 cata · bnb chain (56)</span>
        <span>all cards, prices and odds shown are sample data.</span>
      </div>
    </footer>
  );
}
