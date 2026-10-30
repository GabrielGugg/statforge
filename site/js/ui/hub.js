// ============================================================
// Hub: browse the package collection (index.json) and install with one tap.
// The default hub is GabrielGugg/statforge-hub; Settings can point elsewhere.
// ============================================================
import * as pk from '../packages.js';
import * as db from '../storage.js';
import { compareVersions } from '../engine/package.js';
import { t, getLanguage, languageName } from '../i18n.js';
import { h, byName, normalize, fmt } from './util.js';
import { installLinkWithFeedback, languageBadge } from './packages.js';

export const DEFAULT_HUB = 'https://raw.githubusercontent.com/GabrielGugg/statforge-hub/main/index.json';
export const hubUrl = async () => (await db.getConfig('hubUrl', '')) || DEFAULT_HUB;

const TYPES = ['system', 'extension', 'theme', 'table'];

export async function hubScreen(app) {
  const url = await hubUrl();
  const status = h('p.muted', t('common.loading'));
  app.append(
    h('div.row.spread.section', h('h1', t('hub.title')), h('a.button', { href: '#/packages' }, t('hub.myPackages'))),
    h('p.muted', t('hub.intro')),
    status);

  let index;
  try {
    const r = await fetch(pk.directLink(url), { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    index = await r.json();
    if (!Array.isArray(index?.packages)) throw new Error(t('hub.badIndex'));
  } catch (e) {
    status.replaceWith(h('div.alert.error', h('strong', t('hub.offline')), h('div.small', `${url} — ${e.message}`)));
    return;
  }
  status.remove();

  const lang = getLanguage().split('-')[0];
  const langs = [...new Set(index.packages.map(p => p.language).filter(Boolean))].sort();
  const search = h('input', { type: 'search', placeholder: t('hub.search'), 'aria-label': t('hub.search') });
  const selType = h('select', { 'aria-label': t('hub.type') }, h('option', { value: '' }, t('hub.allTypes')), TYPES.map(x => h('option', { value: x }, t(`type.${x}`))));
  const selLang = h('select', { 'aria-label': t('pkgs.language') }, h('option', { value: '' }, t('hub.allLanguages')),
    langs.map(l => h('option', { value: l, selected: l.split('-')[0] === lang }, `${languageName(l)} (${l})`)));
  if (!langs.some(l => l.split('-')[0] === lang)) selLang.value = '';
  const updates = h('div');
  const list = h('div.hub-list');
  for (const el of [search, selType, selLang]) el.addEventListener(el === search ? 'input' : 'change', () => draw());

  async function draw() {
    const inst = await pk.installed();
    const q = normalize(search.value);
    const found = index.packages
      .filter(p => (!selType.value || p.type === selType.value) && (!selLang.value || p.language === selLang.value))
      .filter(p => !q || normalize(`${p.name} ${p.description || ''} ${p.author || ''} ${p.id}`).includes(q))
      .sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type) || byName(a.name, b.name));

    const outdated = index.packages.filter(p => inst[p.id] && compareVersions(p.version, inst[p.id].version) > 0);
    updates.replaceChildren(...(outdated.length ? [h('div.alert.ok.row.spread',
      h('span', t('hub.updates', { n: outdated.length })),
      h('button.mini.primary', { onclick: async () => { for (const p of outdated) await installLinkWithFeedback(link(p)); draw(); } }, t('hub.updateAll')))] : []));

    list.replaceChildren(...(found.length ? found.map(p => card(p, inst)) : [h('p.muted', t('sheet.nothingFound'))]));
  }

  const link = p => new URL(p.url, url).href;

  function card(p, inst) {
    const mine = inst[p.id];
    const newer = mine && compareVersions(p.version, mine.version) > 0;
    const system = p.system && (index.packages.find(x => x.id === p.system)?.name || inst[p.system]?.name || p.system);
    const install = async () => { if (await installLinkWithFeedback(link(p))) draw(); };
    return h('div.card.hub-item',
      h('div.hub-head',
        h('strong', p.name), ' ', languageBadge(p), ' ', h('span.badge', t(`type.${p.type}`)),
        mine ? h(`span.badge.${newer ? 'warning' : 'ok'}`, newer ? t('hub.newVersion', { v: p.version }) : t('hub.installed')) : null),
      h('div.meta.small.muted', [p.version && `v${p.version}`, p.author, system && t('pkgs.forSystem', { name: system }),
        p.entities ? t('hub.entities', { n: p.entities }) : null, p.license, p.bytes ? `${fmt(Math.ceil(p.bytes / 1024))} KB` : null].filter(Boolean).join(' · ')),
      p.description ? h('p.small.hub-desc', p.description) : null,
      h('div.row',
        h(`button.mini${mine && !newer ? '' : '.primary'}`, { onclick: install },
          newer ? t('pkgs.update') : mine ? t('hub.reinstall') : t('hub.install'))));
  }

  app.append(h('div.row.hub-filters', search, selType, selLang), updates, list);
  draw();
}
