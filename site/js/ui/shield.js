// ============================================================
// GM mode, Shield tab: the GM's screen. Pages (sub-tabs) of cards: free text, a note, a roll table,
// the players' values, a dice roller and the combat's turn order. Each page scrolls down (grid) or
// sideways (one row); each card has a width like the sheet's blocks and a height.
// Everything is the GM's own and shown as text (h() → textContent), never as HTML.
// ============================================================
import * as gm from '../gm.js';
import * as rt from '../engine/rolltable.js';
import * as cb from '../engine/combat.js';
import { roll } from '../engine/calc.js';
import { t } from '../i18n.js';
import { h, toast, confirm, ask, dialog, fmt } from './util.js';
import { spans, startDrag } from './sheet.js';

const editing = {};   // tableId → arranging the cards
const lastRoll = {};  // `${tableId}:${cardId}` → results, while the app is open
const errText = e => { const k = `gm.err.${e.message}`; return t(k) !== k ? t(k) : e.message; };

/** ctx = { tb, loaded, redraw, chips(x) } (loaded and chips come from the lobby: the table's sheets and their card values). */
export function shieldTab({ tb, loaded, redraw, chips }) {
  const sh = gm.shieldOf(tb);
  const page = sh.pages.find(p => p.id === sh.active) || null;
  const edit = async fn => { try { await gm.editShield(tb.id, fn); redraw(); } catch (e) { toast(errText(e), 'error'); } };
  const editPage = fn => edit(s => { const p = s.pages.find(x => x.id === s.active); if (p) fn(p, s); });
  const arranging = !!editing[tb.id];

  const newPage = async () => {
    const n = await ask(t('shield.newPage'), t('shield.pageName'), t('shield.pageDefault', { n: sh.pages.length + 1 }));
    if (!n) return;
    edit(s => {
      if (s.pages.length >= gm.MAX_PAGES) throw new Error('TOO_MANY');
      const p = { id: gm.newCombatId(), name: n, scroll: 'grid', cards: [] };
      s.pages.push(p); s.active = p.id;
    });
  };
  const subTabs = h('div.tabs.shield-tabs', { role: 'tablist' },
    sh.pages.map(p => h('button', { role: 'tab', 'aria-selected': String(p.id === sh.active), onclick: () => edit(s => { s.active = p.id; }) }, p.name)),
    h('button.shield-add-page', { onclick: newPage, 'aria-label': t('shield.newPage'), title: t('shield.newPage') }, '+'));

  if (!page) {
    return [h('div.card', h('h3', t('shield.title')), h('p.muted.small', t('shield.intro')), h('button.primary', { onclick: newPage }, t('shield.newPage')))];
  }

  const toolbar = h('div.row.spread.shield-bar',
    h('div.row',
      h('button.mini.primary', { onclick: () => cardDialog(tb, null, c => editPage(p => { if (p.cards.length >= gm.MAX_CARDS) throw new Error('TOO_MANY'); p.cards.push(c); })) }, t('shield.addCard')),
      h('button.mini', { 'aria-pressed': String(arranging), onclick: () => { editing[tb.id] = !arranging; redraw(); } }, arranging ? t('sheet.doneArranging') : t('sheet.arrange'))),
    h('div.row',
      h('label.small.shield-scroll', h('span', t('shield.scroll')), ' ',
        h('select.mini', { onchange: e => editPage(p => { p.scroll = e.target.value; }) },
          h('option', { value: 'grid', selected: page.scroll === 'grid' }, t('shield.scrollGrid')),
          h('option', { value: 'row', selected: page.scroll === 'row' }, t('shield.scrollRow')))),
      h('button.mini', { onclick: async () => { const n = await ask(t('gm.rename'), t('shield.pageName'), page.name); if (n) editPage(p => { p.name = n; }); } }, t('gm.rename')),
      h('button.mini.danger', { onclick: async () => {
        if (await confirm(t('shield.deletePageTitle'), t('shield.deletePageText', { name: page.name }), { yes: t('gm.deleteShort'), danger: true }))
          edit(s => { s.pages = s.pages.filter(p => p.id !== page.id); s.active = s.pages[0]?.id || null; });
      } }, t('gm.deleteShort'))));

  // ---------- Cards ----------
  const notes = gm.notesOf(tb), tables = gm.rollTablesOf(tb);
  const persistOrder = grid => () => {
    const ids = [...grid.children].map(el => el.dataset.id).filter(Boolean);
    editPage(p => { p.cards.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)); });
  };
  const body = c => {
    const key = `${tb.id}:${c.id}`;
    if (c.type === 'text') return c.text ? h('p.pre-line.shield-text', c.text) : h('p.muted.small', t('shield.emptyText'));
    if (c.type === 'note') {
      const n = notes.find(x => x.id === c.ref);
      return n ? [h('strong', n.title || t('notes.untitled')), h('p.pre-line.shield-text', n.text)] : h('p.muted.small', t('shield.missingNote'));
    }
    if (c.type === 'table') {
      const x = tables.find(y => y.id === c.ref);
      if (!x) return h('p.muted.small', t('shield.missingTable'));
      const res = lastRoll[key];
      return [
        h('div.row.spread', h('span', h('strong', x.name), ' ', h('span.badge', x.dice)),
          h('button.mini.primary', { onclick: () => { lastRoll[key] = rt.rollTable(x); redraw(); } }, t('tables.roll'))),
        res ? h('div.rt-result', h('div.rt-result-main', h('span.badge', fmt(res.total)), ' ', res.row ? h('strong', res.text) : h('span.muted', t('tables.noRow'))),
          res.details.length ? h('div.muted.small', res.details.join(' · ')) : null) : null,
        h('table.rt-table', h('tbody', x.rows.map(r => h('tr', { class: res?.row && res.row.from === r.from && res.row.to === r.to ? 'hit' : '' },
          h('td.rt-range', r.from === r.to ? fmt(r.from) : `${fmt(r.from)}–${fmt(r.to)}`), h('td', r.text))))),
      ];
    }
    if (c.type === 'stats') {
      const active = (tb.parties || []).find(p => p.id === tb.activeParty);
      const list = loaded.filter(x => x.c?.sheet && (!active || active.members.includes(x.m.fileId)));
      if (!list.length) return h('p.muted.small', t('shield.noSheets'));
      return [active ? h('div.muted.small', t('gm.activeIs', { name: active.name })) : null,
        h('div.shield-stats', list.map(x => h('div.shield-stat-row', h('strong', x.c.sheet.name || t('common.unnamed')), h('div.stat-chips', chips(x)))))];
    }
    if (c.type === 'dice') {
      const input = h('input', { type: 'text', value: c.dice || '1d20', 'aria-label': t('sheet.rollExpr'), spellcheck: false });
      const go = () => {
        try {
          const r = roll(input.value.trim() || '1d20');
          (lastRoll[key] ||= []).unshift({ expr: input.value.trim(), total: r.total, details: r.details.join(' · ') });
          lastRoll[key] = lastRoll[key].slice(0, 6);
        } catch { toast(t('shield.badRoll'), 'error'); return; }
        redraw();
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      return [h('div.row', input, h('button.mini.primary', { onclick: go }, t('tables.roll'))),
        h('ul.shield-rolls', (lastRoll[key] || []).map((r, i) => h('li', { class: i === 0 ? 'latest' : '' }, h('strong', fmt(r.total)), ' ', h('span.muted.small', `${r.expr} · ${r.details}`))))];
    }
    if (c.type === 'initiative') {
      const combat = gm.combatOf(tb);
      const enc = combat.encounters.find(e => e.id === combat.active);
      if (!enc?.participants.length) return h('p.muted.small', t('shield.noCombat'));
      return [
        h('div.row.spread', h('span.small', h('strong', enc.name), ' · ', enc.started ? t('combat.round', { n: enc.round }) : t('combat.notStarted')),
          h('button.mini.primary', { onclick: async () => { await gm.editCombat(tb.id, cmb => { const e = cmb.encounters.find(x => x.id === cmb.active); if (e) cb.nextTurn(e); }); redraw(); } },
            enc.started ? t('combat.next') : t('combat.start'))),
        h('ol.shield-init', enc.participants.map((p, i) => h('li', { class: enc.started && i === enc.turn ? 'current' : p.hp !== null && p.hp <= 0 ? 'down' : '' },
          h('span.init-val', p.init ?? '—'), ' ', h('span', p.name), p.hp !== null ? h('span.muted.small', ` ${t('combat.hp')} ${fmt(p.hp)}${p.hpMax !== null ? `/${fmt(p.hpMax)}` : ''}`) : null,
          p.conditions.length ? h('span.muted.small', ` · ${p.conditions.length}⚠`) : null))),
      ];
    }
    return null;
  };

  const tools = (c, grid) => {
    const WIDTHS = gm.SHIELD_WIDTHS;
    const setW = dir => editPage(p => { const x = p.cards.find(y => y.id === c.id); const i = WIDTHS.indexOf(x.w); x.w = WIDTHS[Math.max(0, Math.min(WIDTHS.length - 1, i + dir))]; });
    const handle = h('button.mini.drag-handle', { type: 'button', title: t('sheet.drag'), 'aria-label': t('sheet.drag') }, '⠿');
    handle.addEventListener('pointerdown', ev => startDrag(ev, grid, persistOrder(grid)));
    const move = dir => editPage(p => { const i = p.cards.findIndex(y => y.id === c.id); const j = i + dir; if (j < 0 || j >= p.cards.length) return; [p.cards[i], p.cards[j]] = [p.cards[j], p.cards[i]]; });
    return h('div.block-tools',
      page.scroll === 'grid' ? handle : null,
      h('button.mini', { type: 'button', 'aria-label': t('sheet.moveEarlier'), onclick: () => move(-1) }, page.scroll === 'row' ? '←' : '↑'),
      h('button.mini', { type: 'button', 'aria-label': t('sheet.moveLater'), onclick: () => move(1) }, page.scroll === 'row' ? '→' : '↓'),
      h('span.spacer'),
      h('button.mini', { type: 'button', 'aria-label': t('sheet.narrower'), disabled: c.w <= WIDTHS[0], onclick: () => setW(-1) }, '−'),
      h('span.small.muted', `${c.w}/12`),
      h('button.mini', { type: 'button', 'aria-label': t('sheet.wider'), disabled: c.w >= 12, onclick: () => setW(1) }, '+'),
      h('select.mini', { 'aria-label': t('shield.height'), onchange: e => editPage(p => { p.cards.find(y => y.id === c.id).h = e.target.value; }) },
        gm.SHIELD_HEIGHTS.map(v => h('option', { value: v, selected: v === c.h }, t(`shield.h.${v}`)))),
      h('button.mini', { type: 'button', onclick: () => cardDialog(tb, c, nc => editPage(p => { const i = p.cards.findIndex(y => y.id === c.id); if (i >= 0) p.cards[i] = { ...p.cards[i], ...nc, id: c.id }; })) }, t('gm.edit')),
      h('button.mini.danger', { type: 'button', 'aria-label': t('shield.removeCard'), onclick: async () => {
        if (await confirm(t('shield.removeCardTitle'), t('shield.removeCardText', { name: c.title || t(`shield.type.${c.type}`) }), { yes: t('gm.deleteShort'), danger: true }))
          editPage(p => { p.cards = p.cards.filter(y => y.id !== c.id); });
      } }, '✕'));
  };

  const grid = h(`div.${page.scroll === 'row' ? 'shield-row' : 'dash.shield-grid'}`, { class: arranging ? 'editing' : '' });
  for (const c of page.cards) {
    grid.append(h('section.card.block.shield-card', { 'data-id': c.id, 'data-h': c.h, style: page.scroll === 'row' ? { '--w': c.w } : spans(c.w) },
      arranging ? tools(c, grid) : null,
      c.title ? h('h3', c.title) : null,
      h('div.shield-body', body(c))));
  }
  return [h('div.card.shield-head', subTabs, toolbar),
    page.cards.length ? grid : h('div.card', h('p.muted', t('shield.emptyPage')))];
}

/** New card or edit one: type, title and what the type needs. */
function cardDialog(tb, card, onSave) {
  const notes = gm.notesOf(tb), tables = gm.rollTablesOf(tb);
  let type = card?.type || 'text';
  const typeSel = h('select', { disabled: !!card, 'aria-label': t('shield.type') }, gm.SHIELD_TYPES.map(x => h('option', { value: x, selected: x === type }, t(`shield.type.${x}`))));
  const title = h('input', { type: 'text', maxlength: 80, value: card?.title || '', placeholder: t('shield.titlePh') });
  const text = h('textarea', { rows: 8, maxlength: 10000 });
  text.value = card?.text || '';
  const noteSel = h('select', notes.length ? notes.map(n => h('option', { value: n.id, selected: n.id === card?.ref }, n.title || t('notes.untitled'))) : h('option', { value: '' }, t('shield.noNotes')));
  const tableSel = h('select', tables.length ? tables.map(x => h('option', { value: x.id, selected: x.id === card?.ref }, x.name)) : h('option', { value: '' }, t('shield.noTables')));
  const dice = h('input', { type: 'text', maxlength: 40, value: card?.dice || '1d20', spellcheck: false });
  const extra = h('div');
  const hint = h('p.muted.small');
  const drawExtra = () => {
    type = typeSel.value;
    extra.replaceChildren(
      type === 'text' ? h('label.field', h('span', t('shield.text')), text)
        : type === 'note' ? h('label.field', h('span', t('shield.type.note')), noteSel)
          : type === 'table' ? h('label.field', h('span', t('shield.type.table')), tableSel)
            : type === 'dice' ? h('label.field', h('span', t('shield.defaultRoll')), dice) : '');
    hint.textContent = t(`shield.hint.${type}`);
  };
  typeSel.addEventListener('change', drawExtra);
  drawExtra();
  dialog(card ? t('shield.editCard') : t('shield.addCard'), [h('label.field', h('span', t('shield.type')), typeSel), hint, h('label.field', h('span', t('shield.cardTitle')), title), extra], { width: '560px', actions: [
    { text: t('common.cancel') },
    { text: t('common.save'), primary: true, action: () => {
      if (type === 'note' && !noteSel.value) { toast(t('shield.noNotes'), 'error'); return false; }
      if (type === 'table' && !tableSel.value) { toast(t('shield.noTables'), 'error'); return false; }
      const c = { id: card?.id || gm.newCombatId(), type, title: title.value, w: card?.w || (type === 'stats' || type === 'table' ? 6 : 4), h: card?.h || 'auto' };
      if (type === 'text') c.text = text.value;
      if (type === 'note') c.ref = noteSel.value;
      if (type === 'table') c.ref = tableSel.value;
      if (type === 'dice') c.dice = dice.value.trim() || '1d20';
      onSave(c);
    } },
  ] });
}
