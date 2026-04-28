# BunnyBet 🐰 — USDM Prediction Markets on MegaETH

Binary Yes/No prediction markets denominated in **USDM stablecoin**.  
Built on **MegaETH Mainnet** (Chain ID: 4326) with sub-second finality.

---

## Architecture

```
PredictionMarketFactory          ← single entry point, deploys markets
   ├── USDM address (immutable)
   ├── protocolFeeRecipient
   └── deploys N × PredictionMarket
           ├── yesPool (USDM)
           ├── noPool  (USDM)
           └── fee accrual (protocol 1% + creator 1%)
```

### Why USDM?
- Traders never worry about ETH price swings — all positions, payouts, and fees in stable USD.
- Creators earn fees in USDM — predictable income.
- Protocol collects fees in USDM — clean treasury management.

### Buying Flow (ERC-20)
1. User calls `usdm.approve(marketAddress, amount)` → wallet signs once
2. User calls `market.buyYes(amount)` or `market.buyNo(amount)`
3. Contract pulls USDM via `transferFrom`, splits fees, adds net to pool
4. Frontend handles the two-step automatically via `BuySharesPanel`

### Fee Split (2% total on every trade)
```
User sends 100 USDM
  ├── 1 USDM  → protocolFeesAccrued  (withdrawn by protocol wallet)
  ├── 1 USDM  → creatorFeesAccrued   (withdrawn by market creator)
  └── 98 USDM → YES or NO pool
```

### Payout Formula
```
payout = (userShares / winningPool) × totalPool
```
Where `userShares = net USDM contributed` (after fees).

---

## Project Structure

```
bunnybet/
├── contracts/                   ← Foundry project
│   ├── src/
│   │   ├── PredictionMarket.sol       ← per-market instance
│   │   ├── PredictionMarketFactory.sol← factory + registry
│   │   └── mocks/MockUSDM.sol         ← test-only ERC-20
│   ├── test/
│   │   └── PredictionMarket.t.sol     ← 20+ tests + fuzz
│   ├── script/
│   │   ├── Deploy.s.sol               ← mainnet deploy script
│   │   └── export-abi.sh              ← copy ABIs to frontend
│   ├── foundry.toml
│   ├── remappings.txt
│   └── .env.example
│
└── frontend/                    ← Next.js 15 app
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx             ← Wagmi + RainbowKit providers
    │   │   ├── globals.css            ← dark neon MegaETH theme
    │   │   ├── page.tsx               ← homepage (trending markets)
    │   │   ├── markets/[address]/     ← market detail + trade panel
    │   │   ├── create/                ← create market form
    │   │   └── portfolio/             ← user positions + claim
    │   ├── components/
    │   │   ├── layout/Navbar.tsx
    │   │   └── markets/
    │   │       ├── MarketCard.tsx     ← future.news-style card
    │   │       ├── ProbabilityBar.tsx ← thick animated YES/NO bar
    │   │       ├── BuySharesPanel.tsx ← Approve → Buy two-step
    │   │       └── CategoryFilter.tsx
    │   ├── hooks/
    │   │   ├── useMarkets.ts          ← factory read + multicall + events
    │   │   ├── useMarket.ts           ← single market + user position
    │   │   └── useUSDM.ts             ← balance + allowance + approve
    │   └── lib/
    │       ├── wagmi.ts               ← MegaETH chain definition
    │       ├── contracts.ts           ← addresses + ABIs
    │       ├── utils.ts               ← fmtUSDM, estimatePayout, etc.
    │       └── abis/                  ← Factory, Market, ERC20 ABIs
    └── .env.local.example
```

---

## Step-by-Step Setup Guide

### Prerequisites

| Tool      | Version   | Install |
|-----------|-----------|---------|
| Foundry   | latest    | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Node.js   | ≥ 20      | https://nodejs.org |
| jq        | any       | `brew install jq` |

---

### Step 1 — Deploy Contracts

```bash
cd bunnybet/contracts

# 1a. Install OpenZeppelin
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# 1b. Copy + fill environment
cp .env.example .env
```

Edit `.env`:
```
PRIVATE_KEY=your_deployer_wallet_private_key_no_0x
USDM_ADDRESS=0xYourUSDMTokenAddressOnMegaETH     ← REQUIRED
PROTOCOL_FEE_RECIPIENT=                           ← leave blank = deployer
MEGAETH_RPC_URL=https://mainnet.megaeth.com/rpc
```

```bash
# 1c. Build
forge build

# 1d. Run tests (uses MockUSDM — no real tokens needed)
forge test -vvvv

# 1e. Dry run (no real tx)
source .env
forge script script/Deploy.s.sol --rpc-url $MEGAETH_RPC_URL -vvvv

# 1f. Live deploy + verify on Blockscout
forge script script/Deploy.s.sol \
  --rpc-url $MEGAETH_RPC_URL \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://megaeth.blockscout.com/api \
  -vvvv

# Alternative: verify on mega.etherscan.io
forge script script/Deploy.s.sol \
  --rpc-url $MEGAETH_RPC_URL \
  --broadcast \
  --verify \
  --verifier-url https://mega.etherscan.io/api \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv
```

After deploy, note the **Factory address** from the output.

```bash
# 1g. Export ABIs to frontend
bash script/export-abi.sh
```

---

### Step 2 — Configure Frontend

```bash
cd ../frontend

cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_FACTORY_ADDRESS=0x...  ← from Step 1 output
NEXT_PUBLIC_USDM_ADDRESS=0x...     ← same USDM address as contracts
NEXT_PUBLIC_RPC_URL=https://mainnet.megaeth.com/rpc
NEXT_PUBLIC_WS_URL=wss://mainnet.megaeth.com/ws
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...  ← from cloud.walletconnect.com
```

---

### Step 3 — Run Frontend

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

### Step 4 — Deploy to Production

```bash
npm run build   # verify no type errors

# Option A: Vercel (recommended)
npx vercel --prod
# Add env vars in Vercel dashboard → Settings → Environment Variables

# Option B: Self-hosted
npm run build && npm start
```

---

## How Users Interact

### Buying shares (two-step ERC-20 flow)
1. User picks YES or NO and enters USDM amount
2. **Step 1** button: `Approve USDM` — signs an ERC-20 approval (one-time per market)
3. **Step 2** button: `Buy YES/NO` — transfers USDM, gets shares
4. Probability bar updates in real-time via MegaETH events

### Resolving a market
- Market creator: calls `resolve(true/false)` **after** the end date
- Factory owner: can force-resolve anytime (emergency)
- Resolution UI available directly on the market detail page (if you're the creator)

### Claiming winnings
- After resolution, winners see a "Claim Winnings" button in the trade panel
- Calls `redeem()` → USDM sent directly to wallet

### Claiming fees
- Creators: `withdrawCreatorFees()` on any market they created
- Protocol: `withdrawProtocolFees()` on any market

---

## MegaETH Chain Config (for MetaMask)

| Field          | Value                            |
|----------------|----------------------------------|
| Network Name   | MegaETH Mainnet                  |
| RPC URL        | https://mainnet.megaeth.com/rpc  |
| Chain ID       | 4326                             |
| Currency Symbol| ETH (gas only)                   |
| Block Explorer | https://megaeth.blockscout.com   |

> RainbowKit will auto-prompt users to add/switch chains.

---

## Real-time Updates

MegaETH produces blocks every ~10ms. BunnyBet handles this with:

1. **`useWatchContractEvent`** — fires `queryClient.invalidateQueries` instantly on `SharesBought` / `MarketResolved` events
2. **Polling fallback** — `refetchInterval: 2000ms` via React Query
3. **Multicall batching** — all market reads bundled into single RPC call

---

## Contract Addresses (fill after deploy)

| Contract                 | Address |
|--------------------------|---------|
| PredictionMarketFactory  | `TBD`   |
| USDM Token               | `TBD`   |
| Protocol Fee Recipient   | `TBD`   |

---

## Security

- `ReentrancyGuard` on all state-changing functions
- `SafeERC20` prevents silent transfer failures
- No `transfer()` — only `safeTransfer()`
- Checks-Effects-Interactions pattern throughout
- `hasRedeemed` / `hasClaimedRefund` mappings prevent double-claims
- Factory owner can cancel markets if needed
- Minimum bet: 1 USDM (prevents dust attacks)
