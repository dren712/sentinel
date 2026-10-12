<p align="center">
  <img src="./docs/assets/Sentinel_logo.png" alt="Sentinel Robo" width="300" />
</p>

<h1 align="center">Sentinel Finance — On-Chain Risk Controls & Emergency Containment</h1>

<p align="center">
  <strong>On-chain risk controls and emergency containment for autonomous financial strategies on Solana.</strong><br>
  <em>Sentinel gives developers a policy-bound vault workflow: validate supported state changes, quarantine after a confirmed supported risk breach, and constrain token transfers out of the strategy-controlled vault to an approved destination.</em>
</p>

<p align="center">
  <a href="https://sentinel-finance-production-4560.up.railway.app/"><img src="https://img.shields.io/badge/Live_App-Railway_Production-00C49F?logo=railway&logoColor=white" alt="Live App"></a>
  <a href="https://sentinel-finance-production-4560.up.railway.app/lab"><img src="https://img.shields.io/badge/Devnet_Lab-Faucets_&_Simulator-FF5C00" alt="Devnet Lab"></a>
  <a href="https://sentinel-finance-production-4560.up.railway.app/quarantine"><img src="https://img.shields.io/badge/Quarantine_Terminal-Live-E63946" alt="Quarantine Terminal"></a>
  <a href="https://explorer.solana.com/address/3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH?cluster=devnet"><img src="https://img.shields.io/badge/CWF_Program-3TVEhBHw...-9945FF?logo=solana&logoColor=white" alt="CWF Devnet Program"></a>
  <a href="https://pyth.network"><img src="https://img.shields.io/badge/Pyth_Oracle-PriceUpdateV2_Verified-E6DAFE?logo=pyth&logoColor=black" alt="Pyth Network"></a>
  <a href="./docs/POSITIONING.md"><img src="https://img.shields.io/badge/Positioning-Canonical_Spec-blue" alt="Positioning Spec"></a>
  <a href="./docs/cwf/SUBMISSION_CWF.md"><img src="https://img.shields.io/badge/CWF-Submission_Doc-00C49F" alt="CWF Submission"></a>
  <a href="./docs/cwf/STATE_MACHINE.md"><img src="https://img.shields.io/badge/State_Machine-Quarantine_&_Recovery-2563EB" alt="State Machine"></a>
</p>

<p align="center">
  <code>Active → PendingViolation → Quarantined → Active (recovered) / RecoveryExpired</code>
</p>

<p align="center">
  <a href="./docs/POSITIONING.md">Positioning Architecture</a> ·
  <a href="https://sentinel-finance-production-4560.up.railway.app/lab">Devnet Lab (Faucets &amp; Sandbox)</a> ·
  <a href="https://sentinel-finance-production-4560.up.railway.app/quarantine">Quarantine &amp; Containment Terminal</a> ·
  <a href="https://sentinel-finance-production-4560.up.railway.app/">Portfolio Dashboard</a> ·
  <a href="./docs/cwf/SUBMISSION_CWF.md">CWF Submission</a> ·
  <a href="./docs/cwf/STATE_MACHINE.md">State Machine</a> ·
  <a href="./docs/cwf/DISCLOSURE.md">Disclosure &amp; Provenance</a> ·
  <a href="https://explorer.solana.com/address/3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH?cluster=devnet">Solana Explorer (CWF)</a> ·
  <a href="./docs/TECHNICAL.md">Technical Docs</a>
</p>

---

## About Sentinel

**Sentinel is on-chain risk-control and emergency-containment infrastructure for autonomous financial strategies on Solana.**

While autonomous agents formulate trades and react to market signals, they operate in probabilistic space. Off-chain prompt engineering and heuristics cannot provide deterministic guarantees against invalid state transitions. Sentinel places an on-chain, policy-bound state transition boundary around strategy vaults:

- **Autonomous Intelligence:** The agent proposes portfolio allocations across volatile assets and stablecoins.
- **Deterministic Guards:** Supported operations are bounded by on-chain portfolio invariants (`max_single_asset_bps`, `min_stablecoin_bps`, `max_trade_value_usd`) verified against an authenticated Pyth oracle feed (`PriceUpdateV2`).
- **Hysteresis Quarantine:** If market shifts or invalid operations cause invariant breaches, permissionless watchers flag the vault into `Quarantined`, immediately halting strategy trading authority (`VaultNotActive`).
- **Emergency Containment & Vault-State Reactivation:** During the recovery window, callers invoke `recover()` to transfer excess volatile tokens from the strategy vault PDA directly to the owner's `safe_destination` via SPL `TransferChecked` CPI. When on-chain postconditions pass, the vault is returned to `Active`.

> **Current Implementation Boundary**:
> The current prototype does not execute DEX swaps or sell contained assets. A successful containment transfer reduces assets held inside the strategy-controlled vault, but does not by itself recover lost money or guarantee that the owner's total market exposure falls. Guarded trade settlement updates internal vault accounting; it does not route to an external DEX.

### Explicit Capability Boundary

| Capability | Status |
| :--- | :--- |
| Concentration cap / stablecoin floor / trade-size cap enforced **inside the SVM** | **Real** — `check_exposure_and_reserve`, verified by 30 Rust + 85 integration tests |
| Pyth oracle verification (owner, `Full` level, `feed_id`, ≤60s publish age, ≤200bps confidence, ≤64 slot lag) | **Real** |
| Two-stage quarantine with permissionless flagging and agent lockout | **Real** |
| Program-signed SPL containment transfer to `safe_destination` with exact balance-delta assertions | **Real** |
| Replay protection via recovery nonce | **Real** |
| DEX execution / swap routing | **Not implemented** |
| Selling or liquidating contained assets | **Not implemented** |
| On-chain SHA-256 evidence verification | **Not implemented** — hashes are agent-supplied and computed off-chain |
| Liquidity / price-impact admission checks | **Off-chain only**, against configured parameters |
| Meteora pool PDA derivation | **Real (deterministic)**; pool depth/impact values are configured constants |
| Solver bounty payout | **Informational only** — emitted as `0`, no on-chain disbursement |
| Autonomous watcher / solver daemons | **Implemented**, but **not started** by the Docker/Railway deployment; run via `pnpm watcher` / `pnpm solver` |

---

## The 30-Second Demo

The proof that matters is not a screenshot — it is a signed transaction on the authoritative program.

Sentinel's quarantine and containment state machine executed end-to-end on **Solana Devnet against the CWF program** (`3TVEhBHw...AgH`). These are real signatures, verifiable in one click:

| Step | Instruction | Devnet TX |
| :--- | :--- | :--- |
| 1 | `initialize_policy` — owner sets risk bounds on-chain | [`2FY3x93L…`](https://explorer.solana.com/tx/2FY3x93L3j8Uz1Xi5pMutSre8ekUJq12PVtG1udVptvzN4ejWpJUPeeBi779mCUi9Fn62vPikgDUaKcftawzfErQ?cluster=devnet) |
| 2 | `initialize_vault` — vault PDA bound to policy + agent | [`2oD6NEjx…`](https://explorer.solana.com/tx/2oD6NEjxX5GSjnVFbaaicfzQtm4zNgUCYDBtBVg5bnEUQyhUcQfPBQnRwZJAaZHZpPbbYG66bPj9HLeQCnHB9RA3?cluster=devnet) |
| 3 | `flag_violation` #1 — permissionless watcher records pending violation | [`5vSfX1eq…`](https://explorer.solana.com/tx/5vSfX1eqkgoEh6GBBAc9WPZi6YMkXkGoZQLV53hWj2ZnsRctC3vAoLx7QMswzFrTTnTsHrKiQXsbTt5VkrosSssf?cluster=devnet) |
| 4 | `flag_violation` #2 — after `confirm_slots`, vault → `Quarantined`, agent authority revoked | [`PDw3zefC…`](https://explorer.solana.com/tx/PDw3zefCFwawCf8K51vb1bCAGg3TQZ7nSah1ZRJg686BSJbYqZ8UV6okuy9cpvSpoPrFxrY5sSaJRHWhChJ6qpE?cluster=devnet) |
| 5 | `recover` — **any caller** moves excess tokens via program-signed SPL CPI, vault returns to `Active` | [`2zUD46Fq…`](https://explorer.solana.com/tx/2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob?cluster=devnet) |

While the vault is `Quarantined`, every trading instruction reverts with `VaultNotActive` (6025). The live [`/quarantine`](https://sentinel-finance-production-4560.up.railway.app/quarantine) terminal reads this state directly from chain.

**Guarded trade settlement (`execute_guarded_trade`) is ledger-only.** It enforces post-trade invariants against a verified Pyth price and mutates internal vault accounting — it does not route to an external DEX, and SPL tokens do not move on this path. The containment path (`recover`) is where real token custody moves. See [Capability Boundary](#explicit-capability-boundary).

---

## Real on Devnet vs. Demo / Simulation

To provide complete technical transparency for judges, code auditors, and reviewers:

| Dimension | Real On Solana Devnet (Authoritative) | Interactive Demo / Simulation Layer |
| :--- | :--- | :--- |
| **Anchor Program** | Dedicated CWF Solana Program ([`3TVEhBHw...`](https://explorer.solana.com/address/3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH?cluster=devnet)) enforcing pre-trade guards, quarantine state transitions, and real SPL custody containment (`recover`) | Client-side what-if projection simulator on Overview |
| **Account State** | On-chain `PolicyAccount`, `AgentAccount`, `PortfolioVault` PDAs. SPL custody lives in separate PDA-owned token accounts passed to the program — the vault state account itself holds no token balance | Simulated preview headroom calculations |
| **Policy Updates** | Signed by user's browser wallet (Phantom/Solflare) committing on Devnet RPC via Anchor | Local UI candidate state prior to on-chain signing |
| **Emergency Containment** | Program-signed SPL Token & Token-2022 CPI `transfer_checked_signed` moving excess tokens from vault PDA custody to `policy.safe_destination`. This is a **separate permissionless call made after quarantine**, not an automatic hook on breach | Informational solver bounty calculation in event |
| **Quarantine Lifecycle** | Real `initialize_policy` → `initialize_vault` → `flag_violation` ×2 → `recover` transactions on the CWF program ([`5vSfX1eq…`](https://explorer.solana.com/tx/5vSfX1eqkgoEh6GBBAc9WPZi6YMkXkGoZQLV53hWj2ZnsRctC3vAoLx7QMswzFrTTnTsHrKiQXsbTt5VkrosSssf?cluster=devnet) · [`PDw3zefC…`](https://explorer.solana.com/tx/PDw3zefCFwawCf8K51vb1bCAGg3TQZ7nSah1ZRJg686BSJbYqZ8UV6okuy9cpvSpoFrFxrY5sSaJRHWhChJ6qpE?cluster=devnet) · [`2zUD46Fq…`](https://explorer.solana.com/tx/2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob?cluster=devnet)) | Preflight client-side rejection preview |
| **Guarded Trade Settlement** | On-chain invariant enforcement in `execute_guarded_trade` against verified Pyth prices, verified by 26 slot-warped Bankrun tests + Rust unit tests | Target allocation slider projection curves |
| **Evidence Proofs** | `record_evidence` stores SHA-256 state commitments **supplied by the agent signer**. Hashes are computed off-chain in `@sentinel/domain` and are *agent-attested*, not derived or verified on-chain — the program does not contain a SHA-256 implementation | Two-tier evidence receipt inspection drawer |
| **Price Feeds** | Pyth Hermes v2 sub-second price streaming in `LIVE` mode (`https://hermes.pyth.network`), re-verified on-chain via `PriceUpdateV2` ownership, `Full` verification level, `feed_id`, ≤60s publish age, ≤200 bps confidence, and ≤64 slot posting lag | Injected 140s stale-quote demo scenario |
| **Sponsor Scenarios** | PreStocks 409A NAV normalization (server-side HTTP client). Meteora pool PDA derivation is deterministic but the liquidity/impact figures are configured constants, not live pool reads | Simulated shallow DBC pool impact (`1.7% > 1.0%`) & $30K OPENAIx breach |
| **LLM Provider** | OpenAI GPT-4o function-calling supported when `OPENAI_API_KEY` is configured | Deterministic `DemoProvider` running on the hosted deployment |
| **Persistence** | Railway Managed PostgreSQL read model (`agent_runs`, `decisions`, `executions`, `evidence_indices`) | In-memory read model fallback when running locally without a database |

---

## Three Failure Modes Sentinel Enforces

| Threat | Example Trigger | Sentinel Outcome |
| :--- | :--- | :--- |
| **1. Untrusted Agent** | A trade whose post-state breaches `max_single_asset_bps` / `min_stablecoin_bps` / `max_trade_value_usd` | Reverts on-chain inside the SVM — `ExposureExceeded` (6000), `StablecoinReserveBreached` (6001), or `TradeSizeExceeded` (6002). |
| **2. Untrusted Data** | Pyth quote older than 60s, wider than 200 bps confidence, posted more than 64 slots ago, or a replayed earlier print | Fail-closed — `StaleOracle` (6022), `ConfidenceTooWide` (6023), `FeedMismatch` (6021), `UnverifiedPrice` (6024). No synthetic-price fallback exists in `LIVE` mode. |
| **3. Untrusted Market** | Liquidity depth below the floor or price impact above the limit | Blocked pre-execution by the market-quality verifier (`ERR_LIQUIDITY_DEPTH_INSUFFICIENT`, `ERR_PRICE_IMPACT_EXCEEDED`) before any on-chain state is touched. |

> **Scope note on Failure Mode 3.** The liquidity and impact guards run **off-chain, in TypeScript, against configured venue parameters** — they are a pre-execution admission check, not an SVM-enforced invariant. Modes 1 and 2 are enforced inside the transaction.

---

## Architecture (`CURRENT DEVNET` vs. `TARGET ARCHITECTURE`)

```text
                        ┌─────────────────────────────┐
                        │     SENTINEL WEB (Docker)   │
                        │  Next.js 15 UI + BFF API    │
                        │  @sentinel/sdk & @domain    │
                        └──────┬───────────────┬──────┘
                                │               │
           SOLANA_RPC_URL       ▼               ▼       DATABASE_URL
    ┌───────────────────────────────┐       ┌───────────────────────────────┐
    │      SOLANA DEVNET (TRUTH)    │       │   POSTGRESQL (READ HISTORY)   │
    │  Program: 3TVEhBHw...AgH     │       │  1. agent_runs                │
    │  • PolicyAccount PDA          │       │  2. decisions                 │
    │  • AgentAccount PDA           │       │  3. executions                │
    │  • VaultAccount PDA           │       │  4. portfolio_snapshots       │
    │  • PromiseAccount PDA         │       │  5. evidence_index            │
    │  • EvidenceAccount PDA        │       └───────────────────────────────┘
    └───────────────────────────────┘
```

- **`CURRENT DEVNET` (Implemented & Live)**:
  - Browser wallet signs `PolicyAccount` PDA updates (`POST /api/policy/:wallet` prepares unsigned Anchor tx; server never signs user policy changes).
  - `PythLivePriceProvider` queries Pyth Hermes v2 (`https://hermes.pyth.network`); `PreStocksApiClient` normalizes Pre-IPO NAVs server-side; `MeteoraDBCMarketQualityVerifier` validates deterministic pool PDAs pre-trade.
  - Anchor `execute_guarded_trade` verifies postconditions on-chain and mutates `VaultAccount` + `PromiseAccount` state on Solana Devnet, followed by `record_evidence` (`EvidenceAccount` PDA).
  - Current Devnet settlement: Sentinel's PortfolioVault is an on-chain ledger that tracks balances and enforces invariants. Token settlement is simulated; tokens do not move between SPL accounts. No external DEX swap or SPL token transfer is claimed or performed.
- **`TARGET ARCHITECTURE` (Post-Hackathon Roadmap)**:
  - Direct on-chain Cross-Program Invocation (CPI) from Sentinel `execute_guarded_trade` into Meteora DBC / PreStocks secondary liquidity pools with post-CPI SPL token vault balance assertions.

---

## Built for Solana's Next Consensus Era

Sentinel is an application-layer enforcement system: the agent proposes, Sentinel evaluates the projected portfolio state, and the on-chain Solana program enforces the resulting constraints.

Solana's upcoming **Alpenglow** consensus upgrade targets sub-second (~150 ms) finality while leaving SVM transaction execution unchanged. Sentinel does not depend on Alpenglow today, but its policy-bound execution model is designed to benefit from Solana's continued improvements in confirmation and finality.

```text
Agent Intelligence ➔ Sentinel Policy Postconditions ➔ SVM Execution ➔ Solana Consensus / Finality ➔ PROVN Evidence Index
```

- **Today:** Sentinel runs on Solana Devnet with real on-chain policy enforcement (`execute_guarded_trade`), state transitions on `VaultAccount` PDAs, and PROVN cryptographic evidence.
- **Direction:** As Solana moves toward lower-latency finality, Sentinel's policy-bound execution model can support increasingly responsive autonomous workflows without requiring redesign of the core policy logic.

---

## What's Real on Devnet

| Artifact | On-Chain Address / Signature | Explorer |
| :--- | :--- | :--- |
| **Sentinel CWF Program (Authoritative)** | `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH` | [CWF Program](https://explorer.solana.com/address/3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH?cluster=devnet) |
| **Pre-CWF Baseline Program (superseded)** | `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK` — retired; it implements the earlier promise-based portfolio model and has **no** `flag_violation`, `recover`, or SPL custody | [Baseline Program](https://explorer.solana.com/address/3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK?cluster=devnet) |
| **Live Railway Deployment** | `sentinel-finance-production-4560.up.railway.app` | [Live Production App](https://sentinel-finance-production-4560.up.railway.app/) |
| **PolicyAccount PDA** (full lifecycle demo) | `7jzGugBwgFxFSMNoBbEPvCS4QAkVeFjAEuiqGojwGCGm` | [Policy PDA](https://explorer.solana.com/address/7jzGugBwgFxFSMNoBbEPvCS4QAkVeFjAEuiqGojwGCGm?cluster=devnet) |
| **VaultAccount PDA** (full lifecycle demo) | `DdaK1oEsBcCfsgyKoYbkhf8BkS927cRZDskvAvjJscrr` | [Vault PDA](https://explorer.solana.com/address/DdaK1oEsBcCfsgyKoYbkhf8BkS927cRZDskvAvjJscrr?cluster=devnet) |
| **Quarantine → containment flow owner** | `6H5nrFrvoWtAjUE5M8D5XXUU7W6JNzfPkGmytSyA9K2z` | [Owner](https://explorer.solana.com/address/6H5nrFrvoWtAjUE5M8D5XXUU7W6JNzfPkGmytSyA9K2z?cluster=devnet) |
| **`initialize_policy` TX** | `2FY3x93L3j8Uz1Xi5pMutSre8ekUJq12PVtG1udVptvzN4ejWpJUPeeBi779mCUi9Fn62vPikgDUaKcftawzfErQ` | [View TX](https://explorer.solana.com/tx/2FY3x93L3j8Uz1Xi5pMutSre8ekUJq12PVtG1udVptvzN4ejWpJUPeeBi779mCUi9Fn62vPikgDUaKcftawzfErQ?cluster=devnet) |
| **`initialize_vault` TX** | `2oD6NEjxX5GSjnVFbaaicfzQtm4zNgUCYDBtBVg5bnEUQyhUcQfPBQnRwZJAaZHZpPbbYG66bPj9HLeQCnHB9RA3` | [View TX](https://explorer.solana.com/tx/2oD6NEjxX5GSjnVFbaaicfzQtm4zNgUCYDBtBVg5bnEUQyhUcQfPBQnRwZJAaZHZpPbbYG66bPj9HLeQCnHB9RA3?cluster=devnet) |
| **`flag_violation` (pending) TX** | `5vSfX1eqkgoEh6GBBAc9WPZi6YMkXkGoZQLV53hWj2ZnsRctC3vAoLx7QMswzFrTTnTsHrKiQXsbTt5VkrosSssf` | [View TX](https://explorer.solana.com/tx/5vSfX1eqkgoEh6GBBAc9WPZi6YMkXkGoZQLV53hWj2ZnsRctC3vAoLx7QMswzFrTTnTsHrKiQXsbTt5VkrosSssf?cluster=devnet) |
| **`flag_violation` (→ `Quarantined`) TX** | `PDw3zefCFwawCf8K51vb1bCAGg3TQZ7nSah1ZRJg686BSJbYqZ8UV6okuy9cpvSpoFrFxrY5sSaJRHWhChJ6qpE` | [View TX](https://explorer.solana.com/tx/PDw3zefCFwawCf8K51vb1bCAGg3TQZ7nSah1ZRJg686BSJbYqZ8UV6okuy9cpvSpoFrFxrY5sSaJRHWhChJ6qpE?cluster=devnet) |
| **`recover` (SPL containment) TX** | `2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob` | [View TX](https://explorer.solana.com/tx/2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob?cluster=devnet) |
| **`owner_release` TX** | `2tQQYGDpnBqttytdnYQ9JoFsVZMAbi2bLvgyKzamYUgE7oYha7PP9Cf59uTiEYxQ73Mxg5rbZtwCELqYzurktEZd` | [View TX](https://explorer.solana.com/tx/2tQQYGDpnBqttytdnYQ9JoFsVZMAbi2bLvgyKzamYUgE7oYha7PP9Cf59uTiEYxQ73Mxg5rbZtwCELqYzurktEZd?cluster=devnet) |

> Every signature above was verified against `https://api.devnet.solana.com`: each invoked `3TVEhBHw...AgH` and committed successfully. The deployed program build predates the post-submission hardening described in [Program Version Boundary](#program-version-boundary).

---

## Sponsor Integrations

| Sponsor | Integration Summary | Deep Dive |
| :--- | :--- | :--- |
| **Pyth Network** | `PythLivePriceProvider` fetches live Hermes v2 prices/confidence/age (`NVDAx`/`NVDA`, `AAPLx`/`AAPL`, `SPYx`/`SPY`) and enforces fail-closed staleness (`≤ 60s`) & dual-feed peg deviation (`≤ 100 bps`) guards. | [docs/SPONSORS.md](./docs/SPONSORS.md#1-pyth-network-pythlivepriceprovider--dual-feed-tracking) |
| **PreStocks** | Server-side `PreStocksApiClient` normalizes certified Pre-IPO assets (`OPENAIx`, `SPACEXx`, `STRIPEx`, `ANTHROPICx`) into an isolated universe and enforces the `Pre-IPO ≤ 20%` portfolio exposure ceiling. | [docs/SPONSORS.md](./docs/SPONSORS.md#2-prestocks-prestocksapiclient--pre-ipo-exposure-ceiling) |
| **Meteora** | Derives canonical Meteora DBC pool PDAs (`4bHACh...`) as a market-admission check before execution — liquidity floor (`≥ $25,000`) and price impact (`≤ 200 bps`) against *configured venue parameters*. *(Off-chain pre-execution check, not an on-chain invariant and not a live pool read; no DBC swap CPI exists.)* | [docs/SPONSORS.md](./docs/SPONSORS.md#3-meteora-meteoradbcmarketqualityverifier--pool-pda-derivation) |

---

## Tech Stack & Quick Start

- **On-Chain**: Rust, Anchor (`0.30.1`), Solana Web3.js (`@solana/web3.js`).
- **Packages**: `@sentinel/domain` (policy/valuation/PROVN), `@sentinel/sdk` (agent loop, LLM tool dispatcher, adapters), `@sentinel/web` (Next.js 15.5.25 App Router, Tailwind CSS, PostgreSQL `pg` read model).
- **AI Integration**: OpenAI GPT-4o supported; hosted deployment currently runs `DemoProvider` deterministic fallback unless `OPENAI_API_KEY` is configured.
- **Docker Image**: Multi-arch (`linux/amd64` + `linux/arm64`) image published at [`darshan712/sentinel-finance:latest`](https://hub.docker.com/r/darshan712/sentinel-finance).
- **Live Railway Deployment**: [`https://sentinel-finance-production-4560.up.railway.app/`](https://sentinel-finance-production-4560.up.railway.app/) (Production Next.js 15.5.25 + Managed PostgreSQL 16 read model + Solana Devnet + Pyth Hermes dual feeds).

```bash
# 1. Install, build, and run locally
pnpm install && pnpm build
pnpm --filter @sentinel/web dev

# 2. Or run the canonical single-container Docker deployment (+ optional Postgres)
cp .env.example .env
docker compose up --build -d
curl http://localhost:3000/api/health
```

---

## Testing & Verification (`264 Automated Tests Passing`)

Every number below is the exact count reported by the command shown. All 264 pass.

| Suite | Tests | Command |
| :--- | ---: | :--- |
| SDK + domain | 149 | `pnpm test` |
| Bankrun recovery (slot-warped, real SPL custody) | 26 | `node --experimental-strip-types --test tests/bankrun-recovery.test.ts` |
| Bankrun quarantine (slot-warped) | 13 | `node --experimental-strip-types --test tests/bankrun-quarantine.test.ts` |
| Remediation / oracle fail-closed security | 26 | `node --experimental-strip-types --test tests/remediation-security.test.ts` |
| Anchor localnet integration | 20 | `node --experimental-strip-types --test tests/sentinel-localnet.test.ts` |
| Rust program unit tests | 30 | `cargo test --manifest-path programs/sentinel/Cargo.toml` |
| **Total** | **264** | |

```bash
# One command runs the 149 TypeScript tests (SDK 110 + domain 39)
pnpm test

# Rebuild the program binary before running the Bankrun suites — they load
# ./target/deploy/sentinel.so, not ./programs/sentinel/target/deploy/sentinel.so.
(cd programs/sentinel && cargo build-sbf) && cp programs/sentinel/target/deploy/sentinel.so target/deploy/sentinel.so

node --experimental-strip-types --test tests/bankrun-recovery.test.ts
node --experimental-strip-types --test tests/bankrun-quarantine.test.ts
node --experimental-strip-types --test tests/remediation-security.test.ts
node --experimental-strip-types --test tests/sentinel-localnet.test.ts   # requires a local validator
cargo test --manifest-path programs/sentinel/Cargo.toml
```

---

## Program Version Boundary

Stating this plainly so nobody has to guess:

- **Everything linked above was executed against the deployed devnet program `3TVEhBHw...AgH`.**
- **The source in `programs/sentinel/` has since been hardened further.** The deployed build predates three post-submission changes:
  1. **Oracle slot binding** — `parse_and_verify_pyth_price` now also requires `posted_slot` within `MAX_ORACLE_SLOT_LAG` (64 slots). Pyth price-update accounts are ephemeral, so publish-age alone let a caller choose *which* verified print the vault was judged against. Covered by `test_pyth_slot_lag_rejects_replayed_ephemeral_update`.
  2. **Recovery liveness** — the oversell guard now applies only while the vault is genuinely breaching its cap. Previously, if the asset rallied between quarantine and recovery, `post < pre` and `post >= max_single − 500bps` became mutually unsatisfiable and **no** `sell_units` could recover the vault.
  3. **Invariant coverage on `sync_vault`** — the ledger-sync path now re-checks concentration and reserve against the owner's `PolicyAccount` (a new required account on that instruction) instead of writing arbitrary positions unchecked.

All 264 tests pass against the current source. **The deployed binary has not been upgraded with these three changes** — the devnet signatures above demonstrate the quarantine and containment state machine, which is unchanged.

---

## Documentation Links

- [Positioning & Capability Specification (Canonical)](./docs/POSITIONING.md)
- [Developer Quickstart Guide](./docs/QUICKSTART.md)
- [CWF 48h Release Audit & Truth Matrix](./docs/CWF_48H_RELEASE_AUDIT.md)
- [Quarantine & Containment Terminal (Live)](https://sentinel-finance-production-4560.up.railway.app/quarantine)
- [Devnet Lab (Faucets & Testing Sandbox)](https://sentinel-finance-production-4560.up.railway.app/lab)
- [CWF Submission Document](./docs/cwf/SUBMISSION_CWF.md)
- [Quarantine State Machine Specification](./docs/cwf/STATE_MACHINE.md)
- [CWF Disclosure & Provenance Log](./docs/cwf/DISCLOSURE.md)
- [Live Production Deployment (Railway)](https://sentinel-finance-production-4560.up.railway.app/)
- [Technical Architecture & Anchor Lifecycle](./docs/TECHNICAL.md)
- [11-Vector Adversarial Security Matrix](./docs/SECURITY.md)
- [Full Devnet Verification Gate & Proofs](./docs/VERIFICATION.md)

