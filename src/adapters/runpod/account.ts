/**
 * Server-side Runpod account helpers for balance + stop GPU.
 * API key stays in process.env — never sent to the phone.
 */

export const DEFAULT_ANIMATE_ENDPOINT_ID = 'zrmwpir4qzs66s';
export const RUNPOD_GRAPHQL = 'https://api.runpod.io/graphql';
export const RUNPOD_REST = 'https://rest.runpod.io/v1';

type EnvMap = Record<string, string | undefined>;

export function runpodApiKey(env: EnvMap = process.env as EnvMap) {
  return String(env.RUNPOD_API_KEY || '').trim();
}

export function runpodEndpointId(env: EnvMap = process.env as EnvMap) {
  const id = String(env.RUNPOD_ENDPOINT_ID || '').trim();
  if (id) return id;
  if (runpodApiKey(env)) return DEFAULT_ANIMATE_ENDPOINT_ID;
  return '';
}

export function formatUsdBalance(value: unknown): string | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export type RunpodAccountSnapshot = {
  balanceUsd: number | null;
  balanceLabel: string;
  endpointId: string;
  workersMin: number | null;
  workersMax: number | null;
  workersRunning: number | null;
  workersIdle: number | null;
  gpuStopped: boolean;
};

type FetchLike = typeof fetch;

async function graphqlMyself(apiKey: string, fetchImpl: FetchLike) {
  const res = await fetchImpl(RUNPOD_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: 'query { myself { clientBalance currentSpendPerHr } }',
    }),
  });
  const text = await res.text();
  let json: {
    data?: { myself?: { clientBalance?: unknown; currentSpendPerHr?: unknown } };
    errors?: { message?: string }[];
  } | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new Error(`Runpod balance HTTP ${res.status}`);
  }
  if (json?.errors?.length) {
    throw new Error(json.errors[0]?.message || 'Runpod GraphQL error');
  }
  return json?.data?.myself || null;
}

async function restEndpoint(apiKey: string, endpointId: string, fetchImpl: FetchLike) {
  const res = await fetchImpl(`${RUNPOD_REST}/endpoints/${encodeURIComponent(endpointId)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new Error(`Runpod endpoint HTTP ${res.status}`);
  }
  return json;
}

async function endpointHealth(apiKey: string, endpointId: string, fetchImpl: FetchLike) {
  const res = await fetchImpl(`https://api.runpod.ai/v2/${encodeURIComponent(endpointId)}/health`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  try {
    return (await res.json()) as {
      workers?: { running?: number; idle?: number; ready?: number };
    };
  } catch {
    return null;
  }
}

export async function fetchRunpodAccountSnapshot(
  env: EnvMap = process.env as EnvMap,
  deps: { fetch?: FetchLike } = {},
): Promise<RunpodAccountSnapshot> {
  const apiKey = runpodApiKey(env);
  const endpointId = runpodEndpointId(env);
  if (!apiKey || !endpointId) {
    throw Object.assign(new Error('RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set on this host.'), {
      statusCode: 500,
    });
  }
  const fetchImpl = deps.fetch || fetch;
  const [myself, endpoint, health] = await Promise.all([
    graphqlMyself(apiKey, fetchImpl),
    restEndpoint(apiKey, endpointId, fetchImpl).catch(() => null),
    endpointHealth(apiKey, endpointId, fetchImpl).catch(() => null),
  ]);

  const balanceRaw = myself?.clientBalance;
  const balanceUsd =
    typeof balanceRaw === 'number'
      ? balanceRaw
      : typeof balanceRaw === 'string' && Number.isFinite(Number(balanceRaw))
        ? Number(balanceRaw)
        : null;
  const workersMax =
    endpoint && typeof endpoint.workersMax === 'number' ? endpoint.workersMax : null;
  const workersMin =
    endpoint && typeof endpoint.workersMin === 'number' ? endpoint.workersMin : null;
  const workersRunning =
    health?.workers && typeof health.workers.running === 'number' ? health.workers.running : null;
  const workersIdle =
    health?.workers && typeof health.workers.idle === 'number' ? health.workers.idle : null;

  return {
    balanceUsd,
    balanceLabel: formatUsdBalance(balanceUsd) || 'Balance unavailable',
    endpointId,
    workersMin,
    workersMax,
    workersRunning,
    workersIdle,
    gpuStopped: workersMax === 0,
  };
}

export type StopGpuResult = {
  cancelledJobId: string | null;
  purgedQueue: boolean;
  workersMax: number;
  workersMin: number;
  previousWorkersMax: number | null;
};

export async function stopRunpodGpu(
  env: EnvMap = process.env as EnvMap,
  opts: { jobId?: string; fetch?: FetchLike } = {},
): Promise<StopGpuResult> {
  const apiKey = runpodApiKey(env);
  const endpointId = runpodEndpointId(env);
  if (!apiKey || !endpointId) {
    throw Object.assign(new Error('RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set on this host.'), {
      statusCode: 500,
    });
  }
  const fetchImpl = opts.fetch || fetch;
  let previousWorkersMax: number | null = null;
  try {
    const endpoint = await restEndpoint(apiKey, endpointId, fetchImpl);
    if (typeof endpoint?.workersMax === 'number') previousWorkersMax = endpoint.workersMax;
  } catch {
    previousWorkersMax = null;
  }

  let cancelledJobId: string | null = null;
  const jobId = String(opts.jobId || '').trim();
  if (jobId) {
    const cancel = await fetchImpl(
      `https://api.runpod.ai/v2/${encodeURIComponent(endpointId)}/cancel/${encodeURIComponent(jobId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
    );
    if (cancel.ok) cancelledJobId = jobId;
  }

  const purge = await fetchImpl(`https://api.runpod.ai/v2/${encodeURIComponent(endpointId)}/purge-queue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  const patch = await fetchImpl(`${RUNPOD_REST}/endpoints/${encodeURIComponent(endpointId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workersMin: 0, workersMax: 0 }),
  });
  if (!patch.ok) {
    const text = await patch.text();
    throw Object.assign(new Error(text || `Could not scale workers to zero (HTTP ${patch.status}).`), {
      statusCode: patch.status,
    });
  }

  return {
    cancelledJobId,
    purgedQueue: purge.ok,
    workersMax: 0,
    workersMin: 0,
    previousWorkersMax,
  };
}

/** Bring workers back before Generate after a Stop GPU. */
export async function ensureRunpodWorkers(
  env: EnvMap = process.env as EnvMap,
  opts: { workersMax?: number; fetch?: FetchLike } = {},
): Promise<{ workersMin: number; workersMax: number }> {
  const apiKey = runpodApiKey(env);
  const endpointId = runpodEndpointId(env);
  if (!apiKey || !endpointId) {
    throw Object.assign(new Error('RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set on this host.'), {
      statusCode: 500,
    });
  }
  const fetchImpl = opts.fetch || fetch;
  let currentMax = 0;
  try {
    const endpoint = await restEndpoint(apiKey, endpointId, fetchImpl);
    if (typeof endpoint?.workersMax === 'number') currentMax = endpoint.workersMax;
  } catch {
    currentMax = 0;
  }
  const desired = Math.max(1, opts.workersMax ?? (currentMax > 0 ? currentMax : 2));
  if (currentMax >= 1) {
    return { workersMin: 0, workersMax: currentMax };
  }
  const patch = await fetchImpl(`${RUNPOD_REST}/endpoints/${encodeURIComponent(endpointId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workersMin: 0, workersMax: desired }),
  });
  if (!patch.ok) {
    const text = await patch.text();
    throw Object.assign(new Error(text || `Could not restore workers (HTTP ${patch.status}).`), {
      statusCode: patch.status,
    });
  }
  return { workersMin: 0, workersMax: desired };
}
