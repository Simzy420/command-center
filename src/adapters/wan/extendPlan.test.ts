import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXTEND_START_LAST_FRAME, EXTEND_START_UPLOAD } from './constants.ts';
import {
  buildExtendCallData,
  clampExtendFps,
  clampExtendSteps,
  clampExtendTarget,
  clampSegmentDuration,
  extractExtendPayload,
  mergeSegmentCount,
  publicFileUrl,
  seedExtendState,
  shortExtendStatus,
} from './extendPlan.ts';

const origin = 'https://simzy-wan22-extend.hf.space';

test('segment length stays inside the Extend Space slider', () => {
  assert.equal(clampSegmentDuration(3.5), 3.5);
  assert.equal(clampSegmentDuration(0.5), 2);
  assert.equal(clampSegmentDuration(10), 5);
  assert.equal(clampSegmentDuration(3.2), 3);
});

test('steps, fps, and auto target match the Space caps', () => {
  assert.equal(clampExtendSteps(30), 12);
  assert.equal(clampExtendSteps(4), 4);
  assert.equal(clampExtendFps(16), 16);
  assert.equal(clampExtendFps(128), 64);
  assert.equal(clampExtendTarget(14), 14);
  assert.equal(clampExtendTarget(4), 8);
  assert.equal(clampExtendTarget(30), 22);
});

test('seeded state points at the uploaded clip', () => {
  const state = seedExtendState('/tmp/gradio/abc/clip.mp4', 'come alive');
  assert.equal(state.dir, '/tmp/gradio/abc');
  assert.deepEqual(state.segments, ['/tmp/gradio/abc/clip.mp4']);
  assert.equal(state.video, '/tmp/gradio/abc/clip.mp4');
  assert.equal(state.prompt, 'come alive');
});

test('extend payload matches do_extend argument order', () => {
  const state = seedExtendState('/tmp/gradio/abc/clip.mp4', 'prompt');
  const data = buildExtendCallData(
    {
      generatePrompt: 'generate prompt',
      extendPrompt: '  ',
      extendStart: EXTEND_START_LAST_FRAME,
      customImage: {
        path: '/tmp/gradio/img.png',
        url: '',
        orig_name: 'img.png',
        mime_type: 'image/png',
        meta: { _type: 'gradio.FileData' },
      },
      durationSeconds: 10,
      steps: 30,
      negativePrompt: 'neg',
      seed: 42.2,
      randomizeSeed: true,
      quality: 6,
      fps: 128,
      safeMode: true,
      state,
      targetSeconds: 14,
    },
    'extend',
  );
  assert.equal(data.length, 13);
  assert.equal(data[0], 'generate prompt');
  assert.equal(data[1], '');
  assert.equal(data[2], EXTEND_START_LAST_FRAME);
  assert.equal(data[3], null);
  assert.equal(data[4], 5);
  assert.equal(data[5], 12);
  assert.equal(data[6], 'neg');
  assert.equal(data[7], 42);
  assert.equal(data[8], true);
  assert.equal(data[9], 6);
  assert.equal(data[10], 64);
  assert.equal(data[11], true);
  assert.equal(data[12], state);
});

test('auto-extend prepends the target and keeps a custom start image', () => {
  const state = seedExtendState('/tmp/gradio/abc/clip.mp4', 'prompt');
  const image = {
    path: '/tmp/gradio/img.png',
    url: '',
    orig_name: 'img.png',
    mime_type: 'image/png',
    meta: { _type: 'gradio.FileData' as const },
  };
  const data = buildExtendCallData(
    {
      generatePrompt: 'generate prompt',
      extendPrompt: 'push in',
      extendStart: EXTEND_START_UPLOAD,
      customImage: image,
      durationSeconds: 3.5,
      steps: 4,
      negativePrompt: 'neg',
      seed: 1,
      randomizeSeed: false,
      quality: 6,
      fps: 16,
      safeMode: true,
      state,
      targetSeconds: 14,
    },
    'auto',
  );
  assert.equal(data[0], 14);
  assert.equal(data[2], 'push in');
  assert.equal(data[3], EXTEND_START_UPLOAD);
  assert.equal(data[4], image);
});

test('status line and file URLs come back ready for the phone', () => {
  assert.equal(
    shortExtendStatus('**Segments:** 2 · **Duration ≈ 7.0s** · Upstream: `kulkas2pintu/wan222`'),
    'Segments 2/6 · Duration ≈ 7.0s',
  );
  const payload = extractExtendPayload(
    [
      { video: { path: '/tmp/gradio/abc/current_2.mp4', url: '/gradio_api/file=/tmp/gradio/abc/current_2.mp4' } },
      null,
      '**Segments:** 2 · **Duration ≈ 7.0s**',
      { path: '/tmp/wan22_extend/last_frame.png', url: null },
      {
        dir: '/tmp/gradio/abc',
        segments: ['/tmp/gradio/abc/clip.mp4', '/tmp/gradio/abc/seg.mp4'],
        video: '/tmp/gradio/abc/current_2.mp4',
        prompt: 'push in',
        last_frame: '/tmp/wan22_extend/last_frame.png',
      },
    ],
    origin,
  );
  assert.equal(payload.url, `${origin}/gradio_api/file=/tmp/gradio/abc/current_2.mp4`);
  assert.equal(payload.lastFrameUrl, `${origin}/gradio_api/file=/tmp/wan22_extend/last_frame.png`);
  assert.equal(payload.segments, 2);
  assert.equal(payload.durationSeconds, 7);
  assert.equal(payload.state?.segments.length, 2);
  assert.equal(publicFileUrl('https://example.com/a.mp4', origin), 'https://example.com/a.mp4');
});

test('segment counter keeps the cap when the Space only saw the uploaded file', () => {
  assert.equal(mergeSegmentCount(1, false, 4), 4);
  assert.equal(mergeSegmentCount(4, true, 5), 5);
  assert.equal(mergeSegmentCount(4, false, 2), 5);
  assert.equal(mergeSegmentCount(2, false, undefined), 3);
});
