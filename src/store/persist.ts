const PREFIX = 'cc.v1.';

let persistEnabled = true;

export function setPersistEnabled(on: boolean) {
  persistEnabled = on;
}

export function isPersistEnabled(): boolean {
  return persistEnabled;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  if (!persistEnabled) return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

/** Always write (used for on-device secrets the user explicitly saved). */
export function writeJsonForced(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function removeJson(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
