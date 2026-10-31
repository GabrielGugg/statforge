// ============================================================
// Installed packages: install from file or link, table packages,
// extension order and rule assembly for a sheet.
// ============================================================
import * as db from './storage.js';
import { validatePackage, buildRules, checkSet, compareVersions } from './engine/package.js';
import { t } from './i18n.js';

/** All installed packages, as an id → package map. */
export async function installed() {
  return Object.fromEntries((await db.list('packages')).map(p => [p.id, p]));
}

/** Global extension order (list of ids). New ones go to the end. */
export async function order() {
  const inst = await installed();
  const saved = (await db.getConfig('order', [])).filter(id => inst[id]?.type === 'extension');
  const fresh = Object.values(inst).filter(p => p.type === 'extension' && !saved.includes(p.id)).map(p => p.id);
  return [...saved, ...fresh];
}
export const saveOrder = ids => db.setConfig('order', ids);

/** Turns known share links into the direct file link. */
export function directLink(url) {
  const u = String(url).trim();
  let m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/) || u.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  m = u.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  m = u.match(/^https:\/\/gist\.github\.com\/([^/]+)\/([0-9a-f]+)\/?$/);
  if (m) return `https://gist.githubusercontent.com/${m[1]}/${m[2]}/raw`;
  if (/dropbox\.com/.test(u)) return /dl=0/.test(u) ? u.replace('dl=0', 'dl=1') : u + (u.includes('?') ? '&dl=1' : '?dl=1');
  return u;
}

async function download(url) {
  let r;
  try { r = await fetch(directLink(url), { cache: 'no-cache' }); } catch {
    throw new Error(t('pkg.downloadFailed', { url }));
  }
  if (!r.ok) throw new Error(t('pkg.httpError', { status: r.status, url }));
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { throw new Error(t('pkg.notJson', { url })); }
}

/**
 * Validates and saves a package. Returns { pkg, warnings, replaced }.
 * Throws with the list of problems if it is invalid.
 */
export async function install(pkg, source = null) {
  const { errors, warnings } = validatePackage(pkg);
  if (errors.length) {
    const e = new Error(`${t('pkg.cannotInstall', { name: pkg?.name || pkg?.id || t('pkg.package') })}\n• ${errors.join('\n• ')}`);
    e.errors = errors;
    throw e;
  }
  const old = await db.get('packages', pkg.id);
  if (old && old.type !== pkg.type) throw new Error(t('pkg.otherType', { id: pkg.id, type: old.type }));
  const record = { ...pkg, _source: source || old?._source || null, _installed: new Date().toISOString() };
  await db.put('packages', record);
  if (pkg.type === 'extension') {
    const o = await order();
    if (!o.includes(pkg.id)) await saveOrder([...o, pkg.id]);
  }
  return {
    pkg: record, warnings,
    replaced: old ? { from: old.version, to: pkg.version, downgrade: compareVersions(pkg.version, old.version) < 0 } : null,
  };
}

/** Installs from a link. If it is a table package, installs everything it lists. */
export async function installFromLink(url) {
  const p = await download(url);
  if (p?.type !== 'table') return { installed: [await install(p, url)] };
  return installTable(p, url);
}

/** Installs the system, extensions and theme of a table package; keeps the table as a set. */
export async function installTable(table, url = null) {
  const { errors } = validatePackage(table);
  if (errors.length) throw new Error(`${t('pkg.badTable')}\n• ${errors.join('\n• ')}`);
  const resolve = rel => (url ? new URL(rel, directLink(url)).href : rel);
  const results = [], failures = [];
  const fetchRef = async ref => {
    if (!ref.url) {
      if (!(await db.get('packages', ref.id))) failures.push(t('pkg.refMissing', { id: ref.id }));
      return ref.id;
    }
    try {
      const r = await install(await download(resolve(ref.url)), resolve(ref.url));
      results.push(r);
      return r.pkg.id;
    } catch (e) { failures.push(e.message); return ref.id || null; }
  };
  const systemId = await fetchRef(table.system);
  const extensions = [];
  for (const ref of table.packages || []) { const id = await fetchRef(ref); if (id) extensions.push(id); }
  if (table.theme) {
    const themeId = await fetchRef(table.theme);
    if (themeId && !failures.length) await db.setConfig('theme', themeId);
  }
  // The table's order wins: its extensions go to the end of the global list, in that order.
  const o = (await order()).filter(id => !extensions.includes(id));
  await saveOrder([...o, ...extensions]);
  await db.put('packages', { ...table, _source: url, _installed: new Date().toISOString(), _system: systemId, _extensions: extensions });
  return { installed: results, failures, table: { id: table.id, system: systemId, extensions } };
}

/** Reads one or more .json files chosen by the user and installs them. */
export async function installFiles(files) {
  const ok = [], failures = [];
  for (const file of files) {
    try {
      const p = JSON.parse(await file.text());
      if (p?.type === 'table') {
        const r = await installTable(p);
        ok.push(...r.installed);
        failures.push(...r.failures);
      } else ok.push(await install(p, null));
    } catch (e) {
      failures.push(e instanceof SyntaxError ? t('pkg.fileNotJson', { file: file.name, error: e.message }) : `${file.name}: ${e.message}`);
    }
  }
  return { ok, failures };
}

/** Updates a package by downloading it again from its source link. */
export async function update(id) {
  const p = await db.get('packages', id);
  if (!p?._source) throw new Error(t('pkg.noSource'));
  return installFromLink(p._source);
}

export async function uninstall(id) {
  await db.remove('packages', id);
  await saveOrder((await order()).filter(x => x !== id));
}

/**
 * Builds a sheet's rules from its active packages, in global order.
 * Returns { rules, log, warnings, system, active } or throws if the system is missing.
 */
export async function rulesForSheet(sheet) {
  const inst = await installed();
  const system = inst[sheet.system];
  if (!system) throw new Error(t('pkg.systemMissing', { id: sheet.system }));
  const o = await order();
  const active = o.filter(id => (sheet.extensions || []).includes(id));
  const missing = (sheet.extensions || []).filter(id => !inst[id]);
  const warnings = checkSet(system.id, active, inst);
  for (const id of missing) warnings.push({ level: 'error', package: id, msg: t('pkg.extMissing', { id }) });
  const usable = active.filter(id => inst[id] && inst[id].system === system.id);
  const { rules, log } = buildRules(system, usable.map(id => inst[id]));
  // The player's own items live in the sheet and join the collections (same objects, so edits show at once).
  for (const [col, ents] of Object.entries(sheet.custom || {})) {
    if (!rules.collections[col]) continue;
    rules.entities[col] ||= {};
    for (const [id, ent] of Object.entries(ents)) rules.entities[col][id] = ent;
  }
  return { rules, log, warnings, system, active: usable };
}
