import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costOf, costValues, pointsSpent, parseDice, rollDice, diceRange, convertRoll, rollSet, setTotal } from '../site/js/engine/attrgen.js';
import { validatePackage } from '../site/js/engine/package.js';

// Tormenta20's table: value → total cost, and rolled total → value.
const COST = { '-1': -1, 0: 0, 1: 1, 2: 2, 3: 4, 4: 7 };
const TABLE = [{ max: 7, value: -2 }, { max: 9, value: -1 }, { max: 11, value: 0 }, { max: 13, value: 1 }, { max: 15, value: 2 }, { max: 17, value: 3 }, { max: 18, value: 4 }];
const seq = values => { let i = 0; return () => values[i++ % values.length]; };

test('cost table: total cost per value, the book example spends 10', () => {
  assert.equal(costOf(COST, 3), 4);
  assert.equal(costOf(COST, 5), null);
  assert.deepEqual(costValues(COST), [-1, 0, 1, 2, 3, 4]);
  const starts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  assert.equal(pointsSpent({ A: 4, B: 2, C: 1, D: 1, E: 0, F: -1 }, starts, COST), 10);
  // Without a table, 1 point per +1.
  assert.equal(pointsSpent({ A: 3, B: -1 }, { A: 0, B: 0 }, null), 2);
});

test('dice: keep highest, range and bonus', () => {
  assert.deepEqual(parseDice('4d6kh3'), { n: 4, faces: 6, keep: 3, high: true, bonus: 0 });
  assert.equal(parseDice('d6'), null);
  assert.equal(parseDice('4d6; alert(1)'), null);
  assert.deepEqual(diceRange('4d6kh3'), { min: 3, max: 18 });
  assert.deepEqual(diceRange('2d6+6'), { min: 8, max: 18 });
  // Faces 1, 6, 3, 4 (random 0, .9, .4, .5): keeps 6, 4, 3.
  const r = rollDice('4d6kh3', seq([0, 0.9, 0.4, 0.5]));
  assert.deepEqual(r.dice, [1, 6, 3, 4]);
  assert.equal(r.total, 13);
});

test('roll table conversion follows the book', () => {
  assert.deepEqual([13, 8, 15, 18, 10, 9].map(n => convertRoll(n, TABLE)), [1, -1, 2, 4, 0, -1]);
  assert.equal(convertRoll(3, TABLE), -2);
  assert.equal(convertRoll(14, null), 14);
});

test('a set below min_total rolls the lowest again', () => {
  // First six rolls all give 1+1+1 (value -2); then 6+6+6 until the sum reaches 6.
  let calls = 0;
  const random = () => (calls++ < 24 ? 0 : 0.99);
  const set = rollSet({ dice: '4d6kh3', count: 6, table: TABLE, min_total: 6 }, random);
  assert.equal(set.length, 6);
  assert.ok(setTotal(set) >= 6);
});

test('package validation checks cost and roll', () => {
  const sys = steps => ({ format: 1, id: 't', name: 'T', version: '1.0.0', type: 'system', language: 'en',
    attributes: [{ id: 'A', name: 'A' }], creation: { steps } });
  assert.deepEqual(validatePackage(sys([{ type: 'attributes', points: 10, cost: COST, roll: { dice: '4d6kh3', table: TABLE, min_total: 6 } }])).errors, []);
  assert.equal(validatePackage(sys([{ type: 'attributes', cost: [1, 2] }])).errors.length, 1);
  assert.equal(validatePackage(sys([{ type: 'attributes', roll: { dice: 'xd6' } }])).errors.length, 1);
  assert.equal(validatePackage(sys([{ type: 'attributes', roll: { dice: '3d6', table: [{ max: 'a' }] } }])).errors.length, 1);
});
