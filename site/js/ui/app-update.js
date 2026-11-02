// ============================================================
// "A new version of StatForge is available": a small bar with an Update button.
// The app checks site/js/version.js (never from cache) when it opens, every 30 minutes and
// when the tab comes back to the front. Update refreshes the app files and reloads the page;
// sheets and packages live in the browser's database and are not touched.
// ============================================================
import { VERSION } from '../version.js';
import { compareVersions } from '../engine/package.js';
import { t } from '../i18n.js';
import { h } from './util.js';

const EVERY = 30 * 60 * 1000, MIN_GAP = 5 * 60 * 1000;
let last = 0, bar = null;

/** The version published on the site, or null (offline, local file…). */
export async function latestVersion() {
  try {
    const r = await fetch(`js/version.js?check=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return /VERSION\s*=\s*['"]([\d.]+)['"]/.exec(await r.text())?.[1] || null;
  } catch { return null; }
}

async function check() {
  if (Date.now() - last < MIN_GAP) return;
  last = Date.now();
  const v = await latestVersion();
  if (!v || compareVersions(v, VERSION) <= 0) return;
  let dismissed = null;
  try { dismissed = sessionStorage.getItem('statforge-update-later'); } catch { /* private mode */ }
  if (dismissed === v) return;
  show(v);
}

/** Downloads the app files again (skipping the browser's cache) and reloads. */
export async function updateNow() {
  await new Promise(r => setTimeout(r, 600)); // let pending saves finish
  const files = new Set(['./', 'index.html']);
  for (const e of performance.getEntriesByType('resource')) {
    const u = new URL(e.name);
    if (u.origin === location.origin && /\.(js|css|json|html|svg|png)$/.test(u.pathname)) files.add(u.pathname);
  }
  await Promise.all([...files].map(f => fetch(f, { cache: 'reload' }).catch(() => {})));
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    for (const k of await caches.keys()) if (k.startsWith('statforge-')) await caches.delete(k);
  } catch { /* no service worker (local file, old browser) */ }
  location.reload();
}

function show(v) {
  if (bar) return;
  bar = h('div.sync-banner.update-banner', { role: 'status' },
    h('span', t('appUpdate.text', { version: v })),
    h('button.mini', { onclick: () => {
      try { sessionStorage.setItem('statforge-update-later', v); } catch { /* private mode */ }
      bar.remove(); bar = null;
    } }, t('appUpdate.later')),
    h('button.mini.primary', { onclick: e => { e.target.disabled = true; e.target.textContent = t('appUpdate.updating'); updateNow(); } }, t('appUpdate.update')));
  document.body.append(bar);
}

export function startUpdateCheck() {
  setTimeout(check, 4000);
  setInterval(check, EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
}
