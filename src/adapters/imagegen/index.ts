import type { ImageGenAdapter } from './types';
import { pollinationsImageAdapter } from './pollinations';

/** Default: no-key Pollinations URLs that work as <img src> on the phone PWA. */
export const imageGenAdapter: ImageGenAdapter = pollinationsImageAdapter;

export { mockImageAdapter } from './mock';
export { pollinationsImageAdapter } from './pollinations';

export type { ImageGenAdapter, GeneratedImage, ImageGenInput, ImagePreview } from './types';
