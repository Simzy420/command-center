import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PERCHANCE_PHOTO_URL } from './perchance.ts';
import { isPerchanceImageUrl, parsePerchanceFrameText, perchanceGenerateUrl } from './imagegen/perchanceUrl.ts';
import { normalizeStillImageProvider, stillAdapterKind } from './imagegen/provider.ts';

test('Perchance is an in-app stills provider and keeps a secondary site link', () => {
  assert.equal(PERCHANCE_PHOTO_URL, 'https://perchance.org/ai-photo-generator');
  assert.equal(normalizeStillImageProvider('perchance'), 'perchance');
  assert.equal(stillAdapterKind('perchance', false), 'perchance');
  assert.equal(stillAdapterKind('perchance', true), 'perchance');
  const widget = readFileSync('src/components/widgets/ImageGenWidget.tsx', 'utf8');
  const switcher = readFileSync('src/components/image/StillProviderSwitch.tsx', 'utf8');
  assert.match(switcher, /setStillProvider\('perchance'\)/);
  assert.match(switcher, /Perchance/);
  assert.match(widget, /Open on Perchance.org/);
  assert.match(widget, /target="_blank"/);
  assert.match(widget, /PERCHANCE_PHOTO_URL/);
  assert.match(widget, /setModel\('stills'\)/);
  const model = readFileSync('src/store/imageModel.ts', 'utf8');
  assert.equal(model.includes("'perchance'"), false);
});

test('Perchance generation URL targets the official image API page', () => {
  const url = new URL(perchanceGenerateUrl('a red apple', 'cc1'));
  assert.equal(url.origin + url.pathname, 'https://perchance.org/perchance-ai-api');
  assert.equal(url.searchParams.get('prompt'), 'a red apple');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('resolution'), '512x512');
  assert.equal(url.searchParams.get('id'), 'cc1');
});

test('frame text parser keeps only a finished public image URL', () => {
  const sample =
    'v1/image — response { "ok": true, "id": null, "url": "https://user.uploads.dev/file/abc.jpg", "prompt": "cup" }';
  assert.deepEqual(parsePerchanceFrameText(sample), { url: 'https://user.uploads.dev/file/abc.jpg' });
  assert.equal(parsePerchanceFrameText('Generating image…'), null);
  assert.equal(parsePerchanceFrameText('{ "ok": true, "url": "https://evil.example/a.jpg" }'), null);
  assert.equal(isPerchanceImageUrl('https://user.uploads.dev/file/abc.jpg'), true);
  assert.equal(isPerchanceImageUrl('http://user.uploads.dev/file/abc.jpg'), false);
});
