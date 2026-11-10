// ============================================================
// TEMPORARY (remove once the players have moved): turns sheets of the old
// "Fallout TTRPG 2.2" packages into Fallout TTRPG 2.1 + the Gugg's Revision
// extension. Both use the same ids, so the sheet keeps everything; only its
// system and extensions change. The page is ui/convert.js (#/convert-2.2).
// ============================================================
import { buildRules } from './package.js';
import { compute } from './calc.js';

export const MIGRATIONS = [
  { from: 'fallout-2.2-pt', system: 'fallout-2.1-pt', extension: 'fallout-2.1-gugg-pt' },
  { from: 'fallout-2.2-en', system: 'fallout-2.1-en', extension: 'fallout-2.1-gugg-en' },
];
/** The Fallout themes got English ids when they moved to packages/themes. */
export const THEMES = { 'tema-pipboy': 'theme-pipboy', 'tema-vault-tec': 'theme-vault-tec' };

export const migrationFor = sheet => MIGRATIONS.find(m => m.from === sheet?.system) || null;

/**
 * The converted copy of a sheet (the original is left untouched).
 * Other extensions it had stay on the list; those made for the old system
 * no longer apply and are reported in `stale`.
 */
export function convertSheet(sheet, m, inst, now = new Date().toISOString()) {
  const others = (sheet.extensions || []).filter(id => id !== m.extension);
  const extensions = [m.extension, ...others];
  const stale = others.filter(id => inst[id] && inst[id].system !== m.system);
  const versions = { ...(sheet.versions || {}) };
  delete versions[m.from];
  for (const id of [m.system, m.extension]) versions[id] = inst[id]?.version || '0';
  return { sheet: { ...sheet, system: m.system, extensions, versions, updated: now }, stale };
}

/** Rules as the app builds them for a sheet: system + its active extensions, in the given order. */
function rulesFor(inst, order, sheet) {
  const system = inst[sheet.system];
  const exts = order.filter(id => (sheet.extensions || []).includes(id) && inst[id]?.system === system.id).map(id => inst[id]);
  return buildRules(system, exts).rules;
}

/**
 * Checks that the converted sheet shows the same numbers as before: every attribute,
 * skill, derived value, resource and counter. Returns the ones that differ.
 * Needs the old system installed; without it there is nothing to compare (null).
 */
export function compareSheets(before, after, inst, order) {
  if (!inst[before.system] || !inst[after.system]) return null;
  const a = compute(rulesFor(inst, order, before), before);
  const rulesB = rulesFor(inst, order, after);
  const b = compute(rulesB, after);
  const diffs = [];
  for (const sec of ['attributes', 'skills', 'derived', 'resources', 'counters']) {
    for (const id of Object.keys(rulesB[sec] || {})) {
      let x, y;
      try { x = a.value(id); } catch { x = null; }
      try { y = b.value(id); } catch { y = null; }
      if (JSON.stringify(x) !== JSON.stringify(y)) diffs.push({ id, before: x, after: y });
    }
  }
  return diffs;
}
