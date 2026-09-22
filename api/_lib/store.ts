import type { BridgeMessage } from './types';
import { MAX_MESSAGES } from './http';

export type StoreKind = 'upstash' | 'vercel-kv' | 'gist' | 'memory';

const memory = new Map<string, BridgeMessage[]>();
let warnedMemory = false;

function redisEnv(): { url: string; token: string; kind: 'upstash' | 'vercel-kv' } | null {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl && upstashToken) return { url: upstashUrl.replace(/\/$/, ''), token: upstashToken, kind: 'upstash' };
  const kvUrl = process.env.KV_REST_API_URL?.trim();
  const kvToken = process.env.KV_REST_API_TOKEN?.trim() || process.env.KV_REST_API_READ_WRITE_TOKEN?.trim();
  if (kvUrl && kvToken) return { url: kvUrl.replace(/\/$/, ''), token: kvToken, kind: 'vercel-kv' };
  return null;
}

function gistEnv(): { id: string; token: string } | null {
  const id = process.env.CHAT_GIST_ID?.trim();
  const token = process.env.GITHUB_TOKEN?.trim();
  if (id && token) return { id, token };
  return null;
}

export function storeKind(): StoreKind {
  const redis = redisEnv();
  if (redis) return redis.kind;
  if (gistEnv()) return 'gist';
  return 'memory';
}

function sessionKey(sessionId: string): string {
  return `cc:chat:${sessionId}`;
}

function gistFile(sessionId: string): string {
  return `session-${sessionId}.json`;
}

async function redisCommand(url: string, token: string, args: Array<string | number>): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok) throw new Error(body.error || `Redis REST HTTP ${res.status}`);
  return body.result;
}

async function loadRedis(sessionId: string): Promise<BridgeMessage[]> {
  const env = redisEnv();
  if (!env) return [];
  const raw = await redisCommand(env.url, env.token, ['GET', sessionKey(sessionId)]);
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw) as BridgeMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveRedis(sessionId: string, messages: BridgeMessage[]): Promise<void> {
  const env = redisEnv();
  if (!env) return;
  const capped = messages.slice(-MAX_MESSAGES);
  await redisCommand(env.url, env.token, ['SET', sessionKey(sessionId), JSON.stringify(capped), 'EX', 60 * 60 * 24 * 7]);
}

async function loadGist(sessionId: string): Promise<BridgeMessage[]> {
  const env = gistEnv();
  if (!env) return [];
  const res = await fetch(`https://api.github.com/gists/${env.id}`, {
    headers: {
      Authorization: `Bearer ${env.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`Gist read failed (${res.status}).`);
  const gist = (await res.json()) as { files?: Record<string, { content?: string } | null> };
  const content = gist.files?.[gistFile(sessionId)]?.content;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as BridgeMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveGist(sessionId: string, messages: BridgeMessage[]): Promise<void> {
  const env = gistEnv();
  if (!env) return;
  const capped = messages.slice(-MAX_MESSAGES);
  const res = await fetch(`https://api.github.com/gists/${env.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      files: { [gistFile(sessionId)]: { content: JSON.stringify(capped) } },
    }),
  });
  if (!res.ok) throw new Error(`Gist write failed (${res.status}).`);
}

function loadMemory(sessionId: string): BridgeMessage[] {
  if (!warnedMemory) {
    warnedMemory = true;
    console.warn(
      '[chat-bridge] Using in-memory Map. Multi-instance / cold starts will miss messages. Set Upstash Redis or CHAT_GIST_ID+GITHUB_TOKEN.',
    );
  }
  return memory.get(sessionId) ?? [];
}

function saveMemory(sessionId: string, messages: BridgeMessage[]): void {
  memory.set(sessionId, messages.slice(-MAX_MESSAGES));
}

export async function getMessages(sessionId: string): Promise<BridgeMessage[]> {
  const kind = storeKind();
  if (kind === 'upstash' || kind === 'vercel-kv') return loadRedis(sessionId);
  if (kind === 'gist') return loadGist(sessionId);
  return loadMemory(sessionId);
}

export async function putMessages(sessionId: string, messages: BridgeMessage[]): Promise<void> {
  const kind = storeKind();
  if (kind === 'upstash' || kind === 'vercel-kv') return saveRedis(sessionId, messages);
  if (kind === 'gist') return saveGist(sessionId, messages);
  saveMemory(sessionId, messages);
}
