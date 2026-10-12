'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Play, ExternalLink, ShieldCheck, Radio, Copy, Check } from 'lucide-react';
import { APP_CONFIG, getExplorerAddressUrl } from '@/lib/config';

interface LandingViewProps {
  onEnterApp: () => void;
  onRunDemo: () => void;
  isRunningDemo?: boolean;
}

const EXPLORER = 'https://explorer.solana.com';

/**
 * Every signature below was verified against https://api.devnet.solana.com:
 * each invoked the authoritative CWF program and committed successfully.
 * Nothing on this page is a projected, simulated, or synthetic figure.
 */
const PROOF_TX = [
  {
    step: '01',
    instruction: 'initialize_policy',
    detail: 'Owner commits risk bounds on-chain',
    sig: '2FY3x93L3j8Uz1Xi5pMutSre8ekUJq12PVtG1udVptvzN4ejWpJUPeeBi779mCUi9Fn62vPikgDUaKcftawzfErQ',
  },
  {
    step: '02',
    instruction: 'initialize_vault',
    detail: 'Vault PDA bound to policy and agent',
    sig: '2oD6NEjxX5GSjnVFbaaicfzQtm4zNgUCYDBtBVg5bnEUQyhUcQfPBQnRwZJAaZHZpPbbYG66bPj9HLeQCnHB9RA3',
  },
  {
    step: '03',
    instruction: 'flag_violation',
    detail: 'Permissionless watcher records pending violation',
    sig: '5vSfX1eqkgoEh6GBBAc9WPZi6YMkXkGoZQLV53hWj2ZnsRctC3vAoLx7QMswzFrTTnTsHrKiQXsbTt5VkrosSssf',
  },
  {
    step: '04',
    instruction: 'flag_violation',
    detail: 'Hysteresis met — vault Quarantined, agent authority revoked',
    sig: 'PDw3zefCFwawCf8K51vb1bCAGg3TQZ7nSah1ZRJg686BSJbYqZ8UV6okuy9cpvSpoFrFxrY5sSaJRHWhChJ6qpE',
  },
  {
    step: '05',
    instruction: 'recover',
    detail: 'Program-signed SPL CPI containment — vault returns to Active',
    sig: '2zUD46Fqo6NrzVh5E6Er9HZU9bfJZtHcFz62cchtQs1XR8bDM1WhKbRZTygJY4gyhJphRT2X2MUmWnUc4bZiWBob',
  },
] as const;

/** Enforced inside the SVM. Codes are real and resolve to programs/sentinel/src/errors.rs */
const INVARIANTS = [
  {
    bound: 'max_single_asset_bps',
    meaning: 'Post-trade concentration ceiling',
    code: 'ExposureExceeded',
    num: '6000',
  },
  {
    bound: 'min_stablecoin_bps',
    meaning: 'Stablecoin reserve floor',
    code: 'StablecoinReserveBreached',
    num: '6001',
  },
  {
    bound: 'max_trade_value_usd',
    meaning: 'Per-trade notional cap',
    code: 'TradeSizeExceeded',
    num: '6002',
  },
  {
    bound: 'Pyth PriceUpdateV2',
    meaning: '≤60s publish age · ≤200bps conf · ≤64 slot lag',
    code: 'StaleOracle',
    num: '6022',
  },
] as const;

/** Stated plainly. Credibility comes from the gaps, not the claims. */
const BOUNDARY = [
  { label: 'Invariant enforcement inside the SVM', state: 'real' },
  { label: 'Quarantine state machine + agent lockout', state: 'real' },
  { label: 'Program-signed SPL containment transfer', state: 'real' },
  { label: 'Replay protection via recovery nonce', state: 'real' },
  { label: 'DEX execution / swap routing', state: 'none' },
  { label: 'Selling or liquidating contained assets', state: 'none' },
  { label: 'On-chain SHA-256 evidence verification', state: 'none' },
  { label: 'Liquidity and price-impact admission checks', state: 'offchain' },
] as const;

const BOUNDARY_STYLE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  real: {
    label: 'On-chain',
    color: 'var(--sentinel-success)',
    bg: 'var(--sentinel-success-subtle)',
    border: 'rgba(16,185,129,0.3)',
  },
  offchain: {
    label: 'Off-chain',
    color: 'var(--sentinel-warning)',
    bg: 'var(--sentinel-warning-subtle)',
    border: 'rgba(245,158,11,0.3)',
  },
  none: {
    label: 'Not implemented',
    color: 'var(--sentinel-text-subtle)',
    bg: 'transparent',
    border: 'var(--sentinel-border)',
  },
};

function shortSig(sig: string) {
  return `${sig.slice(0, 6)}…${sig.slice(-4)}`;
}

const INTEGRATE_SNIPPET = `import { LiveExecutionAdapter, requiredRecoveryUnits } from '@sentinel/sdk';

const adapter = new LiveExecutionAdapter({
  rpcEndpoint: 'https://api.devnet.solana.com',
  ownerSigner: ownerKeypair,   // policy + custody authority
  agentSigner: agentKeypair,   // proposal authority only
  programId: '3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH',
});

// Any caller can quarantine a breaching vault (permissionless).
await adapter.flagViolation({
  vaultOwner: ownerPubkey,
  priceUpdateAccount: pythPriceUpdate,
});

// Any caller can run the recovery. Solves the minimal sell units, then
// moves tokens via the program's own signed SPL CPI.
const plan = requiredRecoveryUnits(vaultState, policy, { mode: 'custody' });

await adapter.recover({
  vaultOwner: ownerPubkey,
  sellUnits: plan.sellUnits,
  expectedNonce: vault.recoveryNonce,
  priceUpdatePubkey: pythPriceUpdate,
  custodyAccounts,   // vault ATA, safe-destination ATA, mint, token program
});`;

/**
 * Robo-01 — the autonomous agent.
 *
 * Design intent: Robo-01 belongs to the *fluid* half of the system. It is the
 * only thing on this page that drifts and reacts. The on-chain rails below it
 * are static, tabular, and rigid. The visual contrast between the two columns
 * is the thesis, not decoration.
 */
function RoboMascot({ onRun, isRunning }: { onRun: () => void; isRunning: boolean }) {
  return (
    <div className="lg:col-span-5">
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning}
        aria-label="Run the decision-cycle demo"
        aria-busy={isRunning}
        className="sentinel-focus sentinel-interactive relative flex aspect-square w-full max-w-[288px] items-center justify-center rounded-2xl"
        style={{ background: 'var(--sentinel-surface)', border: '1px solid var(--sentinel-border)' }}
      >
        <Image
          src="/robo-512.png"
          alt="Robo-01, Sentinel's autonomous portfolio agent"
          width={256}
          height={213}
          priority
          className="sentinel-robo-drift h-auto w-[72%] select-none object-contain"
        />
        <span
          className="absolute bottom-3 left-3 rounded px-2 py-1"
          style={{
            background: 'var(--sentinel-surface-elevated)',
            border: '1px solid var(--sentinel-border)',
          }}
        >
          <span className="type-micro-label tabular-nums">ROBO-01</span>
        </span>
        <span
          className="type-micro-label absolute bottom-3 right-3 tabular-nums"
          style={{
            color: isRunning ? 'var(--sentinel-warning)' : 'var(--sentinel-text-subtle)',
          }}
        >
          {isRunning ? 'RUNNING' : 'CLICK TO RUN'}
        </span>
      </button>

      <p className="type-body mt-4 max-w-sm">
        Robo-01 holds{' '}
        <strong className="font-semibold text-[var(--sentinel-text)]">proposal authority only</strong>.
        Every trade it proposes is checked on-chain before it can touch a vault.
      </p>
    </div>
  );
}

export const LandingView: React.FC<LandingViewProps> = ({
  onEnterApp,
  onRunDemo,
  isRunningDemo = false,
}) => {
  const shortProgram = `${APP_CONFIG.sentinelProgramId.slice(0, 4)}…${APP_CONFIG.sentinelProgramId.slice(-4)}`;

const [copied, setCopied] = useState(false);
const [copyState, setCopyState] = useState<'idle' | 'ok' | 'error'>('idle');

const copySnippet = async () => {
  try {
    await navigator.clipboard.writeText(INTEGRATE_SNIPPET);
    setCopyState('ok');
    setCopied(true);
  } catch {
    setCopyState('error');
  }
  window.setTimeout(() => {
    setCopied(false);
    setCopyState('idle');
  }, 2000);
};

  return (
    <div className="w-full pb-24">
      {/* ───────────────────────────── HERO ───────────────────────────── */}
      <section className="px-4 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <RoboMascot onRun={onRunDemo} isRunning={isRunningDemo} />
          <div className="lg:col-span-7">
          <div className="flex items-center gap-2">
            <span
              className="type-micro-label inline-flex items-center gap-1.5 rounded px-2 py-1"
              style={{
                color: 'var(--sentinel-devnet)',
                background: 'var(--sentinel-devnet-subtle)',
              }}
            >
              <Radio size={11} aria-hidden />
              Solana Devnet · Live
            </span>
            <a
              href={getExplorerAddressUrl(APP_CONFIG.sentinelProgramId)}
              target="_blank"
              rel="noopener noreferrer"
              className="type-metadata sentinel-focus rounded px-1.5 py-1 transition-colors duration-150 hover:text-[var(--sentinel-text)]"
              style={{ color: 'var(--sentinel-text-subtle)' }}
            >
              {shortProgram}
              <ExternalLink size={10} className="ml-1 inline" aria-hidden />
            </a>
          </div>

          <h1 className="type-display mt-6 max-w-4xl" style={{ letterSpacing: '-0.03em' }}>
            Intelligence is fluid.
            <br />
            <span style={{ color: 'var(--sentinel-text-muted)' }}>Enforcement is rigid.</span>
          </h1>

          <p className="type-body mt-5 max-w-2xl text-[0.9375rem] leading-6">
            Autonomous agents propose. Sentinel decides what is structurally possible. Portfolio
            risk bounds are verified on-chain against a pinned Pyth feed, and a breached vault is
            quarantined and contained by anyone — not by the agent that caused the problem.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRunDemo}
              disabled={isRunningDemo}
              aria-busy={isRunningDemo}
              className="sentinel-btn-physical sentinel-focus sentinel-interactive inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed"
              style={{
                background: isRunningDemo ? 'var(--sentinel-accent-hover)' : 'var(--sentinel-accent)',
                color: '#fff',
                opacity: isRunningDemo ? 0.75 : 1,
              }}
            >
              {isRunningDemo ? (
                <>
                  <span
                    className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  Running decision cycle
                </>
              ) : (
                <>
                  <Play size={15} aria-hidden />
                  Run the decision-cycle demo
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onEnterApp}
              className="sentinel-btn-physical sentinel-focus sentinel-interactive inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold"
              style={{
                background: 'var(--sentinel-surface)',
                border: '1px solid var(--sentinel-border-strong)',
                color: 'var(--sentinel-text)',
              }}
            >
              Open portfolio
              <ArrowRight size={15} aria-hidden />
            </button>
          </div>

          <p className="type-metadata mt-4">
            264 automated tests · 65 executing the real program binary in-process · no
            third-party audit
          </p>
          </div>
        </div>
      </section>

      {/* ──────────────────── THE DIVIDING LINE (core thesis) ──────────── */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          <div
            className="rounded-lg p-6"
            style={{ background: 'var(--sentinel-surface)', border: '1px solid var(--sentinel-border)' }}
          >
            <div className="type-micro-label">Off-chain — advisory</div>
            <h2 className="type-section mt-3">Prompt, heuristic, simulation</h2>
            <p className="type-body mt-2.5">
              Anything evaluated outside the SVM is a suggestion. It can be stale, it can be
              wrong, and it cannot stop a transaction that has already been signed.
            </p>
          </div>

          <div
            className="rounded-lg p-6"
            style={{
              background: 'var(--sentinel-surface-elevated)',
              border: '1px solid var(--sentinel-border-strong)',
            }}
          >
            <div
              className="type-micro-label"
              style={{ color: 'var(--sentinel-success)' }}
            >
              On-chain — enforced
            </div>
            <h2 className="type-section mt-3 flex items-center gap-2">
              <ShieldCheck size={18} style={{ color: 'var(--sentinel-success)' }} aria-hidden />
              Transaction-level postconditions
            </h2>
            <p className="type-body mt-2.5">
              Every invariant is recomputed from the post-mutation vault state, not from a
              projection, and the transaction reverts atomically if any bound is exceeded.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────── ENFORCED BOUNDS ─────────────────────────── */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="type-section">What the program actually checks</h2>
          <p className="type-body mt-2">
            Every rejection below is an on-chain revert with a real Anchor error code.
          </p>

          <div
            className="mt-5 overflow-hidden rounded-lg"
            style={{ background: 'var(--sentinel-surface)', border: '1px solid var(--sentinel-border)' }}
          >
            <ul>
              {INVARIANTS.map((inv, i) => (
                <li
                  key={inv.bound}
                  className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid var(--sentinel-border)',
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="tabular-nums text-sm font-semibold"
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                    >
                      {inv.bound}
                    </div>
                    <div className="type-body mt-1">{inv.meaning}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="type-micro-label">{inv.code}</span>
                    <span
                      className="tabular-nums rounded px-1.5 py-0.5 text-xs font-semibold"
                      style={{
                        color: 'var(--sentinel-danger)',
                        background: 'var(--sentinel-danger-subtle)',
                      }}
                    >
                      {inv.num}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────────────── PROOF: REAL TRANSACTIONS ─────────────────── */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="type-section">The lifecycle, executed on-chain</h2>
              <p className="type-body mt-2 max-w-2xl">
                Five real Devnet transactions against program{' '}
                <span
                  className="tabular-nums"
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                >
                  {shortProgram}
                </span>
                . Each link opens the Solana Explorer.
              </p>
            </div>
            <Link
              href="/quarantine"
              className="sentinel-focus sentinel-interactive inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-semibold"
              style={{ color: 'var(--sentinel-accent)' }}
            >
              Live quarantine terminal
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>

          <ol className="mt-6 space-y-2.5">
            {PROOF_TX.map((tx) => (
              <li key={tx.sig}>
                <a
                  href={`${EXPLORER}/tx/${tx.sig}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sentinel-focus sentinel-interactive group flex items-start gap-4 rounded-lg p-4 hover:bg-[var(--sentinel-surface-elevated)]"
                  style={{
                    background: 'var(--sentinel-surface)',
                    border: '1px solid var(--sentinel-border)',
                  }}
                >
                  <span
                    className="type-micro-label tabular-nums shrink-0 pt-0.5"
                    style={{ color: 'var(--sentinel-text-subtle)' }}
                  >
                    {tx.step}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-sm font-semibold"
                      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                    >
                      {tx.instruction}
                    </span>
                    <span className="type-body mt-1 block">{tx.detail}</span>
                  </span>

                  <span
                    className="type-metadata hidden shrink-0 items-center gap-1.5 pt-1 sm:flex"
                    style={{ color: 'var(--sentinel-text-subtle)' }}
                  >
                    {shortSig(tx.sig)}
                    <ExternalLink
                      size={11}
                      className="transition-colors duration-150 group-hover:text-[var(--sentinel-text)]"
                      aria-hidden
                    />
                  </span>
                </a>
              </li>
            ))}
          </ol>

          <div
            className="mt-4 rounded-lg p-5"
            style={{ background: 'var(--sentinel-surface-muted)', border: '1px solid var(--sentinel-border)' }}
          >
            <div className="type-micro-label">VaultStatus enum · plus a pending flag</div>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
              {['Active', 'PendingViolation', 'Quarantined', 'Active', 'RecoveryExpired'].map(
                (s, i) => (
                  <React.Fragment key={`${s}-${i}`}>
                    {i > 0 && (
                      <span
                        className="type-metadata"
                        style={{ color: 'var(--sentinel-text-subtle)' }}
                        aria-hidden
                      >
                        →
                      </span>
                    )}
                    <span
                      className="tabular-nums rounded px-2 py-1 text-xs font-semibold"
                      style={{
                        color:
                          s === 'Quarantined'
                            ? 'var(--sentinel-danger)'
                            : s === 'PendingViolation'
                              ? 'var(--sentinel-warning)'
                              : s === 'RecoveryExpired'
                                ? 'var(--sentinel-text-subtle)'
                                : 'var(--sentinel-success)',
                        background:
                          s === 'Quarantined'
                            ? 'var(--sentinel-danger-subtle)'
                            : s === 'PendingViolation'
                              ? 'var(--sentinel-warning-subtle)'
                              : s === 'RecoveryExpired'
                                ? 'transparent'
                                : 'var(--sentinel-success-subtle)',
                        border: '1px solid var(--sentinel-border)',
                      }}
                    >
                      {s}
                    </span>
                  </React.Fragment>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── INTEGRATION SURFACE ────────────────────── */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="type-section">Integrate</h2>
              <p className="type-body mt-2 max-w-2xl">
                Sentinel is a program first. Any Anchor client can call it with the program ID and
                the IDL. The TypeScript SDK wraps the same instructions with split-key enforcement
                and the recovery solver.
              </p>
            </div>
            <a
              href="https://github.com/dren712/sentinel_finance"
              target="_blank"
              rel="noopener noreferrer"
              className="sentinel-focus sentinel-interactive inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-sm font-semibold"
              style={{ color: 'var(--sentinel-accent)' }}
            >
              github.com/dren712/sentinel_finance
              <ExternalLink size={14} aria-hidden />
            </a>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            <div
              className="overflow-hidden rounded-lg lg:col-span-3"
              style={{ background: 'var(--sentinel-surface)', border: '1px solid var(--sentinel-border)' }}
            >
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: '1px solid var(--sentinel-border)' }}
              >
                <span className="type-micro-label">quarantine.ts</span>
                <button
                  type="button"
                  onClick={() => copySnippet()}
                  className="sentinel-focus sentinel-interactive inline-flex items-center gap-1.5 rounded px-2 py-1"
                  style={{
                    color:
                      copyState === 'error'
                        ? 'var(--sentinel-danger)'
                        : copied
                          ? 'var(--sentinel-success)'
                          : 'var(--sentinel-text-subtle)',
                  }}
                  aria-label={copied ? 'Copied' : 'Copy snippet'}
                >
                  {copyState === 'error' ? (
                    <span className="type-micro-label">Copy failed</span>
                  ) : (
                    <>
                      {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                      <span className="type-micro-label">{copied ? 'Copied' : 'Copy'}</span>
                    </>
                  )}
                </button>
              </div>
              <pre
                className="overflow-x-auto px-4 py-4 text-[0.75rem] leading-5"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'var(--sentinel-text-muted)' }}
              >
                <code>{INTEGRATE_SNIPPET}</code>
              </pre>
            </div>

            <div className="lg:col-span-2">
              <div
                className="rounded-lg p-5"
                style={{ background: 'var(--sentinel-surface)', border: '1px solid var(--sentinel-border)' }}
              >
                <div className="type-micro-label">Two ways in</div>

                <div className="mt-4 space-y-4">
                  <div>
                    <div className="type-subsection">Direct — any client</div>
                    <p className="type-body mt-1">
                      Point an Anchor client at program{' '}
                      <span
                        className="tabular-nums"
                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                      >
                        {shortProgram}
                      </span>{' '}
                      with the IDL from <span className="font-mono">target/idl</span>. No dependency
                      on Sentinel beyond the generated types.
                    </p>
                  </div>

                  <div>
                    <div className="type-subsection">SDK — TypeScript</div>
                    <p className="type-body mt-1">
                      <span
                        className="tabular-nums"
                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                      >
                        @sentinel/sdk
                      </span>{' '}
                      ships the execution adapter, permissionless watcher and solver daemons, the
                      SPL custody helpers, and the recovery solver.
                    </p>
                  </div>
                </div>

                <div
                  className="mt-5 rounded px-3 py-2.5"
                  style={{ background: 'var(--sentinel-warning-subtle)', border: '1px solid rgba(245,158,11,0.3)' }}
                >
                  <p className="text-xs leading-5" style={{ color: 'var(--sentinel-warning)' }}>
                    The packages are configured for public release but are <strong>not yet published
                    to npm</strong>. Install from the repository for now.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────── CAPABILITY BOUNDARY ─────────────────────── */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="type-section">Capability boundary</h2>
          <p className="type-body mt-2 max-w-2xl">
            A containment transfer moves assets out of the strategy vault. It does not recover
            lost money, does not reduce the owner&apos;s total market exposure, and does not sell
            anything. This is the honest edge of the system.
          </p>

          <div
            className="mt-5 overflow-hidden rounded-lg"
            style={{ background: 'var(--sentinel-surface)', border: '1px solid var(--sentinel-border)' }}
          >
            <ul>
              {BOUNDARY.map((row, i) => {
                const s = BOUNDARY_STYLE[row.state];
                return (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--sentinel-border)',
                    }}
                  >
                    <span className="type-body text-[var(--sentinel-text)]">{row.label}</span>
                    <span
                      className="type-micro-label shrink-0 rounded px-2 py-1"
                      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
                    >
                      {s.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────────────────────────── CLOSING ─────────────────────────── */}
      <section className="mt-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div
            className="rounded-lg p-8 text-center"
            style={{ background: 'var(--sentinel-surface)', border: '1px solid var(--sentinel-border)' }}
          >
            <h2 className="type-section">Break the invariant. Watch the chain refuse.</h2>
            <p className="type-body mx-auto mt-3 max-w-xl">
              The Devnet Lab lets you seed a vault, induce a breach, quarantine it, and execute a
              real SPL containment transfer — then inspect every account it touched.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/lab"
                className="sentinel-btn-physical sentinel-focus sentinel-interactive inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold"
                style={{ background: 'var(--sentinel-accent)', color: '#fff' }}
              >
                Open Devnet Lab
                <ArrowRight size={15} aria-hidden />
              </Link>
              <Link
                href="/quarantine"
                className="sentinel-btn-physical sentinel-focus sentinel-interactive inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold"
                style={{
                  background: 'var(--sentinel-surface-elevated)',
                  border: '1px solid var(--sentinel-border-strong)',
                  color: 'var(--sentinel-text)',
                }}
              >
                Quarantine terminal
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};