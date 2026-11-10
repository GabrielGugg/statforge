// ============================================================
// Guide: the user guide (GUIDE.md / GUIDE.<language>.md), shown in the app.
// The same files are read on GitHub. The first visit, or an app with no
// packages, offers it on the home screen.
// ============================================================
import * as db from '../storage.js';
import { t, getLanguage } from '../i18n.js';
import { h } from './util.js';
import { markdown } from './markdown.js';

export async function guideScreen(app) {
  await db.setConfig('guideSeen', true);
  const body = h('div.markdown.guide', h('p.muted', t('common.loading')));
  app.append(h('div.card.section', body));
  const file = getLanguage() === 'en' ? 'GUIDE.md' : `GUIDE.${getLanguage()}.md`;
  try {
    let r = await fetch(file);
    if (!r.ok) r = await fetch('GUIDE.md');
    if (!r.ok) throw new Error(String(r.status));
    body.replaceChildren(...markdown(await r.text(), { headingOffset: 0 }));
  } catch {
    body.replaceChildren(h('h1', t('guide.title')), h('p', t('guide.offline')),
      h('p', h('a', { href: `https://github.com/GabrielGugg/statforge/blob/main/${file}`, target: '_blank', rel: 'noopener noreferrer' }, t('guide.onGithub'))));
  }
}

/**
 * Home-screen notice: on the first visit, and whenever no package is installed.
 * Closing it (or opening the guide) counts as seen; with no packages it still shows, as part of getting started.
 */
export async function guideNotice({ hasPackages }) {
  const seen = await db.getConfig('guideSeen', false);
  if (seen && hasPackages) return null;
  const box = h('div.alert.ok.row.spread.section', { role: 'status' },
    h('span', hasPackages ? t('guide.noticeFirst') : t('guide.noticeEmpty')),
    h('div.row',
      h('a.button.mini.primary', { href: '#/guide' }, t('guide.read')),
      hasPackages ? h('button.mini', { onclick: async () => { await db.setConfig('guideSeen', true); box.remove(); } }, t('guide.dismiss')) : null));
  return box;
}
