// ============================================================
// Automatic update check: when "Check for updates automatically" is on in
// Settings, opening the app reads the hub's index.json and, if a package you
// have has a newer version there, offers to update it in a popup.
// ============================================================
import * as pk from '../packages.js';
import * as db from '../storage.js';
import { compareVersions } from '../engine/package.js';
import { t } from '../i18n.js';
import { h, dialog, toast } from './util.js';
import { hubUrl } from './hub.js';
import { installLinkWithFeedback } from './packages.js';

/** Packages you have that the hub has in a newer version: [{ pkg (hub entry), from, link }]. */
export async function findUpdates() {
  const url = await hubUrl();
  const r = await fetch(pk.directLink(url), { cache: 'no-cache' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const index = await r.json();
  if (!Array.isArray(index?.packages)) throw new Error(t('hub.badIndex'));
  const inst = await pk.installed();
  return index.packages
    .filter(p => p.url && inst[p.id] && compareVersions(p.version, inst[p.id].version) > 0)
    .map(p => ({ pkg: p, from: inst[p.id].version, link: new URL(p.url, url).href }));
}

/** Shows the update popup. Resolves true if something was updated. */
export function offerUpdates(list) {
  return new Promise(done => {
    const d = dialog(t('updates.title'), [
      h('p', t('updates.text', { n: list.length })),
      h('ul', list.map(u => h('li', h('strong', u.pkg.name), ` — v${u.from || '?'} → v${u.pkg.version}`))),
      h('p.muted.small', t('updates.hint')),
    ], { actions: [
      { text: t('updates.later'), action: () => done(false) },
      { text: t('hub.updateAll'), primary: true, action: async () => {
        let any = false;
        for (const u of list) any = (await installLinkWithFeedback(u.link)) || any;
        done(any);
      } },
    ] });
    // Closing with ✕, Esc or a click outside counts as "later".
    const obs = new MutationObserver(() => { if (!document.body.contains(d.body)) { obs.disconnect(); done(false); } });
    obs.observe(document.body, { childList: true });
  });
}

/** Called when the app opens. Silent when it is off, offline or there is nothing new. */
export async function autoCheck(onUpdated) {
  if (!(await db.getConfig('autoUpdate', false))) return;
  try {
    const list = await findUpdates();
    if (list.length && await offerUpdates(list)) onUpdated?.();
  } catch { /* offline or hub unreachable: try again next time */ }
}

/** "Check now" button in Settings: always says what it found. */
export async function checkNow() {
  try {
    const list = await findUpdates();
    if (!list.length) { toast(t('updates.none')); return; }
    await offerUpdates(list);
  } catch (e) { toast(t('hub.offline') + ` (${e.message})`, 'error'); }
}
