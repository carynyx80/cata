"use client";
import { useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, btnPink, btnLine } from "@/components/ui";
import { fmt } from "@/lib/data";
import { api, ApiError, type ApiScan } from "@/lib/api";

/** page-level a11y + responsive helpers (scoped here so shared components stay untouched) */
const shell = "[&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-pink [&_h1]:text-[clamp(2.25rem,9vw,6rem)] [&_h1]:text-balance";

type Result = { match: string; set: string; confidence: number; grade: string; price: number | null; cardId?: string };

export default function Scan() {
  const [img, setImg] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "scanning" | "done" | "off" | "error">("idle");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const cam = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  // POST /scan (multipart). 503 = no model key configured yet → "ai scan switches on soon"
  const scan = async (f: File) => {
    const body = new FormData();
    body.append("image", f);
    try {
      const r = await api<ApiScan>("/scan", { method: "POST", body, timeoutMs: 60_000 });
      const m = r.matches[0];
      if (!m) { setErr("no match — try a sharper photo of the front."); setState("error"); return; }
      setRes({ match: m.name.toLowerCase(), set: m.set.toLowerCase(), confidence: m.confidence, grade: r.estimatedGrade ? `~${r.estimatedGrade}` : "—", price: r.priceUsd, cardId: m.cardId });
      setState("done");
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) setState("off");
      else { setErr(e instanceof ApiError && e.status === 413 ? "that photo is too big — max 5 mb." : "scan failed — try again in a moment."); setState("error"); }
    }
  };
  const load = (f?: File) => {
    if (!f || !f.type.startsWith("image/")) return;
    setRes(null); setErr("");
    const r = new FileReader();
    r.onload = () => { setImg(String(r.result)); setState("scanning"); scan(f); };
    r.readAsDataURL(f);
  };
  return (
    <MotionConfig reducedMotion="user"><div className={shell}><Page>
      <PageHead kicker="ai scan" title="snap it. know it." sub="drop a photo of any card. our ai matches it, estimates the grade and prices it — then sell it to cata or ship it to the vault." />
      <div className="mt-10 grid gap-5 sm:mt-12 lg:grid-cols-2">
        <Reveal className="min-w-0">
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files[0]); }}
            onClick={() => ref.current?.click()}
            aria-busy={state === "scanning"}
            className={`relative flex min-h-[320px] w-full cursor-pointer sm:aspect-[4/3] sm:min-h-0 flex-col items-center justify-center overflow-hidden rounded-[28px] border-2 border-dashed transition sm:rounded-[32px] ${drag ? "border-pink bg-soft" : "border-ink/20 bg-surface hover:border-pink"}`}>
            <input ref={ref} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
            {/* phones: open the rear camera straight away */}
            <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} aria-hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
            {img ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="your card" className="h-full w-full object-contain p-6" />
                <button type="button" onClick={(e) => { e.stopPropagation(); ref.current?.click(); }} className="absolute bottom-3 right-3 min-h-11 rounded-full bg-ink/85 px-4 font-mono text-xs text-surface transition hover:bg-pink">replace photo</button>
              </>
            ) : (
              <div className="px-5 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink font-display text-3xl text-surface" aria-hidden>+</div>
                <div className="mt-5 font-display text-2xl"><span className="pointer-coarse:hidden">drop a photo</span><span className="hidden pointer-coarse:inline">snap or upload</span></div>
                <div className="mt-1 text-[15px] text-muted"><span className="pointer-coarse:hidden">or click to upload</span><span className="hidden pointer-coarse:inline">tap to choose a photo</span> · front of card, good light</div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={(e) => { e.stopPropagation(); cam.current?.click(); }} className={`${btnPink} min-h-11 px-5 py-2.5 text-sm`}>take a photo</button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); ref.current?.click(); }} className={`${btnLine} min-h-11 px-5 py-2.5 text-sm`}>upload</button>
                </div>
              </div>
            )}
            {state === "scanning" && (reduce
              ? <div className="absolute inset-x-6 top-1/2 h-1 rounded-full bg-pink shadow-[0_0_20px_#E2487F]" aria-hidden />
              : <motion.div aria-hidden className="absolute inset-x-6 h-1 rounded-full bg-pink shadow-[0_0_20px_#E2487F]" initial={{ top: "8%" }} animate={{ top: ["8%", "90%", "8%"] }} transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }} />)}
          </div>
        </Reveal>
        <Reveal delay={.06} className="min-w-0">
          <div className="h-full min-h-[300px] rounded-[28px] bg-ink p-5 text-surface sm:rounded-[32px] sm:p-6 md:p-8" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-surface/60">result</span>
              <span className="rounded-full bg-surface/10 px-3 py-1 font-mono text-[10px] text-soft">✦ powered by ai · estimates only</span>
            </div>
            <AnimatePresence mode="wait">
              {state === "done" && res ? (
                <motion.div key="r" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <h3 className="mt-6 font-display text-[clamp(1.6rem,6vw,1.875rem)] leading-tight [overflow-wrap:anywhere]">{res.match}</h3>
                  <div className="font-mono text-xs text-surface/60">{res.set}</div>
                  <div className="mt-6 grid grid-cols-3 gap-2 font-mono sm:gap-3">
                    {[["match", `${Math.round(res.confidence * 100)}%`], ["est. grade", res.grade], ["est. price", res.price ? fmt(Math.round(res.price)) : "—"]].map(([k, v]) => (
                      <div key={k} className="min-w-0 rounded-2xl bg-surface/5 p-2.5 sm:p-3"><div className="text-[10px] uppercase tracking-wider text-surface/50 sm:tracking-widest">{k}</div><div className="mt-1 text-[clamp(1rem,4vw,1.25rem)] [overflow-wrap:anywhere]">{v}</div></div>
                    ))}
                  </div>
                  <div className="mt-4 h-1.5 rounded-full bg-surface/10"><motion.div className="h-full rounded-full bg-pink" initial={{ width: 0 }} animate={{ width: `${res.confidence * 100}%` }} transition={{ duration: .8 }} /></div>
                  <div className="mt-8 flex flex-wrap gap-3">
                    {res.cardId ? <a href={`/catalog/${encodeURIComponent(res.cardId)}`} className={`${btnPink} inline-flex min-h-11 items-center`}>see prices →</a> : <button type="button" className={`${btnPink} min-h-11`}>sell to cata</button>}
                    <button type="button" className={`${btnLine} min-h-11 border-surface text-surface hover:bg-surface hover:text-ink`}>ship to vault</button>
                  </div>
                  <p className="mt-5 text-sm text-surface/50">ai grades are estimates. the final grade comes from psa, bgs or cgc once the card is in hand.</p>
                </motion.div>
              ) : (
                <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-12 text-center text-[15px] text-surface/50 sm:mt-16">
                  {state === "scanning" ? "reading the card…"
                    : state === "off" ? <><span className="font-display text-2xl text-surface">ai scan switches on soon.</span><br /><span className="mt-2 inline-block">we&apos;re wiring up the model — check back shortly.</span></>
                    : state === "error" ? err
                    : "your match, grade estimate and price show up here."}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </Page></div></MotionConfig>
  );
}
