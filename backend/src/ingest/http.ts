export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Polite JSON fetch: UA header, retry on 429/5xx with backoff. */
export async function fetchJson<T>(url: string, init: RequestInit = {}, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": "cata-ingest/0.1", Accept: "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) return (await res.json()) as T;
    if (attempt < retries && (res.status === 429 || res.status >= 500)) {
      const ra = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`GET ${url} -> ${res.status}`);
  }
}

export interface Adapter {
  name: string;
  /** Yields pages of unified cards. */
  pages(opts: { maxPages: number; delayMs: number }): AsyncGenerator<import("../types.js").Card[]>;
}

export const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
