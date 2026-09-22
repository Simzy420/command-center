import { applyCors, header, isSessionId, MAX_TEXT, newId, rateLimited, readJsonBody, safeEqual, str } from '../_lib/http';
import { getMessages, putMessages } from '../_lib/store';
import type { BridgeMessage, BridgeStatus, Req, Res } from '../_lib/types';

export const config = { maxDuration: 15 };

function bearer(req: Req): string {
  const raw = header(req, 'authorization');
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1]?.trim() ?? '';
}

export default async function handler(req: Req, res: Res) {
  applyCors(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const secret = process.env.CHAT_BRIDGE_SECRET?.trim() ?? '';
  if (!secret) {
    res.status(500).json({ error: 'Server is missing CHAT_BRIDGE_SECRET.' });
    return;
  }
  const token = bearer(req);
  if (!token || !safeEqual(token, secret)) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const body = readJsonBody(req.body);
  const sessionId = str(body.sessionId).trim();
  const clientMsgId = str(body.clientMsgId).trim();
  const botId = str(body.botId).trim() || 'chief';
  const text = str(body.text);
  const statusRaw = str(body.status, 'final');
  const status: BridgeStatus = statusRaw === 'partial' ? 'partial' : 'final';

  if (!isSessionId(sessionId)) {
    res.status(400).json({ error: 'sessionId must be a UUID.' });
    return;
  }
  if (!clientMsgId || clientMsgId.length > 80) {
    res.status(400).json({ error: 'clientMsgId is required.' });
    return;
  }
  if (text.length > MAX_TEXT) {
    res.status(400).json({ error: `text must be under ${MAX_TEXT} characters.` });
    return;
  }
  if (rateLimited(`reply:${sessionId}`, 120, 60_000)) {
    res.status(429).json({ error: 'Too many reply posts.' });
    return;
  }

  try {
    const existing = await getMessages(sessionId);
    const idx = existing.findIndex((m) => m.role === 'assistant' && m.clientMsgId === clientMsgId);
    const next: BridgeMessage[] = existing.slice();
    if (idx >= 0) {
      next[idx] = { ...next[idx], text, status, createdAt: next[idx].createdAt };
    } else {
      next.push({
        id: newId('msg'),
        role: 'assistant',
        botId,
        text,
        clientMsgId,
        createdAt: Date.now(),
        status,
      });
    }
    await putMessages(sessionId, next);
    res.status(200).json({ ok: true, clientMsgId, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to store reply.';
    res.status(502).json({ error: message });
  }
}
