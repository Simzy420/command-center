import type { Req, Res } from './types';

export const MAX_TEXT = 8000;
export const MAX_HISTORY = 40;
export const MAX_MESSAGES = 200;

export function applyCors(res: Res, methods = 'GET, POST, OPTIONS'): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function readJsonBody(body: unknown): Record<string, unknown> {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

export function queryParam(req: Req, name: string): string {
  const fromQuery = req.query?.[name];
  if (typeof fromQuery === 'string') return fromQuery;
  if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string') return fromQuery[0];
  const url = req.url ?? '';
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  return new URLSearchParams(q).get(name) ?? '';
}

export function header(req: Req, name: string): string {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return '';
}

export function isSessionId(value: string): boolean {
  const s = value.trim();
  if (s.length < 8 || s.length > 80) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${rand.slice(0, 12)}`;
}

const hits = new Map<string, number[]>();

export function rateLimited(key: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const next = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  next.push(now);
  hits.set(key, next);
  return next.length > max;
}

export function originOf(req: Req): string {
  const proto = header(req, 'x-forwarded-proto') || 'https';
  const host = header(req, 'x-forwarded-host') || header(req, 'host');
  if (!host) return '';
  return `${proto}://${host}`;
}
