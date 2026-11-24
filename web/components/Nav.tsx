"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "./Logo";
import { mainLinks, moreLinks } from "@/lib/nav";

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
  useEffect(() => {
    document.body.style.overflow = mobile ? "hidden" : "";
  }, [mobile]);

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-cream/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-8">
        <Link href="/" aria-label="cata home" onClick={() => setMobile(false)}><Logo /></Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {mainLinks.map(([l, h]) => (
            <Link key={h} href={h}
              className={`rounded-full px-3.5 py-1.5 text-[15px] transition-colors hover:bg-ink/5 ${active(h) ? "bg-ink/5 text-ink" : "text-muted"}`}>
              {l}
            </Link>
          ))}
          <div ref={ref} className="relative">
            <button onClick={() => setMore(!more)} aria-expanded={more}
              className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[15px] transition-colors hover:bg-ink/5 ${moreActive || more ? "bg-ink/5 text-ink" : "text-muted"}`}>
              more <motion.span animate={{ rotate: more ? 180 : 0 }} className="inline-block text-[10px]">▾</motion.span>
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
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1 font-mono text-[11px] text-muted md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F0B90B]" /> bnb chain
          </span>
          <Link href="/token" className="hidden rounded-full bg-soft px-3 py-1 font-mono text-[11px] text-deep md:block">$cata soon</Link>
          <button className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-surface transition-all hover:-translate-y-0.5 hover:bg-deep active:translate-y-0">
            connect<span className="hidden sm:inline"> wallet</span>
          </button>
          <button onClick={() => setMobile(!mobile)} aria-label="menu" aria-expanded={mobile}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-full border border-ink/15 lg:hidden">
            <motion.span animate={mobile ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }} className="block h-0.5 w-4 rounded bg-ink" />
            <motion.span animate={mobile ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }} className="block h-0.5 w-4 rounded bg-ink" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobile && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "calc(100dvh - 4rem)" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: .3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-y-auto border-t border-ink/10 bg-cream lg:hidden">
            <div className="px-4 py-6">
              {mainLinks.map(([l, h], i) => (
                <motion.div key={h} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .04 * i }}>
                  <Link href={h} onClick={() => setMobile(false)} className={`block py-2 font-display text-4xl ${active(h) ? "text-pink" : "text-ink"}`}>{l}</Link>
                </motion.div>
              ))}
              <div className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted">more</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {moreLinks.map(([l, h, tag]) => (
                  <Link key={h} href={h} onClick={() => setMobile(false)} className={`flex items-center justify-between rounded-2xl bg-surface px-4 py-3 ${active(h) ? "text-pink" : "text-ink"}`}>
                    {l}{tag && <span className="font-mono text-[9px] text-deep">{tag}</span>}
                  </Link>
                ))}
              </div>
              <div className="mt-6 flex gap-2 font-mono text-[11px] text-muted">
                <span className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1"><span className="h-1.5 w-1.5 rounded-full bg-[#F0B90B]" /> bnb chain</span>
                <span className="rounded-full bg-soft px-3 py-1 text-deep">$cata soon</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
