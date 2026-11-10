import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanBackup, configForFile, safeLink } from '../site/js/engine/backup.js';

const load = n => JSON.parse(readFileSync(new URL(`../examples/${n}`, import.meta.url), 'utf8'));
const system = load('en/system.json');
const backup = extra => ({ app: 'statforge', backup: 1, packages: [], sheets: [], config: {}, ...extra });

// A backup file can come from anyone: it must never bring someone else's Google access.
test('a backup never restores Google access, shares or custom addresses', () => {
  const { config, skipped } = cleanBackup(backup({ config: {
    syncToken: { value: 'attacker', expires: Date.now() + 3600e3, scope: 'x' }, syncEnabled: true, syncEmail: 'evil@example.com',
    syncClientId: 'evil.apps.googleusercontent.com', hubUrl: 'https://evil.example/index.json', gmPickerKey: 'AIza-evil',
    shares: { s1: { fileId: 'x'.repeat(20), email: 'evil@example.com' } }, 'gmCache:t:f': { sheet: {} }, deleted: { 'sheets/a': '2099-01-01' },
    language: 'pt-BR', theme: 'dark', debug: true,
  } }));
  assert.deepEqual(config, { language: 'pt-BR', theme: 'dark', debug: true });
  for (const k of ['syncToken', 'syncEnabled', 'syncEmail', 'syncClientId', 'hubUrl', 'gmPickerKey', 'shares', 'gmCache:t:f', 'deleted']) assert.ok(skipped.settings.includes(k), k);
});

test('settings with the wrong kind of value are skipped', () => {
  const { config } = cleanBackup(backup({ config: { language: { x: 1 }, debug: 'yes', order: ['a', 1, '../x', 'b'], 'layout:fallout': { a: 1 }, 'layout:../x': {} } }));
  assert.deepEqual(config, { order: ['a', 'b'], 'layout:fallout': { a: 1 } });
});

test('packages are validated like any install; invalid ones are skipped by name', () => {
  const broken = { id: 'bad', name: 'Broken', type: 'system' };
  const r = cleanBackup(backup({ packages: [{ ...system, _source: 'javascript:alert(1)', _installed: '2026-01-01' }, broken, 'nope'] }));
  assert.equal(r.packages.length, 1);
  assert.equal(r.packages[0].id, system.id);
  assert.equal(r.packages[0]._source, null, 'only https links are kept');
  assert.deepEqual(r.skipped.packages, ['Broken', '?']);
});

test('sheets need an id and a well-formed system; prototype keys are dropped', () => {
  const evil = JSON.parse('{"id":"s1","system":"fallout","name":"A\\u202eB","__proto__":{"polluted":1}}');
  const r = cleanBackup(backup({ sheets: [evil, { id: '', system: 'x' }, { id: 's2', system: '../x' }, { id: 's3', system: 'x', extensions: [1] }] }));
  assert.equal(r.sheets.length, 1);
  assert.equal(r.sheets[0].name, 'AB');
  assert.equal({}.polluted, undefined);
  assert.equal(r.skipped.sheets, 3);
});

test('GM tables come in only through the normalizer', () => {
  const tables = [{ id: 't1', system: 'fallout', members: [] }];
  assert.ok(cleanBackup(backup({ config: { gmTables: tables } })).skipped.settings.includes('gmTables'));
  const seen = [];
  const r = cleanBackup(backup({ config: { gmTables: tables } }), { normalizeTables: l => { seen.push(l); return [{ id: 't1' }]; } });
  assert.deepEqual(r.config.gmTables, [{ id: 't1' }]);
  assert.equal(seen.length, 1);
});

test('anything that is not a StatForge backup is refused', () => {
  for (const b of [null, [], 'x', { app: 'other' }]) assert.throws(() => cleanBackup(b), /BACKUP_INVALID/);
});

test('a backup file leaves out Google access, shares and other players\' sheets', () => {
  const out = configForFile({ syncToken: 1, syncEmail: 'a@b.c', shares: {}, 'gmCache:t:f': {}, gmTables: [], theme: 'dark', deleted: {} });
  assert.deepEqual(Object.keys(out).sort(), ['deleted', 'gmTables', 'theme']);
});

test('safeLink keeps https only', () => {
  assert.equal(safeLink('https://example.com/a.json'), 'https://example.com/a.json');
  for (const u of ['http://example.com', 'javascript:alert(1)', 'data:text/html,x', '', null, 5]) assert.equal(safeLink(u), null, String(u));
});
