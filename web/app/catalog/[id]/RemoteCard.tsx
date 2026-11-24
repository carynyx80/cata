"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Page } from "@/components/ui";
import { api, type ApiCard } from "@/lib/api";
import { fromApi } from "@/lib/data";
import { CardDetail } from "./CardDetail";

/** Live card from GET /cards/:id + /cards/:id/history (12 monthly points of the headline grade). */
export function RemoteCard({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["card", id], retry: 1,
    queryFn: async () => {
      const enc = encodeURIComponent(id);
      const [card, hist] = await Promise.all([
        api<ApiCard>(`/cards/${enc}`),
        api<{ points: { t: string; raw?: number; psa9?: number; psa10?: number }[] }>(`/cards/${enc}/history?days=365`).catch(() => ({ points: [] })),
      ]);
      const key = card.prices.psa10 ? "psa10" : card.prices.psa9 ? "psa9" : "raw";
      const pts = hist.points.map((p) => p[key]).filter((v): v is number => typeof v === "number");
      const series = pts.length >= 2 ? Array.from({ length: 12 }, (_, i) => Math.round(pts[Math.round((i * (pts.length - 1)) / 11)])) : [];
      return fromApi(card, series);
    },
  });
  if (q.data) return <CardDetail c={q.data} />;
  return (
    <Page>
      <Link href="/catalog" className="font-mono text-xs text-muted hover:text-pink">← catalog</Link>
      <div className="mt-10 rounded-[32px] bg-surface p-10 text-center text-muted">
        {q.isError ? "we couldn't find that card. try the catalog search." : "loading card…"}
      </div>
    </Page>
  );
}
