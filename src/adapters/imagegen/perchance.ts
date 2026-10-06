import { uid } from '@/lib/ids';
import type { GeneratedImage, ImageGenAdapter, ImageGenInput } from './types';
import { isPerchanceImageUrl } from './perchanceUrl';

async function requestPerchanceImage(prompt: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/perchance-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
  } catch {
    throw new Error('This host could not reach the Perchance generator. Use Open on Perchance.org.');
  }
  const raw = await res.text();
  let data: { url?: unknown; error?: unknown } = {};
  try {
    data = JSON.parse(raw) as { url?: unknown; error?: unknown };
  } catch {
    throw new Error('This host has no Perchance generator. Use Open on Perchance.org.');
  }
  if (!res.ok) {
    const message = typeof data.error === 'string' ? data.error : 'Perchance image generation failed.';
    throw new Error(message);
  }
  if (typeof data.url !== 'string' || !isPerchanceImageUrl(data.url)) {
    throw new Error('Perchance returned no image URL.');
  }
  return data.url;
}

export const perchanceImageAdapter: ImageGenAdapter = {
  id: 'perchance',
  label: 'Perchance',
  async generate({ prompt }: ImageGenInput): Promise<GeneratedImage[]> {
    const trimmed = prompt.trim();
    if (!trimmed) throw new Error('Enter a prompt first.');
    // One still per tap. Perchance queues a single request per browser and often takes half a minute.
    const url = await requestPerchanceImage(trimmed);
    return [
      {
        id: uid('img'),
        prompt: trimmed,
        preview: { kind: 'url', url },
        createdAt: Date.now(),
        provider: 'perchance',
      },
    ];
  },
};
