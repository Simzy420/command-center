import {
  EXTEND_MAX_SEGMENTS,
  EXTEND_START_UPLOAD,
  WAN_AUTO_EXTEND_TIMEOUT_MS,
  WAN_EXTEND_ORIGIN_DEFAULT,
  WAN_EXTEND_TIMEOUT_MS,
  type ExtendStartMode,
} from './constants';
import { buildExtendCallData, extractExtendPayload, seedExtendState } from './extendPlan';
import { callGradioQueue, gradioFnIndex, isCorsFailure, uploadGradioFile } from './gradio';
import {
  WanCorsError,
  type GradioFileData,
  type WanExtendResult,
  type WanExtendState,
  type WanProgress,
} from './types';

/** Public Extend Space. Override with VITE_WAN_EXTEND_ORIGIN when the URL changes. */
export function wanExtendOrigin(): string {
  const raw = import.meta.env.VITE_WAN_EXTEND_ORIGIN?.trim() ?? '';
  return (raw || WAN_EXTEND_ORIGIN_DEFAULT).replace(/\/$/, '');
}

export async function probeExtendCors(): Promise<boolean> {
  try {
    const res = await fetch(`${wanExtendOrigin()}/config`, { method: 'GET', mode: 'cors' });
    return res.ok;
  } catch {
    return false;
  }
}

export interface WanExtendRequest {
  videoUrl: string;
  generatePrompt: string;
  extendPrompt: string;
  extendStart: ExtendStartMode;
  customImage?: File | null;
  durationSeconds: number;
  steps: number;
  negativePrompt: string;
  seed: number;
  randomizeSeed: boolean;
  quality: number;
  fps: number;
  safeMode: boolean;
  targetSeconds: number;
  mode: 'extend' | 'auto';
  /** Previous Space chain. When missing, the current clip is uploaded and seeded. */
  state?: WanExtendState | null;
}

function fileMime(file: File, fallback: string): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  return fallback;
}

function serverFileData(path: string, file: File, fallbackMime: string): GradioFileData {
  return {
    path,
    url: '',
    orig_name: file.name.split(/[/\\]/).pop() || 'upload.bin',
    size: file.size,
    mime_type: fileMime(file, fallbackMime),
    is_stream: false,
    meta: { _type: 'gradio.FileData' },
  };
}

async function fetchClipFile(url: string): Promise<File> {
  let res: Response;
  try {
    res = await fetch(url, { mode: 'cors' });
  } catch (err) {
    if (isCorsFailure(err)) {
      throw new WanCorsError(
        'This browser blocked reading the clip for Extend. Open the Extend Space and run it there.',
      );
    }
    throw err;
  }
  if (!res.ok) throw new Error(`Could not read the current clip (${res.status}). Generate again, then Extend.`);
  const blob = await res.blob();
  if (blob.size < 32) throw new Error('The current clip was empty. Generate again, then Extend.');
  const type = blob.type || 'video/mp4';
  return new File([blob], type.includes('webm') ? 'clip.webm' : 'clip.mp4', { type });
}

/**
 * Stitch the next Wan segment onto a clip via Simzy/wan22-extend (`do_extend` / `do_auto_extend`).
 * Generate stays on kulkas2pintu/wan222. This Space owns last-frame extraction and ffmpeg concat.
 */
export async function extendWanClip(
  input: WanExtendRequest,
  onProgress: (p: WanProgress) => void = () => undefined,
): Promise<WanExtendResult> {
  if (input.extendStart === EXTEND_START_UPLOAD && !input.customImage) {
    throw new Error('Upload a custom extend start image, or switch to Last frame from video.');
  }
  const origin = wanExtendOrigin();
  let state = input.state?.video && input.state.segments.length > 0 ? input.state : null;
  if ((state?.segments.length ?? 0) >= EXTEND_MAX_SEGMENTS) {
    throw new Error('Segment cap reached (6). Generate a new clip to start another chain.');
  }

  if (!state) {
    onProgress({ phase: 'upload', detail: 'Uploading the current clip to Wan 2.2 Extend…', elapsedMs: 0 });
    const clip = await fetchClipFile(input.videoUrl);
    const path = await uploadGradioFile(origin, clip, clip.name);
    state = seedExtendState(path, input.generatePrompt);
  }

  let custom: GradioFileData | null = null;
  if (input.extendStart === EXTEND_START_UPLOAD && input.customImage) {
    onProgress({ phase: 'upload', detail: 'Uploading the custom extend start image…', elapsedMs: 0 });
    const path = await uploadGradioFile(origin, input.customImage, input.customImage.name || 'extend-start.png');
    custom = serverFileData(path, input.customImage, 'image/png');
  }

  const data = buildExtendCallData(
    {
      generatePrompt: input.generatePrompt,
      extendPrompt: input.extendPrompt,
      extendStart: input.extendStart,
      customImage: custom,
      durationSeconds: input.durationSeconds,
      steps: input.steps,
      negativePrompt: input.negativePrompt,
      seed: input.seed,
      randomizeSeed: input.randomizeSeed,
      quality: input.quality,
      fps: input.fps,
      safeMode: input.safeMode,
      state,
      targetSeconds: input.targetSeconds,
    },
    input.mode,
  );
  const apiName = input.mode === 'auto' ? 'do_auto_extend' : 'do_extend';
  const fnIndex = await gradioFnIndex(origin, apiName);
  onProgress({
    phase: 'queued',
    detail:
      input.mode === 'auto'
        ? 'Auto-extending on Wan 2.2… each segment often takes 1–3 minutes.'
        : 'Extending on Wan 2.2… ZeroGPU often takes 1–3 minutes.',
    elapsedMs: 0,
  });
  const raw = await callGradioQueue({
    origin,
    fnIndex,
    data,
    timeoutMs: input.mode === 'auto' ? WAN_AUTO_EXTEND_TIMEOUT_MS : WAN_EXTEND_TIMEOUT_MS,
    onProgress,
  });
  return extractExtendPayload(raw, origin);
}
