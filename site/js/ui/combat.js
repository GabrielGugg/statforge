// ============================================================
// GM mode, Combat tab: encounters with initiative, turns, HP, conditions and notes.
//
// Everything here is the GM's: HP and conditions changed for a player's character live only in the
// encounter (on the GM's device and in the GM's hidden Drive file). The player's sheet is only read.
// Names and texts that came from players or packages are shown with h() (textContent), never as HTML.
// ============================================================
import * as pk from '../packages.js';
import * as gm from '../gm.js';
import { compute } from '../engine/calc.js';
import { entries as compendiumEntries, entrySheet } from '../engine/compendium.js';
import * as cb from '../engine/combat.js';
import { t } from '../i18n.js';
import { h, toast, confirm, ask, dialog, fmt, byName, normalize } from './util.js';
import { sheetScreen } from './sheet.js';

const previewOf = {}; // tableId → participant id shown in the side panel

/**
 * The tab's content. ctx = { tb, inst, loaded, redraw } where loaded is the lobby's list of
 * { m, c, rules, calc, local } (shared sheets and local sheets).
 */
export async function combatTab({ tb, inst, loaded, redraw }) {
  const tableId = tb.id;
  const combat = gm.combatOf(tb);
  const enc = combat.encounters.find(e => e.id === combat.active) || null;
  const settings = gm.settingsOf(tb);
  const sysRules = inst[tb.system] ? (await pk.rulesForSheet({ system: tb.system, extensions: [] }).catch(() => null))?.rules : null;
  const byKey = Object.fromEntries(loaded.map(x => [x.m.fileId, x]));
  const edit = async fn => { await gm.editCombat(tableId, c => { const e = c.encounters.find(x => x.id === c.active); return e ? fn(e, c) : fn(null, c); }); redraw(); };

  // Rules, calc and sheet of a participant, wherever it comes from.
  const compCache = {};
  const sourceOf = p => {
    if (p.kind === 'member') { const x = byKey[p.ref]; return x?.c ? { sheet: x.c.sheet, rules: x.rules, calc: x.calc, owner: x.c.owner?.name || x.c.owner?.email } : null; }
    if (p.kind === 'local') { const x = byKey[gm.localKey(p.ref)]; return x ? { sheet: x.local, rules: x.rules, calc: x.calc, local: x.local } : null; }
    if (p.kind === 'comp') {
      if (p.ref in compCache) return compCache[p.ref];
      const [compId, entryId] = p.ref.split('/');
      let out = null;
      try {
        if (sysRules && inst[compId]) {
          const { sheet } = entrySheet(sysRules, inst[compId], entryId, { id: `comp-${entryId}`, system: tb.system, extensions: [] });
          out = { sheet, rules: sysRules, calc: compute(sysRules, sheet) };
        }
      } catch { out = null; }
      return (compCache[p.ref] = out);
    }
    return null;
  };

  // ---------- Encounter picker ----------
  const top = h('div.card.combat-top',
    h('div.row.spread',
      h('div.row',
        combat.encounters.length ? h('select', { 'aria-label': t('combat.encounter'), onchange: async e => { await gm.editCombat(tableId, c => { c.active = e.target.value; }); redraw(); } },
          combat.encounters.map(e => h('option', { value: e.id, selected: e.id === combat.active }, e.name))) : h('strong', t('combat.none'))),
      h('div.row',
        h('button.mini.primary', { onclick: async () => {
          const n = await ask(t('combat.new'), t('combat.name'), t('combat.defaultName', { n: combat.encounters.length + 1 }));
          if (!n) return;
          try {
            await gm.editCombat(tableId, c => {
              if (c.encounters.length >= gm.MAX_ENCOUNTERS) throw new Error('TOO_MANY');
              const e = { id: gm.newCombatId(), name: n, round: 1, turn: 0, started: false, participants: [] };
              c.encounters.push(e); c.active = e.id;
            });
            redraw();
          } catch (err) { toast(t(`gm.err.${err.message}`), 'error'); }
        } }, t('combat.new')),
        enc ? h('button.mini', { onclick: async () => { const n = await ask(t('gm.rename'), t('combat.name'), enc.name); if (n) edit(e => { e.name = n; }); } }, t('gm.rename')) : null,
        enc ? h('button.mini.danger', { onclick: async () => {
          if (await confirm(t('combat.deleteTitle'), t('combat.deleteText', { name: enc.name }), { yes: t('gm.deleteShort'), danger: true })) {
            await gm.editCombat(tableId, c => { c.encounters = c.encounters.filter(e => e.id !== enc.id); c.active = c.encounters[0]?.id || null; });
            redraw();
          }
        } }, t('gm.deleteShort')) : null)),
    !combat.encounters.length ? h('p.muted.small', t('combat.intro')) : null);
  if (!enc) return [top];

  // ---------- Adding participants ----------
  const existingNames = () => enc.participants.map(p => p.name);
  const addFromSheets = keys => edit(e => {
    for (const key of keys) {
      const x = byKey[key];
      if (!x?.c?.sheet || e.participants.length >= gm.MAX_PARTICIPANTS) continue;
      const local = !!x.local;
      const ref = local ? x.local.id : x.m.fileId;
      if (e.participants.some(p => p.kind === (local ? 'local' : 'member') && p.ref === ref)) continue;
      const v = x.rules && x.calc ? cb.fromSheet(x.rules, x.c.sheet, x.calc) : { hp: null, hpMax: null, conditions: [] };
      e.participants.push({ id: gm.newCombatId(), kind: local ? 'local' : 'member', ref, name: x.c.sheet.name || t('common.unnamed'), npc: local && !!x.local.gm?.npc, init: null, ...v, note: '' });
    }
  });
  const sheetsDialog = () => {
    const chosen = new Set();
    const active = (tb.parties || []).find(p => p.id === tb.activeParty);
    const inFight = new Set(enc.participants.filter(p => p.kind !== 'comp').map(p => (p.kind === 'local' ? gm.localKey(p.ref) : p.ref)));
    const options = loaded.filter(x => x.c?.sheet && !inFight.has(x.m.fileId));
    const boxes = options.map(x => h('label.check', h('input', { type: 'checkbox', value: x.m.fileId, onchange: e => { if (e.target.checked) chosen.add(x.m.fileId); else chosen.delete(x.m.fileId); } }),
      h('span', x.c.sheet.name || t('common.unnamed'), ' ', h('span.muted.small', x.local ? (x.local.gm?.npc ? t('gm.local.npcBadge') : t('gm.local.badge')) : x.c.owner?.name || x.c.owner?.email || ''))));
    dialog(t('combat.addSheets'), options.length ? [
      active ? h('button.mini', { onclick: () => { for (const b of boxes) { const i = b.querySelector('input'); if (active.members.includes(i.value)) { i.checked = true; chosen.add(i.value); } } } }, t('combat.addParty', { name: active.name })) : null,
      h('div.combat-pick', boxes),
    ] : h('p.muted', t('combat.noSheetsLeft')), { actions: [
      { text: t('common.cancel') },
      ...(options.length ? [{ text: t('combat.add'), primary: true, action: () => addFromSheets([...chosen]) }] : []),
    ] });
  };
  const compDialog = () => {
    const comps = Object.values(inst).filter(p => p.type === 'compendium' && p.system === tb.system).sort((a, b) => byName(a.name, b.name));
    if (!comps.length || !sysRules) { toast(t('combat.noCompendium'), 'error'); return; }
    let chosen = null;
    const selComp = h('select', { 'aria-label': t('type.compendium') }, comps.map(c => h('option', { value: c.id }, c.name)));
    const search = h('input', { type: 'search', placeholder: t('gm.comp.search'), 'aria-label': t('gm.comp.search') });
    const qty = h('input.num', { type: 'number', min: 1, max: 20, value: 1, 'aria-label': t('combat.qty') });
    const list = h('div.choices.comp-list');
    const draw = () => {
      const q = normalize(search.value.trim());
      const all = compendiumEntries(inst[selComp.value]).filter(e => !q || normalize(`${e.name} ${e.tags.join(' ')}`).includes(q)).slice(0, 100);
      list.replaceChildren(...(all.length ? all.map(e => h('label.choice', { class: chosen === e.id ? 'selected' : '' },
        h('input', { type: 'radio', name: 'combat-entry', checked: chosen === e.id, onchange: () => { chosen = e.id; draw(); } }),
        h('span.choice-text', h('strong', e.name), h('span.choice-desc', [t(`gm.comp.kind.${e.kind}`), `${t('sheet.level')} ${fmt(e.level)}`, ...e.tags].join(' · '))))) : [h('p.muted.small', t('gm.comp.none'))]));
    };
    selComp.addEventListener('change', () => { chosen = null; draw(); });
    search.addEventListener('input', draw);
    draw();
    dialog(t('combat.addComp'), [comps.length > 1 ? h('label.field', h('span', t('type.compendium')), selComp) : null, search, list,
      h('label.field', h('span', t('combat.qty')), qty)], { actions: [
      { text: t('common.cancel') },
      { text: t('combat.add'), primary: true, action: async () => {
        if (!chosen) { toast(t('gm.comp.pick'), 'error'); return false; }
        const comp = inst[selComp.value];
        const entry = compendiumEntries(comp).find(e => e.id === chosen);
        const n = Math.max(1, Math.min(20, Math.round(Number(qty.value) || 1)));
        const src = sourceOf({ kind: 'comp', ref: `${comp.id}/${chosen}` });
        const v = src ? cb.fromSheet(src.rules, src.sheet, src.calc) : { hp: null, hpMax: null, conditions: [] };
        await edit(e => {
          for (const name of cb.numberedNames(entry.name, n, existingNames())) {
            if (e.participants.length >= gm.MAX_PARTICIPANTS) break;
            e.participants.push({ id: gm.newCombatId(), kind: 'comp', ref: `${comp.id}/${chosen}`, name, npc: true, init: null, ...v, conditions: [...v.conditions], note: '' });
          }
        });
      } },
    ] });
  };

  // ---------- Initiative and turns ----------
  const rollAll = () => edit(e => {
    let rolled = 0;
    for (const p of e.participants) {
      if (!cb.autoRolls(settings.initiativeAuto, p)) continue;
      const src = sourceOf(p);
      const r = src?.calc ? cb.rollInitiative(src.rules, src.calc) : null;
      if (r) { p.init = r.total; rolled++; }
    }
    cb.sortByInitiative(e);
    toast(rolled ? t('combat.rolled', { n: rolled }) : t('combat.rolledNone'));
  });

  // ---------- Rows ----------
  const condCol = sysRules ? cb.conditionsId(sysRules) : null;
  const condName = key => { const [c, r] = key.split('/'); return sysRules?.entities[c]?.[r]?.name || r; };
  const condOptions = condCol ? Object.values(sysRules.entities[condCol] || {}).sort((a, b) => byName(a.name || a.id, b.name || b.id)) : [];
  const shown = previewOf[tableId] && enc.participants.some(p => p.id === previewOf[tableId]) ? previewOf[tableId] : null;

  const row = (p, i) => {
    const current = enc.started && i === enc.turn;
    const set = fn => edit(e => { const x = e.participants.find(y => y.id === p.id); if (x) fn(x, e); });
    const hpInput = h('input.num.hp-input', { type: 'number', value: p.hp ?? '', 'aria-label': t('combat.hp'), onchange: ev => set(x => { x.hp = ev.target.value === '' ? null : Number(ev.target.value); }) });
    const el = h('div.combat-row', { class: [current ? 'current' : '', shown === p.id ? 'shown' : '', p.hp !== null && p.hp <= 0 ? 'down' : ''].join(' '), draggable: 'true', 'data-id': p.id },
      h('span.turn-mark', { 'aria-label': current ? t('combat.currentTurn') : null }, current ? '▶' : ''),
      h('input.num.init-input', { type: 'number', value: p.init ?? '', placeholder: '—', 'aria-label': t('combat.initiative'), title: t('combat.initiative'),
        onchange: ev => set(x => { x.init = ev.target.value === '' ? null : Number(ev.target.value); }) }),
      h('div.combat-who',
        h('button.link.combat-name', { onclick: () => { previewOf[tableId] = shown === p.id ? null : p.id; redraw(); } }, p.name),
        h('span.muted.small', p.kind === 'member' ? t('combat.kind.member') : p.kind === 'local' ? (p.npc ? t('gm.local.npcBadge') : t('gm.local.badge')) : t('combat.kind.comp')),
        h('div.cond-chips',
          p.conditions.map(k => h('span.cond-chip', condName(k), h('button.icon', { 'aria-label': t('combat.removeCondition', { name: condName(k) }), onclick: () => set(x => { x.conditions = x.conditions.filter(c => c !== k); }) }, '×'))),
          condOptions.length ? h('select.mini.cond-add', { 'aria-label': t('combat.addCondition'), onchange: ev => { const v = ev.target.value; if (v) set(x => { if (!x.conditions.includes(v)) x.conditions.push(v); }); } },
            h('option', { value: '' }, `+ ${t('combat.condition')}`), condOptions.filter(c => !p.conditions.includes(`${condCol}/${c.id}`)).map(c => h('option', { value: `${condCol}/${c.id}` }, c.name || c.id))) : null)),
      h('div.hp-box',
        h('button.mini', { 'aria-label': t('combat.hpMinus'), onclick: () => set(x => { x.hp = (x.hp ?? x.hpMax ?? 0) - 1; }) }, '−'),
        hpInput,
        h('span.muted.small', p.hpMax !== null ? `/ ${fmt(p.hpMax)}` : ''),
        h('button.mini', { 'aria-label': t('combat.hpPlus'), onclick: () => set(x => { x.hp = (x.hp ?? x.hpMax ?? 0) + 1; }) }, '+')),
      h('input.combat-note', { type: 'text', maxlength: 300, value: p.note, placeholder: t('combat.note'), 'aria-label': t('combat.note'), onchange: ev => set(x => { x.note = ev.target.value; }) }),
      // Touch screens cannot drag: up and down buttons there.
      h('div.move-btns',
        h('button.icon', { 'aria-label': t('combat.moveUp', { name: p.name }), disabled: i === 0, onclick: () => edit(e => cb.move(e, p.id, i - 1)) }, '▲'),
        h('button.icon', { 'aria-label': t('combat.moveDown', { name: p.name }), disabled: i === enc.participants.length - 1, onclick: () => edit(e => cb.move(e, p.id, i + 1)) }, '▼')),
      h('button.icon.combat-remove', { 'aria-label': t('combat.remove', { name: p.name }), title: t('combat.remove', { name: p.name }), onclick: () => edit(e => cb.remove(e, p.id)) }, '✕'));
    el.addEventListener('dragstart', ev => { ev.dataTransfer.setData('text/statforge-combat', p.id); ev.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    el.addEventListener('dragover', ev => { if (ev.dataTransfer.types.includes('text/statforge-combat')) { ev.preventDefault(); el.classList.add('drop'); } });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', ev => {
      ev.preventDefault(); el.classList.remove('drop');
      const id = ev.dataTransfer.getData('text/statforge-combat');
      if (id && id !== p.id) edit(e => cb.move(e, id, e.participants.findIndex(x => x.id === p.id)));
    });
    return el;
  };

  const bar = h('div.card.combat-bar',
    h('div.row.spread',
      h('div', h('strong', enc.started ? t('combat.round', { n: enc.round }) : t('combat.notStarted')),
        enc.started && enc.participants[enc.turn] ? h('span.muted.small', ` · ${t('combat.turnOf', { name: enc.participants[enc.turn].name })}`) : null),
      h('div.row',
        h('button.mini', { onclick: sheetsDialog }, t('combat.addSheets')),
        h('button.mini', { onclick: compDialog }, t('combat.addComp')),
        h('button.mini', { onclick: rollAll, title: t(`gm.set.initiative.${settings.initiativeAuto}`) }, t('combat.rollInit')),
        h('button.mini', { onclick: () => edit(e => cb.sortByInitiative(e)) }, t('combat.sort')),
        enc.started ? h('button.mini', { onclick: () => edit(e => cb.prevTurn(e)) }, t('combat.prev')) : null,
        h('button.mini.primary', { onclick: () => edit(e => cb.nextTurn(e)), disabled: !enc.participants.length }, enc.started ? t('combat.next') : t('combat.start')),
        enc.started ? h('button.mini', { onclick: async () => { if (await confirm(t('combat.endTitle'), t('combat.endText'), { yes: t('combat.end') })) edit(e => { e.started = false; e.round = 1; e.turn = 0; }); } }, t('combat.end')) : null)),
    h('p.muted.small', t('combat.help', { roll: sysRules ? cb.initiativeExpr(sysRules) : '1d20' })));

  const listBox = h('div.combat-list', enc.participants.length ? enc.participants.map(row) : h('p.muted', t('combat.empty')));
  const panel = h('aside.combat-preview');
  const layout = h('div.combat-layout', { class: shown ? 'with-preview' : '' }, h('div.card', listBox), shown ? panel : null);
  if (shown) {
    const p = enc.participants.find(x => x.id === shown);
    const src = sourceOf(p);
    if (!src) panel.append(h('div.card', h('p.muted', t('combat.noPreview'))));
    else {
      panel.append(h('div.row.spread.combat-preview-head', h('strong', p.name),
        h('div.row',
          src.local ? h('a.button.mini', { href: `#/sheet/${encodeURIComponent(src.local.id)}` }, t('gm.local.edit')) : null,
          p.kind === 'member' ? h('a.button.mini', { href: `#/gm/${encodeURIComponent(tableId)}/${encodeURIComponent(p.ref)}`, target: '_blank', rel: 'noopener noreferrer' }, t('gm.open')) : null,
          h('button.icon', { 'aria-label': t('common.close'), onclick: () => { previewOf[tableId] = null; redraw(); } }, '✕'))));
      const box = h('div.combat-sheet');
      panel.append(box);
      // Read-only, in the panel: nothing done here is saved anywhere.
      await sheetScreen(box, null, { readOnly: { sheet: src.sheet, owner: src.owner || p.name, back: null, panel: true } });
    }
  }
  return [top, bar, layout];
}
