import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, itemField, itemActive } from '../site/js/engine/calc.js';
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
