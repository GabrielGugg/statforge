import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate, parse, identifiers } from '../site/js/engine/formula.js';
import { validatePackage, buildRules, checkSet, suggestOrder, compareVersions } from '../site/js/engine/package.js';
import { compute, emptySheet, roll } from '../site/js/engine/calc.js';
import { t, setLanguage, matchLanguage } from '../site/js/i18n.js';
import en from '../site/js/locales/en.js';
import ptBR from '../site/js/locales/pt-BR.js';

const load = n => JSON.parse(readFileSync(new URL(`../examples/${n}`, import.meta.url), 'utf8'));
const system = load('en/system.json');
const homebrew = load('en/homebrew.json');

test('formulas: arithmetic, precedence and functions', () => {
  assert.equal(evaluate('1 + 2 * 3'), 7);
  assert.equal(evaluate('(1 + 2) * 3'), 9);
  assert.equal(evaluate('-2 * -3'), 6);
  assert.equal(evaluate('floor(7 / 2)'), 3);
  assert.equal(evaluate('max(1, 5, 3) - min(4, 2)'), 3);
  assert.equal(evaluate('if(2 > 1, 10, 20)'), 10);
  assert.equal(evaluate('1 < 2 and 3 < 2'), false);
  assert.equal(evaluate('1 < 2 or 3 < 2'), true);
  assert.equal(evaluate('not true'), false);
  assert.equal(evaluate('10 / 0'), 0);
  assert.equal(evaluate('STR * 2', { vars: { STR: 6 } }), 12);
  assert.equal(evaluate("'a' == 'a'"), true);
});

test('formulas: clear errors and identifiers', () => {
  setLanguage('en');
  assert.throws(() => parse('1 +'), /Incomplete/);
  assert.throws(() => parse('1 + )'), /Unexpected/);
  assert.throws(() => evaluate('x + 1'), /Unknown value/);
  assert.throws(() => evaluate('foo(1)'), /Unknown function/);
  assert.deepEqual(identifiers('STR + mod(DEX) * level').sort(), ['DEX', 'STR', 'level']);
});

test('validation: examples pass, common mistakes are caught', () => {
  for (const lang of ['en', 'pt-BR']) {
    for (const n of ['system.json', 'homebrew.json', 'theme-pipboy.json', 'table.json']) {
      const r = validatePackage(load(`${lang}/${n}`));
      assert.deepEqual(r.errors, [], `${lang}/${n}`);
      assert.deepEqual(r.warnings, [], `${lang}/${n}`);
    }
  }
  const bad = { format: 1, id: 'x y', name: 'X', type: 'system', language: 'en', derived: [{ id: 'a', formula: '1 +' }, { id: 'a' }] };
  const { errors } = validatePackage(bad);
  assert.ok(errors.some(e => e.includes('"id"')));
  assert.ok(errors.some(e => e.includes('formula')));
  assert.ok(errors.some(e => e.includes('repeated')));
  assert.ok(validatePackage({ format: 2, id: 'a', name: 'a', type: 'theme', colors: {} }).errors.length);
  assert.ok(validatePackage({ format: 1, id: 'e', name: 'e', type: 'extension', system: 's', patches: [{ op: 'delete' }] }).errors.length);
  assert.ok(validatePackage({ format: 1, id: 'a', name: 'a', type: 'theme', colors: {}, language: 'english!' }).errors.length);
  assert.ok(validatePackage({ format: 1, id: 'a', name: 'a', type: 'theme', colors: {} }).warnings.some(w => w.includes('language')));
});

test('assembly: extension patches', () => {
  const { rules, log } = buildRules(system, [homebrew]);
  assert.equal(rules.entities.armor.shield.cost, 15);
  assert.equal(rules.entities.armor.shield.name, 'Shield');
  assert.equal(rules.entities.traits.tough.name, 'Sturdy');
  assert.equal(rules.entities.weapons.shortbow, undefined);
  assert.equal(rules.entities.conditions.prone.effects[0].target, 'ac');
  assert.equal(rules.entities.conditions.prone.collection, 'conditions');
  assert.ok(rules.entities.conditions['off-balance']);
  assert.equal(rules.origin['armor/shield'], 'example-homebrew');
  assert.equal(rules.language, 'en');
  assert.deepEqual(log, []);
  // The original system is not changed.
  assert.equal(system.entities.armor.find(a => a.id === 'shield').cost, 10);
});

test('assembly: conflicts and missing targets', () => {
  const other = { id: 'other', type: 'extension', patches: [
    { op: 'modify', target: 'armor/shield', fields: { cost: 99 } },
    { op: 'modify', target: 'weapons/shortbow', fields: { cost: 1 } },
  ] };
  const { rules, log } = buildRules(system, [homebrew, other]);
  assert.equal(rules.entities.armor.shield.cost, 99);
  assert.ok(log.some(l => l.level === 'conflict' && l.target === 'armor/shield'));
  assert.ok(log.some(l => l.level === 'warning' && l.msg.includes('shortbow')));
});

test('package sets: requirements, conflicts and suggested order', () => {
  const inst = {
    'example-d20': system, 'example-homebrew': homebrew,
    a: { id: 'a', version: '1.0', system: 'example-d20', load_after: ['b'] },
    b: { id: 'b', version: '1.0', system: 'example-d20', conflicts: ['c'] },
    c: { id: 'c', version: '1.0', system: 'example-d20', requires: ['zzz'] },
  };
  assert.deepEqual(checkSet('example-d20', ['example-homebrew'], inst), []);
  const w = checkSet('example-d20', ['a', 'b', 'c'], inst);
  assert.ok(w.some(x => x.package === 'a' && x.msg.includes('after')));
  assert.ok(w.some(x => x.package === 'b' && x.msg.includes('Conflicts')));
  assert.ok(w.some(x => x.package === 'c' && x.msg.includes('zzz')));
  assert.deepEqual(suggestOrder(['a', 'b'], inst), ['b', 'a']);
  assert.equal(compareVersions('1.10.0', '1.9'), 1);
});

test('calculation: attributes, derived values, skills and resources', () => {
  const { rules } = buildRules(system, []);
  const s = emptySheet(rules, { level: 5 });
  s.attributes.DEX = 14; s.attributes.CON = 12; s.attributes.WIS = 16;
  s.skills.perception = 3;
  const c = compute(rules, s);
  assert.equal(c.value('proficiency'), 3);
  assert.equal(c.value('ac'), 12);
  assert.equal(c.value('perception'), 6);
  assert.equal(c.value('hp'), 8 + 1 + 4 * 6);
  assert.deepEqual(c.errors, []);
});

test('calculation: item effects, equip, set, grant and block', () => {
  const { rules } = buildRules(system, []);
  const s = emptySheet(rules);
  s.attributes.DEX = 14;
  s.items = [
    { uid: '1', collection: 'armor', ref: 'leather', equipped: true },
    { uid: '2', collection: 'armor', ref: 'shield', equipped: false },
    { uid: '3', collection: 'traits', ref: 'construct' },
    { uid: '4', collection: 'potions', ref: 'giant-strength', qty: 2 },
    { uid: '5', collection: 'gear', ref: 'rope', qty: 2 },
  ];
  let c = compute(rules, s);
  assert.equal(c.value('ac'), 13); // leather = 11 + 2; shield not equipped
  assert.equal(c.value('STR'), 10); // potion blocked by Construct
  assert.ok(c.lists.note.some(n => n.ef.text.includes('Darkvision'))); // granted
  assert.ok(c.lists.immunity.length);
  assert.equal(c.value('load'), 10 + 6 + 20); // leather + shield + 2 ropes
  s.items[1].equipped = true;
  s.items.splice(2, 1);
  c = compute(rules, s);
  assert.equal(c.value('ac'), 15);
  assert.equal(c.value('STR'), 21);
});

test('calculation: counters and extension together', () => {
  const { rules } = buildRules(system, [homebrew]);
  const s = emptySheet(rules);
  s.counters.exhaustion = 2;
  s.items = [{ uid: '1', collection: 'armor', ref: 'shield', equipped: true }, { uid: '2', collection: 'conditions', ref: 'off-balance' }];
  const c = compute(rules, s);
  assert.equal(c.value('initiative'), -4);
  assert.equal(c.value('ac'), 10 + 3 - 2);
  assert.ok(c.lists.disadvantage.length);
});

test('calculation: formula cycle becomes a warning, not a hang', () => {
  const sys = { ...system, derived: [{ id: 'a', formula: 'b + 1' }, { id: 'b', formula: 'a + 1' }] };
  const { rules } = buildRules(sys, []);
  const c = compute(rules, emptySheet(rules));
  c.value('a');
  assert.ok(c.errors.some(e => e.includes('cycle')));
});

test('calculation: item removed from packages gives a warning', () => {
  const { rules } = buildRules(system, [homebrew]);
  const s = emptySheet(rules);
  s.items = [{ uid: '1', collection: 'weapons', ref: 'shortbow', name: 'Shortbow', equipped: true }];
  const c = compute(rules, s);
  assert.ok(c.errors.some(e => e.includes('Shortbow')));
});

test('roller', () => {
  const { rules } = buildRules(system, []);
  const s = emptySheet(rules);
  s.attributes.STR = 16;
  const c = compute(rules, s);
  const r = roll('2d6 + mod(STR)', c, () => 0.5);
  assert.equal(r.total, 4 + 4 + 3);
  assert.equal(r.details[0], '2d6: [4, 4]');
});

test('Portuguese example computes the same as the English one', () => {
  const { rules } = buildRules(load('pt-BR/system.json'), [load('pt-BR/homebrew.json')]);
  const s = emptySheet(rules);
  s.attributes.DES = 14;
  s.items = [{ uid: '1', collection: 'armaduras', ref: 'couro', equipped: true }, { uid: '2', collection: 'armaduras', ref: 'escudo', equipped: true }];
  const c = compute(rules, s);
  assert.equal(c.value('ca'), 11 + 2 + 3);
  assert.deepEqual(c.errors, []);
});

test('i18n: every key translated, plurals and language matching', () => {
  assert.deepEqual(Object.keys(en).filter(k => !(k in ptBR)), []);
  assert.deepEqual(Object.keys(ptBR).filter(k => !(k in en)), []);
  setLanguage('pt-BR');
  assert.equal(t('home.extensions', { n: 1 }), '1 extensão');
  assert.equal(t('home.extensions', { n: 3 }), '3 extensões');
  assert.throws(() => parse('1 +'), /Fórmula incompleta/);
  setLanguage('en');
  assert.equal(t('home.extensions', { n: 2 }), '2 extensions');
  assert.equal(matchLanguage('pt-PT'), 'pt-BR');
  assert.equal(matchLanguage('en-US'), 'en');
  assert.equal(matchLanguage('ja'), 'en');
});

test('creation: validated, carried into the rules and patchable', () => {
  assert.deepEqual(validatePackage(system).errors, []);
  const { rules } = buildRules(system, []);
  assert.equal(rules.creation.steps[0].type, 'pick');
  const bad = { ...system, creation: { steps: [{ type: 'dance' }, { type: 'pick' }, { type: 'attributes', points: '2 +' }] } };
  assert.equal(validatePackage(bad).errors.length, 3);
  const ext = { format: 1, id: 'x', name: 'X', version: '1', language: 'en', type: 'extension', system: system.id,
    patches: [{ op: 'modify', target: 'creation', fields: { summary: ['hp'] } }] };
  assert.deepEqual(validatePackage(ext).errors, []);
  assert.deepEqual(buildRules(system, [ext]).rules.creation.summary, ['hp']);
  const off = { ...ext, patches: [{ op: 'remove', target: 'creation' }] };
  assert.equal(buildRules(system, [off]).rules.creation, null);
});

test('progression: an extension can patch it, and it is validated', () => {
  const sys = { ...system, progression: { max_level: 10, xp_per_level: 'level * 1000', level_up: { steps: [{ type: 'info', title: 'A' }] } } };
  const steps = [{ type: 'pick', collection: 'classes', if: 'level != 19' }];
  const ext = { format: 1, id: 'x', name: 'X', version: '1', language: 'en', type: 'extension', system: sys.id,
    patches: [{ op: 'modify', target: 'progression', fields: { level_up: { steps } } }] };
  assert.deepEqual(validatePackage(ext).errors, []);
  const { rules } = buildRules(sys, [ext]);
  assert.deepEqual(rules.progression.level_up.steps, steps);
  assert.equal(rules.progression.max_level, 10, 'modify keeps the other keys');
  assert.equal(sys.progression.level_up.steps[0].type, 'info', 'the system is not changed');
  const bad = { ...ext, patches: [{ op: 'modify', target: 'progression', fields: { xp_per_level: 'level *', level_up: { steps: [{ type: 'dance' }] } } }] };
  assert.equal(validatePackage(bad).errors.length, 2);
  const off = { ...ext, patches: [{ op: 'remove', target: 'progression' }] };
  assert.deepEqual(buildRules(sys, [off]).rules.progression, {});
});

test('creation: items step needs "from"', () => {
  const bad = { ...system, creation: { steps: [{ type: 'items' }] } };
  assert.equal(validatePackage(bad).errors.length, 1);
  const ok = { ...system, creation: { steps: [{ type: 'items', from: 'classes' }] } };
  assert.deepEqual(validatePackage(ok).errors, []);
});

test('effects: "limit" caps a value and a repeated entity lists its notes once', () => {
  const sys = { format: 1, id: 'lim', name: 'L', type: 'system', language: 'en',
    resources: [{ id: 'ap', name: 'AP', max: '10' }],
    collections: { conds: { name: 'Conditions' }, feats: { name: 'Feats', unique: true } },
    entities: {
      conds: [{ id: 'slow', name: 'Slow', effects: [{ type: 'limit', target: 'ap', value: '6' }] }],
      feats: [{ id: 'hero', name: 'Hero', repeat: 2, effects: [{ type: 'add', target: 'ap', value: '2' },
        { type: 'note', text: 'once' }, { type: 'note', text: 'twice', if: "qty('hero') >= 2" }] }],
    } };
  assert.deepEqual(validatePackage(sys).errors, []);
  const { rules } = buildRules(sys, []);
  const sheet = emptySheet(rules);
  sheet.items = [{ uid: 'a', collection: 'feats', ref: 'hero' }];
  let c = compute(rules, sheet);
  assert.equal(c.value('ap'), 12);
  assert.deepEqual(c.lists.note.map(x => x.ef.text), ['once']);
  sheet.items.push({ uid: 'b', collection: 'feats', ref: 'hero' });
  c = compute(rules, sheet);
  assert.equal(c.value('ap'), 14);
  assert.deepEqual(c.lists.note.map(x => x.ef.text), ['once', 'twice']);
  sheet.items.push({ uid: 'c', collection: 'conds', ref: 'slow' });
  assert.equal(compute(rules, sheet).value('ap'), 6);
});

test('skills: "attribute" as a list uses the highest modifier', () => {
  const sys = { format: 1, id: 'two', name: 'T', type: 'system', language: 'en', rolls: { modifier: 'value - 5' },
    attributes: [{ id: 'STR', name: 'Strength', default: 5 }, { id: 'CHA', name: 'Charisma', default: 5 }],
    skills: [{ id: 'intim', name: 'Intimidation', attribute: ['STR', 'CHA'] }] };
  assert.deepEqual(validatePackage(sys).errors, []);
  const { rules } = buildRules(sys, []);
  const sheet = emptySheet(rules);
  sheet.attributes = { STR: 4, CHA: 8 };
  sheet.skills = { intim: 1 };
  const c = compute(rules, sheet);
  assert.equal(c.value('intim'), 4);
  assert.equal(c.explain('intim').formula, 'points + max(mod(STR), mod(CHA))');
});
