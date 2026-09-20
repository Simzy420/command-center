import { create } from 'zustand';
import { imageGenAdapter, type GeneratedImage } from '@/adapters/imagegen';
import { readJson, writeJson } from '@/store/persist';
import { useActivityStore } from '@/store/activityStore';

const KEY = 'images';

function load(): GeneratedImage[] {
  return readJson<GeneratedImage[]>(KEY, []);
}

interface ImageState {
  images: GeneratedImage[];
  busy: boolean;
  generate: (prompt: string, count: number) => Promise<void>;
  clear: () => void;
}

function save(images: GeneratedImage[]) {
  writeJson(KEY, images);
}

export const useImageStore = create<ImageState>((set, get) => ({
  images: load(),
  busy: false,
  generate: async (prompt, count) => {
    const trimmed = prompt.trim();
    if (!trimmed || get().busy) return;
    set({ busy: true });
    try {
      const batch = await imageGenAdapter.generate({ prompt: trimmed, count });
      const images = [...batch, ...get().images].slice(0, 48);
      save(images);
      set({ images });
      useActivityStore.getState().push({
        kind: 'image',
        text: `Mock image adapter rendered ${batch.length} frame${batch.length === 1 ? '' : 's'}`,
      });
    } finally {
      set({ busy: false });
    }
  },
  clear: () => {
    save([]);
    set({ images: [] });
  },
}));
