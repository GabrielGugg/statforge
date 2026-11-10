// ============================================================
// Settings: language, theme, backup and changelog.
// ============================================================
import * as db from '../storage.js';
import { installed } from '../packages.js';
import { applyTheme } from './theme.js';
import { VERSION } from '../version.js';
import { DEFAULT_HUB } from './hub.js';
import * as sync from '../sync.js';
import { checkNow } from './updates.js';
import { normalizeTables } from '../gm.js';
import { t, LANGUAGES, getLanguage, setLanguage } from '../i18n.js';
import { h, toast, downloadJSON, pickFiles, confirm, byName, translateStatic } from './util.js';

export async function settingsScreen(app) {
  const inst = await installed();
  const themes = Object.values(inst).filter(p => p.type === 'theme').sort((a, b) => byName(a.name, b.name));
  const current = await db.getConfig('theme', 'auto');

  const selLanguage = h('select', { onchange: async e => {
    await db.setConfig('language', e.target.value);
    setLanguage(e.target.value);
    translateStatic();
    app.replaceChildren();
    await settingsScreen(app);
  } }, Object.entries(LANGUAGES).map(([code, name]) => h('option', { value: code }, name)));
  selLanguage.value = getLanguage();

  const selTheme = h('select', { onchange: async e => { await db.setConfig('theme', e.target.value); await applyTheme(); } },
    h('option', { value: 'auto' }, t('settings.themeAuto')),
    h('option', { value: 'light' }, t('settings.themeLight')),
    h('option', { value: 'dark' }, t('settings.themeDark')),
    themes.length ? h('optgroup', { label: t('settings.installedThemes') }, themes.map(x => h('option', { value: x.id }, x.name))) : null);
  selTheme.value = current;

  const hubInput = h('input', { type: 'url', value: (await db.getConfig('hubUrl', '')) || DEFAULT_HUB, placeholder: DEFAULT_HUB,
    onchange: async e => {
      const v = e.target.value.trim();
      await db.setConfig('hubUrl', v === DEFAULT_HUB ? '' : v);
      if (!v) e.target.value = DEFAULT_HUB;
      toast(t('settings.saved'));
    } });

  const selUnit = h('select', { onchange: async e => { await db.setConfig('unit', e.target.value); toast(t('settings.saved')); } },
    h('option', { value: 'm' }, t('settings.unitM')), h('option', { value: 'ft' }, t('settings.unitFt')), h('option', { value: 'sq' }, t('settings.unitSq')));
  selUnit.value = await db.getConfig('unit', 'm');
  const autoBox = h('input', { type: 'checkbox', checked: !!(await db.getConfig('autoUpdate', false)),
    onchange: async e => { await db.setConfig('autoUpdate', e.target.checked); toast(t('settings.saved')); } });
  const debugBox = h('input', { type: 'checkbox', checked: !!(await db.getConfig('debug', false)),
    onchange: async e => { await db.setConfig('debug', e.target.checked); toast(t('settings.saved')); } });

  const changelog = h('div.markdown.small', h('p.muted', t('common.loading')));
  const file = getLanguage() === 'en' ? 'CHANGELOG.md' : `CHANGELOG.${getLanguage()}.md`;
  fetch(file).then(r => (r.ok ? r.text() : fetch('CHANGELOG.md').then(x => (x.ok ? x.text() : Promise.reject()))))
    .then(txt => changelog.replaceChildren(...simpleMarkdown(txt)))
    .catch(() => changelog.replaceChildren(h('p.muted', t('settings.changelogOffline'))));

  // Cloud sync
  const syncBox = h('div');
  const idInput = h('input', { type: 'text', value: await db.getConfig('syncClientId', ''), placeholder: sync.DEFAULT_CLIENT_ID || '….apps.googleusercontent.com',
    onchange: async e => { await db.setConfig('syncClientId', e.target.value.trim()); toast(t('settings.saved')); drawSync(); } });
  const run = async fn => {
    try { const changed = await fn(); toast(changed ? t('sync.doneChanged') : t('sync.done')); }
    catch (e) { toast(e.message === 'NO_CLIENT_ID' ? t('sync.noClient') : t('sync.failed', { error: e.message }), 'error'); }
    drawSync();
  };
  async function drawSync() {
    const s = await sync.status();
    const noId = !(await sync.clientId());
    syncBox.replaceChildren(...[
      h('p', s.enabled ? t('sync.on') : t('sync.text')),
      s.enabled && s.email ? h('p.muted.small', t('sync.account', { email: s.email })) : null,
      s.enabled && s.last ? h('p.muted.small', t('sync.last', { when: new Date(s.last).toLocaleString(getLanguage()) })) : null,
      s.error ? h('p.small', { style: { color: 'var(--danger)' } }, t('sync.failed', { error: s.error })) : null,
      noId ? h('p.muted.small', t('sync.noClient')) : null,
      h('div.row',
        s.enabled
          ? [h('button.primary', { disabled: s.busy, onclick: () => run(() => sync.syncNow()) }, s.busy ? t('sync.busy') : t('sync.now')),
             h('button', { onclick: async () => { await sync.disconnect(); drawSync(); } }, t('sync.disconnect'))]
          : h('button.primary', { disabled: noId, onclick: () => run(() => sync.connect()) }, t('sync.connect'))),
      h('p.small.legal-links', h('a', { href: 'privacy.html', target: '_blank', rel: 'noopener' }, t('legal.privacy')), ' · ',
        h('a', { href: 'terms.html', target: '_blank', rel: 'noopener' }, t('legal.terms'))),
      h('details', { style: { marginTop: '.75rem' } }, h('summary.small', t('sync.advanced')),
        h('label.field', h('span', t('sync.clientId')), idInput), h('p.muted.small', t('sync.clientHint'))),
    ].filter(Boolean));
  }
  drawSync();

  app.append(
    h('h1.section', t('settings.title')),
    h('section.card.section', h('h2', t('sync.title')), syncBox),
    h('section.card.section',
      h('h2', t('settings.appearance')),
      h('label.field', h('span', t('settings.language')), selLanguage),
      h('p.muted.small', t('settings.languageHint')),
      h('label.field', h('span', t('settings.theme')), selTheme),
      h('p.muted.small', t('settings.themeHint')),
      h('label.field', h('span', t('settings.units')), selUnit),
      h('p.muted.small', t('settings.unitsHint')),
      h('label.check', debugBox, h('span', t('settings.debug'))),
      h('p.muted.small', t('settings.debugHint'))),
    h('section.card.section',
      h('h2', t('hub.title')),
      h('label.check', autoBox, h('span', t('settings.autoUpdate'))),
      h('p.muted.small', t('settings.autoUpdateHint')),
      h('div.row', h('button', { onclick: () => checkNow() }, t('settings.checkUpdates'))),
      h('label.field', h('span', t('settings.hubUrl')), hubInput),
      h('p.muted.small', t('settings.hubHint'))),
    h('section.card.section',
      h('h2', t('gm.title')),
      h('p.small', t('settings.gmMoved'), ' ', h('a', { href: '#/gm' }, t('settings.gmOpen')))),
    h('section.card.section',
      h('h2', t('settings.backup')),
      h('p', t('settings.backupText')),
      h('div.row',
        h('button', { onclick: async () => downloadJSON(await db.exportAll({ forFile: true }), `statforge-backup-${new Date().toISOString().slice(0, 10)}.json`) }, t('settings.downloadBackup')),
        h('button', { onclick: async () => {
          const [f] = await pickFiles({ multiple: false });
          if (!f) return;
          try {
            const b = JSON.parse(await f.text());
            if (!(await confirm(t('settings.restoreTitle'), t('settings.restoreAsk', { packages: b.packages?.length || 0, sheets: b.sheets?.length || 0 })))) return;
            const r = await db.importAll(b, { normalizeTables });
            await applyTheme();
            const { skipped } = r;
            if (skipped.packages.length || skipped.sheets) {
              toast(t('settings.restoredSkipped', { packages: r.packages, sheets: r.sheets, names: [...skipped.packages, ...(skipped.sheets ? [t('settings.skippedSheets', { n: skipped.sheets })] : [])].join(', ') }), 'warning');
            } else toast(t('settings.restored'));
          } catch (e) { toast(e.message, 'error'); }
        } }, t('settings.restoreBackup')))),
    h('section.card.section',
      h('h2', t('settings.about')),
      h('p', t('settings.aboutText', { version: VERSION })),
      h('p.small', h('a', { href: 'privacy.html', target: '_blank', rel: 'noopener' }, t('legal.privacy')), ' · ',
        h('a', { href: 'terms.html', target: '_blank', rel: 'noopener' }, t('legal.terms'))),
      h('details', h('summary', t('settings.changelog')), changelog)));
}

/** Minimal Markdown for the changelog: headings, lists and paragraphs. */
function simpleMarkdown(txt) {
  const out = [];
  let list = null;
  const inline = s => {
    const frag = document.createDocumentFragment();
    String(s).split(/(\*\*[^*]+\*\*|`[^`]+`)/).forEach(p => {
      if (/^\*\*.*\*\*$/.test(p)) frag.append(h('strong', p.slice(2, -2)));
      else if (/^`.*`$/.test(p)) frag.append(h('code', p.slice(1, -1)));
      else if (p) frag.append(p);
    });
    return frag;
  };
  for (const line of txt.split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.*)/);
    if (m) { list = null; out.push(h(`h${Math.min(3, m[1].length + 1)}`, inline(m[2]))); continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!list) { list = h('ul'); out.push(list); }
      list.append(h('li', inline(line.replace(/^\s*[-*]\s+/, ''))));
      continue;
    }
    list = null;
    if (line.trim()) out.push(h('p', inline(line)));
  }
  return out;
}
