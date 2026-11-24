# cata backend

Node 22 + TypeScript API for Cata: catalog, prices, the Cata Price Index, glass-pack mirror, AI card scan, points/sets, live rips, and site config.
Hono on `@hono/node-server`, zod validation, `node:sqlite` storage (built into Node ≥ 22.5, no native modules), viem for chain reads and calldata, vitest.

```bash
npm install
cp .env.example .env      # everything is optional; the API runs offline on seed data
npm run dev               # tsx watch, http://localhost:8787
npm test                  # vitest
npm run build && npm start
npm run ingest            # pull from external card APIs into data/cata.db (npm run ingest -- scryfall,ygoprodeck)
npm run push-prices       # dry-run CataPriceIndex.setPrices batches; add `-- --send` to broadcast
```

On first boot an empty DB is seeded with about 60 sample cards across all five games, 26 weeks of generated price history, sample pools, one sample live rip, and a demo wallet `0x000000000000000000000000000000000000c47a` (1250 points, 3 holdings). The seed prices and history are sample data, not live quotes.

Node 22 prints an `ExperimentalWarning` for `node:sqlite`. It is harmless.

## Endpoints

Errors always look like `{ "error": { "code", "message", "details?" } }`. CORS is controlled by `CORS_ORIGIN` (comma-separated, `*` for any). The default allows `https://catapacks.xyz`, `https://www.catapacks.xyz`, `http://localhost:3000` and `http://localhost:3100`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `{ ok, cards, time }` |
| GET | `/metadata/contract` | Collection metadata (`name: "Cata Vault"`, `external_link`) for marketplaces |
| GET | `/metadata/:tokenId` | ERC-721 metadata for a CataVault slab (`.json` suffix accepted): name, description, image, attributes Grade/Grader/Cert/Physical (+ Game/Set/Number when the catalog id is known). Reads `CataVault.cardOf` on chain; 404 when `CATA_VAULT_ADDRESS` is unset or the token does not exist. Set the vault baseURI to `https://api.catapacks.xyz/metadata/`. |
| GET | `/config` | `{ chainId: 56, contracts, cataToken, cataActive, feeBps: 20, paymentTokens, features }`. `cataToken` is read from `CataConfig.cataToken()` when `CATA_CONFIG_ADDRESS` is set, otherwise from `CATA_TOKEN`. An empty value or the zero address means inactive. |
| GET | `/catalog?q=&game=&page=&limit=` | Multi-term search over name/set/number/id. `game` is one of `pokemon,magic,yugioh,onepiece,sports`. `limit` ≤ 100. Sorted by value. |
| GET | `/cards/:id` | Card plus `wants` and `catalogIds` (bytes32 per grade). The id looks like `pokemon:base1-4`. |
| GET | `/cards/:id/history?days=` | `{ points: [{ t, raw?, psa9?, psa10? }] }` |
| POST | `/cards/:id/want` | body `{ wallet }`. Idempotent per wallet: 201 when added, 200 when already wanted. |
| DELETE | `/cards/:id/want` | body `{ wallet }` |
| GET | `/cards/:id/wants?wallet=` | `{ wants, wanted? }` |
| GET | `/wants/top?limit=&game=` | Most-wanted cards, which tells the vault what to stock |
| POST | `/sports/submissions` | User-submitted sports card (`year, brand, number, player, variant?, grade?, priceUsd?, soldAt?`) |
| GET | `/index?top=50` | Cata Price Index: top-50 basket value and level (base 1000) over time, `change30dPct`, the basket, and per-game sub-indices (top 20 each) |
| GET | `/pools`, `/pools/:id` | Glass packs. Read from PackMachine when `PACK_MACHINE_ADDRESS` is set, otherwise sample pools (`source: "sample"`). Shows `cardsLeft`, `grailsLeft`, `expectedValueUsd`, `evRatio`, and every card left with its odds and value. |
| POST | `/scan` | multipart `image` (or `file`), or JSON `{ imageBase64, mediaType? }` (data URLs accepted), jpeg/png/webp/gif up to 5 MB. Returns `{ matches: [{ cardId, name, set, confidence, imageUrl }], estimatedGrade, priceUsd, detected, model }`. Returns **503** when `ANTHROPIC_API_KEY` is unset and 502 when the model call fails. |
| GET | `/points/:wallet` | `CataPoints.pointsOf` when configured, else local (`source`) |
| GET | `/sets`, `/sets/:id` | Set definitions with `catalogIds` per card |
| GET | `/sets/:id/progress/:wallet` | Ownership from the vault (`balanceOf` / `tokenOfOwnerByIndex` / `catalogIdOf`) when configured, else local holdings |
| GET | `/live-rips?status=`, `/live-rips/:id` | Spots, `streamUrl`, results, `spotsLeft` |
| POST / PATCH / DELETE | `/live-rips`, `/live-rips/:id` | Admin only: header `x-admin-token: $ADMIN_TOKEN` (or `Authorization: Bearer`). PATCH can set `status`, `spots[{index,wallet,txHash}]` and `results[{spot,cardId,grade?}]`. Returns 503 if `ADMIN_TOKEN` is unset. |

## On-chain ids and prices

- `catalogId = keccak256(utf8(cardId + ":" + grade))`, with grade one of `raw | psa9 | psa10` (`src/catalogId.ts`).
- Prices are USD scaled to 18 decimals.
- `src/jobs/pushPrices.ts` builds `setPrices(bytes32[],uint256[])` batches (100 per tx) with viem `encodeFunctionData`. It only sends with `--send` **and** `ORACLE_PRIVATE_KEY` + `RPC_URL` + `CATA_PRICE_INDEX_ADDRESS` all set. Otherwise it prints a dry run.
- ABIs in `src/abis/` are generated from `contracts/out` (forge build) by `npm run gen:abis`. Reads: `CataConfig.cataToken/feeBps`, `CataPoints.points(address)`, `PackMachine.poolCount/pools(id) -> Pool{name,priceUsd,active,reserved}/poolCards(id) -> tokenIds`, `CataVault.catalogIdOf(tokenId)` (multicall), `CataPriceIndex.priceUsd/setPrices`.
- CataVault is not ERC721Enumerable: wallet holdings are rebuilt from `Transfer` logs since `VAULT_DEPLOY_BLOCK` (chunks of `VAULT_LOG_CHUNK`, default 5000) and confirmed with `ownerOf`. Pools need both `PACK_MACHINE_ADDRESS` and `CATA_VAULT_ADDRESS`.

## Ingestion (`src/ingest/`)

| Adapter | Source | Notes |
|---|---|---|
| `pokemonTcg.ts` | api.pokemontcg.io v2 | TCGplayer market price (falls back to mid). Optional `POKEMONTCG_API_KEY`. 250 per page. |
| `scryfall.ts` | api.scryfall.com `/cards/search` | `SCRYFALL_QUERY` (default `usd>=5`). Waits at least 100 ms between pages. Uses the foil price when there is no normal price. Handles double-faced cards. |
| `ygoprodeck.ts` | db.ygoprodeck.com v7 | One card per printing (`set_code`) with set price, falling back to the TCGplayer price |
| `onepiece.ts` | optcgapi.com | Alt arts keyed by image id (`OP01-120_p1`) |
| `sports.ts` | user submissions + Cata sales | No external API. The latest sale per grade sets the price. |

The runner retries 429/5xx with backoff and honours `Retry-After`. Tune it with `INGEST_MAX_PAGES` (default 4) and `INGEST_DELAY_MS` (default 500). A failing source is logged and skipped. Each adapter is unit-tested against `tests/fixtures/*.json`.

## AI scan

`src/scan.ts` uses `@anthropic-ai/sdk` `messages.parse` with a zod structured-output schema. Default model `claude-opus-5-5` (override with `SCAN_MODEL`), `effort: "low"`, base64 image input. The model returns the game, name, set, number, condition notes, an estimated 1–10 grade, and whether the card is already slabbed. The result is fuzzy-matched against the catalog (token Dice on name and set, plus an exact collector-number bonus and a game penalty), then priced at the estimated grade (10 → PSA 10, 9 → PSA 9, otherwise raw).

## Env

See `.env.example`: `PORT`, `CORS_ORIGIN`, `DATA_DIR`, `ADMIN_TOKEN`, `ANTHROPIC_API_KEY`, `RPC_URL` (BSC `https://bsc-dataseed.binance.org`), `ORACLE_PRIVATE_KEY`, contract addresses (`CATA_CONFIG_ADDRESS`, `CATA_VAULT_ADDRESS`, `PACK_MACHINE_ADDRESS`, `CATA_PRICE_INDEX_ADDRESS`, `CATA_POINTS_ADDRESS`, …), `CATA_TOKEN`, and `FEATURE_PACK_BATTLES` / `FEATURE_FRACTIONAL` / `FEATURE_PREDICTIONS` (all off by default). No secrets are in the code.

## Deploy (Railway)

`Dockerfile` + `railway.json` (Dockerfile builder, healthcheck `/health`). Set the service root directory to `/backend`. The server listens on `$PORT` at `0.0.0.0` (`HOST` overrides). SQLite lives in `$DATA_DIR/cata.db` (default `./data`, `/data` in the image); mount a volume at `/data` to keep it across deploys, otherwise the DB is re-seeded on each deploy.
