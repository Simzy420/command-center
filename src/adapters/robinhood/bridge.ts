import { resolveChatApiBase } from '@/adapters/chat/bridge';
import { normalizeSnapshot, type RobinhoodSnapshot } from './snapshot';

/** Origin of the snapshot bridge. Unset follows the chat Space (vault → env → default). */
export function resolveRobinhoodApiBase(): string {
  const env = (import.meta.env.VITE_ROBINHOOD_API_BASE ?? '').trim().replace(/\/$/, '');
  if (env) return env;
  return resolveChatApiBase();
}

export function robinhoodSnapshotUrl(base = resolveRobinhoodApiBase()): string {
  if (/\/api\/robinhood$/.test(base)) return base;
  return `${base}/api/robinhood`;
}

async function readError(res: Response): Promise<string> {
  if (res.status === 404) {
    return 'Snapshot bridge has no /api/robinhood route yet. Update the chat Space, then retry.';
  }
  const raw = await res.text().catch(() => '');
  try {
    const parsed = raw ? (JSON.parse(raw) as { error?: string; detail?: unknown }) : {};
    if (typeof parsed.error === 'string' && parsed.error) return parsed.error;
    if (typeof parsed.detail === 'string' && parsed.detail) return parsed.detail;
  } catch {
    /* not json */
  }
  return raw.slice(0, 240) || `Snapshot bridge HTTP ${res.status}`;
}

export async function fetchRobinhoodSnapshot(url = robinhoodSnapshotUrl()): Promise<RobinhoodSnapshot | null> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'GET', cache: 'no-store' });
  } catch {
    throw new Error('Could not reach the snapshot bridge. Check the chat Space URL.');
  }
  if (!res.ok) throw new Error(await readError(res));
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error('Snapshot bridge returned an unreadable response.');
  }
  if (!data || typeof data !== 'object') return null;
  const snapshot = (data as { snapshot?: unknown }).snapshot;
  if (snapshot == null) return null;
  const normalized = normalizeSnapshot(snapshot);
  if (!normalized) throw new Error('Snapshot bridge returned an unreadable portfolio.');
  return normalized;
}
