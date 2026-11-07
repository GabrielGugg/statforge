// ============================================================
// GM mode, Tables tab: the GM's roll tables (create, edit, roll, export and import as .json).
// Imported files are data: checked by engine/rolltable.js and shown as text, never as HTML.
// ============================================================
import * as gm from '../gm.js';
import * as rt from '../engine/rolltable.js';
import { t } from '../i18n.js';
import { h, toast, confirm, dialog, downloadJSON, pickFiles, normalize, fmt } from './util.js';

const results = {}; // `${tableId}:${rollTableId}` → last roll, while the app is open
const queries = {}; // tableId → search text

const fileName = s => `${normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tabelas'}.json`;
const errText = e => { const k = `gm.err.${e.message}`; return t(k) !== k ? t(k) : e.message; };

export function rollTablesTab({ tb, redraw }) {
  const list = gm.rollTablesOf(tb);
  const q = normalize(queries[tb.id] || '').trim();
  const shown = list.filter(x => !q || normalize(`${x.name} ${x.description} ${x.rows.map(r => r.text).join(' ')}`).includes(q));

  const search = h('input', { type: 'search', value: queries[tb.id] || '', placeholder: t('tables.search'), 'aria-label': t('tables.search'),
    oninput: e => { queries[tb.id] = e.target.value; const pos = e.target.selectionStart; redraw(); requestAnimationFrame(() => { const el = document.querySelector('.rt-search input'); el?.focus(); el?.setSelectionRange(pos, pos); }); } });
  const top = h('div.card.rt-top',
    h('div.row.spread',
      h('h3', t('tables.title')),
      h('div.row',
        h('button.mini.primary', { onclick: () => editDialog(tb.id, null, redraw) }, t('tables.new')),
        h('button.mini', { onclick: async () => {
          const [f] = await pickFiles({ multiple: false });
          if (!f) return;
          try {
            if (f.size > 2 * 1024 * 1024) throw new Error('TABLES_INVALID');
            const items = rt.importFile(JSON.parse(await f.text()), () => 'x');
            const n = await gm.addRollTables(tb.id, items);
            toast(n < items.length ? t('tables.importedSome', { n, total: items.length }) : t('tables.imported', { n }));
            redraw();
          } catch (e) { toast(errText(e.message?.startsWith('TABLES') || e.message === 'TOO_MANY' ? e : new Error('TABLES_INVALID')), 'error'); }
        } }, t('tables.import')),
        list.length ? h('button.mini', { onclick: () => downloadJSON(rt.exportFile(list), fileName(`${tb.name}-tabelas`)) }, t('tables.exportAll')) : null)),
    list.length ? h('div.rt-search', search) : h('p.muted.small', t('tables.intro')));

  const card = x => {
    const key = `${tb.id}:${x.id}`;
    const res = results[key];
    const resultBox = h('div.rt-result', { 'aria-live': 'polite' }, res ? [
      h('div.rt-result-main', h('span.badge', fmt(res.total)), ' ', res.row ? h('strong', res.text) : h('span.muted', t('tables.noRow'))),
      res.details.length ? h('div.muted.small', res.details.join(' · ')) : null] : null);
    return h('div.card.rt-card',
      h('div.row.spread',
        h('div', h('strong', x.name), ' ', h('span.badge', x.dice), ' ', h('span.muted.small', t('tables.nRows', { n: x.rows.length }))),
        h('div.row',
          h('button.mini.primary', { onclick: () => { results[key] = rt.rollTable(x); redraw(); } }, t('tables.roll')),
          h('button.mini', { onclick: () => editDialog(tb.id, x, redraw) }, t('gm.edit')),
          h('button.mini', { onclick: () => downloadJSON(rt.exportFile([x]), fileName(x.name)) }, t('tables.export')),
          h('button.mini.danger', { onclick: async () => {
            if (await confirm(t('tables.deleteTitle'), t('tables.deleteText', { name: x.name }), { yes: t('gm.deleteShort'), danger: true })) { await gm.deleteRollTable(tb.id, x.id); delete results[key]; redraw(); }
          } }, t('gm.deleteShort')))),
      x.description ? h('p.small.muted.pre-line', x.description) : null,
      resultBox,
      h('details.rt-rows', h('summary.small', t('tables.showRows')),
        h('table.rt-table', h('tbody', x.rows.map(r => h('tr', { class: res?.row === r || (res?.row && res.row.from === r.from && res.row.to === r.to) ? 'hit' : '' },
          h('td.rt-range', r.from === r.to ? fmt(r.from) : `${fmt(r.from)}–${fmt(r.to)}`), h('td', r.text)))))));
  };
  return [top, ...(shown.length ? shown.map(card) : list.length ? [h('p.muted', t('tables.noMatch'))] : [])];
}

function editDialog(tableId, x, onDone) {
  const name = h('input', { type: 'text', maxlength: 80, value: x?.name || '', placeholder: t('tables.namePh') });
  const dice = h('input', { type: 'text', maxlength: 12, value: x?.dice || '', placeholder: '1d20', spellcheck: false });
  const desc = h('textarea', { rows: 2, maxlength: 1000, value: x?.description || '', placeholder: t('tables.descPh') });
  const rows = h('textarea.rt-edit-rows', { rows: 10, value: x ? rt.rowsText(x.rows) : '', placeholder: t('tables.rowsPh'), spellcheck: false });
  if (x) { desc.value = x.description || ''; rows.value = rt.rowsText(x.rows); }
  const msg = h('p.small');
  const check = () => {
    const parsed = rt.parseRows(rows.value);
    const d = dice.value.trim() || parsed.dice;
    dice.placeholder = parsed.rows.length ? parsed.dice : '1d20';
    const problems = [];
    if (dice.value.trim() && !rt.validDice(d)) problems.push(t('tables.badDice'));
    else if (parsed.rows.length) {
      const g = rt.gaps({ dice: d, rows: parsed.rows });
      if (g.length) problems.push(t('tables.gaps', { list: g.slice(0, 12).join(', ') + (g.length > 12 ? '…' : '') }));
    }
    msg.textContent = problems.length ? problems.join(' ') : parsed.rows.length ? t('tables.ok', { n: parsed.rows.length, dice: d }) : '';
    msg.className = problems.length ? 'small warning-text' : 'small muted';
    return { parsed, d, bad: !!dice.value.trim() && !rt.validDice(d) };
  };
  rows.addEventListener('input', check); dice.addEventListener('input', check);
  check();
  dialog(x ? t('tables.edit') : t('tables.new'), [
    h('label.field', h('span', t('tables.name')), name),
    h('label.field', h('span', t('tables.dice')), dice),
    h('label.field', h('span', t('tables.rows')), rows),
    h('p.muted.small', t('tables.rowsHelp')),
    msg,
    h('label.field', h('span', t('tables.desc')), desc),
  ], { width: '640px', actions: [
    { text: t('common.cancel') },
    { text: t('common.save'), primary: true, action: async () => {
      if (!name.value.trim()) { name.focus(); return false; }
      const { parsed, d, bad } = check();
      if (bad) { dice.focus(); return false; }
      if (!parsed.rows.length) { toast(t('gm.err.TABLE_INCOMPLETE'), 'error'); rows.focus(); return false; }
      try { await gm.saveRollTable(tableId, { id: x?.id, name: name.value, dice: d, rows: parsed.rows, description: desc.value }); onDone(); }
      catch (e) { toast(errText(e), 'error'); return false; }
    } },
  ] });
}
