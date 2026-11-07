import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as rt from '../site/js/engine/rolltable.js';

test('rows are read from text', () => {
  const { rows, dice } = rt.parseRows('1-4: Acid rain\n5 a 8 - Sandstorm\n9 a lot of nothing\nFog\n\n');
  assert.deepEqual(rows, [{ from: 1, to: 4, text: 'Acid rain' }, { from: 5, to: 8, text: 'Sandstorm' }, { from: 9, to: 9, text: 'a lot of nothing' }, { from: 10, to: 10, text: 'Fog' }]);
  assert.equal(dice, '1d10');
  assert.equal(rt.rowsText(rows).split('\n')[0], '1-4: Acid rain');
});

test('tables are cleaned, rolled and checked for gaps', () => {
  let n = 0;
  const tb = rt.normalizeTable({ name: ' Loot ', dice: '1d6', rows: [{ from: 3, to: 1, text: '2d10 caps' }, { from: 5, to: 6, text: 'Ammo' }, { from: 'x', text: 'bad' }] }, () => `id${++n}`);
  assert.equal(tb.name, 'Loot');
  assert.deepEqual(tb.rows[0], { from: 1, to: 3, text: '2d10 caps' });
  assert.equal(tb.rows.length, 2);
  assert.deepEqual(rt.gaps(tb), [4]);
  const r = rt.rollTable(tb, () => 0); // every die rolls 1
  assert.equal(r.total, 1);
  assert.equal(r.text, '2 caps');
  assert.equal(rt.normalizeTable({ name: '' }, () => 'x'), null);
  assert.equal(rt.validDice('2d6+1'), true);
  assert.equal(rt.validDice('d'), false);
  assert.deepEqual(rt.diceRange('2d6+1'), [3, 13]);
});

test('export and import', () => {
  const tb = rt.normalizeTable({ name: 'A', dice: '1d2', rows: [{ from: 1, to: 2, text: 'x' }] }, () => 'a1');
  const file = rt.exportFile([tb]);
  const back = rt.importFile(JSON.parse(JSON.stringify(file)), () => 'new');
  assert.equal(back[0].id, 'new');
  assert.equal(back[0].name, 'A');
  assert.throws(() => rt.importFile({ foo: 1 }, () => 'x'), /TABLES_INVALID/);
  assert.throws(() => rt.importFile({ statforge_tables: 1, tables: [{ name: '' }] }, () => 'x'), /TABLES_INVALID/);
});
