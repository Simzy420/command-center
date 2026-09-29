import assert from 'node:assert/strict';
import test from 'node:test';
import { embedFrameAccepted } from './extend.ts';

test('a blocked frame is the accessible about:blank document', () => {
  assert.equal(
    embedFrameAccepted({
      contentDocument: { location: { href: 'about:blank' } },
      contentWindow: {},
    }),
    false,
  );
  assert.equal(embedFrameAccepted({ contentDocument: null, contentWindow: null }), false);
});

test('a cross-origin frame counts as accepted', () => {
  assert.equal(embedFrameAccepted({ contentDocument: null, contentWindow: {} }), true);
  assert.equal(
    embedFrameAccepted({
      contentDocument: { location: { href: 'https://simzy-wan22-extend.hf.space/' } },
      contentWindow: {},
    }),
    true,
  );
  const frame = {
    get contentDocument(): { location?: { href?: string } } | null {
      throw new Error('cross-origin');
    },
    contentWindow: {},
  };
  assert.equal(embedFrameAccepted(frame), true);
});
