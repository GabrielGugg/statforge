import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePackage, buildRules } from '../site/js/engine/package.js';
import { compute, emptySheet } from '../site/js/engine/calc.js';

// A tiny system with classes as levels (quantity = class level), as the Tormenta20 multiclass rule needs.
const sys = {
  format: 1, id: 'levels-test', name: 'Levels test', version: '1.0.0', type: 'system', language: 'en',
  attributes: [{ id: 'STR', name: 'Strength' }],
  resources: [{ id: 'hp', name: 'HP', max: '0' }],
  collections: {
    classes: { name: 'Classes', quantity: true },
    powers: { name: 'Powers' },
  },
  entities: {
    classes: [
      { id: 'fighter', name: 'Fighter', effects: [{ type: 'add', target: 'hp', value: '5 * qty' }, { type: 'note', text: 'Extra attack', if: 'qty >= 3' }] },
      { id: 'wizard', name: 'Wizard', effects: [{ type: 'add', target: 'hp', value: '2 * qty' }] },
    ],
    powers: [{ id: 'cleave', name: 'Cleave', tags: ['fighter'], requires: "qty('classes/fighter') >= 2" }],
  },
  progression: { level_up: { steps: [
    { type: 'pick', collection: 'classes', min: 1, max: 1, levels: true },
    { type: 'pick', collection: 'powers', min: 0, max: 1, groups: [{ title: 'Fighter', tag: 'fighter', if: "picked('classes/fighter')" }, { title: 'General', tag: 'general' }] },
  ] } },
};

test('levels: class levels live in the item quantity', () => {
  const { rules } = buildRules(sys);
  const s = emptySheet(rules, { level: 4 });
  s.items = [{ collection: 'classes', ref: 'fighter', qty: 3 }, { collection: 'classes', ref: 'wizard', qty: 1 }];
  const c = compute(rules, s);
  assert.equal(c.value('hp'), 17);
  assert.ok(c.lists.note.some(n => n.ef.text === 'Extra attack'));
  assert.equal(c.formula("qty('classes/fighter') >= 2"), true);
  s.items[0].qty = 1;
  assert.equal(compute(rules, s).lists.note.length, 0);
});

test('picked(): true only for what the assistant picked in this run', () => {
  const { rules } = buildRules(sys);
  const s = emptySheet(rules, { level: 2 });
  s.items = [{ collection: 'classes', ref: 'fighter', qty: 2 }];
  assert.equal(compute(rules, s).formula("picked('classes/fighter')"), false);
  s.picked = ['classes/fighter'];
  const c = compute(rules, s);
  assert.equal(c.formula("picked('classes/fighter')"), true);
  assert.equal(c.formula("picked('fighter')"), true);
  assert.equal(c.formula("picked('classes/wizard')"), false);
});

test('validator: pick step groups must be a list with valid formulas', () => {
  assert.equal(validatePackage(sys).errors.length, 0);
  const bad = structuredClone(sys);
  bad.progression.level_up.steps[1].groups = { title: 'x' };
  assert.ok(validatePackage(bad).errors.length > 0);
  const bad2 = structuredClone(sys);
  bad2.progression.level_up.steps[1].groups[0].if = "picked('classes/fighter'";
  assert.ok(validatePackage(bad2).errors.length > 0);
});

test("points(): a skill's recorded points, and skill_points_text in the validator", () => {
  const p = structuredClone(sys);
  p.skills = [{ id: 'fight', name: 'Fight', attribute: 'STR' }];
  p.skill_points_text = 'trained in {skill}';
  assert.equal(validatePackage(p).errors.length, 0);
  const { rules } = buildRules(p);
  assert.equal(rules.skill_points_text, 'trained in {skill}');
  const s = emptySheet(rules, { level: 1 });
  assert.equal(compute(rules, s).formula("points('fight') >= 1"), false);
  s.skills = { fight: 1 };
  assert.equal(compute(rules, s).formula("points('fight') >= 1"), true);
  assert.ok(validatePackage({ ...p, skill_points_text: 'no placeholder' }).errors.length > 0);
});
