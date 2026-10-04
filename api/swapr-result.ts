import {
  decodeVideoBase64,
  extractRunpodVideoBase64,
  fetchRunpodJob,
  isJobId,
  runpodConfigured,
  videoContentType,
} from '../src/adapters/runpod/jobBridge.js';

export const config = {
  maxDuration: 60,
  includeFiles: 'src/adapters/runpod/jobBridge.js',
};

type Req = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};
type Res = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => Res;
  json: (body: unknown) => void;
  end: () => void;
  send?: (body: Buffer) => void;
};

function jobIdFrom(req: Req) {
  const q = req.query?.id;
  if (typeof q === 'string') return q;
  if (Array.isArray(q) && typeof q[0] === 'string') return q[0];
  try {
    if (req.url) return new URL(req.url, 'http://local').searchParams.get('id') || '';
  } catch {
    /* ignore */
  }
  return '';
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  if (!runpodConfigured(process.env as Record<string, string | undefined>)) {
    res.status(500).json({ error: 'RUNPOD_API_KEY is not set on this host.' });
    return;
  }
  const id = jobIdFrom(req);
  if (!isJobId(id)) {
    res.status(400).json({ error: 'Missing job id' });
    return;
  }
  try {
    const polled = await fetchRunpodJob(process.env as Record<string, string | undefined>, id);
    const encoded = extractRunpodVideoBase64(polled.body?.output ?? polled.body);
    const bytes = decodeVideoBase64(encoded);
    if (!bytes) {
      res.status(404).json({ error: 'Result is not ready' });
      return;
    }
    const type = videoContentType(bytes);
    res.setHeader('Content-Type', type);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(bytes.length));
    if (req.method === 'HEAD') {
      res.status(200).end();
      return;
    }
    if (typeof res.send === 'function') {
      res.status(200);
      res.send(bytes);
      return;
    }
    // Fallback for adapters that only expose end()
    (res as Res & { end: (body?: Buffer) => void }).status(200);
    (res as Res & { end: (body?: Buffer) => void }).end(bytes);
  } catch (err) {
    const status = Number.isInteger((err as { statusCode?: number })?.statusCode)
      ? (err as { statusCode: number }).statusCode
      : 502;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Result failed' });
  }
}
