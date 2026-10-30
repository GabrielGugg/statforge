// ============================================================
// Themes: built-in light and dark; others come as "theme" packages.
// ============================================================
import * as db from '../storage.js';

const STYLE_ID = 'theme-package';

/** Applies the saved theme: 'auto' | 'light' | 'dark' | id of a theme package. */
export async function applyTheme() {
  const choice = await db.getConfig('theme', 'auto');
  const root = document.documentElement;
  document.getElementById(STYLE_ID)?.remove();
  root.removeAttribute('data-theme');
  if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
  else if (choice !== 'auto') {
    const p = await db.get('packages', choice);
    if (p?.type === 'theme') inject(p);
  }
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#ffffff');
}

/** Builds the CSS for a theme package. Accepts flat colors or { light, dark }. */
export function themeCss(p) {
  const block = colors => Object.entries(colors || {})
    .filter(([k, v]) => /^--[a-z0-9-]+$/i.test(k) && /^[#a-z0-9(),.%\s-]+$/i.test(String(v)))
    .map(([k, v]) => `${k}: ${v};`).join(' ');
  const font = p.font && /^[\w\s'",-]+$/.test(p.font) ? `--font: ${p.font};` : '';
  if (p.colors?.light || p.colors?.dark) {
    // Repeated selector so it beats the built-in light/dark rules.
    return `:root:root:root { ${block(p.colors.light || p.colors.dark)} ${font} color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:root:root { ${block(p.colors.dark || p.colors.light)} color-scheme: dark; } }`;
  }
  return `:root:root:root { ${block(p.colors)} ${font} color-scheme: ${p.scheme === 'light' ? 'light' : 'dark'}; }`;
}

function inject(p) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = themeCss(p);
  document.head.append(s);
}
