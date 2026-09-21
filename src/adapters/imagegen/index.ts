import type { ImageGenAdapter } from './types';
import { openaiProxyAdapter, openaiVaultAdapter, shouldUseImageProxy } from './openai';
import { pollinationsImageAdapter } from './pollinations';
import { readVaultOpenAiKey } from '@/store/vaultStore';

export function getImageGenAdapter(): ImageGenAdapter {
  if (shouldUseImageProxy()) return openaiProxyAdapter;
  if (readVaultOpenAiKey()) return openaiVaultAdapter;
  return pollinationsImageAdapter;
}

export function imageGenProviderLabel(): string {
  return getImageGenAdapter().label;
}

export { mockImageAdapter } from './mock';
export { pollinationsImageAdapter } from './pollinations';
export { openaiVaultAdapter, openaiProxyAdapter, shouldUseImageProxy } from './openai';

export type { ImageGenAdapter, GeneratedImage, ImageGenInput, ImagePreview } from './types';
