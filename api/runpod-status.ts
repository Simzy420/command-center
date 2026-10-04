import {
  ensureRunpodWorkers,
  fetchRunpodAccountSnapshot,
} from '../src/adapters/runpod/account.js';

export const config = {
  maxDuration: 30,
  includeFiles: 'src/adapters/runpod/account.js',
};

type Req = { method?: string; body?: unknown; query?: Record<string, string | string[] | undefined> };
type Res = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => Res;
  json: (body: unknown) => void;
  end: () => void;
};

function readBody(body: unknown): { ensureWorkers?: boolean } {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as { ensureWorkers?: boolean };
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body as { ensureWorkers?: boolean };
  return {};
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      const body = readBody(req.body);
      if (body.ensureWorkers) {
        const workers = await ensureRunpodWorkers(process.env);
        res.status(200).json({ ok: true, ...workers });
        return;
      }
      res.status(400).json({ error: 'Unsupported action' });
      return;
    }
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'GET or POST only' });
      return;
    }
    const snap = await fetchRunpodAccountSnapshot(process.env);
    res.status(200).json(snap);
  } catch (err) {
    const status = Number.isInteger((err as { statusCode?: number })?.statusCode)
      ? (err as { statusCode: number }).statusCode
      : 502;
    const message = err instanceof Error ? err.message : 'Runpod status failed';
    res.status(status).json({ error: message });
  }
}
