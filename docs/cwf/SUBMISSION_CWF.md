# Sentinel Finance — Crypto's World Fair (CWF) Submission

## One-Line Pitch
On-chain risk controls and emergency containment for autonomous financial strategies on Solana.

## 50-Word Pitch
Sentinel gives developers a policy-bound vault workflow: validate supported state changes, quarantine after a confirmed supported risk breach, and constrain token transfers out of the strategy-controlled vault to an approved destination. The current prototype enforces on-chain invariants and SPL token containment without executing DEX swaps.

---

## How It Works (4 Core Steps)

1. **Guarded State Transitions with Policy Invariants**:
   The owner defines portfolio risk bounds (`max_single_asset_bps`, `min_stablecoin_bps`, `max_trade_value_usd`) on-chain. The autonomous agent proposes trades that must satisfy pre- and post-state checks verified against an authenticated Pyth price feed. If a proposed state transition violates policy, it is rejected deterministically. In the current prototype, compliant orders update internal on-chain ledger accounting rather than executing external DEX trades.
   - *Source*: [`programs/sentinel/src/lib.rs`](../../programs/sentinel/src/lib.rs) (`execute_guarded_trade`, `check_exposure_and_reserve`)

2. **Permissionless Violation Flagging & Hysteresis Quarantine**:
   If external price moves or ledger updates cause vault holdings to violate policy invariants, any watcher or solver can call `flag_violation`. The first flag records a pending violation slot; after a configurable hysteresis window (`confirm_slots`), a second flag transitions the vault into `Quarantined`. In this state, the agent's trading authority is immediately locked out (`VaultNotActive`).
   - *Source*: [`programs/sentinel/src/lib.rs`](../../programs/sentinel/src/lib.rs) (`flag_violation`), [`packages/sdk/src/adapters/execution-adapter.ts`](../../packages/sdk/src/adapters/execution-adapter.ts) (`flagViolation`)

3. **Emergency Token Containment to Safe Destination**:
   During the open recovery window (`recovery_window_slots`), any external caller can call `recover()`. The contract executes a program-signed SPL Token / Token-2022 CPI `transfer_checked` moving excess volatile tokens directly from vault PDA custody to the owner's pre-approved `safe_destination`. On-chain checks enforce strict risk improvement and oversell guards, reducing vault-level exposure to compliant bounds. (Tokens are transferred, not sold; no DEX swap or cash proceeds occur).
   - *Source*: [`programs/sentinel/src/lib.rs`](../../programs/sentinel/src/lib.rs) (`recover`, `check_strict_improvement`, `check_oversell_guard`)

4. **Replay Protection & Autonomous Resumption**:
   Upon verified postcondition satisfaction, the vault status atomically reverts to `Active`, the recovery nonce increments (protecting against replay and stale states), and audit fields (`last_recovery_slot`, `last_recovery_solver`) are recorded. Once the vault is active again, the autonomous agent regains normal trading authority within policy constraints.
   - *Source*: [`programs/sentinel/src/lib.rs`](../../programs/sentinel/src/lib.rs) (`recover`), [`apps/web/src/app/quarantine/page.tsx`](../../apps/web/src/app/quarantine/page.tsx)

---

## What is Real vs Simulated

| Component | Status | Implementation Details |
| :--- | :--- | :--- |
| **On-Chain Policy Invariants** | **REAL** | Anchor smart contract enforces concentration caps, stablecoin floors, trade caps, and slippage on Solana Devnet. |
| **Pyth Network Oracle Read** | **REAL** | `parse_and_verify_pyth_price` validates account ownership (`rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`), Full verification level, 32-byte `feed_id`, max 60s freshness, and max 200 bps confidence on Devnet. |
| **Quarantine & Lockout State Machine** | **REAL** | `Active` ➔ `PendingViolation` ➔ `Quarantined` ➔ `Active` / `RecoveryExpired` transitions enforced on-chain with hysteresis slots and replay nonces. |
| **Real SPL Token Custody & Containment** | **REAL** | Native zero-dependency SPL Token & Token-2022 CPI custody via `transfer_checked`. Program PDA vault owns tokens; `owner_deposit` and `owner_withdraw` manage liquidity; `recover()` executes emergency containment transfer of excess volatile tokens directly to owner's `safe_destination`. |
| **Exact Token Conservation & Risk Improvement** | **REAL** | On-chain token conservation asserts exact balance reduction (`pre_balance == post_balance + sell_units`), strict exposure reduction, and postcondition invariant restoration. |
| **Pure Solver Engine** | **REAL** | `@sentinel/sdk` mathematical solver (`requiredRecoveryUnits` in `packages/sdk/src/recovery.ts`) finds the minimal whole-unit containment amount satisfying the on-chain postconditions (concentration caps, cash floor, strict improvement) via $O(\log N)$ binary search, without heuristics. It does **not** "solve" the oversell guard: when the minimal compliant amount would still trip the oversell band, it returns `isViable: false` with a `rejectionReason` for the caller to escalate rather than forcing a lossy outcome. |
| **Autonomous Watcher & Solver Daemons** | **REAL CODE / NOT AUTO-STARTED** | `SentinelWatcherService`, `SentinelSolverService` (`packages/sdk/src/services/`) and their CLI runners `scripts/watcher-daemon.mjs` / `scripts/solver-daemon.mjs` are real and tested, but they are **operator-invoked, not part of the deployed service**. The Docker image and Railway both start only the web server (`CMD ["node", "apps/web/server.js"]` and `startCommand: "node apps/web/server.js"`); the daemons start only when someone runs `pnpm watcher` / `pnpm solver`. They fail closed unless a funded keypair is provided or `ALLOW_EPHEMERAL_KEYPAIR=1` is set. |
| **Bankrun & Localnet Test Coverage** | **REAL** | **268 automated tests passing with zero failures**: 26 slot-warped Bankrun recovery tests (including real SPL custody & containment), 13 Bankrun quarantine tests, 26 Bankrun remediation security tests, 4 demo-scenario integration tests, 20 Anchor localnet tests, 110 SDK tests, 39 Domain tests, and 30 Rust unit tests (100% assertion of real error codes). |
| **Live Devnet Transactions** | **REAL** | Verified on-chain transactions on Solana Devnet recorded with signatures, slots, and Explorer confirmation in `docs/cwf/devnet-evidence.json`. |
| **Mandatory Real Custody Enforcement** | **REAL** | `recover()` strictly requires the 4 canonical SPL custody accounts and executes program-signed CPI `transfer_checked_signed`; omitting custody accounts fails closed with `MissingCustodyAccounts` (6045). |
| **Stocklana vs CWF Boundaries** | **REAL / DISCLOSED** | Sentinel CWF Quarantine and Containment executes REAL SPL Token / Token-2022 CPI transfers on-chain to `safe_destination`. The Stocklana autonomous trading portfolio interface projects target weights on an internal ledger prior to on-chain containment. |
| **Sentinel Devnet Lab & Faucets** | **REAL** | Dedicated `/lab` sandbox environment with native SOL faucet request, test SPL token faucets (`sUSD` & `sASSET`), one-click test vault seeding, controlled incident simulator that shocks exposure to 68% against a 60% policy cap (flag pending → quarantine → real SPL transfer), and toggleable Demo vs Proof cryptographic inspection. |
| **Solver Bounty Payout** | **SIMULATED** | Bounty calculation (`bounty_cap_cents`) is computed and emitted in `RecoveryExecutedEvent` as an informational metric; no token disbursement takes place on-chain. |

---

## Prior Art

Existing safety architectures in decentralized finance address operational failures in specific ways:
- **Drift Vaults**: Utilizes temporary reduce-only liquidators to de-risk underwater margin accounts when liquidation thresholds are crossed.
- **Morpho Vault V2**: Employs sentinel addresses with pause-only emergency authorities to freeze lending vaults during anomalous events.
- **Lighthouse**: Provides transaction-level assertions on account data balances to revert transactions that breach expected states.
- **Phylax**: Uses off-chain monitoring networks to pause protocol contracts before malicious transactions confirm.

Sentinel adapts these concepts specifically for autonomous AI agents managing discretionary portfolios:
1. **Owner-Defined Invariants**: Risk bounds are set by the portfolio owner rather than protocol liquidation parameters.
2. **Targeted Agent Lockout**: Agent signing keys are locked out while preserving owner release authority.
3. **Constrained Token Containment**: Transfers excess risk assets directly to the owner's pre-approved safe destination rather than risking execution slippage in unhedged auctions.
4. **Enforced Postconditions**: Post-containment vault exposure must strictly improve and observe configured caps.
5. **Recovery Expiry**: Quarantines have bounded lifespans (`recovery_window_slots`) to prevent indefinite lockout.

We found no directly matching implementation in the prior art we reviewed.

---

## Explicit Capability Boundary & Current Limitations

> **Current Implementation Boundary**:
> The current prototype does not execute DEX swaps or sell contained assets. A successful containment transfer reduces assets held inside the strategy-controlled vault, but does not by itself recover lost money or guarantee that the owner's total market exposure falls. Guarded trade settlement updates internal vault accounting; it does not route to an external DEX. Bounties emitted in recovery events are currently informational (0).

---

## Customer Validation

No customer conversations yet.

---

## CWF Disclosure Statement

- **Baseline Commit**: [`f8734ef`](https://github.com/dren712/sentinel_finance/commit/f8734ef) (Tagged `stocklana-baseline`, representing the state prior to CWF additions).
- **Work Completed for CWF (Post-September 14)**:
  - Commit [`be93523`](https://github.com/dren712/sentinel_finance/commit/be93523): Phase 0 — Branched `cwf/main` and deployed dedicated CWF Program ID `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH` to Solana Devnet.
  - Commit [`d8451d5`](https://github.com/dren712/sentinel_finance/commit/d8451d5): Phase A — Removed price bypass, enforced Pyth Receiver ownership (`rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`), added `feed_id` matching, freshness/confidence checks, test fixtures, and verified with 6 Anchor localnet tests.
  - Commit [`900f80c`](https://github.com/dren712/sentinel_finance/commit/900f80c): Phase B — Implemented quarantine state machine skeleton (`Active`, `Quarantined`, `RecoveryExpired`), hysteresis flagging, agent lockout, owner release, 13 slot-warped Bankrun tests, and live Devnet transaction flow.
  - Commit [`a5ad3a2`](https://github.com/dren712/sentinel_finance/commit/a5ad3a2): Phase 0 Fixes — Corrected commit hash citations in disclosure log and documented honest trust boundaries.
  - Commit [`efe194f`](https://github.com/dren712/sentinel_finance/commit/efe194f): Phase 1 — Implemented on-chain `recover()` instruction with reduce-only math, value conservation, oversell guard, postcondition validation, and 28 Cargo unit tests.
  - Commit [`67ca828`](https://github.com/dren712/sentinel_finance/commit/67ca828): Phase 2 — Built comprehensive Bankrun recovery suite with slot warping asserting exact error codes.
  - Commit [`42e9f23`](https://github.com/dren712/sentinel_finance/commit/42e9f23): Phase 3 — Updated TypeScript SDK and IDL, upgraded Devnet program, executed full live Devnet recovery flow with Pyth oracle, and saved transaction evidence to `docs/cwf/devnet-evidence.json`.
  - Commit [`14a8387`](https://github.com/dren712/sentinel_finance/commit/14a8387): Phase 4 — Implemented `/quarantine` web page with real on-chain vault state, exposure vs cap, recovery window countdown, exact error decoding, and authoritative event timeline.
  - Commit [`89e5af1`](https://github.com/dren712/sentinel_finance/commit/89e5af1): Phase 5 — Canonical IDL error mapping, reconciled CWF program ID, and complete migration audit rewrite.
  - Commit [`1164c46`](https://github.com/dren712/sentinel_finance/commit/1164c46): Phase 6 — Protocol security hardening: policy freeze snapshot on quarantine, exact volatile asset model, and malformed state error handling.
  - Commit [`0b28bf9`](https://github.com/dren712/sentinel_finance/commit/0b28bf9): Phase 7 — Real SPL Token custody (`custody.rs`), program PDA token accounts, `owner_deposit`, `owner_withdraw`, emergency containment recovery to `safe_destination`, and exact token balance conservation verified across 9 new Bankrun tests (26 total).
  - Commit [`0a5eea4`](https://github.com/dren712/sentinel_finance/commit/0a5eea4): Phase 8 — Pure solver recovery engine in `@sentinel/sdk` calculating exact minimal units to satisfy postconditions without heuristics.
  - Commit [`5f31a6b`](https://github.com/dren712/sentinel_finance/commit/5f31a6b): Phase 9 — Autonomous Watcher daemon and permissionless Solver daemon with continuous RPC polling lifecycles and CLI scripts.
  - Commit [`8c0b126`](https://github.com/dren712/sentinel_finance/commit/8c0b126): Phase J — Production Custody Hardening & CWF UI/UX Overhaul: Fully eliminated simulated fallback branch in `recover()` (`MissingCustodyAccounts` 6045); allowlisted SPL Token and Token-2022 programs; enforced deposit mint tracking (`UntrackedDepositMint` 6046); wired `resolveRecoveryCustodyAccounts` into SDK solver and `/quarantine` web UI with 8-state interactive recovery button; added precision slot countdown timer; added dynamic header status indicator (`WATCHING` vs `QUARANTINED`); elevated hero copy to "AUTONOMOUS CAPITAL. RECOVERABLE BY DESIGN." with 6-stage Hero State Rail; and removed all simulated fallback signatures, fake slots, and synthetic metrics from receipt cards.
  - **Phase K (Current Head)** — Complete Protocol Integrity & Forensic Quarantine UI:
    - **Binary Search Solver Engine**: Upgraded minimal required sell units solver in `packages/sdk/src/recovery.ts` from linear $O(N)$ loop to $O(\log N)$ binary search, completing $10^{11}$ unit calculations in < 1ms.
    - **Fail-Closed Surveillance & Solvers**: Enforced strict fail-closed oracle reads in `SentinelWatcherService` and `SentinelSolverService` (no stale cached price fallback); added dual invariant monitoring for single-asset exposure cap AND stablecoin reserve floor. Defaulted solver daemon to custody mode.
    - **Live Execution Adapter Wiring**: Updated `LiveExecutionAdapter.recover()` to resolve and append canonical custody accounts (`vault_token_account`, `safe_destination_token_account`, `mint`, `token_program`).
    - **Smart Contract Equity Integrity**: Added `recompute_total_value` to `PortfolioVault` across initialization, sync, deposit, and withdraw.
    - **Forensic Quarantine UI Overhaul**: Upgraded `/quarantine` to 1000ms polling, live Pyth oracle feed verification card, Anchor event decoding, forensic custody containment recovery receipts with zero fake mint fallbacks and zero fake metrics.
    - **Automated Test Status (current)**: 268 / 268 automated tests passing with zero failures — 26 slot-warped Bankrun recovery tests, 13 Bankrun quarantine tests, 26 Bankrun remediation security tests, 4 demo-scenario integration tests, 20 Anchor localnet tests, 110 SDK tests, 39 Domain tests, and 30 Rust unit tests.

---

## Program Version Boundary

**The deployed devnet program and this source tree are the same binary.** This is verifiable in one command rather than asserted:

```bash
solana program dump 3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH deployed.so --url devnet
shasum -a 256 deployed.so    # 9328a505f1152d4bc7c97452a820856b4df1297df02dbdaba351874cfd09b5a9
```

| | |
| :--- | :--- |
| Deploy transaction | [`xsrfF792oqxwfpb5cMCwkM6N83muofnNU9MxSYF27EqvMCHWpSJfhCHwssoNKeANZWPtFzTqG5hTo4vSY6kQ8Fs`](https://explorer.solana.com/tx/xsrfF792oqxwfpb5cMCwkM6N83muofnNU9MxSYF27EqvMCHWpSJfhCHwssoNKeANZWPtFzTqG5hTo4vSY6kQ8Fs?cluster=devnet) |
| Binary size | 476,264 bytes |
| SHA-256 | `9328a505f1152d4bc7c97452a820856b4df1297df02dbdaba351874cfd09b5a9` |
| Upgrade authority | `GR9CtiUswZtay68U2fGqcDeB1dg8sHtpVi9kk2nCEwzw` |

Three hardening changes landed in this upgrade and are therefore **live on-chain**:

1. **Oracle `posted_slot` binding (≤ 64 slots).** `MAX_ORACLE_SLOT_LAG = 64` and `check_pyth_slot_lag`, called before the price is consumed in `parse_and_verify_pyth_price`, bind a verified Pyth print to the slot that consumes it. This closes a stale-print replay window beyond the existing 60s publish-time freshness check.
2. **Recovery-liveness fix.** The oversell guard in `recover()` is now gated on an *actual* breach. Unconditional application could make a vault quarantined at a breach the market has since repaired unsolvable by any `sell_units`, stranding it in `Quarantined` until owner intervention.
3. **`sync_vault` re-checks policy invariants.** `sync_vault` now re-validates concentration and stablecoin reserve against the owner's `PolicyAccount` before writing balances. Without it, an owner-asserted sync could bypass the caps entirely and — because every custody path asserts exact balance equality — permanently desync the ledger from real SPL custody. `PolicyAccount` is a new required account on this instruction.

**Caveat on the lifecycle evidence:** the recorded lifecycle transactions were executed *before* this upgrade, against the previous build of the same program ID. The **quarantine / containment state machine they exercise is unchanged** — `flag_violation` hysteresis, `VaultNotActive` lockout, `owner_release`, `expire_quarantine`, the recovery window and nonce replay protection, mandatory SPL custody (`MissingCustodyAccounts` 6045), and the containment `TransferChecked` CPI to `safe_destination` are the same logic. They are proof of the state machine, not of the three changes above. Those are covered by the test suites and by the binary hash check.

