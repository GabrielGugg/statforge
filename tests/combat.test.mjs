import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cb from '../site/js/engine/combat.js';
import { validatePackage } from '../site/js/engine/package.js';

const P = (id, init, extra = {}) => ({ id, kind: 'comp', ref: 'c/e', name: id, npc: true, init, hp: 5, hpMax: 5, conditions: [], note: '', ...extra });

test('sort by initiative keeps ties and the current turn', () => {
  const enc = { round: 1, turn: 1, started: true, participants: [P('a', 5), P('b', 12), P('c', 5), P('d', null), P('e', 20)] };
  cb.sortByInitiative(enc);
  assert.deepEqual(enc.participants.map(p => p.id), ['e', 'b', 'a', 'c', 'd']);
  assert.equal(enc.participants[enc.turn].id, 'b');
});

test('turns and rounds', () => {
  const enc = { round: 1, turn: 0, started: false, participants: [P('a', 3), P('b', 2)] };
  cb.nextTurn(enc); assert.deepEqual([enc.started, enc.round, enc.turn], [true, 1, 0]);
  cb.nextTurn(enc); assert.deepEqual([enc.round, enc.turn], [1, 1]);
  cb.nextTurn(enc); assert.deepEqual([enc.round, enc.turn], [2, 0]);
  cb.prevTurn(enc); assert.deepEqual([enc.round, enc.turn], [1, 1]);
  cb.move(enc, 'b', 0); assert.equal(enc.participants[enc.turn].id, 'b');
  cb.remove(enc, 'a'); assert.equal(enc.participants[enc.turn].id, 'b');
});

test('who is rolled for, names, initiative roll', () => {
  assert.equal(cb.autoRolls('npcs', { kind: 'member', npc: false }), false);
  assert.equal(cb.autoRolls('npcs', { kind: 'local', npc: true }), true);
  assert.equal(cb.autoRolls('all', { kind: 'member' }), true);
  assert.equal(cb.autoRolls('none', { kind: 'comp', npc: true }), false);
  assert.deepEqual(cb.numberedNames('Raider', 2, ['Raider 1', 'Ana']), ['Raider 2', 'Raider 3']);
  assert.deepEqual(cb.numberedNames('Rat', 1, []), ['Rat']);
  const rules = { combat: { initiative: '1d20 + init', hp: 'hp', conditions: 'cond' }, resources: { hp: {} }, collections: { cond: {} } };
  const calc = { formula: txt => Number(eval(String(txt).replace('init', '3'))) };
  assert.equal(cb.rollInitiative(rules, calc, () => 0.5).total, 14);
  const sheet = { resources: { hp: 4 }, items: [{ collection: 'cond', ref: 'blind' }, { collection: 'x', ref: 'y' }] };
  assert.deepEqual(cb.fromSheet(rules, sheet, { value: () => 9 }), { hp: 4, hpMax: 9, conditions: ['cond/blind'] });
});

test('the system combat field is checked', () => {
  const base = { format: 1, id: 's', name: 'S', version: '1', language: 'en', type: 'system', resources: [{ id: 'hp', max: '10' }], collections: { cond: {} }, layout: { tabs: [{}] } };
  assert.deepEqual(validatePackage({ ...base, combat: { initiative: '1d20 + 2', hp: 'hp', conditions: 'cond' } }).errors, []);
  assert.ok(validatePackage({ ...base, combat: { initiative: '1d20 +' } }).errors.length);
  assert.equal(validatePackage({ ...base, combat: { hp: 'nope' } }).warnings.length, 1);
});
