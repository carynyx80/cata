"use client";
import { motion } from "framer-motion";
import type { Card } from "@/lib/data";

function Glyph({ g }: { g: Card["glyph"] }) {
  const c = "#FBF6EE";
  switch (g) {
    case "flame": return <path d="M50 18c8 14 20 20 20 38a20 20 0 0 1-40 0c0-10 6-14 8-22 4 6 6 8 8 8-2-8 0-16 4-24z" fill={c} />;
    case "moon": return <path d="M60 20a30 30 0 1 0 22 46A24 24 0 0 1 60 20z" fill={c} />;
    case "bolt": return <path d="M56 14 30 54h18l-6 32 28-42H52l4-30z" fill={c} />;
    case "ball": return <g fill="none" stroke={c} strokeWidth="5"><circle cx="50" cy="50" r="28" /><path d="M22 50h56M50 22v56M30 30c10 10 10 30 0 40M70 30c-10 10-10 30 0 40" /></g>;
    case "wave": return <path d="M18 56c10-12 22-12 32 0s22 12 32 0v14c-10 12-22 12-32 0s-22-12-32 0z" fill={c} />;
    default: return <path d="M50 14l9 27h28l-23 17 9 27-23-17-23 17 9-27-23-17h28z" fill={c} />;
  }
}

export function Slab({ card, className = "", hover = true }: { card: Card; className?: string; hover?: boolean }) {
  return (
    <motion.div
      whileHover={hover ? { y: -8, rotate: 0, scale: 1.02 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className={`relative aspect-[2/3] w-full rounded-[22px] border-[5px] border-ink bg-surface p-3 shadow-[0_24px_50px_-20px_rgba(43,26,34,.45)] ${className}`}
    >
      <div className="flex items-start justify-between gap-2 rounded-[10px] bg-pink px-3 py-2 text-surface">
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] uppercase tracking-[.12em]">{card.grader} · {card.name}</div>
          <div className="font-mono text-[9px] opacity-80">cert #{card.cert}</div>
        </div>
        <div className="font-display text-2xl leading-none">{card.grade}</div>
      </div>
      <div
        className="relative mt-3 flex h-[calc(100%-4.25rem)] items-center justify-center overflow-hidden rounded-[14px]"
        style={{ background: `linear-gradient(140deg, ${card.hue[0]}, ${card.hue[1]})` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.45),transparent_55%)]" />
        <svg viewBox="0 0 100 100" className="relative w-1/2 drop-shadow-[0_6px_10px_rgba(43,26,34,.25)]"><Glyph g={card.glyph} /></svg>
        {card.digital && (
          <span className="absolute bottom-2 left-2 rounded-full bg-surface/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink">digital</span>
        )}
      </div>
    </motion.div>
  );
}
