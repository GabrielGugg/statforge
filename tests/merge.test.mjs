import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeData } from '../site/js/engine/merge.js';

test('newest sheet wins, deletions win over older copies, settings stay local', () => {
  const local = {
    sheets: [{ id: 'a', name: 'A local', updated: '2026-10-31T10:00:00Z' }, { id: 'b', name: 'B', updated: '2026-10-30T10:00:00Z' }],
    packages: [{ id: 'sys', version: '1.2.0' }],
    config: { theme: 'dark', syncLast: 'x' },
    deleted: { 'sheets/c': '2026-10-31T09:00:00Z' },
  };
  const remote = {
    sheets: [{ id: 'a', name: 'A remote', updated: '2026-10-31T11:00:00Z' }, { id: 'c', name: 'C', updated: '2026-10-31T08:00:00Z' }, { id: 'd', name: 'D', updated: '2026-10-31T08:00:00Z' }],
    packages: [{ id: 'sys', version: '1.10.0' }, { id: 'old', version: '1.0.0', _installed: '2026-10-01T00:00:00Z' }],
    config: { theme: 'light', unit: 'ft' },
    deleted: { 'sheets/b': '2026-10-31T00:00:00Z', 'packages/old': '2026-10-02T00:00:00Z' },
  };
  const m = mergeData(local, remote, Date.parse('2026-11-01T00:00:00Z'));
  const byId = Object.fromEntries(m.sheets.map(s => [s.id, s.name]));
  assert.deepEqual(byId, { a: 'A remote', d: 'D' });
  assert.deepEqual(m.packages.map(p => `${p.id}@${p.version}`), ['sys@1.10.0']);
  assert.deepEqual(m.config, { theme: 'dark', unit: 'ft' });
  assert.ok(m.deleted['sheets/c'] && m.deleted['sheets/b']);
});

test('first sync with an empty cloud keeps everything', () => {
  const m = mergeData({ sheets: [{ id: 'a', updated: '2026-10-31T10:00:00Z' }], packages: [{ id: 'p', version: '1.0.0' }], config: {} }, null);
  assert.equal(m.sheets.length, 1);
  assert.equal(m.packages.length, 1);
});

test('deletion marks older than 90 days are dropped after they are applied', () => {
  const now = Date.parse('2026-11-09T00:00:00Z');
  const m = mergeData(
    { sheets: [{ id: 'old', updated: '2026-01-01T00:00:00Z' }], packages: [], config: {}, deleted: { 'sheets/old': '2026-02-01T00:00:00Z', 'sheets/new': '2026-11-01T00:00:00Z' } },
    { sheets: [], packages: [], config: {}, deleted: { 'sheets/ancient': '2025-01-01T00:00:00Z' } }, now);
  assert.equal(m.sheets.length, 0, 'the old mark still deleted the older copy');
  assert.deepEqual(Object.keys(m.deleted), ['sheets/new']);
});
