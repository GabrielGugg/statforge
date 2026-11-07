// ============================================================
// GM mode screens:
//   #/gm                      tables
//   #/gm/<table>              lobby, in tabs: Characters (invite link, team resources, parties, live cards)
//                             Combat (encounters), Tables (roll tables) and Settings (name, refresh rate, initiative, delete)
//   #/gm/<table>/<file>       one shared sheet, read-only
// Everything a player sent is shown with h() (textContent), never as HTML.
// ============================================================
import * as db from '../storage.js';
import * as pk from '../packages.js';
import * as gm from '../gm.js';
import * as sync from '../sync.js';
import { makeInvite, packageMismatches } from '../engine/share.js';
import { compareVersions } from '../engine/package.js';
import { findUpdates } from './updates.js';
import { compute } from '../engine/calc.js';
import { partyValue, checkPartyFormula } from '../engine/party.js';
import { entries as compendiumEntries, ENTRY_KINDS } from '../engine/compendium.js';
import { t } from '../i18n.js';
import { h, toast, confirm, ask, dialog, fmt, byName, normalize } from './util.js';
import { sheetScreen } from './sheet.js';
import { combatTab } from './combat.js';
import { rollTablesTab } from './tables.js';

let poll = null;
const lobbyTab = {}; // the tab open in each table's lobby, while the app is open
window.addEventListener('hashchange', () => { clearTimeout(poll); poll = null; });

const ago = iso => {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? t('gm.agoSec', { n: s }) : s < 3600 ? t('gm.agoMin', { n: Math.round(s / 60) }) : new Date(iso).toLocaleString();
};
const errText = e => {
  if (e.detail === 'cannotDownloadFile') return t('gm.err.cannotDownload');
  const k = `gm.err.${e.message}`, k2 = `share.err.${e.message}`;
  const x = t(k) !== k ? t(k) : t(k2) !== k2 ? t(k2) : e.message;
  return e.detail ? `${x} [${e.detail}]` : x;
};

async function signInBox(onDone) {
  return h('div.alert', t('gm.needGoogle'), ' ',
    h('button.mini.primary', { onclick: async () => { try { await sync.ensureFileAccess({ interactive: true }); onDone(); } catch (e) { toast(errText(e), 'error'); } } }, t('gm.signIn')));
}

export async function gmScreen(app, tableId, fileId) {
  if (tableId && fileId) return memberSheet(app, decodeURIComponent(tableId), decodeURIComponent(fileId));
  if (tableId) return lobby(app, decodeURIComponent(tableId));
  return tablesScreen(app);
}

// ---------- Tables ----------
async function tablesScreen(app) {
  if (await gm.pullTables().catch(() => false)) { /* newer copy from another device */ }
  const list = (await gm.tables()).sort((a, b) => byName(a.name, b.name));
  const inst = await pk.installed();
  const systems = Object.values(inst).filter(p => p.type === 'system').sort((a, b) => byName(a.name, b.name));
  const name = h('input', { type: 'text', maxlength: 80, placeholder: t('gm.tableNamePh'), 'aria-label': t('gm.tableName') });
  const system = h('select', { 'aria-label': t('gm.system') }, systems.map(s => h('option', { value: s.id }, s.name)));
  app.append(...[
    h('div.card',
      h('h2', t('gm.title')),
      h('p.muted', t('gm.intro'))),
    h('div.card',
      h('h3', t('gm.newTable')),
      systems.length ? [
        h('label.field', h('span', t('gm.tableName')), name),
        h('label.field', h('span', t('gm.system')), system),
        h('button.primary', { onclick: async () => {
          if (!name.value.trim()) { name.focus(); return; }
          const tb = await gm.createTable({ name: name.value, system: system.value });
          location.hash = `#/gm/${encodeURIComponent(tb.id)}`;
        } }, t('gm.create')),
      ] : h('p', t('new.needSystem'), ' ', h('a', { href: '#/packages' }, t('new.goPackages')))),
    list.length ? h('div.card', h('h3', t('gm.yourTables')), h('div.choices', list.map(tb => h('a.choice', { href: `#/gm/${encodeURIComponent(tb.id)}` },
      h('span.choice-text', h('strong', tb.name), h('span.choice-desc', `${inst[tb.system]?.name || tb.system} · ${t('gm.nSheets', { n: tb.members.length })}`)))))) : null].filter(Boolean));
}

// ---------- Lobby ----------
async function lobby(app, tableId) {
  const tb = await gm.table(tableId);
  if (!tb) { app.append(h('div.card', h('p', t('gm.notFound')), h('a.button', { href: '#/gm' }, t('common.back')))); return; }
  let inst = await pk.installed();
  let every = await gm.interval(tableId);
  let last = null;
  lobbyTab[tableId] ||= 'characters';

  async function draw() {
    const fresh = await gm.table(tableId);
    if (!fresh) return;
    const token = await sync.accessToken();
    const email = await db.getConfig('syncEmail', '');
    const base = location.href.split('#')[0];
    const invite = email ? makeInvite(base, { email, table: fresh.name, system: fresh.system }) : '';
    const loaded = [];
    for (const m of fresh.members) loaded.push(await loadMember(fresh, m, inst));
    for (const ls of (await gm.localSheets(tableId)).sort((a, b) => byName(a.name || '', b.name || ''))) loaded.push(await loadLocal(ls, inst));
    const byId = Object.fromEntries(loaded.map(x => [x.m.fileId, x]));
    const parties = fresh.parties || [];
    const resources = teamResources(fresh, inst);
    const valuesFor = pt => {
      const calcs = pt.members.map(id => byId[id]).filter(x => x?.calc).map(x => ({ name: x.c.sheet.name || '?', calc: x.calc }));
      return resources.map(r => ({ r, ...partyValue(r.formula, calcs) }));
    };
    const chipsFor = pt => h('div.stat-chips.party-chips', valuesFor(pt).map(({ r, value, errors }) =>
      h('span.stat-chip', { class: errors.length ? 'party-err' : '', title: [r.description, r.formula, ...errors].filter(Boolean).join('\n') }, h('span', r.name), h('strong', value === null ? '—' : fmt(Math.round(value * 100) / 100)))));
    const card = x => memberCard(fresh, x, parties, inst, draw);
    const dropZone = (partyId, el) => {
      el.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/statforge-member')) { e.preventDefault(); el.classList.add('drop'); } });
      el.addEventListener('dragleave', () => el.classList.remove('drop'));
      el.addEventListener('drop', async e => {
        e.preventDefault(); el.classList.remove('drop');
        const id = e.dataTransfer.getData('text/statforge-member');
        if (id) { await gm.assignMember(tableId, id, partyId); draw(); }
      });
      return el;
    };
    const active = parties.find(p => p.id === fresh.activeParty);
    const partyBox = pt => dropZone(pt.id, h('section.gm-party', { class: pt.id === fresh.activeParty ? 'active' : '' },
      h('div.row.spread',
        h('h4', pt.name, ' ', pt.id === fresh.activeParty ? h('span.badge', t('gm.activeParty')) : null),
        h('div.row',
          pt.id === fresh.activeParty ? null : h('button.mini', { onclick: async () => { await gm.setActiveParty(tableId, pt.id); draw(); } }, t('gm.makeActive')),
          h('button.mini', { onclick: async () => { const n = await ask(t('gm.renameParty'), t('gm.partyName'), pt.name); if (n) { await gm.renameParty(tableId, pt.id, n); draw(); } } }, t('gm.rename')),
          h('button.mini.danger', { onclick: async () => {
            if (await confirm(t('gm.deletePartyTitle'), t('gm.deletePartyText', { name: pt.name }), { yes: t('gm.deleteShort'), danger: true })) { await gm.deleteParty(tableId, pt.id); draw(); }
          } }, t('gm.deleteShort')))),
      resources.length ? chipsFor(pt) : null,
      pt.members.length ? h('div.gm-grid', pt.members.map(id => byId[id]).filter(Boolean).map(card)) : h('p.muted.small', t('gm.partyEmpty'))));
    const loose = loaded.filter(x => !gm.partyOf(fresh, x.m.fileId));
    // Players already on a newer version of a package the GM has: offer to update the GM's own copy.
    const newer = {};
    for (const x of loaded) for (const p of x.c?.packages || []) {
      const have = inst[p.id]?.version;
      if (have && p.version && compareVersions(p.version, have) > 0 && compareVersions(p.version, newer[p.id]?.version || '0') > 0) newer[p.id] = { id: p.id, version: p.version, have, name: inst[p.id].name || p.id };
    }
    const newerList = Object.values(newer);
    const updateBox = newerList.length ? h('div.alert.warning',
      h('p', t('gm.newerPackages', { n: newerList.length })),
      h('ul.small', newerList.map(p => h('li', `${p.name}: v${p.have} → v${p.version}`))),
      h('button.primary', { onclick: async e => {
        e.target.disabled = true;
        const failed = await updateOwnPackages(newerList.map(p => p.id));
        inst = await pk.installed();
        const still = newerList.filter(p => !failed.includes(p.id) && compareVersions(p.version, inst[p.id]?.version || '0') > 0).map(p => p.name);
        if (failed.length) toast(t('gm.updateFailed', { list: failed.join(', ') }), 'error');
        else if (still.length) toast(t('gm.updateNotYet', { list: still.join(', ') }), 'error');
        else toast(t('gm.updated2'));
        draw();
      } }, t('gm.updateMine'))) : null;

    const tabs = [['characters', t('gm.tab.characters')], ['combat', t('gm.tab.combat')], ['tables', t('gm.tab.tables')], ['settings', t('gm.tab.settings')]];
    const tabBar = h('div.tabs.gm-tabs', { role: 'tablist' }, tabs.map(([id, label]) => h('button', { role: 'tab', 'aria-selected': String(lobbyTab[tableId] === id),
      onclick: () => { lobbyTab[tableId] = id; draw(); } }, label)));
    const header = h('div.card.gm-head',
      h('h2', fresh.name),
      h('p.muted', inst[fresh.system]?.name || fresh.system),
      tabBar);
    if (lobbyTab[tableId] === 'combat') {
      const y = window.scrollY;
      const parts = await combatTab({ tb: fresh, inst, loaded, redraw: draw });
      app.replaceChildren(header, ...parts);
      window.scrollTo(0, y);
      return;
    }
    if (lobbyTab[tableId] === 'tables') {
      const y = window.scrollY;
      app.replaceChildren(header, ...rollTablesTab({ tb: fresh, redraw: draw }));
      window.scrollTo(0, y);
      return;
    }
    if (lobbyTab[tableId] === 'settings') {
      app.replaceChildren(header, ...settingsTab(fresh, await gm.interval(null), async () => { every = await gm.interval(tableId); draw(); }));
      return;
    }
    app.replaceChildren(
      header,
      h('div.card',
        h('h3', t('gm.invite')),
        invite ? [
          h('p.small', t('gm.inviteHelp')),
          h('div.row', h('input.invite-link', { type: 'text', readOnly: true, value: invite, 'aria-label': t('gm.invite'), onfocus: e => e.target.select() }),
            h('button.primary', { onclick: async () => { try { await navigator.clipboard.writeText(invite); toast(t('gm.copied')); } catch { toast(t('gm.copyFail'), 'error'); } } }, t('gm.copy'))),
          h('p.muted.small', t('gm.inviteEmail', { email })),
        ] : await signInBox(draw)),
      h('div.card.gm-resources',
        h('div.row.spread', h('h3', t('gm.teamResources')),
          h('button.mini', { onclick: () => resourceDialog(tableId, null, draw) }, t('gm.newResource'))),
        active && resources.length ? h('div.gm-active', h('div.muted.small', t('gm.activeIs', { name: active.name })), chipsFor(active)) : null,
        !parties.length ? h('p.muted.small', t('gm.noPartiesHint')) : null,
        resources.length ? h('ul.gm-res-list', resources.map(r => h('li',
          h('strong', r.name), ' ', h('code', r.formula), ' ',
          r.fromPackage ? h('span.badge', t('gm.fromSystem')) : [
            h('button.mini', { onclick: () => resourceDialog(tableId, r, draw) }, t('gm.edit')),
            h('button.mini.danger', { onclick: async () => {
              if (await confirm(t('gm.deleteResTitle'), t('gm.deleteResText', { name: r.name }), { yes: t('gm.deleteShort'), danger: true })) { await gm.deleteResource(tableId, r.id); draw(); }
            } }, t('gm.deleteShort')),
          ]))) : h('p.muted.small', t('gm.noResources'))),
      h('div.card',
        h('div.row.spread', h('h3', t('gm.sheets')),
          h('div.row',
            h('button.mini', { onclick: () => cardsDialog(fresh, inst, draw) }, t('gm.cards')),
            h('button.mini', { onclick: async () => {
              const n = await ask(t('gm.newParty'), t('gm.partyName'), t('gm.partyDefault', { n: parties.length + 1 }));
              if (n) { try { await gm.createParty(tableId, n); draw(); } catch (e) { toast(errText(e), 'error'); } }
            } }, t('gm.newParty')),
            h('button.mini', { onclick: () => { location.hash = `#/new/${encodeURIComponent(tableId)}`; } }, t('gm.local.new')),
            compendiumsFor(fresh, inst).length ? h('button.mini', { onclick: () => compendiumDialog(fresh, inst, draw) }, t('gm.comp.add')) : null,
            h('button.primary', { onclick: async () => {
              try {
                const ids = await gm.pickSharedFiles();
                if (!ids.length) return;
                const rep = await gm.addMembers(tableId, ids);
                const ok = rep.filter(r => !r.error), bad = rep.filter(r => r.error);
                if (ok.length) toast(t('gm.added', { n: ok.length }));
                if (bad.length) toast(bad.map(r => errText(Object.assign(new Error(r.error), { detail: r.detail }))).join(' · '), 'error');
                draw();
              } catch (e) { toast(errText(e), 'error'); }
            } }, t('gm.addSheets')))),
        token ? null : await signInBox(() => { refresh(true); }),
        updateBox,
        !loaded.length ? h('p.muted', t('gm.noSheets')) : null,
        ...parties.map(partyBox),
        loaded.length ? dropZone(null, h('section.gm-party.loose',
          parties.length ? h('h4', t('gm.noParty')) : null,
          loose.length ? h('div.gm-grid', loose.map(card)) : h('p.muted.small', t('gm.allInParties')))) : null,
        h('p.muted.small', last ? t('gm.status', { when: ago(last), n: every }) : t('gm.statusFirst', { n: every }), ' ',
          h('button.mini', { onclick: () => refresh(true) }, t('gm.refreshNow')))));
  }

  async function refresh(now = false) {
    clearTimeout(poll);
    every = await gm.interval(tableId);
    if (!location.hash.startsWith(`#/gm/${encodeURIComponent(tableId)}`) || location.hash.split('/').length > 3) return;
    if (now || document.visibilityState === 'visible') {
      try { const r = await gm.refreshTable(tableId); if (!r.offline) last = new Date().toISOString(); } catch (e) { toast(errText(e), 'error'); }
      if (lobbyTab[tableId] === 'characters' && !document.activeElement?.matches('input:not([readonly]), textarea, select')) await draw();
    }
    poll = setTimeout(() => refresh(), every * 1000);
  }
  await draw();
  refresh();
}

/** The table's own settings: name, how often to check the sheets, initiative, delete. All saved per table. */
function settingsTab(tb, fallback, redraw) {
  const st = gm.settingsOf(tb);
  const saved = () => toast(t('settings.saved'));
  const intervalInput = h('input', { type: 'number', min: gm.MIN_INTERVAL, max: gm.MAX_INTERVAL, step: 5, value: st.interval ?? '',
    placeholder: String(fallback), 'aria-label': t('gm.set.interval'),
    onchange: async e => {
      const raw = e.target.value.trim();
      const s = await gm.saveSettings(tb.id, { interval: raw === '' ? null : raw });
      e.target.value = s.interval ?? '';
      saved(); redraw();
    } });
  const initSel = h('select', { 'aria-label': t('gm.set.initiativeAuto'), onchange: async e => { await gm.saveSettings(tb.id, { initiativeAuto: e.target.value }); saved(); } },
    gm.INITIATIVE_AUTO.map(v => h('option', { value: v, selected: v === st.initiativeAuto }, t(`gm.set.initiative.${v}`))));
  return [
    h('section.card.section',
      h('h3', t('gm.set.table')),
      h('div.row', h('span', h('strong', tb.name)), h('button.mini', { onclick: async () => { const n = await ask(t('gm.rename'), t('gm.tableName'), tb.name); if (n) { await gm.renameTable(tb.id, n); redraw(); } } }, t('gm.rename')))),
    h('section.card.section',
      h('h3', t('gm.set.sync')),
      h('label.field', h('span', t('gm.set.interval')), intervalInput),
      h('p.muted.small', t('gm.set.intervalHint', { min: gm.MIN_INTERVAL, max: gm.MAX_INTERVAL, def: fallback }))),
    h('section.card.section',
      h('h3', t('gm.set.combat')),
      h('label.field', h('span', t('gm.set.initiativeAuto')), initSel),
      h('p.muted.small', t('gm.set.initiativeHint'))),
    h('section.card.section.danger-zone',
      h('h3', t('gm.set.danger')),
      h('p.small', t('gm.set.deleteHint')),
      h('button.danger', { onclick: async () => {
        if (await confirm(t('gm.deleteTitle'), t('gm.deleteText', { name: tb.name }), { yes: t('gm.delete'), danger: true })) { await gm.deleteTable(tb.id); location.hash = '#/gm'; }
      } }, t('gm.delete'))),
  ];
}

/** Updates the GM's own packages: from the link each was installed from, or else from the Hub. Returns the ids that failed. */
async function updateOwnPackages(ids) {
  const failed = [];
  let hub = null;
  for (const id of ids) {
    try {
      const mine = (await pk.installed())[id];
      if (mine?._source) { await pk.update(id); continue; }
      hub ||= await findUpdates().catch(() => []);
      const u = hub.find(x => x.pkg.id === id);
      if (!u) throw new Error('no source');
      await pk.installFromLink(u.link);
    } catch { failed.push(id); }
  }
  return failed;
}

/** The values shown on the cards: the GM's choice, or every resource of the system. */
function cardStats(tb, rules) {
  if (Array.isArray(tb.cardStats)) return tb.cardStats;
  return Object.keys(rules?.resources || {}).map(id => `resources/${id}`);
}

/** The GM picks what the cards show, from the system package's lists. */
function cardsDialog(tb, inst, onDone) {
  const sys = inst[tb.system];
  if (!sys) { toast(t('gm.missingSystem', { id: tb.system }), 'error'); return; }
  const chosen = new Set(cardStats(tb, { resources: Object.fromEntries((sys.resources || []).map(r => [r.id, r])) }));
  const groups = gm.CARD_SECTIONS.filter(sec => Array.isArray(sys[sec]) && sys[sec].length).map(sec => h('details.cards-group', { open: sec === 'resources' || [...chosen].some(k => k.startsWith(`${sec}/`)) },
    h('summary', t(`gm.section.${sec}`)),
    h('div.cards-options', sys[sec].filter(x => x?.id).map(x => h('label.check',
      h('input', { type: 'checkbox', checked: chosen.has(`${sec}/${x.id}`), onchange: e => { if (e.target.checked) chosen.add(`${sec}/${x.id}`); else chosen.delete(`${sec}/${x.id}`); } }),
      String(x.name || x.id))))));
  dialog(t('gm.cardsTitle'), [h('p.small', t('gm.cardsHelp')), ...groups], { actions: [
    { text: t('gm.cardsDefault'), action: async () => { await gm.setCardStats(tb.id, null); onDone(); } },
    { text: t('common.cancel') },
    { text: t('common.save'), primary: true, action: async () => {
      const order = gm.CARD_SECTIONS.flatMap(sec => (sys[sec] || []).map(x => `${sec}/${x.id}`)); // the package's order
      await gm.setCardStats(tb.id, order.filter(k => chosen.has(k)));
      onDone();
    } },
  ] });
}

/** The system package's team resources (read-only) followed by the GM's own. */
function teamResources(tb, inst) {
  const fromPkg = (inst[tb.system]?.party?.resources || [])
    .filter(r => r && typeof r.formula === 'string' && r.name)
    .map(r => ({ id: `pkg:${r.id}`, name: String(r.name), formula: r.formula, description: typeof r.description === 'string' ? r.description : '', fromPackage: true }));
  return [...fromPkg, ...(tb.resources || [])];
}

const compendiumsFor = (tb, inst) => Object.values(inst).filter(p => p.type === 'compendium' && p.system === tb.system).sort((a, b) => byName(a.name, b.name));

/** Picks an entry of an installed compendium and makes it a local sheet (NPC) of the table. */
function compendiumDialog(tb, inst, onDone) {
  const comps = compendiumsFor(tb, inst);
  let chosen = null;
  const selComp = h('select', { 'aria-label': t('type.compendium') }, comps.map(c => h('option', { value: c.id }, `${c.name} (v${c.version || '0'})`)));
  const selKind = h('select', { 'aria-label': t('gm.comp.kind') }, h('option', { value: '' }, t('gm.comp.allKinds')), ENTRY_KINDS.map(k => h('option', { value: k }, t(`gm.comp.kind.${k}`))));
  const search = h('input', { type: 'search', placeholder: t('gm.comp.search'), 'aria-label': t('gm.comp.search') });
  const list = h('div.choices.comp-list');
  const detail = h('div.small');
  const draw = () => {
    const comp = inst[selComp.value];
    const q = normalize(search.value.trim());
    const all = compendiumEntries(comp).filter(e => (!selKind.value || e.kind === selKind.value) && (!q || normalize(`${e.name} ${e.tags.join(' ')}`).includes(q)));
    const shown = all.slice(0, 100);
    list.replaceChildren(...(shown.length ? shown.map(e => h('label.choice', { class: chosen === e.id ? 'selected' : '' },
      h('input', { type: 'radio', name: 'comp-entry', checked: chosen === e.id, onchange: () => { chosen = e.id; draw(); } }),
      h('span.choice-text', h('strong', e.name),
        h('span.choice-desc', [t(`gm.comp.kind.${e.kind}`), `${t('sheet.level')} ${fmt(e.level)}`, ...e.tags].join(' · '))))) : [h('p.muted.small', t('gm.comp.none'))]),
      all.length > shown.length ? h('p.muted.small', t('gm.comp.more', { n: all.length - shown.length })) : '');
    const e = all.find(x => x.id === chosen);
    detail.replaceChildren(e?.description ? h('p.pre-line', e.description) : '');
  };
  selComp.addEventListener('change', () => { chosen = null; draw(); });
  selKind.addEventListener('change', draw);
  search.addEventListener('input', draw);
  draw();
  dialog(t('gm.comp.add'), [
    comps.length > 1 ? h('label.field', h('span', t('type.compendium')), selComp) : null,
    h('div.row', search, selKind), list, detail,
  ], { actions: [
    { text: t('common.cancel') },
    { text: t('gm.comp.create'), primary: true, action: async () => {
      if (!chosen) { toast(t('gm.comp.pick'), 'error'); return false; }
      try {
        const comp = inst[selComp.value];
        const { rules } = await pk.rulesForSheet({ system: tb.system, extensions: [] });
        const { sheet, missing } = await gm.localFromEntry(tb.id, rules, comp, chosen, { versions: { [tb.system]: inst[tb.system]?.version || '0' } });
        toast(missing.length ? t('gm.comp.missing', { name: sheet.name, list: missing.join(', ') }) : t('gm.comp.created', { name: sheet.name }), missing.length ? 'warning' : 'ok');
        onDone();
      } catch (e) { toast(errText(e), 'error'); return false; }
    } },
  ] });
}

/** A GM's local sheet, shaped like a shared one so cards and parties treat both alike. */
async function loadLocal(sheet, inst) {
  let rules = null, calc = null;
  if (inst[sheet.system]) {
    try { ({ rules } = await pk.rulesForSheet(sheet)); calc = compute(rules, sheet); } catch { rules = calc = null; }
  }
  return { m: { fileId: gm.localKey(sheet.id), name: sheet.name }, c: { sheet, packages: [] }, rules, calc, local: sheet };
}

/** Reads the cached copy and calculates it once with the GM's packages. */
async function loadMember(tb, m, inst) {
  const c = await gm.cached(tb.id, m.fileId);
  let rules = null, calc = null;
  if (c && inst[c.sheet.system]) {
    try { ({ rules } = await pk.rulesForSheet(c.sheet)); calc = compute(rules, c.sheet); } catch { rules = calc = null; }
  }
  return { m, c, rules, calc };
}

function resourceDialog(tableId, r, onDone) {
  const name = h('input', { type: 'text', maxlength: 60, value: r?.name || '', placeholder: t('gm.resNamePh') });
  const formula = h('textarea', { rows: 3, maxlength: 500, value: r?.formula || '', placeholder: "min(members('agi'))", spellcheck: false });
  if (r?.formula) formula.value = r.formula;
  const msg = h('p.small');
  const check = () => {
    try { checkPartyFormula(formula.value); msg.textContent = ''; msg.className = 'small'; return true; }
    catch (e) { const u = /^unknown: (.*)$/.exec(e.message); msg.textContent = u ? t('gm.unknownName', { names: u[1] }) : e.message === 'empty' ? t('gm.err.RESOURCE_INCOMPLETE') : t('gm.badFormula', { error: e.message }); msg.className = 'small error-text'; return false; }
  };
  formula.addEventListener('input', () => { if (msg.textContent) check(); });
  dialog(r ? t('gm.editResource') : t('gm.newResource'), [
    h('label.field', h('span', t('gm.resName')), name),
    h('label.field', h('span', t('gm.resFormula')), formula),
    msg,
    h('details.small', h('summary', t('gm.formulaHelpTitle')), h('ul', ['members', 'sum', 'count', 'size', 'example1', 'example2'].map(k => h('li', t(`gm.formulaHelp.${k}`))))),
  ], { actions: [
    { text: t('common.cancel') },
    { text: t('common.save'), primary: true, action: async () => {
      if (!name.value.trim()) { name.focus(); return false; }
      if (!check()) return false;
      try { await gm.saveResource(tableId, { id: r?.id, name: name.value, formula: formula.value }); onDone(); }
      catch (e) { toast(errText(e), 'error'); return false; }
    } },
  ] });
}

function memberCard(tb, { m, c, rules, calc, local }, parties, inst, redraw) {
  const href = local ? `#/sheet/${encodeURIComponent(local.id)}` : `#/gm/${encodeURIComponent(tb.id)}/${encodeURIComponent(m.fileId)}`;
  const remove = local
    ? h('button.mini.danger', { onclick: async () => {
      if (await confirm(t('gm.local.deleteTitle'), t('gm.local.deleteText', { name: local.name || t('common.unnamed') }), { yes: t('gm.deleteShort'), danger: true })) { await gm.removeLocal(tb.id, local.id); redraw(); }
    } }, t('gm.deleteShort'))
    : h('button.mini', { onclick: async () => {
      if (await confirm(t('gm.removeTitle'), t('gm.removeText'), { yes: t('gm.remove') })) { await gm.removeMember(tb.id, m.fileId); redraw(); }
    } }, t('gm.remove'));
  const copy = !local && c ? h('button.mini', { title: t('gm.local.copyHint'), onclick: async () => {
    const n = await ask(t('gm.local.copy'), t('gm.local.copyName'), t('gm.local.copyDefault', { name: c.sheet.name || t('common.unnamed') }));
    if (!n) return;
    try { await gm.copyToLocal(tb.id, m.fileId, { name: n }); toast(t('gm.local.copied')); redraw(); } catch (e) { toast(errText(e), 'error'); }
  } }, t('gm.local.copy')) : null;
  const current = gm.partyOf(tb, m.fileId)?.id || '';
  const move = parties.length ? h('select.mini', { 'aria-label': t('gm.moveTo'), onchange: async e => { await gm.assignMember(tb.id, m.fileId, e.target.value || null); e.target.blur(); redraw(); } },
    h('option', { value: '', selected: !current }, t('gm.noParty')),
    parties.map(p => h('option', { value: p.id, selected: p.id === current }, p.name))) : null;
  const drag = { draggable: 'true', ondragstart: e => { e.dataTransfer.setData('text/statforge-member', m.fileId); e.dataTransfer.effectAllowed = 'move'; } };
  if (!c) {
    return h('div.card.gm-card', drag, h('strong', m.name || t('gm.unknownSheet')), m.owner ? h('div.muted.small', m.owner) : null,
      h('span.badge.error', m.state === 'lost' ? t('gm.lost') : t('gm.notLoaded')), h('div.row', move, remove));
  }
  const miss = local ? [] : packageMismatches(c.packages, inst);
  const chips = [];
  if (calc) {
    for (const key of cardStats(tb, rules)) {
      const [sec, id] = key.split('/');
      const def = rules[sec]?.[id];
      if (!def) continue;
      try {
        const max = calc.value(id);
        const label = def.abbr || def.name || id;
        const shown = sec === 'resources' && def.display !== 'card' ? `${fmt(c.sheet.resources?.[id] ?? max)}/${fmt(max)}` : fmt(max);
        chips.push(h('span.stat-chip', { title: def.name || id }, h('span', label), h('strong', shown)));
      } catch { /* skip a value that fails */ }
    }
  }
  return h('div.card.gm-card', drag,
    h('div.row.spread', h('strong', c.sheet.name || t('common.unnamed')),
      local ? h('span.badge.local', local.gm?.npc ? t('gm.local.npcBadge') : t('gm.local.badge'))
        : m.state === 'lost' ? h('span.badge.error', t('gm.lost')) : m.state === 'error' ? h('span.badge.warning', t('gm.error')) : null),
    local ? h('div.muted.small', local.gm?.from ? t('gm.local.copyOf') : local.gm?.compendium ? t('gm.local.fromComp', { name: inst[local.gm.compendium.id]?.name || local.gm.compendium.id }) : t('gm.local.yours'))
      : h('div.muted.small', `${c.owner?.name || c.owner?.email || ''}${c.owner?.email && c.owner?.name ? ` · ${c.owner.email}` : ''}`),
    h('div.muted.small', local ? `${t('sheet.level')} ${fmt(c.sheet.level || 1)}` : `${t('sheet.level')} ${fmt(c.sheet.level || 1)} · ${t('gm.updated', { when: ago(c.modifiedTime) })}`),
    !inst[c.sheet.system] ? h('div.badge.error', t('gm.missingSystem', { id: c.sheet.system })) : miss.length ? h('div.badge.warning', { title: miss.map(p => `${p.id}: ${p.version || '?'} / ${p.have || '—'}`).join('\n') }, t('gm.versionMismatch', { n: miss.length })) : null,
    chips.length ? h('div.stat-chips', chips) : null,
    h('div.row', h('a.button.mini.primary', local ? { href } : { href, target: '_blank', rel: 'noopener noreferrer' }, local ? t('gm.local.edit') : t('gm.open')), copy, move, remove));
}

// ---------- One shared sheet, read-only ----------
async function memberSheet(app, tableId, fileId) {
  const c = await gm.cached(tableId, fileId);
  const back = `#/gm/${encodeURIComponent(tableId)}`;
  if (!c) { app.append(h('div.card', h('p', t('gm.notLoaded')), h('a.button', { href: back }, t('gm.backToTable')))); return; }
  await sheetScreen(app, null, { readOnly: { sheet: c.sheet, owner: c.owner?.name || c.owner?.email, back } });
  // keep it fresh while it is open
  const tick = async () => {
    if (location.hash !== `${back}/${encodeURIComponent(fileId)}`) return;
    const before = c.modifiedTime;
    await gm.refreshTable(tableId).catch(() => {});
    const now = await gm.cached(tableId, fileId);
    if (now && now.modifiedTime !== before && !document.querySelector('.dialog-backdrop')) {
      const y = window.scrollY;
      app.replaceChildren();
      await sheetScreen(app, null, { readOnly: { sheet: now.sheet, owner: now.owner?.name || now.owner?.email, back } });
      window.scrollTo(0, y);
      Object.assign(c, now);
    }
    poll = setTimeout(tick, (await gm.interval(tableId)) * 1000);
  };
  poll = setTimeout(tick, (await gm.interval(tableId)) * 1000);
}
