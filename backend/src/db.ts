import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Card, Game, PricePoint } from "./types.js";

export interface LiveRip {
  id: string;
  title: string;
  product: string;
  game: Game;
  streamUrl: string;
  startsAt: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  totalSpots: number;
  spotPriceUsd: number;
  spots: { index: number; wallet: string | null; txHash?: string | null }[];
  results: { spot: number; cardId: string; grade?: string; note?: string }[];
  onchainId?: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = Record<string, unknown>;

function rowToCard(r: Row): Card {
  const prices: Card["prices"] = {};
  if (r.raw != null) prices.raw = Number(r.raw);
  if (r.psa9 != null) prices.psa9 = Number(r.psa9);
  if (r.psa10 != null) prices.psa10 = Number(r.psa10);
  return {
    id: String(r.id),
    game: r.game as Game,
    name: String(r.name),
    set: String(r.set_name),
    number: String(r.number),
    rarity: String(r.rarity),
    imageUrl: String(r.image_url),
    prices,
    updatedAt: String(r.updated_at),
  };
}

/** SQLite-backed repository (node:sqlite, no native deps). Use ":memory:" for tests. */
export class Repo {
  readonly db: DatabaseSync;

  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY, game TEXT NOT NULL, name TEXT NOT NULL, set_name TEXT NOT NULL,
        number TEXT NOT NULL, rarity TEXT NOT NULL, image_url TEXT NOT NULL,
        raw REAL, psa9 REAL, psa10 REAL, updated_at TEXT NOT NULL,
        search TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cards_game ON cards(game);
      CREATE TABLE IF NOT EXISTS price_history (
        card_id TEXT NOT NULL, t TEXT NOT NULL, raw REAL, psa9 REAL, psa10 REAL,
        PRIMARY KEY (card_id, t)
      );
      CREATE TABLE IF NOT EXISTS wants (
        card_id TEXT NOT NULL, wallet TEXT NOT NULL, created_at TEXT NOT NULL,
        PRIMARY KEY (card_id, wallet)
      );
      CREATE TABLE IF NOT EXISTS points (wallet TEXT PRIMARY KEY, points INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS holdings (wallet TEXT NOT NULL, card_id TEXT NOT NULL, grade TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS live_rips (id TEXT PRIMARY KEY, data TEXT NOT NULL, starts_at TEXT NOT NULL);
    `);
  }

  static open(dataDir: string): Repo {
    mkdirSync(dataDir, { recursive: true });
    return new Repo(join(dataDir, "cata.db"));
  }

  // ---- cards ----
  upsertCards(cards: Card[]): number {
    const stmt = this.db.prepare(`
      INSERT INTO cards (id, game, name, set_name, number, rarity, image_url, raw, psa9, psa10, updated_at, search)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET game=excluded.game, name=excluded.name, set_name=excluded.set_name,
        number=excluded.number, rarity=excluded.rarity, image_url=excluded.image_url,
        raw=COALESCE(excluded.raw, cards.raw), psa9=COALESCE(excluded.psa9, cards.psa9),
        psa10=COALESCE(excluded.psa10, cards.psa10), updated_at=excluded.updated_at, search=excluded.search`);
    const hist = this.db.prepare(`INSERT OR REPLACE INTO price_history (card_id, t, raw, psa9, psa10) VALUES (?,?,?,?,?)`);
    this.db.exec("BEGIN");
    try {
      for (const c of cards) {
        const search = `${c.name} ${c.set} ${c.number} ${c.id} ${c.rarity}`.toLowerCase();
        stmt.run(c.id, c.game, c.name, c.set, c.number, c.rarity, c.imageUrl,
          c.prices.raw ?? null, c.prices.psa9 ?? null, c.prices.psa10 ?? null, c.updatedAt, search);
        if (c.prices.raw != null || c.prices.psa9 != null || c.prices.psa10 != null) {
          hist.run(c.id, c.updatedAt.slice(0, 10), c.prices.raw ?? null, c.prices.psa9 ?? null, c.prices.psa10 ?? null);
        }
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return cards.length;
  }

  countCards(): number {
    return Number((this.db.prepare("SELECT COUNT(*) n FROM cards").get() as Row).n);
  }

  getCard(id: string): Card | null {
    const r = this.db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as Row | undefined;
    return r ? rowToCard(r) : null;
  }

  getCards(ids: string[]): Map<string, Card> {
    const out = new Map<string, Card>();
    for (const id of ids) {
      const c = this.getCard(id);
      if (c) out.set(id, c);
    }
    return out;
  }

  allCards(game?: Game): Card[] {
    const rows = game
      ? this.db.prepare("SELECT * FROM cards WHERE game = ?").all(game)
      : this.db.prepare("SELECT * FROM cards").all();
    return (rows as Row[]).map(rowToCard);
  }

  search(opts: { q?: string; game?: Game; page: number; limit: number }): { items: Card[]; total: number } {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (opts.game) { where.push("game = ?"); args.push(opts.game); }
    for (const term of (opts.q ?? "").toLowerCase().split(/\s+/).filter(Boolean)) {
      where.push("search LIKE ? ESCAPE '\\'");
      args.push(`%${term.replace(/[\\%_]/g, (m) => "\\" + m)}%`);
    }
    const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const total = Number((this.db.prepare(`SELECT COUNT(*) n FROM cards ${w}`).get(...args) as Row).n);
    const rows = this.db
      .prepare(`SELECT * FROM cards ${w} ORDER BY COALESCE(psa10, psa9, raw, 0) DESC, id LIMIT ? OFFSET ?`)
      .all(...args, opts.limit, (opts.page - 1) * opts.limit) as Row[];
    return { items: rows.map(rowToCard), total };
  }

  // ---- history ----
  addHistory(cardId: string, points: PricePoint[]) {
    const s = this.db.prepare(`INSERT OR REPLACE INTO price_history (card_id, t, raw, psa9, psa10) VALUES (?,?,?,?,?)`);
    this.db.exec("BEGIN");
    for (const p of points) s.run(cardId, p.t, p.raw ?? null, p.psa9 ?? null, p.psa10 ?? null);
    this.db.exec("COMMIT");
  }

  history(cardId: string, since?: string): PricePoint[] {
    const rows = this.db
      .prepare("SELECT t, raw, psa9, psa10 FROM price_history WHERE card_id = ? AND t >= ? ORDER BY t")
      .all(cardId, since ?? "0000") as Row[];
    return rows.map((r) => {
      const p: PricePoint = { t: String(r.t) };
      if (r.raw != null) p.raw = Number(r.raw);
      if (r.psa9 != null) p.psa9 = Number(r.psa9);
      if (r.psa10 != null) p.psa10 = Number(r.psa10);
      return p;
    });
  }

  historyDates(): string[] {
    return (this.db.prepare("SELECT DISTINCT t FROM price_history ORDER BY t").all() as Row[]).map((r) => String(r.t));
  }

  // ---- wants ----
  addWant(cardId: string, wallet: string): boolean {
    const r = this.db
      .prepare("INSERT OR IGNORE INTO wants (card_id, wallet, created_at) VALUES (?,?,?)")
      .run(cardId, wallet.toLowerCase(), new Date().toISOString());
    return Number(r.changes) > 0;
  }
  removeWant(cardId: string, wallet: string): boolean {
    return Number(this.db.prepare("DELETE FROM wants WHERE card_id = ? AND wallet = ?").run(cardId, wallet.toLowerCase()).changes) > 0;
  }
  wantCount(cardId: string): number {
    return Number((this.db.prepare("SELECT COUNT(*) n FROM wants WHERE card_id = ?").get(cardId) as Row).n);
  }
  hasWant(cardId: string, wallet: string): boolean {
    return !!this.db.prepare("SELECT 1 FROM wants WHERE card_id = ? AND wallet = ?").get(cardId, wallet.toLowerCase());
  }
  topWants(limit: number, game?: Game): { cardId: string; wants: number }[] {
    const rows = (game
      ? this.db.prepare(`SELECT w.card_id, COUNT(*) n FROM wants w JOIN cards c ON c.id = w.card_id WHERE c.game = ? GROUP BY w.card_id ORDER BY n DESC, w.card_id LIMIT ?`).all(game, limit)
      : this.db.prepare(`SELECT card_id, COUNT(*) n FROM wants GROUP BY card_id ORDER BY n DESC, card_id LIMIT ?`).all(limit)) as Row[];
    return rows.map((r) => ({ cardId: String(r.card_id), wants: Number(r.n) }));
  }

  // ---- points (local fallback) ----
  getPoints(wallet: string): number {
    const r = this.db.prepare("SELECT points FROM points WHERE wallet = ?").get(wallet.toLowerCase()) as Row | undefined;
    return r ? Number(r.points) : 0;
  }
  addPoints(wallet: string, n: number) {
    this.db.prepare("INSERT INTO points (wallet, points) VALUES (?, ?) ON CONFLICT(wallet) DO UPDATE SET points = points + excluded.points")
      .run(wallet.toLowerCase(), n);
  }

  // ---- holdings (local fallback when vault is not configured) ----
  addHolding(wallet: string, cardId: string, grade: string) {
    this.db.prepare("INSERT INTO holdings (wallet, card_id, grade) VALUES (?,?,?)").run(wallet.toLowerCase(), cardId, grade);
  }
  holdings(wallet: string): { cardId: string; grade: string }[] {
    return (this.db.prepare("SELECT card_id, grade FROM holdings WHERE wallet = ?").all(wallet.toLowerCase()) as Row[])
      .map((r) => ({ cardId: String(r.card_id), grade: String(r.grade) }));
  }

  // ---- live rips ----
  listRips(): LiveRip[] {
    return (this.db.prepare("SELECT data FROM live_rips ORDER BY starts_at DESC").all() as Row[]).map((r) => JSON.parse(String(r.data)));
  }
  getRip(id: string): LiveRip | null {
    const r = this.db.prepare("SELECT data FROM live_rips WHERE id = ?").get(id) as Row | undefined;
    return r ? JSON.parse(String(r.data)) : null;
  }
  saveRip(rip: LiveRip) {
    this.db.prepare("INSERT OR REPLACE INTO live_rips (id, data, starts_at) VALUES (?,?,?)").run(rip.id, JSON.stringify(rip), rip.startsAt);
  }
  deleteRip(id: string): boolean {
    return Number(this.db.prepare("DELETE FROM live_rips WHERE id = ?").run(id).changes) > 0;
  }
}
