// ============================================================
// Local storage (IndexedDB): packages, sheets and settings.
// Everything stays in the browser; nothing is sent to a server.
// ============================================================
import { t } from './i18n.js';

const DB_NAME = 'statforge';
const DB_VERSION = 1;
let connection = null;

function open() {
  if (connection) return connection;
  connection = new Promise((ok, fail) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('packages')) db.createObjectStore('packages', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sheets')) db.createObjectStore('sheets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
  return connection;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((ok, fail) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => ok(req?.result);
    tx.onerror = () => fail(tx.error);
    tx.onabort = () => fail(tx.error || new Error('Transaction aborted'));
  });
}

export const list = store => run(store, 'readonly', s => s.getAll());
export const get = (store, id) => run(store, 'readonly', s => s.get(id));
export const put = (store, obj) => run(store, 'readwrite', s => s.put(obj));
export const remove = (store, id) => run(store, 'readwrite', s => s.delete(id));

export const getConfig = async (k, fallback) => (await run('config', 'readonly', s => s.get(k))) ?? fallback;
export const setConfig = (k, v) => run('config', 'readwrite', s => s.put(v, k));

/** Full backup (packages + sheets + settings) as an object. */
export async function exportAll() {
  const db = await open();
  const config = await new Promise((ok, fail) => {
    const tx = db.transaction('config', 'readonly');
    const out = {};
    tx.objectStore('config').openCursor().onsuccess = e => {
      const c = e.target.result;
      if (c) { out[c.key] = c.value; c.continue(); }
    };
    tx.oncomplete = () => ok(out);
    tx.onerror = () => fail(tx.error);
  });
  return { app: 'statforge', backup: 1, date: new Date().toISOString(), packages: await list('packages'), sheets: await list('sheets'), config };
}

/** Restores a backup, merging with what already exists. */
export async function importAll(b) {
  if (b?.app !== 'statforge') throw new Error(t('backup.notBackup'));
  for (const p of b.packages || []) await put('packages', p);
  for (const s of b.sheets || []) await put('sheets', s);
  for (const [k, v] of Object.entries(b.config || {})) await setConfig(k, v);
}
