// ============================================================
// UI helpers: element creation, toasts, dialogs.
// ============================================================
import { t, getLanguage } from '../i18n.js';

/**
 * Creates an element. h('button.primary', { onclick }, 'Text', child...)
 * Attributes starting with "on" become listeners; "class" and "style" accepted.
 */
export function h(tag, attrs = {}, ...children) {
  if (attrs === null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
    children.unshift(attrs);
    attrs = {};
  }
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ');
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    // A textarea has no value attribute: its text only shows when set as a property.
    else if ((k in el && typeof v !== 'string') || (k === 'value' && name === 'textarea')) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Translates the static page shell: elements with data-i18n (text) or data-i18n-label (aria-label and title). */
export function translateStatic() {
  document.documentElement.lang = getLanguage();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
    el.title = t(el.dataset.i18nLabel);
  }
}

export function clear(el) { while (el.firstChild) el.firstChild.remove(); return el; }

let toastTimer;
/** Quick message at the bottom. kind: 'ok' | 'error' | 'warning' */
export function toast(msg, kind = 'ok') {
  let el = document.getElementById('toast');
  if (!el) { el = h('div', { id: 'toast', role: 'status' }); document.body.append(el); }
  el.textContent = msg;
  el.className = `toast ${kind} visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), kind === 'error' ? 6000 : 2500);
}

/** Opens a modal dialog. Returns { close, body }. */
export function dialog(title, content, { actions = [], width } = {}) {
  const backdrop = h('div.dialog-backdrop');
  const close = () => { backdrop.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  const body = h('div.dialog-body', content);
  const box = h('div.dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, style: width ? { maxWidth: width } : null },
    h('div.dialog-head', h('h2', title), h('button.icon', { 'aria-label': t('common.close'), onclick: close }, '✕')),
    body,
    actions.length ? h('div.dialog-actions', actions.map(a => h(`button${a.primary ? '.primary' : ''}${a.danger ? '.danger' : ''}`, {
      onclick: async () => { if ((await a.action?.()) !== false) close(); },
    }, a.text))) : null);
  backdrop.append(box);
  // Closes on a click outside only when the press also started outside: a text selection dragged past the edge keeps it open.
  let downOutside = false;
  backdrop.addEventListener('pointerdown', e => { downOutside = e.target === backdrop; });
  backdrop.addEventListener('click', e => { if (downOutside && e.target === backdrop) close(); downOutside = false; });
  document.addEventListener('keydown', esc);
  document.body.append(backdrop);
  const first = box.querySelector('input, select, textarea, button.primary');
  first?.focus();
  if (first?.matches('input[type=text], input:not([type])') && first.value) first.select(); // a suggested name ("Encontro 1") is replaced by typing
  return { close, body };
}

/** Simple confirmation. Resolves true/false. */
export function confirm(title, text, { yes = t('common.confirm'), danger = false } = {}) {
  return new Promise(ok => {
    dialog(title, h('p', text), {
      actions: [
        { text: t('common.cancel'), action: () => ok(false) },
        { text: yes, primary: !danger, danger, action: () => ok(true) },
      ],
    });
  });
}

/** Asks the user for text. Resolves the text or null. */
export function ask(title, label, value = '', { placeholder = '' } = {}) {
  return new Promise(ok => {
    const input = h('input', { type: 'text', value, placeholder });
    const { close } = dialog(title, h('label.field', h('span', label), input), {
      actions: [
        { text: t('common.cancel'), action: () => ok(null) },
        { text: 'OK', primary: true, action: () => ok(input.value.trim()) },
      ],
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { ok(input.value.trim()); close(); } });
  });
}

/** Downloads an object as a .json file. */
export function downloadJSON(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** Opens the file picker. Resolves the chosen files. */
export function pickFiles({ multiple = true, accept = '.json,application/json' } = {}) {
  return new Promise(ok => {
    const input = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    input.addEventListener('change', () => { ok([...input.files]); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Formats a number in the interface language: integers plain, fractions up to 2 places. */
export function fmt(n) {
  if (typeof n !== 'number') return String(n ?? '');
  return new Intl.NumberFormat(getLanguage(), { maximumFractionDigits: 2, useGrouping: false }).format(n);
}

export const signed = n => (n > 0 ? `+${fmt(n)}` : fmt(n));

/** Compares text in the interface language, ignoring accents and case. */
export const byName = (a, b) => String(a).localeCompare(String(b), getLanguage(), { sensitivity: 'base' });

export const normalize = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
