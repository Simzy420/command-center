import { create } from 'zustand';
import { readJson, removeJson, writeJsonForced } from '@/store/persist';

const KEY = 'vault.openai';

interface StoredVault {
  key: string;
}

function loadKey(): string {
  const stored = readJson<StoredVault | null>(KEY, null);
  if (!stored || typeof stored.key !== 'string') return '';
  return stored.key.trim();
}

function hintFor(key: string): string {
  const t = key.trim();
  if (t.length < 8) return t ? 'saved' : '';
  return `…${t.slice(-4)}`;
}

interface VaultState {
  hasKey: boolean;
  hint: string;
  saveKey: (raw: string) => boolean;
  clearKey: () => void;
  /** In-memory only. Never log this value. */
  peekKey: () => string;
}

export const useVaultStore = create<VaultState>((set) => {
  const initial = loadKey();
  let secret = initial;
  return {
    hasKey: initial.length > 0,
    hint: hintFor(initial),
    saveKey: (raw) => {
      const next = raw.trim();
      if (!next) return false;
      secret = next;
      writeJsonForced(KEY, { key: next } satisfies StoredVault);
      set({ hasKey: true, hint: hintFor(next) });
      return true;
    },
    clearKey: () => {
      secret = '';
      removeJson(KEY);
      set({ hasKey: false, hint: '' });
    },
    peekKey: () => secret,
  };
});

export function readVaultOpenAiKey(): string {
  return useVaultStore.getState().peekKey();
}
