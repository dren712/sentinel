# Sentinel Robo — On-Chain Devnet Verification Gate (`docs/VERIFICATION.md`)

> **Authoritative Program**: `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH` (CWF build).
> Every signature listed below was confirmed on **Solana Devnet** and invoked **this program** — not the earlier `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK` Stocklana baseline build. See [`docs/cwf/DISCLOSURE.md`](cwf/DISCLOSURE.md) for the baseline history and [`docs/cwf/devnet-evidence.json`](cwf/devnet-evidence.json) for the machine-readable evidence record (program ID, cluster, Pyth feed, slots, signers, and post-recovery on-chain state).

---

## 1. Deployed Solana Devnet Accounts

| Artifact | Address | Explorer Link |
| :--- | :--- | :--- |
| **CWF Sentinel Anchor Program ID** | `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH` | [View Program](https://explorer.solana.com/address/3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH?cluster=devnet) |
| **Owner / Authority Wallet** *(lifecycle)* | `HJJo1z2MWcCPAwLF1qL22UiXczJ8UQg46WECDVCuMRVC` | [View Wallet](https://explorer.solana.com/address/HJJo1z2MWcCPAwLF1qL22UiXczJ8UQg46WECDVCuMRVC?cluster=devnet) |
| **Permissionless Solver Wallet** *(quarantine flow)* | `6H5nrFrvoWtAjUE5M8D5XXUU7W6JNzfPkGmytSyA9K2z` | [View Wallet](https://explorer.solana.com/address/6H5nrFrvoWtAjUE5M8D5XXUU7W6JNzfPkGmytSyA9K2z?cluster=devnet) |
| **PolicyAccount PDA** (`["policy", owner]`) | `7jzGugBwgFxFSMNoBbEPvCS4QAkVeFjAEuiqGojwGCGm` | [View Policy PDA](https://explorer.solana.com/address/7jzGugBwgFxFSMNoBbEPvCS4QAkVeFjAEuiqGojwGCGm?cluster=devnet) |
| **VaultAccount PDA** (`["vault", owner]`) | `DdaK1oEsBcCfsgyKoYbkhf8BkS927cRZDskvAvjJscrr` | [View Vault PDA](https://explorer.solana.com/address/DdaK1oEsBcCfsgyKoYbkhf8BkS927cRZDskvAvjJscrr?cluster=devnet) |
| **Pyth Devnet price account** (`PriceUpdateV2`) | `GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i` | [View Pyth Account](https://explorer.solana.com/address/GsZE13nr9acPWUHvpwnajtMzpctFyxfgquNsCnR2P52i?cluster=devnet) |

---

## 2. Confirmed Solana Devnet Transactions

### 2.1 Authoritative CWF Lifecycle (recorded in `docs/cwf/devnet-evidence.json`)

Executed end-to-end against `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH`, spanning slots `508591654` → `508591692`.

| Lifecycle Step | Slot | Transaction Signature | Explorer Link |
| :--- | :--- | :--- | :--- |
| **1. Initialize Policy (`initialize_policy`)** | `508591654` | `2FY3x93L3j8Uz1Xi5pMutSre8ekUJq12PVtG1udVptvzN4ejWpJUPeeBi779mCUi9Fn62vPikgDUaKcftawzfErQ` | [View TX](https://explorer.solana.com/tx/2FY3x93L3j8Uz1Xi5pMutSre8ekUJq12PVtG1udVptvzN4ejWpJUPeeBi779mCUi9Fn62vPikgDUaKcftawzfErQ?cluster=devnet) |
| **2. Initialize Vault (`initialize_vault`)** | `508591657` | `2oD6NEjxX5GSjnVFbaaicfzQtm4zNgUCYDBtBVg5bnEUQyhUcQfPBQnRwZJAaZHZpPbbYG66bPj9HLeQCnHB9RA3` | [View TX](https://explorer.solana.com/tx/2oD6NEjxX5GSjnVFbaaicfzQtm4zNgUCYDBtBVg5bnEUQyhUcQfPBQnRwZJAaZHZpPbbYG66bPj9HLeQCnHB9RA3?cluster=devnet) |
| **3. Seed Ledger (`sync_vault`)** | `508591661` | `21BeyKUNpLetFhRFxnRTkuw5vWUf2HPSwX7PG3NRBhJVsfZM2mGo5Rac1UVtw5e5THk2j1FBDNfayaCaXXTEULRi` | [View TX](https://explorer.solana.com/tx/21BeyKUNpLetFhRFxnRTkuw5vWUf2HPSwX7PG3NRBhJVsfZM2mGo5Rac1UVtw5e5THk2j1FBDNfayaCaXXTEULRi?cluster=devnet) |
| **4. First Flag — Pending Violation (`flag_violation`)** | `508591665` | `5vSfX1eqkgoEh6GBBAc9WPZi6YMkXkGoZQLV53hWj2ZnsRctC3vAoLx7QMswzFrTTnTsHrKiQXsbTt5VkrosSssf` | [View TX](https://explorer.solana.com/tx/5vSfX1eqkgoEh6GBBAc9WPZi6YMkXkGoZQLV53hWj2ZnsRctC3vAoLx7QMswzFrTTnTsHrKiQXsbTt5VkrosSssf?cluster=devnet) |
| **5. Second Flag — Quarantine Confirmed (`flag_violation`)** | `508591686` | `PDw3zefCFwawCf8K51vb1bCAGg3TQZ7nSah1ZRJg686BSJbYqZ8UV6okuy9cpvSpoFrFxrY5sSaJRHWhChJ6qpE` | [View TX](https://explorer.solana.com/tx/PDw3zefCFwawCf8K51vb1bCAGg3TQZ7nSah1ZRJg686BSJbYqZ8UV6okuy9cpvSpoFrFxrY5sSaJRHWhChJ6qpE?cluster=devnet) |
| **6. Bounded SPL Containment Recovery (`recover`)** | `508591692` | `2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob` | [View TX](https://explorer.solana.com/tx/2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob?cluster=devnet) |

**Post-recovery on-chain state** (re-read from the chain, not from client memory): `status = active`, `recovery_nonce = 2`, `last_recovery_slot = 508591692`, `last_recovery_solver = 6H5nrFrvoWtAjUE5M8D5XXUU7W6JNzfPkGmytSyA9K2z`, `usdc_balance_cents = 19976576`, `remaining_units = 22`.

### 2.2 Owner Release & Earlier Permissionless Flag Runs (same program)

| Lifecycle Step | Transaction Signature | Explorer Link |
| :--- | :--- | :--- |
| **Owner Release back to Active (`owner_release`)** | `2tQQYGDpnBqttytdnYQ9JoFsVZMAbi2bLvgyKzamYUgE7oYha7PP9Cf59uTiEYxQ73Mxg5rbZtwCELqYzurktEZd` | [View TX](https://explorer.solana.com/tx/2tQQYGDpnBqttytdnYQ9JoFsVZMAbi2bLvgyKzamYUgE7oYha7PP9Cf59uTiEYxQ73Mxg5rbZtwCELqYzurktEZd?cluster=devnet) |
| **Earlier permissionless flag run** (`flag_violation`, arbitrary signer) | `5TKzuF21Xn388WzuUso1sncDVmL2EyydqPae126LKrTNNtbWHVtTHmvhjDX5gTXdQfxCkZ3kxKricD2JNWaG8SPV` | [View TX](https://explorer.solana.com/tx/5TKzuF21Xn388WzuUso1sncDVmL2EyydqPae126LKrTNNtbWHVtTHmvhjDX5gTXdQfxCkZ3kxKricD2JNWaG8SPV?cluster=devnet) |
| **Earlier permissionless flag run** (`flag_violation`, quarantine confirmed) | `5ATh9GptcACZArsiq2ELbBvG3KKmAwtEHWyDVYFNvRhzSixLhYSuNbkuMHGsqNpEUHzZog4NbM6KvWsypjoyzTdK` | [View TX](https://explorer.solana.com/tx/5ATh9GptcACZArsiq2ELbBvG3KKmAwtEHWyDVYFNvRhzSixLhYSuNbkuMHGsqNpEUHzZog4NbM6KvWsypjoyzTdK?cluster=devnet) |

### 2.3 What these signatures demonstrate

The quarantine / containment state machine is unchanged between the deployed build and current source:

- **Hysteresis is real**: steps 4 → 5 are two distinct, separated `flag_violation` transactions 21 slots apart, proving `pending_violation_slot` → `Quarantined` is not a single-transaction flip.
- **Flagging is permissionless**: steps 4, 5 and the `recover` in step 6 were all signed by solver wallet `6H5nrFrv…`, which is **not** the vault owner `HJJo1z2M…`.
- **Containment is a real SPL transfer**: `recover` executed a program-signed `TransferChecked` CPI out of vault PDA custody to the owner's `safe_destination` — no DEX swap, no simulated receipt.

---

## 3. Reproducible Verification Commands

```bash
# 1. Run the complete TypeScript test suite (SDK 110 + Domain 39 = 149)
pnpm test

# 2. Run the slot-warped Bankrun state-machine suites
node --experimental-strip-types --test tests/bankrun-quarantine.test.ts   # 13
node --experimental-strip-types --test tests/bankrun-recovery.test.ts     # 26
node --experimental-strip-types --test tests/remediation-security.test.ts # 26

# 3. Run the Anchor localnet integration suite (20)
node --test tests/sentinel-localnet.test.ts

# 4. Run Rust Anchor program unit tests (30)
cargo test --manifest-path programs/sentinel/Cargo.toml

# 5. Build all workspace packages & Next.js production bundle
pnpm build
```

Or run the canonical aggregate, which chains 1–3 via `Anchor.toml` `[scripts] test`:

```bash
anchor test
```

**Total: 264 automated tests** — 110 SDK, 39 Domain, 26 Bankrun recovery, 13 Bankrun quarantine, 26 remediation security, 20 localnet, 30 Rust.

---

## 4. Superseded Baseline Evidence

The following signatures belong to the **pre-CWF baseline program** `3gh1Cc2Qc65hJhxZKneXphWJa27z5adyFayc9kWEvAJK` and are retained only as the "What Existed Before" provenance record in [`docs/cwf/DISCLOSURE.md`](cwf/DISCLOSURE.md) and [`docs/DEMO.md`](DEMO.md). They do **not** exercise the CWF quarantine/containment build:

`5FStukmor…` (`initialize_policy`), `3h9Gjcxj…` (`initialize_agent`), `3gD1hqUw…` (`initialize_vault`), `3THaeBEj…` (`create_promise`), `Yj4VQjWB…` (rejected `$15K` trade), `424aJbYW…` (settled `$5K` trade), `hZFTL14Y…` (`record_evidence`).