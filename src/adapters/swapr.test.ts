import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SWAPR_APP_URL, SWAPR_FACE_SWAP_URL, SWAPR_MIX_SPACE_URL } from './swapr.ts';

test('Swapr URLs point at the four-button app and Face Swap deep link', () => {
  assert.equal(SWAPR_APP_URL, 'https://wan22-templates.vercel.app/');
  assert.equal(SWAPR_FACE_SWAP_URL, 'https://wan22-templates.vercel.app/#faceswap');
  assert.equal(SWAPR_MIX_SPACE_URL, 'https://simzy-face-swap-extend-video.hf.space/');

  const panel = readFileSync('src/components/widgets/SwaprPanel.tsx', 'utf8');
  assert.match(panel, /SWAPR_FACE_SWAP_URL/);
  assert.match(panel, /Face Swap \(video clip\)/);
  assert.match(panel, /Or a video clip of both people/);
  assert.match(panel, /Swap advanced/);
  assert.match(panel, /Colored face marks/);
  assert.match(panel, /body-part replace marks/);
  assert.match(panel, /SWAPR_MIX_SPACE_URL/);
  // Command center must not ship its own face/body marker canvas — Space owns that UI.
  assert.equal(/canvas|Annotat|ImageEditor|face-mark/i.test(panel), false);
});
