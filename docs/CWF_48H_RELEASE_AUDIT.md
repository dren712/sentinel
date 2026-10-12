# Sentinel Finance — CWF 48h Release Audit & Truth Matrix

**Audit Date**: October 10, 2026  
**Auditor**: Antigravity Autonomous Pair Programmer  
**Product**: Sentinel — Recovery Infrastructure for Autonomous Solana Financial Strategies  
**Network**: Solana Devnet  
**Authoritative Program ID**: `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`  
**Git HEAD**: `main`

---

## 1. Executive Summary

This document provides a comprehensive, radically honest audit of the Sentinel codebase following the execution of the 48-Hour CWF Execution Plan. It details every architectural component across six distinct categories:
1. **On-Chain Real** (Authoritative SVM instructions and runtime constraints)
2. **Off-Chain Real** (Domain engine, SDK, autonomous daemons, web application)
3. **Simulation / Demo Scenarios** (Controlled sandbox inputs and informational metrics)
4. **Deliberately Excluded / Out-of-Scope** (Features omitted to preserve security and deadline integrity)
5. **Resolved Misleading / Contradictory Claims** (Audit discrepancies eliminated during hardening)
6. **Verified Automated Test Matrix** (All 264 automated tests passing with zero failures)

---

## 2. Comprehensive Truth Table

| Component / Feature | Classification | Implementation Location | Operational Mechanism & Limitations |
| :--- | :--- | :--- | :--- |
| **SPL Token & Token-2022 Custody** | **On-Chain Real** | `programs/sentinel/src/custody.rs` | Program-derived address (PDA) acts as token authority. Uses zero-dependency manual instruction packing for CPI calls (`transfer_checked_signed`). |
| **Emergency Containment Recovery** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`recover`) | Requires 4 remaining custody accounts (`[vault_ta, safe_dest_ta, mint, token_program]`). Executes CPI moving exact excess volatile tokens to `policy.safe_destination`. |
| **Pre-Trade Policy Guard** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`execute_guarded_trade`) | Reverts transactions violating single-asset exposure cap, stablecoin reserve floor, trade size limit, or slippage limits. |
| **Pyth Price Feed Verification** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`parse_and_verify_pyth_price`) | Enforces Pyth Receiver ownership (`rec5EKMG...`), `Full` verification level, exact 32-byte `feed_id` match, freshness (`<= 60s`), and confidence interval (`<= 200 bps`). |
| **Quarantine State Machine** | **On-Chain Real** | `programs/sentinel/src/lib.rs` | 2-stage hysteresis via `flag_violation` (Pending -> Quarantined over `confirm_slots`), `expire_quarantine`, and privileged `owner_release`. |
| **Policy Freeze During Quarantine** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`policy_version_at_quarantine`) | Reverts `recover()` or `update_policy` if `policy_version` has been mutated during an active quarantine (`PolicyFrozenDuringRecovery` 6036). |
| **Nonce & Window Expiry Protection** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`recovery_nonce`, `recovery_expires_slot`) | Prevents transaction replay; reverts if solver calls outside slot window (`RecoveryWindowClosed` 6030). |
| **Exact Token Balance Conservation** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`TokenBalanceMismatch`) | Asserts pre-balance equals post-balance plus exact transfer units, preventing token leakage or inflation. |
| **Mandatory Postcondition Verification** | **On-Chain Real** | `programs/sentinel/src/lib.rs` (`PostconditionFailed`, `OversellGuard`) | Asserts post-exposure strictly lower than pre-exposure, complies with policy cap, and prevents excessive rebalancing. |
| **Pure Solver Engine** | **Off-Chain Real** | `packages/sdk/src/recovery.ts` (`requiredRecoveryUnits`) | $O(\log N)$ binary search finding the minimal whole-unit containment amount that satisfies the on-chain postconditions within 1ms. If the minimal amount would trip the oversell band — or if no amount can restore compliance — the solver does **not** force a solution: it returns `isViable: false` with a `rejectionReason` for the caller to escalate. |
| **SDK Execution Adapter** | **Off-Chain Real** | `packages/sdk/src/adapters/execution-adapter.ts` (`LiveExecutionAdapter`) | Builds typed Anchor instructions; enforces split keys (`OWNER` vs `AGENT`); throws if fewer than 4 canonical custody remaining accounts are resolved for `recover()` (`execution-adapter.ts:840-844`). |
| **Autonomous Watcher Daemon** | **Off-Chain Real** | `scripts/watcher-daemon.mjs` | Continuous background polling; flags invariant breaches; requires funded keypair (fails closed on missing signer). |
| **Autonomous Solver Daemon** | **Off-Chain Real** | `scripts/solver-daemon.mjs` | Continuous background polling; computes optimal recovery units; executes real custody recovery; requires funded keypair. |
| **PROVN Evidence Generator** | **Off-Chain Real** | `packages/domain/src/provn.ts` | Computes deterministic SHA-256 state hashes binding pre-state, intent, and post-state. |
| **Quarantine Incident Center** | **Off-Chain Real** | `apps/web/src/app/quarantine/page.tsx` | Real-time on-chain status monitoring, slot countdown, 8-state interactive recovery button, genuine Solana Explorer transaction receipts. |
| **Devnet Lab & Faucets** | **Off-Chain Real** | `apps/web/src/app/lab/page.tsx`, `apps/web/src/lib/faucet-service.ts` | Real Devnet SOL airdrop + real Devnet SPL token minting (`sUSD`, `sASSET`) with on-chain ATA funding. |
| **Solver Bounty Reward** | **Simulation** | `programs/sentinel/src/lib.rs` (`bounty_cap_cents`) | Informational metric emitted in `RecoveryExecutedEvent`. No token transfer is executed to the solver wallet. |
| **Devnet Lab Incident Scenario** | **Controlled Input** | `apps/web/src/lib/devnet-sandbox.ts` | Uses live Pyth Devnet ETH/USD proxy feed (`GsZE13nr...`) to mark sASSET. Demonstrates breach via honest, controlled on-chain cash ledger reserve adjustment against the live Pyth price feed. |
| **Interactive Homepage Simulator** | **Simulation** | `apps/web/src/components/LandingView.tsx` | Visual demonstration showing $15K trade rejection and $5K adapted approval. |
| **Meteora / PreStocks Pre-Flight** | **Simulation** | `packages/domain/src/swarm-verifiers.ts`, `packages/domain/src/meteora-market.ts`, `packages/domain/src/prestocks.ts` | Evaluated in off-chain TypeScript filters rather than on-chain CPI swap checks. |
| **DEX Liquidation Swaps** | **Out-of-Scope** | N/A | Sentinel deliberately executes *bounded token containment* (moving tokens to `safe_destination`), not automated DEX swaps. |
| **Universal Multi-Asset Recovery** | **Out-of-Scope** | N/A | Production scope is bounded to 1 volatile asset + USDC reserve. Multiple volatile assets in a single recovery transaction is deferred. |

---

## 3. Discrepancy Reconciliation & Hardening Actions

During the audit and implementation phases, several legacy contradictions and audit findings were identified and eliminated:

1. **Token Decimal Normalization (P0.1)**:
   - *Previous*: Program ledger tracked `amount_units` in whole units while CPI calls passed units directly without scaling by decimals ($10^6$), resulting in a $10^6$ unit mismatch.
   - *Resolution*: Canonicalized units: `amount_units` in the ledger represents whole token units, while CPI operations (`recover`, `owner_deposit`, `owner_withdraw`) strictly scale `units * 10^decimals` at the SPL Token program boundary. Exact token balance conservation asserts raw delta equality.
2. **Pyth Oracle & Scenario Alignment (P0.2)**:
   - *Previous*: Synthetic sASSET used Pyth ETH/USD proxy, but the Lab presented a static shock ($40 -> $50) and solver fallback assumed $50.
   - *Resolution*: Lab directly queries the live Pyth Devnet ETH/USD feed (`GsZE13nr...`), calibrates the baseline exposure against the live quote, and induces an honest controlled reserve shock against that verified live price.
3. **Watcher Activation Check (P0.3)**:
   - *Previous*: Watcher checked `policy.active`, but the decoded Anchor account exposed `isActive` / `is_active`.
   - *Resolution*: Watcher now evaluates `policy?.isActive ?? policy?.is_active ?? policy?.active` and skips inactive policies, with dedicated regression unit tests.
4. **Authoritative Safe Destination & Idempotent Resets (P0.4 & P0.5)**:
   - *Previous*: Lab could display a requested safe destination differing from the on-chain policy, and setup/reset minted redundant tokens inflating balances.
   - *Resolution*: Policy safe destination is committed and re-read from on-chain account state. Setup and reset are physically idempotent: only minting the exact deficit required to restore target balance and asserting token balance matches ledger.
5. **Elimination of Fabricated Recovery Receipts (P0.6)**:
   - *Previous*: Solver fallback contained synthetic constants (`22`, `5940`, `6800`).
   - *Resolution*: Removed all synthetic receipt constants. Receipts are computed dynamically from refetched on-chain vault state, Anchor event logs, and actual before/after token balance deltas.
6. **On-Chain Policy Freeze Enforcement (P0.8)**:
   - *Previous*: `update_policy` lacked a status check on the associated vault, potentially permitting policy alterations while quarantined.
   - *Resolution*: Added `vault: Account<'info, PortfolioVault>` to `UpdatePolicy` with constraint `vault.status == VaultStatus::Active @ PolicyFrozenDuringRecovery` (6036).
7. **Daemon Hardening & Split Keys**:
   - *Previous*: Daemons silently generated unfunded ephemeral keypairs when environment variables were missing.
   - *Resolution*: Daemons fail closed unless funded keypairs are provided or `ALLOW_EPHEMERAL_KEYPAIR=1` is explicitly set.

---

## 4. Test Verification Summary

All test suites were executed cleanly in the local environment:

| Test Suite | Framework / Tool | Test Count | Passing | Failing |
| :--- | :--- | :---: | :---: | :---: |
| **SDK Unit & Adversarial Security Tests** | Node test runner (`pnpm --filter @sentinel/sdk test`) | 110 | 110 | 0 |
| **Domain Policy Engine Tests** | Node test runner (`pnpm --filter @sentinel/domain test`) | 39 | 39 | 0 |
| **Bankrun Recovery Tests** | `solana-bankrun` (`tests/bankrun-recovery.test.ts`) | 26 | 26 | 0 |
| **Bankrun Quarantine Tests** | `solana-bankrun` (`tests/bankrun-quarantine.test.ts`) | 13 | 13 | 0 |
| **Remediation Security Tests** | `solana-bankrun` (`tests/remediation-security.test.ts`) | 26 | 26 | 0 |
| **Localnet Integration Tests** | `@coral-xyz/anchor` (`tests/sentinel-localnet.test.ts`) | 20 | 20 | 0 |
| **Rust Program Unit Tests** | `cargo test` | 30 | 30 | 0 |
| **TOTAL** | — | **264** | **264** | **0** |

`pnpm test` at the workspace root runs the SDK + Domain packages together (110 + 39 = **149**); the remaining 115 are the four Bankrun/Anchor suites and `cargo test`.

All 14 Next.js production API routes (`route.ts` under `apps/web/src/app/api`) compiled cleanly with 0 TypeScript or build errors (`pnpm --filter @sentinel/web build`).
