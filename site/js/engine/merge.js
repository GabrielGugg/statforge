// ============================================================
// Merging two copies of the app's data (this device and the cloud).
// Pure functions: no storage, no network.
// ============================================================
import { compareVersions } from './package.js';

// Settings that belong to one device and never travel.
const LOCAL_ONLY = /^(sync|deleted$)/;

const time = s => Date.parse(s || '') || 0;

/**
 * Merges two backups ({ sheets, packages, config, deleted }).
 * Sheets: the most recently updated copy wins. Packages: the higher version wins.
 * deleted: { "sheets/<id>": ISO date } — a deletion wins over copies older than it.
 * Settings: this device's value wins; keys it does not have come from the other side.
 */
export function mergeData(local, remote) {
  const deleted = { ...(remote?.deleted || {}) };
  for (const [k, v] of Object.entries(local?.deleted || {})) if (time(v) > time(deleted[k])) deleted[k] = v;

  const sheets = new Map();
  for (const s of [...(remote?.sheets || []), ...(local?.sheets || [])]) {
    const have = sheets.get(s.id);
    if (!have || time(s.updated) >= time(have.updated)) sheets.set(s.id, s);
  }
  for (const [id, s] of sheets) if (deleted[`sheets/${id}`] && time(deleted[`sheets/${id}`]) >= time(s.updated)) sheets.delete(id);

  const packages = new Map();
  for (const p of [...(remote?.packages || []), ...(local?.packages || [])]) {
    const have = packages.get(p.id);
    if (!have || compareVersions(p.version || '0', have.version || '0') >= 0) packages.set(p.id, p);
  }
  for (const [id, p] of packages) if (deleted[`packages/${id}`] && time(deleted[`packages/${id}`]) >= time(p._installed)) packages.delete(id);

  const config = {};
  for (const [k, v] of Object.entries(remote?.config || {})) if (!LOCAL_ONLY.test(k)) config[k] = v;
  for (const [k, v] of Object.entries(local?.config || {})) if (!LOCAL_ONLY.test(k)) config[k] = v;

  return { app: 'statforge', sync: 1, date: new Date().toISOString(), sheets: [...sheets.values()], packages: [...packages.values()], config, deleted };
}
