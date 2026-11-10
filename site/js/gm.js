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
import { entrySheet } from './engine/compendium.js';
import { normalizeTable as normalizeRollTable, MAX_TABLES as MAX_ROLL_TABLES } from './engine/rolltable.js';
import { TIE_BREAKS as TIES } from './engine/combat.js';

const API = 'https://www.googleapis.com/drive/v3/files';
const APP_FILE = 'statforge-gm.json';
// Google Picker key of the official site: restricted to gabrielgugg.github.io and to the Picker API only.
export const DEFAULT_PICKER_KEY = 'AIzaSyDuPWPTmXTs-LRW4WV7TxydQkUlVa-RJoE';
export const MIN_INTERVAL = 10, MAX_INTERVAL = 120, DEFAULT_INTERVAL = 15;

export const tables = async () => (await db.getConfig('gmTables', null)) || [];
export const table = async id => (await tables()).find(t => t.id === id) || null;
const cacheKey = (tableId, fileId) => `gmCache:${tableId}:${fileId}`;
export const cached = (tableId, fileId) => db.getConfig(cacheKey(tableId, fileId), null);

// The copy in Drive is sent a moment after the last change (combat changes come in bursts of clicks).
let pendingUpload = null, uploadTimer = null;
async function flushUpload() {
  clearTimeout(uploadTimer); uploadTimer = null;
  const data = pendingUpload; pendingUpload = null;
  if (data && (await sync.accessToken())) sync.writeAppFile(APP_FILE, data).catch(() => {});
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pendingUpload) flushUpload(); });

async function saveTables(list, { upload = true } = {}) {
  const data = { updated: new Date().toISOString(), tables: list };
  await db.setConfig('gmTables', list);
  await db.setConfig('gmTablesUpdated', data.updated);
  if (upload) { pendingUpload = data; clearTimeout(uploadTimer); uploadTimer = setTimeout(flushUpload, 2000); }
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
// A local sheet (the GM's own, kept in this device's sheets) is a party member as 'local:<sheet id>'.
export const LOCAL_ID = /^local:[\w-]{1,120}$/;
export const localKey = sheetId => `local:${sheetId}`;
/** Keeps only well-formed tables (the copy in Drive is the GM's own, but it is checked like anything that comes in). */
export function normalizeTables(list) {
  return list.filter(t => t && ID.test(t.id) && typeof t.system === 'string').slice(0, 100).map(t => {
    const members = (Array.isArray(t.members) ? t.members : []).filter(m => m && FILE_ID.test(m.fileId))
      .map(m => ({ fileId: m.fileId, added: cleanText(m.added, 40), name: cleanText(m.name, 120), owner: cleanText(m.owner, 254) }));
    const ids = new Set(members.map(m => m.fileId));
    const parties = (Array.isArray(t.parties) ? t.parties : []).filter(p => p && ID.test(p.id)).slice(0, MAX_PARTIES)
      .map(p => ({ id: p.id, name: cleanText(p.name, 60) || '—', members: (Array.isArray(p.members) ? p.members : []).filter(id => ids.has(id) || LOCAL_ID.test(id)) }));
    const resources = (Array.isArray(t.resources) ? t.resources : []).filter(r => r && ID.test(r.id) && typeof r.formula === 'string').slice(0, MAX_RESOURCES)
      .map(r => ({ id: r.id, name: cleanText(r.name, 60), formula: r.formula.slice(0, 500) }));
    return { id: t.id, name: cleanText(t.name, 80), system: cleanText(t.system, 80), created: cleanText(t.created, 40), members, parties,
      activeParty: parties.some(p => p.id === t.activeParty) ? t.activeParty : null, resources,
      cardStats: Array.isArray(t.cardStats) ? t.cardStats.filter(x => typeof x === 'string' && /^[a-z]+\/[\w.-]{1,80}$/i.test(x)).slice(0, 40) : null,
      settings: normalizeSettings(t.settings), combat: normalizeCombat(t.combat),
      notes: normalizeNotes(t.notes), shield: normalizeShield(t.shield),
      rollTables: (Array.isArray(t.rollTables) ? t.rollTables : []).map(x => normalizeRollTable(x, newId)).filter(Boolean).slice(0, MAX_ROLL_TABLES) };
  });
}

// ---------- Per-table settings (the GM's own; players never see them) ----------
// table.settings = { interval: seconds | null (null = the old app-wide value), initiativeAuto: 'all' | 'npcs' | 'none',
//   tieBreak: 'manual' | 'players' | 'formula', tieFormula: text (a formula on each sheet, for 'formula') }
export const INITIATIVE_AUTO = ['all', 'npcs', 'none'];
export { TIE_BREAKS } from './engine/combat.js';
export const DEFAULT_SETTINGS = { interval: null, initiativeAuto: 'npcs', tieBreak: 'manual', tieFormula: '' };
const clampInterval = v => Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Math.round(Number(v)) || DEFAULT_INTERVAL));
function normalizeSettings(s) {
  s = s && typeof s === 'object' ? s : {};
  return {
    interval: s.interval === null || s.interval === undefined || s.interval === '' ? null : clampInterval(s.interval),
    initiativeAuto: INITIATIVE_AUTO.includes(s.initiativeAuto) ? s.initiativeAuto : DEFAULT_SETTINGS.initiativeAuto,
    tieBreak: TIES.includes(s.tieBreak) ? s.tieBreak : DEFAULT_SETTINGS.tieBreak,
    tieFormula: typeof s.tieFormula === 'string' ? s.tieFormula.slice(0, 200) : '',
  };
}
export const settingsOf = tb => normalizeSettings(tb?.settings);

// ---------- Combat: encounters kept by the GM (players' sheets are never written) ----------
// table.combat = { active: encounterId | null, encounters: [{ id, name, round, turn, started, participants: [
//   { id, kind: 'member' | 'local' | 'comp', ref, name, npc, init, hp, hpMax, vals: { valueId: { cur, max } }, conditions: ['col/ref'], note }] }] }
// vals holds the other values of the fight (stamina, defense, damage threshold…), changed only in the encounter.
// kind 'member': ref = the shared file id; 'local': the local sheet id; 'comp': 'compendiumId/entryId'.
export const MAX_ENCOUNTERS = 50, MAX_PARTICIPANTS = 100;
const PART_KINDS = ['member', 'local', 'comp'];
const numOrNull = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const cleanVals = v => Object.fromEntries(Object.entries(v && typeof v === 'object' && !Array.isArray(v) ? v : {})
  .filter(([k, x]) => /^[\w.-]{1,80}$/.test(k) && x && typeof x === 'object').slice(0, 16).map(([k, x]) => [k, { cur: numOrNull(x.cur), max: numOrNull(x.max) }]));
function normalizeCombat(c) {
  c = c && typeof c === 'object' ? c : {};
  const encounters = (Array.isArray(c.encounters) ? c.encounters : []).filter(e => e && ID.test(e.id)).slice(0, MAX_ENCOUNTERS).map(e => {
    const participants = (Array.isArray(e.participants) ? e.participants : []).filter(p => p && ID.test(p.id) && PART_KINDS.includes(p.kind) && typeof p.ref === 'string')
      .slice(0, MAX_PARTICIPANTS).map(p => ({
        id: p.id, kind: p.kind, ref: p.ref.slice(0, 200), name: cleanText(p.name, 120) || '—', npc: !!p.npc,
        init: numOrNull(p.init), hp: numOrNull(p.hp), hpMax: numOrNull(p.hpMax),
        vals: cleanVals(p.vals),
        conditions: (Array.isArray(p.conditions) ? p.conditions : []).filter(x => typeof x === 'string' && /^[\w.-]{1,80}\/[\w.-]{1,80}$/.test(x)).slice(0, 40),
        note: cleanText(p.note, 300),
      }));
    const turn = Math.max(0, Math.min(participants.length - 1, Math.round(Number(e.turn)) || 0));
    return { id: e.id, name: cleanText(e.name, 80) || '—', round: Math.max(1, Math.round(Number(e.round)) || 1), turn, started: !!e.started, participants };
  });
  return { active: encounters.some(e => e.id === c.active) ? c.active : encounters[0]?.id || null, encounters };
}
export const combatOf = tb => normalizeCombat(tb?.combat);
/** Changes the table's combat: fn(combat) edits it in place; the result is checked again before saving. */
export const editCombat = (tableId, fn) => editTable(tableId, tb => {
  const c = normalizeCombat(tb.combat);
  const out = fn(c);
  tb.combat = normalizeCombat(c);
  return out;
});
export const newCombatId = () => newId();

// ---------- The GM's notes, per table (the same notebook as the sheet's) ----------
export const MAX_NOTES = 500;
function normalizeNotes(list) {
  return (Array.isArray(list) ? list : []).filter(n => n && ID.test(n.id)).slice(0, MAX_NOTES)
    .map(n => ({ id: n.id, title: cleanText(n.title, 200), text: typeof n.text === 'string' ? n.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, 20000) : '', open: !!n.open }));
}
export const notesOf = tb => normalizeNotes(tb?.notes);
export const saveNotes = (tableId, notes) => editTable(tableId, tb => { tb.notes = normalizeNotes(notes); });

// ---------- The GM's shield: pages of cards, per table ----------
// table.shield = { active: pageId, pages: [{ id, name, scroll: 'grid' | 'row', cards: [
//   { id, type, title, w: 3|4|6|8|12, h: 'auto'|'s'|'m'|'l', text?, ref?, dice? }] }] }
export const SHIELD_TYPES = ['text', 'note', 'table', 'stats', 'dice', 'initiative'];
export const SHIELD_WIDTHS = [3, 4, 6, 8, 12], SHIELD_HEIGHTS = ['auto', 's', 'm', 'l'];
export const MAX_PAGES = 20, MAX_CARDS = 60;
function normalizeShield(sh) {
  sh = sh && typeof sh === 'object' ? sh : {};
  const pages = (Array.isArray(sh.pages) ? sh.pages : []).filter(p => p && ID.test(p.id)).slice(0, MAX_PAGES).map(p => ({
    id: p.id, name: cleanText(p.name, 40) || '—', scroll: p.scroll === 'row' ? 'row' : 'grid',
    cards: (Array.isArray(p.cards) ? p.cards : []).filter(c => c && ID.test(c.id) && SHIELD_TYPES.includes(c.type)).slice(0, MAX_CARDS).map(c => ({
      id: c.id, type: c.type, title: cleanText(c.title, 80),
      w: SHIELD_WIDTHS.includes(Number(c.w)) ? Number(c.w) : 4, h: SHIELD_HEIGHTS.includes(c.h) ? c.h : 'auto',
      ...(c.type === 'text' ? { text: typeof c.text === 'string' ? c.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, 10000) : '' } : {}),
      ...(['note', 'table'].includes(c.type) ? { ref: typeof c.ref === 'string' && ID.test(c.ref) ? c.ref : null } : {}),
      ...(c.type === 'dice' ? { dice: cleanText(c.dice, 40) || '1d20' } : {}),
    })),
  }));
  return { active: pages.some(p => p.id === sh.active) ? sh.active : pages[0]?.id || null, pages };
}
export const shieldOf = tb => normalizeShield(tb?.shield);
/** Changes the shield: fn(shield) edits it in place; checked again before saving. */
export const editShield = (tableId, fn) => editTable(tableId, tb => {
  const sh = normalizeShield(tb.shield);
  const out = fn(sh);
  tb.shield = normalizeShield(sh);
  return out;
});

// ---------- The GM's roll tables (loot, weather, encounters…), per table ----------
export const rollTablesOf = tb => (Array.isArray(tb?.rollTables) ? tb.rollTables : []).map(x => normalizeRollTable(x, newId)).filter(Boolean);
/** Adds or changes one; throws TABLE_INCOMPLETE when it has no name or rows. */
export const saveRollTable = (tableId, data) => editTable(tableId, tb => {
  const rt = normalizeRollTable(data, newId);
  if (!rt || !rt.rows.length) throw new Error('TABLE_INCOMPLETE');
  tb.rollTables = rollTablesOf(tb);
  const i = tb.rollTables.findIndex(x => x.id === rt.id);
  if (i >= 0) tb.rollTables[i] = rt;
  else if (tb.rollTables.length >= MAX_ROLL_TABLES) throw new Error('TOO_MANY');
  else tb.rollTables.push(rt);
  return rt;
});
export const deleteRollTable = (tableId, id) => editTable(tableId, tb => { tb.rollTables = rollTablesOf(tb).filter(x => x.id !== id); });
/** Adds tables from a file (already checked by importFile). Returns how many came in. */
export const addRollTables = (tableId, list) => editTable(tableId, tb => {
  tb.rollTables = rollTablesOf(tb);
  const room = MAX_ROLL_TABLES - tb.rollTables.length;
  const add = list.slice(0, Math.max(0, room)).map(x => ({ ...x, id: newId() }));
  tb.rollTables.push(...add);
  return add.length;
});

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
  for (const s of await localSheets(id)) await db.remove('sheets', s.id);
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
  if (!tb.members.some(m => m.fileId === fileId) && !LOCAL_ID.test(fileId)) return;
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
/** Changes some of the table's settings; unknown keys are ignored and values are checked. */
export const saveSettings = (tableId, patch) => editTable(tableId, tb => {
  tb.settings = normalizeSettings({ ...settingsOf(tb), ...(patch && typeof patch === 'object' ? patch : {}) });
  return tb.settings;
});
export const deleteResource = (tableId, id) => editTable(tableId, tb => { tb.resources = tb.resources.filter(r => r.id !== id); });

// ---------- Local sheets: the GM's NPCs and copies, edited freely, never sent to anyone ----------
// sheet.gm = { table: tableId, npc: true|false, from: fileId of the shared sheet it was copied from (optional) }.
// They live with the GM's other sheets (so the GM's own Drive backup keeps them) but stay off the home list.
export const localSheets = async tableId => (await db.list('sheets')).filter(s => s.gm?.table === tableId);

/** A separate snapshot of a shared sheet that the GM can edit. The player's file is only read, never touched. */
export async function copyToLocal(tableId, fileId, { name } = {}) {
  const c = await cached(tableId, fileId);
  if (!c?.sheet) throw new Error('SHARE_INVALID');
  const sheet = structuredClone(c.sheet);
  const now = new Date().toISOString();
  Object.assign(sheet, { id: newId(), name: cleanText(name || sheet.name, 120), created: now, updated: now, gm: { table: tableId, npc: false, from: fileId } });
  await db.put('sheets', sheet);
  return sheet;
}

/** A local sheet (NPC) from a compendium entry, calculated with the table system's rules. Returns { sheet, missing }. */
export async function localFromEntry(tableId, rules, compendium, entryId, { versions } = {}) {
  const tb = await table(tableId);
  if (!tb || compendium?.type !== 'compendium' || compendium.system !== tb.system) throw new Error('ENTRY_NOT_FOUND');
  const now = new Date().toISOString();
  const { sheet, missing, description, sections } = entrySheet(rules, compendium, entryId, {
    id: newId(), system: tb.system, extensions: [], versions: versions || {}, created: now, updated: now,
    gm: { table: tableId, npc: true, compendium: { id: compendium.id, entry: entryId, version: cleanText(compendium.version, 40) } },
  });
  if (description) sheet.gm.description = description;
  if (sections.length) sheet.gm.sections = sections;
  await db.put('sheets', sheet);
  return { sheet, missing };
}

/** Deletes a local sheet and takes it out of the table's parties. */
export async function removeLocal(tableId, sheetId) {
  await db.remove('sheets', sheetId);
  const key = localKey(sheetId);
  const list = await tables();
  const tb = list.find(t => t.id === tableId);
  if (tb && (tb.parties || []).some(p => p.members.includes(key))) {
    for (const pt of tb.parties) pt.members = pt.members.filter(id => id !== key);
    await saveTables(list);
  }
}

async function getJSON(url) {
  const r = await sync.driveRequest(url);
  if (!r.ok) { const e = new Error(`DRIVE_${r.status}`); e.status = r.status; e.detail = await driveReason(r); throw e; }
  return r;
}

/**
 * Reads one member's file if it changed. Returns 'same' | 'updated' | 'lost' (access gone: copy deleted locally).
 * Only metadata is fetched each round; the content only when modifiedTime changed.
 */
// A 403 that is not a rate limit usually means the player stopped sharing, but Drive also
// answers 403 for a moment now and then. The copy is only dropped after this many in a row.
export const LOST_AFTER = 3;
const strikes = new Map(); // "<table>:<file>" → consecutive 403s (this session)

async function refreshMember(tableId, m) {
  let meta;
  const key = `${tableId}:${m.fileId}`;
  try {
    meta = await (await getJSON(`${API}/${m.fileId}?fields=id,name,modifiedTime,trashed,size,owners(emailAddress,displayName)`)).json();
  } catch (e) {
    // 404: the copy is gone (the player stopped sharing, which deletes it).
    if (e.status === 404) { strikes.delete(key); await db.setConfig(cacheKey(tableId, m.fileId), null); return 'lost'; }
    if (e.status === 403 && !/rate|quota/i.test(e.detail || '')) {
      const n = (strikes.get(key) || 0) + 1;
      strikes.set(key, n);
      if (n >= LOST_AFTER) { strikes.delete(key); await db.setConfig(cacheKey(tableId, m.fileId), null); return 'lost'; }
    }
    throw e;
  }
  strikes.delete(key);
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

/** Seconds between checks for one table: its own setting, else the value from the app-wide setting older versions had. */
export async function interval(tableId) {
  const own = tableId ? settingsOf(await table(tableId)).interval : null;
  return own ?? clampInterval(await db.getConfig('gmInterval', DEFAULT_INTERVAL));
}
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
