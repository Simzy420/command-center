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

export function templateVideoUrl(template: SwaprTemplate): string {
  if (template.video_url) return template.video_url;
  const rel = template.video_path || template.video || '';
  return SWAPR_CDN_BASE + rel.replace(/^\//, '');
}

export function absoluteSwaprUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return `${SWAPR_API_ORIGIN}${pathOrUrl}`;
  return pathOrUrl;
}

export async function loadSwaprCatalog(): Promise<SwaprTemplate[]> {
  const res = await fetch(`${SWAPR_CATALOG_URL}${SWAPR_CATALOG_URL.includes('?') ? '&' : '?'}t=${Date.now()}`);
  if (!res.ok) throw new Error(`Could not load motions (HTTP ${res.status}).`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error('Motion catalog was not a list.');
  return data as SwaprTemplate[];
}

async function pollJob(jobId: string, onStatus?: (message: string) => void): Promise<SwaprGenerateResult> {
  const started = Date.now();
  const limit = 14 * 60 * 1000;
  while (Date.now() - started < limit) {
    await sleep(2500);
    const res = await fetch(`${SWAPR_API_ORIGIN}/api/job?id=${encodeURIComponent(jobId)}`);
    const text = await res.text();
    let data: SwaprGenerateResult | null = null;
    try {
      data = text ? (JSON.parse(text) as SwaprGenerateResult) : null;
    } catch {
      data = null;
    }
    if (res.status === 404) {
      onStatus?.('Queued on Runpod…');
      continue;
    }
    if (!res.ok) {
      throw new Error((data && data.error) || text || `Job HTTP ${res.status}`);
    }
    if (data?.phase === 'done') return data;
    if (data?.phase === 'error') throw new Error(data.error || 'Generate failed');
    onStatus?.(data?.phase === 'running' ? 'Running Wan Animate on Runpod…' : 'Queued on Runpod…');
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

/**
 * Generate through the hosted Swapr proxy (same-origin on Netlify for phones).
 * The still is padded with headroom first so Wan Animate does not clip faces.
 */
export async function generateSwaprClip(input: SwaprGenerateInput): Promise<SwaprGenerateResult> {
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
    return pollJob(data.job_id, input.onStatus);
  }
  return data;
}

export function resultVideoUrl(data: SwaprGenerateResult): string {
  const raw = data.video || data.url || '';
  return absoluteSwaprUrl(raw);
}
