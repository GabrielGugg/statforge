// ============================================================
// TEMPORARY (remove once the players have moved): #/convert-2.2
// A page with no button anywhere in the app; the GM sends the link.
// It converts this device's sheets of the old "Fallout TTRPG 2.2" packages
// to Fallout TTRPG 2.1 + Gugg's Revision (see engine/migrate22.js).
// Before changing anything it downloads a backup; a sheet whose numbers
// would change is left as it is.
// ============================================================
import * as db from '../storage.js';
import * as pk from '../packages.js';
import * as gm from '../gm.js';
import { t } from '../i18n.js';
import { h, toast } from './util.js';
import { hubUrl } from './hub.js';
import { downloadBackup } from './settings.js';
import { applyTheme } from './theme.js';
import { MIGRATIONS, THEMES, migrationFor, convertSheet, compareSheets } from '../engine/migrate22.js';

export async function convertScreen(app) {
  const card = h('div.card.section');
  app.append(h('h1', t('convert.title')), card);
  const sheets = (await db.list('sheets')).filter(s => migrationFor(s));
  const tables = (await gm.tables()).filter(tb => MIGRATIONS.some(m => m.from === tb.system));
  const theme = await db.getConfig('theme', 'auto');
  const work = sheets.length || tables.length || Object.hasOwn(THEMES, theme);

  card.append(h('p', t('convert.intro')));
  if (!work) { card.append(h('div.alert.ok', t('convert.nothing')), h('a.button', { href: '#/' }, t('convert.home'))); return; }

  card.append(h('p', h('strong', t('convert.found', { n: sheets.length }))),
    sheets.length ? h('ul', sheets.map(s => h('li', `${s.name || t('common.unnamed')} (${s.system})`))) : null,
    tables.length ? h('p', t('convert.tables', { n: tables.length })) : null,
    h('p.muted', t('convert.backup')));
  const go = h('button.primary', { onclick: () => run().catch(e => { toast(e.message, 'error'); go.disabled = false; }) }, t('convert.go'));
  const out = h('div');
  card.append(go, out);

  async function run() {
    go.disabled = true;
    const log = (msg, kind = 'ok') => out.append(h(`div.alert.${kind}.section`, msg));
    await downloadBackup();
    log(t('convert.backupDone'));

    // What to install: the 2.1 system and revision of each sheet/table, and renamed themes.
    const needed = new Set();
    for (const x of [...sheets, ...tables]) { const m = migrationFor(x); needed.add(m.system); needed.add(m.extension); }
    if (Object.hasOwn(THEMES, theme)) needed.add(THEMES[theme]);
    const url = await hubUrl();
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(t('hub.offline'));
    const index = await r.json();
    let inst = await pk.installed();
    for (const id of needed) {
      if (inst[id]) continue;
      const entry = (index?.packages || []).find(p => p?.id === id && typeof p.url === 'string');
      if (!entry) throw new Error(t('convert.notInHub', { id }));
      const got = await pk.installFromLink(new URL(entry.url, url).href);
      if (got.installed?.[0]?.pkg?.id !== id) throw new Error(t('convert.notInHub', { id }));
    }
    inst = await pk.installed();
    const order = await pk.order();

    let done = 0;
    for (const s of sheets) {
      const m = migrationFor(s);
      const { sheet, stale } = convertSheet(s, m, inst);
      const diffs = compareSheets(s, sheet, inst, order);
      if (diffs?.length) {
        log(t('convert.skipped', { name: s.name, list: diffs.slice(0, 5).map(d => `${d.id}: ${d.before} → ${d.after}`).join(', ') }), 'warning');
        continue;
      }
      await db.put('sheets', sheet);
      done++;
      if (stale.length) log(t('convert.stale', { name: s.name, list: stale.join(', ') }), 'warning');
    }
    if (sheets.length) log(t('convert.done', { n: done }));
    const moved = await gm.retargetTables(Object.fromEntries(MIGRATIONS.map(m => [m.from, m.system])));
    if (moved) log(t('convert.tablesDone', { n: moved }));
    if (Object.hasOwn(THEMES, theme) && inst[THEMES[theme]]) { await db.setConfig('theme', THEMES[theme]); await applyTheme(); log(t('convert.themeDone')); }
    out.append(h('p.muted', t('convert.after')), h('a.button.primary', { href: '#/' }, t('convert.home')));
  }
}
