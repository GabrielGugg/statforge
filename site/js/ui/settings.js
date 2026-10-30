// ============================================================
// Settings: language, theme, backup and changelog.
// ============================================================
import * as db from '../storage.js';
import { installed } from '../packages.js';
import { applyTheme } from './theme.js';
import { VERSION } from '../version.js';
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

  const changelog = h('div.markdown.small', h('p.muted', t('common.loading')));
  const file = getLanguage() === 'en' ? 'CHANGELOG.md' : `CHANGELOG.${getLanguage()}.md`;
  fetch(file).then(r => (r.ok ? r.text() : fetch('CHANGELOG.md').then(x => (x.ok ? x.text() : Promise.reject()))))
    .then(txt => changelog.replaceChildren(...simpleMarkdown(txt)))
    .catch(() => changelog.replaceChildren(h('p.muted', t('settings.changelogOffline'))));

  app.append(
    h('h1.section', t('settings.title')),
    h('section.card.section',
      h('h2', t('settings.appearance')),
      h('label.field', h('span', t('settings.language')), selLanguage),
      h('p.muted.small', t('settings.languageHint')),
      h('label.field', h('span', t('settings.theme')), selTheme),
      h('p.muted.small', t('settings.themeHint'))),
    h('section.card.section',
      h('h2', t('settings.backup')),
      h('p', t('settings.backupText')),
      h('div.row',
        h('button', { onclick: async () => downloadJSON(await db.exportAll(), `statforge-backup-${new Date().toISOString().slice(0, 10)}.json`) }, t('settings.downloadBackup')),
        h('button', { onclick: async () => {
          const [f] = await pickFiles({ multiple: false });
          if (!f) return;
          try {
            const b = JSON.parse(await f.text());
            if (!(await confirm(t('settings.restoreTitle'), t('settings.restoreAsk', { packages: b.packages?.length || 0, sheets: b.sheets?.length || 0 })))) return;
            await db.importAll(b);
            await applyTheme();
            toast(t('settings.restored'));
          } catch (e) { toast(e.message, 'error'); }
        } }, t('settings.restoreBackup')))),
    h('section.card.section',
      h('h2', t('settings.about')),
      h('p', t('settings.aboutText', { version: VERSION })),
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
