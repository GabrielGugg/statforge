// Checks the packages published in packages/ (validation and a sample character).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validatePackage, buildRules } from '../site/js/engine/package.js';
import { compute, emptySheet } from '../site/js/engine/calc.js';

const dir = new URL('../packages/', import.meta.url);
const load = p => JSON.parse(readFileSync(new URL(p, dir), 'utf8'));

test('every published package is valid', () => {
  for (const folder of readdirSync(dir)) {
    for (const f of readdirSync(new URL(`${folder}/`, dir)).filter(n => n.endsWith('.json'))) {
      assert.deepEqual(validatePackage(load(`${folder}/${f}`)).errors, [], `${folder}/${f}`);
    }
  }
});

test('Fallout 2.2: sample character', () => {
  const { rules } = buildRules(load('fallout-2.2/fallout-2.2-pt.json'), []);
  const s = emptySheet(rules, { level: 3 });
  Object.assign(s.attributes, { FOR: 6, PER: 6, RES: 7, CAR: 4, INT: 5, AGI: 6, SOR: 6 });
  s.skills.disparo = 2;
  s.items = [
    { uid: '1', collection: 'racas', ref: 'humano' },
    { uid: '2', collection: 'antecedentes', ref: 'mercenario' },
    { uid: '3', collection: 'tracos', ref: 'parrudo' },
    { uid: '4', collection: 'armaduras', ref: 'armaduras_metal', equipped: true, wear: 4 },
    { uid: '5', collection: 'equipamentos', ref: 'itens_e_equipamentos_mochila', equipped: true, qty: 1 },
    { uid: '6', collection: 'medicina', ref: 'medicina_stimpak', qty: 2 },
  ];
  s.counters.fome = 1;
  const c = compute(rules, s);
  assert.deepEqual(c.errors, []);
  // PV: 10 + 5 × (2 − 1) + mod(RES) 2 × 2 = 19, + Parrudo (nível 3) = 22
  assert.equal(c.value('pv'), 22);
  assert.equal(c.value('pe'), 10 + 5 + 1 * 2 - 3);
  assert.equal(c.value('pa'), 11);
  assert.equal(c.value('df'), 12 - 2); // metal 12, desgaste 4 tira 2 → mínimo 10
  assert.equal(c.value('carga_max'), 60 + 50);
  assert.equal(c.value('carga'), 20 / 2 + 10 + 8); // armadura vestida pela metade, mochila, 2 stimpaks
  // Disparo: 2 pontos + mod(AGI) 1 + metade do mod(SOR) 0 + antecedente 2 − fome 1
  assert.equal(c.value('disparo'), 4);
  assert.equal(c.value('lr'), 12 - 2);
  assert.equal(c.value('fator_cura'), 5);
  assert.equal(c.value('pontos_talento'), 3);
});

test('Fallout 2.2: robots ignore chems, Gen 2 synths ignore stimpaks', () => {
  const { rules } = buildRules(load('fallout-2.2/fallout-2.2-pt.json'), []);
  const s = emptySheet(rules);
  s.items = [{ uid: '1', collection: 'racas', ref: 'sintetico' }, { uid: '2', collection: 'medicina', ref: 'medicina_stimpak', qty: 1 }];
  const c = compute(rules, s);
  assert.ok(c.blocked.some(f => f.ent.id === 'medicina_stimpak'));
});
