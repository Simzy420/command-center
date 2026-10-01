import {
  buildAnimateInput,
  chooseAnimateSize,
  prepareMotionVideo,
  startAnimateJob,
} from '../src/adapters/runpod/animate.js';
import { ensureRunpodWorkers } from '../src/adapters/runpod/account.js';
import { SWAPR_CDN_BASE, SWAPR_CATALOG_URL } from '../src/adapters/swapr/constants.js';

export const config = {
  maxDuration: 120,
  includeFiles: [
    'src/adapters/runpod/animate.js',
    'src/adapters/runpod/account.js',
    'src/adapters/swapr/constants.js',
    'node_modules/ffmpeg-static/**',
    'node_modules/ffprobe-static/**',
  ],
};

type Req = { method?: string; body?: unknown };
type Res = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => Res;
  json: (body: unknown) => void;
  end: () => void;
};

type Body = {
  template_id?: string;
  video_url?: string;
  image_base64?: string;
  prompt?: string;
  negative?: string;
  seed?: number;
};

function readBody(body: unknown): Body {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Body;
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body as Body;
  return {};
}

function stripDataUrl(value: string) {
  return value.replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
}

async function resolveVideoUrl(templateId: string, directUrl: string) {
  if (directUrl && /^https:\/\/huggingface\.co\//i.test(directUrl) && /wan22-template-clips/i.test(directUrl)) {
    return directUrl;
  }
  const res = await fetch(`${SWAPR_CATALOG_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error('Could not load motion catalog.');
  const catalog = (await res.json()) as { id?: string; video_url?: string; video_path?: string; video?: string }[];
  const item = catalog.find((row) => row && row.id === templateId);
  if (!item) throw new Error(`Unknown motion “${templateId}”.`);
  if (item.video_url) return item.video_url;
  const rel = item.video_path || item.video || '';
  return SWAPR_CDN_BASE + String(rel).replace(/^\//, '');
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  try {
    await ensureRunpodWorkers(process.env).catch(() => null);
    const body = readBody(req.body);
    const image_base64 = stripDataUrl(String(body.image_base64 || ''));
    if (!image_base64 || image_base64.length < 32) {
      res.status(400).json({ error: 'Upload a still photo.' });
      return;
    }
    // ~2.5 MB decoded
    if (image_base64.length > 3_500_000) {
      res.status(400).json({ error: 'That still is too large. Choose a smaller photo.' });
      return;
    }
    const templateId = String(body.template_id || '').trim();
    if (!templateId) {
      res.status(400).json({ error: 'Pick a motion template.' });
      return;
    }
    const videoUrl = await resolveVideoUrl(templateId, String(body.video_url || '').trim());
    const motion = await prepareMotionVideo(videoUrl);
    const frame = chooseAnimateSize(motion.width, motion.height);
    const input = buildAnimateInput({
      image_base64,
      video_base64: motion.bytes.toString('base64'),
      prompt: body.prompt,
      negative: body.negative,
      seed: body.seed,
      width: frame.width,
      height: frame.height,
    });
    const started = await startAnimateJob(process.env as Record<string, string | undefined>, input);
    res.status(202).json({ ...started, width: frame.width, height: frame.height });
  } catch (err) {
    const status = Number.isInteger((err as { statusCode?: number })?.statusCode)
      ? (err as { statusCode: number }).statusCode
      : 502;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Generate failed' });
  }
}
