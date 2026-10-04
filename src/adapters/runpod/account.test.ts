import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ensureRunpodWorkers,
  fetchRunpodAccountSnapshot,
  formatUsdBalance,
  runpodEndpointId,
  stopRunpodGpu,
} from './account.ts';

test('formatUsdBalance formats finite numbers', () => {
  assert.equal(formatUsdBalance(12.5), '$12.50');
  assert.equal(formatUsdBalance('3'), '$3.00');
  assert.equal(formatUsdBalance(null), null);
});

test('runpodEndpointId falls back to the animate endpoint when a key is present', () => {
  assert.equal(runpodEndpointId({ RUNPOD_API_KEY: 'k' }), 'zrmwpir4qzs66s');
  assert.equal(runpodEndpointId({ RUNPOD_ENDPOINT_ID: 'abc', RUNPOD_API_KEY: 'k' }), 'abc');
  assert.equal(runpodEndpointId({}), '');
});

test('fetchRunpodAccountSnapshot reads GraphQL balance and REST workers', async () => {
  const calls: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method || 'GET'} ${url}`);
    if (url.includes('graphql')) {
      return new Response(JSON.stringify({ data: { myself: { clientBalance: 18.4 } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/endpoints/')) {
      return new Response(JSON.stringify({ workersMin: 0, workersMax: 2 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/health')) {
      return new Response(JSON.stringify({ workers: { running: 1, idle: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('nope', { status: 404 });
  };

  const snap = await fetchRunpodAccountSnapshot(
    { RUNPOD_API_KEY: 'secret', RUNPOD_ENDPOINT_ID: 'zrmwpir4qzs66s' },
    { fetch: fetchImpl as typeof fetch },
  );
  assert.equal(snap.balanceUsd, 18.4);
  assert.equal(snap.balanceLabel, '$18.40');
  assert.equal(snap.workersMax, 2);
  assert.equal(snap.workersRunning, 1);
  assert.equal(snap.gpuStopped, false);
  assert.ok(calls.some((c) => c.includes('graphql')));
});

test('stopRunpodGpu cancels, purges, and scales workers to zero', async () => {
  const calls: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    calls.push(`${method} ${url}`);
    if (method === 'GET' && url.includes('/endpoints/')) {
      return new Response(JSON.stringify({ workersMin: 0, workersMax: 3 }), { status: 200 });
    }
    if (method === 'POST' && url.includes('/cancel/')) {
      return new Response(JSON.stringify({ status: 'CANCELLED' }), { status: 200 });
    }
    if (method === 'POST' && url.includes('/purge-queue')) {
      return new Response(JSON.stringify({ removed: 1 }), { status: 200 });
    }
    if (method === 'PATCH' && url.includes('/endpoints/')) {
      const body = JSON.parse(String(init?.body || '{}')) as { workersMax?: number };
      assert.equal(body.workersMax, 0);
      return new Response(JSON.stringify({ workersMax: 0, workersMin: 0 }), { status: 200 });
    }
    return new Response('nope', { status: 404 });
  };

  const result = await stopRunpodGpu(
    { RUNPOD_API_KEY: 'secret', RUNPOD_ENDPOINT_ID: 'zrmwpir4qzs66s' },
    { jobId: 'job_abc', fetch: fetchImpl as typeof fetch },
  );
  assert.equal(result.cancelledJobId, 'job_abc');
  assert.equal(result.purgedQueue, true);
  assert.equal(result.workersMax, 0);
  assert.equal(result.previousWorkersMax, 3);
});

test('ensureRunpodWorkers restores a zeroed endpoint', async () => {
  let patched: unknown = null;
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || 'GET';
    if (method === 'GET' && url.includes('/endpoints/')) {
      return new Response(JSON.stringify({ workersMax: 0, workersMin: 0 }), { status: 200 });
    }
    if (method === 'PATCH') {
      patched = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify(patched), { status: 200 });
    }
    return new Response('nope', { status: 404 });
  };
  const result = await ensureRunpodWorkers(
    { RUNPOD_API_KEY: 'secret' },
    { fetch: fetchImpl as typeof fetch },
  );
  assert.equal(result.workersMax, 2);
  assert.deepEqual(patched, { workersMin: 0, workersMax: 2 });
});
