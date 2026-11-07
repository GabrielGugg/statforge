// ============================================================
// Packages screen: install (file or link), order extensions,
// see conflicts, update and remove.
// ============================================================
import * as pk from '../packages.js';
import { checkSet, buildRules, suggestOrder } from '../engine/package.js';
import * as db from '../storage.js';
import { applyTheme } from './theme.js';
import { t, getLanguage, languageName } from '../i18n.js';
import { h, toast, dialog, confirm, ask, pickFiles, downloadJSON, byName } from './util.js';

const typeName = type => t(`type.${type}`);

/** Link to the example table in the interface language (English if there is none). */
export function exampleUrl() {
  const folder = ['en', 'pt-BR'].includes(getLanguage()) ? getLanguage() : 'en';
  return new URL(`../examples/${folder}/table.json`, location.href).href;
}

/** Language badge for a package, highlighted when it differs from the interface. */
export function languageBadge(p) {
  if (!p.language) return null;
  if (p.language === '*') return h('span.badge', { title: t('pkgs.anyLanguage') }, t('pkgs.anyLanguageShort'));
  const other = p.language.split('-')[0] !== getLanguage().split('-')[0];
  return h(`span.badge${other ? '.warning' : ''}`, { title: languageName(p.language) }, p.language);
}

/** Installs from a link and shows the result. Resolves true if something was installed. */
export async function installLinkWithFeedback(url) {
  toast(t('pkgs.downloading'));
  try {
    const r = await pk.installFromLink(url);
    showResult(r.installed, r.failures || [], r.table);
    if (r.table) await applyTheme();
    return r.installed.length > 0;
  } catch (e) {
    dialog(t('pkgs.installFailed'), h('pre', e.message));
    return false;
  }
}

function showResult(ok, failures, table) {
  const items = ok.map(r => h('li', `${r.pkg.name} (${typeName(r.pkg.type)}, v${r.pkg.version || '0'}${r.pkg.language ? `, ${r.pkg.language}` : ''})`,
    r.replaced ? h('span.muted', ` — ${t('pkgs.updatedFrom', { v: r.replaced.from || '?' })}${r.replaced.downgrade ? ` (${t('pkgs.downgrade')})` : ''}`) : null,
    r.warnings.length ? h('div.muted.small', r.warnings.join(' ')) : null));
  if (!failures.length && ok.length === 1 && !table) { toast(t('pkgs.installed', { name: ok[0].pkg.name })); return; }
  dialog(table ? t('pkgs.tableInstalled') : t('pkgs.installResult'), [
    ok.length ? h('div.alert.ok', h('strong', t('pkgs.installedCount', { n: ok.length })), h('ul', items)) : null,
    failures.length ? h('div.alert.error', h('strong', t('pkgs.problems')), h('ul', failures.map(f => h('li', h('pre', f))))) : null,
    table ? h('p', t('pkgs.tableHint')) : null,
  ]);
}

export async function packagesScreen(app) {
  const inst = await pk.installed();
  const order = await pk.order();
  const byType = { system: [], extension: [], theme: [], table: [], compendium: [] };
  for (const p of Object.values(inst)) byType[p.type]?.push(p);
  byType.extension.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  for (const type of ['system', 'theme', 'table', 'compendium']) byType[type].sort((a, b) => byName(a.name, b.name));

  const reload = () => { app.replaceChildren(); packagesScreen(app); };

  app.append(
    h('div.row.spread.section', h('h1', t('pkgs.title')),
      h('div.row',
        h('a.button.primary', { href: '#/hub' }, t('hub.open')),
        h('button', { onclick: async () => {
          const url = await ask(t('pkgs.byLink'), t('pkgs.linkLabel'), '', { placeholder: 'https://…' });
          if (url && await installLinkWithFeedback(url)) reload();
        } }, t('pkgs.byLink')),
        h('button', { onclick: async () => {
          const files = await pickFiles();
          if (!files.length) return;
          const r = await pk.installFiles(files);
          showResult(r.ok, r.failures);
          if (r.ok.length) { await applyTheme(); reload(); }
        } }, t('pkgs.installFile')))),
    h('p.muted', t('pkgs.intro')));

  if (!Object.keys(inst).length) {
    app.append(h('div.card.empty', h('p', t('pkgs.none')),
      h('a.button.primary', { href: '#/hub', style: { marginRight: '.5rem' } }, t('hub.open')),
      h('button', { onclick: async () => { if (await installLinkWithFeedback(exampleUrl())) reload(); } }, t('pkgs.installExamples'))));
    return;
  }

  const headings = { system: 'pkgs.systems', extension: 'pkgs.extensions', theme: 'pkgs.themes', table: 'pkgs.tables', compendium: 'pkgs.compendiums' };
  for (const type of ['system', 'extension', 'theme', 'table', 'compendium']) {
    const list = byType[type];
    if (!list.length) continue;
    const sec = h('section.section', h('h2', t(headings[type])));
    if (type === 'extension') {
      sec.append(h('div.row', { style: { marginBottom: '.5rem' } },
        h('button.mini', { onclick: async () => { await pk.saveOrder(suggestOrder(order, inst)); reload(); } }, t('pkgs.suggestOrder')),
        h('span.muted.small', t('pkgs.dragHint'))));
    }
    const box = h('div.package-list');
    list.forEach((p, i) => box.append(packageCard(p, inst, type === 'extension' ? { i, total: list.length, order } : null, reload)));
    if (type === 'extension') draggable(box, order, reload);
    sec.append(box);
    app.append(sec);
  }
}

function packageCard(p, inst, ord, reload) {
  const problems = [];
  if (p.type === 'extension') {
    if (!inst[p.system]) problems.push({ level: 'error', msg: t('pkgs.systemNotInstalled', { id: p.system }) });
    const active = ord.order.filter(id => inst[id]?.system === p.system);
    problems.push(...checkSet(p.system, active, inst).filter(a => a.package === p.id));
  }
  const badge = problems.some(x => x.level === 'error') ? h('span.badge.error', t('pkgs.problem'))
    : problems.length ? h('span.badge.warning', t('pkgs.warning')) : null;

  const arrows = ord ? h('div.order-buttons',
    h('button.mini', { 'aria-label': t('pkgs.moveUp'), disabled: ord.i === 0, onclick: () => move(ord.order, p.id, -1, reload) }, '▲'),
    h('button.mini', { 'aria-label': t('pkgs.moveDown'), disabled: ord.i === ord.total - 1, onclick: () => move(ord.order, p.id, 1, reload) }, '▼')) : h('span');

  return h('div.card.package', { draggable: ord ? 'true' : null, 'data-id': p.id },
    arrows,
    h('div.info',
      h('div.name', p.name, ' ', languageBadge(p), ' ', badge),
      h('div.meta', [`v${p.version || '0'}`, p.author, p.id, p.type === 'extension' ? t('pkgs.forSystem', { name: inst[p.system]?.name || p.system }) : null].filter(Boolean).join(' · ')),
      problems.length ? h('ul.small', { style: { margin: '.3rem 0 0', paddingLeft: '1.1rem' } }, problems.map(x => h('li', { class: x.level === 'error' ? 'error' : '' }, x.msg))) : null),
    h('div.row',
      h('button.mini', { onclick: () => details(p, inst) }, t('pkgs.details')),
      p._source ? h('button.mini', { onclick: async () => {
        try { const r = await pk.update(p.id); showResult(r.installed, r.failures || [], r.table); reload(); } catch (e) { toast(e.message, 'error'); }
      } }, t('pkgs.update')) : null,
      h('button.mini.danger', { onclick: async () => {
        const sheets = (await db.list('sheets')).filter(s => s.system === p.id || (s.extensions || []).includes(p.id));
        const extra = sheets.length ? ` ${t('pkgs.usedBy', { n: sheets.length })}` : '';
        if (await confirm(t('pkgs.removeTitle'), `${t('pkgs.removeAsk', { name: p.name })}${extra}`, { yes: t('pkgs.remove'), danger: true })) {
          await pk.uninstall(p.id);
          if ((await db.getConfig('theme')) === p.id) { await db.setConfig('theme', 'auto'); await applyTheme(); }
          reload();
        }
      } }, t('pkgs.remove'))));
}

async function move(order, id, delta, reload) {
  const o = [...order];
  const i = o.indexOf(id), j = i + delta;
  if (i < 0 || j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]];
  await pk.saveOrder(o);
  reload();
}

function draggable(box, order, reload) {
  let dragging = null;
  box.addEventListener('dragstart', e => {
    dragging = e.target.closest('[data-id]');
    dragging?.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  box.addEventListener('dragover', e => {
    e.preventDefault();
    const over = e.target.closest('[data-id]');
    if (!over || over === dragging) return;
    const r = over.getBoundingClientRect();
    over[(e.clientY - r.top) > r.height / 2 ? 'after' : 'before'](dragging);
  });
  box.addEventListener('dragend', async () => {
    dragging?.classList.remove('dragging');
    const next = [...box.querySelectorAll('[data-id]')].map(el => el.dataset.id);
    const rest = order.filter(id => !next.includes(id));
    await pk.saveOrder([...next, ...rest]);
    reload();
  });
}

function details(p, inst) {
  const lines = [];
  if (p.description) lines.push(h('p', p.description));
  if (p.language) lines.push(h('p.small', `${t('pkgs.language')}: ${p.language === '*' ? t('pkgs.anyLanguage') : `${languageName(p.language)} (${p.language})`}`));
  if (p.type === 'system') {
    const { rules } = buildRules(p, []);
    const counts = Object.entries(rules.entities).map(([c, m]) => `${rules.collections[c]?.name || c}: ${Object.keys(m).length}`);
    lines.push(h('p.small', t('pkgs.systemSummary', {
      attributes: Object.keys(rules.attributes).length, skills: Object.keys(rules.skills).length,
      derived: Object.keys(rules.derived).length, resources: Object.keys(rules.resources).length,
    })));
    if (counts.length) lines.push(h('p.small', counts.join(' · ')));
  }
  if (p.type === 'extension') {
    const n = (p.patches || []).reduce((m, x) => ({ ...m, [x.op]: (m[x.op] || 0) + 1 }), {});
    lines.push(h('p.small', Object.entries(n).map(([op, q]) => `${q}× ${op}`).join(' · ') || t('pkgs.noPatches')));
    if (p.requires?.length) lines.push(h('p.small', `${t('pkgs.requires')}: ${p.requires.join(', ')}`));
    if (p.conflicts?.length) lines.push(h('p.small', `${t('pkgs.conflictsWith')}: ${p.conflicts.join(', ')}`));
  }
  if (p.type === 'table') {
    lines.push(h('p.small', `${t('type.system')}: ${inst[p._system]?.name || p._system || '?'}`));
    lines.push(h('p.small', `${t('pkgs.extensions')}: ${(p._extensions || []).map(id => inst[id]?.name || id).join(', ') || t('pkgs.noneShort')}`));
  }
  if (p._source) lines.push(h('p.small', `${t('pkgs.link')}: `, h('a', { href: p._source, target: '_blank', rel: 'noopener' }, p._source)));
  dialog(p.name, lines, {
    actions: [{ text: t('pkgs.downloadJson'), action: () => {
      const clean = Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith('_')));
      downloadJSON(clean, `${p.id}.json`);
      return false;
    } }, { text: t('common.close'), primary: true }],
  });
}
