# Cata — build spec

**Pull something real.** An on-chain card shop on BNB Chain (mainnet, chainId 56). Real graded cards (plus clearly labeled *digital* cards until real stock arrives) opened from packs, traded, borrowed against, bet on, and redeemed for the physical slab.

## Money rules (apply everywhere)
- Payment tokens at launch: **BNB (native)** and **USDT** (BSC USDT `0x55d398326f99059fF775485246999027B3197955`, 18 decimals).
- **$CATA** is NOT deployed yet. Contracts hold a `cataToken` address that starts as `address(0)`. Admin calls `activateCata(address)` **once**; it then locks forever (emit `CataActivated`). Every $CATA feature (pay with CATA, CATA betting pools, holder discounts, early access) checks `cataToken != address(0)`; the UI shows "$CATA coming soon" until then.
- **0.2% fee (20 bps) on every transaction** across all contracts. 100% of the fee goes to buyback: fees accumulate in `CataTreasury`, and `buyback()` swaps accumulated BNB/USDT for $CATA on PancakeSwap V2 router (`0x10ED43C718714eb63d5aA57B78B54704E256024E`) and sends it to the dead address `0x000000000000000000000000000000000000dEaD`. Before $CATA is activated, fees accumulate and wait.
- Company wallet / owner: `0x106342ec570e207afda9fda63125d7a9071127f2`. Revenue (pack margins, shipping) goes here. No private keys anywhere in the repo; deploy scripts read `PRIVATE_KEY` from env.
- Cata points: users earn points (pack opens, set completion). After activation, points convert to $CATA rewards funded from buybacks.

## Features (all 18)
1. Catalog of every card (Pokémon, Magic, Yu-Gi-Oh, One Piece; sports via user/sales data) with prices + history
2. Vault: graded slabs as ERC-721 (grade, grader, cert #, digital/physical flag)
3. Glass packs: pack pools are public; anyone can see every card left in a pool
4. Pack opening with Chainlink VRF v2.5; sell back instantly at 85% of value
5. Marketplace (list / buy / cancel)
6. Redeem: burn NFT → physical shipment request
7. AI card scan (photo → card id, estimated grade, price) — backend endpoint, pluggable model
8. Borrow USDT/BNB against vaulted cards
9. Live rips (streamed sealed-pack openings, spots bought on-chain)
10. Set completion rewards
11. Gift packs (send an unopened pack via claim link/code)
12. Cata Price Index (on-chain price feed for cards, updated by an oracle role)
13. Card payments — "coming soon" only
14. Want button on every catalog card
15. $CATA token integration (see money rules)
16. Pack battles (feature flag, off by default)
17. Fractional grails (feature flag, off by default)
18. Prediction markets: live rips, pack pools, card prices. Parimutuel pools. Bets in **BNB, USDT, and $CATA (after activation)**; each currency is a separate pool, winners paid in the same currency. Feature flag, off by default.
- Community-stocked packs: collectors deposit cards into pools and get paid when pulled.

## Brand
- Colors: cream `#F5EDE0` (ground), cream-light `#FBF6EE` (surface), hot pink `#E2487F`, deep pink `#C2336A`, soft pink `#F4C3D3`, plum ink `#2B1A22`, muted `#5E4652`.
- Fonts (Google): Dela Gothic One (display), Instrument Sans (body), Martian Mono (labels/numbers).
- Voice: lowercase, short. Main line: "pull something real." Bio: "rip it. flip it. bet on it. borrow on it. ship it."
- Look: Framer-style site — big type, smooth scroll/entrance animations (Framer Motion), generous whitespace, polished hovers. Built in code, not in Framer.
- Logo: graded slab with a pink "CATA 10" label and a big plum "C" in a soft-pink window, two small sparkles.

## Repo layout
- `contracts/` — Solidity 0.8.24, OpenZeppelin, tests
- `web/` — Next.js (App Router) + TypeScript + Tailwind + Framer Motion + wagmi/viem
- `backend/` — Node + TypeScript API (catalog, prices, scan, points, live rips)
