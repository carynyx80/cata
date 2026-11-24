"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { bscscanTx } from "@/lib/contracts";

export type ToastKind = "pending" | "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; title: string; detail?: string; hash?: string };
type Api = {
  push: (t: Omit<Toast, "id">) => number;
  update: (id: number, t: Partial<Omit<Toast, "id">>) => void;
  dismiss: (id: number) => void;
};
const Ctx = createContext<Api>({ push: () => 0, update: () => {}, dismiss: () => {} });
export const useToasts = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    setList((l) => l.filter((t) => t.id !== id));
    const tm = timers.current.get(id); if (tm) clearTimeout(tm);
  }, []);
  const arm = useCallback((id: number, kind: ToastKind) => {
    const tm = timers.current.get(id); if (tm) clearTimeout(tm);
    if (kind !== "pending") timers.current.set(id, setTimeout(() => dismiss(id), kind === "error" ? 9000 : 7000));
  }, [dismiss]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = next.current++;
    setList((l) => [...l.slice(-3), { ...t, id }]);
    arm(id, t.kind);
    return id;
  }, [arm]);
  const update = useCallback((id: number, t: Partial<Omit<Toast, "id">>) => {
    setList((l) => l.map((x) => (x.id === id ? { ...x, ...t } : x)));
    if (t.kind) arm(id, t.kind);
  }, [arm]);
  const api = useMemo(() => ({ push, update, dismiss }), [push, update, dismiss]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-[70] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {list.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
              transition={{ duration: .22 }}
              className={`pointer-events-auto rounded-3xl p-4 shadow-[0_30px_60px_-25px_rgba(43,26,34,.45)] ${t.kind === "error" ? "bg-ink text-surface" : t.kind === "success" ? "bg-pink text-surface" : "bg-surface text-ink border border-ink/10"}`}>
              <div className="flex items-start gap-3">
                <span className="mt-1.5 flex h-2 w-2 shrink-0">
                  {t.kind === "pending" ? <span className="h-2 w-2 animate-ping rounded-full bg-pink" /> : <span className={`h-2 w-2 rounded-full ${t.kind === "error" ? "bg-pink" : t.kind === "success" ? "bg-surface" : "bg-deep"}`} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{t.title}</div>
                  {t.detail && <div className="mt-0.5 break-words font-mono text-[11px] opacity-75">{t.detail}</div>}
                  {t.hash && <a href={bscscanTx(t.hash)} target="_blank" rel="noreferrer" className="mt-1.5 inline-block font-mono text-[11px] underline underline-offset-2 opacity-90 hover:opacity-100">view on bscscan ↗</a>}
                </div>
                <button onClick={() => dismiss(t.id)} aria-label="dismiss notification" className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm opacity-60 hover:opacity-100">×</button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
