import {
  EXTEND_FPS_CHOICES,
  EXTEND_MAX_SEGMENTS,
  EXTEND_SEGMENT_MAX,
  EXTEND_SEGMENT_MIN,
  EXTEND_START_LAST_FRAME,
  EXTEND_STEPS_MAX,
  EXTEND_TARGET_DEFAULT,
  EXTEND_TARGET_MAX,
  EXTEND_TARGET_MIN,
  type ExtendStartMode,
} from './constants';
import type { GradioFileData, WanExtendResult, WanExtendState } from './types';

export interface ExtendCallFields {
  generatePrompt: string;
  extendPrompt: string;
  extendStart: ExtendStartMode;
  customImage: GradioFileData | null;
  durationSeconds: number;
  steps: number;
  negativePrompt: string;
  seed: number;
  randomizeSeed: boolean;
  quality: number;
  fps: number;
  safeMode: boolean;
  state: WanExtendState;
  targetSeconds?: number;
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Extend Space segment slider is 2–5s in 0.5s steps. */
export function clampSegmentDuration(seconds: number): number {
  const n = Number(seconds);
  if (!Number.isFinite(n)) return 3.5;
  const stepped = Math.round(n * 2) / 2;
  return Math.min(EXTEND_SEGMENT_MAX, Math.max(EXTEND_SEGMENT_MIN, stepped));
}

export function clampExtendSteps(steps: number): number {
  return clampInt(steps, 1, EXTEND_STEPS_MAX);
}

export function clampExtendQuality(quality: number): number {
  return clampInt(quality, 1, 10);
}

export function clampExtendFps(fps: number): (typeof EXTEND_FPS_CHOICES)[number] {
  const n = Number(fps);
  if (!Number.isFinite(n)) return 16;
  if (n >= 64) return 64;
  if (n >= 32) return 32;
  return 16;
}

export function clampExtendTarget(seconds: number): number {
  return clampInt(seconds, EXTEND_TARGET_MIN, EXTEND_TARGET_MAX);
}

export function clampExtendSeed(seed: number): number {
  return clampInt(seed, 0, 2147483647);
}

/**
 * Turn an uploaded Space path into the chain `do_extend` already understands.
 * `dir` is the upload folder so last-frame and concat files land beside the clip.
 */
export function seedExtendState(serverPath: string, prompt: string): WanExtendState {
  const slash = serverPath.lastIndexOf('/');
  const dir = slash > 0 ? serverPath.slice(0, slash) : '/tmp/wan22_extend';
  return {
    dir,
    segments: [serverPath],
    video: serverPath,
    prompt,
    last_frame: null,
  };
}

export function buildExtendCallData(input: ExtendCallFields, mode: 'extend' | 'auto'): unknown[] {
  const body: unknown[] = [
    input.generatePrompt,
    input.extendPrompt.trim(),
    input.extendStart || EXTEND_START_LAST_FRAME,
    input.extendStart === 'Upload custom image' ? input.customImage : null,
    clampSegmentDuration(input.durationSeconds),
    clampExtendSteps(input.steps),
    input.negativePrompt,
    clampExtendSeed(input.seed),
    Boolean(input.randomizeSeed),
    clampExtendQuality(input.quality),
    clampExtendFps(input.fps),
    Boolean(input.safeMode),
    input.state,
  ];
  if (mode === 'auto') {
    return [clampExtendTarget(input.targetSeconds ?? EXTEND_TARGET_DEFAULT), ...body];
  }
  return body;
}

export function parseExtendStatus(status: string): {
  text: string;
  segments?: number;
  durationSeconds?: number;
} {
  const text = status
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const seg = text.match(/Segments:\s*(\d+)/i);
  const dur = text.match(/Duration\s*(?:≈|~)\s*([\d.]+)\s*s/i);
  const segments = seg ? Number(seg[1]) : undefined;
  const durationSeconds = dur ? Number(dur[1]) : undefined;
  return {
    text,
    segments: segments != null && Number.isFinite(segments) ? segments : undefined,
    durationSeconds: durationSeconds != null && Number.isFinite(durationSeconds) ? durationSeconds : undefined,
  };
}

export function shortExtendStatus(status: string): string {
  const parsed = parseExtendStatus(status);
  const bits = [
    parsed.segments != null ? `Segments ${parsed.segments}/${EXTEND_MAX_SEGMENTS}` : null,
    parsed.durationSeconds != null ? `Duration ≈ ${parsed.durationSeconds.toFixed(1)}s` : null,
  ].filter((bit): bit is string => Boolean(bit));
  return bits.join(' · ') || parsed.text;
}

export function normalizeExtendState(raw: unknown): WanExtendState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const segments = Array.isArray(rec.segments)
    ? rec.segments.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
  const video = typeof rec.video === 'string' && rec.video ? rec.video : segments[0];
  if (!video) return null;
  const slash = video.lastIndexOf('/');
  const derivedDir = slash > 0 ? video.slice(0, slash) : '/tmp/wan22_extend';
  const dir = typeof rec.dir === 'string' && rec.dir ? rec.dir : derivedDir;
  return {
    dir,
    segments: segments.length ? segments : [video],
    video,
    prompt: typeof rec.prompt === 'string' ? rec.prompt : undefined,
    last_frame: typeof rec.last_frame === 'string' ? rec.last_frame : null,
  };
}

function publishFileRef(value: string, origin: string): string | null {
  if (!value) return null;
  if (value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (value.includes('/gradio_api/file')) {
    if (/^https?:/i.test(value)) return value;
    try {
      return new URL(value, origin).href;
    } catch {
      return `${origin}${value.startsWith('/') ? '' : '/'}${value}`;
    }
  }
  if (/^https?:/i.test(value)) return value;
  if (value.startsWith('/')) return `${origin}/gradio_api/file=${value}`;
  return null;
}

/** Prefer a browser-playable Gradio file URL over a server temp path. */
export function publicFileUrl(node: unknown, origin: string, depth = 0): string | null {
  if (node == null || depth > 6) return null;
  if (typeof node === 'string') return publishFileRef(node, origin);
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = publicFileUrl(item, origin, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const rec = node as Record<string, unknown>;
  if (typeof rec.url === 'string' && rec.url) {
    const fromUrl = publishFileRef(rec.url, origin);
    if (fromUrl) return fromUrl;
  }
  if (rec.video) {
    const nested = publicFileUrl(rec.video, origin, depth + 1);
    if (nested) return nested;
  }
  if (typeof rec.path === 'string' && rec.path) {
    const fromPath = publishFileRef(rec.path, origin);
    if (fromPath) return fromPath;
  }
  for (const [key, value] of Object.entries(rec)) {
    if (key === 'meta' || key === 'orig_name' || key === 'mime_type') continue;
    const found = publicFileUrl(value, origin, depth + 1);
    if (found) return found;
  }
  return null;
}

function unwrapGradioData(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return null;
  const rec = data as Record<string, unknown>;
  if (Array.isArray(rec.data)) return rec.data;
  const output = rec.output;
  if (output && typeof output === 'object' && Array.isArray((output as { data?: unknown }).data)) {
    return (output as { data: unknown[] }).data;
  }
  return null;
}

export function extractExtendPayload(data: unknown, origin: string): WanExtendResult {
  const rows = unwrapGradioData(data);
  if (!rows) throw new Error('Extend Space returned an unexpected result.');
  const url = publicFileUrl(rows[0], origin) || publicFileUrl(rows[1], origin);
  if (!url) throw new Error('Extend Space finished but did not return a video.');
  const parsed = parseExtendStatus(typeof rows[2] === 'string' ? rows[2] : '');
  return {
    url,
    statusText: shortExtendStatus(typeof rows[2] === 'string' ? rows[2] : ''),
    segments: parsed.segments,
    durationSeconds: parsed.durationSeconds,
    lastFrameUrl: publicFileUrl(rows[3], origin),
    state: normalizeExtendState(rows[4]),
  };
}

/**
 * `reported` is the Space's segment count for this call.
 * A fresh upload counts the current clip as 1, so new pieces are `reported - 1`.
 */
export function mergeSegmentCount(prior: number, hadServerState: boolean, reported: number | undefined): number {
  const base = Math.max(1, Math.round(Number(prior)) || 1);
  if (hadServerState && reported != null && Number.isFinite(reported) && reported >= base) return reported;
  if (!hadServerState && reported != null && Number.isFinite(reported)) {
    return base + Math.max(1, reported - 1);
  }
  return base + 1;
}
