import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseAnimateSize, headroomPadFilter } from './animate.ts';

test('chooseAnimateSize keeps portrait templates portrait', () => {
  const size = chooseAnimateSize(534, 1008);
  assert.equal(size.portrait, true);
  assert.ok(size.height > size.width);
  assert.ok(size.height <= 832);
  assert.equal(size.width % 16, 0);
  assert.equal(size.height % 16, 0);
});

test('chooseAnimateSize keeps landscape templates landscape', () => {
  const size = chooseAnimateSize(1280, 720);
  assert.equal(size.portrait, false);
  assert.ok(size.width >= size.height);
  assert.ok(size.width <= 832);
});

test('headroomPadFilter adds top pad without cropping width', () => {
  const filter = headroomPadFilter(1280, 720, 0.28);
  assert.match(filter, /^pad=1280:\d+:0:\d+:color=/);
  const match = filter.match(/^pad=1280:(\d+):0:(\d+):/);
  assert.ok(match);
  const outH = Number(match![1]);
  const padTop = Number(match![2]);
  assert.equal(outH, 720 + padTop);
  assert.ok(padTop >= 150);
});
