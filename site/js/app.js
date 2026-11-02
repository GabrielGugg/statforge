// ============================================================
// App entry: hash routes.
//   #/             sheets
//   #/new          new sheet
//   #/sheet/<id>   sheet
//   #/packages     installed packages
//   #/hub          package collection (install with one tap)
//   #/settings     settings
//   #/gm[/<table>[/<file>]]  GM mode: tables, shared sheets (read-only)
//   #/join?gm=…    GM's invite: share a sheet with them (read-only, through Google Drive)
//   ?table=<link>  installs a table package on open
// ============================================================
import * as db from './storage.js';
import { setLanguage, matchLanguage, t } from './i18n.js';
import { applyTheme } from './ui/theme.js';
import { clear, toast, translateStatic } from './ui/util.js';
import { homeScreen } from './ui/home.js';
import { newSheetScreen } from './ui/new-sheet.js';
import { sheetScreen } from './ui/sheet.js';
import { packagesScreen, installLinkWithFeedback } from './ui/packages.js';
import { settingsScreen } from './ui/settings.js';
import { hubScreen } from './ui/hub.js';
import { joinScreen } from './ui/share.js';
import { gmScreen } from './ui/gm.js';
import { startShareUpdates, flushPending } from './share.js';
import * as sync from './sync.js';
import { autoCheck } from './ui/updates.js';
import { startUpdateCheck } from './ui/app-update.js';
import { h } from './ui/util.js';

const app = document.getElementById('app');
const backButton = document.getElementById('back');

// In-app history, so "back" returns to where you were (e.g. Settings → the open sheet).
const trail = (() => { try { return JSON.parse(sessionStorage.getItem('trail') || '[]'); } catch { return []; } })();
let current = location.hash || '#/';
let goingBack = false;
function remember(next) {
  if (goingBack) goingBack = false;
  else if (next !== current) trail.push(current);
  if (trail.length > 50) trail.splice(0, trail.length - 50);
  current = next;
  try { sessionStorage.setItem('trail', JSON.stringify(trail)); } catch { /* private mode */ }
  backButton.hidden = next === '#/' || next === '#' || next === '';
}
backButton.addEventListener('click', () => {
  let target = trail.pop();
  while (target === current && trail.length) target = trail.pop();
  goingBack = true;
  location.hash = target && target !== current ? target : '#/';
});

async function route() {
  remember(location.hash || '#/');
  const [, name, arg] = (location.hash || '#/').split('/');
  clear(app);
  try {
    if (name === 'new') await newSheetScreen(app);
    else if (name === 'sheet' && arg) await sheetScreen(app, decodeURIComponent(arg));
    else if (name === 'packages') await packagesScreen(app);
    else if (name === 'hub') await hubScreen(app);
    else if (name === 'settings') await settingsScreen(app);
    else if (name.startsWith('join?')) await joinScreen(app, location.hash);
    else if (name === 'gm') await gmScreen(app, arg, location.hash.split('/')[3]);
    else await homeScreen(app);
  } catch (e) {
    console.error(e);
    app.textContent = t('common.errorPrefix', { error: e.message });
  }
  app.focus({ preventScroll: true });
}

async function start() {
  setLanguage(await db.getConfig('language', matchLanguage(navigator.language)));
  translateStatic();
  await applyTheme();
  // GM invite link: ?table=https://...
  const table = new URLSearchParams(location.search).get('table');
  if (table) {
    history.replaceState(null, '', location.pathname + (location.hash || '#/'));
    await installLinkWithFeedback(table);
  }
  window.addEventListener('hashchange', route);
  await route();
  startShareUpdates();
  flushPending();
  sync.onStatus(s => { if (s.connected) flushPending(); });
  await startSync();
  autoCheck(() => route());
  startUpdateCheck();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// Cloud sync: changes upload by themselves while Google access lasts (about an hour).
// If that access is still valid (app reopened within the hour), it syncs by itself;
// otherwise opening the app needs one tap, because Google only asks for access after a click.
// The account used last time is reused, so Google does not ask which account again.
async function startSync() {
  // Redraw only screens that show data, never in the middle of typing in a form.
  const refresh = () => { if (!document.activeElement?.matches('input, textarea, select')) route(); };
  sync.startAutoSync(refresh);
  const s = await sync.status();
  if (!s.enabled) return;
  if (s.connected) { sync.syncNow({ interactive: false }).then(ch => ch && refresh()).catch(() => {}); return; }
  const bar = h('div.sync-banner', { role: 'status' },
    h('span', t('sync.banner')),
    h('button.mini.primary', { onclick: async () => {
      bar.remove();
      try { if (await sync.syncNow()) refresh(); toast(t('sync.done')); } catch (e) { toast(t('sync.failed', { error: e.message }), 'error'); }
    } }, t('sync.now')),
    h('button.mini', { 'aria-label': t('common.close'), onclick: () => bar.remove() }, '✕'));
  document.body.append(bar);
}

start().catch(e => toast(e.message, 'error'));
