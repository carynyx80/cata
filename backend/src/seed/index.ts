import type { Repo } from "../db.js";
import { seedCards, seedHistory } from "./cards.js";
import { DEMO_HOLDINGS, DEMO_WALLET, SAMPLE_RIPS } from "./samples.js";

/** Load seed data into an empty database (idempotent: only seeds when catalog is empty). */
export function seedIfEmpty(repo: Repo): boolean {
  if (repo.countCards() > 0) return false;
  const cards = seedCards();
  repo.upsertCards(cards);
  for (const c of cards) repo.addHistory(c.id, seedHistory(c));
  for (const r of SAMPLE_RIPS) repo.saveRip(r);
  for (const h of DEMO_HOLDINGS) repo.addHolding(DEMO_WALLET, h.cardId, h.grade);
  repo.addPoints(DEMO_WALLET, 1250);
  return true;
}
