import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, itemField, itemActive, modFits, modConflict } from '../site/js/engine/calc.js';
import { validatePackage } from '../site/js/engine/package.js';

// Weapons and armor with mods: field changes on the item ("item_effects") and effects of their own.
const rules = {
  attributes: {}, skills: { charm: { id: 'charm', name: 'Charm' } }, resources: {}, counters: {},
  derived: { defense: { id: 'defense', name: 'Defense', formula: "10 + sum('armor', 'def', true)" } },
  collections: {
    weapons: { equippable: true, mods: { collection: 'upgrades' }, fields: { dmg: { type: 'dice' }, crit: { type: 'crit' }, atk: { type: 'number' } } },
    armor: { equippable: true, mods: 'upgrades', fields: { def: { type: 'number' }, pen: { type: 'number' } } },
    upgrades: {},
  },
  entities: {
    weapons: { sword: { id: 'sword', name: 'Sword', dmg: '1d8', crit: '19', atk: 0 }, axe: { id: 'axe', name: 'Axe', dmg: '1d8', crit: 'x3' } },
    armor: { mail: { id: 'mail', name: 'Mail', def: 5, pen: 2 } },
    upgrades: {
      sharp: { id: 'sharp', name: 'Sharp', item_effects: [{ field: 'crit', margin: 1 }] },
      heavy: { id: 'heavy', name: 'Heavy', item_effects: [{ field: 'crit', mult: 1 }] },
      keen: { id: 'keen', name: 'Keen', item_effects: [{ field: 'crit', margin_double: true }] },
      cruel: { id: 'cruel', name: 'Cruel', item_effects: [{ field: 'dmg', add: 1 }, { field: 'atk', add: 1 }] },
      fire: { id: 'fire', name: 'Fire', item_effects: [{ field: 'dmg', add: '1d6' }] },
      thick: { id: 'thick', name: 'Thick', item_effects: [{ field: 'def', add: 1 }, { field: 'pen', add: 1 }] },
      fitted: { id: 'fitted', name: 'Fitted', item_effects: [{ field: 'pen', add: -5, min: 0 }] },
      gold: { id: 'gold', name: 'Gold', effects: [{ type: 'add', target: 'charm', value: 2 }] },
    },
  },
};
const it = (uid, collection, ref, extra = {}) => ({ uid, collection, ref, ...extra });

test('mods: item fields change with what is installed', () => {
  const sheet = { items: [
    it('w1', 'weapons', 'sword', { equipped: true, mods: ['m1', 'm2', 'm3'] }), it('m1', 'upgrades', 'sharp'), it('m2', 'upgrades', 'cruel'), it('m3', 'upgrades', 'fire'),
    it('w2', 'weapons', 'axe', { mods: ['m4', 'm5'] }), it('m4', 'upgrades', 'keen'), it('m5', 'upgrades', 'heavy'),
    it('a1', 'armor', 'mail', { equipped: true, mods: ['m6', 'm7'] }), it('m6', 'upgrades', 'thick'), it('m7', 'upgrades', 'fitted'),
  ] };
  const get = (uid, f) => itemField(rules, sheet, sheet.items.find(i => i.uid === uid), f);
  assert.equal(get('w1', 'crit'), '18', 'threat 19 widened by 1');
  assert.equal(get('w1', 'dmg'), '1d8+1d6+1');
  assert.equal(get('w1', 'atk'), 1);
  assert.equal(get('w2', 'crit'), '19/x4', 'x3 doubled to 19-20, then multiplier +1');
  assert.equal(get('a1', 'def'), 6);
  assert.equal(get('a1', 'pen'), 0, 'never below "min"');
  assert.equal(compute(rules, sheet).value('defense'), 16, 'sum() counts the mods');
});

test('mods: a mod works only installed in an active item', () => {
  const gold = it('g', 'upgrades', 'gold');
  const ring = it('w', 'weapons', 'sword', { equipped: false, mods: ['g'] });
  let sheet = { items: [gold] };
  assert.equal(itemActive(rules, gold, sheet), false, 'loose in the inventory');
  assert.equal(compute(rules, sheet).value('charm'), 0);
  sheet = { items: [ring, gold] };
  assert.equal(compute(rules, sheet).value('charm'), 0, 'installed in an unequipped item');
  ring.equipped = true;
  assert.equal(compute(rules, sheet).value('charm'), 2);
});

test('mods: item_effects validation', () => {
  const pkg = ie => ({ format: 1, id: 'x', name: 'x', type: 'system', language: 'en', collections: { upgrades: {} }, entities: { upgrades: [{ id: 'a', name: 'A', item_effects: ie }] } });
  assert.deepEqual(validatePackage(pkg([{ field: 'dmg', add: '1d6' }, { field: 'crit', margin: 1 }])).errors, []);
  assert.ok(validatePackage(pkg([{ add: 1 }])).errors.length);
  assert.ok(validatePackage(pkg([{ field: 'dmg', add: 'lots' }])).errors.length);
  assert.ok(validatePackage(pkg({ field: 'dmg' })).errors.length);
});

test('mods: several groups per collection (upgrades, enchantments, materials)', () => {
  const r = structuredClone(rules);
  r.collections.weapons.mods = [{ collection: 'upgrades' }, { collection: 'materials', max: 1 }];
  r.collections.materials = {};
  r.entities.materials = { silver: { id: 'silver', name: 'Silver', effects: [{ type: 'add', target: 'charm', value: 1 }], item_effects: [{ field: 'crit', margin: 1 }] } };
  const w = it('w', 'weapons', 'sword', { equipped: true, mods: ['s'] });
  const sheet = { items: [w, it('s', 'materials', 'silver')] };
  assert.equal(itemField(r, sheet, w, 'crit'), '18');
  assert.equal(compute(r, sheet).value('charm'), 1, 'a material of a list group is a mod too');
  w.equipped = false;
  assert.equal(compute(r, sheet).value('charm'), 0);
});

test('mods: fits, needs, excludes', () => {
  const r = {
    entities: {
      weapons: { bow: { id: 'bow', name: 'Bow', tags: ['ranged'] }, sling: { id: 'sling', name: 'Sling', tags: ['ranged'] }, sword: { id: 'sword', name: 'Sword', tags: [] } },
      upgrades: {
        scope: { id: 'scope', name: 'Scope', tags: ['up'], fits: [{ field: 'tags', values: ['ranged'] }, { field: 'id', not: ['sling'] }] },
        cruel: { id: 'cruel', name: 'Cruel', tags: ['up'] },
        atrocious: { id: 'atrocious', name: 'Atrocious', tags: ['up'], needs: { refs: ['cruel'] } },
        keen: { id: 'keen', name: 'Keen', tags: ['up'], excludes: ['heavy'] },
        heavy: { id: 'heavy', name: 'Heavy', tags: ['up'] },
        tuned: { id: 'tuned', name: 'Tuned', tags: ['up'], needs: { tag: 'up', text: 'Needs another upgrade' } },
      },
    },
  };
  const U = r.entities.upgrades, W = r.entities.weapons, g = { tags: ['up'] };
  assert.equal(modFits(g, U.scope, W.bow), true);
  assert.equal(modFits(g, U.scope, W.sling), false, '"not" on the id');
  assert.equal(modFits(g, U.scope, W.sword), false, '"values" on a list field');
  assert.equal(modFits({ tags: ['other'] }, U.cruel, W.sword), false);
  const m = ref => ({ collection: 'upgrades', ref });
  assert.deepEqual(modConflict(r, U.atrocious, 'upgrades', []), { type: 'needs', names: ['Cruel'], text: undefined });
  assert.equal(modConflict(r, U.atrocious, 'upgrades', [m('cruel')]), null);
  assert.equal(modConflict(r, U.keen, 'upgrades', [m('heavy')]).type, 'excludes');
  assert.equal(modConflict(r, U.heavy, 'upgrades', [m('keen')]).name, 'Keen', 'either side may exclude');
  assert.equal(modConflict(r, U.tuned, 'upgrades', []).text, 'Needs another upgrade');
  assert.equal(modConflict(r, U.tuned, 'upgrades', [m('cruel')]), null);
});

test('mods: rules validation', () => {
  const pkg = e => ({ format: 1, id: 'x', name: 'x', type: 'system', language: 'en', collections: { upgrades: {} }, entities: { upgrades: [{ id: 'a', name: 'A', ...e }] } });
  assert.deepEqual(validatePackage(pkg({ fits: [{ field: 'id', not: ['b'] }], needs: { refs: ['b'] }, excludes: ['c'], counts_as: 2 })).errors, []);
  assert.ok(validatePackage(pkg({ fits: { values: ['x'] } })).errors.length);
  assert.ok(validatePackage(pkg({ needs: 'b' })).errors.length);
  assert.ok(validatePackage(pkg({ excludes: 'c' })).errors.length);
  assert.ok(validatePackage(pkg({ counts_as: 0 })).errors.length);
});
