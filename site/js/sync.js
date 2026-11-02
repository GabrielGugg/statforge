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
// Sharing a sheet with the GM also needs drive.file: only files StatForge created or the person picked.
// It is asked for only when someone shares, never for plain sync.
export const FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILE = 'statforge-sync.json';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

// Access token, kept on this device only ('sync*' config keys never go to the cloud),
// so reopening the app within the hour keeps syncing without asking Google again.
let token = null; // { value, expires, scope }
let restored = false;
let timer = null;
let running = null;
const listeners = new Set();

/** Status for the UI: { enabled, connected, busy, last, error }. */
export async function status() {
  await restore();
  return { enabled: !!(await db.getConfig('syncEnabled', false)), connected: hasToken(), busy: !!running,
    last: await db.getConfig('syncLast', null), error: await db.getConfig('syncError', null),
    email: await db.getConfig('syncEmail', '') };
}
export const onStatus = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = async () => { const s = await status(); listeners.forEach(fn => fn(s)); };

export const clientId = async () => (await db.getConfig('syncClientId', '')) || DEFAULT_CLIENT_ID;
const hasToken = () => !!token && token.expires > Date.now() + 60000;

async function restore() {
  if (restored) return;
  restored = true;
  const saved = await db.getConfig('syncToken', null);
  if (!token && saved?.value && saved.expires > Date.now() + 60000) token = saved;
}

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
// The account used last time goes as a hint, so Google picks it instead of asking which account.
async function signIn(prompt = '', scope = SCOPE) {
  const id = await clientId();
  if (!id) throw new Error('NO_CLIENT_ID');
  await loadGoogle();
  const email = await db.getConfig('syncEmail', '');
  await new Promise((ok, fail) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: id, scope, prompt, include_granted_scopes: true, ...(email ? { login_hint: email } : {}),
      callback: r => {
        if (r.error) return fail(new Error(r.error_description || r.error));
        token = { value: r.access_token, expires: Date.now() + (Number(r.expires_in) || 3600) * 1000, scope: r.scope || scope };
        ok();
      },
      error_callback: e => fail(new Error(e?.message || e?.type || 'popup_closed')),
    });
    client.requestAccessToken();
  });
  await db.setConfig('syncToken', token);
  if (!email) {
    try {
      const r = await drive('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
      const found = (await r.json()).user?.emailAddress;
      if (found) await db.setConfig('syncEmail', found);
    } catch { /* the hint is only a convenience */ }
  }
}

const hasScope = s => hasToken() && String(token.scope || SCOPE).split(' ').includes(s);

/** For sharing: a valid token that includes drive.file. interactive = may open Google's popup (only from a click). */
export async function ensureFileAccess({ interactive = false } = {}) {
  await restore();
  if (hasScope(FILE_SCOPE)) return true;
  if (!interactive) return false;
  await signIn('', `${SCOPE} ${FILE_SCOPE}`);
  if (!hasScope(FILE_SCOPE)) throw new Error('SCOPE_DENIED');
  notify();
  return true;
}

/** Current access token (for Google's file picker), or null. */
export async function accessToken() { await restore(); return hasToken() ? token.value : null; }

/** A private file of this app in the person's hidden Drive folder (GM tables live in one). */
export async function readAppFile(name) {
  const f = await findFile(name);
  return f ? (await drive(`${API}/${f.id}?alt=media`)).json() : null;
}
export async function writeAppFile(name, data) {
  const f = await findFile(name);
  await upload(f?.id, data, name);
}

/** Authorised Drive request that returns the raw Response (the share code checks the status itself). */
export async function driveRequest(url, opts = {}) {
  await restore();
  if (!hasToken()) { const e = new Error('AUTH'); e.status = 401; throw e; }
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token.value}`, ...(opts.headers || {}) } });
  if (r.status === 401) { token = null; await db.setConfig('syncToken', null); }
  return r;
}

async function drive(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token.value}`, ...(opts.headers || {}) } });
  if (r.status === 401) { token = null; await db.setConfig('syncToken', null); throw new Error('AUTH'); }
  if (!r.ok) throw new Error(`Drive ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

async function findFile(name = FILE) {
  const q = encodeURIComponent(`name='${name}'`);
  const r = await drive(`${API}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&pageSize=1`);
  return (await r.json()).files?.[0] || null;
}

async function upload(id, data, name = FILE) {
  const body = JSON.stringify(data);
  if (id) return drive(`${UPLOAD}/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  const boundary = `sf${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' });
  return drive(`${UPLOAD}?uploadType=multipart`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--` });
}

/** Turns sync on (from a click) and runs the first sync. */
export async function connect() {
  // Consent only the first time; afterwards Google already knows the account and the permission.
  await signIn((await db.getConfig('syncEmail', '')) ? '' : 'consent');
  await db.setConfig('syncEnabled', true);
  return syncNow();
}

export async function disconnect() {
  if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token.value, () => {});
  token = null;
  await db.setConfig('syncToken', null);
  await db.setConfig('syncEmail', '');
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
      await restore();
      if (!hasToken()) {
        if (!interactive) return false;
        await signIn('', (await db.getConfig('shares', null)) ? `${SCOPE} ${FILE_SCOPE}` : SCOPE);
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
    await restore();
    if (!(await db.getConfig('syncEnabled', false)) || !hasToken()) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncNow({ interactive: false }).then(ch => ch && onRemoteChange?.()).catch(() => {}), 5000);
  });
}
