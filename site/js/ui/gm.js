// ============================================================
// GM mode screens:
//   #/gm                      tables
//   #/gm/<table>              lobby: invite link, shared sheets (live cards)
//   #/gm/<table>/<file>       one shared sheet, read-only
// Everything a player sent is shown with h() (textContent), never as HTML.
// ============================================================
import * as db from '../storage.js';
import * as pk from '../packages.js';
import * as gm from '../gm.js';
import * as sync from '../sync.js';
import { makeInvite, packageMismatches } from '../engine/share.js';
import { compute } from '../engine/calc.js';
import { t } from '../i18n.js';
import { h, toast, confirm, ask, fmt, byName } from './util.js';
import { sheetScreen } from './sheet.js';

let poll = null;
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
  const inst = await pk.installed();
  const every = await gm.interval();
  let last = null;

  async function draw() {
    const fresh = await gm.table(tableId);
    if (!fresh) return;
    const token = await sync.accessToken();
    const email = await db.getConfig('syncEmail', '');
    const base = location.href.split('#')[0];
    const invite = email ? makeInvite(base, { email, table: fresh.name, system: fresh.system }) : '';
    const cards = [];
    for (const m of fresh.members) cards.push(await memberCard(fresh, m, inst));
    app.replaceChildren(
      h('div.card',
        h('div.row.spread', h('h2', fresh.name), h('div.row',
          h('button.mini', { onclick: async () => { const n = await ask(t('gm.rename'), t('gm.tableName'), fresh.name); if (n) { await gm.renameTable(tableId, n); draw(); } } }, t('gm.rename')),
          h('button.mini.danger', { onclick: async () => {
            if (await confirm(t('gm.deleteTitle'), t('gm.deleteText', { name: fresh.name }), { yes: t('gm.delete'), danger: true })) { await gm.deleteTable(tableId); location.hash = '#/gm'; }
          } }, t('gm.delete')))),
        h('p.muted', inst[fresh.system]?.name || fresh.system)),
      h('div.card',
        h('h3', t('gm.invite')),
        invite ? [
          h('p.small', t('gm.inviteHelp')),
          h('div.row', h('input.invite-link', { type: 'text', readOnly: true, value: invite, 'aria-label': t('gm.invite'), onfocus: e => e.target.select() }),
            h('button.primary', { onclick: async () => { try { await navigator.clipboard.writeText(invite); toast(t('gm.copied')); } catch { toast(t('gm.copyFail'), 'error'); } } }, t('gm.copy'))),
          h('p.muted.small', t('gm.inviteEmail', { email })),
        ] : await signInBox(draw)),
      h('div.card',
        h('div.row.spread', h('h3', t('gm.sheets')),
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
          } }, t('gm.addSheets'))),
        token ? null : await signInBox(() => { refresh(true); }),
        cards.length ? h('div.gm-grid', cards) : h('p.muted', t('gm.noSheets')),
        h('p.muted.small', last ? t('gm.status', { when: ago(last), n: every }) : t('gm.statusFirst', { n: every }), ' ',
          h('button.mini', { onclick: () => refresh(true) }, t('gm.refreshNow')))));
  }

  async function refresh(now = false) {
    clearTimeout(poll);
    if (!location.hash.startsWith(`#/gm/${encodeURIComponent(tableId)}`) || location.hash.split('/').length > 3) return;
    if (now || document.visibilityState === 'visible') {
      try { const r = await gm.refreshTable(tableId); if (!r.offline) last = new Date().toISOString(); } catch (e) { toast(errText(e), 'error'); }
      if (!document.activeElement?.matches('input:not([readonly]), textarea, select')) await draw();
    }
    poll = setTimeout(() => refresh(), every * 1000);
  }
  await draw();
  refresh();
}

async function memberCard(tb, m, inst) {
  const c = await gm.cached(tb.id, m.fileId);
  const href = `#/gm/${encodeURIComponent(tb.id)}/${encodeURIComponent(m.fileId)}`;
  const remove = h('button.mini', { onclick: async () => {
    if (await confirm(t('gm.removeTitle'), t('gm.removeText'), { yes: t('gm.remove') })) { await gm.removeMember(tb.id, m.fileId); window.dispatchEvent(new HashChangeEvent('hashchange')); }
  } }, t('gm.remove'));
  if (!c) {
    return h('div.card.gm-card', h('strong', m.name || t('gm.unknownSheet')), m.owner ? h('div.muted.small', m.owner) : null,
      h('span.badge.error', m.state === 'lost' ? t('gm.lost') : t('gm.notLoaded')), h('div.row', remove));
  }
  const chips = [];
  const miss = packageMismatches(c.packages, inst);
  try {
    if (!inst[c.sheet.system]) throw new Error('missing');
    const { rules } = await pk.rulesForSheet(c.sheet);
    const calc = compute(rules, c.sheet);
    for (const r of Object.values(rules.resources)) {
      const max = calc.value(r.id);
      const cur = c.sheet.resources?.[r.id] ?? max;
      chips.push(h('span.stat-chip', { title: r.name }, h('span', r.abbr || r.name), h('strong', r.display === 'card' ? fmt(max) : `${fmt(cur)}/${fmt(max)}`)));
    }
  } catch { /* no system package: the card still shows the name */ }
  return h('div.card.gm-card',
    h('div.row.spread', h('strong', c.sheet.name || t('common.unnamed')), m.state === 'lost' ? h('span.badge.error', t('gm.lost')) : m.state === 'error' ? h('span.badge.warning', t('gm.error')) : null),
    h('div.muted.small', `${c.owner?.name || c.owner?.email || ''}${c.owner?.email && c.owner?.name ? ` · ${c.owner.email}` : ''}`),
    h('div.muted.small', `${t('sheet.level')} ${fmt(c.sheet.level || 1)} · ${t('gm.updated', { when: ago(c.modifiedTime) })}`),
    !inst[c.sheet.system] ? h('div.badge.error', t('gm.missingSystem', { id: c.sheet.system })) : miss.length ? h('div.badge.warning', { title: miss.map(p => `${p.id}: ${p.version || '?'} / ${p.have || '—'}`).join('\n') }, t('gm.versionMismatch', { n: miss.length })) : null,
    chips.length ? h('div.stat-chips', chips) : null,
    h('div.row', h('a.button.mini.primary', { href }, t('gm.open')), remove));
}

// ---------- One shared sheet, read-only ----------
async function memberSheet(app, tableId, fileId) {
  const c = await gm.cached(tableId, fileId);
  const back = `#/gm/${encodeURIComponent(tableId)}`;
  if (!c) { app.append(h('div.card', h('p', t('gm.notLoaded')), h('a.button', { href: back }, t('gm.backToTable')))); return; }
  await sheetScreen(app, null, { readOnly: { sheet: c.sheet, owner: c.owner?.name || c.owner?.email, back } });
  // keep it fresh while it is open
  const every = await gm.interval();
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
    poll = setTimeout(tick, every * 1000);
  };
  poll = setTimeout(tick, every * 1000);
}
