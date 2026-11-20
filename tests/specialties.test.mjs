import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, specialtyId, addSpecialty, specialtiesOf } from '../site/js/engine/calc.js';
import { validatePackage } from '../site/js/engine/package.js';

// A tiny system: Craft has specialties; a race gives +2 to one Craft of the player's choice,
// a feat +2 to Craft (Armorer) only, and a condition −2 to every Craft.
const rules = {
  attributes: { INT: { id: 'INT', name: 'Int', default: 1 } },
  skills: {
    craft: { id: 'craft', name: 'Craft', attribute: 'INT', total: 'mod(INT) + if(points > 0, 2, 0)', specialties: ['Armorer', 'Cook'] },
    lore: { id: 'lore', name: 'Lore', attribute: 'INT' },
  },
  derived: {}, resources: {}, counters: {},
  collections: { feats: {} },
  entities: { feats: {
    clever: { id: 'clever', name: 'Clever', effects: [{ type: 'add', target: 'craft', value: 2, specialty: 'choose' }] },
    smith: { id: 'smith', name: 'Smith', effects: [{ type: 'add', target: 'craft', value: 2, specialty: 'Armorer' }] },
    dazed: { id: 'dazed', name: 'Dazed', effects: [{ type: 'add', target: 'craft', value: -2 }] },
  } },
};
const item = ref => ({ uid: ref, collection: 'feats', ref });

test('specialties: ids, adding and listing', () => {
  assert.equal(specialtyId('craft', 'Armeiro de Navio'), 'craft_armeiro_de_navio');
  assert.equal(specialtyId('craft', 'Alquímico!'), 'craft_alquimico');
  assert.equal(specialtyId('craft', '  '), null);
  const sheet = { skills: {}, items: [] };
  assert.equal(addSpecialty(rules, sheet, 'craft', ' Armorer '), 'craft_armorer');
  assert.equal(addSpecialty(rules, sheet, 'lore', 'History'), null, 'lore has no specialties');
  assert.deepEqual(sheet.specialties, { craft_armorer: { skill: 'craft', name: 'Armorer' } });
  assert.equal(specialtiesOf(rules, sheet).craft_armorer.name, 'Craft (Armorer)');
  // Junk in the sheet (a skill without specialties, an empty name) is ignored.
  assert.deepEqual(Object.keys(specialtiesOf(rules, { specialties: { x: { skill: 'lore', name: 'a' }, y: { skill: 'craft', name: '' } } })), []);
});

test('specialties: each one is its own skill, effects reach the right ones', () => {
  const sheet = { attributes: { INT: 1 }, skills: { craft_armorer: 1 }, items: [item('smith'), item('clever')],
    specialties: { craft_armorer: { skill: 'craft', name: 'Armorer' }, craft_cook: { skill: 'craft', name: 'Cook' } } };
  let c = compute(rules, sheet);
  assert.deepEqual(c.skills().map(s => s.id), ['craft', 'craft_armorer', 'craft_cook', 'lore']);
  assert.equal(c.value('craft_armorer'), 1 + 2 + 2, 'trained + Smith');
  assert.equal(c.value('craft_cook'), 1, 'untrained, no bonus: Smith is Armorer only and Clever is not chosen yet');
  assert.equal(c.value('craft'), 1, 'the plain skill gets no specialty bonus');
  assert.equal(c.formula("points('craft')"), 1, 'trained in Craft = any Craft');
  assert.deepEqual(c.specialtyChoices().map(x => [x.key, x.skill, x.chosen]), [['feats/clever', 'craft', null]]);
  sheet.specialtyChoice = { 'feats/clever': 'craft_cook' };
  c = compute(rules, sheet);
  assert.equal(c.value('craft_cook'), 3, 'Clever goes to the chosen one only');
  assert.equal(c.value('craft_armorer'), 5);
  sheet.items.push(item('dazed'));
  c = compute(rules, sheet);
  assert.equal(c.value('craft_cook'), 1, 'an effect without "specialty" reaches every Craft');
  assert.equal(c.value('craft_armorer'), 3);
  assert.equal(c.value('craft'), -1);
  assert.equal(c.explain('craft_armorer').total, 3);
});

test('specialties: validation', () => {
  const sys = (skill, effects) => ({ format: 1, id: 's', name: 's', type: 'system', language: 'en', skills: [skill], ...(effects ? { conditions: undefined } : {}) });
  assert.deepEqual(validatePackage(sys({ id: 'craft', name: 'Craft', specialties: ['Cook'] })).errors, []);
  assert.deepEqual(validatePackage(sys({ id: 'craft', name: 'Craft', specialties: true })).errors, []);
  assert.ok(validatePackage(sys({ id: 'craft', name: 'Craft', specialties: 'Cook' })).errors.length);
  assert.ok(validatePackage(sys({ id: 'craft', name: 'Craft', effects: [{ type: 'add', target: 'craft', value: 1, specialty: 3 }] })).errors.length);
});
