// ============================================================
// Combat rules that do not depend on the screen: initiative, turn order, a participant's values.
// The system says how combat works in "combat": { "initiative": "1d20 + init", "hp": "hp", "conditions": "conditions",
//   "stats": ["sp", "hp", "ac", "dt"], "damage": ["sp", { "reduce": "dt" }, "hp"] }.
// ============================================================
import { roll } from './calc.js';

/** The initiative roll of the system (its default roll when it has none). */
export const initiativeExpr = rules => String(rules?.combat?.initiative || rules?.rolls?.default || '1d20');

/** HP resource id: the system's choice, else the first resource. */
export const hpId = rules => (rules?.combat?.hp && rules.resources?.[rules.combat.hp] ? rules.combat.hp : Object.keys(rules?.resources || {})[0] || null);

/** Conditions collection id, or null. */
export const conditionsId = rules => (rules?.combat?.conditions && rules.collections?.[rules.combat.conditions] ? rules.combat.conditions : null);

/**
 * The values shown as columns in a fight: the system's "stats" (resources show current/maximum, derived values
 * one number), else only the HP. [{ id, name, abbr, resource }]
 */
export function statColumns(rules) {
  const hp = hpId(rules);
  const ids = Array.isArray(rules?.combat?.stats) ? rules.combat.stats : hp ? [hp] : [];
  return [...new Set(ids.filter(id => typeof id === 'string'))]
    .filter(id => rules.resources?.[id] || rules.derived?.[id]).slice(0, 8)
    .map(id => { const d = rules.resources?.[id] || rules.derived[id]; return { id, name: d.name || id, abbr: d.abbr || d.name || id, resource: !!rules.resources?.[id] }; });
}

/**
 * The order damage goes through: resource ids are emptied in turn, { "reduce": id } takes that value off what is
 * left. Fallout: ["pe", { "reduce": "td" }, "pv"]. Without it, only the HP.
 */
export function damageSteps(rules) {
  const hp = hpId(rules);
  const raw = Array.isArray(rules?.combat?.damage) ? rules.combat.damage : hp ? [hp] : [];
  return raw.filter(s => (typeof s === 'string' && rules.resources?.[s]) || (s && typeof s === 'object' && typeof s.reduce === 'string' && (rules.derived?.[s.reduce] || rules.resources?.[s.reduce] || rules.attributes?.[s.reduce])))
    .slice(0, 10).map(s => (typeof s === 'string' ? s : { reduce: s.reduce }));
}

/** A participant's value: the HP lives in hp/hpMax, the others in vals. { cur, max } (null when unknown). */
export const getVal = (p, id, hp) => (id === hp ? { cur: p.hp ?? null, max: p.hpMax ?? null } : { cur: p.vals?.[id]?.cur ?? null, max: p.vals?.[id]?.max ?? null });
export function setVal(p, id, hp, cur, max) {
  if (id === hp) { p.hp = cur; if (max !== undefined) p.hpMax = max; return; }
  p.vals = p.vals || {};
  const old = p.vals[id] || { cur: null, max: null };
  p.vals[id] = { cur, max: max !== undefined ? max : old.max };
}

/** What a sheet brings to a fight: HP, the other values (columns and damage reductions) and the conditions it already has. */
export const neededIds = rules => { const hp = hpId(rules); return [...new Set([...statColumns(rules).map(c => c.id), ...damageSteps(rules).filter(s => typeof s === 'object').map(s => s.reduce)])].filter(id => id !== hp); };
export function fromSheet(rules, sheet, calc) {
  const hp = hpId(rules);
  let hpMax = null, cur = null;
  if (hp && calc) { try { hpMax = calc.value(hp); cur = sheet.resources?.[hp] ?? hpMax; } catch { hpMax = cur = null; } }
  const vals = {};
  for (const id of calc ? neededIds(rules) : []) {
    const res = !!rules.resources?.[id];
    try {
      const v = calc.value(id);
      vals[id] = res ? { cur: sheet.resources?.[id] ?? v, max: v } : { cur: v, max: null };
    } catch { vals[id] = { cur: null, max: null }; }
  }
  const col = conditionsId(rules);
  const conditions = col ? [...new Set((sheet.items || []).filter(i => i.collection === col && i.ref).map(i => `${col}/${i.ref}`))] : [];
  return { hp: cur, hpMax, vals, conditions };
}

/**
 * What the GM typed in a value's box: "12" sets it, "-5" takes off, "+3" adds. Null when it is not a number.
 * { op: 'set' | 'sub' | 'add', n }
 */
export function parseChange(text) {
  const m = /^\s*([+-])?\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(text ?? ''));
  if (!m) return null;
  const n = Number(m[2].replace(',', '.'));
  return { op: m[1] === '-' ? 'sub' : m[1] === '+' ? 'add' : 'set', n };
}

/**
 * Plans a change to one value, without touching the participant. Damage ("-N") on a value that is in the
 * damage order goes on down the order when cascade is on: what is left after emptying it is reduced by the
 * "reduce" steps and goes to the next resource. Resources do not go below 0 by damage, and healing ("+N")
 * stops at the maximum. Returns [{ id, from, to }] for each value that changes, and { id, reduce } for each
 * reduction used.
 */
export function planChange(rules, p, id, change, { cascade = true } = {}) {
  const hp = hpId(rules);
  const isRes = !!rules.resources?.[id];
  const { cur, max } = getVal(p, id, hp);
  const out = [];
  if (!change) return out;
  if (change.op === 'set') return [{ id, from: cur, to: change.n }];
  if (change.op === 'add') {
    const to = (cur ?? 0) + change.n;
    return [{ id, from: cur, to: isRes && max !== null && (cur ?? 0) <= max ? Math.min(max, to) : to }];
  }
  // Damage.
  const steps = damageSteps(rules);
  const start = steps.indexOf(id);
  if (!isRes || start < 0 || !cascade) {
    const to = (cur ?? 0) - change.n;
    return [{ id, from: cur, to: isRes && start >= 0 ? Math.max(0, to) : to }];
  }
  let left = change.n;
  for (let i = start; i < steps.length && left > 0; i++) {
    const s = steps[i];
    if (typeof s === 'object') {
      const r = Math.max(0, Number(getVal(p, s.reduce, hp).cur) || 0);
      if (r > 0) { out.push({ id: s.reduce, reduce: Math.min(r, left) }); left = Math.max(0, left - r); }
      continue;
    }
    const v = getVal(p, s, hp);
    if (v.cur === null) continue;
    const has = Math.max(0, v.cur);
    const last = !steps.slice(i + 1).some(x => typeof x === 'string' && getVal(p, x, hp).cur !== null);
    const take = last ? left : Math.min(left, has);
    if (take > 0 || s === id) out.push({ id: s, from: v.cur, to: Math.max(0, v.cur - take) });
    left -= take;
  }
  return out;
}

/** Applies a plan from planChange. */
export function applyPlan(rules, p, plan) {
  const hp = hpId(rules);
  for (const x of plan) if ('to' in x) setVal(p, x.id, hp, x.to);
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
