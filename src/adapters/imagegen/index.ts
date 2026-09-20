import type { ImageGenAdapter } from './types';
import { mockImageAdapter } from './mock';

/** Default adapter. Replace with a real provider that implements ImageGenAdapter. */
export const imageGenAdapter: ImageGenAdapter = mockImageAdapter;

export type { ImageGenAdapter, GeneratedImage, ImageGenInput } from './types';
