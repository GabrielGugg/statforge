// ============================================================
// Backup files: what a backup may carry, and what never leaves or enters.
// Pure functions: no storage, no network.
//
// A backup file can come from anyone ("here is my backup with the sheet"),
// so restoring one is treated like installing a package from a link:
// every package is validated, every sheet is cleaned, and only harmless
// settings are accepted. Google access (sync*), shares, the GM's copies of
// players' sheets and the hub / Picker addresses never come from a file.
// ============================================================
import { validatePackage } from './package.js';
import { cleanJSON, cleanText, SYSTEM_ID } from './share.js';

/** Settings a backup may restore, each with the check its value must pass. */
const str = max => v => (typeof v === 'string' && v.length <= max ? v : undefined);
const bool = v => (typeof v === 'boolean' ? v : undefined);
const ids = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && SYSTEM_ID.test(x)).slice(0, 500) : undefined);
const RESTORABLE = {
  language: str(20),
  theme: str(80),
  unit: str(20),
  inventoryView: str(20),
  order: ids,
  autoUpdate: bool,
  debug: bool,
  gmInterval: v => (Number.isFinite(v) ? v : undefined),
  gmTablesUpdated: str(40),
};
// Sheet layouts are kept per system: "layout:<system id>".
const LAYOUT = /^layout:([a-z0-9][a-z0-9._-]{0,79})$/i;

/**
 * Settings that never go into a backup file. The cloud copy (sync) is the
 * person's own and keeps the GM's data, but a file can be handed to anyone.
 */
export const NEVER_IN_FILE = /^(sync|shares$|gmCache:)/;

/** Copy of the settings for a backup file. */
export function configForFile(config) {
  return Object.fromEntries(Object.entries(config || {}).filter(([k]) => !NEVER_IN_FILE.test(k)));
}

/** Only https links are kept and shown as links. */
export const safeLink = u => {
  if (typeof u !== 'string' || u.length > 2000) return null;
  try { return new URL(u).protocol === 'https:' ? u : null; } catch { return null; }
};

/** Installed-package fields the app adds ("_source"…), checked one by one. */
function packageMeta(p) {
  const meta = {};
  const source = safeLink(p._source);
  meta._source = source;
  if (typeof p._installed === 'string') meta._installed = p._installed.slice(0, 40);
  if (p.type === 'table') {
    if (typeof p._system === 'string' && SYSTEM_ID.test(p._system)) meta._system = p._system;
    meta._extensions = ids(p._extensions) || [];
  }
  return meta;
}

/**
 * Checks a backup and returns what may be restored:
 * { packages, sheets, config, skipped: { packages: [name], sheets: n, settings: [key] } }.
 * options.normalizeTables (from gm.js) lets the GM's tables through, checked; without it they are skipped.
 * Throws BACKUP_INVALID when the file is not a StatForge backup at all.
 */
export function cleanBackup(raw, { normalizeTables = null } = {}) {
  let b;
  try { b = cleanJSON(raw); } catch { throw new Error('BACKUP_INVALID'); }
  if (!b || typeof b !== 'object' || Array.isArray(b) || b.app !== 'statforge') throw new Error('BACKUP_INVALID');
  const skipped = { packages: [], sheets: 0, settings: [] };

  const packages = [];
  for (const p of Array.isArray(b.packages) ? b.packages.slice(0, 500) : []) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) { skipped.packages.push('?'); continue; }
    const pkg = Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith('_')));
    let errors;
    try { ({ errors } = validatePackage(pkg)); } catch { errors = ['?']; }
    if (errors.length) { skipped.packages.push(cleanText(p.name || p.id, 80) || '?'); continue; }
    packages.push({ ...pkg, ...packageMeta(p) });
  }

  const sheets = [];
  for (const s of Array.isArray(b.sheets) ? b.sheets.slice(0, 2000) : []) {
    const ok = s && typeof s === 'object' && !Array.isArray(s) && typeof s.id === 'string' && s.id && s.id.length <= 100
      && typeof s.system === 'string' && SYSTEM_ID.test(s.system)
      && (s.extensions == null || (Array.isArray(s.extensions) && s.extensions.every(x => typeof x === 'string' && SYSTEM_ID.test(x))));
    if (!ok) { skipped.sheets++; continue; }
    sheets.push({ ...s, name: cleanText(s.name, 120) });
  }

  const config = {};
  for (const [k, v] of Object.entries(b.config && typeof b.config === 'object' && !Array.isArray(b.config) ? b.config : {})) {
    let value;
    if (Object.hasOwn(RESTORABLE, k)) value = RESTORABLE[k](v);
    else if (LAYOUT.test(k) && v && typeof v === 'object' && !Array.isArray(v)) value = v;
    else if (k === 'gmTables' && normalizeTables && Array.isArray(v)) value = normalizeTables(v);
    if (value === undefined) { skipped.settings.push(k); continue; }
    config[k] = value;
  }
  return { packages, sheets, config, skipped };
}

// ---------- Backup reminder (only when cloud sync is off) ----------
export const REMIND_DAYS = 14;  // a backup older than this, or none since the first sheet, is reminded
export const SNOOZE_DAYS = 7;   // "Remind me later"
const DAY = 86400e3;
const when = s => Date.parse(s || '') || 0;

/**
 * Days since the last backup, or since the oldest sheet when there has never been one;
 * null when no reminder is due. { syncEnabled, sheets: [{ created, updated }], lastBackup, snoozedUntil, now }
 */
export function backupReminder({ syncEnabled, sheets, lastBackup, snoozedUntil, now = Date.now() }) {
  if (syncEnabled || !sheets?.length || now < when(snoozedUntil)) return null;
  const since = when(lastBackup) || Math.min(...sheets.map(s => when(s.created) || when(s.updated) || now));
  const days = Math.floor((now - since) / DAY);
  return days >= REMIND_DAYS ? { days, never: !when(lastBackup) } : null;
}
