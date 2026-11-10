import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settingsOf, OWNER_DISPLAY } from '../site/js/gm.js';

test('players\' names and e-mails are hidden behind a spoiler by default', () => {
  assert.deepEqual(OWNER_DISPLAY, ['hover', 'never', 'always']);
  assert.equal(settingsOf({}).ownerDisplay, 'hover', 'default');
  assert.equal(settingsOf({ settings: { ownerDisplay: 'never' } }).ownerDisplay, 'never');
  assert.equal(settingsOf({ settings: { ownerDisplay: 'always' } }).ownerDisplay, 'always');
  assert.equal(settingsOf({ settings: { ownerDisplay: 'show-everything' } }).ownerDisplay, 'hover', 'unknown values fall back to hidden');
});
