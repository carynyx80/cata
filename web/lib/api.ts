export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.catapacks.xyz").replace(/\/$/, "");
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://catapacks.xyz").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/** Fetch JSON from the cata backend with a timeout. Throws ApiError on HTTP errors. */
export async function api<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = 8000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(API_URL + path, { ...rest, signal: ctrl.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = (body as { error?: { code?: string; message?: string } }).error;
      throw new ApiError(res.status, e?.code ?? "http_error", e?.message ?? res.statusText);
    }
    return body as T;
  } finally {
    clearTimeout(t);
  }
}

export type ApiCard = {
  id: string; game: "pokemon" | "magic" | "yugioh" | "onepiece" | "sports"; name: string; set: string; number: string;
  rarity: string; imageUrl: string; prices: { raw?: number; psa9?: number; psa10?: number }; updatedAt: string; wants?: number;
};
export type ApiConfig = { chainId: number; cataToken: string | null; cataActive: boolean; feeBps: number; features: Record<string, boolean> };
export type ApiPool = { id: string; name: string; priceUsd: number; cardsLeft?: number; source?: string; active?: boolean };
export type ApiScan = { matches: { cardId: string; name: string; set: string; confidence: number; imageUrl: string }[]; estimatedGrade: number | null; priceUsd: number | null };
