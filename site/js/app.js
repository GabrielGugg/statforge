// ============================================================
// App entry: hash routes.
//   #/             sheets
//   #/new          new sheet
//   #/sheet/<id>   sheet
//   #/packages     installed packages
//   #/hub          package collection (install with one tap)
//   #/settings     settings
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

const app = document.getElementById('app');

async function route() {
  const [, name, arg] = (location.hash || '#/').split('/');
  clear(app);
  try {
    if (name === 'new') await newSheetScreen(app);
    else if (name === 'sheet' && arg) await sheetScreen(app, decodeURIComponent(arg));
    else if (name === 'packages') await packagesScreen(app);
    else if (name === 'hub') await hubScreen(app);
    else if (name === 'settings') await settingsScreen(app);
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
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

start().catch(e => toast(e.message, 'error'));
