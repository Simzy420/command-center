import { stopRunpodGpu } from '../src/adapters/runpod/account.js';

export const config = {
  maxDuration: 30,
  includeFiles: 'src/adapters/runpod/account.js',
};

type Req = { method?: string; body?: unknown };
type Res = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => Res;
  json: (body: unknown) => void;
  end: () => void;
};

function readBody(body: unknown): { jobId?: string } {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as { jobId?: string };
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body as { jobId?: string };
  return {};
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
    const { jobId } = readBody(req.body);
    const result = await stopRunpodGpu(process.env, { jobId });
    res.status(200).json({
      ok: true,
      message: 'GPU workers scaled to zero. Queue purged. Generate will wake workers again.',
      ...result,
    });
  } catch (err) {
    const status = Number.isInteger((err as { statusCode?: number })?.statusCode)
      ? (err as { statusCode: number }).statusCode
      : 502;
    const message = err instanceof Error ? err.message : 'Stop GPU failed';
    res.status(status).json({ error: message });
  }
}
