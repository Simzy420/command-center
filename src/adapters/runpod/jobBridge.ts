/**
 * Minimal Runpod job status + video extract for Become the Character.
 * Mirrors the swapr-casey Netlify client, kept in this repo so Generate can
 * pad driving clips and use portrait frame sizes.
 */

import { runpodApiKey, runpodEndpointId, DEFAULT_ANIMATE_ENDPOINT_ID } from './account.ts';

type EnvMap = Record<string, string | undefined>;
type FetchLike = typeof fetch;

export function runpodConfigured(env: EnvMap = process.env as EnvMap) {
  return Boolean(runpodApiKey(env) && (runpodEndpointId(env) || DEFAULT_ANIMATE_ENDPOINT_ID));
}

export function isJobId(value: string) {
  return /^[A-Za-z0-9_-]{6,80}$/.test(String(value || ''));
}

function looksLikeBase64(value: string) {
  const compact = value.trim().replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  return compact.length >= 32 && /^[A-Za-z0-9+/]+=*$/.test(compact);
}

export function extractRunpodVideoBase64(output: unknown): string | null {
  const found: string[] = [];
  const visit = (node: unknown, depth: number) => {
    if (found.length || depth > 8 || node == null) return;
    if (typeof node === 'string') {
      if (looksLikeBase64(node)) found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    if (typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;
    for (const key of ['video', 'base64', 'data', 'gifs']) {
      if (key in rec) visit(rec[key], depth + 1);
      if (found.length) return;
    }
    for (const value of Object.values(rec)) visit(value, depth + 1);
  };
  visit(output, 0);
  return found[0] || null;
}

export function isVideoBytes(bytes: Buffer) {
  if (!bytes || bytes.length < 16) return false;
  const head = bytes.subarray(0, Math.min(bytes.length, 64));
  if (head.includes(Buffer.from('ftyp'))) return true;
  return head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
}

export function decodeVideoBase64(value: string | null) {
  if (!value || !String(value).trim()) return null;
  const raw = String(value).trim().replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(raw)) return null;
  const bytes = Buffer.from(raw, 'base64');
  if (!isVideoBytes(bytes)) return null;
  return bytes;
}

export function videoContentType(bytes: Buffer) {
  if (!bytes || bytes.length < 12) return 'video/mp4';
  const head = bytes.subarray(0, Math.min(bytes.length, 64));
  if (head.includes(Buffer.from('ftyp'))) return 'video/mp4';
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm';
  return 'video/mp4';
}

function isTerminalFailure(status: string) {
  const name = String(status || '').toUpperCase();
  return name === 'FAILED' || name === 'CANCELLED' || name === 'TIMED_OUT' || name === 'ERROR';
}

export function describeRunpodJob(
  jobId: string,
  body: { status?: string; output?: unknown; error?: unknown },
  opts: { resultPath?: string } = {},
) {
  const status = String(body?.status || '').toUpperCase();
  const resultPath = opts.resultPath || '/api/swapr-result';
  if (status === 'COMPLETED') {
    const encoded = extractRunpodVideoBase64(body?.output ?? body);
    if (!decodeVideoBase64(encoded)) {
      return { job_id: jobId, phase: 'error', error: 'Runpod finished without a video.' };
    }
    const url = `${resultPath}?id=${encodeURIComponent(jobId)}`;
    return { job_id: jobId, phase: 'done', video: url, url, status: 'Done.' };
  }
  if (isTerminalFailure(status)) {
    const message =
      typeof body?.error === 'string'
        ? body.error
        : typeof (body?.output as { error?: string } | undefined)?.error === 'string'
          ? (body.output as { error: string }).error
          : `Runpod ${status}`;
    return { job_id: jobId, phase: 'error', error: message };
  }
  if (status === 'IN_PROGRESS' || status === 'RUNNING') {
    return { job_id: jobId, phase: 'running' };
  }
  if (status === 'IN_QUEUE' || status === 'QUEUED') {
    return { job_id: jobId, phase: 'queued' };
  }
  return { job_id: jobId, phase: 'error', error: 'Runpod did not return a job status.' };
}

export async function fetchRunpodJob(env: EnvMap, jobId: string, deps: { fetch?: FetchLike } = {}) {
  const apiKey = runpodApiKey(env);
  const endpointId = runpodEndpointId(env) || DEFAULT_ANIMATE_ENDPOINT_ID;
  if (!apiKey || !endpointId) {
    throw Object.assign(new Error('RUNPOD_API_KEY is not set on this host.'), { statusCode: 500 });
  }
  const fetchImpl = deps.fetch || fetch;
  const res = await fetchImpl(
    `https://api.runpod.ai/v2/${encodeURIComponent(endpointId)}/status/${encodeURIComponent(jobId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    },
  );
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    throw Object.assign(new Error(typeof body.error === 'string' ? body.error : `Runpod HTTP ${res.status}`), {
      statusCode: res.status,
    });
  }
  return { body, httpStatus: res.status, text };
}
