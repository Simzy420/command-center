import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeImageGenModel } from './imageModel.ts';

test('image model persists stills, wan22, and wanExtend', () => {
  assert.equal(normalizeImageGenModel('stills'), 'stills');
  assert.equal(normalizeImageGenModel('wan22'), 'wan22');
  assert.equal(normalizeImageGenModel('wanExtend'), 'wanExtend');
});

test('unknown image model falls back to stills', () => {
  assert.equal(normalizeImageGenModel(undefined), 'stills');
  assert.equal(normalizeImageGenModel(null), 'stills');
  assert.equal(normalizeImageGenModel(''), 'stills');
  assert.equal(normalizeImageGenModel('extend'), 'stills');
});
