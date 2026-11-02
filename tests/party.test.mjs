import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partyValue, checkPartyFormula } from '../site/js/engine/party.js';
import { evaluate } from '../site/js/engine/formula.js';

// Stand-in for compute(): each character answers formulas with its own values.
const char = (name, vals) => ({ name, calc: { formula: f => evaluate(f, { vars: vals, functions: { has: x => !!vals[`has_${x}`] } }) } });
const party = [char('Ana', { stealth: 3, cha: 6, has_leader: 1 }), char('Bob', { stealth: 1, cha: 4 }), char('Cid', { stealth: 5, cha: 5 })];

test('party formulas aggregate the characters', () => {
  assert.equal(partyValue("min(members('stealth'))", party).value, 1);
  assert.equal(partyValue("max(members('stealth'))", party).value, 5);
  assert.equal(partyValue("sum(members('stealth'))", party).value, 9);
  assert.equal(partyValue("floor(avg(members('cha')))", party).value, 5);
  assert.equal(partyValue("count(members(\"has('leader')\"))", party).value, 1);
  assert.equal(partyValue('size', party).value, 3);
  assert.equal(partyValue("floor(avg(members('cha'))) + count(members(\"has('leader')\"))", party).value, 6);
  assert.equal(partyValue("max(members('stealth'), 10)", party).value, 10);
  assert.equal(partyValue("min(members('stealth'))", []).value, 0);
});

test('errors: one character failing counts as 0 and is reported; a broken formula gives null', () => {
  const r = partyValue("sum(members('nope'))", party);
  assert.equal(r.value, 0); assert.equal(r.errors.length, 3);
  assert.equal(partyValue('sum(', party).value, null);
  assert.equal(checkPartyFormula("min(members('x')) + size"), true);
  assert.throws(() => checkPartyFormula('stealth + 1'), /unknown: stealth/);
  assert.throws(() => checkPartyFormula(''));
});
