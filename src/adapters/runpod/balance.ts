export interface RunpodBalance {
  balance: number;
  spendPerHr: number;
  hoursLeft: number | null;
  updated: string;
}

/** The trading cron writes this file. Both hosts read it directly so a refresh does not wait on a redeploy. */
export const RUNPOD_BALANCE_URL =
  'https://raw.githubusercontent.com/Simzy420/command-center/main/public/runpod-balance.json';

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export async function fetchRunpodBalance(): Promise<RunpodBalance | null> {
  try {
    const res = await fetch(`${RUNPOD_BALANCE_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<RunpodBalance>;
    if (typeof json.balance !== 'number') return null;
    return {
      balance: json.balance,
      spendPerHr: typeof json.spendPerHr === 'number' ? json.spendPerHr : 0,
      hoursLeft: typeof json.hoursLeft === 'number' ? json.hoursLeft : null,
      updated: typeof json.updated === 'string' ? json.updated : '',
    };
  } catch {
    return null;
  }
}
