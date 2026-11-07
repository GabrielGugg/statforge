// ============================================================
// Combat rules that do not depend on the screen: initiative, turn order, a participant's values.
// The system says how combat works in "combat": { "initiative": "1d20 + init", "hp": "hp", "conditions": "conditions" }.
// ============================================================
import { roll } from './calc.js';

/** The initiative roll of the system (its default roll when it has none). */
export const initiativeExpr = rules => String(rules?.combat?.initiative || rules?.rolls?.default || '1d20');

/** HP resource id: the system's choice, else the first resource. */
export const hpId = rules => (rules?.combat?.hp && rules.resources?.[rules.combat.hp] ? rules.combat.hp : Object.keys(rules?.resources || {})[0] || null);

/** Conditions collection id, or null. */
export const conditionsId = rules => (rules?.combat?.conditions && rules.collections?.[rules.combat.conditions] ? rules.combat.conditions : null);

/** What a sheet brings to a fight: current and maximum HP and the conditions it already has. */
export function fromSheet(rules, sheet, calc) {
  const hp = hpId(rules);
  let hpMax = null, cur = null;
  if (hp && calc) { try { hpMax = calc.value(hp); cur = sheet.resources?.[hp] ?? hpMax; } catch { hpMax = cur = null; } }
  const col = conditionsId(rules);
  const conditions = col ? [...new Set((sheet.items || []).filter(i => i.collection === col && i.ref).map(i => `${col}/${i.ref}`))] : [];
  return { hp: cur, hpMax, conditions };
}

/** Rolls initiative. Returns { total, details } or null when it cannot be rolled. */
export function rollInitiative(rules, calc, random = Math.random) {
  try { const r = roll(initiativeExpr(rules), calc, random); return Number.isFinite(r.total) ? r : null; } catch { return null; }
}

/** Who the app rolls for, by the table setting: 'all' | 'npcs' | 'none'. */
export const autoRolls = (mode, p) => mode === 'all' || (mode === 'npcs' && (p.npc || p.kind === 'comp'));

/**
 * Highest initiative first. Ties (and blanks, which go last) keep their current order, so the GM decides
 * them by dragging. The one whose turn it is stays the one whose turn it is.
 */
export function sortByInitiative(enc) {
  const current = enc.participants[enc.turn]?.id;
  const keyed = enc.participants.map((p, i) => ({ p, i }));
  keyed.sort((a, b) => (b.p.init ?? -Infinity) - (a.p.init ?? -Infinity) || a.i - b.i);
  enc.participants = keyed.map(x => x.p);
  enc.turn = Math.max(0, enc.participants.findIndex(p => p.id === current));
}

/** Next turn; after the last one a new round starts. */
export function nextTurn(enc) {
  if (!enc.participants.length) return;
  if (!enc.started) { enc.started = true; enc.turn = 0; enc.round = 1; return; }
  enc.turn += 1;
  if (enc.turn >= enc.participants.length) { enc.turn = 0; enc.round += 1; }
}
export function prevTurn(enc) {
  if (!enc.participants.length || !enc.started) return;
  enc.turn -= 1;
  if (enc.turn < 0) { if (enc.round > 1) { enc.round -= 1; enc.turn = enc.participants.length - 1; } else enc.turn = 0; }
}

/** Moves a participant to another position (drag), keeping the turn on the same one. */
export function move(enc, id, toIndex) {
  const from = enc.participants.findIndex(p => p.id === id);
  if (from < 0) return;
  const current = enc.participants[enc.turn]?.id;
  const [p] = enc.participants.splice(from, 1);
  enc.participants.splice(Math.max(0, Math.min(enc.participants.length, toIndex)), 0, p);
  enc.turn = Math.max(0, enc.participants.findIndex(x => x.id === current));
}

/** Removes one and keeps the turn sensible. */
export function remove(enc, id) {
  const i = enc.participants.findIndex(p => p.id === id);
  if (i < 0) return;
  enc.participants.splice(i, 1);
  if (i < enc.turn) enc.turn -= 1;
  if (enc.turn >= enc.participants.length) enc.turn = 0;
}

/** "Raider" ×3 → "Raider 1", "Raider 2", "Raider 3", continuing after the ones already there. */
export function numberedNames(base, count, existing) {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
  let n = Math.max(0, ...existing.map(x => Number(re.exec(x)?.[1] || 0)));
  if (count === 1 && !n && !existing.includes(base)) return [base];
  return Array.from({ length: count }, () => `${base} ${++n}`);
}
