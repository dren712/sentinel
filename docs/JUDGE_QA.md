# Sentinel Finance — Judge Q&A Defense Matrix

This document provides concise, authoritative answers to the hardest technical and architectural questions judges and auditors ask about Sentinel Finance. Every claim maps directly to verified Devnet transactions and automated integration tests documented in [`docs/CLAIMS.md`](./CLAIMS.md).

---

### Q1: "Why isn't this just a multisig or pre-trade simulation?"

Yes for the containment path, no for the trading path — and the distinction is worth understanding.

**On-chain state transitions** are real. `execute_guarded_trade` computes the post-trade portfolio *inside the SVM*, from the mutated vault state rather than a caller-supplied projection, and reverts atomically if any invariant is breached. That is the same code path an attacker would have to attack to move value, and it is covered by 26 slot-warped Bankrun tests plus 30 Rust unit tests.

**What is not real on the trading path:** settlement is ledger-only. The program mutates internal vault accounting (`usdc_balance_cents`, `AssetPosition[]`); it does not route to a DEX and does not move SPL tokens. On that path Sentinel is an enforcement and accounting boundary, not an execution venue.

**What is real on the containment path:** `recover()` executes a program-signed SPL Token / Token-2022 CPI `transfer_checked_signed`, moving tokens out of vault PDA custody to the owner's `safe_destination`, and asserts the exact balance delta on *both* sides plus that the vault's raw balance equals its post-recovery unit count.

---

### Q2: "Can a rogue agent bypass your caps by manipulating prices?"

No. Sentinel removed all reliance on caller-supplied pricing: `execute_guarded_trade` reads verified Pyth Network `PriceUpdateV2` feed accounts directly on-chain. The program validates that the account is owned by the Pyth receiver, requires `VerificationLevel::Full`, pins the 32-byte `feed_id`, enforces a 60-second publish-age ceiling (`check_pyth_freshness`), bounds confidence intervals to 200 bps (`check_pyth_confidence`), and binds the update to the consuming slot (`check_pyth_slot_lag`, ≤64 slots) before converting it to cents.

That last check matters more than it looks. Pyth Receiver price-update accounts are *ephemeral* — anyone can create one from any genuine publisher-signed print. Checking `publish_time` alone therefore proves the print is recent, but not that it is the *live* one. The slot binding is what stops a caller from replaying an older, materially different, perfectly `Full`-verified print.

A caller supplying an arbitrary price account fails on-chain with `UnverifiedPrice` (6024), `FeedMismatch` (6021), `StaleOracle` (6022), or `ConfidenceTooWide` (6023). *(See `programs/sentinel/src/lib.rs`, `parse_and_verify_pyth_price`; covered by `tests/remediation-security.test.ts` and `tests/bankrun-recovery.test.ts`.)*

---

### Q3: "Are you doing real SPL token transfers?"

Sentinel distinguishes between two execution paths:
1. **Guarded Trade Execution**: The prototype enforces on-chain portfolio ledger state transitions (`PortfolioVault.usdc_balance_cents` and `AssetPosition[]`) directly on-chain without executing external DEX swaps. This is transparently labeled in the UI as `"LEDGER-ONLY SETTLEMENT — NO SPL TRANSFERS"`.
2. **Emergency Containment (`recover`)**: The emergency containment path executes a real, program-signed SPL Token & Token-2022 CPI `transfer_checked_signed` transferring excess volatile tokens from vault PDA custody directly to the owner's `safe_destination`.

---

### Q4: "What does 'recovery' mean in Sentinel?"

In Sentinel, recovery refers strictly to **vault-state recovery** and **asset containment**. It does not mean recovering lost capital or reversing market losses. When a supported policy breach occurs and is confirmed via Pyth oracle price checks, the vault is quarantined. The recovery operation transfers excess volatile tokens out of the strategy vault to the owner's safe destination and reactivates the vault to `Active` after on-chain postconditions pass.

---

### Q5: "Does Sentinel execute DEX trades or sell contained assets?"

No. The current prototype does not execute DEX swaps or market sales. The containment path transfers tokens directly to the owner's pre-approved destination (e.g. cold storage or multisig) to remove them from autonomous agent signing custody. Liquidating or hedging those tokens on an exchange is left to the vault owner.

---

### Q6: "Does containment reduce the owner's total market exposure?"

Not necessarily. Containment reduces the *vault's* exposure and deprives the autonomous agent of custody over those tokens. However, because the tokens are transferred to an owner-controlled destination, the owner's aggregate economic exposure remains unchanged unless the owner separately sells them.

---

### Q7: "Can someone front-run evidence or squat on promise accounts?"

The `record_evidence` instruction binds the agent signer to the promise (`promise.agent == agent.key()`), so a third party cannot record evidence against another agent's promise. It also verifies that `verification_result` is consistent with `promise.status` (3 = settled, 4 = rejected) and stores SHA-256 state commitments on-chain.

**What that evidence is and is not:** it is an *agent-attested* record, not an independently verified cryptographic proof of the state transition. The SHA-256 digests are supplied by the agent signer and computed off-chain in `@sentinel/domain` — the program stores them but does not contain a SHA-256 implementation and does not recompute them from vault state. A fully compromised `agent_authority` could therefore attach arbitrary digests to a genuinely settled promise. Treat PROVN receipts as an audit trail binding an actor to a claim, not as a proof the program verified. *(See `programs/sentinel/src/lib.rs`, `record_evidence`.)*

---

### Q8: "What happens if Pyth is stale or unavailable?"

Sentinel enforces a strict fail-closed posture: any stale feed, missing account, replayed earlier print, or wide confidence interval causes an immediate transaction revert. `parse_and_verify_pyth_price` checks, in order: receiver ownership (`PYTH_RECEIVER_ID`), `VerificationLevel::Full`, `feed_id` equality, slot lag (`posted_slot` within 64 slots of the consuming slot), publish age (≤60s against the Solana `Clock`, with 10s forward-drift tolerance), and confidence (≤200 bps as a relative ratio). Failure modes revert with `UnverifiedPrice` (6024), `FeedMismatch` (6021), `StaleOracle` (6022), or `ConfidenceTooWide` (6023).

Both the watcher and solver services enforce the same fail-closed rule off-chain and carry **no cached-price fallback** — if Pyth is unreachable they do nothing rather than act on a stale number. *(See `programs/sentinel/src/lib.rs` and `packages/sdk/src/services/`.)*

---

### Q10: "Can an outsider freeze my vault by replaying an older price?"

**Not anymore — this was a real finding, we found it in our own audit, and we fixed and deployed it.**

`flag_violation` is deliberately permissionless: anyone can submit it. That is the feature. But the original build evaluated the vault against a caller-chosen Pyth account, and Pyth Receiver price-update accounts are ephemeral — anybody can materialize one from any genuine publisher-signed print from the last 60 seconds. A vault sitting just under its cap could therefore be pushed into `Quarantined` by replaying a print from a moment when it was over. No funds move, but the agent is locked out, and with no bond, fee, or cooldown the vault could be re-quarantined repeatedly.

The fix binds each consumed price to the slot that consumes it (`check_pyth_slot_lag`, ≤64 slots), so only the currently-live oracle shard can be used and the caller no longer gets to choose the print. Regression test: `test_pyth_slot_lag_rejects_replayed_ephemeral_update`.

**This fix is live on-chain, not just in source.** The deployed Devnet binary is SHA-256 identical to this repository — see [Program Version Boundary](../README.md#program-version-boundary).

---

### Q11: "Is there a state where the vault can never be recovered?"

**We found one and fixed it — also deployed.** `recover()` enforces two conditions: post-exposure must be strictly below pre-exposure, and the oversell guard requires post-exposure to stay within 500 bps of the cap. Those are mutually unsatisfiable when `pre_exposure < max_single_asset_bps − 500bps`.

`pre_exposure_bps` is recomputed from the **live price at recovery time**, not frozen at quarantine. So a vault quarantined at 3000 bps whose asset rallied back to 1800 bps would find that no `sell_units` value could ever satisfy both conditions — the permissionless solver path would be permanently unavailable and only the owner could release the vault.

The oversell guard now applies only when the vault is genuinely breaching its cap, which preserves it where it does useful work and restores liveness where the market has already repaired the position. Strict improvement is still required in every case, so containment can never *increase* risk.

One residual asymmetry worth stating: `RecoveryExpired` is effectively owner-only. `flag_violation` requires `Active` and `recover` requires `Quarantined`, so an expired vault can only be revived by `owner_release`. If the owner key were lost, the vault is frozen — there is no admin reset path.

---

### Q12: "Can the owner bypass the invariants?"

Yes, and deliberately so — a risk-control system the owner cannot override is not a portfolio tool, it is a loss of access.

- `owner_release` returns a `Quarantined` vault to `Active` **without verifying the portfolio is compliant**. It is an override, not a repair. A non-compliant release can be re-flagged, since `flag_violation` is permissionless.
- `owner_deposit` / `owner_withdraw` move real SPL custody. They do not re-check concentration and reserve after the movement; detection is post-hoc via `flag_violation`.
- `update_policy` is blocked during quarantine (enforced both in the instruction body and as an account constraint), so **the containment destination cannot be swapped mid-recovery** — this one is deliberately closed.
- Both `initialize_policy` and `update_policy` now reject degenerate configurations — a 100% concentration cap, bounds that cannot both be satisfied, or a cap at or below the oversell band — that would silently disable the guardrails or the quarantine mechanism entirely.

**What is enforced against the owner:** `sync_vault` requires an active policy (policies are frozen during quarantine, so ledger state cannot be rewritten mid-recovery), the vault must be `Active`, and every custody path asserts exact balance equality against the real SPL account. What is *not* enforced: the owner may write a non-compliant portfolio into the ledger — and that is deliberate. `sync_vault` reports reality; it does not choose it. Censoring a real violation there would stop the watcher from ever observing it.

---

### Q9: "How does this relate to Solana's Alpenglow upgrade?"

Sentinel is an application-layer risk engine and does not depend on Alpenglow today—it runs on the standard SVM transaction model on Devnet. However, Alpenglow's target of ~150 ms finality will make human-in-the-loop approvals impossible at high frequency, dramatically amplifying the blast radius of autonomous agent actions. Sentinel provides the deterministic, sub-second portfolio safety firewall required for autonomous agents to trade safely in the Alpenglow era. *(See `CLAIMS.md` §7 & `README.md`)*.
