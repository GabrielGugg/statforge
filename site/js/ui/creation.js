// ============================================================
// Character creation assistant, driven by the system's "creation" steps.
// Each step only records the player's choices; the sheet is rebuilt from
// all choices every time, so going back and changing something is safe.
// ============================================================
import { compute } from '../engine/calc.js';
import { t } from '../i18n.js';
import { h, uid, fmt, signed, byName, normalize } from './util.js';
import { entityDetails, describeEffect } from './sheet.js';

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

  /** A fresh sheet to rebuild on: empty when creating, the current sheet when leveling up. */
  function fresh() {
    const s = structuredClone(base);
    if (!levelUp) { s.items = []; s.skills = {}; s.notes = {}; }
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

  function applyStep(step, choice, s) {
    if (step.type === 'pick') {
      const col = rules.collections[step.collection] || {};
      for (const ref of choice.picks || []) {
        if (!rules.entities[step.collection]?.[ref]) continue;
        s.items.push({ uid: uid(), collection: step.collection, ref,
          ...(col.quantity ? { qty: 1 } : {}), ...(col.equippable ? { equipped: true } : {}) });
      }
    } else if (step.type === 'attributes') {
      Object.assign(s.attributes, choice.values || {});
    } else if (step.type === 'skills') {
      const calc = compute(rules, s);
      if (step.choose !== undefined) {
        const bonus = num(step.bonus, calc, 1);
        const allowed = allowedSkills(step, calc, s);
        for (const id of choice.chosen || []) if (allowed.includes(id)) s.skills[id] = (s.skills[id] || 0) + bonus;
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

  /** Starting items of the entities picked in step.from, filtered by their "if". */
  function startingKit(step, sheet) {
    const calc = compute(rules, sheet);
    const field = step.field || 'starting_items';
    const items = [], texts = [];
    for (const it of sheet.items.filter(i => i.collection === step.from)) {
      for (const e of rules.entities[step.from]?.[it.ref]?.[field] || []) {
        if (e.if && !calc.formula(e.if)) continue;
        if (e.text) { texts.push(e.text); continue; }
        const [collection, ref] = String(e.ref || '').split('/');
        if (!rules.entities[collection]?.[ref]) { texts.push(`${e.qty || 1}× ${e.name || e.ref}`); continue; }
        items.push({ collection, ref, qty: Number(e.qty) || 1, wear: Number(e.wear) || 0, equipped: !!e.equipped, name: e.name });
      }
    }
    return { items, texts };
  }

  function firstFrom(i, dir = 1) {
    for (let j = i; j >= 0 && j < steps.length; j += dir) if (applies(steps[j], build(j))) return j;
    return dir > 0 ? steps.length : -1; // steps.length = review
  }

  /** Steps that apply with the current choices (for "step N of M"). */
  function visibleSteps() {
    const out = [];
    const s = fresh();
    steps.forEach((step, i) => {
      if (!applies(step, s)) return;
      out.push(i);
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

  function available(step, ent, calc) {
    if (!step.match_field) return true;
    const v = ent[step.match_field];
    if (v === undefined || v === null || v === '') return true;
    return nameMatches(String(v), calc);
  }

  function allowedSkills(step, calc, sheet) {
    const all = Object.values(rules.skills);
    const from = step.from;
    if (!from?.collection || !from?.field) return all.map(s => s.id);
    const texts = (sheet.items || []).filter(i => i.collection === from.collection)
      .map(i => rules.entities[from.collection]?.[i.ref]?.[from.field]).filter(v => v !== undefined && v !== '');
    if (!texts.length) return all.map(s => s.id);
    const names = texts.flatMap(v => (Array.isArray(v) ? v : String(v).split(/\s*[,;]\s*/))).map(normalize).filter(Boolean);
    if (!names.length) return all.map(s => s.id);
    return all.filter(s => names.includes(normalize(s.name)) || names.includes(normalize(s.id))).map(s => s.id);
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
    if (step.type === 'attributes') {
      const left = attributePointsLeft(step, calc);
      if (left < 0) return { ok: false, msg: t('creation.pointsOver', { n: -left }) };
      if (left > 0) return { ok: true, warn: t('creation.pointsLeft', { n: left }) };
      return { ok: true };
    }
    if (step.type === 'skills') {
      if (step.choose !== undefined) {
        const need = num(step.choose, calc, 0);
        const allowed = allowedSkills(step, calc, sheet);
        const have = (c.chosen || []).filter(id => allowed.includes(id)).length;
        const possible = Math.min(need, allowed.length);
        if (have < possible) return { ok: false, msg: t('creation.chooseMore', { n: possible - have }) };
        return { ok: true };
      }
      const left = num(step.points, calc, 0) - Object.values(c.points || {}).reduce((a, b) => a + b, 0);
      if (left < 0) return { ok: false, msg: t('creation.pointsOver', { n: -left }) };
      if (left > 0) return { ok: true, warn: t('creation.pointsLeft', { n: left }) };
    }
    return { ok: true };
  }

  function attributePointsLeft(step, calc) {
    const values = choices[steps.indexOf(step)].values || {};
    const spent = Object.values(rules.attributes).reduce((sum, a) => {
      const d = levelUp ? base.attributes?.[a.id] ?? a.default ?? a.min ?? 0 : a.default ?? a.min ?? 0;
      return sum + ((values[a.id] ?? base.attributes[a.id] ?? d) - d);
    }, 0);
    return num(step.points, calc, 0) - spent;
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

  function footer(v) {
    const back = firstFrom(index - 1, -1);
    return h('div.wizard-footer',
      v.msg ? h('div.small', { style: { color: 'var(--danger)' } }, v.msg) : v.warn ? h('div.small', { style: { color: 'var(--warning)' } }, v.warn) : null,
      h('div.row.spread',
        back >= 0 ? h('button', { type: 'button', onclick: () => { index = back; query = ''; showAll = false; draw(); } }, `← ${t('common.back')}`) : h('span'),
        h('button.primary', { type: 'button', disabled: !v.ok, onclick: () => { index = firstFrom(index + 1); query = ''; showAll = false; draw(); } },
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
    const owned = new Set(levelUp && !step.repeat ? (levelUp.items || []).filter(i => i.collection === step.collection).map(i => i.ref) : []);
    const all = Object.values(rules.entities[step.collection] || {})
      .filter(e => (!step.tag || (e.tags || []).includes(step.tag)) && !owned.has(e.id)).sort((a, b) => byName(a.name, b.name));
    const okAll = all.filter(e => available(step, e, calc));
    const hidden = all.length - okAll.length;
    let list = showAll ? all : okAll;
    const q = normalize(query);
    if (q) list = list.filter(e => normalize(`${e.name} ${e.description || ''} ${Object.values(e).filter(x => typeof x === 'string').join(' ')}`).includes(q));
    // chosen ones first, so they never get lost behind the search
    const chosen = c.picks.map(id => rules.entities[step.collection]?.[id]).filter(Boolean);
    list = [...chosen, ...list.filter(e => !c.picks.includes(e.id))];
    const extra = Math.max(0, list.length - SHOWN);
    list = list.slice(0, SHOWN);

    const toggle = id => {
      if (single) c.picks = c.picks[0] === id && min === 0 ? [] : [id];
      else if (c.picks.includes(id)) c.picks = c.picks.filter(x => x !== id);
      else if (c.picks.length < max) c.picks = [...c.picks, id];
      redraw();
    };
    const fields = rules.collections[step.collection]?.fields || {};
    const card = e => {
      const on = c.picks.includes(e.id);
      const ok = available(step, e, calc);
      const desc = String(e.description || '').replace(/\s+/g, ' ');
      const facts = Object.entries(fields).filter(([k]) => e[k] !== undefined && e[k] !== '' && typeof e[k] !== 'object' && !desc.slice(0, 200).includes(String(e[k])))
        .slice(0, 3).map(([k, f]) => h('span.badge', `${f.label || k}: ${e[k]}${f.unit ? ` ${f.unit}` : ''}`));
      const fx = (e.effects || []).filter(ef => ef.type !== 'note').slice(0, 4).map(ef => h('span.badge.ok', describeEffect(rules, ef)));
      return h('div.choice', { class: on ? 'selected' : '' },
        h('label.choice-main',
          h('input', { type: single ? 'radio' : 'checkbox', name: `step${index}`, checked: on, disabled: !on && !single && c.picks.length >= max, onchange: () => toggle(e.id) }),
          h('span.choice-text',
            h('strong', e.name), ok ? null : h('span.badge.warning', { style: { marginLeft: '.4rem' } }, t('creation.unmet')),
            desc ? h('span.choice-desc', desc.length > 180 ? `${desc.slice(0, 180)}…` : desc) : null,
            facts.length || fx.length ? h('span.choice-facts', facts, fx) : null)),
        h('button.mini', { type: 'button', onclick: () => entityDetails(st, step.collection, e.id) }, t('creation.details')));
    };

    const search = all.length > 8 ? h('input', { type: 'search', value: query, placeholder: t('creation.search'), 'aria-label': t('sheet.search'),
      oninput: e => { query = e.target.value; const pos = e.target.selectionStart; redraw(); const el = app.querySelector('.wizard-step input[type=search]'); el?.focus(); el?.setSelectionRange(pos, pos); } }) : null;
    return [
      h('div.row.spread', { style: { marginBottom: '.5rem' } },
        h('span.badge', max === Infinity ? t('creation.chosenFree', { n: c.picks.length }) : t('creation.chosen', { n: c.picks.length, max })),
        hidden ? h('label.check.small', h('input', { type: 'checkbox', checked: showAll, onchange: e => { showAll = e.target.checked; redraw(); } }), t('creation.showAll', { n: hidden })) : null),
      search,
      single && min === 0 ? h('div.choice', { class: c.picks.length ? '' : 'selected' },
        h('label.choice-main', h('input', { type: 'radio', name: `step${index}`, checked: !c.picks.length, onchange: () => { c.picks = []; redraw(); } }),
          h('span.choice-text', h('strong', t('creation.none'))))) : null,
      h('div.choices', list.map(card)),
      extra ? h('p.muted.small', t('creation.more', { n: extra })) : null,
      list.length ? null : h('p.muted', t('sheet.nothingFound')),
    ];
  }

  // Point-buy for attributes.
  function attributesStep(step, calc, _sheet, calcAfter) {
    const c = choices[index];
    c.values ||= Object.fromEntries(Object.values(rules.attributes).map(a => [a.id, base.attributes?.[a.id] ?? a.default ?? a.min ?? 0]));
    const left = attributePointsLeft(step, calc);
    const allowDecrease = step.decrease !== false;
    return [
      h('div.points-left', { class: left < 0 ? 'over' : left === 0 ? 'done' : '' }, h('strong', fmt(left)), ' ', t('creation.pointsToSpend', { n: left })),
      h('div.attr-rows', Object.values(rules.attributes).map(a => {
        const v = c.values[a.id];
        const d = levelUp ? base.attributes?.[a.id] ?? a.default ?? a.min ?? 0 : a.default ?? a.min ?? 0;
        const set = n => { c.values[a.id] = n; redraw(); };
        const eff = calcAfter.value(a.id);
        return h('div.attr-row', { title: a.description || '' },
          h('div.attr-name', h('strong', a.abbr || a.id), h('span.muted.small', a.name)),
          h('div.stepper',
            h('button', { type: 'button', 'aria-label': `${a.name} −1`, disabled: v <= (a.min ?? -Infinity) || ((!allowDecrease || levelUp) && v <= d), onclick: () => set(v - 1) }, '−'),
            h('output', { 'aria-label': a.name }, fmt(v)),
            h('button', { type: 'button', 'aria-label': `${a.name} +1`, disabled: v >= (a.max ?? Infinity) || left <= 0, onclick: () => set(v + 1) }, '+')),
          h('div.attr-result',
            eff !== v ? h('span.small', { style: { color: 'var(--accent)' } }, t('sheet.effective', { n: fmt(eff) })) : null,
            rules.rolls?.modifier ? h('span.mod-badge', signed(calcAfter.mod(eff))) : null));
      })),
    ];
  }

  // Skills: choose N for a bonus, or spend points.
  function skillsStep(step, calc, sheet, calcAfter) {
    const c = choices[index];
    if (step.choose !== undefined) {
      c.chosen ||= [];
      const need = num(step.choose, calc, 0);
      const bonus = num(step.bonus, calc, 1);
      const allowed = allowedSkills(step, calc, sheet);
      c.chosen = c.chosen.filter(id => allowed.includes(id));
      return [
        h('p', t('creation.chooseSkills', { n: need, bonus: signed(bonus) })),
        h('span.badge', t('creation.chosen', { n: c.chosen.length, max: need })),
        h('div.skill-chips', allowed.map(id => rules.skills[id]).sort((a, b) => byName(a.name, b.name)).map(s => {
          const on = c.chosen.includes(s.id);
          return h('button.skill-chip', { type: 'button', 'aria-pressed': String(on), disabled: !on && c.chosen.length >= need,
            onclick: () => { c.chosen = on ? c.chosen.filter(x => x !== s.id) : [...c.chosen, s.id]; redraw(); } },
          h('span', s.name), h('strong', signed(calcAfter.value(s.id))));
        })),
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
          h('div.attr-name', h('strong', s.name), s.attribute ? h('span.muted.small', rules.attributes[s.attribute]?.abbr || s.attribute) : null),
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
    const kit = startingKit(step, sheet);
    const take = c.take !== false || !step.alternative;
    const list = h('ul.kit', kit.items.map(it => {
      const ent = rules.entities[it.collection][it.ref];
      return h('li', h('span', it.name || ent.name), h('span.muted.small', ` ${rules.collections[it.collection]?.name || it.collection}`),
        h('span.kit-qty', `×${fmt(it.qty)}`), it.wear ? h('span.badge.warning', `${t('sheet.wear')} ${it.wear}`) : null);
    }), kit.texts.map(x => h('li', h('span', x), h('span.muted.small', ` ${t('creation.asNote')}`))));
    const empty = !kit.items.length && !kit.texts.length;
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
    const skillBonus = Object.entries(sheet.skills).filter(([, n]) => n).map(([id, n]) => `${rules.skills[id]?.name || id} ${signed(n)}`);
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
        h('button.primary', { type: 'button', onclick: () => onDone({ ...build(), name: base.name.trim() }) }, t('new.create'))))));
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
    const skills = Object.values(rules.skills).filter(sk => (sheet.skills[sk.id] || 0) !== (levelUp.skills?.[sk.id] || 0))
      .map(sk => `${sk.name} ${signed((sheet.skills[sk.id] || 0) - (levelUp.skills?.[sk.id] || 0))}`);
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
        h('button.primary', { type: 'button', onclick: () => onDone(build()) }, t('level.confirm', { n: sheet.level }))))));
    window.scrollTo(0, 0);
  }

  draw();
}
