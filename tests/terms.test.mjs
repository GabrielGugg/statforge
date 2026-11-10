import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { termVariant, termDescription } from '../site/js/engine/terms.js';
import { validatePackage } from '../site/js/engine/package.js';

const lento = {
  id: 'lento', name: 'Lento', description: 'Ranged: the hit lands at the start of your next turn.',
  variants: [
    { collection: 'explosivos', description: 'Explosive: goes off after the time shown.' },
    { collection: 'armas', match: { tipo: ['Armas Cortantes', 'Armas Contundentes'] }, description: 'Melee: slow swing.' },
  ],
};

test('a term shows the variant that fits the item, else its own description', () => {
  assert.equal(termDescription(lento, { collection: 'explosivos', ent: { tipo: 'Explosivos Colocados' } }), 'Explosive: goes off after the time shown.');
  assert.equal(termDescription(lento, { collection: 'armas', ent: { tipo: 'Armas Cortantes' } }), 'Melee: slow swing.');
  assert.equal(termDescription(lento, { collection: 'armas', ent: { tipo: 'Rifles' } }), lento.description);
  assert.equal(termDescription(lento, null), lento.description, 'no item: the term itself');
  assert.equal(termVariant({ name: 'x', description: 'd' }, { collection: 'armas' }), null);
});

test('variants are validated', () => {
  const sys = JSON.parse(readFileSync(new URL('../examples/en/system.json', import.meta.url), 'utf8'));
  const col = Object.keys(sys.collections)[0];
  const withVariants = variants => ({ ...sys, entities: { ...sys.entities, [col]: [...(sys.entities?.[col] || []), { id: 'zz-term', name: 'Term', variants }] } });
  assert.deepEqual(validatePackage(withVariants([{ collection: col, description: 'ok' }])).errors, []);
  const bad = validatePackage(withVariants([{ collection: col }, 'x', { match: { tipo: { a: 1 } }, description: 'd' }]));
  assert.equal(bad.errors.length, 3, bad.errors.join('\n'));
  const warn = validatePackage(withVariants([{ collection: 'nope', description: 'd' }, { description: 'always' }]));
  assert.equal(warn.errors.length, 0);
  assert.ok(warn.warnings.length >= 2);
  assert.ok(validatePackage(withVariants('x')).errors.length);
});
