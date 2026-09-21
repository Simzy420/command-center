import { create } from 'zustand';
import { getImageGenAdapter, type GeneratedImage } from '@/adapters/imagegen';
import {
  generateWanVideo,
  isCorsFailure,
  WanCorsError,
  type GeneratedVideo,
  type WanGenerateInput,
} from '@/adapters/wan';
import { uid } from '@/lib/ids';
import { readJson, writeJson } from '@/store/persist';
import { useActivityStore } from '@/store/activityStore';
import { useFilesStore } from '@/store/filesStore';

const KEY = 'images';
const MODEL_KEY = 'imageModel';
const VIDEOS_KEY = 'videos';

export type ImageGenModel = 'stills' | 'wan22';

function load(): GeneratedImage[] {
  const raw = readJson<GeneratedImage[]>(KEY, []);
  return raw.filter((img) => img?.preview && (img.preview.kind === 'url' || img.preview.kind === 'gradient'));
}

function loadModel(): ImageGenModel {
  const raw = readJson<ImageGenModel>(MODEL_KEY, 'stills');
  return raw === 'wan22' ? 'wan22' : 'stills';
}

function loadVideos(): GeneratedVideo[] {
  const raw = readJson<GeneratedVideo[]>(VIDEOS_KEY, []);
  return raw.filter((v) => v && typeof v.url === 'string' && typeof v.prompt === 'string');
}

function capHistory(images: GeneratedImage[]): GeneratedImage[] {
  const hasData = images.some((img) => img.preview.kind === 'url' && img.preview.url.startsWith('data:'));
  return images.slice(0, hasData ? 8 : 48);
}

function capVideos(videos: GeneratedVideo[]): GeneratedVideo[] {
  return videos.slice(0, 24);
}

interface ImageState {
  images: GeneratedImage[];
  videos: GeneratedVideo[];
  model: ImageGenModel;
  busy: boolean;
  wanBusy: boolean;
  wanProgress: string | null;
  error: string | null;
  wanError: string | null;
  corsBlocked: boolean;
  setModel: (model: ImageGenModel) => void;
  generate: (prompt: string, count: number) => Promise<void>;
  generateVideo: (input: WanGenerateInput) => Promise<void>;
  setCorsBlocked: (blocked: boolean) => void;
  clear: () => void;
  clearError: () => void;
  clearWanError: () => void;
}

function save(images: GeneratedImage[]) {
  writeJson(KEY, images);
}

function saveVideos(videos: GeneratedVideo[]) {
  writeJson(VIDEOS_KEY, videos);
}

function saveModel(model: ImageGenModel) {
  writeJson(MODEL_KEY, model);
}

export const useImageStore = create<ImageState>((set, get) => ({
  images: load(),
  videos: loadVideos(),
  model: loadModel(),
  busy: false,
  wanBusy: false,
  wanProgress: null,
  error: null,
  wanError: null,
  corsBlocked: false,
  setModel: (model) => {
    saveModel(model);
    set({ model });
  },
  setCorsBlocked: (corsBlocked) => set({ corsBlocked }),
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
  generateVideo: async (input) => {
    if (get().wanBusy) return;
    set({ wanBusy: true, wanError: null, wanProgress: 'Encoding image for Wan 2.2…' });
    try {
      const result = await generateWanVideo(input, (p) => {
        set({ wanProgress: p.detail });
      });
      const video: GeneratedVideo = {
        id: uid('vid'),
        prompt: input.prompt,
        url: result.url,
        createdAt: Date.now(),
        seed: result.seed,
        provider: 'wan22',
      };
      const videos = capVideos([video, ...get().videos]);
      saveVideos(videos);
      set({ videos, wanProgress: null, corsBlocked: false });
      useFilesStore.getState().addMediaUrl(video.prompt, video.url);
      useActivityStore.getState().push({
        kind: 'video',
        text: `Wan 2.2 rendered a ${input.durationSeconds}s clip`,
      });
    } catch (err) {
      if (isCorsFailure(err) || err instanceof WanCorsError) {
        set({
          corsBlocked: true,
          wanError:
            err instanceof Error
              ? err.message
              : 'This browser blocked the Space API (CORS). Use the embed below, or open the Space.',
          wanProgress: null,
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'Wan 2.2 video generation failed.';
      set({ wanError: message, wanProgress: null });
    } finally {
      set({ wanBusy: false });
    }
  },
  clear: () => {
    save([]);
    set({ images: [], error: null });
  },
  clearError: () => set({ error: null }),
  clearWanError: () => set({ wanError: null }),
}));
