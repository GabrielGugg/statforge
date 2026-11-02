// ============================================================
// GM mode: tables, the sheets players shared, and keeping them up to date.
//
// Read-only by design: this file only ever GETs the players' files. It never writes,
// deletes or changes permissions on them (Google would refuse anyway: the GM is a reader).
// Tables live on this device (config 'gmTables') and in a private file in the GM's
// hidden Drive folder, which players can never see.
// ============================================================
import * as db from './storage.js';
import * as sync from './sync.js';
import { validateShare, driveReason, cleanText } from './engine/share.js';

const API = 'https://www.googleapis.com/drive/v3/files';
const APP_FILE = 'statforge-gm.json';
// Google Picker key of the official site: restricted to gabrielgugg.github.io and to the Picker API only.
export const DEFAULT_PICKER_KEY = 'AIzaSyDuPWPTmXTs-LRW4WV7TxydQkUlVa-RJoE';
export const MIN_INTERVAL = 10, MAX_INTERVAL = 120, DEFAULT_INTERVAL = 15;

export const tables = async () => (await db.getConfig('gmTables', null)) || [];
export const table = async id => (await tables()).find(t => t.id === id) || null;
const cacheKey = (tableId, fileId) => `gmCache:${tableId}:${fileId}`;
export const cached = (tableId, fileId) => db.getConfig(cacheKey(tableId, fileId), null);

async function saveTables(list, { upload = true } = {}) {
  const data = { updated: new Date().toISOString(), tables: list };
  await db.setConfig('gmTables', list);
  await db.setConfig('gmTablesUpdated', data.updated);
  if (upload && (await sync.accessToken())) sync.writeAppFile(APP_FILE, data).catch(() => {});
}

/** Brings tables from the GM's hidden Drive folder when that copy is newer (another device of the GM). */
export async function pullTables() {
  if (!(await sync.accessToken())) return false;
  const remote = await sync.readAppFile(APP_FILE).catch(() => null);
  if (!remote?.tables || !Array.isArray(remote.tables)) return false;
  const localWhen = await db.getConfig('gmTablesUpdated', '');
  if (typeof remote.updated === 'string' && remote.updated > localWhen) { await db.setConfig('gmTables', normalizeTables(remote.tables)); await db.setConfig('gmTablesUpdated', remote.updated); return true; }
  return false;
}

const FILE_ID = /^[\w-]{10,200}$/, ID = /^[\w-]{1,40}$/;
/** Keeps only well-formed tables (the copy in Drive is the GM's own, but it is checked like anything that comes in). */
function normalizeTables(list) {
  return list.filter(t => t && ID.test(t.id) && typeof t.system === 'string').slice(0, 100).map(t => {
    const members = (Array.isArray(t.members) ? t.members : []).filter(m => m && FILE_ID.test(m.fileId))
      .map(m => ({ fileId: m.fileId, added: cleanText(m.added, 40), name: cleanText(m.name, 120), owner: cleanText(m.owner, 254) }));
    const ids = new Set(members.map(m => m.fileId));
    const parties = (Array.isArray(t.parties) ? t.parties : []).filter(p => p && ID.test(p.id)).slice(0, MAX_PARTIES)
      .map(p => ({ id: p.id, name: cleanText(p.name, 60) || '—', members: (Array.isArray(p.members) ? p.members : []).filter(id => ids.has(id)) }));
    const resources = (Array.isArray(t.resources) ? t.resources : []).filter(r => r && ID.test(r.id) && typeof r.formula === 'string').slice(0, MAX_RESOURCES)
      .map(r => ({ id: r.id, name: cleanText(r.name, 60), formula: r.formula.slice(0, 500) }));
    return { id: t.id, name: cleanText(t.name, 80), system: cleanText(t.system, 80), created: cleanText(t.created, 40), members, parties,
      activeParty: parties.some(p => p.id === t.activeParty) ? t.activeParty : null, resources,
      cardStats: Array.isArray(t.cardStats) ? t.cardStats.filter(x => typeof x === 'string' && /^[a-z]+\/[\w.-]{1,80}$/i.test(x)).slice(0, 40) : null };
  });
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export async function createTable({ name, system }) {
  const list = await tables();
  const tb = { id: newId(), name: String(name).trim().slice(0, 80), system, created: new Date().toISOString(), members: [] };
  list.push(tb);
  await saveTables(list);
  return tb;
}
export async function renameTable(id, name) {
  const list = await tables();
  const tb = list.find(t => t.id === id);
  if (tb) { tb.name = String(name).trim().slice(0, 80); await saveTables(list); }
}
export async function deleteTable(id) {
  const list = await tables();
  const tb = list.find(t => t.id === id);
  for (const m of tb?.members || []) await db.setConfig(cacheKey(id, m.fileId), null);
  await saveTables(list.filter(t => t.id !== id));
}
/** Forgets a sheet on this table (the player keeps it; only they can stop sharing). */
export async function removeMember(tableId, fileId) {
  const list = await tables();
  const tb = list.find(t => t.id === tableId);
  if (!tb) return;
  tb.members = tb.members.filter(m => m.fileId !== fileId);
  for (const pt of tb.parties || []) pt.members = pt.members.filter(id => id !== fileId);
  await db.setConfig(cacheKey(tableId, fileId), null);
  await saveTables(list);
}

// ---------- Parties and team resources (all on the GM's side; players never see them) ----------
// table.parties = [{ id, name, members: [fileId] }], table.activeParty = id | null,
// table.resources = [{ id, name, formula }] (the GM's own; the system package can add more in party.resources).
export const MAX_PARTIES = 20, MAX_RESOURCES = 30;
const clean = cleanText;

async function editTable(tableId, fn) {
  const list = await tables();
  const tb = list.find(t => t.id === tableId);
  if (!tb) throw new Error('TABLE_NOT_FOUND');
  tb.parties ||= []; tb.resources ||= [];
  const out = fn(tb);
  await saveTables(list);
  return out;
}

export const createParty = (tableId, name) => editTable(tableId, tb => {
  if (tb.parties.length >= MAX_PARTIES) throw new Error('TOO_MANY');
  const pt = { id: newId(), name: clean(name, 60) || '—', members: [] };
  tb.parties.push(pt);
  if (!tb.activeParty) tb.activeParty = pt.id;
  return pt;
});
export const renameParty = (tableId, partyId, name) => editTable(tableId, tb => {
  const pt = tb.parties.find(p => p.id === partyId);
  if (pt && clean(name, 60)) pt.name = clean(name, 60);
});
export const deleteParty = (tableId, partyId) => editTable(tableId, tb => {
  tb.parties = tb.parties.filter(p => p.id !== partyId);
  if (tb.activeParty === partyId) tb.activeParty = tb.parties[0]?.id || null;
});
export const setActiveParty = (tableId, partyId) => editTable(tableId, tb => {
  if (partyId === null || tb.parties.some(p => p.id === partyId)) tb.activeParty = partyId;
});
/** Puts a sheet in one party (or none: partyId null). A sheet is in at most one party. */
export const assignMember = (tableId, fileId, partyId) => editTable(tableId, tb => {
  if (!tb.members.some(m => m.fileId === fileId)) return;
  for (const pt of tb.parties) pt.members = pt.members.filter(id => id !== fileId);
  const pt = tb.parties.find(p => p.id === partyId);
  if (pt) pt.members.push(fileId);
});
export const partyOf = (tb, fileId) => (tb.parties || []).find(p => p.members.includes(fileId)) || null;

/** Adds or changes one of the GM's resources. The caller checks the formula (checkPartyFormula). */
export const saveResource = (tableId, { id, name, formula }) => editTable(tableId, tb => {
  const r = { id: id || newId(), name: clean(name, 60), formula: String(formula).trim().slice(0, 500) };
  if (!r.name || !r.formula) throw new Error('RESOURCE_INCOMPLETE');
  const i = tb.resources.findIndex(x => x.id === r.id);
  if (i >= 0) tb.resources[i] = r;
  else if (tb.resources.length >= MAX_RESOURCES) throw new Error('TOO_MANY');
  else tb.resources.push(r);
  return r;
});
/** What the sheet cards show: ['section/id', …], or null for the default (the system's resources). */
export const CARD_SECTIONS = ['resources', 'attributes', 'skills', 'derived', 'counters'];
export const setCardStats = (tableId, list) => editTable(tableId, tb => {
  tb.cardStats = Array.isArray(list)
    ? [...new Set(list.map(String).filter(x => /^[a-z]+\/[\w.-]{1,80}$/i.test(x) && CARD_SECTIONS.includes(x.split('/')[0])))].slice(0, 40)
    : null;
});
export const deleteResource = (tableId, id) => editTable(tableId, tb => { tb.resources = tb.resources.filter(r => r.id !== id); });

async function getJSON(url) {
  const r = await sync.driveRequest(url);
  if (!r.ok) { const e = new Error(`DRIVE_${r.status}`); e.status = r.status; e.detail = await driveReason(r); throw e; }
  return r;
}

/**
 * Reads one member's file if it changed. Returns 'same' | 'updated' | 'lost' (access gone: copy deleted locally).
 * Only metadata is fetched each round; the content only when modifiedTime changed.
 */
async function refreshMember(tableId, m) {
  let meta;
  try {
    meta = await (await getJSON(`${API}/${m.fileId}?fields=id,name,modifiedTime,trashed,size,owners(emailAddress,displayName)`)).json();
  } catch (e) {
    // 404, or 403 that is not a rate limit: the player stopped sharing.
    if (e.status === 404 || (e.status === 403 && !/rate|quota/i.test(e.detail || ''))) { await db.setConfig(cacheKey(tableId, m.fileId), null); return 'lost'; }
    throw e;
  }
  if (meta.trashed) { await db.setConfig(cacheKey(tableId, m.fileId), null); return 'lost'; }
  const prev = await cached(tableId, m.fileId);
  if (prev && prev.modifiedTime === meta.modifiedTime) return 'same';
  if (Number(meta.size) > 2 * 1024 * 1024) throw new Error('SHARE_TOO_BIG');
  const text = await (await getJSON(`${API}/${m.fileId}?alt=media`)).text();
  const data = validateShare(text);
  const owner = meta.owners?.[0] || {};
  await db.setConfig(cacheKey(tableId, m.fileId), { ...data, modifiedTime: meta.modifiedTime, fetched: new Date().toISOString(),
    owner: { email: cleanText(owner.emailAddress, 254), name: cleanText(owner.displayName, 80) } });
  return 'updated';
}

/** One round over a table. Returns { changed, results: { fileId: state } }. */
export async function refreshTable(tableId) {
  const tb = await table(tableId);
  if (!tb || !(await sync.accessToken())) return { changed: false, results: {}, offline: true };
  const results = {};
  let changed = false;
  for (const m of tb.members) {
    try { results[m.fileId] = await refreshMember(tableId, m); } catch (e) { results[m.fileId] = `error:${e.message}`; }
    if (results[m.fileId] !== 'same') changed = true;
  }
  const list = await tables();
  const live = list.find(t => t.id === tableId);
  if (live) {
    for (const mm of live.members) {
      mm.state = results[mm.fileId]?.startsWith?.('error') ? 'error' : results[mm.fileId] === 'lost' ? 'lost' : 'ok';
      const c = await cached(tableId, mm.fileId);
      if (c) { mm.name = c.sheet.name; mm.owner = c.owner?.email || ''; }
    }
    await saveTables(list, { upload: false });
  }
  return { changed, results };
}

/** Adds files picked in Google's picker. Each one is read and checked before it joins the table. */
export async function addMembers(tableId, fileIds) {
  const list = await tables();
  const tb = list.find(t => t.id === tableId);
  if (!tb) throw new Error('TABLE_NOT_FOUND');
  const report = [];
  for (const fileId of fileIds) {
    if (!/^[\w-]{10,200}$/.test(fileId)) { report.push({ fileId, error: 'SHARE_INVALID' }); continue; }
    if (tb.members.some(m => m.fileId === fileId)) { report.push({ fileId, error: 'ALREADY_ADDED' }); continue; }
    const m = { fileId, added: new Date().toISOString() };
    try {
      await refreshMember(tableId, m);
      const c = await cached(tableId, fileId);
      if (!c) throw new Error('SHARE_INVALID');
      m.name = c.sheet.name; m.owner = c.owner?.email || '';
      tb.members.push(m);
      report.push({ fileId, name: c.sheet.name, system: c.sheet.system });
    } catch (e) { await db.setConfig(cacheKey(tableId, fileId), null); report.push({ fileId, error: e.message, detail: e.detail }); }
  }
  await saveTables(list);
  return report;
}

export const interval = async () => Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Number(await db.getConfig('gmInterval', DEFAULT_INTERVAL)) || DEFAULT_INTERVAL));
export const pickerKey = async () => (await db.getConfig('gmPickerKey', '')) || DEFAULT_PICKER_KEY;

// ---------- Google Picker (the GM chooses the shared files; this grants drive.file access to them only) ----------

function loadScript(src) {
  return new Promise((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => fail(new Error('PICKER_LOAD'));
    document.head.append(s);
  });
}

/** Opens Google's file picker (from a click). Resolves the chosen file ids. */
export async function pickSharedFiles() {
  await sync.ensureFileAccess({ interactive: true });
  const token = await sync.accessToken();
  const clientId = await sync.clientId();
  const key = await pickerKey();
  const appId = String(clientId).split('-')[0]; // the project number starts the OAuth client id
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((ok, fail) => window.gapi.load('picker', { callback: ok, onerror: () => fail(new Error('PICKER_LOAD')) }));
  const P = window.google.picker;
  return new Promise(ok => {
    const view = new P.DocsView(P.ViewId.DOCS).setMimeTypes('application/json').setOwnedByMe(false).setIncludeFolders(false).setQuery('StatForge');
    new P.PickerBuilder()
      .addView(view)
      .enableFeature(P.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(key)
      .setAppId(appId)
      .setCallback(d => {
        if (d[P.Response.ACTION] === P.Action.PICKED) ok((d[P.Response.DOCUMENTS] || []).map(x => x[P.Document.ID]));
        else if (d[P.Response.ACTION] === P.Action.CANCEL) ok([]);
      })
      .build()
      .setVisible(true);
  });
}
