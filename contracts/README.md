# cata contracts

Solidity 0.8.24 (optimizer 200 runs, via-IR, evm `cancun`), OpenZeppelin 5.1, Foundry.

## setup
```sh
# foundry (binary from GitHub releases; foundry.paradigm.xyz is blocked here)
curl -L https://github.com/foundry-rs/foundry/releases/download/stable/foundry_stable_linux_amd64.tar.gz | tar xz -C ~/.foundry/bin
# solc 0.8.24 static binary (binaries.soliditylang.org is blocked here) — foundry.toml points at this path
mkdir -p /root/.svm/0.8.24 && curl -L -o /root/.svm/0.8.24/solc-0.8.24 \
  https://github.com/ethereum/solidity/releases/download/v0.8.24/solc-static-linux && chmod +x /root/.svm/0.8.24/solc-0.8.24
npm install          # @openzeppelin/contracts + forge-std into node_modules (see remappings)
```
On a machine with normal network access you can delete the `solc = ...` line in `foundry.toml` and let forge fetch 0.8.24.

## build / test
```sh
forge build
forge test                         # everything
forge test --match-path 'test/core/*'
```

## deploy (BSC mainnet)
```sh
export PRIVATE_KEY=...             # never commit; read from env only
export VRF_COORDINATOR=0x...       # Chainlink VRF v2.5 coordinator on BSC
export VRF_KEY_HASH=0x...
export VRF_SUB_ID=...
export BNB_USD_FEED=0x...          # Chainlink BNB/USD aggregator
# optional: OWNER (default company wallet), ORACLE, OPERATOR, USDT, PANCAKE_ROUTER, VAULT_BASE_URI
forge script script/Deploy.s.sol --rpc-url https://bsc-dataseed.bnbchain.org --broadcast
```
The script deploys as the deployer, wires roles, then transfers `CataConfig` ownership to the company wallet
`0x106342ec570e207afda9fda63125d7a9071127f2`. Afterwards: add `PackMachine` as a consumer on the VRF subscription,
fund the sell-back reserve (`fundSellbackReserve`, USDT), create pools, mint/stock slabs.

## layout
- `src/interfaces/` — `ICataConfig`, `ICataVault` (+ `Card` struct), `ICataPriceIndex` (shared with `src/markets/*`)
- `src/lib/` — `Features` (flag ids), `CataPayments` (BNB/USDT/CATA pull/push, 20 bps fee → treasury, pause/feature gate)
- `src/core/`
  - `CataConfig` — owner, treasury, company wallet, USDT, fee (20 bps, max 100), pause, feature flags
    (PREDICTIONS/BATTLES/FRACTIONAL off by default), oracle/operator roles, `activateCata` once-only lock.
  - `CataTreasury` — fees accrue here; `buyback(token, amountIn, minOut)` (owner/keeper, only once $CATA is active)
    swaps BNB or USDT (USDT→WBNB→CATA) on Pancake V2 and sends to `0x…dEaD`; `burnCata()` burns CATA fees directly.
    `setRewardsRoute(vault, bps)` can route up to 50% of bought CATA to `CataPoints` for points conversion —
    **default 0 = 100% burn, per spec**.
  - `CataVault` — ERC-721 slabs; operators mint; `physical=false` = digital card; `burnForRedeem` only for physical.
  - `CataPriceIndex` — oracle-pushed USD prices (18 dec); history via `PriceUpdated` events.
  - `PackMachine` — glass pools (`poolCards(poolId)` public), price in USD paid in USDT 1:1 or BNB via Chainlink feed
    (excess BNB refunded). Buying a pack = a "credit" that reserves one card; opening requests VRF v2.5
    (`nativePayment=false`); `rawFulfillRandomWords` swap-and-pops a random card to the recipient. Community stockers
    (`depositToPool(poolId, tokenId, askUsd)`, ask ≤ pool price) get `net * ask / price` minus fee; the rest is company
    margin. Payouts accrue in `owed` and are claimed with `withdraw(token)` (callback can't be blocked);
    `flushFees(token)` sends accrued fees to the treasury. `sellBack(tokenId)` within `sellbackWindow` (default 1h)
    pays 85% of index price in USDT from the owner-funded reserve (approve the NFT first); the card goes to the
    company wallet. Each pack awards `pointsPerOpen` (default 10) points.
  - `GiftPacks` — pay now, PackMachine credit held by the contract. The claim link carries a throwaway private key;
    only its address is stored. `claim(giftId, recipient, sig)` requires a signature over (contract, chainId, giftId,
    recipient), so a claim can't be front-run to another address. `reclaim` returns an unclaimed credit to the gifter.
  - `CataPoints` — operator `award`; after activation `convert(points)` pays `cataPerPoint` CATA (fee taken) from
    its CATA balance.
  - `SetRewards` — owner defines sets of catalogIds; `claimSet(setId, tokenIds)` once per account, each token
    counts once per set.
- `src/vendor/VRFV2Plus.sol` — minimal vendored Chainlink VRF v2.5 client/coordinator, AggregatorV3, Pancake router ABIs.
- `src/mocks/Mocks.sol` — MockERC20, MockVRFCoordinator, MockAggregator, MockRouter (tests only).

## notes
- Pack prices: only BNB and USDT for packs (no CATA→USD price source yet). Market accepts CATA once activated.
- USDT on BSC has 18 decimals; contracts assume that.
