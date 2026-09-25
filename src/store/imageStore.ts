import { create } from 'zustand';
import { getImageGenAdapter, type GeneratedImage } from '@/adapters/imagegen';
import {
  EXTEND_MAX_SEGMENTS,
  extendWanClip,
  generateWanVideo,
  isCorsFailure,
  mergeSegmentCount,
  WanCorsError,
  type GeneratedVideo,
  type WanExtendRequest,
  type WanExtendState,
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

export interface ExtendSession {
  videoId: string;
  state: WanExtendState | null;
  segments: number;
  status: string | null;
  lastFrameUrl: string | null;
}

interface ImageState {
  images: GeneratedImage[];
  videos: GeneratedVideo[];
  model: ImageGenModel;
  busy: boolean;
  wanBusy: boolean;
  wanJob: 'generate' | 'extend' | null;
  wanProgress: string | null;
  error: string | null;
  wanError: string | null;
  corsBlocked: boolean;
  extendCorsBlocked: boolean;
  extendSession: ExtendSession | null;
  setModel: (model: ImageGenModel) => void;
  generate: (prompt: string, count: number) => Promise<void>;
  generateVideo: (input: WanGenerateInput) => Promise<void>;
  extendCurrentVideo: (input: WanExtendRequest & { videoId: string }) => Promise<void>;
  setCorsBlocked: (blocked: boolean) => void;
  setExtendCorsBlocked: (blocked: boolean) => void;
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
  wanJob: null,
  wanProgress: null,
  error: null,
  wanError: null,
  corsBlocked: false,
  extendCorsBlocked: false,
  extendSession: null,
  setModel: (model) => {
    saveModel(model);
    set({ model });
  },
  setCorsBlocked: (corsBlocked) => set({ corsBlocked }),
  setExtendCorsBlocked: (extendCorsBlocked) => set({ extendCorsBlocked }),
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
    set({ wanBusy: true, wanJob: 'generate', wanError: null, wanProgress: 'Encoding image for Wan 2.2…' });
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
        segments: 1,
      };
      const videos = capVideos([video, ...get().videos]);
      saveVideos(videos);
      set({ videos, wanProgress: null, corsBlocked: false, extendSession: null });
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
      set({ wanBusy: false, wanJob: null });
    }
  },
  extendCurrentVideo: async (input) => {
    if (get().wanBusy) return;
    const clip = get().videos.find((video) => video.id === input.videoId);
    if (!clip) {
      set({ wanError: 'Generate a clip first, then use Extend.' });
      return;
    }
    const remembered = get().extendSession?.videoId === clip.id ? get().extendSession : null;
    const prior = Math.max(clip.segments ?? 1, remembered?.segments ?? 1);
    if (prior >= EXTEND_MAX_SEGMENTS) {
      set({ wanError: 'Segment cap reached (6). Generate a new clip to start another chain.' });
      return;
    }
    const hadServerState = Boolean(remembered?.state && remembered.state.segments.length > 0);
    set({
      wanBusy: true,
      wanJob: 'extend',
      wanError: null,
      wanProgress: input.mode === 'auto' ? 'Preparing auto-extend…' : 'Preparing extend…',
    });
    try {
      const result = await extendWanClip(
        {
          ...input,
          videoUrl: clip.url,
          state: hadServerState ? remembered?.state : null,
        },
        (p) => set({ wanProgress: p.detail }),
      );
      const reported = result.state?.segments.length ?? result.segments;
      const segments = mergeSegmentCount(prior, hadServerState, reported);
      const videos = get().videos.map((video) =>
        video.id === clip.id ? { ...video, url: result.url, segments, createdAt: Date.now() } : video,
      );
      saveVideos(videos);
      set({
        videos,
        wanProgress: null,
        extendSession: {
          videoId: clip.id,
          state: result.state,
          segments,
          status: result.statusText || null,
          lastFrameUrl: result.lastFrameUrl,
        },
      });
      const label = input.extendPrompt.trim() || clip.prompt;
      useFilesStore.getState().addMediaUrl(label, result.url);
      useActivityStore.getState().push({
        kind: 'video',
        text: result.statusText ? `Wan 2.2 extend: ${result.statusText}` : `Wan 2.2 extended the clip (${segments} segments)`,
      });
    } catch (err) {
      if (isCorsFailure(err) || err instanceof WanCorsError) {
        set({
          extendCorsBlocked: true,
          wanError:
            err instanceof Error
              ? err.message
              : 'This browser blocked the Extend Space API (CORS). Open the Extend Space in a new tab.',
          wanProgress: null,
        });
        return;
      }
      const message = err instanceof Error ? err.message : 'Wan 2.2 extend failed.';
      set({ wanError: message, wanProgress: null });
    } finally {
      set({ wanBusy: false, wanJob: null });
    }
  },
  clear: () => {
    save([]);
    set({ images: [], error: null });
  },
  clearError: () => set({ error: null }),
  clearWanError: () => set({ wanError: null }),
}));
