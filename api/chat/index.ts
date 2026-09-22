import { applyCors, header, isSessionId, MAX_HISTORY, MAX_TEXT, newId, originOf, queryParam, rateLimited, readJsonBody, str } from '../_lib/http';
import { getMessages, putMessages, storeKind } from '../_lib/store';
import type { BridgeMessage, Req, Res } from '../_lib/types';

export const config = { maxDuration: 30 };

async function forwardWebhook(payload: Record<string, unknown>): Promise<void> {
  const urlRaw = process.env.GROK_WEBHOOK_URL?.trim();
  if (!urlRaw) {
    throw new Error('Server is missing GROK_WEBHOOK_URL.');
  }
  const key = process.env.GROK_WEBHOOK_SENDER_KEY?.trim() ?? '';
  let target = urlRaw;
  if (key) {
    try {
      const u = new URL(urlRaw);
      if (!u.searchParams.has('key')) u.searchParams.set('key', key);
      target = u.toString();
    } catch {
      target = urlRaw.includes('?') ? `${urlRaw}&key=${encodeURIComponent(key)}` : `${urlRaw}?key=${encodeURIComponent(key)}`;
    }
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    headers['X-Webhook-Key'] = key;
  }
  const res = await fetch(target, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Grok webhook HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
}

export default async function handler(req: Req, res: Res) {
  applyCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const sessionId = queryParam(req, 'sessionId').trim();
    if (!isSessionId(sessionId)) {
      res.status(400).json({ error: 'sessionId must be a UUID.' });
      return;
    }
    try {
      const messages = await getMessages(sessionId);
      res.status(200).json({ messages, store: storeKind() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read chat.';
      res.status(502).json({ error: message });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST only' });
    return;
  }

  const body = readJsonBody(req.body);
  const sessionId = str(body.sessionId).trim();
  const clientMsgId = str(body.clientMsgId).trim();
  const botId = str(body.botId).trim() || 'chief';
  const botName = str(body.botName).trim() || 'Chief of Staff';
  const text = str(body.text).trim();
  if (!isSessionId(sessionId)) {
    res.status(400).json({ error: 'sessionId must be a UUID.' });
    return;
  }
  if (!clientMsgId || clientMsgId.length > 80) {
    res.status(400).json({ error: 'clientMsgId is required.' });
    return;
  }
  if (!text) {
    res.status(400).json({ error: 'text is required.' });
    return;
  }
  if (text.length > MAX_TEXT) {
    res.status(400).json({ error: `text must be under ${MAX_TEXT} characters.` });
    return;
  }
  if (rateLimited(`send:${sessionId}`) || rateLimited(`ip:${header(req, 'x-forwarded-for') || 'local'}`)) {
    res.status(429).json({ error: 'Too many chat sends. Wait a moment.' });
    return;
  }

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
  const userMsg: BridgeMessage = {
    id: newId('msg'),
    role: 'user',
    botId,
    text,
    clientMsgId,
    createdAt: Date.now(),
    status: 'queued',
  };

  try {
    const existing = await getMessages(sessionId);
    const already = existing.some((m) => m.clientMsgId === clientMsgId && m.role === 'user');
    const next = already ? existing : [...existing, userMsg];
    await putMessages(sessionId, next);

    const origin = originOf(req);
    await forwardWebhook({
      sessionId,
      clientMsgId,
      botId,
      botName,
      text,
      history,
      replyUrl: origin ? `${origin}/api/chat/reply` : '/api/chat/reply',
    });

    const sent = (await getMessages(sessionId)).map((m) =>
      m.clientMsgId === clientMsgId && m.role === 'user' ? { ...m, status: 'sent' as const } : m,
    );
    await putMessages(sessionId, sent);
    res.status(200).json({ ok: true, clientMsgId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat send failed.';
    res.status(502).json({ error: message, clientMsgId });
  }
}
