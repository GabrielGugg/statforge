import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePackage } from '../site/js/engine/package.js';
import { entries, entrySheet } from '../site/js/engine/compendium.js';

const comp = {
  format: 1, id: 'bestiary', name: 'Bestiary', version: '1.0.0', language: 'en', type: 'compendium', system: 'sys',
  entries: [
    { id: 'raider', name: 'Raider', kind: 'enemy', tags: ['human'], description: 'Bandit.\nGroups.',
      sheet: { level: 2, attributes: { STR: 6, NOPE: 9 }, skills: { melee: 2, ghost: 1 }, resources: { hp: 3 }, notes: { notes: 'Flees.', 'bad key': 'x' },
        items: [{ collection: 'weapons', ref: 'knife', equipped: true, qty: 2, wear: 1 }, { collection: 'weapons', ref: 'missing' }] } },
    { id: 'rat', name: 'Rat', kind: 'boss' },
  ],
};
const rules = {
  attributes: { STR: { id: 'STR', default: 5 }, AGI: { id: 'AGI', default: 5 } },
  skills: { melee: { id: 'melee' } }, resources: { hp: { id: 'hp' } }, counters: {},
  entities: { weapons: { knife: { id: 'knife' } } }, collections: { weapons: {} },
};

test('compendium packages are validated', () => {
  const r = validatePackage(comp);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1); // the unknown kind "boss"
  const bad = validatePackage({ format: 1, id: 'x', name: 'x', version: '1', language: 'en', type: 'compendium', entries: [{ id: 'a' }, { id: 'a', name: 'A', sheet: [] }] });
  assert.ok(bad.errors.length >= 3); // no system, no name, repeated id, sheet not an object
  assert.ok(validatePackage({ ...comp, entries: 'x' }).errors.length);
});

test('entries are listed cleaned', () => {
  const list = entries(comp);
  assert.deepEqual(list.map(e => [e.id, e.kind, e.level]), [['raider', 'enemy', 2], ['rat', 'other', 1]]);
});

test('an entry becomes a sheet calculated by the system', () => {
  const { sheet, missing, description } = entrySheet(rules, comp, 'raider', { id: 's1', system: 'sys' });
  assert.equal(sheet.name, 'Raider');
  assert.equal(sheet.level, 2);
  assert.deepEqual(sheet.attributes, { STR: 6, AGI: 5 });
  assert.deepEqual(sheet.skills, { melee: 2 });
  assert.deepEqual(sheet.resources, { hp: 3 });
  assert.deepEqual(sheet.notes, { notes: 'Flees.' });
  assert.equal(sheet.items.length, 1);
  assert.equal(sheet.items[0].ref, 'knife');
  assert.equal(sheet.items[0].qty, 2);
  assert.equal(sheet.items[0].equipped, true);
  assert.equal(sheet.items[0].wear, 1);
  assert.deepEqual(missing, ['weapons/missing']);
  assert.equal(description, 'Bandit.\nGroups.');
  assert.throws(() => entrySheet(rules, comp, 'nobody'), /ENTRY_NOT_FOUND/);
});

test('stat blocks: fixed values replace the formula, sections keep the text', async () => {
  const { compute } = await import('../site/js/engine/calc.js');
  const sys = {
    attributes: { STR: { id: 'STR', default: 5 } }, skills: { melee: { id: 'melee', attribute: 'STR' } },
    derived: { def: { id: 'def', formula: '10' } }, resources: { hp: { id: 'hp', max: '10 + STR' } }, counters: {},
    entities: { conditions: { hurt: { id: 'hurt', effects: [{ type: 'add', target: 'def', value: -2 }] } } }, collections: { conditions: {} },
  };
  const block = {
    format: 1, id: 'b', name: 'B', version: '1.0.0', language: 'en', type: 'compendium', system: 'sys',
    entries: [{ id: 'brute', name: 'Brute', kind: 'enemy',
      sheet: { attributes: { STR: 9 }, fixed: { hp: 28, def: 12, melee: 7, ghost: 3, STR: 1 } },
      sections: [{ title: 'Actions', items: [{ name: 'Sledgehammer (5 AP)', text: 'Melee +7, 2d10+4.' }, { bad: 1 }] }, { title: 'Empty', items: [] }] }],
  };
  assert.equal(validatePackage(block).errors.length, 1); // the item with no name or text
  block.entries[0].sections[0].items.pop();
  assert.deepEqual(validatePackage(block).errors, []);
  block.entries[0].sections[0].items.push({ bad: 1 }); // the app still skips it when reading
  const wrong = structuredClone(block); wrong.entries[0].sheet.fixed.hp = '28'; wrong.entries[0].sections = [{ items: 'x' }];
  wrong.entries[0].sections.length = 1;
  assert.equal(validatePackage(wrong).errors.length, 2);
  const { sheet, sections } = entrySheet(sys, block, 'brute', { id: 's', system: 'sys' });
  assert.deepEqual(sheet.fixed, { hp: 28, def: 12, melee: 7 }); // unknown ids and attributes stay out
  assert.deepEqual(sections, [{ title: 'Actions', items: [{ name: 'Sledgehammer (5 AP)', text: 'Melee +7, 2d10+4.' }] }]);
  let c = compute(sys, sheet);
  assert.equal(c.value('hp'), 28);
  assert.equal(c.value('melee'), 7);
  assert.equal(c.fixed('def'), true);
  assert.equal(c.explain('hp').fixed, true);
  sheet.items.push({ uid: 'x', collection: 'conditions', ref: 'hurt' });
  c = compute(sys, sheet);
  assert.equal(c.value('def'), 10); // effects still go on top
  delete sheet.fixed.hp;
  assert.equal(compute(sys, sheet).value('hp'), 19); // back to the rule
  assert.deepEqual(entries(block)[0].sections.length, 1);
});
