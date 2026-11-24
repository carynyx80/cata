"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { Page, PageHead, btnPink, btnLine } from "@/components/ui";
import { fmt } from "@/lib/data";
import { api, ApiError, type ApiScan } from "@/lib/api";

type Result = { match: string; set: string; confidence: number; grade: string; price: number | null; cardId?: string };

export default function Scan() {
  const [img, setImg] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "scanning" | "done" | "off" | "error">("idle");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
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
    const r = new FileReader();
    r.onload = () => { setImg(String(r.result)); setState("scanning"); scan(f); };
    r.readAsDataURL(f);
  };
  return (
    <Page>
      <PageHead kicker="ai scan" title="snap it. know it." sub="drop a photo of any card. our ai matches it, estimates the grade and prices it — then sell it to cata or ship it to the vault." />
      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <Reveal>
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files[0]); }}
            onClick={() => ref.current?.click()}
            className={`relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[32px] border-2 border-dashed transition ${drag ? "border-pink bg-soft" : "border-ink/20 bg-surface hover:border-pink"}`}>
            <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => load(e.target.files?.[0])} />
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="your card" className="h-full w-full object-contain p-6" />
            ) : (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pink font-display text-3xl text-surface">+</div>
                <div className="mt-5 font-display text-2xl">drop a photo</div>
                <div className="mt-1 text-muted">or tap to upload · front of card, good light</div>
              </div>
            )}
            {state === "scanning" && <motion.div className="absolute inset-x-6 h-1 rounded-full bg-pink shadow-[0_0_20px_#E2487F]" initial={{ top: "8%" }} animate={{ top: ["8%", "90%", "8%"] }} transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }} />}
          </div>
        </Reveal>
        <Reveal delay={.06}>
          <div className="h-full rounded-[32px] bg-ink p-6 text-surface md:p-8">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-surface/60">result</span>
              <span className="rounded-full bg-surface/10 px-3 py-1 font-mono text-[10px] text-soft">✦ powered by ai · estimates only</span>
            </div>
            <AnimatePresence mode="wait">
              {state === "done" && res ? (
                <motion.div key="r" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <h3 className="mt-6 font-display text-3xl">{res.match}</h3>
                  <div className="font-mono text-xs text-surface/60">{res.set}</div>
                  <div className="mt-6 grid grid-cols-3 gap-3 font-mono">
                    {[["match", `${Math.round(res.confidence * 100)}%`], ["est. grade", res.grade], ["est. price", res.price ? fmt(Math.round(res.price)) : "—"]].map(([k, v]) => (
                      <div key={k} className="rounded-2xl bg-surface/5 p-3"><div className="text-[10px] uppercase tracking-widest text-surface/50">{k}</div><div className="mt-1 text-xl">{v}</div></div>
                    ))}
                  </div>
                  <div className="mt-4 h-1.5 rounded-full bg-surface/10"><motion.div className="h-full rounded-full bg-pink" initial={{ width: 0 }} animate={{ width: `${res.confidence * 100}%` }} transition={{ duration: .8 }} /></div>
                  <div className="mt-8 flex flex-wrap gap-3">
                    {res.cardId ? <a href={`/catalog/${encodeURIComponent(res.cardId)}`} className={btnPink}>see prices →</a> : <button className={btnPink}>sell to cata</button>}
                    <button className={`${btnLine} border-surface text-surface hover:bg-surface hover:text-ink`}>ship to vault</button>
                  </div>
                  <p className="mt-5 text-xs text-surface/50">ai grades are estimates. the final grade comes from psa, bgs or cgc once the card is in hand.</p>
                </motion.div>
              ) : (
                <motion.div key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-16 text-center text-surface/50">
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
    </Page>
  );
}
