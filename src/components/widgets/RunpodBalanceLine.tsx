import { useEffect, useState } from 'react';
import { fetchRunpodBalance, formatUsd, type RunpodBalance } from '@/adapters/runpod/balance';

/** Compact RunPod credit line for the image generator, above the model buttons. */
export function RunpodBalanceLine() {
  const [balance, setBalance] = useState<RunpodBalance | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchRunpodBalance().then((next) => {
      if (!cancelled) setBalance(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (balance === undefined) {
    return (
      <p className="mb-2 text-center text-[11px] uppercase tracking-widest text-white/45" data-runpod-balance="loading">
        RunPod …
      </p>
    );
  }

  if (!balance) {
    return (
      <p className="mb-2 text-center text-[11px] uppercase tracking-widest text-white/45" data-runpod-balance="missing">
        RunPod balance unavailable
      </p>
    );
  }

  const color = balance.balance > 10 ? '#3fb950' : balance.balance > 3 ? '#d29922' : '#f85149';
  const hours = balance.hoursLeft != null ? ` · ~${balance.hoursLeft} hrs` : '';

  return (
    <p className="mb-2 text-center text-[11px] uppercase tracking-widest text-white/70" data-runpod-balance="live">
      RunPod <span className="font-mono text-sm font-bold normal-case" style={{ color }}>{formatUsd(balance.balance)}</span>
      <span className="text-white/45"> · {formatUsd(balance.spendPerHr)}/hr{hours}</span>
    </p>
  );
}
