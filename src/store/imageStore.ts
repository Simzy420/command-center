import { create } from 'zustand';
import { imageGenAdapter, type GeneratedImage } from '@/adapters/imagegen';
import { readJson, writeJson } from '@/store/persist';
import { useActivityStore } from '@/store/activityStore';

const KEY = 'images';

function load(): GeneratedImage[] {
  const raw = readJson<GeneratedImage[]>(KEY, []);
  return raw.filter((img) => img?.preview && (img.preview.kind === 'url' || img.preview.kind === 'gradient'));
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
    try {
      const batch = await imageGenAdapter.generate({ prompt: trimmed, count });
      const images = [...batch, ...get().images].slice(0, 48);
      save(images);
      set({ images });
      useActivityStore.getState().push({
        kind: 'image',
        text: `${imageGenAdapter.label} rendered ${batch.length} image${batch.length === 1 ? '' : 's'}`,
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
