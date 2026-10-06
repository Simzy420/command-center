import { generatePerchanceImage } from './perchanceChrome.ts';

type Req = {
  method?: string;
  body?: unknown;
  [Symbol.asyncIterator]?: () => AsyncIterator<Buffer | string>;
};

type Res = {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  status?: (code: number) => Res;
  json?: (body: unknown) => void;
  end: (body?: string) => void;
};

function send(res: Res, code: number, body: unknown) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    const json = res.json.bind(res);
    res.status(code);
    json(body);
    return;
  }
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readPrompt(req: Req): Promise<string> {
  let value: unknown = req.body;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return '';
    }
  }
  if (!value && typeof req[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer | string>) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > 20_000) return '';
      chunks.push(buf);
    }
    if (chunks.length) {
      try {
        value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
      } catch {
        return '';
      }
    }
  }
  if (!value || typeof value !== 'object') return '';
  const prompt = (value as { prompt?: unknown }).prompt;
  return typeof prompt === 'string' ? prompt.trim() : '';
}

export async function handlePerchanceImageRequest(req: Req, res: Res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'POST only' });
    return;
  }
  const prompt = await readPrompt(req);
  if (!prompt) {
    send(res, 400, { error: 'prompt is required' });
    return;
  }
  if (prompt.length > 1000) {
    send(res, 400, { error: 'prompt is too long' });
    return;
  }
  try {
    const image = await generatePerchanceImage(prompt);
    send(res, 200, image);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Perchance image generation failed.';
    send(res, 502, { error: message });
  }
}
