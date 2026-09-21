import { create } from 'zustand';
import { getImageGenAdapter, type GeneratedImage } from '@/adapters/imagegen';
import { readJson, writeJson } from '@/store/persist';
import { useActivityStore } from '@/store/activityStore';

const KEY = 'images';

function load(): GeneratedImage[] {
  const raw = readJson<GeneratedImage[]>(KEY, []);
  return raw.filter((img) => img?.preview && (img.preview.kind === 'url' || img.preview.kind === 'gradient'));
}

function capHistory(images: GeneratedImage[]): GeneratedImage[] {
  const hasData = images.some((img) => img.preview.kind === 'url' && img.preview.url.startsWith('data:'));
  return images.slice(0, hasData ? 8 : 48);
}

interface ImageState {
  images: GeneratedImage[];
  busy: boolean;
  error: string | null;
  generate: (prompt: string, count: number) => Promise<void>;
  clear: () => void;
  clearError: () => void;
}

function save(images: GeneratedImage[]) {
  writeJson(KEY, images);
}

export const useImageStore = create<ImageState>((set, get) => ({
  images: load(),
  busy: false,
  error: null,
  generate: async (prompt, count) => {
    const trimmed = prompt.trim();
    if (!trimmed || get().busy) return;
    set({ busy: true, error: null });
    const adapter = getImageGenAdapter();
    try {
      const batch = await adapter.generate({ prompt: trimmed, count });
      const images = capHistory([...batch, ...get().images]);
      save(images);
      set({ images });
      useActivityStore.getState().push({
        kind: 'image',
        text: `${adapter.label} rendered ${batch.length} image${batch.length === 1 ? '' : 's'}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed.';
      set({ error: message });
    } finally {
      set({ busy: false });
    }
  },
  clear: () => {
    save([]);
    set({ images: [], error: null });
  },
  clearError: () => set({ error: null }),
}));
