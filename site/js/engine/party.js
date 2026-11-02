// ============================================================
// Party (team) resources: formulas over the characters of a party.
//   members('stealth')          the value of 'stealth' in each character (any formula works: members("has('leader')"))
//   sum / avg / min / max(list) over those values (numbers can be mixed in: max(members('x'), 1))
//   count(list)                 how many values are not 0 (e.g. count(members("has('leader')")))
//   size                        how many characters are in the party
// Each character is evaluated with its own calculation (calc.formula), so effects, items and
// conditions all count. A character where the formula fails counts as 0 and the error is reported.
// ============================================================
import { evaluate, compile, identifiers, FormulaError } from './formula.js';

const num = v => (typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0);
const flat = args => args.flat(Infinity).map(num);

/** calcs = [{ name, calc }] (calc from engine/calc.js compute). Returns { value, errors }. */
export function partyValue(formula, calcs) {
  const errors = [];
  const memberValue = (c, f) => {
    try { return num(c.calc.formula(String(f))); } catch (e) { errors.push(`${c.name}: ${e.message}`); return 0; }
  };
  const functions = {
    members: f => calcs.map(c => memberValue(c, f)),
    sum: (...a) => flat(a).reduce((s, x) => s + x, 0),
    avg: (...a) => { const l = flat(a); return l.length ? l.reduce((s, x) => s + x, 0) / l.length : 0; },
    min: (...a) => { const l = flat(a); return l.length ? Math.min(...l) : 0; },
    max: (...a) => { const l = flat(a); return l.length ? Math.max(...l) : 0; },
    count: (...a) => flat(a).filter(x => x !== 0).length,
  };
  try {
    const value = num(evaluate(compile(formula), { functions, vars: { size: calcs.length } }));
    return { value: Number.isFinite(value) ? value : 0, errors };
  } catch (e) {
    return { value: null, errors: [e.message] };
  }
}

/** Checks a party formula when it is written: it must parse and may only use the name "size". */
export function checkPartyFormula(formula) {
  if (typeof formula !== 'string' || !formula.trim() || formula.length > 500) throw new FormulaError('empty');
  const bad = identifiers(compile(formula)).filter(n => n !== 'size');
  if (bad.length) throw new FormulaError(`unknown: ${bad.join(', ')}`);
  return true;
}
