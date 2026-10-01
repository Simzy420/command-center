import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureWheelWarriorWidget } from './ensureWheelWarrior.ts';
import type { LayoutDocument } from '../types/layout.ts';

const doc = (widgets: LayoutDocument['widgets']): LayoutDocument => ({ version: 1, boards: [], widgets, updatedAt: 0 });

test('adds the game to the top of Media and shifts Media widgets down', () => {
  const base = doc([
    { id: 'a', type: 'imagegen', x: 0, y: 0, w: 12, h: 14, page: 'media', settings: {} },
    { id: 'b', type: 'chat', x: 0, y: 0, w: 12, h: 8, page: 'home', settings: {} },
  ]);
  const next = ensureWheelWarriorWidget(base, () => 'g');
  assert.equal(next.widgets[0].type, 'wheelwarrior');
  assert.equal(next.widgets[0].page, 'media');
  assert.equal(next.widgets.find((w) => w.id === 'a')?.y, 14);
  assert.equal(next.widgets.find((w) => w.id === 'b')?.y, 0);
});

test('leaves a layout that already has it alone', () => {
  const base = doc([{ id: 'g', type: 'wheelwarrior', x: 0, y: 3, w: 6, h: 9, page: 'home', settings: {} }]);
  assert.equal(ensureWheelWarriorWidget(base, () => 'x'), base);
});
