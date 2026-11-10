import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkTarget } from '../site/js/ui/markdown.js';

// The guide and changelog are rendered as DOM nodes; links may only go to https pages or inside the app.
test('markdown links go only to https or inside the app', () => {
  assert.deepEqual(linkTarget('https://gabrielgugg.github.io/statforge/site/'), { href: '#/', internal: true });
  assert.deepEqual(linkTarget('https://gabrielgugg.github.io/statforge/site/#/packages'), { href: '#/packages', internal: true });
  assert.deepEqual(linkTarget('#/settings'), { href: '#/settings', internal: true });
  assert.equal(linkTarget('https://github.com/x').internal, false);
  for (const u of ['javascript:alert(1)', 'http://example.com', 'data:text/html,x', 'GUIDE.md', '', null]) assert.equal(linkTarget(u), null, String(u));
});
