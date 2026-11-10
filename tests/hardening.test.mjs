import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, parse, MAX_FORMULA_DEPTH, MAX_FORMULA_LENGTH } from '../site/js/engine/formula.js';

// Formulas can come from a sheet someone else shared: inherited names must never reach built-ins.
test('formulas only see their own functions and values', () => {
  for (const f of ['constructor(1)', 'toString()', 'hasOwnProperty(1)', '__defineGetter__(1, 2)', 'valueOf()']) assert.throws(() => evaluate(f, { functions: {} }), f);
  for (const f of ['constructor', 'toString', '__proto__']) assert.throws(() => evaluate(f, { vars: {} }), f);
  assert.equal(evaluate('min(3, 2)'), 2);
  assert.equal(evaluate('x + 1', { vars: { x: 1 } }), 2);
});

// A formula from someone else's package or sheet must not exhaust the stack.
test('formulas have a length and a nesting limit', () => {
  const deep = n => '('.repeat(n) + '1' + ')'.repeat(n);
  assert.equal(evaluate(deep(MAX_FORMULA_DEPTH - 2)), 1);
  assert.throws(() => parse(deep(MAX_FORMULA_DEPTH + 1)), /deep|níveis/);
  assert.throws(() => parse('-'.repeat(MAX_FORMULA_DEPTH + 1) + '1'), /deep|níveis/);
  assert.throws(() => parse('1+'.repeat(MAX_FORMULA_LENGTH)), /long/);
  assert.equal(evaluate('1+'.repeat(1000) + '1'), 1001, 'long flat sums are fine');
});
