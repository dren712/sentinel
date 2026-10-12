# Sentinel Robo — Adversarial Security Matrix (`docs/SECURITY.md`)

Sentinel's core technical proof is not just that valid trades succeed—it is that **no unauthorized, malformed, stale, or non-compliant intent can bypass the Sentinel boundary**.

Run the 11-vector adversarial suite directly:

```bash
pnpm --filter @sentinel/sdk test
```

Test implementation: [`packages/sdk/tests/adversarial-security.test.ts`](../packages/sdk/tests/adversarial-security.test.ts)

## 11-Vector Attack Matrix + 1 Positive Control

Identifiers below are the **real, in-code** codes. Off-chain policy failures use the `SecurityViolationError.code` strings and the `FailureCode` union in [`packages/domain/src/types.ts`](../packages/domain/src/types.ts); on-chain failures use the `#[error_code]` enum in [`programs/sentinel/src/errors.rs`](../programs/sentinel/src/errors.rs) (Anchor assigns codes from `6000`).

| Vector | Attack Scenario | Target Layer | Expected & Verified Outcome |
| :--- | :--- | :--- | :--- |
| **Attack 1** | Direct adapter call without a `SentinelAuthorizationTicket` | `ExecutionAdapter` | Throws `SecurityViolationError` with code `BYPASS_ATTEMPT` (`packages/sdk/src/adapters/execution-adapter.ts:227`) |
| **Attack 2** | Tampering with `tradeAmountUsd` (`$5,000 → $15,000`) after ticket issuance | `SHA-256 IntentHash` | Throws `SecurityViolationError` with code `INVALID_TICKET` on intent-hash mismatch (`execution-adapter.ts:244`) |
| **Attack 3** | Replay of an expired `SentinelAuthorizationTicket` (`expiresAt < now`) | `Ticket TTL Guard` | Throws `SecurityViolationError` with code `EXPIRED_TICKET` (`execution-adapter.ts:235`) |
| **Attack 4** | Unauthorized rogue agent (`rogue-agent-99` / wrong Ed25519 signer) | `AuthorityVerifier` | Blocked — PDA composition fails (`packages/sdk/tests/split-keys.test.ts`); on-chain equivalent is `UnauthorizedAgent` (Anchor `6005`, `lib.rs:1104`) |
| **Attack 5** | Concentration breach (`BUY $15,000 NVDAx`, `20% → 35% > 25%` cap) | `PolicyVerifier` | Blocked (`ERR_EXPOSURE_EXCEEDED`, `packages/domain/src/policy-engine.ts:176`; on-chain `ExposureExceeded` Anchor `6000`, `lib.rs:1257`) |
| **Attack 6** | Reserve depletion (`BUY $8,000 AAPLx` when `USDC` drops to `17% < 20%` floor) | `SolvencyVerifier` | Blocked (`ERR_STABLECOIN_RESERVE_BREACHED`, `packages/domain/src/policy-engine.ts:198`; on-chain `StablecoinReserveBreached` Anchor `6001`, `lib.rs:1269`) |
| **Attack 7** | Single-trade size breach (`BUY $12,000 > $10,000` ceiling) | `PolicyVerifier` | Blocked (`ERR_TRADE_SIZE_EXCEEDED`, `packages/domain/src/policy-engine.ts:220`; on-chain `TradeSizeExceeded` Anchor `6002`, `lib.rs:1294`) |
| **Attack 8** | Stale Pyth oracle quote (`ageSeconds = 185s > 60s` limit) | `PriceIntegrityVerifier` | Blocked (`ERR_QUOTE_STALE`, `packages/domain/src/policy-engine.ts:722`; on-chain `StaleOracle` Anchor `6022`, `lib.rs:1128` / `lib.rs:1159`) |
| **Attack 9** | Excessive Pyth confidence spread (`±$4.50` / `375 bps > 100 bps` limit) | `PriceIntegrityVerifier` | Blocked (`ERR_ORACLE_CONFIDENCE_TOO_WIDE`, `packages/domain/src/policy-engine.ts:985`, `packages/domain/src/swarm-verifiers.ts:391`; on-chain `ConfidenceTooWide` Anchor `6023`) |
| **Attack 10** | Shallow Meteora DBC pool (`$14,000 < $25,000` minimum liquidity floor) | `LiquidityVerifier` | Blocked (`ERR_LIQUIDITY_DEPTH_INSUFFICIENT`, `packages/domain/src/swarm-verifiers.ts:295`); price-deviation path uses `ERR_PRICE_IMPACT_EXCEEDED` (`policy-engine.ts:754`) |
| **Attack 11** | Emergency Pause kill-switch active (`isEmergencyPaused = true`) | `PolicyEngine` | Immediately halts execution (`ERR_EMERGENCY_PAUSE`, `packages/domain/src/policy-engine.ts:410`; on-chain equivalent `AgentInactive` Anchor `6014` via `set_agent_active` / `check_agent_active`) |
| **Control 12** | Adapted compliant trade (`BUY $5,000 NVDAx`, `20% → 25%`, `USDC 20%`) | `Full Pipeline` | **✓ Settled** with cryptographic PROVN receipt |
