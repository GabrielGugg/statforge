// ============================================================
// Roll tables: a die and rows with ranges ("1-4: acid rain"). Used by the GM's tables (and later the shield).
// Plain data; the text of a row is shown as text, never as HTML.
// ============================================================
import { roll } from './calc.js';

export const MAX_TABLES = 100, MAX_ROWS = 200, MAX_TEXT = 500;
const DICE = /^\s*(\d{0,3})d(\d{1,4})\s*(?:([+-])\s*(\d{1,4}))?\s*$/i;
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g, '').trim().slice(0, max) : '');
const int = v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);

export const validDice = d => DICE.test(String(d || ''));

/** Lowest and highest result of a dice expression like "2d6+1". */
export function diceRange(d) {
  const m = DICE.exec(String(d || ''));
  if (!m) return null;
  const n = Number(m[1] || 1), f = Number(m[2]), k = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
  return [n + k, n * f + k];
}

/** One table, checked and cleaned. Returns null when it cannot be used. */
export function normalizeTable(tb, newId) {
  if (!tb || typeof tb !== 'object') return null;
  const rows = (Array.isArray(tb.rows) ? tb.rows : []).map(r => ({ from: int(r?.from), to: int(r?.to ?? r?.from), text: clean(r?.text, MAX_TEXT) }))
    .filter(r => r.from !== null && r.to !== null && r.text).map(r => (r.from > r.to ? { ...r, from: r.to, to: r.from } : r)).slice(0, MAX_ROWS);
  const name = clean(tb.name, 80);
  if (!name) return null;
  const dice = validDice(tb.dice) ? String(tb.dice).replace(/\s+/g, '') : `1d${Math.max(1, rows.length)}`;
  const id = typeof tb.id === 'string' && /^[\w-]{1,40}$/.test(tb.id) ? tb.id : newId();
  return { id, name, dice, rows, description: clean(tb.description, 1000) };
}

/**
 * Text → rows. One per line: "1-4: text", "5: text", "7–8 text". Lines without a range are numbered
 * after the last one. Returns { rows, dice } (a suggested die when none fits).
 */
export function parseRows(text) {
  const rows = [];
  let next = 1;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(\d{1,4})(?:\s*(?:[-–—]|a|to|até)\s*(\d{1,4}))?(?:\s*[:.)|–—-]\s*|\s+)(.+)$/i.exec(line);
    if (m) { const from = Number(m[1]), to = Number(m[2] || m[1]); rows.push({ from: Math.min(from, to), to: Math.max(from, to), text: m[3].trim().slice(0, MAX_TEXT) }); next = Math.max(from, to) + 1; }
    else { rows.push({ from: next, to: next, text: line.slice(0, MAX_TEXT) }); next += 1; }
    if (rows.length >= MAX_ROWS) break;
  }
  const max = Math.max(0, ...rows.map(r => r.to));
  return { rows, dice: [4, 6, 8, 10, 12, 20, 100].includes(max) ? `1d${max}` : `1d${Math.max(1, max)}` };
}

/** Rows → editable text. */
export const rowsText = rows => rows.map(r => `${r.from === r.to ? r.from : `${r.from}-${r.to}`}: ${r.text}`).join('\n');

/** Results of the die that no row covers. */
export function gaps(tb) {
  const range = diceRange(tb.dice);
  if (!range) return [];
  const out = [];
  for (let v = range[0]; v <= range[1] && out.length < 50; v++) if (!tb.rows.some(r => v >= r.from && v <= r.to)) out.push(v);
  return out;
}

/** Rolls dice written inside a result ("2d10 caps" → "13 caps"). Returns { text, details }. */
export function rollInline(text, random = Math.random) {
  const details = [];
  const out = String(text).replace(/\b(\d{0,3})d(\d{1,4})(\s*[+-]\s*\d{1,4})?\b/gi, expr => {
    const r = roll(expr.replace(/\s+/g, ''), null, random);
    details.push(`${expr.trim()} = ${r.total}`);
    return String(r.total);
  });
  return { text: out, details };
}

/** Rolls a table. Returns { total, row (or null), text, details }. */
export function rollTable(tb, random = Math.random) {
  const r = roll(tb.dice, null, random);
  const row = tb.rows.find(x => r.total >= x.from && r.total <= x.to) || null;
  const inline = row ? rollInline(row.text, random) : { text: '', details: [] };
  return { total: r.total, row, text: inline.text, details: [...r.details, ...inline.details] };
}

/** File format for export/import. */
export const FILE_KIND = 'statforge_tables';
export const exportFile = list => ({ [FILE_KIND]: 1, tables: list.map(({ id, name, dice, rows, description }) => ({ id, name, dice, rows, description })) });
export function importFile(data, newId) {
  if (!data || typeof data !== 'object' || (data[FILE_KIND] !== 1 && !Array.isArray(data.tables))) throw new Error('TABLES_INVALID');
  const list = (Array.isArray(data.tables) ? data.tables : []).map(x => normalizeTable({ ...x, id: null }, newId)).filter(Boolean).slice(0, MAX_TABLES);
  if (!list.length) throw new Error('TABLES_INVALID');
  return list;
}
