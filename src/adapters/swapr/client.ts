import { padStillForAnimate } from '@/lib/padStill';
import {
  SWAPR_API_ORIGIN,
  SWAPR_CATALOG_URL,
  SWAPR_CDN_BASE,
  SWAPR_DEFAULT_NEGATIVE,
  SWAPR_DEFAULT_PROMPT,
} from './constants';
import type { SwaprGenerateResult, SwaprTemplate } from './types';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runpodApiBase() {
  const override = import.meta.env.VITE_RUNPOD_API_BASE as string | undefined;
  if (override && override.trim()) return override.replace(/\/$/, '');
  return '';
}

export function templateVideoUrl(template: SwaprTemplate): string {
  if (template.video_url) return template.video_url;
  const rel = template.video_path || template.video || '';
  return SWAPR_CDN_BASE + rel.replace(/^\//, '');
}

export function absoluteResultUrl(pathOrUrl: string, apiBase = ''): string {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) {
    if (apiBase) return `${apiBase}${pathOrUrl}`;
    if (pathOrUrl.startsWith('/api/swapr-')) return pathOrUrl;
    return `${SWAPR_API_ORIGIN}${pathOrUrl}`;
  }
  return pathOrUrl;
}

export function absoluteSwaprUrl(pathOrUrl: string): string {
  return absoluteResultUrl(pathOrUrl, '');
}

export async function loadSwaprCatalog(): Promise<SwaprTemplate[]> {
  const res = await fetch(`${SWAPR_CATALOG_URL}${SWAPR_CATALOG_URL.includes('?') ? '&' : '?'}t=${Date.now()}`);
  if (!res.ok) throw new Error(`Could not load motions (HTTP ${res.status}).`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error('Motion catalog was not a list.');
  return data as SwaprTemplate[];
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function pollJob(
  jobId: string,
  opts: { apiBase: string; jobPath: string; onStatus?: (message: string) => void },
): Promise<SwaprGenerateResult> {
  const started = Date.now();
  const limit = 14 * 60 * 1000;
  while (Date.now() - started < limit) {
    await sleep(2500);
    const res = await fetch(`${opts.apiBase}${opts.jobPath}?id=${encodeURIComponent(jobId)}`);
    const text = await res.text();
    let data: SwaprGenerateResult | null = null;
    try {
      data = text ? (JSON.parse(text) as SwaprGenerateResult) : null;
    } catch {
      data = null;
    }
    if (res.status === 404) {
      opts.onStatus?.('Queued on Runpod…');
      continue;
    }
    if (!res.ok) {
      throw new Error((data && data.error) || text || `Job HTTP ${res.status}`);
    }
    if (data?.phase === 'done') return data;
    if (data?.phase === 'error') throw new Error(data.error || 'Generate failed');
    opts.onStatus?.(data?.phase === 'running' ? 'Running Wan Animate on Runpod…' : 'Queued on Runpod…');
  }
  throw new Error(
    'Timed out waiting for Generate. The first Runpod run can take several minutes while the worker starts.',
  );
}

export type SwaprGenerateInput = {
  template: SwaprTemplate;
  photo: File;
  prompt?: string;
  negative?: string;
  onStatus?: (message: string) => void;
};

async function generateNative(input: SwaprGenerateInput, apiBase: string): Promise<SwaprGenerateResult> {
  const photo = await padStillForAnimate(input.photo);
  const image_base64 = await fileToBase64(photo);
  input.onStatus?.('Padding motion clip + queuing on Runpod…');
  const res = await fetch(`${apiBase}/api/swapr-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: input.template.id,
      video_url: templateVideoUrl(input.template),
      image_base64,
      prompt: (input.prompt || '').trim() || SWAPR_DEFAULT_PROMPT,
      negative: (input.negative || '').trim() || SWAPR_DEFAULT_NEGATIVE,
      seed: 42,
    }),
  });
  const text = await res.text();
  let data: SwaprGenerateResult | null = null;
  try {
    data = text ? (JSON.parse(text) as SwaprGenerateResult) : null;
  } catch {
    data = null;
  }
  if (res.status === 404) {
    throw Object.assign(new Error('native-unavailable'), { code: 'native-unavailable' });
  }
  if (!res.ok && res.status !== 202) {
    throw new Error((data && data.error) || text || `Native generate HTTP ${res.status}`);
  }
  if (!data) throw new Error(text || 'Empty generate response');
  if (data.phase === 'error') throw new Error(data.error || 'Generate failed');
  if (data.phase === 'queued' || data.phase === 'running' || data.job_id) {
    if (!data.job_id) throw new Error('Generate did not return a job id');
    return pollJob(data.job_id, {
      apiBase,
      jobPath: '/api/swapr-job',
      onStatus: input.onStatus,
    });
  }
  return data;
}

async function generateViaNetlify(input: SwaprGenerateInput): Promise<SwaprGenerateResult> {
  const photo = await padStillForAnimate(input.photo);
  const payload = {
    template_id: input.template.id,
    video_url: templateVideoUrl(input.template),
    prompt: (input.prompt || '').trim() || SWAPR_DEFAULT_PROMPT,
    negative: (input.negative || '').trim() || SWAPR_DEFAULT_NEGATIVE,
    max_seconds: 3,
    height: 480,
    width: 384,
    steps: 6,
    guidance: 1,
    sample_shift: 5,
    seed: 42,
    session_id: '',
  };

  const form = new FormData();
  form.append('api', '/generate');
  form.append('payload', JSON.stringify(payload));
  form.append('photo', photo, photo.name || 'photo-padded.jpg');

  input.onStatus?.('Queuing on Runpod…');
  const res = await fetch(`${SWAPR_API_ORIGIN}/api/generate`, { method: 'POST', body: form });
  const text = await res.text();
  let data: SwaprGenerateResult | null = null;
  try {
    data = text ? (JSON.parse(text) as SwaprGenerateResult) : null;
  } catch {
    data = null;
  }
  if (!res.ok && res.status !== 202) {
    throw new Error((data && data.error) || text || `Proxy HTTP ${res.status}`);
  }
  if (!data) throw new Error(text || 'Proxy returned an empty response');
  if (data.phase === 'error') throw new Error(data.error || 'Generate failed');
  if (data.phase === 'queued' || data.phase === 'running') {
    if (!data.job_id) throw new Error('Generate did not return a job id');
    return pollJob(data.job_id, {
      apiBase: SWAPR_API_ORIGIN,
      jobPath: '/api/job',
      onStatus: input.onStatus,
    });
  }
  return data;
}

/**
 * Prefer the Command Center native path (pads the driving clip + matches
 * portrait/landscape). Falls back to the Netlify proxy with a padded still.
 */
export async function generateSwaprClip(input: SwaprGenerateInput): Promise<SwaprGenerateResult> {
  const apiBase = runpodApiBase();
  try {
    return await generateNative(input, apiBase);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const message = err instanceof Error ? err.message : String(err);
    const missingKey = /RUNPOD_API_KEY|not set on this host/i.test(message);
    if (code === 'native-unavailable' || missingKey || /Native generate HTTP 404/.test(message)) {
      return generateViaNetlify(input);
    }
    // Same-origin 502 with a real Runpod error should surface, not silently fall back.
    if (apiBase || !/Failed to fetch|NetworkError|native-unavailable/i.test(message)) {
      // When apiBase is empty, a failed same-origin fetch often means GH Pages has no API.
      if (!apiBase && (/Failed to fetch|NetworkError|404|502|500/.test(message) || code === 'native-unavailable')) {
        return generateViaNetlify(input);
      }
    }
    if (!apiBase) return generateViaNetlify(input);
    throw err;
  }
}

export function resultVideoUrl(data: SwaprGenerateResult): string {
  const raw = data.video || data.url || '';
  return absoluteResultUrl(raw, runpodApiBase());
}
