export type StillImageProvider = 'pollinations' | 'openai' | 'perchance';

export type StillAdapterKind = 'pollinations' | 'openai-proxy' | 'openai-vault' | 'perchance';

/** Unset or unknown values stay on the free path so Generate works without a key. */
export function normalizeStillImageProvider(raw: unknown): StillImageProvider {
  if (raw === 'openai') return 'openai';
  if (raw === 'perchance') return 'perchance';
  return 'pollinations';
}

/** Pollinations and Perchance never consult a key. OpenAI uses the proxy when this host has one. */
export function stillAdapterKind(provider: StillImageProvider, useProxy: boolean): StillAdapterKind {
  if (provider === 'perchance') return 'perchance';
  if (provider !== 'openai') return 'pollinations';
  return useProxy ? 'openai-proxy' : 'openai-vault';
}
