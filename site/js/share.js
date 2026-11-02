// ============================================================
// Sharing sheets with the GM: storage and timing around engine/share.js.
// config 'shares' = { <sheet id>: { fileId, email, table, since, last } }.
// It stays on this device (settings do not travel with sync): the device that shared keeps the copy up to date.
// ============================================================
import * as db from './storage.js';
import * as pk from './packages.js';
import { VERSION } from './version.js';
import { ensureFileAccess, driveRequest } from './sync.js';
import { snapshot, createShare, updateShare, deleteShare, checkShare } from './engine/share.js';

export const shares = async () => (await db.getConfig('shares', null)) || {};
export const shareOf = async sheetId => (await shares())[sheetId] || null;
async function save(all) { await db.setConfig('shares', Object.keys(all).length ? all : null); }

const timers = new Map();
const pending = new Set();
let pushing = false;

/** Shares a sheet with the GM's e-mail (from a click: may open Google's popup). */
export async function share(sheetId, { email, table = '', message = '' }) {
  const sheet = await db.get('sheets', sheetId);
  if (!sheet) throw new Error('SHEET_NOT_FOUND');
  if (await shareOf(sheetId)) throw new Error('ALREADY_SHARED');
  await ensureFileAccess({ interactive: true });
  const body = snapshot(sheet, await pk.installed(), VERSION);
  const { fileId } = await createShare(driveRequest, { sheet, body, email, message, ownEmail: await db.getConfig('syncEmail', '') });
  const all = await shares();
  const now = new Date().toISOString();
  all[sheetId] = { fileId, email, table, since: now, last: now };
  await save(all);
  return all[sheetId];
}

/** Stops sharing: deletes the copy in the player's Drive, which removes the GM's access with it. */
export async function stop(sheetId, { interactive = true } = {}) {
  const s = await shareOf(sheetId);
  if (!s) return;
  if (await ensureFileAccess({ interactive })) await deleteShare(driveRequest, s.fileId);
  else throw new Error('AUTH');
  const all = await shares();
  delete all[sheetId];
  await save(all);
}

/** Checks who can read the copy. A copy deleted or un-shared in Drive is forgotten; extra access is reported. */
export async function check(sheetId) {
  const s = await shareOf(sheetId);
  if (!s) return { state: 'none' };
  if (!(await ensureFileAccess())) return { state: 'offline', share: s };
  const r = await checkShare(driveRequest, s.fileId, s.email);
  if (r.state === 'gone' || r.state === 'revoked') {
    if (r.state === 'revoked') await deleteShare(driveRequest, s.fileId).catch(() => {});
    const all = await shares();
    delete all[sheetId];
    await save(all);
  }
  return { ...r, share: s };
}

async function push(sheetId) {
  const s = await shareOf(sheetId);
  if (!s) return;
  if (!(await ensureFileAccess())) { pending.add(sheetId); return; }
  const sheet = await db.get('sheets', sheetId);
  if (!sheet) { await stop(sheetId, { interactive: false }).catch(() => {}); return; }
  // Extra access found (someone changed the file in Drive): stop sending updates until the player decides.
  const state = await checkShare(driveRequest, s.fileId, s.email).catch(() => ({ state: 'error' }));
  if (state.state !== 'ok') { pending.add(sheetId); return; }
  await updateShare(driveRequest, s.fileId, snapshot(sheet, await pk.installed(), VERSION));
  pending.delete(sheetId);
  const all = await shares();
  if (all[sheetId]) { all[sheetId].last = new Date().toISOString(); await save(all); }
}

/** Sends updates that waited for access (call after the player signs in again). */
export async function flushPending() {
  if (pushing) return;
  pushing = true;
  try { for (const id of [...pending]) await push(id).catch(() => {}); } finally { pushing = false; }
}

/** Keeps shared copies up to date a few seconds after the sheet changes. */
export function startShareUpdates() {
  window.addEventListener('statforge:changed', async e => {
    if (e.detail?.store !== 'sheets' || !e.detail.id) return;
    const id = e.detail.id;
    if (!(await shareOf(id))) return;
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => { timers.delete(id); push(id).catch(() => pending.add(id)); }, 3000));
  });
}
