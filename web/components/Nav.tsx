"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "./Logo";
import { mainLinks, moreLinks } from "@/lib/nav";
import { CataPill, ConnectButton } from "./web3/ConnectButton";

export function Nav() {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = (h: string) => path === h || path.startsWith(h + "/");
  const moreActive = moreLinks.some(([, h]) => active(h));

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMore(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  // close menus on route change (state-from-props pattern, no effect needed)
  const [seen, setSeen] = useState(path);
  if (seen !== path) { setSeen(path); setMobile(false); setMore(false); }
  useEffect(() => {
    if (!mobile) return;
    const html = document.documentElement;
    const prev = [document.body.style.overflow, html.style.overflow];
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMobile(false);
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => wide.matches && setMobile(false);
    window.addEventListener("keydown", esc);
    wide.addEventListener("change", onWide);
    return () => {
      [document.body.style.overflow, html.style.overflow] = prev;
      window.removeEventListener("keydown", esc);
      wide.removeEventListener("change", onWide);
    };
  }, [mobile]);

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-cream/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:gap-6 md:px-8">
        <Link href="/" onClick={() => setMobile(false)} className="flex min-h-11 shrink-0 items-center rounded-full"><Logo /><span className="sr-only"> home</span></Link>
        <nav aria-label="main" className="hidden items-center gap-1 lg:flex">
          {mainLinks.map(([l, h]) => (
            <Link key={h} href={h} aria-current={active(h) ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-[15px] transition-colors hover:bg-ink/5 ${active(h) ? "bg-ink/5 text-ink" : "text-muted"}`}>
              {l}
            </Link>
          ))}
          <div ref={ref} className="relative">
            <button onClick={() => setMore(!more)} aria-expanded={more} aria-haspopup="true"
              className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[15px] transition-colors hover:bg-ink/5 ${moreActive || more ? "bg-ink/5 text-ink" : "text-muted"}`}>
              more <motion.span aria-hidden animate={{ rotate: more ? 180 : 0 }} className="inline-block text-[10px]">▾</motion.span>
            </button>
            <AnimatePresence>
              {more && (
                <motion.div initial={{ opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: .98 }} transition={{ duration: .18 }}
                  className="absolute left-0 top-11 w-56 origin-top-left rounded-3xl border border-ink/10 bg-surface p-2 shadow-[0_30px_60px_-25px_rgba(43,26,34,.45)]">
                  {moreLinks.map(([l, h, tag]) => (
                    <Link key={h} href={h} onClick={() => setMore(false)}
                      className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-[15px] transition hover:bg-cream ${active(h) ? "text-pink" : "text-ink"}`}>
                      {l}{tag && <span className="rounded-full bg-soft px-2 py-0.5 font-mono text-[9px] text-deep">{tag}</span>}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1 font-mono text-[11px] text-muted md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F0B90B]" /> bnb chain
          </span>
          <CataPill className="hidden rounded-full bg-soft px-3 py-1 font-mono text-[11px] text-deep md:block" />
          <ConnectButton />
          <button onClick={() => setMobile(!mobile)} aria-label={mobile ? "close menu" : "open menu"} aria-expanded={mobile} aria-controls="mobile-menu"
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-1.5 rounded-full border border-ink/15 lg:hidden">
            <motion.span animate={mobile ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }} className="block h-0.5 w-4 rounded bg-ink" />
            <motion.span animate={mobile ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }} className="block h-0.5 w-4 rounded bg-ink" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobile && (
          <motion.nav id="mobile-menu" aria-label="mobile" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "calc(100dvh - 4rem - env(safe-area-inset-top))" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: .3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-y-auto overscroll-contain border-t border-ink/10 bg-cream lg:hidden">
            <div className="pb-safe pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 md:px-8">
              {mainLinks.map(([l, h], i) => (
                <motion.div key={h} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .04 * i }}>
                  <Link href={h} onClick={() => setMobile(false)} aria-current={active(h) ? "page" : undefined} className={`block py-2 font-display text-[clamp(2rem,9vw,2.25rem)] ${active(h) ? "text-pink" : "text-ink"}`}>{l}</Link>
                </motion.div>
              ))}
              <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted">more</div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {moreLinks.map(([l, h, tag]) => (
                  <Link key={h} href={h} onClick={() => setMobile(false)} className={`flex min-h-12 items-center justify-between rounded-2xl bg-surface px-4 py-3 ${active(h) ? "text-pink" : "text-ink"}`}>
                    {l}{tag && <span className="font-mono text-[9px] text-deep">{tag}</span>}
                  </Link>
                ))}
              </div>
              <div className="mt-6 flex gap-2 font-mono text-[11px] text-muted">
                <span className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1"><span className="h-1.5 w-1.5 rounded-full bg-[#F0B90B]" /> bnb chain</span>
                <CataPill className="flex min-h-11 items-center rounded-full bg-soft px-4 text-deep" />
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
