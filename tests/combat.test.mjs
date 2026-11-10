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
  assert.deepEqual(cb.fromSheet(rules, sheet, { value: () => 9 }), { hp: 4, hpMax: 9, vals: {}, conditions: ['cond/blind'] });
});

test('the system combat field is checked', () => {
  const base = { format: 1, id: 's', name: 'S', version: '1', language: 'en', type: 'system', resources: [{ id: 'hp', max: '10' }], collections: { cond: {} }, layout: { tabs: [{}] } };
  assert.deepEqual(validatePackage({ ...base, combat: { initiative: '1d20 + 2', hp: 'hp', conditions: 'cond' } }).errors, []);
  assert.ok(validatePackage({ ...base, combat: { initiative: '1d20 +' } }).errors.length);
  assert.equal(validatePackage({ ...base, combat: { hp: 'nope' } }).warnings.length, 1);
});

const FR = {
  resources: { pv: { name: 'Pontos de Vida', abbr: 'PV' }, pe: { name: 'Pontos de Estamina', abbr: 'PE' } },
  derived: { df: { name: 'Defesa', abbr: 'DF' }, td: { name: 'TD', abbr: 'TD' } },
  attributes: {},
  combat: { hp: 'pv', stats: ['pe', 'pv', 'df', 'td', 'nope'], damage: ['pe', { reduce: 'td' }, 'pv'] },
};
const F = (pe, pv, td) => ({ hp: pv, hpMax: 10, vals: { pe: { cur: pe, max: 14 }, df: { cur: 12, max: null }, td: { cur: td, max: null } } });

test('stat columns and damage order', () => {
  assert.deepEqual(cb.statColumns(FR).map(c => [c.id, c.abbr, c.resource]), [['pe', 'PE', true], ['pv', 'PV', true], ['df', 'DF', false], ['td', 'TD', false]]);
  assert.deepEqual(cb.damageSteps(FR), ['pe', { reduce: 'td' }, 'pv']);
  assert.deepEqual(cb.statColumns({ resources: { hp: {} }, derived: {} }).map(c => c.id), ['hp']);
  assert.deepEqual(cb.damageSteps({ resources: { hp: {} }, derived: {} }), ['hp']);
});

test('parse what the GM types', () => {
  assert.deepEqual(cb.parseChange('-20'), { op: 'sub', n: 20 });
  assert.deepEqual(cb.parseChange(' + 3 '), { op: 'add', n: 3 });
  assert.deepEqual(cb.parseChange('12'), { op: 'set', n: 12 });
  assert.deepEqual(cb.parseChange('1,5'), { op: 'set', n: 1.5 });
  assert.equal(cb.parseChange('abc'), null);
  assert.equal(cb.parseChange(''), null);
});

test('damage empties stamina, is reduced by TD and goes to HP', () => {
  const p = F(14, 10, 2);
  const plan = cb.planChange(FR, p, 'pe', cb.parseChange('-20'));
  assert.deepEqual(plan, [{ id: 'pe', from: 14, to: 0 }, { id: 'td', reduce: 2 }, { id: 'pv', from: 10, to: 6 }]);
  cb.applyPlan(FR, p, plan);
  assert.equal(p.vals.pe.cur, 0); assert.equal(p.hp, 6);
  // TD bigger than what is left: HP untouched
  assert.deepEqual(cb.planChange(FR, F(14, 10, 8), 'pe', cb.parseChange('-20')), [{ id: 'pe', from: 14, to: 0 }, { id: 'td', reduce: 6 }]);
  // stamina enough: nothing else
  assert.deepEqual(cb.planChange(FR, F(14, 10, 2), 'pe', cb.parseChange('-5')), [{ id: 'pe', from: 14, to: 9 }]);
  // without cascade: only the stamina
  assert.deepEqual(cb.planChange(FR, F(14, 10, 2), 'pe', cb.parseChange('-20'), { cascade: false }), [{ id: 'pe', from: 14, to: 0 }]);
  // straight to HP, no TD, not below 0
  assert.deepEqual(cb.planChange(FR, F(14, 10, 2), 'pv', cb.parseChange('-30')), [{ id: 'pv', from: 10, to: 0 }]);
});

test('healing stops at the maximum; derived values change freely', () => {
  assert.deepEqual(cb.planChange(FR, F(10, 10, 2), 'pe', cb.parseChange('+8')), [{ id: 'pe', from: 10, to: 14 }]);
  assert.deepEqual(cb.planChange(FR, F(10, 10, 2), 'pv', cb.parseChange('+3')), [{ id: 'pv', from: 10, to: 10 }]);
  assert.deepEqual(cb.planChange(FR, F(10, 10, 2), 'td', cb.parseChange('+3')), [{ id: 'td', from: 2, to: 5 }]);
  assert.deepEqual(cb.planChange(FR, F(10, 10, 2), 'df', cb.parseChange('-3')), [{ id: 'df', from: 12, to: 9 }]);
  assert.deepEqual(cb.planChange(FR, F(10, 10, 2), 'pv', cb.parseChange('15')), [{ id: 'pv', from: 10, to: 15 }]);
});

test('values from a sheet', () => {
  const calc = { value: id => ({ pv: 10, pe: 14, df: 12, td: 3 })[id] };
  const v = cb.fromSheet(FR, { resources: { pe: 9 }, items: [] }, calc);
  assert.deepEqual(v, { hp: 10, hpMax: 10, vals: { pe: { cur: 9, max: 14 }, df: { cur: 12, max: null }, td: { cur: 3, max: null } }, conditions: [] });
});

test('validator checks combat.stats and combat.damage', () => {
  const base = { format: 1, id: 'x', name: 'X', version: '1.0.0', type: 'system', language: 'en',
    attributes: [], skills: [], resources: [{ id: 'hp', name: 'HP', max: '10' }, { id: 'sp', name: 'SP', max: '5' }], derived: [{ id: 'dt', name: 'DT', formula: '1' }] };
  const ok = validatePackage({ ...base, combat: { hp: 'hp', stats: ['sp', 'hp', 'dt'], damage: ['sp', { reduce: 'dt' }, 'hp'] } });
  assert.deepEqual(ok.errors, []);
  assert.ok(!ok.warnings.some(w => w.includes('combat.')));
  const bad = validatePackage({ ...base, combat: { stats: ['zz'], damage: ['dt', { reduce: 'qq' }, 5] } });
  assert.ok(bad.warnings.some(w => w.includes('combat.stats') && w.includes('zz')));
  assert.ok(bad.warnings.some(w => w.includes('combat.damage') && w.includes('dt')));
  assert.ok(bad.warnings.some(w => w.includes('combat.damage.reduce') && w.includes('qq')));
  assert.ok(bad.errors.some(e => e.includes('combat.damage')));
});

test('initiative ties: manual keeps order, players first, or a formula', () => {
  const mk = () => ({ round: 1, turn: 0, started: false, participants: [
    P('npc', 10), P('pc', 10, { kind: 'member', npc: false }), P('fast', 10, { kind: 'local', npc: true }), P('top', 15), P('blank', null),
  ] });
  let enc = mk(); cb.sortByInitiative(enc);
  assert.deepEqual(enc.participants.map(p => p.id), ['top', 'npc', 'pc', 'fast', 'blank'], 'manual: ties keep their order');
  enc = mk(); cb.sortByInitiative(enc, { tieBreak: 'players' });
  assert.deepEqual(enc.participants.map(p => p.id), ['top', 'pc', 'npc', 'fast', 'blank'], 'players before NPCs');
  const agi = { npc: 3, pc: 5, fast: 9 };
  enc = mk(); cb.sortByInitiative(enc, { tieBreak: 'formula', tieValue: p => agi[p.id] ?? null });
  assert.deepEqual(enc.participants.map(p => p.id), ['top', 'fast', 'pc', 'npc', 'blank'], 'higher formula value first');
  enc = mk(); cb.sortByInitiative(enc, { tieBreak: 'formula', tieValue: p => (p.id === 'pc' ? 1 : null) });
  assert.deepEqual(enc.participants.map(p => p.id), ['top', 'pc', 'npc', 'fast', 'blank'], 'no sheet: after those with a value, order kept');
  assert.equal(cb.isPlayer({ kind: 'member', npc: false }), true);
  assert.equal(cb.isPlayer({ kind: 'comp' }), false);
});
