# Sentinel Robo — Technical Architecture & State-Transition Boundary

## 1. Why Solana: The State-Transition Boundary

Autonomous AI agents operate in probabilistic space: they ingest signals, reason over portfolios, and propose actions. Financial custody, however, requires deterministic guarantees. Prompt guardrails and off-chain wrappers fail whenever an LLM hallucinates, miscalculates portfolio headroom, or acts on stale oracle quotes.

Sentinel places an **atomic state-transition boundary** between the autonomous agent (`Robo-01`) and capital execution on Solana:

1. **Deterministic Account Locking**: Every portfolio invariant (`PolicyAccount`), vault state (`PortfolioVault`), agent mandate (`AgentAccount`), and trade commitment (`PromiseAccount`) lives in deterministic Program Derived Addresses (PDAs) owned by the Sentinel Anchor program (`3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`). SPL custody lives in separate PDA-owned token accounts passed to the program, not in the vault state account.
2. **Two-Tier Pre-State vs. Post-State Verification**: Sentinel enforces a strict defense-in-depth model across two layers before any state transition commits:
   - **On-Chain Anchor Guard (`execute_guarded_trade`)**: Enforces single-stock concentration cap (`post_asset_bps <= max_single_asset_bps`), stablecoin reserve floor (`post_stablecoin_bps >= min_stablecoin_bps`), max trade size (`trade_amount_usd <= max_trade_value_usd`), max slippage (`max_slippage_bps`), and agent authorization / promise binding. If any on-chain check fails, the transaction reverts atomically on Solana (`0` tokens moved).
   - **Off-Chain Pre-Trade Verifiers (`Sentinel SDK`)**: Asserts Pyth oracle freshness (`quote_age <= 60s`), confidence intervals, and tracking error; PreStocks pre-IPO universe allocation (`exposure <= 20%`); and Meteora DBC pool depth (`liquidity >= $25k`) and price impact (`<= 200 bps`).
3. **Structured Error Feedback for Reactive Adaptation**: Anchor error codes (`6000`–`6046`) and SDK postcondition diagnostics return the exact mathematical headroom so the agent can adapt and settle within the same decision cycle.

---

## 2. Current Devnet vs. Target Production Architecture

To ensure technical accuracy for code reviewers and judges, Sentinel explicitly separates what executes on **Current Devnet** from the **Target Production Architecture**:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         CURRENT DEVNET (LIVE)                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Browser Wallet / Next.js BFF                                            │
│   ├─ Browser RPC (NEXT_PUBLIC_SOLANA_RPC): Wallet balances & signing    │
│   ├─ Server RPC (SOLANA_RPC_URL): Agent execution & PDA reconciliation  │
│   ├─ PythLivePriceProvider ➔ Hermes v2 REST (Live price/conf/age)       │
│   ├─ PreStocksApiClient ➔ Server-side Pre-IPO 409A NAV registry         │
│   └─ MeteoraDBCMarketQualityVerifier ➔ Deterministic pool PDA & guard   │
│                                                                         │
│ Solana Devnet Anchor Program (3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH)
│   ├─ PolicyAccount PDA    (initialize_policy / update_policy)           │
│   ├─ AgentAccount PDA     (initialize_agent)                            │
│   ├─ VaultAccount PDA     (initialize_vault / sync_vault)               │
│   ├─ PromiseAccount PDA   (create_promise)                              │
│   ├─ Trade Execution      (execute_guarded_trade — enforces             │
│   │                        postconditions & mutates VaultAccount state) │
│   └─ EvidenceAccount PDA  (record_evidence — anchors SHA-256 receipt)   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    TARGET PRODUCTION ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Direct On-Chain CPI Settlement                                          │
│   └─ Sentinel `execute_guarded_trade` invokes Meteora DBC / PreStocks   │
│      secondary vault swap via Cross-Program Invocation (CPI) and        │
│      verifies actual SPL token vault balance deltas post-CPI.           │
└─────────────────────────────────────────────────────────────────────────┘
```

> **Important Note on Devnet Settlement**: Sentinel's PortfolioVault is an on-chain ledger that tracks balances and enforces invariants. Token settlement is simulated; tokens do not move between SPL accounts. On Current Devnet, `execute_guarded_trade` executes a real Anchor instruction on Solana Devnet that verifies all `PolicyAccount` and `VaultAccount` invariants on-chain and mutates `VaultAccount` + `PromiseAccount` state on-chain, followed by `record_evidence`. No external DEX swap or SPL token transfer is claimed or performed.


---

## 3. On-Chain Anchor Instruction Lifecycle

The deployed program (`programs/sentinel/src/lib.rs`, `declare_id! = 3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`) exposes **16 instructions**. Accounts marked *owner* require the portfolio owner's signature; *agent* requires the agent authority; *anyone* is permissionless.

### 3.1 Policy and custody setup

1. **`initialize_policy`** — *owner*
   Seeds `["policy", owner]`. Writes `max_single_asset_bps`, `min_stablecoin_bps`, `max_trade_value_usd`, `max_slippage_bps`, `confirm_slots`, `recovery_window_slots`, `safe_destination`, and `policy_version = 1`. Rejects three degenerate shapes that would silently disable the guardrails: a cap at 100% (makes every invariant pass), bounds that cannot both be satisfied, and a cap at or below `OVERSELL_BAND_BPS` (vacates the oversell guard).
2. **`update_policy`** — *owner*
   Same account, plus `is_active`. Refused while the vault is `Quarantined` (`PolicyFrozenDuringRecovery`, 6036) by both an instruction-body check and an account constraint, so `safe_destination` cannot be swapped mid-recovery. Applies the same three coherence checks as `initialize_policy`.
3. **`initialize_agent`** — *owner*
   Seeds `["agent", owner, agent_id]`. Binds `agent_authority` — the key that may *propose* trades. Nothing else.
4. **`initialize_vault`** — *owner*
   Seeds `["vault", owner]`. Creates `PortfolioVault` with exactly one volatile position plus `usdc_balance_cents` and `total_value_cents`.
5. **`sync_vault`** — *owner*
   Re-declares current holdings. Requires `vault.status == Active` and an **active policy** (frozen during quarantine, so ledger state cannot be rewritten mid-recovery). Deliberately does **not** re-check concentration or reserve: this path *reports* the portfolio rather than *choosing* it, and a real violation must remain recordable so `flag_violation` can observe it. It is also why the `PolicyAccount` is now a required account here.
6. **`set_agent_active`** — *owner*. Emergency pause kill-switch.

### 3.2 The trading path

7. **`create_promise`** — *agent*. Seeds `["promise", agent, promise_id]`. Commits `intent_hash`, `trade_asset_mint`, `trade_direction` (0 = BUY, 1 = SELL), `trade_amount_usd`, and an expiry into `PromiseAccount`.
8. **`execute_guarded_trade`** — *agent, authorized by promise*.
   The enforcement core. It reads a Pyth `PriceUpdateV2` account and verifies, in order: receiver ownership, `VerificationLevel::Full`, `feed_id` equality, **slot lag ≤ 64 slots**, publish age ≤ 60s, confidence ≤ 200bps. It then recomputes exposure from the **post-mutation vault state** — not from a projection — and checks the concentration cap, stablecoin floor and trade-size cap. Any failure reverts atomically with `6000`–`6046`. Settlement is **ledger-only**: it mutates vault accounting and performs no CPI.
9. **`reject_promise`** — *agent*. Records an explicit rejection.

### 3.3 Quarantine and containment

10. **`flag_violation`** — **anyone**, no bond, no fee, no cooldown. Re-prices the position from the verified oracle feed and records a pending violation. A second call after `confirm_slots` transitions the vault to `Quarantined`, which hard-gates every trading instruction with `VaultNotActive` (6025).
11. **`expire_quarantine`** — *anyone*. After `recovery_window_slots` the vault becomes `RecoveryExpired`, bounding how long the agent can be locked out.
12. **`owner_release`** — *owner*. Returns a vault to `Active` **without verifying compliance** — an override, not a repair. Since `flag_violation` is permissionless, a non-compliant release can be re-quarantined.
13. **`recover`** — **anyone**, but only while `Quarantined` and only within the recovery window, with the policy version pinned to the quarantine snapshot and the recovery nonce matched. Solves the minimum sell units, then executes a **program-signed SPL Token / Token-2022 CPI `transfer_checked`** from vault PDA custody to `policy.safe_destination`. Asserts the exact balance delta on **both** sides and that the vault's raw balance equals its post-recovery unit count, then bumps the nonce — making replay impossible. On success the vault returns to `Active`.
14. **`owner_deposit`** — *owner*. Real SPL transfer owner → vault PDA. Rejects untracked mints (`UntrackedDepositMint`, 6046).
15. **`owner_withdraw`** — *owner*. Real SPL transfer vault PDA → owner.

### 3.4 Evidence

16. **`record_evidence`** — *agent*. Stores `pre_state_hash`, `post_state_hash`, `verification_result`, and `failure_code` in `EvidenceAccount`.

> **What this is not.** `record_evidence` does **not** compute SHA-256 on-chain and does **not** derive the hashes from vault state. The program contains no SHA-256 implementation; the digests are supplied by the agent signer and computed off-chain in `@sentinel/domain`. Treat PROVN receipts as an agent-attested audit trail binding an actor to a claim — not as an independently verified proof of the state transition.

### 3.5 Error codes

`programs/sentinel/src/errors.rs` defines **47 variants, 6000–6046**, contiguous. Representative values: `ExposureExceeded` 6000, `StablecoinReserveBreached` 6001, `TradeSizeExceeded` 6002, `StaleOracle` 6022, `ConfidenceTooWide` 6023, `VaultNotActive` 6025, `MissingCustodyAccounts` 6045, `UntrackedDepositMint` 6046.

---

## 4. PROVN Cryptographic Evidence Specification

Every decision cycle (both `REJECTED` and `SETTLED`) produces a deterministic PROVN receipt:

$$\text{EvidenceHash} = \text{SHA-256}\left(\text{IntentHash} \parallel \text{PolicyHash} \parallel \text{PreStateHash} \parallel \text{PostStateHash}\right)$$

- **Postgres Read Index (`evidence_index`)**: Stores the full JSON receipt and hashes for sub-millisecond query lookup via `GET /api/evidence/:id`.
- **Solana Verification**: Verifies the transaction signature and `EvidenceAccount` / `PolicyAccount` PDAs directly against Solana Devnet (`SOLANA_RPC_URL`).

---

## 5. Canonical Docker & Production Deployment

Sentinel ships with a multi-stage `Dockerfile` and `docker-compose.yml` orchestrating `@sentinel/web` (`port 3000`) and the PostgreSQL 16 read index (`postgres:5432`).

- **Live Railway Production URL**: [`https://sentinel-finance-production-4560.up.railway.app/`](https://sentinel-finance-production-4560.up.railway.app/)
- **Live Health Endpoint**: [`https://sentinel-finance-production-4560.up.railway.app/api/health`](https://sentinel-finance-production-4560.up.railway.app/api/health)

```bash
# 1. Configure environment variables
cp .env.example .env

# 2. Build and start the containerized stack
docker compose up --build -d

# 3. Verify health & Devnet connectivity
curl http://localhost:3000/api/health
```

---

## 6. Built for Solana's Next Consensus Era (Alpenglow Readiness)

Solana's upcoming **Alpenglow** consensus upgrade targets ~150 ms finality (replacing TowerBFT's ~12.8s) while leaving SVM transaction execution and account semantics completely unchanged.

Because Sentinel's core guarantees operate at the SVM application layer (Anchor instructions, PDA state transitions, and postcondition verification), the consensus layer can evolve underneath the Sentinel enforcement model without redesigning core policy logic:

```text
Agent Intelligence ➔ Sentinel Policy Postconditions ➔ SVM Execution ➔ Solana Consensus / Finality ➔ PROVN Evidence Index
```

As Solana moves toward lower-latency finality, Sentinel's policy-bound execution model can support increasingly responsive autonomous workflows:
- **Today:** Sentinel runs on Solana Devnet with real on-chain policy enforcement (`execute_guarded_trade`), deterministic state transitions on `PortfolioVault` PDAs, and permissionless quarantine with SPL containment. The deployed binary is SHA-256 identical to this source tree — see the Program Version Boundary in [`README.md`](../README.md#program-version-boundary).
- **Direction:** Faster consensus + autonomous agents + deterministic financial postconditions.

**What this does not buy you.** Alpenglow does not change the threat model: a replayed price update or a mis-calibrated ledger is a *program logic* problem, not a consensus-latency one. Sentinel does not depend on Alpenglow, and would not be meaningfully safer with it deployed tomorrow.


