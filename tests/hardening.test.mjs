import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../site/js/engine/formula.js';

// Formulas can come from a sheet someone else shared: inherited names must never reach built-ins.
test('formulas only see their own functions and values', () => {
  for (const f of ['constructor(1)', 'toString()', 'hasOwnProperty(1)', '__defineGetter__(1, 2)', 'valueOf()']) assert.throws(() => evaluate(f, { functions: {} }), f);
  for (const f of ['constructor', 'toString', '__proto__']) assert.throws(() => evaluate(f, { vars: {} }), f);
  assert.equal(evaluate('min(3, 2)'), 2);
  assert.equal(evaluate('x + 1', { vars: { x: 1 } }), 2);
});
