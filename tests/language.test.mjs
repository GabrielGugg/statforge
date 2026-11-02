import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePackage } from '../site/js/engine/package.js';

test('"language": "*" is accepted for packages with no text; other odd values are not', () => {
  const theme = language => ({ format: 1, id: 'th', name: 'Theme', type: 'theme', version: '1', language, colors: {} });
  assert.deepEqual(validatePackage(theme('*')).errors, []);
  assert.deepEqual(validatePackage(theme('pt-BR')).errors, []);
  assert.ok(validatePackage(theme('**')).errors.length);
  assert.ok(validatePackage(theme('any language')).errors.length);
});
