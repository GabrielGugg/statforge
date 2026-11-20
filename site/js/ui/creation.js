// ============================================================
// Character creation assistant, driven by the system's "creation" steps.
// Each step only records the player's choices; the sheet is rebuilt from
// all choices every time, so going back and changing something is safe.
// ============================================================
import { compute, addSpecialty, specialtyId, specialtiesOf, specialtySuggestions } from '../engine/calc.js';
import { t } from '../i18n.js';
import { h, uid, fmt, signed, byName, normalize } from './util.js';
import { entityDetails, describeEffect, summarizeEffects, unmetRequirement, linkTerms, linkCols } from './sheet.js';
import { costOf, costValues, pointsSpent, rollSet, convertRoll, diceRange, setTotal, parseDice, rollDice } from '../engine/attrgen.js';

// Badges for a choice card: repeated bonuses are merged, the rest is counted. Notes (reminders) are left out:
// they repeat the description shown right above.
function effectBadges(rules, effects) {
  const lines = summarizeEffects(rules, (effects || []).filter(ef => ef.type !== 'note'));
  const MAX = 5;
  const out = lines.slice(0, MAX).map(l => h(l.note ? 'span.badge.warning' : 'span.badge.ok', l.text));
  if (lines.length > MAX) out.push(h('span.badge', t('creation.moreEffects', { n: lines.length - MAX })));
  return out;
}

const SHOWN = 60; // entities listed at once in a pick step; search narrows the rest

/**
 * Draws the assistant into `app`.
 * base: an empty sheet (already named, with system and extensions).
 * onDone(sheet) receives the finished sheet; onSkip() creates the blank one.
 * Level up uses the same assistant: `levelUp` is the sheet as it was, `base` a copy one level higher,
 * and the steps add to what the sheet already has.
 */
export function creationWizard(app, { rules, inst, base, onDone, onSkip, steps = rules.creation.steps, summaryIds = rules.creation?.summary, levelUp = null }) {
  const choices = steps.map(() => ({}));
  const st = { rules, inst }; // what entityDetails needs
  let index = firstFrom(0);
  let showAll = false;
  let query = '';
  let shown = SHOWN; // grows with "Load more"
  // List filters: only what the character can take, and which packages show. Kept for the whole wizard
  // and remembered per system on this device.
  const filterKey = `statforge.pickFilters.${rules.id}`;
  const filters = (() => {
    try { const f = JSON.parse(localStorage.getItem(filterKey) || '{}'); return { onlyMet: !!f.onlyMet, hidden: Array.isArray(f.hidden) ? f.hidden : [] }; }
    catch { return { onlyMet: false, hidden: [] }; }
  })();
  const saveFilters = () => { try { localStorage.setItem(filterKey, JSON.stringify(filters)); } catch { /* private mode: kept for this wizard only */ } };
  let filtersOpen = false;

  const num = (v, calc, fallback) => {
    if (v === undefined || v === null || v === '') return fallback;
    return typeof v === 'number' ? v : Number(calc.formula(v)) || 0;
  };

  // ---------- Building the sheet from the choices ----------
  // A "choice" step's answer is a formula variable named after its id: 1 for the first option, 0 while unanswered.
  function choiceVars() {
    return Object.fromEntries(steps.map((st, i) => [st, i]).filter(([st]) => st.type === 'choice' && st.id).map(([st, i]) => [st.id, choices[i].option || 0]));
  }

  function applies(step, sheet) {
    if (!step.if) return true;
    return !!compute(rules, sheet).formula(step.if, choiceVars());
  }

  /** The sheet to save: without the list of this run's picks, which only the steps' formulas use. */
  function finished(s) { delete s.picked; return s; }

  /** A fresh sheet to rebuild on: empty when creating, the current sheet when leveling up. */
  function fresh() {
    const s = structuredClone(base);
    if (!levelUp) { s.items = []; s.skills = {}; s.notes = {}; }
    delete s.picked;
    s.items ||= []; s.skills ||= {}; s.notes ||= {};
    return s;
  }

  /** The sheet with the choices of steps 0..upto-1 (only the steps that apply). */
  function build(upto = steps.length) {
    const s = fresh();
    for (let i = 0; i < upto; i++) {
      if (!applies(steps[i], s)) continue;
      applyStep(steps[i], choices[i], s);
    }
    return s;
  }

  /**
   * "source" on a pick step: where what is picked comes from, saved on the item ("Arcanist" for a spell).
   * The entities of those collections picked in this run, or else the ones on the sheet; with "source_field",
   * only those where that field is above 0 (e.g. the race or power that gives a spell to choose).
   */
  function sourceOf(step, s) {
    const cols = [].concat(step.source || []).filter(c => typeof c === 'string' && rules.entities[c]);
    if (!cols.length) return '';
    const ok = e => e && (!step.source_field || Number(e[step.source_field]) > 0);
    const names = cols.flatMap(c => {
      const run = (s.picked || []).filter(r => r.startsWith(`${c}/`)).map(r => rules.entities[c][r.slice(c.length + 1)]).filter(ok);
      return (run.length ? run : s.items.filter(i => i.collection === c).map(i => rules.entities[c][i.ref]).filter(ok)).map(e => e.name);
    });
    return [...new Set(names)].join(', ');
  }

  function applyStep(step, choice, s) {
    if (step.type === 'pick') {
      const col = rules.collections[step.collection] || {};
      const source = sourceOf(step, s);
      for (const ref of choice.picks || []) {
        if (!rules.entities[step.collection]?.[ref]) continue;
        // "levels": an entity the sheet already has goes up by one (a class level) instead of being added again.
        const owned = step.levels && col.quantity && s.items.find(i => i.collection === step.collection && i.ref === ref && !i.name);
        if (owned) owned.qty = (Number(owned.qty) || 1) + 1;
        else s.items.push({ uid: uid(), collection: step.collection, ref,
          ...(col.quantity ? { qty: 1 } : {}), ...(col.equippable ? { equipped: true } : {}), ...(source ? { source } : {}) });
        s.picked = [...(s.picked || []), `${step.collection}/${ref}`];
      }
    } else if (step.type === 'attributes') {
      Object.assign(s.attributes, attributeValues(step, choice));
    } else if (step.type === 'skills') {
      const calc = compute(rules, s);
      // "untrained": a skill the sheet already has points in can't be taken again here.
      if (step.grant) {
        const bonus = num(step.bonus, calc, 1);
        // Picked against the sheet before this step, so two groups never give the same skill.
        const before = { ...s, skills: { ...s.skills } };
        grantGroups(step, before).forEach((g, gi) => {
          const tok = groupPick(step, g, choice.alt?.[gi], before, choice);
          if (tok && !tokTrained(step, tok, choice, s)) giveSkill(s, tok, choice, bonus);
        });
      } else if (step.choose !== undefined) {
        const bonus = num(step.bonus, calc, 1);
        const allowed = allowedSkills(step, calc, s).filter(tok => !tokTrained(step, tok, choice, s));
        for (const tok of choice.chosen || []) if (allowed.includes(tok)) giveSkill(s, tok, choice, bonus);
      } else {
        for (const [id, n] of Object.entries(choice.points || {})) s.skills[id] = (s.skills[id] || 0) + n;
      }
    } else if (step.type === 'notes') {
      Object.assign(s.notes, choice.notes || {});
    } else if (step.type === 'items') {
      const note = step.note || 'notes';
      const addNote = text => { s.notes[note] = [s.notes[note], text].filter(Boolean).join('\n'); };
      if (choice.take === false && step.alternative) {
        if (step.alternative.text) addNote(step.alternative.text);
        // The alternative can give items too (e.g. coins instead of the kit).
        for (const it of step.alternative.items || []) {
          const [collection, ref] = String(it.ref || '').split('/');
          if (rules.entities[collection]?.[ref]) s.items.push({ uid: uid(), collection, ref, qty: Number(it.qty) || 1 });
        }
        return;
      }
      const kit = startingKit(step, s);
      // What the player chose ("a simple weapon of your choice") and rolled or typed ("T$ 4d6") goes with the fixed items.
      for (const ch of kit.choices) {
        const pick = ch.options.find(o => `${o.collection}/${o.ref}` === choice.kit?.[ch.key]);
        if (pick) kit.items.push({ collection: pick.collection, ref: pick.ref, qty: ch.qty, equipped: ch.equipped });
      }
      for (const r of kit.rolls) {
        const v = Number(choice.roll?.[r.key]?.value);
        if (Number.isFinite(v) && v > 0) kit.items.push({ collection: r.collection, ref: r.ref, qty: v, equipped: r.equipped });
      }
      for (const it of kit.items) {
        const col = rules.collections[it.collection] || {};
        const same = col.quantity && !it.wear && !it.name && s.items.find(x => x.collection === it.collection && x.ref === it.ref && !x.wear && !x.name);
        if (same) { same.qty = (same.qty ?? 1) + it.qty; continue; }
        s.items.push({ uid: uid(), collection: it.collection, ref: it.ref,
          ...(col.quantity || it.qty !== 1 ? { qty: it.qty } : {}),
          ...(col.equippable ? { equipped: !!it.equipped } : {}),
          ...(it.wear ? { wear: it.wear } : {}), ...(it.name ? { name: it.name } : {}) });
      }
      for (const text of kit.texts) addNote(text);
    }
  }

  /** The entities a kit "choose" offers: a list of refs, or a collection (optionally only one tag). */
  function kitOptions(ch) {
    if (Array.isArray(ch?.refs)) {
      return ch.refs.map(r => String(r).split('/')).filter(([c, i]) => rules.entities[c]?.[i])
        .map(([collection, ref]) => ({ collection, ref, name: rules.entities[collection][ref].name }));
    }
    const col = ch?.collection;
    return Object.values(rules.entities[col] || {}).filter(e => !ch.tag || (e.tags || []).includes(ch.tag))
      .map(e => ({ collection: col, ref: e.id, name: e.name })).sort((a, b) => byName(a.name, b.name));
  }

  /**
   * Starting items of the entities picked in step.from, filtered by their "if":
   * fixed items, texts (notes), choices ("choose") and quantities to roll ("qty": "4d6").
   */
  function startingKit(step, sheet) {
    const calc = compute(rules, sheet);
    const field = step.field || 'starting_items';
    const items = [], texts = [], choices = [], rolls = [];
    for (const it of sheet.items.filter(i => i.collection === step.from)) {
      (rules.entities[step.from]?.[it.ref]?.[field] || []).forEach((e, n) => {
        if (e.if && !calc.formula(e.if)) return;
        const key = `${it.ref}#${n}`;
        if (e.text) { texts.push(e.text); return; }
        if (e.choose) {
          const options = kitOptions(e.choose);
          if (options.length) choices.push({ key, label: e.label || '', options, qty: Number(e.qty) || 1, equipped: !!e.equipped, optional: !!e.optional });
          else if (e.label) texts.push(e.label);
          return;
        }
        const [collection, ref] = String(e.ref || '').split('/');
        if (!rules.entities[collection]?.[ref]) { texts.push(`${e.qty || 1}× ${e.name || e.ref}`); return; }
        if (typeof e.qty === 'string' && parseDice(e.qty)) {
          rolls.push({ key, collection, ref, dice: e.qty.trim(), label: e.label || rules.entities[collection][ref].name, equipped: !!e.equipped });
          return;
        }
        items.push({ collection, ref, qty: Number(e.qty) || 1, wear: Number(e.wear) || 0, equipped: !!e.equipped, name: e.name });
      });
    }
    return { items, texts, choices, rolls };
  }

  /**
   * A step the player sees: it applies and has something to decide. A "grant" skills step with no
   * "X or Y" and no skill trained twice does its job without being shown.
   */
  function shows(step, sheet) {
    if (!applies(step, sheet)) return false;
    if (step.type !== 'skills' || !step.grant) return true;
    // Shown when something is up to the player: an "or", a specialty to name, or a skill already trained.
    return grantGroups(step, sheet).some(g => g.length > 1 || needsName(g[0]) || tokTrained(step, g[0], null, sheet));
  }

  function firstFrom(i, dir = 1) {
    for (let j = i; j >= 0 && j < steps.length; j += dir) if (shows(steps[j], build(j))) return j;
    return dir > 0 ? steps.length : -1; // steps.length = review
  }

  /** Steps that apply with the current choices (for "step N of M"). */
  function visibleSteps() {
    const out = [];
    const s = fresh();
    steps.forEach((step, i) => {
      if (!applies(step, s)) return;
      if (shows(step, s)) out.push(i);
      applyStep(step, choices[i], s);
    });
    return out;
  }

  // ---------- Helpers for each step type ----------
  function nameMatches(text, calc) {
    const wanted = normalize(text).split(/\s*(?:,|;|\bou\b|\bor\b)\s*/).filter(Boolean);
    const have = calc.active.flatMap(f => [normalize(f.ent.name), normalize(f.ent.id)]);
    return wanted.some(w => have.some(n => n === w || n.startsWith(`${w} `) || w.startsWith(`${n} `)));
  }

  // "requires" is a hard rule (a formula) and, when an entity has it, the only one; match_field only
  // suggests, for entities without "requires".
  const meets = (ent, calc) => !ent.requires || !!calc.formula(ent.requires);

  /** Why this entity is not available, in words, or '' when it is. */
  function unmet(step, ent, calc) {
    if (ent.requires) return unmetRequirement(rules, calc, ent);
    if (!step.match_field) return '';
    const v = ent[step.match_field];
    if (v === undefined || v === null || v === '' || nameMatches(String(v), calc)) return '';
    return String(v);
  }
  const available = (step, ent, calc) => !unmet(step, ent, calc);

  // ---------- Skills in steps ----------
  // A skill in a step is a "token": its id, or "id|Specialty" when the text names one ("Craft (armorer)").
  // A skill with specialties named without one ("Craft") asks the player for the specialty (choice.spec[id]).
  const tokBase = tok => String(tok).split('|')[0];
  const tokSpec = tok => String(tok).split('|')[1] || '';
  const specialized = id => !!rules.skills[id]?.specialties;
  function skillToken(text) {
    const m = String(text).match(/^\s*(.*?)\s*(?:\(([^)]*)\))?\s*$/);
    const n = normalize(m?.[1] || '');
    const id = n ? Object.values(rules.skills).find(s => normalize(s.name) === n || normalize(s.id) === n)?.id : undefined;
    if (!id) return undefined;
    const spec = specialized(id) ? (m[2] || '').trim() : '';
    return spec ? `${id}|${spec.charAt(0).toUpperCase()}${spec.slice(1)}` : id;
  }
  /** Where a token's points go: the skill, its specialty, or null while the specialty has no name. */
  function tokTarget(tok, choice) {
    const id = tokBase(tok);
    if (!specialized(id)) return id;
    const name = tokSpec(tok) || String(choice?.spec?.[id] || '').trim();
    return name ? specialtyId(id, name) : null;
  }
  const tokName = (tok, choice) => {
    const id = tokBase(tok), sp = tokSpec(tok) || String(choice?.spec?.[id] || '').trim();
    return sp ? `${rules.skills[id]?.name || id} (${sp})` : rules.skills[id]?.name || id;
  };
  // A skill with specialties and no specialty in the text: the player names it.
  const needsName = tok => specialized(tokBase(tok)) && !tokSpec(tok);
  const tokTrained = (step, tok, choice, sheet) => {
    if (!step.untrained) return false;
    const target = tokTarget(tok, choice);
    return !!target && (sheet.skills[target] || 0) > 0;
  };
  function giveSkill(s, tok, choice, bonus) {
    const target = tokTarget(tok, choice);
    if (!target) return;
    const id = tokBase(tok);
    if (specialized(id) && !addSpecialty(rules, s, id, tokSpec(tok) || choice.spec[id])) return;
    s.skills[target] = (s.skills[target] || 0) + bonus;
  }
  /** A skill's or specialty's name, for ids already on the sheet. */
  const skillName = (id, sheet) => rules.skills[id]?.name || specialtiesOf(rules, sheet)[id]?.name || id;

  function allowedSkills(step, calc, sheet) {
    const all = Object.values(rules.skills).map(s => s.id);
    const from = step.from;
    if (!from?.collection || !from?.field) return all;
    const texts = (sheet.items || []).filter(i => i.collection === from.collection)
      .map(i => rules.entities[from.collection]?.[i.ref]?.[from.field]).filter(v => v !== undefined && v !== '');
    if (!texts.length) return all;
    const toks = [...new Set(texts.flatMap(v => (Array.isArray(v) ? v : String(v).split(/\s*[,;]\s*/))).map(skillToken).filter(Boolean))];
    return toks.length ? toks : all;
  }

  /**
   * "grant" steps: the skills named in a field of the chosen entities, as groups. A group of one is given
   * automatically; "Fight or Aim" (also "|" or "/") is a group the player picks one from.
   */
  function grantGroups(step, sheet) {
    const from = step.from;
    if (!from?.collection || !from?.field) return [];
    const words = [].concat(step.or || ['or', 'ou']).map(w => String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const or = new RegExp(`\\s*[|/]\\s*|\\s+(?:${words})\\s+`, 'i');
    const texts = (sheet.items || []).filter(i => i.collection === from.collection)
      .map(i => rules.entities[from.collection]?.[i.ref]?.[from.field]).filter(v => v !== undefined && v !== '');
    const groups = texts.flatMap(v => (Array.isArray(v) ? v : String(v).split(/\s*[,;]\s*/)))
      .map(part => [...new Set(String(part).split(or).map(skillToken).filter(Boolean))]).filter(g => g.length);
    // The same fixed skill named twice is given once.
    return groups.filter((g, i) => g.length > 1 || groups.findIndex(x => x.length === 1 && x[0] === g[0]) === i);
  }

  /** The skill a group gives: its only skill, the player's pick, or the only one not trained yet. */
  function groupPick(step, g, alt, sheet, choice) {
    const free = g.filter(tok => !tokTrained(step, tok, choice, sheet));
    if (g.length === 1) return free[0];
    if (free.includes(alt)) return alt;
    return free.length === 1 ? free[0] : undefined;
  }

  /** Which step first put points in each skill: { id: step index } (-1: the sheet already had it). */
  function skillSources(upto) {
    const s = fresh(), src = {};
    for (const [id, n] of Object.entries(s.skills)) if (n > 0) src[id] = -1;
    for (let j = 0; j < upto; j++) {
      if (!applies(steps[j], s)) continue;
      const before = { ...s.skills };
      applyStep(steps[j], choices[j], s);
      for (const [id, n] of Object.entries(s.skills)) if (n > (before[id] || 0) && src[id] === undefined) src[id] = j;
    }
    return src;
  }

  /** { ok, msg (blocks), warn (does not block) } */
  function validate(i, calc, sheet) {
    const step = steps[i], c = choices[i];
    if (step.type === 'choice') return c.option ? { ok: true } : { ok: false, msg: t('creation.chooseOne') };
    if (step.type === 'pick') {
      const n = (c.picks || []).length;
      const min = num(step.min, calc, 0), max = num(step.max, calc, Infinity);
      if (n < min) return { ok: false, msg: t('creation.minPick', { n: min }) };
      if (n > max) return { ok: false, msg: t('creation.maxPick', { n: max }) };
      return { ok: true };
    }
    if (step.type === 'items' && (c.take !== false || !step.alternative)) {
      const kit = startingKit(step, sheet);
      const missing = kit.choices.find(ch => !ch.optional && !ch.options.some(o => `${o.collection}/${o.ref}` === c.kit?.[ch.key]));
      if (missing) return { ok: false, msg: t('creation.kitChoose', { what: missing.label || t('creation.kitItem') }) };
      const unrolled = kit.rolls.find(r => !Number.isFinite(Number(c.roll?.[r.key]?.value)) || c.roll?.[r.key]?.value === '');
      if (unrolled) return { ok: false, msg: t('creation.kitRoll', { what: unrolled.label, dice: unrolled.dice }) };
      return { ok: true };
    }
    if (step.type === 'attributes' && c.method === 'roll') {
      const ids = Object.keys(rules.attributes), rolls = c.rolls || [];
      if (rolls.filter(r => Number.isFinite(r?.total)).length < ids.length) return { ok: false, msg: t('creation.rollFirst') };
      const used = ids.map(id => c.assign?.[id]);
      if (used.some(x => x === undefined || x === null || x === '') || new Set(used).size < ids.length) return { ok: false, msg: t('creation.assignAll') };
      const min = Number(step.roll?.min_total);
      if (Number.isFinite(min) && setTotal(rolls) < min) return { ok: true, warn: t('creation.rollLow', { n: min }) };
      return { ok: true };
    }
    if (step.type === 'attributes') {
      const left = attributePointsLeft(step, calc);
      if (left < 0) return { ok: false, msg: t('creation.pointsOver', { n: -left }) };
      if (left > 0) return { ok: true, warn: t('creation.pointsLeft', { n: left }) };
      return { ok: true };
    }
    if (step.type === 'skills') {
      const trained = tok => tokTrained(step, tok, c, sheet);
      // A specialty to name ("Craft: which one?"), and a named one the sheet already has.
      const specProblem = toks => {
        const unnamed = toks.find(tok => !tokTarget(tok, c));
        if (unnamed) return { ok: false, msg: t('creation.nameSpecialty', { skill: rules.skills[tokBase(unnamed)]?.name }) };
        const dup = toks.find(tok => specialized(tokBase(tok)) && trained(tok));
        if (dup) return { ok: false, msg: t('creation.specialtyTrained', { name: tokName(dup, c) }) };
        return null;
      };
      if (step.grant) {
        const groups = grantGroups(step, sheet);
        const plainTrained = tok => !needsName(tok) && trained(tok);
        if (groups.some((g, gi) => g.some(tok => !plainTrained(tok)) && !groupPick(step, g, c.alt?.[gi], sheet, c) && g.length > 1)) {
          return { ok: false, msg: t('creation.chooseAlt') };
        }
        const problem = specProblem(groups.map((g, gi) => (g.length === 1 ? g[0] : groupPick(step, g, c.alt?.[gi], sheet, c))).filter(tok => tok && needsName(tok)));
        if (problem) return problem;
        const lost = groups.filter(g => g.every(plainTrained)).length;
        return lost ? { ok: true, warn: t('creation.lostTraining', { n: lost }) } : { ok: true };
      }
      if (step.choose !== undefined) {
        const need = num(step.choose, calc, 0);
        const problem = specProblem((c.chosen || []).filter(needsName));
        if (problem) return problem;
        const allowed = allowedSkills(step, calc, sheet).filter(tok => !trained(tok));
        const have = (c.chosen || []).filter(tok => allowed.includes(tok)).length;
        const possible = Math.min(need, allowed.length);
        if (have < possible) return { ok: false, msg: t('creation.chooseMore', { n: possible - have }) };
        // A short list where some skills were already trained: the player gets fewer, unless they change the earlier step.
        if (step.from && need > allowed.length) return { ok: true, warn: t('creation.lostTraining', { n: need - allowed.length }) };
        return { ok: true };
      }
      const left = num(step.points, calc, 0) - Object.values(c.points || {}).reduce((a, b) => a + b, 0);
      if (left < 0) return { ok: false, msg: t('creation.pointsOver', { n: -left }) };
      if (left > 0) return { ok: true, warn: t('creation.pointsLeft', { n: left }) };
    }
    return { ok: true };
  }

  const attrStart = a => (levelUp ? base.attributes?.[a.id] ?? a.default ?? a.min ?? 0 : a.default ?? a.min ?? 0);
  // A cost table only applies when creating (leveling up adds point by point).
  const costTable = step => (!levelUp && step.cost && typeof step.cost === 'object' ? step.cost : null);

  function attributePointsLeft(step, calc) {
    const values = choices[steps.indexOf(step)].values || {};
    const vals = {}, starts = {};
    for (const a of Object.values(rules.attributes)) { starts[a.id] = attrStart(a); vals[a.id] = values[a.id] ?? base.attributes[a.id] ?? starts[a.id]; }
    return num(step.points, calc, 0) - pointsSpent(vals, starts, costTable(step));
  }

  /** The attribute values a step gives: point-buy values, or the rolled results the player placed. */
  function attributeValues(step, choice) {
    if (choice.method !== 'roll') return choice.values || {};
    const out = {};
    for (const a of Object.values(rules.attributes)) {
      const r = choice.rolls?.[choice.assign?.[a.id]];
      if (r && Number.isFinite(r.value)) out[a.id] = r.value;
    }
    return out;
  }

  // ---------- Drawing ----------
  function draw(focusTop = true) {
    if (index >= steps.length) return review();
    const step = steps[index];
    const before = build(index);
    const calcBefore = compute(rules, before);
    const after = build(index + 1);
    const calcAfter = compute(rules, after);
    const vis = visibleSteps();
    const pos = vis.indexOf(index) + 1;
    const v = validate(index, calcBefore, before);

    const content = ({ choice: choiceStep, pick: pickStep, attributes: attributesStep, skills: skillsStep, info: infoStep, notes: notesStep, items: itemsStep }[step.type] || (() => null))(step, calcBefore, before, calcAfter);
    app.replaceChildren(h('div.wizard',
      progress(pos, vis.length + 1, step.title || defaultTitle(step)),
      summary(calcAfter),
      h('section.card.wizard-step',
        h('h2', step.title || defaultTitle(step)),
        step.description ? h('p.muted', { style: { whiteSpace: 'pre-line' } }, step.description) : null,
        content),
      footer(v)));
    if (focusTop) window.scrollTo(0, 0);
  }

  const redraw = () => { const y = window.scrollY; draw(false); window.scrollTo(0, y); };

  function defaultTitle(step) {
    if (step.type === 'pick') return rules.collections[step.collection]?.name || step.collection;
    return t(`creation.type.${step.type}`);
  }

  function progress(pos, total, title) {
    return h('div.wizard-progress',
      h('div.row.spread',
        h('span.muted.small', t('creation.stepOf', { n: pos, total })),
        h('button.mini.link', { type: 'button', onclick: onSkip }, levelUp ? t('common.cancel') : t('creation.skip'))),
      h('div.bar', h('div', { style: { width: `${Math.round((pos / total) * 100)}%` } })),
      h('span.sr-only', title));
  }

  // When leveling up, values that change show as "old → new".
  const calcOld = levelUp ? compute(rules, levelUp) : null;
  function summary(calc) {
    const ids = summaryIds || Object.keys(rules.resources);
    const chips = ids.map(id => {
      const def = rules.resources[id] || rules.derived[id] || rules.attributes[id] || rules.skills[id];
      if (!def || (rules.derived[id] && !calc.visible(def))) return null;
      const now = calc.value(id), old = calcOld?.value(id);
      return h('span.stat-chip', { title: def.name, class: calcOld && old !== now ? 'changed' : '' }, h('span', def.abbr || def.name),
        h('strong', calcOld && old !== now ? `${fmt(old)} → ${fmt(now)}` : fmt(now)));
    }).filter(Boolean);
    return chips.length ? h('div.stat-chips', { 'aria-label': t('creation.summary') }, chips) : null;
  }

  // What the current pick step has chosen, right above the buttons: it stays visible however long the list is.
  function pickedLine() {
    const step = steps[index], c = choices[index];
    if (step?.type !== 'pick' || !c?.picks?.length) return null;
    const names = c.picks.map(id => rules.entities[step.collection]?.[id]).filter(Boolean);
    return h('div.wizard-picked', h('span.muted.small', t('creation.picked')),
      names.map(e => h('span.picked-chip', e.name,
        h('button.mini.link', { type: 'button', 'aria-label': t('creation.unpick', { name: e.name }),
          onclick: () => { c.picks = c.picks.filter(x => x !== e.id); redraw(); } }, '✕'))));
  }

  function footer(v) {
    const back = firstFrom(index - 1, -1);
    return h('div.wizard-footer',
      pickedLine(),
      v.msg ? h('div.small', { style: { color: 'var(--danger)' } }, v.msg) : v.warn ? h('div.small', { style: { color: 'var(--warning)' } }, v.warn) : null,
      h('div.row.spread',
        back >= 0 ? h('button', { type: 'button', onclick: () => { index = back; query = ''; showAll = false; shown = SHOWN; draw(); } }, `← ${t('common.back')}`) : h('span'),
        h('button.primary', { type: 'button', disabled: !v.ok, onclick: () => { index = firstFrom(index + 1); query = ''; showAll = false; shown = SHOWN; draw(); } },
          `${t('creation.next')} →`)));
  }

  // One option out of a few; later steps read the answer through their "if".
  function choiceStep(step) {
    const c = choices[index];
    return h('div.choices', (step.options || []).map((o, i) => h('div.choice', { class: c.option === i + 1 ? 'selected' : '' },
      h('label.choice-main',
        h('input', { type: 'radio', name: `step${index}`, checked: c.option === i + 1, onchange: () => { c.option = i + 1; redraw(); } }),
        h('span.choice-text', h('strong', o.label), o.text ? h('span.choice-desc', o.text) : null)))));
  }

  // Pick entities from a collection.
  function pickStep(step, calc) {
    const c = choices[index];
    c.picks ||= [];
    const max = num(step.max, calc, Infinity), min = num(step.min, calc, 0);
    const single = max === 1;
    // When leveling up, what the character already has is not offered again, unless the entity can be taken more times ("repeat").
    const ownedCount = id => (levelUp?.items || []).filter(i => i.collection === step.collection && i.ref === id).length;
    // "levels": what the character already has stays on the list (picking it again raises its level).
    const levels = !!step.levels && !!rules.collections[step.collection]?.quantity;
    const ownedQty = id => (levelUp?.items || []).filter(i => i.collection === step.collection && i.ref === id).reduce((n, i) => n + (Number(i.qty) || 1), 0);
    // "groups": the list is split into sections, each with its own tag and "if"; an entity goes to the first section it fits.
    const groups = Array.isArray(step.groups)
      ? step.groups.filter(g => !g.if || !!calc.formula(g.if, choiceVars()))
      : null;
    const groupOf = e => groups ? groups.findIndex(g => !g.tag || (e.tags || []).includes(g.tag)) : 0;
    const all = Object.values(rules.entities[step.collection] || {})
      .filter(e => (!step.tag || (e.tags || []).includes(step.tag)) && groupOf(e) >= 0
        && (!levelUp || levels || step.repeat || ownedCount(e.id) < (Number(e.repeat) || 1)))
      .sort((a, b) => byName(a.name, b.name));
    // Everything is listed: what the character can take first, then the rest, disabled with the reason,
    // unless the player ticks "ignore unmet requirements".
    const okAll = all.filter(e => available(step, e, calc));
    const hidden = all.length - okAll.length;
    // Packages that brought entities to this list (the filter only shows when there is more than one).
    const pkgOf = e => rules.addedBy?.[`${step.collection}/${e.id}`] || rules.id;
    const pkgs = [...new Set(all.map(pkgOf))];
    const visible = all.filter(e => !filters.hidden.includes(pkgOf(e)) && (!filters.onlyMet || showAll || okAll.includes(e)));
    const filteredOut = all.length - visible.length;
    let list = [...visible.filter(e => okAll.includes(e)), ...visible.filter(e => !okAll.includes(e))];
    const q = normalize(query);
    if (q) list = list.filter(e => normalize(`${e.name} ${e.description || ''} ${Object.values(e).filter(x => typeof x === 'string').join(' ')}`).includes(q));
    // Picking keeps the option where it is (moving it to the top was confusing); the footer lists what is picked.
    const extra = Math.max(0, list.length - shown);
    list = list.slice(0, shown);

    const toggle = id => {
      if (single) c.picks = c.picks[0] === id && min === 0 ? [] : [id];
      else if (c.picks.includes(id)) c.picks = c.picks.filter(x => x !== id);
      else if (c.picks.length < max) c.picks = [...c.picks, id];
      redraw();
    };
    const fields = rules.collections[step.collection]?.fields || {};
    const card = e => {
      const on = c.picks.includes(e.id);
      const why = unmet(step, e, calc);
      const ok = !why;
      const desc = String(e.description || '').replace(/\s+/g, ' ');
      const isLinked = f => linkCols(f.links, rules).length > 0;
      const facts = Object.entries(fields).filter(([k, f]) => !isLinked(f) && e[k] !== undefined && e[k] !== '' && typeof e[k] !== 'object' && !desc.slice(0, 200).includes(String(e[k])))
        .slice(0, 3).map(([k, f]) => h('span.badge', `${f.label || k}: ${e[k]}${f.unit ? ` ${f.unit}` : ''}`));
      // Fields that name powers, items… show as links: the text is in the hint and a click opens it.
      const linked = Object.entries(fields).filter(([k, f]) => isLinked(f) && typeof e[k] === 'string' && e[k].trim())
        .map(([k, f]) => h('span.choice-links', h('span.muted', `${f.label || k}: `), linkTerms(e[k], f.links, st)));
      const fx = effectBadges(rules, e.effects);
      const lv = levels ? ownedQty(e.id) : 0;
      return h('div.choice', { class: `${on ? 'selected' : ''}${ok || showAll ? '' : ' unmet'}` },
        h('label.choice-main',
          h('input', { type: single ? 'radio' : 'checkbox', name: `step${index}`, checked: on, disabled: !on && ((!single && c.picks.length >= max) || (!ok && !showAll)), onchange: () => toggle(e.id) }),
          h('span.choice-text',
            h('strong', e.name, lv ? h('span.badge', { style: { marginLeft: '.4rem' } }, t('creation.levelNow', { n: lv, next: lv + (on ? 1 : 0) })) : null),
            ok ? null : h('span.small.unmet-why', t('creation.unmetWhy', { why })),
            desc ? h('span.choice-desc', desc.length > 180 ? `${desc.slice(0, 180)}…` : desc) : null,
            facts.length || fx.length ? h('span.choice-facts', facts, fx) : null,
            linked.length ? h('span.choice-linked', linked) : null)),
        h('button.mini', { type: 'button', onclick: () => entityDetails(st, step.collection, e.id) }, t('creation.details')));
    };

    // Sections: "levels" puts what the character has first; "groups" uses the step's titles. Empty sections are left out.
    function sections(items) {
      if (levels && levelUp) {
        const mine = items.filter(e => ownedQty(e.id) > 0), rest = items.filter(e => !ownedQty(e.id));
        return [[step.owned_title || t('creation.levelsOwned'), mine], [step.new_title || t('creation.levelsNew'), rest]].filter(([, p]) => p.length);
      }
      if (groups) return groups.map((g, i) => [g.title || '', items.filter(e => groupOf(e) === i)]).filter(([, p]) => p.length);
      return [['', items]];
    }
    const search = all.length > 8 ? h('input', { type: 'search', value: query, placeholder: t('creation.search'), 'aria-label': t('sheet.search'),
      oninput: e => { query = e.target.value; const pos = e.target.selectionStart; redraw(); const el = app.querySelector('.wizard-step input[type=search]'); el?.focus(); el?.setSelectionRange(pos, pos); } }) : null;
    return [
      h('div.row.spread', { style: { marginBottom: '.5rem' } },
        h('span.badge', max === Infinity ? t('creation.chosenFree', { n: c.picks.length }) : t('creation.chosen', { n: c.picks.length, max })),
        h('span.row', { style: { gap: '.5rem' } },
          hidden ? h('label.check.small', h('input', { type: 'checkbox', checked: showAll, onchange: e => { showAll = e.target.checked; redraw(); } }), t('creation.ignoreReq')) : null,
          hidden || pkgs.length > 1 ? h('button.mini', { type: 'button', 'aria-expanded': String(filtersOpen), onclick: () => { filtersOpen = !filtersOpen; redraw(); } },
            t('creation.filters'), filters.onlyMet || filters.hidden.some(x => pkgs.includes(x)) ? h('span.badge', { style: { marginLeft: '.3rem' } }, '•') : null) : null)),
      filtersOpen && (hidden || pkgs.length > 1) ? h('div.pick-filters',
        hidden ? h('label.check.small', h('input', { type: 'checkbox', checked: filters.onlyMet, onchange: e => { filters.onlyMet = e.target.checked; saveFilters(); redraw(); } }), t('creation.onlyMet')) : null,
        pkgs.length > 1 ? h('div.pick-filter-pkgs', h('span.small.muted', t('creation.showPackages')),
          pkgs.map(id => h('label.check.small', h('input', { type: 'checkbox', checked: !filters.hidden.includes(id),
            onchange: ev => { filters.hidden = ev.target.checked ? filters.hidden.filter(x => x !== id) : [...filters.hidden, id]; saveFilters(); redraw(); } }),
            inst?.[id]?.name || id))) : null) : null,
      filteredOut ? h('p.small.muted', { style: { margin: '0 0 .5rem' } }, t('creation.filteredOut', { n: filteredOut })) : null,
      search,
      single && min === 0 ? h('div.choice', { class: c.picks.length ? '' : 'selected' },
        h('label.choice-main', h('input', { type: 'radio', name: `step${index}`, checked: !c.picks.length, onchange: () => { c.picks = []; redraw(); } }),
          h('span.choice-text', h('strong', t('creation.none'))))) : null,
      ...sections(list).map(([title, part]) => [title ? h('h4.choice-group', title) : null, h('div.choices', part.map(card))]),
      extra ? h('div.row', { style: { justifyContent: 'center', marginTop: '.6rem' } },
        h('button', { type: 'button', onclick: () => { shown += SHOWN; redraw(); } }, t('creation.loadMore', { n: Math.min(extra, SHOWN) })),
        h('span.muted.small', t('creation.more', { n: extra }))) : null,
      list.length ? null : h('p.muted', t('sheet.nothingFound')),
    ];
  }

  // Attributes: point-buy (with an optional cost table) or rolled values ("roll").
  function attributesStep(step, calc, _sheet, calcAfter) {
    const c = choices[index];
    c.values ||= Object.fromEntries(Object.values(rules.attributes).map(a => [a.id, base.attributes?.[a.id] ?? a.default ?? a.min ?? 0]));
    const canRoll = !levelUp && step.roll?.dice;
    if (!canRoll) c.method = 'points';
    c.method ||= 'points';
    const methods = canRoll ? h('div.method-switch', { role: 'radiogroup' },
      ['points', 'roll'].map(m => h('label.choice-inline',
        h('input', { type: 'radio', name: `attr-method-${index}`, checked: c.method === m, onchange: () => { c.method = m; redraw(); } }),
        ' ', t(m === 'points' ? 'creation.methodPoints' : 'creation.methodRoll')))) : null;
    return [methods, ...(c.method === 'roll' ? rollMethod(step, c, calcAfter) : pointsMethod(step, c, calc, calcAfter))];
  }

  function pointsMethod(step, c, calc, calcAfter) {
    const left = attributePointsLeft(step, calc);
    const allowDecrease = step.decrease !== false;
    const table = costTable(step);
    const allowed = table ? costValues(table) : null;
    // With a table, each step up costs the difference between the table rows.
    const stepCost = v => (table ? (costOf(table, v + 1) ?? Infinity) - (costOf(table, v) ?? 0) : 1);
    return [
      h('div.points-left', { class: left < 0 ? 'over' : left === 0 ? 'done' : '' }, h('strong', fmt(left)), ' ', t('creation.pointsToSpend', { n: left })),
      table ? h('p.small.muted', t('creation.costTable', { list: allowed.map(v => `${signed(v)} = ${fmt(table[String(v)])}`).join(' · ') })) : null,
      h('div.attr-rows', Object.values(rules.attributes).map(a => {
        const v = c.values[a.id];
        const d = attrStart(a);
        const set = n => { c.values[a.id] = n; redraw(); };
        const eff = calcAfter.value(a.id);
        const downOk = table ? allowed.includes(v - 1) : true;
        const upOk = table ? allowed.includes(v + 1) && stepCost(v) <= left : left > 0;
        return h('div.attr-row', { title: a.description || '' },
          h('div.attr-name', h('strong', a.abbr || a.id), h('span.muted.small', a.name)),
          h('div.stepper',
            h('button', { type: 'button', 'aria-label': `${a.name} −1`, disabled: !downOk || v <= (a.min ?? -Infinity) || ((!allowDecrease || levelUp) && v <= d), onclick: () => set(v - 1) }, '−'),
            h('output', { 'aria-label': a.name }, fmt(v)),
            h('button', { type: 'button', 'aria-label': `${a.name} +1`, disabled: !upOk || v >= (a.max ?? Infinity), onclick: () => set(v + 1) }, '+')),
          h('div.attr-result',
            table && Number.isFinite(stepCost(v)) && allowed.includes(v + 1) ? h('span.small.muted', t('creation.nextCost', { n: stepCost(v) })) : null,
            eff !== v ? h('span.small', { style: { color: 'var(--accent)' } }, t('sheet.effective', { n: fmt(eff) })) : null,
            rules.rolls?.modifier ? h('span.mod-badge', signed(calcAfter.mod(eff))) : null));
      })),
    ];
  }

  function rollMethod(step, c, calcAfter) {
    const cfg = step.roll, ids = Object.keys(rules.attributes), count = ids.length;
    const diceText = cfg.label || cfg.dice;
    const range = diceRange(cfg.dice);
    c.rolls ||= Array.from({ length: count }, () => ({}));
    c.assign ||= {};
    const setTotalAt = (i, raw) => {
      const n = Number(raw);
      c.rolls[i] = Number.isFinite(n) && raw !== '' ? { total: n, value: convertRoll(n, cfg.table) } : {};
      redraw();
    };
    const used = new Set(Object.values(c.assign).filter(x => x !== '' && x !== undefined).map(Number));
    const label = (r, i) => `#${i + 1}: ${r.total}${cfg.table ? ` → ${signed(r.value)}` : ''}`;
    const ready = c.rolls.every(r => Number.isFinite(r.total));
    const min = Number(cfg.min_total);
    return [
      h('p', t('creation.rollHelp', { dice: diceText, n: count })),
      h('div.row',
        h('button.primary', { type: 'button', onclick: () => { c.rolls = rollSet({ ...cfg, count }); c.assign = {}; redraw(); } }, t('creation.rollAll')),
        h('span.small.muted', t('creation.rollTyped', { min: range.min, max: range.max }))),
      h('div.attr-rolls', c.rolls.map((r, i) => h('label.attr-roll',
        h('span.small.muted', `#${i + 1}`),
        h('input', { type: 'number', inputmode: 'numeric', min: range.min, max: range.max, value: Number.isFinite(r.total) ? r.total : '',
          'aria-label': t('creation.rollN', { n: i + 1 }), onchange: e => setTotalAt(i, e.target.value) }),
        r.dice ? h('span.small.muted', `[${r.dice.join(', ')}]`) : null,
        Number.isFinite(r.value) && cfg.table ? h('strong', signed(r.value)) : null))),
      ready && Number.isFinite(min) ? h('p.small', { class: setTotal(c.rolls) < min ? 'warn-text' : 'muted' }, t('creation.rollSum', { n: setTotal(c.rolls), min })) : null,
      ready ? h('div.attr-rows', Object.values(rules.attributes).map(a => {
        const cur = c.assign[a.id];
        const eff = calcAfter.value(a.id);
        return h('div.attr-row', { title: a.description || '' },
          h('div.attr-name', h('strong', a.abbr || a.id), h('span.muted.small', a.name)),
          h('select', { 'aria-label': a.name, onchange: e => { c.assign[a.id] = e.target.value === '' ? '' : Number(e.target.value); redraw(); } },
            h('option', { value: '', selected: cur === undefined || cur === '' }, t('creation.pickRoll')),
            c.rolls.map((r, i) => h('option', { value: i, selected: cur === i, disabled: used.has(i) && cur !== i }, label(r, i)))),
          h('div.attr-result',
            cur !== undefined && cur !== '' && eff !== c.rolls[cur]?.value ? h('span.small', { style: { color: 'var(--accent)' } }, t('sheet.effective', { n: fmt(eff) })) : null,
            cur !== undefined && cur !== '' && rules.rolls?.modifier ? h('span.mod-badge', signed(calcAfter.mod(eff))) : null));
      })) : null,
    ];
  }

  // Skills: choose N for a bonus, or spend points.
  // Skills an earlier step already trained, with where and a button that goes back to that step.
  function trainedNote(ids, lost) {
    if (!ids.length) return null;
    const src = skillSources(index);
    const sheet = build(index);
    return h('div.skill-conflicts', { class: lost ? 'lost' : '' }, h('p.small', t(lost ? 'creation.alreadyTrainedHelp' : 'creation.alreadyTrainedInfo')),
      ids.map(id => {
        const j = src[id];
        const where = j >= 0 ? (steps[j].title || defaultTitle(steps[j])) : t('creation.fromSheet');
        return h('div.skill-conflict', h('strong', skillName(id, sheet)), h('span.muted.small', t('creation.trainedIn', { step: where })),
          j >= 0 ? h('button.mini', { type: 'button', onclick: () => { index = j; query = ''; showAll = false; shown = SHOWN; draw(); } }, t('creation.change')) : null);
      }));
  }

  /** A name for each specialty the player picks ("Craft: Armorer"), with the system's suggestions. */
  function specialtyNames(toks, c) {
    const ids = [...new Set(toks.filter(needsName).map(tokBase))];
    if (!ids.length) return null;
    c.spec ||= {};
    return h('div.specialty-names', ids.map(id => {
      const listId = `wiz-spec-${index}-${id}`;
      return h('label.field.specialty-name', h('span', t('creation.specialtyOf', { skill: rules.skills[id].name })),
        h('input', { type: 'text', maxlength: 40, list: listId, value: c.spec[id] || '', 'data-spec': id, placeholder: t('sheet.specialtyName'),
          oninput: e => {
            c.spec[id] = e.target.value;
            const pos = e.target.selectionStart;
            redraw();
            const el = app.querySelector(`input[data-spec="${CSS.escape(id)}"]`);
            el?.focus(); el?.setSelectionRange(pos, pos);
          } }),
        h('datalist', { id: listId }, specialtySuggestions(rules.skills[id]).map(n => h('option', { value: n }))));
    }));
  }

  function skillsStep(step, calc, sheet, calcAfter) {
    const c = choices[index];
    const trained = tok => tokTrained(step, tok, c, sheet);
    // The total the skill (or the named specialty) will have; nothing yet for a specialty without a name.
    const value = tok => { const target = tokTarget(tok, c); return target ? h('strong', signed(calcAfter.value(target))) : null; };
    if (step.grant) {
      c.alt ||= {};
      const groups = grantGroups(step, sheet);
      const plainTrained = tok => !needsName(tok) && trained(tok);
      const fixed = groups.filter(g => g.length === 1).map(g => g[0]);
      const given = fixed.filter(tok => !plainTrained(tok));
      // Lost: a fixed skill, or every skill of an "or", that was already trained.
      const conflicts = [...new Set(groups.filter(g => g.every(plainTrained)).flat())].map(tok => tokTarget(tok, c)).filter(Boolean);
      const picked = groups.map((g, gi) => (g.length === 1 ? g[0] : groupPick(step, g, c.alt[gi], sheet, c))).filter(Boolean);
      return [
        given.length ? h('div', h('p.small.muted', t('creation.grantedSkills')),
          h('div.skill-chips', given.map(tok => h('span.skill-chip.granted', h('span', tokName(tok, c)), value(tok))))) : null,
        ...groups.map((g, gi) => (g.length < 2 ? null : h('div',
          h('p', t('creation.chooseOneOf', { list: g.map(tok => tokName(tok)).join(` ${t('creation.or')} `) })),
          h('div.skill-chips', g.map(tok => {
            const on = groupPick(step, g, c.alt[gi], sheet, c) === tok;
            const off = plainTrained(tok);
            return h('button.skill-chip', { type: 'button', 'aria-pressed': String(on), disabled: off, class: off ? 'trained' : '',
              onclick: () => { c.alt[gi] = tok; redraw(); } }, h('span', tokName(tok)), off ? h('span.small', t('creation.trained')) : value(tok));
          }))))),
        specialtyNames(picked, c),
        groups.length ? null : h('p.muted', t('creation.noGrantedSkills')),
        trainedNote(conflicts, true),
      ];
    }
    if (step.choose !== undefined) {
      c.chosen ||= [];
      const need = num(step.choose, calc, 0);
      const bonus = num(step.bonus, calc, 1);
      const allowed = allowedSkills(step, calc, sheet);
      // A skill with specialties is never "already trained" as a whole: another specialty can still be taken.
      const off = tok => !needsName(tok) && trained(tok);
      c.chosen = c.chosen.filter(tok => allowed.includes(tok) && !off(tok));
      const taken = allowed.filter(off);
      return [
        h('p', t('creation.chooseSkills', { n: need, bonus: signed(bonus) })),
        h('span.badge', t('creation.chosen', { n: c.chosen.length, max: need })),
        // Already trained skills stay in the list, disabled, so the player sees why they can't be picked.
        h('div.skill-chips', [...allowed].sort((a, b) => byName(tokName(a), tokName(b))).map(tok => {
          const on = c.chosen.includes(tok);
          if (off(tok)) {
            return h('button.skill-chip.trained', { type: 'button', disabled: true, 'aria-pressed': 'false', title: t('creation.trained') },
              h('span', tokName(tok)), h('span.small', t('creation.trained')));
          }
          return h('button.skill-chip', { type: 'button', 'aria-pressed': String(on), disabled: !on && c.chosen.length >= need,
            onclick: () => { c.chosen = on ? c.chosen.filter(x => x !== tok) : [...c.chosen, tok]; redraw(); } },
          h('span', on ? tokName(tok, c) : tokName(tok)), value(tok) || h('strong', signed(calcAfter.value(tokBase(tok)))));
        })),
        specialtyNames(c.chosen, c),
        // With a short list (from a race, class or origin), say where the trained ones came from.
        step.from ? trainedNote(taken.map(tok => tokTarget(tok, c)).filter(Boolean), need > allowed.length - taken.length) : null,
      ];
    }
    c.points ||= {};
    const total = num(step.points, calc, 0);
    const cap = num(step.max_per_skill, calc, Infinity);
    const left = total - Object.values(c.points).reduce((a, b) => a + b, 0);
    return [
      h('div.points-left', { class: left < 0 ? 'over' : left === 0 ? 'done' : '' }, h('strong', fmt(left)), ' ', t('creation.pointsToSpend', { n: left })),
      h('div.attr-rows', Object.values(rules.skills).sort((a, b) => byName(a.name, b.name)).map(s => {
        const v = c.points[s.id] || 0;
        const set = n => { if (n) c.points[s.id] = n; else delete c.points[s.id]; redraw(); };
        return h('div.attr-row',
          h('div.attr-name', h('strong', s.name), s.attribute ? h('span.muted.small', [].concat(s.attribute).map(a => rules.attributes[a]?.abbr || a).join('/')) : null),
          h('div.stepper',
            h('button', { type: 'button', 'aria-label': `${s.name} −1`, disabled: v <= 0, onclick: () => set(v - 1) }, '−'),
            h('output', fmt(v)),
            h('button', { type: 'button', 'aria-label': `${s.name} +1`, disabled: left <= 0 || v >= cap, onclick: () => set(v + 1) }, '+')),
          h('div.attr-result', h('span.mod-badge', signed(calcAfter.value(s.id)))));
      })),
    ];
  }

  // Text, plus the full description of what was picked in a collection.
  function infoStep(step, _calc, sheet) {
    const shown = step.show ? sheet.items.filter(i => i.collection === step.show).map(i => rules.entities[step.show]?.[i.ref]).filter(Boolean) : [];
    return [
      step.text ? h('p', { style: { whiteSpace: 'pre-line' } }, step.text) : null,
      shown.map(e => h('div.info-box', h('h3', e.name), h('p', { style: { whiteSpace: 'pre-line' } }, e.description || ''))),
    ];
  }

  // Starting equipment from what was picked (e.g. the background), or an alternative.
  function itemsStep(step, _calc, sheet) {
    const c = choices[index];
    c.kit ||= {};
    c.roll ||= {};
    const kit = startingKit(step, sheet);
    const take = c.take !== false || !step.alternative;
    const colName = id => rules.collections[id]?.name || id;
    // "A simple weapon of your choice": a list of what fits, with Details for the one picked.
    const choiceRow = ch => {
      const value = c.kit[ch.key] || '';
      const [pc, pr] = value.split('/');
      return h('li.kit-choice',
        h('label.kit-pick', h('span', ch.label || t('creation.kitItem')),
          h('select', { onchange: e => { if (e.target.value) c.kit[ch.key] = e.target.value; else delete c.kit[ch.key]; redraw(); } },
            h('option', { value: '', selected: !value }, ch.optional ? t('creation.kitNone') : t('creation.kitPick')),
            ch.options.map(o => h('option', { value: `${o.collection}/${o.ref}`, selected: value === `${o.collection}/${o.ref}` }, o.name)))),
        ch.qty !== 1 ? h('span.kit-qty', `×${fmt(ch.qty)}`) : null,
        value && rules.entities[pc]?.[pr] ? h('button.mini', { type: 'button', onclick: ev => { ev.preventDefault(); entityDetails(st, pc, pr); } }, t('creation.details')) : null);
    };
    // "T$ 4d6": roll here, or type what was rolled at the table.
    const rollRow = r => {
      const cur = c.roll[r.key] || {};
      const range = diceRange(r.dice);
      const set = (value, dice) => { c.roll[r.key] = { value, ...(dice ? { dice } : {}) }; redraw(); };
      return h('li.kit-roll',
        h('span', r.label), h('span.muted.small', ` (${r.dice})`),
        h('div.row.kit-roll-controls',
          h('button.mini', { type: 'button', onclick: ev => { ev.preventDefault(); const x = rollDice(r.dice); set(x.total, x.dice); } }, t('creation.kitRollButton', { dice: r.dice })),
          h('input', { type: 'number', inputmode: 'numeric', min: range.min, max: range.max, value: cur.value ?? '', placeholder: t('creation.kitTyped'),
            'aria-label': t('creation.kitTypedOf', { what: r.label }), onclick: ev => ev.stopPropagation(),
            onchange: e => set(e.target.value === '' ? '' : Math.max(0, Math.round(Number(e.target.value) || 0))) }),
          cur.dice ? h('span.muted.small', `[${cur.dice.join(', ')}]`) : null));
    };
    const list = h('ul.kit', kit.items.map(it => {
      const ent = rules.entities[it.collection][it.ref];
      return h('li', h('span', it.name || ent.name), h('span.muted.small', ` ${colName(it.collection)}`),
        h('span.kit-qty', `×${fmt(it.qty)}`), it.wear ? h('span.badge.warning', `${t('sheet.wear')} ${it.wear}`) : null);
    }), kit.choices.map(choiceRow), kit.rolls.map(rollRow),
    kit.texts.map(x => h('li', h('span', x), h('span.muted.small', ` ${t('creation.asNote')}`))));
    const empty = !kit.items.length && !kit.texts.length && !kit.choices.length && !kit.rolls.length;
    const option = (on, label, body, value) => h('div.choice', { class: on ? 'selected' : '' },
      h('label.choice-main', h('input', { type: 'radio', name: `step${index}`, checked: on, onchange: () => { c.take = value; redraw(); } }),
        h('span.choice-text', h('strong', label), body)));
    if (!step.alternative) return empty ? h('p.muted', t('creation.noKit')) : list;
    return h('div.choices',
      option(take, step.take_label || t('creation.takeKit'), empty ? h('span.choice-desc', t('creation.noKit')) : list, true),
      option(!take, step.alternative.label || t('creation.alternative'), step.alternative.text ? h('span.choice-desc', step.alternative.text) : null, false));
  }

  function notesStep(step) {
    const c = choices[index];
    c.notes ||= {};
    return (step.items || []).map(n => h('label.field', h('span', n.title || n.id),
      h('textarea', { value: c.notes[n.id] || '', placeholder: n.placeholder || '', oninput: e => { c.notes[n.id] = e.target.value; } })));
  }

  // ---------- Review ----------
  function review() {
    if (levelUp) return levelReview();
    const sheet = build();
    const calc = compute(rules, sheet);
    const vis = visibleSteps();
    const name = h('input.name', { type: 'text', value: base.name || '', 'aria-label': t('new.name'), oninput: e => { base.name = e.target.value; } });
    const groups = {};
    for (const i of sheet.items) (groups[i.collection] ||= []).push(rules.entities[i.collection]?.[i.ref]?.name || i.ref);
    const skillBonus = Object.entries(sheet.skills).filter(([, n]) => n).map(([id, n]) => `${skillName(id, sheet)} ${signed(n)}`);
    app.replaceChildren(h('div.wizard',
      progress(vis.length + 1, vis.length + 1, t('creation.review')),
      h('section.card.wizard-step',
        h('h2', t('creation.review')),
        h('p.muted', t('creation.reviewIntro')),
        h('label.field', h('span', t('new.name')), name),
        h('div.attributes', Object.values(rules.attributes).map(a => {
          const eff = calc.value(a.id);
          return h('div.attribute', h('div.label', a.abbr || a.id), h('div.attr-big', fmt(eff)), rules.rolls?.modifier ? h('div.mod', signed(calc.mod(eff))) : null);
        })),
        summary(calc),
        h('table.table', { style: { marginTop: '.75rem' } }, h('tbody',
          Object.entries(groups).map(([col, names]) => h('tr', h('td.muted', rules.collections[col]?.name || col), h('td', names.join(', ')))),
          skillBonus.length ? h('tr', h('td.muted', t('sheet.skills')), h('td', skillBonus.join(', '))) : null))),
      h('div.wizard-footer', h('div.row.spread',
        h('button', { type: 'button', onclick: () => { index = firstFrom(steps.length - 1, -1); draw(); } }, `← ${t('common.back')}`),
        h('button.primary', { type: 'button', onclick: () => onDone(finished({ ...build(), name: base.name.trim() })) }, t('new.create'))))));
    window.scrollTo(0, 0);
  }

  /** Level up: what changes, then confirm. */
  function levelReview() {
    const sheet = build();
    const calc = compute(rules, sheet);
    const vis = visibleSteps();
    const oldUids = new Set((levelUp.items || []).map(i => i.uid));
    const added = sheet.items.filter(i => !oldUids.has(i.uid)).map(i => rules.entities[i.collection]?.[i.ref]?.name || i.ref);
    const attrs = Object.values(rules.attributes).filter(a => (sheet.attributes?.[a.id] ?? 0) !== (levelUp.attributes?.[a.id] ?? 0))
      .map(a => `${a.abbr || a.id} ${fmt(levelUp.attributes?.[a.id] ?? 0)} → ${fmt(sheet.attributes[a.id])}`);
    const skills = [...new Set([...Object.keys(sheet.skills), ...Object.keys(levelUp.skills || {})])]
      .filter(id => (sheet.skills[id] || 0) !== (levelUp.skills?.[id] || 0))
      .map(id => `${skillName(id, sheet)} ${signed((sheet.skills[id] || 0) - (levelUp.skills?.[id] || 0))}`);
    const rows = [[t('level.added'), added], [t('sheet.attributes'), attrs], [t('sheet.skills'), skills]].filter(([, v]) => v.length);
    app.replaceChildren(h('div.wizard',
      progress(vis.length + 1, vis.length + 1, t('creation.review')),
      h('section.card.wizard-step',
        h('h2', t('level.title', { n: sheet.level })),
        h('p.muted', t('level.reviewIntro')),
        summary(calc),
        rows.length ? h('table.table', { style: { marginTop: '.75rem' } }, h('tbody', rows.map(([k, v]) => h('tr', h('td.muted', k), h('td', v.join(', ')))))) : null),
      h('div.wizard-footer', h('div.row.spread',
        vis.length ? h('button', { type: 'button', onclick: () => { index = firstFrom(steps.length - 1, -1); draw(); } }, `← ${t('common.back')}`) : h('button', { type: 'button', onclick: onSkip }, t('common.cancel')),
        h('button.primary', { type: 'button', onclick: () => onDone(finished(build())) }, t('level.confirm', { n: sheet.level }))))));
    window.scrollTo(0, 0);
  }

  draw();
}
