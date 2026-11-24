import { env } from "../env.js";
import { Repo } from "../db.js";
import type { Adapter } from "./http.js";
import { pokemonTcg } from "./pokemonTcg.js";
import { scryfall } from "./scryfall.js";
import { ygoprodeck } from "./ygoprodeck.js";
import { onepiece } from "./onepiece.js";

const ADAPTERS: Record<string, Adapter> = { pokemontcg: pokemonTcg, scryfall, ygoprodeck, optcgapi: onepiece };

/**
 * npm run ingest [-- adapter1,adapter2] — env INGEST_MAX_PAGES (default 4), INGEST_DELAY_MS (default 500).
 * Each adapter is tried independently; unreachable sources are reported and skipped.
 */
async function main() {
  const only = process.argv[2]?.split(",");
  const maxPages = Number(process.env.INGEST_MAX_PAGES ?? 4);
  const delayMs = Number(process.env.INGEST_DELAY_MS ?? 500);
  const repo = Repo.open(env().dataDir);
  for (const [name, a] of Object.entries(ADAPTERS)) {
    if (only && !only.includes(name)) continue;
    let n = 0;
    try {
      for await (const page of a.pages({ maxPages, delayMs })) {
        n += repo.upsertCards(page);
        console.log(`[${name}] +${page.length} (total ${n})`);
      }
      console.log(`[${name}] done: ${n} cards`);
    } catch (e) {
      console.warn(`[${name}] failed after ${n} cards: ${(e as Error).message}`);
    }
  }
  console.log(`catalog size: ${repo.countCards()}`);
}

main();
