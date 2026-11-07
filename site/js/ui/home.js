// ============================================================
// Home screen: list of sheets.
// ============================================================
import * as db from '../storage.js';
import { installed } from '../packages.js';
import { t } from '../i18n.js';
import { h, toast, pickFiles, byName, ask } from './util.js';
import { installLinkWithFeedback, exampleUrl } from './packages.js';

export async function homeScreen(app) {
  const [all, inst, gmTables] = await Promise.all([db.list('sheets'), installed(), db.getConfig('gmTables', null)]);
  // The GM's local sheets (NPCs, copies) live in their table, not here. One whose table is gone shows up again.
  const tableIds = new Set((gmTables || []).map(tb => tb.id));
  const sheets = all.filter(s => !(s.gm && tableIds.has(s.gm.table)));
  const systems = Object.values(inst).filter(p => p.type === 'system');
  sheets.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
  const reload = () => { app.replaceChildren(); homeScreen(app); };

  app.append(h('div.row.spread.section',
    h('h1', t('home.title')),
    h('div.row',
      h('button', { onclick: importSheet }, t('home.import')),
      h('a.button.primary', { href: '#/new', 'aria-disabled': !systems.length }, t('home.new')))));

  if (!systems.length) {
    app.append(h('div.card.section',
      h('h2', t('home.startTitle')),
      h('p', t('home.startText')),
      h('div.row',
        h('button.primary', { onclick: async () => { if (await askLink()) reload(); } }, t('home.pasteLink')),
        h('a.button', { href: '#/packages' }, t('pkgs.installFile')),
        h('button', { onclick: async () => { if (await installLinkWithFeedback(exampleUrl())) reload(); } }, t('home.tryExample')))));
    return;
  }

  if (!sheets.length) {
    app.append(h('div.card.empty', h('p', t('home.noSheets')), h('a.button.primary', { href: '#/new' }, t('home.createFirst'))));
    return;
  }

  app.append(h('div.grid', sheets.map(s => {
    const sys = inst[s.system];
    const exts = s.extensions || [];
    return h('a.card', { href: `#/sheet/${encodeURIComponent(s.id)}` },
      h('h3', h('span', s.name || t('common.unnamed')), h('span.badge', t('home.level', { n: s.level ?? 1 }))),
      h('div.muted.small', sys ? sys.name : t('home.systemMissing', { id: s.system })),
      exts.length ? h('div.muted.small', `${t('home.extensions', { n: exts.length })}: ${exts.map(id => inst[id]?.name || id).sort(byName).join(', ')}`) : null);
  })));
}

async function askLink() {
  const url = await ask(t('home.linkTitle'), t('home.linkLabel'), '', { placeholder: 'https://…' });
  return url ? installLinkWithFeedback(url) : false;
}

async function importSheet() {
  const [file] = await pickFiles({ multiple: false });
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if (!s?.system || !s?.id) throw new Error(t('home.notSheet'));
    const inst = await installed();
    if (await db.get('sheets', s.id)) s.id = `${s.id}-${Date.now().toString(36)}`;
    delete s.gm; // an imported sheet is always one of yours
    s.updated = new Date().toISOString();
    await db.put('sheets', s);
    const missing = [s.system, ...(s.extensions || [])].filter(id => !inst[id]);
    toast(missing.length ? t('home.importedMissing', { list: missing.join(', ') }) : t('home.imported'), missing.length ? 'warning' : 'ok');
    location.hash = `#/sheet/${encodeURIComponent(s.id)}`;
  } catch (e) { toast(e.message, 'error'); }
}
