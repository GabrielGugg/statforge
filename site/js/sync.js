// ============================================================
// Cloud sync with Google Drive.
// Everything goes into one file in the app's hidden Drive folder (appDataFolder),
// which only StatForge can see. Each sync downloads it, merges it with this
// device (engine/merge.js) and uploads the result.
// ============================================================
import * as db from './storage.js';
import { mergeData } from './engine/merge.js';

// The OAuth client of the official site. Someone hosting StatForge elsewhere sets their own in Settings.
export const DEFAULT_CLIENT_ID = '960882561949-5eil41c2ikjpfv4pm72bn5tc2pehulc8.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE = 'statforge-sync.json';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

let token = null; // { value, expires }
let timer = null;
let running = null;
const listeners = new Set();

/** Status for the UI: { enabled, connected, busy, last, error }. */
export async function status() {
  return { enabled: !!(await db.getConfig('syncEnabled', false)), connected: hasToken(), busy: !!running,
    last: await db.getConfig('syncLast', null), error: await db.getConfig('syncError', null) };
}
export const onStatus = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = async () => { const s = await status(); listeners.forEach(fn => fn(s)); };

export const clientId = async () => (await db.getConfig('syncClientId', '')) || DEFAULT_CLIENT_ID;
const hasToken = () => !!token && token.expires > Date.now() + 60000;

function loadGoogle() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = ok;
    s.onerror = () => fail(new Error('Google sign-in could not load (offline?)'));
    document.head.append(s);
  });
}

/** Asks Google for access. Must run from a click: it may open a popup. */
async function signIn(prompt = '') {
  const id = await clientId();
  if (!id) throw new Error('NO_CLIENT_ID');
  await loadGoogle();
  return new Promise((ok, fail) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: id, scope: SCOPE, prompt,
      callback: r => {
        if (r.error) return fail(new Error(r.error_description || r.error));
        token = { value: r.access_token, expires: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
        ok();
      },
      error_callback: e => fail(new Error(e?.message || e?.type || 'popup_closed')),
    });
    client.requestAccessToken();
  });
}

async function drive(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token.value}`, ...(opts.headers || {}) } });
  if (r.status === 401) { token = null; throw new Error('AUTH'); }
  if (!r.ok) throw new Error(`Drive ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

async function findFile() {
  const q = encodeURIComponent(`name='${FILE}'`);
  const r = await drive(`${API}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&pageSize=1`);
  return (await r.json()).files?.[0] || null;
}

async function upload(id, data) {
  const body = JSON.stringify(data);
  if (id) return drive(`${UPLOAD}/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  const boundary = `sf${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'], mimeType: 'application/json' });
  return drive(`${UPLOAD}?uploadType=multipart`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--` });
}

/** Turns sync on (from a click) and runs the first sync. */
export async function connect() {
  await signIn('consent');
  await db.setConfig('syncEnabled', true);
  return syncNow();
}

export async function disconnect() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token.value, () => {});
  token = null;
  await db.setConfig('syncEnabled', false);
  await notify();
}

/**
 * Downloads, merges and uploads. interactive: called from a click, so it may ask Google again.
 * Returns true when the local data changed (the screen should redraw).
 */
export function syncNow({ interactive = true } = {}) {
  if (running) return running;
  running = (async () => {
    await notify();
    try {
      if (!hasToken()) {
        if (!interactive) return false;
        await signIn();
      }
      const file = await findFile();
      const remote = file ? await (await drive(`${API}/${file.id}?alt=media`)).json() : null;
      const local = await db.exportAll();
      local.deleted = local.config?.deleted || {};
      const merged = mergeData(local, remote);
      const before = JSON.stringify([local.sheets, local.packages].map(l => l.map(x => [x.id, x.updated || x.version]).sort()));
      const after = JSON.stringify([merged.sheets, merged.packages].map(l => l.map(x => [x.id, x.updated || x.version]).sort()));
      await db.replaceSynced(merged);
      await upload(file?.id, merged);
      await db.setConfig('syncLast', new Date().toISOString());
      await db.setConfig('syncError', null);
      return before !== after;
    } catch (e) {
      await db.setConfig('syncError', e.message);
      throw e;
    } finally {
      running = null;
      notify();
    }
  })();
  return running;
}

/** Uploads a few seconds after sheets or packages change, while access is still valid. */
export function startAutoSync(onRemoteChange) {
  window.addEventListener('statforge:changed', async () => {
    if (!(await db.getConfig('syncEnabled', false)) || !hasToken()) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncNow({ interactive: false }).then(ch => ch && onRemoteChange?.()).catch(() => {}), 5000);
  });
}
