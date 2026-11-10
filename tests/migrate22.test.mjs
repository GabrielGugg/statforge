// TEMPORARY: goes away with engine/migrate22.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertSheet, compareSheets, migrationFor, MIGRATIONS } from '../site/js/engine/migrate22.js';

const base = (id, initiative) => ({
  format: 1, id, name: id, version: '1.0.0', type: 'system',
  attributes: [{ id: 'PER', name: 'PER', min: 1, max: 10, default: 5 }],
  derived: [{ id: 'ini', name: 'Ini', formula: initiative }],
});
const old = base('fallout-2.2-pt', 'mod(PER)');
const book = base('fallout-2.1-pt', '0');
const gugg = { format: 1, id: 'fallout-2.1-gugg-pt', name: 'Gugg', version: '1.0.0', type: 'extension', system: 'fallout-2.1-pt',
  patches: [{ op: 'modify', target: 'derived/ini', fields: { formula: 'mod(PER)' } }] };
const house = { format: 1, id: 'casa', name: 'Casa', version: '1.0.0', type: 'extension', system: 'fallout-2.2-pt', patches: [] };
const inst = Object.fromEntries([old, book, gugg, house].map(p => [p.id, p]));
const order = ['casa', 'fallout-2.1-gugg-pt'];
const sheet = { id: 's1', name: 'Rex', system: 'fallout-2.2-pt', extensions: ['casa'], versions: { 'fallout-2.2-pt': '1.24.0' },
  attributes: { PER: 8 }, items: [{ collection: 'x', ref: 'y', qty: 1 }], updated: '2026-01-01T00:00:00.000Z' };

test('only sheets of the old 2.2 packages are converted', () => {
  assert.equal(migrationFor(sheet).system, 'fallout-2.1-pt');
  assert.equal(migrationFor({ system: 'fallout-2.1-pt' }), null);
  assert.equal(MIGRATIONS.length, 2);
});

test('the converted sheet keeps its data and gets the system and the revision', () => {
  const { sheet: s, stale } = convertSheet(sheet, migrationFor(sheet), inst, '2026-11-10T00:00:00.000Z');
  assert.equal(s.system, 'fallout-2.1-pt');
  assert.deepEqual(s.extensions, ['fallout-2.1-gugg-pt', 'casa']);
  assert.deepEqual(s.versions, { 'fallout-2.1-pt': '1.0.0', 'fallout-2.1-gugg-pt': '1.0.0' });
  assert.deepEqual([s.id, s.name, s.attributes, s.items], [sheet.id, sheet.name, sheet.attributes, sheet.items]);
  assert.equal(s.updated, '2026-11-10T00:00:00.000Z');
  assert.deepEqual(stale, ['casa']);
  assert.equal(sheet.system, 'fallout-2.2-pt', 'the original is not changed');
});

test('the check finds no difference with the revision, and finds one without it', () => {
  const { sheet: s } = convertSheet(sheet, migrationFor(sheet), inst);
  assert.deepEqual(compareSheets(sheet, s, inst, order), []);
  const diffs = compareSheets(sheet, { ...s, extensions: [] }, inst, order);
  assert.deepEqual(diffs.map(d => d.id), ['ini']);
  assert.equal(compareSheets(sheet, s, { ...inst, 'fallout-2.2-pt': undefined }, order), null);
});
