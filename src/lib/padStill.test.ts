import assert from 'node:assert/strict';
import test from 'node:test';
import { WAN_ANIMATE_ASPECT, planStillPad } from './padStill.ts';

test('planStillPad keeps a tight portrait fully inside the landscape aspect', () => {
  const plan = planStillPad(900, 1100);
  assert.equal(plan.drawWidth, 900);
  assert.equal(plan.drawHeight, 1100);
  assert.ok(plan.padTop > plan.padBottom, 'headroom should exceed bottom pad');
  assert.ok(plan.padTop >= Math.round(1100 * 0.28));
  const aspect = plan.canvasWidth / plan.canvasHeight;
  assert.ok(Math.abs(aspect - WAN_ANIMATE_ASPECT) < 0.02);
  assert.equal(plan.drawX + plan.drawWidth + plan.padRight, plan.canvasWidth);
  assert.equal(plan.drawY + plan.drawHeight + plan.padBottom, plan.canvasHeight);
});

test('planStillPad never shrinks the source (no crop)', () => {
  const plan = planStillPad(832, 480, { topFrac: 0.3, sideFrac: 0.1, bottomFrac: 0.1 });
  assert.ok(plan.canvasWidth >= 832);
  assert.ok(plan.canvasHeight >= 480);
  assert.equal(plan.drawWidth, 832);
  assert.equal(plan.drawHeight, 480);
});

test('square close-ups get side and top padding', () => {
  const plan = planStillPad(640, 640);
  assert.ok(plan.padLeft >= Math.round(640 * 0.14));
  assert.ok(plan.padTop >= Math.round(640 * 0.28));
  assert.ok(plan.canvasWidth / plan.canvasHeight > 1);
});
