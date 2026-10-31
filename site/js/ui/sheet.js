// ============================================================
// Sheet: drawn from the system package's layout.
// ============================================================
import * as db from '../storage.js';
import * as pk from '../packages.js';
import { checkSet } from '../engine/package.js';
import { compute, roll } from '../engine/calc.js';
import { t } from '../i18n.js';
import { h, toast, dialog, confirm, ask, downloadJSON, uid, fmt, signed, byName, normalize } from './util.js';

const rollHistory = [];

export async function sheetScreen(app, id) {
  const sheet = await db.get('sheets', id);
  if (!sheet) { app.append(h('div.card.empty', h('p', t('sheet.notFound')), h('a.button', { href: '#/' }, t('common.back')))); return; }

  let built;
  try { built = await pk.rulesForSheet(sheet); } catch (e) {
    app.append(h('div.alert.error', e.message), h('a.button', { href: '#/packages' }, t('new.goPackages')));
    return;
  }
  const inst = await pk.installed();
  const state = { sheet, ...built, inst, tab: sessionStorage.getItem(`tab:${id}`) || null, editing: false };
  // The player's own arrangement of the blocks, shared by every sheet of the same system.
  const layoutKey = `layout:${sheet.system}`;
  state.custom = (await db.getConfig(layoutKey, {})) || {};
  state.saveCustom = () => db.setConfig(layoutKey, state.custom).catch(e => toast(e.message, 'error'));

  let timer;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { sheet.updated = new Date().toISOString(); db.put('sheets', sheet).catch(e => toast(e.message, 'error')); }, 300);
  };
  // Change that affects calculations: save and redraw, keeping the scroll position.
  const change = () => { save(); const y = window.scrollY; draw(); window.scrollTo(0, y); };
  state.save = save;
  state.change = change;
  state.redraw = () => { const y = window.scrollY; draw(); window.scrollTo(0, y); };

  function draw() {
    state.calc = compute(state.rules, sheet);
    app.replaceChildren(header(state), alerts(state), body(state));
  }
  draw();
}

// ---------- Header ----------
function header(st) {
  const { sheet, rules, calc } = st;
  const name = h('input.name', { type: 'text', value: sheet.name || '', placeholder: t('common.unnamed'), 'aria-label': t('new.name'),
    oninput: e => { sheet.name = e.target.value; st.save(); } });
  const numField = (label, field) => h('label.field', h('span', label),
    h('input.num', { type: 'number', value: sheet[field] ?? 0, inputmode: 'numeric',
      onchange: e => { sheet[field] = Number(e.target.value) || 0; st.change(); } }));
  let next = null;
  if (rules.progression?.xp_per_level) {
    const target = calc.formula(rules.progression.xp_per_level);
    if (target > 0) next = h('div.muted.small', `${t('sheet.nextLevel', { xp: fmt(target) })}${sheet.xp >= target ? ` — ${t('sheet.canLevel')}` : ''}`);
  }
  return h('div',
    h('div.sheet-header',
      h('label.field.field-name', h('span', st.system.name), name),
      numField(t('sheet.level'), 'level'),
      numField('XP', 'xp')),
    h('div.row.spread', { style: { marginBottom: '1rem' } },
      next || h('span'),
      h('div.row',
        h(`button.mini${st.editing ? '.primary' : ''}`, { 'aria-pressed': String(st.editing), onclick: () => { st.editing = !st.editing; st.redraw(); } },
          st.editing ? t('sheet.doneArranging') : t('sheet.arrange')),
        h('button.mini', { onclick: () => packagesDialog(st) }, t('sheet.packages', { n: st.active.length + 1 })),
        h('button.mini', { onclick: () => downloadJSON(sheet, `${normalize(sheet.name).replace(/[^a-z0-9]+/g, '-') || 'sheet'}.json`) }, t('sheet.export')),
        h('button.mini.danger', { onclick: async () => {
          if (await confirm(t('sheet.deleteTitle'), t('sheet.deleteAsk', { name: sheet.name || t('common.unnamed') }), { yes: t('sheet.delete'), danger: true })) {
            await db.remove('sheets', sheet.id);
            location.hash = '#/';
          }
        } }, t('sheet.delete')))));
}

function alerts(st) {
  const { warnings, log, calc, sheet, inst } = st;
  const parts = [];
  const errors = warnings.filter(a => a.level === 'error');
  if (errors.length) parts.push(h('div.alert.error', h('strong', t('sheet.packageProblems')), h('ul', errors.map(a => h('li', a.msg)))));
  const changed = Object.entries(sheet.versions || {}).filter(([id, v]) => inst[id] && inst[id].version !== v);
  if (changed.length) {
    parts.push(h('div.alert.ok', `${t('sheet.packagesUpdated')} `,
      changed.map(([id, v]) => `${inst[id].name} (v${v} → v${inst[id].version})`).join(', '), '. ',
      h('button.mini', { onclick: () => { for (const [pid] of changed) sheet.versions[pid] = inst[pid].version; st.change(); } }, 'OK')));
  }
  if (calc.errors.length) parts.push(h('div.alert', h('strong', t('sheet.calcWarnings')), h('ul', calc.errors.map(e => h('li', e)))));
  const conflicts = log.filter(l => l.level === 'conflict');
  if (conflicts.length) {
    parts.push(h('details.alert', h('summary', t('sheet.conflicts', { n: conflicts.length })), h('ul', conflicts.map(c => h('li', c.msg)))));
  }
  return h('div', parts);
}

// ---------- Tabs and blocks ----------
function autoLayout(rules) {
  const cols = Object.keys(rules.collections);
  return {
    tabs: [
      { id: 'main', name: t('sheet.tabMain'), blocks: [{ block: 'attributes' }, { block: 'resources' }, { block: 'derived' }, { block: 'skills' }, { block: 'counters' }, { block: 'effects' }] },
      { id: 'items', name: t('sheet.tabItems'), blocks: cols.map(c => ({ block: 'list', collection: c })) },
      { id: 'notes', name: t('sheet.tabNotes'), blocks: [{ block: 'notes', id: 'notes', title: t('sheet.notes') }, { block: 'roller' }] },
    ],
  };
}

function body(st) {
  const layout = st.rules.layout?.tabs?.length ? st.rules.layout : autoLayout(st.rules);
  const tabs = layout.tabs;
  if (!tabs.find(a => a.id === st.tab)) st.tab = tabs[0].id;
  const content = h('div');
  const buttons = tabs.map(a => h('button', { role: 'tab', 'aria-selected': String(a.id === st.tab), onclick: () => {
    st.tab = a.id;
    sessionStorage.setItem(`tab:${st.sheet.id}`, a.id);
    buttons.forEach(b => b.setAttribute('aria-selected', String(b === buttons[tabs.indexOf(a)])));
    drawTab(a);
  } }, a.name));
  function drawTab(a) {
    content.replaceChildren(dashboard(st, a));
  }
  drawTab(tabs.find(a => a.id === st.tab));
  // On phones the active tab may be off screen: scroll the bar to it.
  const bar = h('div.tabs', { role: 'tablist' }, buttons);
  requestAnimationFrame(() => {
    const b = buttons[tabs.findIndex(a => a.id === st.tab)];
    if (b) bar.scrollLeft = b.offsetLeft - bar.clientWidth / 2 + b.offsetWidth / 2;
  });
  return h('div', bar, content);
}

const BLOCKS = { attributes: attributesBlock, skills: skillsBlock, derived: derivedBlock, resources: resourcesBlock, counters: countersBlock, effects: effectsBlock, list: listBlock, notes: notesBlock, roller: rollerBlock };

function block(st, def) {
  const fn = BLOCKS[def.block];
  if (!fn) return [h('p.muted', t('sheet.unknownBlock', { name: def.block }))];
  return fn(st, def);
}

// ---------- Dashboard: a 12-column grid the player can rearrange ----------
const WIDTHS = [3, 4, 6, 8, 12];
const blockKey = (def, i) => def.id || `${def.block}-${def.collection || (def.items || []).join('+') || i}`;
const spans = w => ({ '--lg': w, '--md': Math.min(6, Math.max(2, Math.round(w / 2))), '--sm': w <= 3 ? 1 : 2 });

function dashboard(st, tab) {
  const saved = st.custom[tab.id] || [];
  const pos = new Map(saved.map((c, i) => [c.key, i]));
  const entries = (tab.blocks || []).map((def, i) => {
    const key = blockKey(def, i);
    const c = saved.find(x => x.key === key) || {};
    return { def, key, w: c.w || def.w || (def.wide ? 12 : 6), hidden: !!c.hidden, order: pos.has(key) ? pos.get(key) : saved.length + i };
  }).sort((a, b) => a.order - b.order);

  const grid = h('div.dash', { class: st.editing ? 'editing' : '' });
  const persist = () => {
    st.custom[tab.id] = [...grid.children].map(el => {
      const e = entries.find(x => x.key === el.dataset.key);
      return { key: e.key, w: e.w, ...(e.hidden ? { hidden: true } : {}) };
    });
    st.saveCustom();
  };

  for (const e of entries) {
    if (e.hidden && !st.editing) continue;
    const content = block(st, e.def);
    if (!content && !st.editing) continue;
    const el = h('section.card.block', { 'data-key': e.key, class: e.hidden ? 'is-hidden' : '' },
      st.editing ? tools(e) : null,
      content || h('p.muted.small', t('sheet.emptyBlock', { name: e.def.title || e.def.block })));
    for (const [k, v] of Object.entries(spans(e.w))) el.style.setProperty(k, v);
    grid.append(el);
  }

  function tools(e) {
    const setW = dir => {
      const i = WIDTHS.indexOf(WIDTHS.reduce((a, b) => (Math.abs(b - e.w) < Math.abs(a - e.w) ? b : a)));
      e.w = WIDTHS[Math.max(0, Math.min(WIDTHS.length - 1, i + dir))];
      persist(); st.redraw();
    };
    const move = dir => {
      const el = grid.querySelector(`[data-key="${CSS.escape(e.key)}"]`);
      const other = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
      if (!other) return;
      dir < 0 ? other.before(el) : other.after(el);
      persist();
    };
    const handle = h('button.mini.drag-handle', { type: 'button', title: t('sheet.drag'), 'aria-label': t('sheet.drag') }, '⠿');
    handle.addEventListener('pointerdown', ev => startDrag(ev, grid, persist));
    return h('div.block-tools',
      handle,
      h('button.mini', { type: 'button', 'aria-label': t('sheet.moveEarlier'), onclick: () => move(-1) }, '↑'),
      h('button.mini', { type: 'button', 'aria-label': t('sheet.moveLater'), onclick: () => move(1) }, '↓'),
      h('span.spacer'),
      h('button.mini', { type: 'button', 'aria-label': t('sheet.narrower'), disabled: e.w <= WIDTHS[0], onclick: () => setW(-1) }, '−'),
      h('span.small.muted', `${e.w}/12`),
      h('button.mini', { type: 'button', 'aria-label': t('sheet.wider'), disabled: e.w >= 12, onclick: () => setW(1) }, '+'),
      h('button.mini', { type: 'button', onclick: () => { e.hidden = !e.hidden; persist(); st.redraw(); } }, e.hidden ? t('sheet.show') : t('sheet.hide')));
  }

  if (!st.editing) return grid;
  return h('div',
    h('div.alert.ok.row.spread', h('span', t('sheet.arrangeHelp')),
      h('button.mini', { type: 'button', onclick: () => { delete st.custom[tab.id]; st.saveCustom(); st.redraw(); } }, t('sheet.resetLayout'))),
    grid);
}

/** Drag a block by its handle (mouse or touch); the others make room as it moves. */
function startDrag(ev, grid, done) {
  const el = ev.target.closest('.block');
  ev.preventDefault();
  el.classList.add('dragging');
  const onMove = e => {
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.dash > .block');
    if (!under || under === el || under.parentElement !== grid) return;
    const r = under.getBoundingClientRect();
    const after = r.width > grid.clientWidth * 0.75 ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
    after ? under.after(el) : under.before(el);
  };
  const onUp = () => {
    el.classList.remove('dragging');
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    done();
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

const pick = (map, ids) => (ids?.length ? ids.map(id => map[id]).filter(Boolean) : Object.values(map));

function attributesBlock(st, def) {
  const { rules, sheet, calc } = st;
  const list = pick(rules.attributes, def.items);
  if (!list.length) return null;
  const cells = list.map(a => {
    const base = sheet.attributes?.[a.id] ?? a.default ?? a.min ?? 0;
    const effective = calc.value(a.id);
    return h('div.attribute', { title: a.description || '' },
      h('div.label', a.abbr || a.id),
      h('div.small', a.name),
      h('input', { type: 'number', value: base, min: a.min, max: a.max, inputmode: 'numeric', 'aria-label': a.name,
        onchange: e => {
          let v = Number(e.target.value) || 0;
          if (a.min !== undefined) v = Math.max(a.min, v);
          if (a.max !== undefined) v = Math.min(a.max, v);
          (sheet.attributes ||= {})[a.id] = v;
          st.change();
        } }),
      effective !== base ? h('div.effective', t('sheet.effective', { n: fmt(effective) })) : null,
      rules.rolls?.modifier ? h('div.mod', signed(calc.mod(effective))) : null);
  });
  // Columns: all in one row when the block is wide enough, otherwise two even rows.
  const grid = h('div.attributes', cells);
  grid.style.setProperty('--n', Math.min(list.length, 8));
  grid.style.setProperty('--half', Math.ceil(Math.min(list.length, 8) / 2));
  return [h('h3', def.title || t('sheet.attributes')), h('div.attributes-wrap', grid)];
}

function skillsBlock(st, def) {
  const { rules, sheet, calc } = st;
  const list = pick(rules.skills, def.items).sort((a, b) => byName(a.name, b.name));
  if (!list.length) return null;
  const saved = id => Number(sheet.skills?.[id] || 0);
  const budget = def.budget !== undefined ? Number(calc.formula(def.budget)) || 0 : null;
  const spentOf = pts => list.reduce((n, p) => n + Number(pts[p.id] || 0), 0);
  const attr = p => (p.attribute ? h('span.muted.small', ` (${rules.attributes[p.attribute]?.abbr || p.attribute})`) : null);
  const name = p => h('td', h('span', { title: p.description || '' }, p.name), attr(p));
  const head = h('thead', h('tr', h('th', t('sheet.skill')), h('th.num', def.points_label || t('sheet.points')), h('th.num', t('sheet.total'))));

  // Reading mode: points and totals; "Edit" opens the editor.
  if (!st.skillDraft) {
    const spent = spentOf(sheet.skills || {});
    return [h('h3', h('span', def.title || t('sheet.skills')),
      h('button.mini', { onclick: () => { st.skillDraft = Object.fromEntries(list.map(p => [p.id, saved(p.id)])); st.redraw(); } }, t('sheet.editSkills'))),
      budget !== null && spent !== budget ? h('div.small.skill-budget.warn', t(spent > budget ? 'sheet.skillsOver' : 'sheet.skillsLeft', { n: Math.abs(budget - spent), spent, budget })) : null,
      h('div.scroll-table', h('table.table', head, h('tbody', list.map(p => h('tr', name(p),
        h('td.num', fmt(saved(p.id))),
        h('td.num', h('strong', signed(calc.value(p.id)))))))))];
  }

  // Editing: − / + change a draft; Apply saves it, Cancel drops it.
  const draft = st.skillDraft;
  const spent = spentOf(draft);
  const off = budget !== null && spent !== budget;
  const set = (id, v) => { draft[id] = v; st.redraw(); };
  const apply = async () => {
    if (off && !(await confirm(t('sheet.skillsCheckTitle'), t(spent > budget ? 'sheet.skillsOverAsk' : 'sheet.skillsLeftAsk', { n: Math.abs(budget - spent), spent, budget }), { yes: t('sheet.apply') }))) return;
    const next = {};
    for (const [id, v] of Object.entries(sheet.skills || {})) if (!list.some(p => p.id === id)) next[id] = v;
    for (const p of list) if (draft[p.id]) next[p.id] = draft[p.id];
    sheet.skills = next;
    st.skillDraft = null;
    st.change();
  };
  return [h('h3', def.title || t('sheet.skills')),
    budget !== null ? h('div.points-left.skill-budget', { class: spent > budget ? 'over' : spent === budget ? 'done' : '' },
      h('strong', `${fmt(spent)} / ${fmt(budget)}`), ' ', t('sheet.skillsSpent'),
      off ? h('div.small', t(spent > budget ? 'sheet.skillsOver' : 'sheet.skillsLeft', { n: Math.abs(budget - spent), spent, budget })) : null) : null,
    h('div.scroll-table', h('table.table', head, h('tbody', list.map(p => {
      const v = Number(draft[p.id] || 0);
      return h('tr', { class: v !== saved(p.id) ? 'changed' : '' }, name(p),
        h('td.num', h('div.stepper.small-stepper',
          h('button', { type: 'button', 'aria-label': `${p.name} −1`, onclick: () => set(p.id, v - 1) }, '−'),
          h('output', fmt(v)),
          h('button', { type: 'button', 'aria-label': `${p.name} +1`, onclick: () => set(p.id, v + 1) }, '+'))),
        h('td.num', h('strong', signed(calc.value(p.id) + v - saved(p.id)))));
    })))),
    h('div.row.skill-actions',
      h('button', { onclick: () => { st.skillDraft = null; st.redraw(); } }, t('common.cancel')),
      h('button.primary', { onclick: apply }, t('sheet.apply')))];
}

function derivedBlock(st, def) {
  const { rules, calc } = st;
  const list = pick(rules.derived, def.items).filter(d => calc.visible(d));
  if (!list.length) return null;
  return [h('h3', def.title || t('sheet.values')), h('table.table', h('tbody', list.map(d => h('tr',
    h('td', { title: d.description || d.formula }, d.name),
    h('td.num', h('strong', fmt(calc.value(d.id))), d.unit ? ` ${d.unit}` : '')))))];
}

function resourcesBlock(st, def) {
  const { rules, sheet, calc } = st;
  const list = pick(rules.resources, def.items);
  if (!list.length) return null;
  if (list.length === 1) return resourceTile(st, list[0], def);
  return [h('h3', def.title || t('sheet.resources')), list.map(r => {
    const max = calc.value(r.id);
    const current = sheet.resources?.[r.id] ?? max;
    const set = v => { (sheet.resources ||= {})[r.id] = v; st.change(); };
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    if (r.display === 'toggles') {
      return h('div.resource', { title: r.recovery || '' },
        h('div.row', h('strong', r.name), resourceToggles(st, r, max, current)),
        r.recovery ? h('div.muted.small', r.recovery) : null);
    }
    return h('div.resource', { title: r.recovery || '' },
      h('div.row',
        h('strong', r.name),
        h('div.row',
          h('button.mini', { 'aria-label': `${r.name} −1`, onclick: () => set(current - 1) }, '−'),
          h('input', { type: 'number', value: current, inputmode: 'numeric', 'aria-label': t('sheet.current', { name: r.name }), onchange: e => set(Number(e.target.value) || 0) }),
          h('span.muted', `/ ${fmt(max)}`),
          h('button.mini', { 'aria-label': `${r.name} +1`, onclick: () => set(current + 1) }, '+'),
          h('button.mini', { title: t('sheet.restoreMax'), 'aria-label': t('sheet.restoreMax'), onclick: () => set(max) }, '↺'))),
      h('div.bar', h('div', { style: { width: `${pct}%` } })),
      r.recovery ? h('div.muted.small', r.recovery) : null);
  })];
}

/** One resource as a compact tile: big current / max, bar, − + and restore. */
function resourceTile(st, r, def) {
  const { sheet, calc } = st;
  const max = calc.value(r.id);
  const current = sheet.resources?.[r.id] ?? max;
  const set = v => { (sheet.resources ||= {})[r.id] = v; st.change(); };
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  if (r.display === 'toggles') {
    return [h('div.res-tile', { title: r.recovery || '' },
      h('div.res-name', h('strong', def.title || r.abbr || r.name), r.abbr && !def.title ? h('span.muted.small', r.name) : null),
      resourceToggles(st, r, max, current),
      h('div.res-buttons', h('span.muted.small', `${fmt(Math.min(current, max))} / ${fmt(max)}`),
        h('button.mini', { title: t('sheet.restoreMax'), 'aria-label': t('sheet.restoreMax'), onclick: () => set(max) }, '↺')))];
  }
  return [h('div.res-tile', { title: r.recovery || '' },
    h('div.res-name', h('strong', def.title || r.abbr || r.name), r.abbr && !def.title ? h('span.muted.small', r.name) : null),
    h('div.res-value',
      h('input', { type: 'number', value: current, inputmode: 'numeric', 'aria-label': t('sheet.current', { name: r.name }), onchange: e => set(Number(e.target.value) || 0) }),
      h('span.muted', `/ ${fmt(max)}`)),
    h('div.bar', { class: pct <= 25 ? 'low' : '' }, h('div', { style: { width: `${pct}%` } })),
    h('div.res-buttons',
      h('button.mini', { 'aria-label': `${r.name} −1`, onclick: () => set(current - 1) }, '−1'),
      h('button.mini', { 'aria-label': `${r.name} +1`, onclick: () => set(current + 1) }, '+1'),
      h('button.mini', { title: t('sheet.restoreMax'), 'aria-label': t('sheet.restoreMax'), onclick: () => set(max) }, '↺')))];
}

/** A resource with display "toggles": one checkbox per point (karma caps, spell slots...). */
function resourceToggles(st, r, max, current) {
  const set = v => { (st.sheet.resources ||= {})[r.id] = Math.max(0, Math.min(max, v)); st.change(); };
  const have = Math.max(0, Math.min(max, current));
  return h('div.toggles', Array.from({ length: Math.max(0, max) }, (_, i) => h('input', {
    type: 'checkbox', checked: i < have, 'aria-label': t('sheet.toggleOf', { name: r.name, n: i + 1 }),
    onchange: e => set(have + (e.target.checked ? 1 : -1)),
  })));
}

function countersBlock(st, def) {
  const { rules, sheet } = st;
  const all = pick(rules.counters, def.items);
  if (!all.length) return null;
  const level = c => Number(sheet.counters?.[c.id] || 0);
  const list = def.only_active ? all.filter(c => level(c) > 0) : all;
  const idle = def.only_active ? all.filter(c => level(c) === 0 && !st.calc.immune('counters', c.id)) : [];
  const adder = idle.length ? h('select.mini-select', { 'aria-label': t('sheet.addCounter'), onchange: e => {
    if (!e.target.value) return;
    (sheet.counters ||= {})[e.target.value] = 1; st.change();
  } }, h('option', { value: '' }, t('sheet.addCounter')), idle.map(c => h('option', { value: c.id }, c.name))) : null;
  return [h('h3', h('span', def.title || t('sheet.counters')), adder),
    def.only_active && !list.length ? h('p.muted.small', t('sheet.noneActive')) : null, list.map(c => {
    const n = Number(sheet.counters?.[c.id] || 0);
    const max = Number(c.max || 10);
    const set = v => { (sheet.counters ||= {})[c.id] = Math.max(0, Math.min(max, v)); st.change(); };
    return h('div.counter', { style: { marginBottom: '.6rem' } },
      h('div.row.spread', h('strong', { title: c.description || '' }, c.name), h('span.muted', `${n} / ${max}`)),
      h('div.pips', Array.from({ length: max }, (_, i) => h('button', {
        class: i < n ? 'full' : '', 'aria-label': t('sheet.counterLevel', { name: c.name, n: i + 1 }),
        onclick: () => set(n === i + 1 ? i : i + 1),
      }, String(i + 1)))),
      c.description && n > 0 ? h('details.muted.small.rule', h('summary', t('sheet.rule')), c.description) : null);
  })];
}

const LIST_TYPES = ['advantage', 'disadvantage', 'immunity', 'resistance', 'vulnerability', 'note'];

function effectsBlock(st, def) {
  const { calc, rules } = st;
  const parts = [];
  for (const type of LIST_TYPES) {
    const items = calc.lists[type];
    if (!items.length) continue;
    parts.push(h('h4', { style: { margin: '.6rem 0 .2rem' } }, t(`effectsList.${type}`)), h('ul.effects-list', items.map(({ ef, f }) =>
      h('li', ef.text || targetName(rules, ef.target) || type, ' ', h('span.source', `— ${f.ent.name || f.k}`)))));
  }
  if (calc.blocked.length) parts.push(h('p.muted.small', t('sheet.blocked', { list: calc.blocked.map(f => f.ent.name).join(', ') })));
  return [h('h3', def.title || t('sheet.activeEffects')), parts.length ? parts : h('p.muted.small', t('sheet.noEffects'))];
}

function targetName(rules, target) {
  for (const s of ['attributes', 'skills', 'derived', 'resources', 'counters']) if (rules[s][target]) return rules[s][target].name;
  return target;
}

export function describeEffect(rules, ef) {
  const target = targetName(rules, ef.target);
  const cond = ef.if ? ` (${t('effects.if', { cond: ef.if })})` : '';
  switch (ef.type) {
    case 'add': return `${/^-?\d+(\.\d+)?$/.test(String(ef.value)) ? signed(Number(ef.value)) : `+ (${ef.value})`} ${t('effects.on', { target })}${cond}`;
    case 'set': return `${target} = ${ef.value}${cond}`;
    case 'grant': { const [c, i] = String(ef.ref).split('/'); return t('effects.grants', { name: rules.entities[c]?.[i]?.name || ef.ref }); }
    case 'block': return ef.collection
      ? t('effects.blocksCollection', { name: rules.collections[ef.collection]?.name || ef.collection })
      : t('effects.blocksTag', { tag: ef.tag });
    default: return `${LIST_TYPES.includes(ef.type) ? t(`effects.${ef.type}`) : ef.type}: ${ef.text || target || ''}${cond}`;
  }
}

// ---------- Entity lists (items, traits, conditions...) ----------
function listBlock(st, def) {
  const { rules, sheet } = st;
  const colId = def.collection;
  const col = rules.collections[colId];
  if (!col && !rules.entities[colId]) return [h('h3', colId), h('p.muted', t('sheet.noCollection', { id: colId }))];
  const title = def.title || col?.name || colId;
  const items = (sheet.items || []).filter(i => i.collection === colId);
  const max = def.max ?? col?.max;
  const columns = def.columns || [];
  const fields = col?.fields || {};
  const usesQty = col?.quantity;
  const wearMax = col?.wear?.max;

  const rows = items.map(item => {
    const ent = rules.entities[colId]?.[item.ref];
    const name = item.name || ent?.name || item.ref;
    const removeItem = async () => {
      if (!col?.quick_remove && !(await confirm(t('sheet.removeTitle'), t('sheet.removeAsk', { name }), { yes: t('sheet.remove'), danger: true }))) return;
      sheet.items = sheet.items.filter(x => x !== item);
      st.change();
    };
    return h('tr', { class: ent ? '' : 'muted' },
      col?.equippable ? h('td', h('input', { type: 'checkbox', checked: !!item.equipped, 'aria-label': t('sheet.equipName', { name }), onchange: e => { item.equipped = e.target.checked; st.change(); } })) : null,
      h('td', h('button.mini.link', { onclick: () => entityDetails(st, colId, item.ref, item) }, name),
        ent ? null : h('span.badge.error', t('sheet.notFoundBadge'))),
      columns.map(c => h('td.small', fmtField(ent?.[c], fields[c]))),
      usesQty ? h('td.num', h('input', { type: 'number', value: item.qty ?? 1, min: 0, inputmode: 'numeric', 'aria-label': t('sheet.qtyOf', { name }),
        onchange: e => { item.qty = Math.max(0, Number(e.target.value) || 0); st.change(); } })) : null,
      wearMax ? h('td.num', h('div.row', { style: { flexWrap: 'nowrap', gap: '2px', justifyContent: 'flex-end' } },
        h('button.mini', { 'aria-label': t('sheet.lessWear'), onclick: () => { item.wear = Math.max(0, (item.wear || 0) - 1); st.change(); } }, '−'),
        h('span.wear-value', { title: t('sheet.wear') }, `${item.wear || 0}/${wearMax}`),
        h('button.mini', { 'aria-label': t('sheet.moreWear'), onclick: () => { item.wear = Math.min(wearMax, (item.wear || 0) + 1); st.change(); } }, '+'))) : null,
      h('td.num', h('button.mini.danger', { 'aria-label': t('sheet.removeName', { name }), onclick: removeItem }, '✕')));
  });

  // Entities granted by something else (a background's trait...): shown, removed with their source.
  const owned = new Set(items.map(i => i.ref));
  const granted = st.calc.active.filter(f => f.col === colId && !f.item && f.from && !owned.has(f.ent.id)).map(f => h('tr.granted',
    col?.equippable ? h('td') : null,
    h('td', h('button.mini.link', { onclick: () => entityDetails(st, colId, f.ent.id) }, f.ent.name)),
    columns.map(c => h('td.small', fmtField(f.ent[c], fields[c]))),
    usesQty ? h('td') : null,
    wearMax ? h('td') : null,
    h('td.num', h('span.badge', { title: t('sheet.grantedBy', { name: f.from }) }, f.from))));
  rows.push(...granted);

  const full = max !== undefined && items.length >= max;
  return [
    h('h3', h('span', title, max !== undefined ? h('span.muted.small', ` (${items.length}/${max})`) : null),
      h('button.mini', { disabled: full, onclick: () => search(st, colId) }, t('sheet.add'))),
    rows.length ? h('div.scroll-table', h('table.table',
      h('thead', h('tr',
        col?.equippable ? h('th', { title: t('sheet.equipped') }, t('sheet.equippedShort')) : null,
        h('th', t('sheet.name')),
        columns.map(c => h('th', fields[c]?.label || c)),
        usesQty ? h('th.num', t('sheet.qty')) : null,
        wearMax ? h('th.num', t('sheet.wear')) : null,
        h('th'))),
      h('tbody', rows))) : h('p.muted.small', t('sheet.nothingYet')),
  ];
}

function fmtField(v, field) {
  if (v === undefined || v === null || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');
  const u = field?.unit ? ` ${field.unit}` : '';
  return typeof v === 'number' ? `${fmt(v)}${u}` : `${v}${u}`;
}

function search(st, colId) {
  const { rules, sheet } = st;
  const col = rules.collections[colId] || {};
  // What the character is immune to (e.g. a robot and "Bleeding") is not offered.
  const all = Object.values(rules.entities[colId] || {}).filter(e => !st.calc.immune(colId, e.id)).sort((a, b) => byName(a.name, b.name));
  const input = h('input', { type: 'search', placeholder: t('sheet.searchIn', { name: col.name || colId }), 'aria-label': t('sheet.search') });
  const list = h('div.search-list');
  let dlg;
  const add = ent => {
    const existing = col.quantity && (sheet.items || []).find(i => i.collection === colId && i.ref === ent.id);
    if (existing) existing.qty = (existing.qty ?? 1) + 1;
    else (sheet.items ||= []).push({ uid: uid(), collection: colId, ref: ent.id, ...(col.quantity ? { qty: 1 } : {}), ...(col.equippable ? { equipped: false } : {}) });
    toast(t('sheet.added', { name: ent.name }));
    if (col.max !== undefined && sheet.items.filter(i => i.collection === colId).length >= col.max) dlg.close();
    st.change();
  };
  const draw = () => {
    const q = normalize(input.value);
    const found = all.filter(e => !q || normalize(`${e.name} ${e.description || ''} ${(e.tags || []).join(' ')}`).includes(q)).slice(0, 200);
    list.replaceChildren(...(found.length ? found.map(e => h('div.search-item',
      h('div', h('div', h('strong', e.name)), e.description ? h('div.desc', String(e.description).slice(0, 140) + (String(e.description).length > 140 ? '…' : '')) : null),
      h('div.row', { style: { flexWrap: 'nowrap' } },
        h('button.mini', { onclick: () => entityDetails(st, colId, e.id) }, t('sheet.view')),
        h('button.mini.primary', { onclick: () => add(e) }, t('sheet.addShort'))))) : [h('p.muted', t('sheet.nothingFound'))]));
  };
  input.addEventListener('input', draw);
  draw();
  dlg = dialog(t('sheet.addTo', { name: col.name || colId }), [input, list], { width: '640px' });
  input.focus();
}

export function entityDetails(st, colId, id, item) {
  const { rules } = st;
  const ent = rules.entities[colId]?.[id];
  if (!ent) { dialog(t('sheet.notFoundTitle'), h('p', t('sheet.notFoundText', { name: item?.name || id }))); return; }
  const fields = rules.collections[colId]?.fields || {};
  const rows = Object.entries(fields).filter(([k]) => ent[k] !== undefined && ent[k] !== '').map(([k, c]) => h('tr', h('td.muted', c.label || k), h('td', fmtField(ent[k], c))));
  const origin = rules.origin[`${colId}/${id}`];
  const content = [
    ent.description ? h('p', { style: { whiteSpace: 'pre-line' } }, ent.description) : null,
    rows.length ? h('table.table', h('tbody', rows)) : null,
    ent.effects?.length ? [h('h4', { style: { margin: '.8rem 0 .3rem' } }, t('sheet.effects')), h('ul.effects-list', ent.effects.map(ef => h('li', describeEffect(rules, ef))))] : null,
    ent.tags?.length ? h('p.small', ent.tags.map(x => h('span.badge', { style: { marginRight: '4px' } }, x))) : null,
    origin ? h('p.muted.small', t('sheet.origin', { name: st.inst[origin]?.name || origin })) : null,
  ];
  const actions = [];
  if (item) {
    actions.push({ text: t('sheet.rename'), action: async () => {
      const fresh = await ask(t('sheet.rename'), t('sheet.renameLabel'), item.name || '');
      if (fresh === null) return false;
      item.name = fresh || undefined;
      st.change();
    } });
  }
  actions.push({ text: t('common.close'), primary: true });
  dialog(item?.name || ent.name, content, { actions });
}

function notesBlock(st, def) {
  const { sheet } = st;
  const id = def.id || 'notes';
  return [h('h3', def.title || t('sheet.notes')), h('textarea', { 'aria-label': def.title || t('sheet.notes'), value: sheet.notes?.[id] || '',
    oninput: e => { (sheet.notes ||= {})[id] = e.target.value; st.save(); } })];
}

function rollerBlock(st, def) {
  const fallback = st.rules.rolls?.default || '1d20';
  const input = h('input', { type: 'text', value: fallback, 'aria-label': t('sheet.rollExpr'), placeholder: t('sheet.rollPlaceholder') });
  const result = h('div.roll-result', { 'aria-live': 'polite' }, '—');
  const hist = h('ul.history');
  const drawHist = () => hist.replaceChildren(...rollHistory.slice(0, 10).map(r => h('li', h('strong', fmt(r.total)), ` ← ${r.expr}`, h('span.muted.small', ` ${r.details.join(' ')}`))));
  const doRoll = expr => {
    try {
      const r = roll(expr, st.calc);
      result.textContent = fmt(r.total);
      rollHistory.unshift({ expr, ...r });
      drawHist();
    } catch (e) { result.textContent = '—'; toast(e.message, 'error'); }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doRoll(input.value); });
  drawHist();
  return [
    h('h3', def.title || t('sheet.rollDice')),
    h('div.row', { style: { flexWrap: 'nowrap' } }, input, h('button.primary', { onclick: () => doRoll(input.value) }, t('sheet.roll'))),
    def.shortcuts?.length ? h('div.row', { style: { marginTop: '.5rem' } }, def.shortcuts.map(a => h('button.mini', { onclick: () => { input.value = a; doRoll(a); } }, a))) : null,
    result, hist,
  ];
}

// ---------- This sheet's packages ----------
async function packagesDialog(st) {
  const { sheet, inst } = st;
  const order = await pk.order();
  const exts = order.filter(id => inst[id]?.system === sheet.system);
  const checked = new Set(sheet.extensions || []);
  const warnEl = h('div');
  const check = () => {
    const w = checkSet(sheet.system, exts.filter(id => checked.has(id)), inst);
    warnEl.replaceChildren(...(w.length ? [h('div.alert', h('ul', w.map(a => h('li', `${inst[a.package]?.name || a.package}: ${a.msg}`))))] : []));
  };
  const entries = st.log.filter(l => l.level === 'conflict' || l.level === 'warning');
  dialog(t('sheet.packagesTitle'), [
    h('p', h('strong', `${t('type.system')}: `), `${st.system.name} (v${st.system.version || '0'})`),
    exts.length ? h('div', exts.map(id => h('label.check',
      h('input', { type: 'checkbox', checked: checked.has(id), onchange: e => { e.target.checked ? checked.add(id) : checked.delete(id); check(); } }),
      h('span', inst[id].name, h('span.muted.small', ` v${inst[id].version || '0'}`))))) : h('p.muted', t('new.noExtensions')),
    h('p.muted.small', t('sheet.orderFromPackages')),
    warnEl,
    entries.length ? h('details', h('summary', t('sheet.buildLog', { n: entries.length })), h('ul.small', entries.map(c => h('li', c.msg)))) : null,
  ], {
    actions: [
      { text: t('common.cancel') },
      { text: t('common.save'), primary: true, action: async () => {
        sheet.extensions = exts.filter(id => checked.has(id));
        sheet.versions = Object.fromEntries([sheet.system, ...sheet.extensions].map(id => [id, inst[id]?.version || '0']));
        sheet.updated = new Date().toISOString();
        await db.put('sheets', sheet);
        const app = document.getElementById('app');
        app.replaceChildren();
        await sheetScreen(app, sheet.id);
      } },
    ],
  });
  check();
}
