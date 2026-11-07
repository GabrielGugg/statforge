// ============================================================
// Sheet: drawn from the system package's layout.
// ============================================================
import * as db from '../storage.js';
import * as pk from '../packages.js';
import { checkSet } from '../engine/package.js';
import { compute, roll, isBroken, effectiveWear } from '../engine/calc.js';
import { t } from '../i18n.js';
import { creationWizard } from './creation.js';
import { shareDialog } from './share.js';
import { shareOf, stop as stopShare } from '../share.js';
import { h, toast, dialog, confirm, ask, downloadJSON, uid, fmt, signed, byName, normalize } from './util.js';

const rollHistory = [];

/**
 * opts.readOnly = { sheet, owner, back }: a sheet shared with the GM. Shown with the GM's own packages,
 * every control disabled, nothing ever saved or sent anywhere.
 */
export async function sheetScreen(app, id, opts = {}) {
  const ro = opts.readOnly || null;
  const sheet = ro ? structuredClone(ro.sheet) : await db.get('sheets', id);
  if (!sheet) { app.append(h('div.card.empty', h('p', t('sheet.notFound')), h('a.button', { href: '#/' }, t('common.back')))); return; }

  let built;
  try { built = await pk.rulesForSheet(sheet); } catch (e) {
    app.append(h('div.alert.error', e.message), h('a.button', { href: '#/packages' }, t('new.goPackages')));
    return;
  }
  const inst = await pk.installed();
  const state = { app, sheet, ...built, inst, tab: sessionStorage.getItem(`tab:${id}`) || null, editing: false };
  // The player's own arrangement of the blocks, shared by every sheet of the same system.
  const layoutKey = `layout:${sheet.system}`;
  state.custom = (await db.getConfig(layoutKey, {})) || {};
  state.unit = await db.getConfig('unit', 'm');
  state.debug = !!(await db.getConfig('debug', false));
  state.invMode = await db.getConfig('inventoryView', 'cards');
  state.shared = ro ? null : await shareOf(id);
  state.readOnly = ro;
  state.saveCustom = () => db.setConfig(layoutKey, state.custom).catch(e => toast(e.message, 'error'));

  let timer;
  const save = () => {
    clearTimeout(timer);
    if (ro) return; // the GM's view never saves
    timer = setTimeout(() => { sheet.updated = new Date().toISOString(); db.put('sheets', sheet).catch(e => toast(e.message, 'error')); }, 300);
  };
  // Change that affects calculations: save and redraw, keeping the scroll position.
  const change = () => { save(); const y = window.scrollY; draw(); window.scrollTo(0, y); };
  state.save = save;
  state.change = change;
  state.redraw = () => { const y = window.scrollY; draw(); window.scrollTo(0, y); };

  function draw() {
    state.calc = compute(state.rules, sheet);
    app.replaceChildren(ro ? readOnlyHeader(state) : header(state), alerts(state), body(state));
    if (ro) lockDown(app); else autoConditions(state);
  }
  draw();
  if (ro) watchDialogs();
}

// ---------- GM's read-only view ----------
function readOnlyHeader(st) {
  const { sheet, readOnly } = st;
  return h('div',
    h('div.alert', h('strong', t('gm.readOnly')), ' ', t('gm.readOnlyOf', { owner: readOnly.owner || '—' })),
    h('div.sheet-header',
      h('div.field.field-name', h('span', st.system.name), h('strong.ro-name', sheet.name || t('common.unnamed'))),
      h('div.field', h('span', t('sheet.level')), h('strong', fmt(sheet.level || 1))),
      h('div.field', h('span', 'XP'), h('strong', fmt(sheet.xp || 0)))),
    readOnly.back ? h('p', h('a.button.mini', { href: readOnly.back }, `← ${t('gm.backToTable')}`)) : null);
}

/** Disables every control except the tabs (navigation only). */
function lockDown(root) {
  root.querySelectorAll('input, select, textarea').forEach(el => { el.disabled = true; });
  root.querySelectorAll('button').forEach(el => { if (!el.closest('.tabs') && !el.classList.contains('debug-btn')) el.disabled = true; });
}
// Dialogs (item details) open outside the sheet: their controls are disabled too, while this view is open.
let dialogWatch = null;
function watchDialogs() {
  dialogWatch?.disconnect();
  // the body's controls and any action that would change something (primary/danger); Close and Cancel stay usable
  dialogWatch = new MutationObserver(() => {
    document.querySelectorAll('.dialog-body').forEach(b => lockDown(b));
    document.querySelectorAll('.dialog-actions button.primary, .dialog-actions button.danger').forEach(b => { b.disabled = true; });
  });
  dialogWatch.observe(document.body, { childList: true });
  window.addEventListener('hashchange', () => { dialogWatch?.disconnect(); dialogWatch = null; }, { once: true });
}

// ---------- Automatic conditions: a quiet prompt when a rule says one starts or ends ----------
let promptBox = null;
window.addEventListener('hashchange', () => { promptBox?.remove(); promptBox = null; });

function autoConditions(st) {
  const { rules, sheet, calc } = st;
  st.autoDismissed ||= {};
  for (const rule of rules.auto_conditions || []) {
    const [col, ref] = String(rule.ref).split('/');
    const ent = rules.entities[col]?.[ref];
    if (!ent) continue;
    const want = !!calc.formula(rule.when) && !calc.immune(col, ref);
    const have = (sheet.items || []).some(i => i.collection === col && i.ref === ref);
    const key = `${rule.ref}:${want}`;
    if (want === have) { delete st.autoDismissed[`${rule.ref}:true`]; delete st.autoDismissed[`${rule.ref}:false`]; continue; }
    if (st.autoDismissed[key] || promptBox?.querySelector(`[data-key="${CSS.escape(key)}"]`)) continue;
    showPrompt(st, key, want ? t('auto.gain', { name: ent.name }) : t('auto.lose', { name: ent.name }), want ? rule.text : null, want ? t('auto.apply') : t('auto.remove'), () => {
      if (want) (sheet.items ||= []).push({ uid: uid(), collection: col, ref, ...(rules.collections[col]?.equippable ? { equipped: true } : {}) });
      else sheet.items = sheet.items.filter(i => !(i.collection === col && i.ref === ref));
      st.change();
    });
  }
}

function showPrompt(st, key, title, text, action, onApply) {
  if (!promptBox?.isConnected) { promptBox = h('div.auto-prompts', { role: 'status', 'aria-live': 'polite' }); document.body.append(promptBox); }
  let timer;
  const close = () => { clearTimeout(timer); st.autoDismissed[key] = true; el.classList.add('leaving'); setTimeout(() => el.remove(), 250); };
  const el = h('div.auto-prompt', { 'data-key': key },
    h('div.auto-text', h('strong', title), text ? h('span.small.muted', text) : null),
    h('div.row.auto-buttons',
      h('button.mini.primary', { onclick: () => { close(); onApply(); } }, action),
      h('button.mini', { onclick: close }, t('auto.dismiss'))),
    h('div.auto-timer'));
  // Gone by itself after 10 seconds, unless the pointer is over it.
  const start = () => { timer = setTimeout(close, 10000); el.style.setProperty('--run', 'running'); };
  el.addEventListener('pointerenter', () => { clearTimeout(timer); el.style.setProperty('--run', 'paused'); });
  el.addEventListener('pointerleave', start);
  promptBox.append(el);
  start();
}

// ---------- Level up: the package's steps, or just +1 level ----------
async function levelUp(st) {
  const { sheet, rules, app } = st;
  const next = (sheet.level || 1) + 1;
  const steps = rules.progression?.level_up?.steps;
  const finish = s => {
    const oldCalc = compute(rules, sheet), newCalc = compute(rules, s);
    // Resources the player already spent keep the same gap to the new maximum.
    for (const id of Object.keys(rules.resources)) {
      const gain = newCalc.value(id) - oldCalc.value(id);
      if (gain > 0 && s.resources?.[id] !== undefined) s.resources[id] = Number(s.resources[id]) + gain;
    }
    for (const k of Object.keys(sheet)) delete sheet[k];
    Object.assign(sheet, s);
    toast(t('level.done', { n: next }));
    st.change();
    window.scrollTo(0, 0);
  };
  if (!steps?.length) {
    if (await confirm(t('level.up'), t('level.simple', { n: next }))) finish({ ...structuredClone(sheet), level: next });
    return;
  }
  const base = { ...structuredClone(sheet), level: next };
  promptBox?.remove(); promptBox = null;
  app.replaceChildren();
  creationWizard(app, { rules, inst: st.inst, base, steps, summaryIds: rules.progression.level_up.summary, levelUp: sheet,
    onDone: finish, onSkip: () => { st.redraw(); window.scrollTo(0, 0); } });
}

// ---------- Header ----------
function header(st) {
  const { sheet, rules, calc } = st;
  const name = h('input.name', { type: 'text', value: sheet.name || '', placeholder: t('common.unnamed'), 'aria-label': t('new.name'),
    oninput: e => { sheet.name = e.target.value; st.save(); } });
  const numField = (label, field) => h('label.field', h('span', label),
    h('input.num', { type: 'number', value: sheet[field] ?? 0, inputmode: 'numeric',
      onchange: e => { sheet[field] = Number(e.target.value) || 0; st.change(); } }));
  let next = null, ready = false;
  if (rules.progression?.xp_per_level) {
    const target = calc.formula(rules.progression.xp_per_level);
    ready = target > 0 && sheet.xp >= target;
    if (target > 0) next = h('div.muted.small', `${t('sheet.nextLevel', { xp: fmt(target) })}${ready ? ` — ${t('sheet.canLevel')}` : ''}`);
  }
  const atMax = rules.progression?.max_level && (sheet.level || 1) >= rules.progression.max_level;
  const levelBtn = atMax ? null : h(`button.mini${ready ? '.primary' : ''}`, { onclick: () => levelUp(st) }, t('level.up'));
  return h('div',
    h('div.sheet-header',
      h('label.field.field-name', h('span', st.system.name), name),
      numField(t('sheet.level'), 'level'),
      numField('XP', 'xp')),
    h('div.row.spread', { style: { marginBottom: '1rem' } },
      next || h('span'),
      h('div.row',
        levelBtn,
        h(`button.mini${st.editing ? '.primary' : ''}`, { 'aria-pressed': String(st.editing), onclick: () => { st.editing = !st.editing; st.redraw(); } },
          st.editing ? t('sheet.doneArranging') : t('sheet.arrange')),
        h('button.mini', { onclick: () => packagesDialog(st) }, t('sheet.packages', { n: st.active.length + 1 })),
        h(`button.mini${st.shared ? '.share-on' : ''}`, { onclick: () => shareDialog(sheet.id), title: st.shared ? t('share.sharedWithShort', { email: st.shared.email }) : '' }, st.shared ? t('share.sharedBadge') : t('share.button')),
        h('button.mini', { onclick: () => exportPdf(st) }, t('sheet.exportPdf')),
        h('button.mini', { onclick: () => downloadJSON(sheet, `${normalize(sheet.name).replace(/[^a-z0-9]+/g, '-') || 'sheet'}.json`) }, t('sheet.export')),
        h('button.mini.danger', { onclick: async () => {
          if (await confirm(t('sheet.deleteTitle'), t('sheet.deleteAsk', { name: sheet.name || t('common.unnamed') }), { yes: t('sheet.delete'), danger: true })) {
            // A shared sheet stops being shared first, so no copy is left readable in Drive.
            if (st.shared) { try { await stopShare(sheet.id); } catch (e) { toast(t('share.err.deleteFirst', { error: e.message }), 'error'); return; } }
            await db.remove('sheets', sheet.id);
            location.hash = '#/';
          }
        } }, t('sheet.delete')))));
}

/**
 * PDF: every tab of the sheet, one after the other, sent to the browser's print window
 * (where "Save as PDF" makes the file). Nothing leaves the device.
 */
function exportPdf(st) {
  const { sheet, rules } = st;
  const tabs = (rules.layout?.tabs?.length ? rules.layout : autoLayout(rules)).tabs;
  const editing = st.editing;
  st.editing = false;
  const wrap = h('div.print-sheet',
    h('div.print-head', h('h1', sheet.name || t('common.unnamed')), h('span', st.system.name),
      h('span', `${t('sheet.level')} ${fmt(sheet.level || 1)}`), h('span', `XP ${fmt(sheet.xp || 0)}`)),
    tabs.map(tab => h('section.print-tab', h('h2.print-tab-title', tab.name), dashboard(st, tab))));
  st.editing = editing;
  // fields show their text in print
  wrap.querySelectorAll('textarea').forEach(el => { el.rows = Math.max(2, String(el.value).split('\n').length + 1); });
  document.body.append(wrap);
  document.documentElement.classList.add('printing');
  const done = () => { wrap.remove(); document.documentElement.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  toast(t('sheet.pdfHint'));
  setTimeout(() => window.print(), 100);
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

const BLOCKS = { money: moneyBlock, notebook: notebookBlock, inventory: inventoryBlock, attributes: attributesBlock, skills: skillsBlock, derived: derivedBlock, resources: resourcesBlock, counters: countersBlock, effects: effectsBlock, list: listBlock, notes: notesBlock, roller: rollerBlock };

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
    return h('div.attribute', { title: tip(st, a.id, a.description) },
      h('div.label', a.abbr || a.id, debugButton(st, a.id)),
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
  const attr = p => (p.attribute ? h('span.muted.small', ` (${[].concat(p.attribute).map(a => rules.attributes[a]?.abbr || a).join('/')})`) : null);
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
        h('td.num', { title: tip(st, p.id) }, debugButton(st, p.id), h('strong', signed(calc.value(p.id)))))))))];
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
  const bonusInput = d => h('input.bonus-input', { type: 'number', inputmode: 'numeric', value: st.sheet.bonus?.[d.id] || '', placeholder: '+0',
    title: t('sheet.extraBonus'), 'aria-label': t('sheet.extraBonusOf', { name: d.name }),
    onchange: e => { const n = Number(e.target.value) || 0; st.sheet.bonus ||= {}; if (n) st.sheet.bonus[d.id] = n; else delete st.sheet.bonus[d.id]; st.change(); } });
  return [h('h3', def.title || t('sheet.values')), h('table.table', h('tbody', list.map(d => h('tr',
    h('td', { title: tip(st, d.id, d.description || (st.debug ? '' : d.formula)) }, d.name, d.editable_bonus ? h('span.muted.small', ` (${t('sheet.extraBonus')})`) : null),
    h('td.num', debugButton(st, d.id), d.editable_bonus ? h('span.bonus-cell', bonusInput(d), h('strong', fmt(calc.value(d.id)))) : h('strong', fmt(calc.value(d.id))), d.unit ? ` ${d.unit}` : '')))))];
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
    if (r.display === 'card') return h('div.resource', { title: tip(st, r.id, r.recovery) }, h('div.row.spread', h('strong', r.name, debugButton(st, r.id)), h('strong', fmt(max))));
    if (r.display === 'toggles') {
      return h('div.resource', { title: tip(st, r.id, r.recovery) },
        h('div.row', h('strong', r.name, debugButton(st, r.id)), resourceToggles(st, r, max, current)),
        r.recovery ? h('div.muted.small', r.recovery) : null);
    }
    return h('div.resource', { title: tip(st, r.id, r.recovery) },
      h('div.row',
        h('strong', r.name, debugButton(st, r.id)),
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
  // "card": only the total, for points spent and refilled every turn (counted in your head).
  if (r.display === 'card') {
    return [h('div.res-tile', { title: tip(st, r.id, r.recovery) },
      h('div.res-name', h('strong', def.title || r.abbr || r.name, debugButton(st, r.id)), r.abbr && !def.title ? h('span.muted.small', r.name) : null),
      h('div.res-value.res-total', h('strong', fmt(max))),
      r.recovery ? h('div.muted.small', r.recovery) : null)];
  }
  if (r.display === 'toggles') {
    return [h('div.res-tile', { title: tip(st, r.id, r.recovery) },
      h('div.res-name', h('strong', def.title || r.abbr || r.name, debugButton(st, r.id)), r.abbr && !def.title ? h('span.muted.small', r.name) : null),
      resourceToggles(st, r, max, current),
      h('div.res-buttons', h('span.muted.small', `${fmt(Math.min(current, max))} / ${fmt(max)}`),
        h('button.mini', { title: t('sheet.restoreMax'), 'aria-label': t('sheet.restoreMax'), onclick: () => set(max) }, '↺')))];
  }
  return [h('div.res-tile', { title: tip(st, r.id, r.recovery) },
    h('div.res-name', h('strong', def.title || r.abbr || r.name, debugButton(st, r.id)), r.abbr && !def.title ? h('span.muted.small', r.name) : null),
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

/** What an active item does, in short: "+50 em Capacidade de Carga · Imunidade: Lento". Notes stay in Active effects. */
function itemEffects(st, item) {
  const { calc, rules } = st;
  const f = calc.active.find(x => x.item === item);
  if (!f) return null;
  const texts = [];
  for (const ef of f.effects) {
    if (ef.type === 'note' || ef.type === 'block') continue;
    if (ef.if && !calc.formula(ef.if, f.vars)) continue;
    const target = targetName(rules, ef.target);
    if (ef.type === 'add' || ef.type === 'set' || ef.type === 'limit') {
      const v = Number(calc.formula(ef.value, f.vars)) || 0;
      if (ef.type === 'add' && !v) continue;
      texts.push(ef.type === 'add' ? `${signed(v)} ${t('effects.on', { target })}` : ef.type === 'limit' ? t('effects.limit', { target, v: fmt(v) }) : `${target} = ${fmt(v)}`);
    } else if (ef.type === 'grant') texts.push(describeEffect(rules, ef));
    else texts.push(`${t(`effects.${ef.type}`)}: ${ef.text || [].concat(ef.ref ?? ef.tag ?? []).map(r => refName(rules, r)).join(', ') || target || ''}`);
  }
  return texts.length ? h('div.small.item-effects', texts.join(' · ')) : null;
}

function refName(rules, ref) {
  const [c, i] = String(ref).split('/');
  return (i ? rules.entities[c]?.[i]?.name : rules.counters[c]?.name) || ref;
}

// ---------- Debug mode: how each computed value was reached ----------
function debugText(st, id) {
  const x = st.debug && st.calc.explain(id);
  if (!x) return '';
  const def = ['attributes', 'skills', 'derived', 'resources'].map(s => st.rules[s][id]).find(Boolean);
  const lines = [`ƒ ${def?.name || id} = ${fmt(x.total)}`];
  if (x.formula === null) lines.push(t('debug.sheetValue', { n: fmt(x.base) }));
  else if (/^-?\d+(\.\d+)?$/.test(x.formula.trim())) lines.push(x.formula);
  else lines.push(x.formula, x.filled !== x.formula ? `= ${x.filled} = ${fmt(x.base)}` : `= ${fmt(x.base)}`);
  for (const p of x.parts) {
    const num = /^-?\d+(\.\d+)?$/.test(p.formula);
    lines.push(`${p.type === 'set' ? '= ' : p.type === 'limit' ? '≤ ' : signed(p.value)}${p.type === 'set' || p.type === 'limit' ? fmt(p.value) : ''} ${p.source}`
      + (num ? '' : `  (${p.formula}${p.filled !== p.formula ? ` → ${p.filled}` : ''})`)
      + (p.if ? `  [${t('effects.if', { cond: p.if })}]` : '')
      + (p.on ? '' : `  — ${t('debug.off')}`));
  }
  if (x.bonus) lines.push(`${signed(x.bonus)} ${t('sheet.extraBonus')}`);
  return lines.join('\n');
}

/** A field's tooltip; in debug mode the calculation goes last. */
function tip(st, id, base) {
  return [base, debugText(st, id)].filter(Boolean).join('\n\n');
}

/** Tooltips do not show on touch screens: in debug mode a small "ƒ" opens the same text. */
function debugButton(st, id) {
  if (!st.debug) return null;
  return h('button.mini.debug-btn', { type: 'button', title: t('debug.show'), 'aria-label': t('debug.show'),
    onclick: ev => { ev.stopPropagation(); dialog(t('debug.title'), h('pre.debug-pre', debugText(st, id))); } }, 'ƒ');
}

function targetName(rules, target) {
  for (const s of ['attributes', 'skills', 'derived', 'resources', 'counters']) if (rules[s][target]) return rules[s][target].name;
  return target;
}

// Name of whatever has('ref') points at: "collection/id", "collection_id" or a bare entity id.
function refLabel(rules, ref) {
  const [c, i] = String(ref).split('/');
  if (i) return rules.entities[c]?.[i]?.name || ref;
  for (const [col, ents] of Object.entries(rules.entities)) {
    if (ents[ref]) return ents[ref].name;
    if (ref.startsWith(`${col}_`) && ents[ref.slice(col.length + 1)]) return ents[ref.slice(col.length + 1)].name;
  }
  return ref;
}

/** The parts of a formula joined by a top-level "and" (parentheses kept together). */
function andParts(formula) {
  const s = String(formula).trim(), parts = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"') quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (!depth && /^\sand\s/.test(s.slice(i, i + 5))) { parts.push(s.slice(start, i)); start = i + 4; }
  }
  parts.push(s.slice(start));
  // "(a or b)" loses its outer parentheses when they wrap the whole part
  return parts.map(p => p.trim()).filter(Boolean).map(p => {
    if (!p.startsWith('(') || !p.endsWith(')')) return p;
    let d = 0;
    for (let i = 0; i < p.length - 1; i++) { if (p[i] === '(') d++; else if (p[i] === ')') d--; if (!d) return p; }
    return p.slice(1, -1).trim();
  });
}

/** A requirement formula in words: has('x') becomes its name, FOR the attribute's name, >= becomes ≥… */
function formulaWords(rules, f) {
  let s = String(f).replace(/has\(\s*'([^']+)'\s*\)/g, (_, r) => `⟦${refLabel(rules, r)}⟧`);
  s = s.replace(/qty\(\s*'([^']+)'\s*\)/g, (_, r) => `⟦${refLabel(rules, r)}⟧`);
  const names = {};
  for (const sec of ['attributes', 'skills', 'derived', 'resources']) for (const [id, d] of Object.entries(rules[sec] || {})) names[id] ||= d.name;
  s = s.replace(/'[^']*'|⟦[^⟧]*⟧|[\p{L}_][\p{L}\p{N}_]*/gu, w => {
    if (w.startsWith('⟦') || w.startsWith("'")) return w;
    if (w === 'and') return t('req.and');
    if (w === 'or') return t('req.or');
    if (w === 'not') return t('req.not');
    if (w === 'level') return t('req.level');
    return names[w] || w;
  });
  return s.replace(/>=/g, '≥').replace(/<=/g, '≤').replace(/!=/g, '≠').replace(/==/g, '=').replace(/[⟦⟧]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Why an entity cannot be taken, in words, or '' when it can: the parts of "requires" that fail
 * (the pack's requires_text when the requirement is a single part). Entities without "requires" pass.
 */
export function unmetRequirement(rules, calc, ent) {
  if (!ent?.requires) return '';
  const parts = andParts(ent.requires);
  const failed = parts.filter(p => !calc.formula(p));
  if (!failed.length) return calc.formula(ent.requires) ? '' : (ent.requires_text || formulaWords(rules, ent.requires));
  if (ent.requires_text && parts.length === 1) return ent.requires_text;
  return failed.map(p => formulaWords(rules, p)).join('; ');
}

/** A condition ("if") in words: the pack's if_text when given, otherwise has('x') turned into names. */
export function describeCond(rules, ef) {
  if (ef.if_text) return ef.if_text;
  const cond = String(ef.if).trim();
  const HAS = String.raw`has\(\s*'([^']+)'\s*\)`;
  const names = () => [...cond.matchAll(new RegExp(HAS, 'g'))].map(m => refLabel(rules, m[1]));
  const list = arr => [...new Set(arr)].join(` ${t('effects.or')} `);
  if (new RegExp(`^not\\s+${HAS}(\\s+and\\s+not\\s+${HAS})*$`).test(cond)) return t('effects.unless', { names: list(names()) });
  if (new RegExp(`^${HAS}(\\s+or\\s+${HAS})*$`).test(cond)) return t('effects.with', { names: list(names()) });
  return t('effects.if', { cond: cond.replace(new RegExp(HAS, 'g'), (_, r) => refLabel(rules, r)) });
}

const isNum = v => /^-?\d+(\.\d+)?$/.test(String(v).trim());

/** An effect's value in words: the pack's value_text, the number, or "calculated" (formulas are for the debug mode). */
function valueWords(ef) {
  if (ef.value_text) return ef.value_text;
  if (isNum(ef.value)) return ef.type === 'add' ? signed(Number(ef.value)) : fmt(Number(ef.value));
  return ef.type === 'add' ? t('effects.calculatedBonus') : t('effects.calculatedValue');
}

export function describeEffect(rules, ef) {
  const target = targetName(rules, ef.target);
  const cond = ef.if ? ` (${describeCond(rules, ef)})` : '';
  switch (ef.type) {
    case 'add': return `${valueWords(ef)} ${t('effects.on', { target })}${cond}`;
    case 'set': return `${target} = ${valueWords(ef)}${cond}`;
    case 'limit': return `${t('effects.limit', { target, v: valueWords(ef) })}${cond}`;
    case 'grant': { const [c, i] = String(ef.ref).split('/'); return t('effects.grants', { name: rules.entities[c]?.[i]?.name || ef.ref }); }
    case 'block': return ef.collection
      ? t('effects.blocksCollection', { name: rules.collections[ef.collection]?.name || ef.collection })
      : t('effects.blocksTag', { tag: ef.tag });
    default: return `${LIST_TYPES.includes(ef.type) ? t(`effects.${ef.type}`) : ef.type}: ${ef.text || target || ''}${cond}`;
  }
}

/**
 * Short list of what an entity does, for choice cards: identical bonuses on many skills become one line
 * ("+2 on all Skills"), notes are flagged so they can stand out.
 */
export function summarizeEffects(rules, effects) {
  const lines = [], groups = new Map();
  for (const ef of effects) {
    if (ef.type === 'add' && !ef.if && rules.skills[ef.target]) {
      const k = ef.value_text || String(ef.value);
      if (!groups.has(k)) { groups.set(k, []); lines.push({ group: k }); }
      groups.get(k).push(ef);
    } else lines.push({ text: describeEffect(rules, ef), note: ef.type === 'note' });
  }
  const totalSkills = Object.keys(rules.skills).length;
  const out = lines.flatMap(l => {
    if (!l.group) return [l];
    const g = groups.get(l.group);
    if (g.length < 3) return g.map(ef => ({ text: describeEffect(rules, ef) }));
    const v = valueWords(g[0]);
    return [{ text: g.length === totalSkills ? t('effects.allSkills', { v }) : t('effects.nSkills', { v, n: g.length }) }];
  });
  // notes first: they usually carry the catch
  return [...out.filter(l => l.note), ...out.filter(l => !l.note)];
}

// ---------- Distances: a "range" field shown in the player's unit ----------
const TO_FT = { ft: 1, m: 1 / 0.3, sq: 5 };
/** "x10/x20" (times an attribute, in the field's unit) or "30/60", in meters, feet or squares. */
function fmtRange(v, field, st) {
  const unit = st?.unit || 'm';
  const from = field.unit || 'ft';
  const conv = (n, src = from) => {
    const ft = n * TO_FT[src];
    return fmt(unit === 'sq' ? Math.floor(ft / 5) : unit === 'm' ? Math.round(ft * 0.3 * 10) / 10 : Math.round(ft));
  };
  const parts = String(v).split('/').map(x => x.trim());
  let numeric = true;
  const out = parts.map(p => {
    const m = p.match(/^x\s*(\d+(?:[.,]\d+)?)$/i);
    let n = m ? Number(m[1].replace(',', '.')) : Number(p.replace(',', '.'));
    if (m) {
      if (!field.per || !st?.calc) { numeric = false; return p; }
      n *= st.calc.value(field.per);
    }
    if (Number.isFinite(n)) return conv(n);
    numeric = false;
    // Text such as "20 ft. cone" or "Cone de 6 m": convert each distance inside it, keep the words.
    return p.replace(/(\d+(?:[.,]\d+)?)\s*(ft\.?|feet|foot|m)(?![a-zà-ú])/gi, (_, num, u) =>
      `${conv(Number(num.replace(',', '.')), /^m$/i.test(u) ? 'm' : 'ft')} ${t(`unit.${unit}`)}`);
  });
  return numeric ? `${out.join(' / ')} ${t(`unit.${unit}`)}` : out.join(' / ');
}

// ---------- Magazines: rounds loaded, reload from the inventory ----------
const refKey = i => `${i.collection}/${i.ref}`;

/** Capacity of a weapon's magazine, with the bonus of the mods installed in it. */
function magazineCapacity(st, item, ent) {
  const mods = (item.mods || []).map(u => st.sheet.items.find(x => x.uid === u)).filter(Boolean);
  const bonus = mods.reduce((n, m) => n + (Number(st.rules.entities[m.collection]?.[m.ref]?.magazine_bonus) || 0), 0);
  return Math.max(0, (Number(st.calc.formula(ent.magazine.capacity)) || 0) + bonus);
}

/** Inventory items this magazine accepts, grouped by entity: [{ key, name, qty, items }]. */
function ammoStock(st, ent) {
  const ok = new Set([].concat(ent.magazine.ammo || []));
  const groups = new Map();
  for (const i of st.sheet.items || []) {
    if (!ok.has(refKey(i))) continue;
    const g = groups.get(refKey(i)) || { key: refKey(i), name: st.rules.entities[i.collection]?.[i.ref]?.name || i.ref, qty: 0, items: [] };
    g.qty += Number(i.qty ?? 1); g.items.push(i);
    groups.set(g.key, g);
  }
  return [...groups.values()];
}

/** Ammo types a magazine accepts, in the package's order. */
const ammoTypes = ent => [...new Set([].concat(ent.magazine?.ammo || []))];
const entName = (st, key) => { const [c, r] = key.split('/'); return st.rules.entities[c]?.[r]?.name || r; };

/** The ammo the weapon is using: what is loaded, else the one picked, else the first one in the inventory. */
function currentAmmo(st, item, ent) {
  const types = ammoTypes(ent);
  if (item.loaded && item.loaded_ref) return item.loaded_ref;
  if (item.ammo_ref && types.includes(item.ammo_ref)) return item.ammo_ref;
  const stock = ammoStock(st, ent).filter(g => g.qty > 0).map(g => g.key);
  return types.find(k => stock.includes(k)) || types[0];
}

/** Rounds left in the magazine go back to the inventory (when the ammo is switched). */
function unloadRounds(st, item) {
  if (!item.loaded || !item.loaded_ref) return;
  const [c, r] = item.loaded_ref.split('/');
  const back = st.sheet.items.find(x => refKey(x) === item.loaded_ref);
  if (back) back.qty = Number(back.qty ?? 1) + item.loaded;
  else st.sheet.items.push({ uid: uid(), collection: c, ref: r, qty: item.loaded });
  item.loaded = 0;
}

/** Which ammo the weapon uses; a list to pick from when it takes more than one. */
function ammoChooser(st, item, ent) {
  const types = ammoTypes(ent);
  if (!types.length) return null;
  const stock = new Map(ammoStock(st, ent).map(g => [g.key, g.qty]));
  const current = currentAmmo(st, item, ent);
  if (types.length === 1) return h('div.small.mag-ammo', h('span.muted', `${t('sheet.ammoUsed')}: `), entName(st, types[0]));
  const label = key => (stock.get(key) ? `${entName(st, key)} (${fmt(stock.get(key))})` : entName(st, key));
  return h('label.small.mag-ammo', h('span.muted', `${t('sheet.ammoUsed')}: `),
    h('select.mini', {
      'aria-label': t('sheet.ammoUsed'),
      onchange: e => {
        const key = e.target.value;
        if (item.loaded && item.loaded_ref && item.loaded_ref !== key && !ent.magazine.charge) unloadRounds(st, item);
        item.ammo_ref = key;
        st.change();
      },
    }, types.map(key => h('option', { value: key, selected: key === current }, label(key)))));
}

function takeAmmo(items, n) {
  let left = n;
  for (const i of items) {
    const use = Math.min(left, Number(i.qty ?? 1));
    i.qty = Number(i.qty ?? 1) - use; left -= use;
    if (!left) break;
  }
  return n - left;
}

function reload(st, item, ent) {
  const mag = ent.magazine;
  const cap = magazineCapacity(st, item, ent);
  const stock = ammoStock(st, ent).filter(g => g.qty > 0);
  const chosen = ammoTypes(ent).length > 1 ? currentAmmo(st, item, ent) : null;
  if (chosen && !stock.some(g => g.key === chosen)) { toast(t('sheet.noChosenAmmo', { name: entName(st, chosen) }), 'error'); return; }
  if (!stock.length) { toast(t('sheet.noAmmo'), 'error'); return; }
  const go = g => {
    // Switching ammo: the rounds still in the magazine go back to the inventory.
    if (item.loaded && item.loaded_ref && item.loaded_ref !== g.key && !mag.charge) unloadRounds(st, item);
    if (mag.charge) { takeAmmo(g.items, 1); item.loaded = cap; }
    else item.loaded = (item.loaded || 0) + takeAmmo(g.items, Math.max(0, cap - (item.loaded || 0)));
    item.loaded_ref = g.key;
    if (ammoTypes(ent).length > 1) item.ammo_ref = g.key;
    st.change();
  };
  if (chosen) return go(stock.find(g => g.key === chosen));
  if (stock.length === 1) return go(stock[0]);
  let dlg;
  dlg = dialog(t('sheet.chooseAmmo'), h('div.choices', stock.map(g => h('button.choice-button', { type: 'button', onclick: () => { dlg.close(); go(g); } },
    h('strong', g.name), h('span.muted', ` ×${fmt(g.qty)}`), g.key === item.loaded_ref ? h('span.badge.ok', t('sheet.loadedNow')) : null))));
}

function magazineRow(st, item, ent) {
  const mag = ent.magazine;
  const cap = magazineCapacity(st, item, ent);
  const loaded = Math.min(item.loaded || 0, cap);
  const per = Number(mag.per_shot) || 1;
  const many = ammoTypes(ent).length > 1;
  const using = many ? currentAmmo(st, item, ent) : null;
  const reserve = ammoStock(st, ent).filter(g => !using || g.key === using).reduce((n, g) => n + g.qty, 0);
  const set = v => { item.loaded = Math.max(0, Math.min(cap, v)); st.change(); };
  const loadedName = item.loaded_ref && loaded ? st.rules.entities[item.loaded_ref.split('/')[0]]?.[item.loaded_ref.split('/')[1]]?.name : null;
  return h('div.magazine',
    h('div.mag-count', h('span.muted.small', t('sheet.magazine')), h('strong', fmt(loaded)), h('span.muted', `/ ${fmt(cap)}`),
      loadedName && !many ? h('span.small.muted', ` · ${loadedName}`) : null),
    h('div.row.mag-buttons',
      h('button.mini', { type: 'button', 'aria-label': t('sheet.shoot'), title: t('sheet.shoot'), disabled: loaded < 1, onclick: () => set(loaded - per) }, per > 1 ? `−${per}` : '−1'),
      h('button.mini', { type: 'button', 'aria-label': t('sheet.addRound'), disabled: loaded >= cap, onclick: () => set(loaded + 1) }, '+1'),
      h('button.mini.primary', { type: 'button', disabled: loaded >= cap || !reserve, onclick: () => reload(st, item, ent) }, t('sheet.reload'))),
    ammoChooser(st, item, ent),
    h('div.small.muted', t('sheet.reserve', { n: fmt(reserve) })));
}

// ---------- Mods installed inside an item (weapon mods...) ----------
function modsDialog(st, item, col) {
  const modCol = col.mods;
  const { rules, sheet } = st;
  const installedCount = u => sheet.items.reduce((n, x) => n + (x.mods || []).filter(m => m === u).length, 0);
  const body = h('div');
  const draw = () => {
    const mine = (item.mods || []).map(u => sheet.items.find(x => x.uid === u)).filter(Boolean);
    const free = sheet.items.filter(x => x.collection === modCol && Number(x.qty ?? 1) - installedCount(x.uid) > 0);
    const name = x => x.name || rules.entities[x.collection]?.[x.ref]?.name || x.ref;
    body.replaceChildren(
      h('h4', t('sheet.modsInstalled')),
      mine.length ? h('ul.mod-list', mine.map(m => h('li', h('button.mini.link', { onclick: () => entityDetails(st, m.collection, m.ref) }, name(m)),
        h('button.mini', { onclick: () => { item.mods = item.mods.filter(u => u !== m.uid); st.change(); draw(); } }, t('sheet.uninstall'))))) : h('p.muted.small', t('sheet.noMods')),
      h('h4', t('sheet.modsAvailable')),
      free.length ? h('ul.mod-list', free.map(m => {
        const e = rules.entities[m.collection]?.[m.ref];
        const fit = e?.compativeis || e?.compatible;
        return h('li', h('span', h('button.mini.link', { onclick: () => entityDetails(st, m.collection, m.ref) }, name(m)), fit ? h('div.small.muted', fit) : null),
          h('button.mini.primary', { onclick: () => { (item.mods ||= []).push(m.uid); st.change(); draw(); } }, t('sheet.install')));
      })) : h('p.muted.small', t('sheet.noFreeMods', { name: rules.collections[modCol]?.name || modCol })));
  };
  draw();
  dialog(t('sheet.modsOf', { name: item.name || rules.entities[item.collection]?.[item.ref]?.name || item.ref }), body, { width: '560px' });
}

// ---------- Equipped view: only what is equipped, as cards with its numbers ----------
function equippedBlock(st, def) {
  const { rules, sheet } = st;
  const colId = def.collection;
  const col = rules.collections[colId] || {};
  const fields = col.fields || {};
  const items = (sheet.items || []).filter(i => i.collection === colId && (!col.equippable || i.equipped));
  const title = def.title || col.name || colId;
  const wearMax = col.wear?.max;
  // "wear.stats": numbers that only exist while the item is worn (e.g. attack −2).
  const wearStats = item => (effectiveWear(rules, item) > 0 ? (col.wear?.stats || []).map(x => ({ label: x.label, value: signed(Number(st.calc.formula(x.value, { wear: effectiveWear(rules, item) }))) })) : []);
  if (!items.length) return def.hide_empty ? null : [h('h3', title), h('p.muted.small', t('sheet.nothingEquipped'))];
  return [h('h3', title), h('div.equip-list', items.map(item => {
    const ent = rules.entities[colId]?.[item.ref];
    const name = item.name || ent?.name || item.ref;
    const mods = (item.mods || []).map(u => sheet.items.find(x => x.uid === u)).filter(Boolean);
    return h('div.equip-card',
      h('div.equip-head',
        h('button.mini.link.equip-name', { onclick: () => entityDetails(st, colId, item.ref, item) }, name),
        wearMax ? h('div.row.wear-row',
          h('span.small.muted', t('sheet.wear')),
          h('button.mini', { 'aria-label': t('sheet.lessWear'), onclick: () => { item.wear = Math.max(0, (item.wear || 0) - 1); st.change(); } }, '−'),
          h('span.wear-value', `${item.wear || 0}/${wearMax}`),
          h('button.mini', { 'aria-label': t('sheet.moreWear'), onclick: () => { item.wear = Math.min(wearMax, (item.wear || 0) + 1); st.change(); } }, '+')) : null),
      (def.columns || []).length || wearStats(item).length ? h('div.equip-stats',
        (def.columns || []).filter(c => ent?.[c] !== undefined && ent[c] !== '').map(c => {
          const now = itemValue(st, colId, item, ent, c);
          return h('span.stat', { class: now !== ent[c] ? 'worn' : '', title: now !== ent[c] ? t('sheet.baseValue', { n: fmtField(ent[c], fields[c], st) }) : null },
            h('span.muted.small', fields[c]?.label || c), h('strong', fmtField(now, fields[c], st)));
        }),
        wearStats(item).map(x => h('span.stat.worn', h('span.muted.small', x.label), h('strong', x.value)))) : null,
      itemEffects(st, item),
      usesControl(st, item, ent, col),
      isBroken(rules, item) ? h('div.small', { style: { color: 'var(--danger)' } }, t('sheet.brokenText')) : null,
      ent?.magazine ? magazineRow(st, item, ent) : null,
      col.mods ? h('div.equip-mods.small',
        h('span.muted', `${t('sheet.mods')}: `), mods.length ? mods.map(m => m.name || rules.entities[m.collection]?.[m.ref]?.name).join(', ') : t('sheet.none'),
        h('button.mini', { onclick: () => modsDialog(st, item, col) }, t('sheet.manageMods'))) : null);
  }))];
}

// ---------- Inventory: every item, as cards by category or as one list ----------
function inventoryBlock(st, def) {
  const { rules, sheet } = st;
  const cols = (def.collections || Object.keys(rules.collections)).filter(c => rules.collections[c]);
  const items = (sheet.items || []).filter(i => cols.includes(i.collection));
  const setMode = m => { st.invMode = m; db.setConfig('inventoryView', m).catch(() => {}); st.redraw(); };
  const adder = h('button.mini.primary', { onclick: () => search(st, cols) }, t('sheet.addItem'));
  // Which item fields each view shows: "card_fields" / "list_fields", a list or { collection: [...], "*": [...] }.
  const fieldsFor = (spec, c) => {
    const list = Array.isArray(spec) ? spec : (spec?.[c] ?? spec?.['*'] ?? []);
    return list.filter(f => rules.collections[c]?.fields?.[f]);
  };
  const head = h('h3', h('span', def.title || t('sheet.inventory')),
    h('span.row.inv-tools',
      h('span.segmented', { role: 'group', 'aria-label': t('sheet.inventoryView') },
        h('button.mini', { 'aria-pressed': String(st.invMode !== 'list'), onclick: () => setMode('cards') }, t('sheet.viewCards')),
        h('button.mini', { 'aria-pressed': String(st.invMode === 'list'), onclick: () => setMode('list') }, t('sheet.viewList'))),
      adder));
  if (!items.length) return [head, h('p.muted.small', t('sheet.nothingYet'))];

  if (st.invMode !== 'list') {
    return [head, h('div.inv-cards', cols.filter(c => items.some(i => i.collection === c)).map(c =>
      h('div.inv-card', listBlock(st, { block: 'list', collection: c, columns: fieldsFor(def.card_fields ?? def.columns, c), no_wear: true, wear_badge: true }))))];
  }

  const q = h('input', { type: 'search', placeholder: t('sheet.search'), 'aria-label': t('sheet.search'), value: st.invQuery || '' });
  const listCols = [...new Set(cols.flatMap(c => fieldsFor(def.list_fields, c)))];
  const listLabel = f => cols.map(c => rules.collections[c]?.fields?.[f]?.label).find(Boolean) || f;
  const tbody = h('tbody');
  const rows = () => {
    const f = normalize(st.invQuery || '');
    const list = items.map(i => ({ i, ent: rules.entities[i.collection]?.[i.ref], col: rules.collections[i.collection] }))
      .map(x => ({ ...x, name: x.i.name || x.ent?.name || x.i.ref }))
      .filter(x => !f || normalize(`${x.name} ${x.col.name}`).includes(f))
      .sort((a, b) => byName(a.name, b.name));
    tbody.replaceChildren(...list.map(({ i, col, name }) => h('tr',
      h('td', col.equippable ? h('input', { type: 'checkbox', checked: !!i.equipped, 'aria-label': t('sheet.equipName', { name }), onchange: e => { i.equipped = e.target.checked; st.change(); } }) : null),
      h('td', h('button.mini.link', { onclick: () => entityDetails(st, i.collection, i.ref, i) }, name), wearBadge(col, i), h('div.small.muted', col.name), itemEffects(st, i),
        usesControl(st, i, rules.entities[i.collection]?.[i.ref], col)),
      listCols.map(f => h('td.small.num', fieldsFor(def.list_fields, i.collection).includes(f) ? fmtField(rules.entities[i.collection]?.[i.ref]?.[f], col.fields?.[f], st) : '—')),
      h('td.num', col.quantity ? h('input', { type: 'number', value: i.qty ?? 1, min: 0, inputmode: 'numeric', 'aria-label': t('sheet.qtyOf', { name }),
        onchange: e => { i.qty = Math.max(0, Number(e.target.value) || 0); st.change(); } }) : null),
      h('td.num', h('button.mini.danger', { 'aria-label': t('sheet.removeName', { name }), onclick: async () => {
        if (!col.quick_remove && !(await confirm(t('sheet.removeTitle'), t('sheet.removeAsk', { name }), { yes: t('sheet.remove'), danger: true }))) return;
        sheet.items = sheet.items.filter(x => x !== i);
        for (const x of sheet.items) if (x.mods?.includes(i.uid)) x.mods = x.mods.filter(u => u !== i.uid);
        st.change();
      } }, '✕')))));
  };
  q.addEventListener('input', () => { st.invQuery = q.value; rows(); });
  rows();
  return [head, q, h('div.scroll-table', h('table.table',
    h('thead', h('tr', h('th', { title: t('sheet.equipped') }, t('sheet.equippedShort')), h('th', t('sheet.name')),
      listCols.map(f => h('th.num', listLabel(f))), h('th.num', t('sheet.qty')), h('th'))),
    tbody))];
}

// ---------- Entity lists (items, traits, conditions...) ----------
function listBlock(st, def) {
  if (def.view === 'equipped') return equippedBlock(st, def);
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
  const wearMax = def.no_wear ? null : col?.wear?.max;

  const rows = items.map(item => {
    const ent = rules.entities[colId]?.[item.ref];
    const name = item.name || ent?.name || item.ref;
    const removeItem = async () => {
      if (!col?.quick_remove && !(await confirm(t('sheet.removeTitle'), t('sheet.removeAsk', { name }), { yes: t('sheet.remove'), danger: true }))) return;
      sheet.items = sheet.items.filter(x => x !== item);
      for (const x of sheet.items) if (x.mods?.includes(item.uid)) x.mods = x.mods.filter(u => u !== item.uid);
      st.change();
    };
    return h('tr', { class: ent ? '' : 'muted' },
      col?.equippable ? h('td', h('input', { type: 'checkbox', checked: !!item.equipped, 'aria-label': t('sheet.equipName', { name }), onchange: e => { item.equipped = e.target.checked; st.change(); } })) : null,
      h('td', h('button.mini.link', { onclick: () => entityDetails(st, colId, item.ref, item) }, name),
        def.wear_badge ? wearBadge(col, item) : null,
        ent ? null : h('span.badge.error', t('sheet.notFoundBadge')),
        itemEffects(st, item),
        usesControl(st, item, ent, col)),
      columns.map(c => h('td.small', fmtField(itemValue(st, colId, item, ent, c), fields[c], st))),
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
    columns.map(c => h('td.small', fmtField(f.ent[c], fields[c], st))),
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

/** Text whose terms (properties…) name entities of a collection: each one gets a tooltip and opens its details. */
function linkTerms(text, colId, st) {
  const ents = Object.values(st.rules.entities[colId]);
  const names = ents.map(e => ({ e, n: normalize(e.name) })).sort((a, b) => b.n.length - a.n.length);
  const out = []; let rest = String(text);
  // Split on ". " and ", " but keep the separators, so "Arremessável: x6/x10" stays whole.
  for (const part of rest.split(/(\.\s*|,\s*)/)) {
    const hit = names.find(x => normalize(part).startsWith(x.n));
    if (!hit) { out.push(part); continue; }
    const label = part.slice(0, hit.e.name.length), tail = part.slice(hit.e.name.length);
    out.push(h('button.term', { type: 'button', title: String(hit.e.description || '').slice(0, 300), onclick: ev => { ev.stopPropagation(); entityDetails(st, colId, hit.e.id); } }, label), tail);
  }
  return h('span', out);
}

/** A field of an item as it is now: "wear.fields" formulas lower it as the item wears. */
function itemValue(st, colId, item, ent, f) {
  const v = ent?.[f];
  const formula = st.rules.collections[colId]?.wear?.fields?.[f];
  if (!formula || !item || typeof v !== 'number' || !st.calc) return v;
  return Number(st.calc.formula(formula, { value: v, wear: effectiveWear(st.rules, item) }));
}

/** "Wear 2" badge, only when the item has wear. */
/**
 * Items with limited uses ("uses": 3 on the entity): one box per use, marked as they are spent
 * (the count is kept on the sheet item as "used"). When all are spent and the player has more of the
 * same item, "Open another" takes one from the quantity and starts over.
 */
function usesControl(st, item, ent, col) {
  const n = Math.floor(Number(ent?.uses) || 0);
  if (n <= 0) return null;
  const used = Math.min(n, Math.max(0, Number(item.used) || 0));
  const set = v => { item.used = Math.max(0, Math.min(n, v)); if (!item.used) delete item.used; st.change(); };
  const spent = used >= n;
  const more = col?.quantity && (item.qty ?? 1) > 1;
  const boxes = n <= 10
    ? h('span.use-pips', Array.from({ length: n }, (_, i) => h('button', { type: 'button', class: i < used ? 'full' : '',
        'aria-label': t('sheet.useN', { n: i + 1 }), 'aria-pressed': String(i < used), onclick: () => set(used === i + 1 ? i : i + 1) })))
    : h('span.row', { style: { gap: '2px', flexWrap: 'nowrap' } },
        h('button.mini', { 'aria-label': t('sheet.lessUsed'), onclick: () => set(used - 1) }, '−'),
        h('button.mini', { 'aria-label': t('sheet.moreUsed'), onclick: () => set(used + 1) }, '+'));
  return h('div.uses-row.small',
    h('span.muted', t('sheet.uses')), boxes, h('span', t('sheet.usesLeft', { n: n - used, total: n })),
    spent ? h('span.badge.warning', t('sheet.spent')) : null,
    spent && more ? h('button.mini', { onclick: () => { item.qty = (item.qty ?? 1) - 1; delete item.used; st.change(); } }, t('sheet.openAnother')) : null);
}

function wearBadge(col, item) {
  if (!col?.wear?.max || !(item.wear > 0)) return null;
  const broken = col.wear.breaks && item.wear >= col.wear.max;
  return h(`span.badge.wear-badge.${broken ? 'error' : 'warning'}`, { title: col.wear.text || t('sheet.wear') }, broken ? t('sheet.broken') : t('sheet.wearShort', { n: item.wear }));
}

function fmtField(v, field, st) {
  if (v === undefined || v === null || v === '') return '—';
  if (field?.type === 'range') return fmtRange(v, field, st);
  if (field?.links && st?.rules?.entities?.[field.links] && typeof v === 'string') return linkTerms(v, field.links, st);
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');
  const u = field?.unit ? ` ${field.unit}` : '';
  return typeof v === 'number' ? `${fmt(v)}${u}` : `${v}${u}`;
}

/** Search entities to add. colIds: one collection, or several (then results show their category and a filter). */
function search(st, colIds) {
  const { rules, sheet } = st;
  const ids = [].concat(colIds).filter(c => rules.entities[c] || rules.collections[c]);
  const many = ids.length > 1;
  const nameOf = c => rules.collections[c]?.name || c;
  // What the character is immune to (e.g. a robot and "Bleeding") is not offered.
  const all = ids.flatMap(c => Object.values(rules.entities[c] || {}).filter(e => !st.calc.immune(c, e.id)).map(e => ({ c, e })))
    .sort((a, b) => byName(a.e.name, b.e.name));
  const input = h('input', { type: 'search', placeholder: many ? t('sheet.searchAll') : t('sheet.searchIn', { name: nameOf(ids[0]) }), 'aria-label': t('sheet.search') });
  const filter = many ? h('select', { 'aria-label': t('sheet.category') }, h('option', { value: '' }, t('sheet.allCategories')), ids.map(c => h('option', { value: c }, nameOf(c)))) : null;
  const list = h('div.search-list');
  let dlg;
  const add = ({ c, e: ent }) => {
    const col = rules.collections[c] || {};
    const existing = col.quantity && (sheet.items || []).find(i => i.collection === c && i.ref === ent.id);
    if (existing) existing.qty = (existing.qty ?? 1) + 1;
    else (sheet.items ||= []).push({ uid: uid(), collection: c, ref: ent.id, ...(col.quantity ? { qty: 1 } : {}), ...(col.equippable ? { equipped: false } : {}) });
    toast(t('sheet.added', { name: ent.name }));
    if (!many && col.max !== undefined && sheet.items.filter(i => i.collection === c).length >= col.max) dlg.close();
    st.change();
  };
  // Requirements ("requires") must be met, unless the player ticks "ignore", and a "unique" collection
  // takes each entity only "repeat" times (default once).
  let ignore = false;
  const blocked = ({ c, e }) => {
    if (rules.collections[c]?.unique && (sheet.items || []).filter(i => i.collection === c && i.ref === e.id).length >= (Number(e.repeat) || 1)) return { why: t('sheet.alreadyHave') };
    const why = unmetRequirement(rules, st.calc, e);
    return why ? { why: t('creation.unmetWhy', { why }), req: true } : null;
  };
  const anyUnmet = all.some(x => blocked(x)?.req);
  const ignoreBox = anyUnmet ? h('label.check.small', h('input', { type: 'checkbox', onchange: ev => { ignore = ev.target.checked; draw(); } }), t('creation.ignoreReq')) : null;
  const draw = () => {
    const q = normalize(input.value);
    const found = all.filter(({ c, e }) => (!filter?.value || c === filter.value) &&
      (!q || normalize(`${e.name} ${e.description || ''} ${(e.tags || []).join(' ')} ${many ? nameOf(c) : ''}`).includes(q)))
      // Names that match come before matches found only in descriptions.
      .sort((a, b) => (q && !normalize(a.e.name).includes(q)) - (q && !normalize(b.e.name).includes(q))).slice(0, 200);
    list.replaceChildren(...(found.length ? found.map(x => {
      const b = blocked(x);
      const off = b && !(b.req && ignore);
      return h('div.search-item', { class: b ? 'unmet' : '' },
        h('div.search-text', h('div', h('strong', x.e.name), many ? h('span.badge', { style: { marginLeft: '.4rem' } }, nameOf(x.c)) : null,
            x.e.custom ? h('span.badge.ok', { style: { marginLeft: '.4rem' } }, t('custom.badge')) : null),
          x.e.description ? h('div.desc', String(x.e.description).slice(0, 140) + (String(x.e.description).length > 140 ? '…' : '')) : null,
          b ? h('div.small.unmet-why', b.why) : null),
        h('div.row', { style: { flexWrap: 'nowrap' } },
          h('button.mini', { onclick: () => entityDetails(st, x.c, x.e.id) }, t('sheet.view')),
          h('button.mini.primary', { disabled: off, onclick: () => add(x) }, t('sheet.addShort'))));
    }) : [h('p.muted', t('sheet.nothingFound'))]));
  };
  input.addEventListener('input', draw);
  filter?.addEventListener('change', draw);
  draw();
  const customCols = ids.filter(c => rules.collections[c]?.custom);
  const create = customCols.length ? h('button.mini', { onclick: () => { dlg.close(); customItem(st, customCols, filter?.value); } }, t('custom.create')) : null;
  dlg = dialog(many ? t('sheet.addItemTitle') : t('sheet.addTo', { name: nameOf(ids[0]) }), [filter ? h('div.row.search-bar', input, filter) : input, ignoreBox, list, create ? h('div.row', { style: { marginTop: '.6rem' } }, create) : null], { width: '640px' });
  input.focus();
}

/** Which fields a custom item of this collection may have: "custom" is true (all), a list, or { fields, magazine }. */
function customFields(col) {
  const c = col?.custom;
  const list = c === true ? Object.keys(col.fields || {}) : Array.isArray(c) ? c : c?.fields || Object.keys(col.fields || {});
  return list.filter(f => col.fields?.[f]);
}

/** Form to create (or edit) an item that only exists in this sheet. */
function customItem(st, colIds, preferred, ent) {
  const { rules, sheet } = st;
  const nameOf = c => rules.collections[c]?.name || c;
  const cat = h('select', { disabled: !!ent, 'aria-label': t('custom.category') }, colIds.map(c => h('option', { value: c }, nameOf(c))));
  cat.value = ent ? colIds[0] : colIds.includes(preferred) ? preferred : colIds[0];
  const name = h('input', { type: 'text', value: ent?.name || '' });
  const desc = h('textarea', { rows: 3 }, ent?.description || '');
  const box = h('div.custom-fields');
  let inputs = {}, ammo = [], cap = null;
  const field = (label, control, hint) => h('label.field', h('span', label), control, hint ? h('div.small.muted', hint) : null);
  const drawFields = () => {
    const colId = cat.value, col = rules.collections[colId] || {};
    inputs = {};
    const out = customFields(col).map(f => {
      const def = col.fields[f], v = ent?.[f] ?? '';
      const label = `${def.label || f}${def.unit ? ` (${def.unit})` : ''}`;
      if (def.type === 'boolean') { inputs[f] = h('input', { type: 'checkbox', checked: !!v }); return h('label.check', inputs[f], def.label || f); }
      const inp = inputs[f] = h('input', { type: def.type === 'number' ? 'number' : 'text', value: v, inputmode: def.type === 'number' ? 'decimal' : null });
      const hint = def.type === 'range' && def.per ? t('custom.perHint', { name: rules.attributes?.[def.per]?.name || rules.derived?.[def.per]?.name || def.per }) : null;
      if (def.links && rules.entities[def.links]) {
        // Pick terms (properties…) from their collection instead of typing them.
        const pick = h('select', { 'aria-label': def.label || f, onchange: () => {
          const term = rules.entities[def.links][pick.value]?.name;
          if (term) inp.value = `${inp.value.trim()}${inp.value.trim() && !/[.,]$/.test(inp.value.trim()) ? '.' : ''} ${term}.`.trim();
          pick.value = '';
        } }, h('option', { value: '' }, t('custom.addTerm')), Object.values(rules.entities[def.links]).sort((a, b) => byName(a.name, b.name)).map(e => h('option', { value: e.id }, e.name)));
        return field(label, h('div.row.search-bar', inp, pick), hint);
      }
      return field(label, inp, hint);
    });
    // Magazine: capacity and the ammo it takes, picked from the ammo collection.
    const magCol = col.custom?.magazine;
    cap = null;
    if (magCol && rules.entities[magCol]) {
      ammo = [...(ent?.magazine?.ammo || [])];
      cap = h('input', { type: 'number', min: 0, value: ent?.magazine?.capacity ?? '', inputmode: 'numeric' });
      const chips = h('div.row');
      const drawChips = () => chips.replaceChildren(...ammo.map(r => h('span.badge', rules.entities[magCol]?.[r.split('/')[1]]?.name || r,
        h('button.icon', { 'aria-label': t('sheet.remove'), onclick: () => { ammo = ammo.filter(x => x !== r); drawChips(); } }, '✕'))));
      const pick = h('select', { 'aria-label': t('custom.ammo'), onchange: () => { const r = `${magCol}/${pick.value}`; if (pick.value && !ammo.includes(r)) ammo.push(r); pick.value = ''; drawChips(); } },
        h('option', { value: '' }, t('custom.addAmmo')), Object.values(rules.entities[magCol]).sort((a, b) => byName(a.name, b.name)).map(e => h('option', { value: e.id }, e.name)));
      drawChips();
      out.push(field(t('custom.capacity'), cap), field(t('custom.ammo'), h('div', chips, pick)));
    }
    box.replaceChildren(...out);
  };
  cat.addEventListener('change', drawFields);
  drawFields();
  dialog(ent ? t('custom.editTitle') : t('custom.title'), [
    colIds.length > 1 || ent ? field(t('custom.category'), cat) : null,
    field(t('custom.name'), name), field(t('custom.description'), desc), box,
  ], { width: '560px', actions: [
    { text: t('common.cancel') },
    { text: t('custom.save'), primary: true, action: () => {
      if (!name.value.trim()) { toast(t('custom.needName'), 'error'); return false; }
      const colId = cat.value, col = rules.collections[colId] || {};
      const obj = ent || { id: `custom_${uid()}`, custom: true };
      obj.name = name.value.trim();
      obj.description = desc.value.trim() || undefined;
      for (const [f, inp] of Object.entries(inputs)) {
        const def = col.fields[f];
        const v = def.type === 'boolean' ? inp.checked : def.type === 'number' ? (inp.value === '' ? undefined : Number(inp.value)) : inp.value.trim() || undefined;
        if (v === undefined) delete obj[f]; else obj[f] = v;
      }
      if (cap) { if (Number(cap.value) > 0) obj.magazine = { ...(obj.magazine || {}), capacity: Number(cap.value), ammo }; else delete obj.magazine; }
      ((sheet.custom ||= {})[colId] ||= {})[obj.id] = obj;
      (rules.entities[colId] ||= {})[obj.id] = obj;
      if (!ent) {
        (sheet.items ||= []).push({ uid: uid(), collection: colId, ref: obj.id, ...(col.quantity ? { qty: 1 } : {}), ...(col.equippable ? { equipped: false } : {}) });
        toast(t('sheet.added', { name: obj.name }));
      }
      st.change();
    } },
  ] });
  name.focus();
}

export function entityDetails(st, colId, id, item) {
  const { rules } = st;
  const ent = rules.entities[colId]?.[id];
  if (!ent) { dialog(t('sheet.notFoundTitle'), h('p', t('sheet.notFoundText', { name: item?.name || id }))); return; }
  const fields = rules.collections[colId]?.fields || {};
  const rows = Object.entries(fields).filter(([k]) => ent[k] !== undefined && ent[k] !== '').map(([k, c]) => h('tr', h('td.muted', c.label || k), h('td', fmtField(ent[k], c, st))));
  const origin = rules.origin[`${colId}/${id}`];
  const content = [
    ent.description ? h('p', { style: { whiteSpace: 'pre-line' } }, ent.description) : null,
    rows.length ? h('table.table', h('tbody', rows)) : null,
    Number(ent.uses) > 0 ? h('p.small', h('strong', `${t('sheet.uses')}: `), String(Math.floor(Number(ent.uses)))) : null,
    ent.effects?.length ? [h('h4', { style: { margin: '.8rem 0 .3rem' } }, t('sheet.effects')), h('ul.effects-list', ent.effects.map(ef => h('li', describeEffect(rules, ef))))] : null,
    ent.tags?.length ? h('p.small', ent.tags.map(x => h('span.badge', { style: { marginRight: '4px' } }, x))) : null,
    ent.custom ? h('p.muted.small', t('custom.origin')) : origin ? h('p.muted.small', t('sheet.origin', { name: st.inst[origin]?.name || origin })) : null,
  ];
  const actions = [];
  if (ent.custom) {
    actions.push({ text: t('custom.edit'), action: () => { customItem(st, [colId], colId, ent); } });
    actions.push({ text: t('custom.delete'), danger: true, action: async () => {
      if (!(await confirm(t('custom.delete'), t('custom.deleteText', { name: ent.name }), { yes: t('sheet.remove'), danger: true }))) return false;
      delete st.sheet.custom?.[colId]?.[id];
      delete rules.entities[colId][id];
      st.sheet.items = (st.sheet.items || []).filter(i => !(i.collection === colId && i.ref === id));
      st.change();
    } });
  }
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

// ---------- Money: the coins of a "currency" collection and their total in the base coin ----------
function moneyBlock(st, def) {
  const { rules, sheet } = st;
  const colId = def.collection || Object.keys(rules.collections).find(c => rules.collections[c].currency);
  const col = rules.collections[colId];
  if (!col?.currency) return null;
  const field = col.currency.value || 'value';
  const coins = Object.values(rules.entities[colId] || {}).sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0));
  const base = rules.entities[colId]?.[col.currency.base] || coins.find(c => Number(c[field]) === 1) || coins[0];
  if (!base) return null;
  const unit = c => c.abbr || c.name;
  const qty = c => (sheet.items || []).filter(i => i.collection === colId && i.ref === c.id).reduce((n, i) => n + Number(i.qty ?? 1), 0);
  // Coins are inventory items, so their weight counts like anything else.
  const setQty = (c, n) => {
    const own = (sheet.items || []).filter(i => i.collection === colId && i.ref === c.id);
    sheet.items = (sheet.items || []).filter(i => !own.includes(i) || i === own[0]);
    if (own[0]) own[0].qty = Math.max(0, n); else (sheet.items ||= []).push({ uid: uid(), collection: colId, ref: c.id, qty: Math.max(0, n) });
    st.change();
  };
  const total = coins.reduce((n, c) => n + qty(c) * (Number(c[field]) || 0), 0) / (Number(base[field]) || 1);
  const round = n => Math.round(n * 1000) / 1000;
  return [
    h('h3', def.title || col.name),
    // With one coin its own line already says it all.
    coins.length > 1 ? h('div.money-total', h('span.muted.small', t('money.total')), h('strong', `${fmt(round(total))} ${unit(base)}`)) : null,
    h('div.money-rows', coins.map(c => {
      const have = qty(c);
      // Type +50 or -20 and press Enter to gain or spend.
      const delta = h('input.money-delta', { type: 'text', inputmode: 'numeric', placeholder: '±', 'aria-label': t('money.change', { name: c.name }),
        onkeydown: e => { if (e.key !== 'Enter') return; const n = Number(String(e.target.value).replace(',', '.')); if (Number.isFinite(n) && n) setQty(c, have + n); } });
      return h('div.money-row',
        h('div', h('strong', c.name), coins.length > 1 && c !== base ? h('span.muted.small', ` = ${fmt(round((Number(c[field]) || 0) / (Number(base[field]) || 1)))} ${unit(base)}`) : null),
        h('input', { type: 'number', min: 0, value: have, inputmode: 'numeric', 'aria-label': t('sheet.qtyOf', { name: c.name }), onchange: e => setQty(c, Number(e.target.value) || 0) }),
        delta);
    })),
  ];
}

// ---------- Notebook: many notes with a title, folded or open, with search ----------
/** Text with every match of q (ignoring accents and case) wrapped in <mark>. */
function highlight(text, q) {
  const src = String(text || '');
  if (!q) return [src];
  // Normalized copy plus, for each of its characters, the position in the original.
  let flat = ''; const at = [];
  for (let i = 0; i < src.length; i++) { const n = normalize(src[i]); flat += n; for (let k = 0; k < n.length; k++) at.push(i); }
  const out = []; let last = 0;
  for (let i = flat.indexOf(q); i >= 0; i = flat.indexOf(q, i + q.length)) {
    const a = at[i], b = at[i + q.length - 1] + 1;
    if (a < last) continue;
    out.push(src.slice(last, a), h('mark', src.slice(a, b)));
    last = b;
  }
  out.push(src.slice(last));
  return out;
}

/** The lines of a note that contain the search, for the results view. */
function matchingLines(text, q, max = 3) {
  return String(text || '').split('\n').filter(l => normalize(l).includes(q)).slice(0, max);
}

function notebookBlock(st, def) {
  const { sheet } = st;
  const key = def.id || 'notebook';
  sheet.notebooks ||= {};
  const notes = (sheet.notebooks[key] ||= []);
  // Text from older single notes blocks becomes a note, once.
  for (const id of def.import_notes || []) {
    const mark = `${key}:${id}`;
    if (sheet.notes?.[id]?.trim() && !(sheet.notebookImported ||= []).includes(mark)) {
      notes.push({ id: uid(), title: def.import_titles?.[id] || id, text: sheet.notes[id], open: false });
      sheet.notebookImported.push(mark);
      st.save();
    }
  }
  let q = normalize(st.noteQuery?.[key] || '').trim();
  const search = h('input', { type: 'search', placeholder: t('notes.search'), 'aria-label': t('notes.search'), value: st.noteQuery?.[key] || '' });
  const list = h('div.notebook');
  const add = () => {
    notes.unshift({ id: uid(), title: '', text: '', open: true });
    (st.noteQuery ||= {})[key] = '';
    st.focusNote = notes[0].id;
    st.change();
  };
  const remove = async n => {
    if ((n.title || n.text) && !(await confirm(t('notes.removeTitle'), t('notes.removeAsk', { name: n.title || t('notes.untitled') }), { yes: t('sheet.remove'), danger: true }))) return;
    notes.splice(notes.indexOf(n), 1);
    st.change();
  };

  const card = n => {
    const toggle = () => { n.open = !n.open; st.change(); };
    if (q) {
      // Results: highlighted title and the lines that match; open goes to the note.
      return h('div.note.result',
        h('div.note-head', h('strong.note-title', highlight(n.title || t('notes.untitled'), q)),
          h('button.mini', { onclick: () => { n.open = true; st.noteQuery[key] = ''; st.focusNote = n.id; st.change(); } }, t('notes.open'))),
        matchingLines(n.text, q).map(l => h('p.note-line.small', highlight(l, q))));
    }
    const title = h('input.note-title-input', { type: 'text', value: n.title, placeholder: t('notes.untitled'), 'aria-label': t('notes.title'),
      oninput: e => { n.title = e.target.value; st.save(); } });
    const text = h('textarea.note-text', { value: n.text, placeholder: t('notes.placeholder'), 'aria-label': n.title || t('notes.untitled'),
      oninput: e => { n.text = e.target.value; st.save(); } });
    if (st.focusNote === n.id) requestAnimationFrame(() => { (n.title ? text : title).focus(); st.focusNote = null; });
    return h('div.note', { class: n.open ? 'open' : '' },
      h('div.note-head',
        h('button.mini.note-fold', { 'aria-expanded': String(!!n.open), 'aria-label': n.open ? t('notes.fold') : t('notes.unfold'), onclick: toggle }, n.open ? '▾' : '▸'),
        n.open ? title : h('button.link.note-title', { onclick: toggle }, n.title || t('notes.untitled'),
          n.text ? h('span.muted.small.note-preview', ` — ${n.text.replace(/\s+/g, ' ').slice(0, 80)}`) : null),
        h('button.mini.danger', { 'aria-label': t('notes.remove'), onclick: () => remove(n) }, '✕')),
      n.open ? text : null);
  };

  const draw = () => {
    const shown = q ? notes.filter(n => normalize(`${n.title}\n${n.text}`).includes(q)) : notes;
    list.replaceChildren(...(shown.length ? shown.map(card) : [h('p.muted.small', q ? t('notes.noMatch') : t('notes.empty'))]));
  };
  search.addEventListener('input', () => {
    (st.noteQuery ||= {})[key] = search.value;
    q = normalize(search.value).trim();
    draw();
  });
  draw();
  return [h('h3', h('span', def.title || t('sheet.notes')), h('button.mini.primary', { onclick: add }, t('notes.new'))),
    h('div.notebook-search', search), list];
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
  if (st.readOnly) return; // never for a sheet shared with the GM
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
