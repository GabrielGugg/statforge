// ============================================================
// Players' names and e-mails on the GM's screens.
// The GM already knows them (Google sends them with each share), but a screen
// can be shown to others or captured. The table setting ownerDisplay says how:
//   'hover'  — blurred until the pointer is over it, it gets focus or it is tapped (default)
//   'never'  — not shown; a neutral word ("a player") takes its place where a sentence needs one
//   'always' — shown as text
// ============================================================
import { t } from '../i18n.js';
import { h } from './util.js';

/** The player's name and/or e-mail as shown on a GM screen, or null when nothing is shown. */
export function ownerTag(text, mode = 'hover') {
  const s = String(text || '').trim();
  if (!s) return null;
  if (mode === 'always') return h('span.owner', s);
  if (mode === 'never') return null;
  // Spoiler: blurred until hovered or focused; a tap (or Enter) keeps it revealed until tapped again.
  const el = h('span.owner.spoiler', { tabindex: '0', role: 'button', 'aria-label': t('gm.ownerReveal'), title: t('gm.ownerReveal'),
    onclick: e => { e.preventDefault(); e.stopPropagation(); el.classList.toggle('revealed'); },
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.classList.toggle('revealed'); } } }, s);
  return el;
}

/** A translated sentence with {owner} replaced by the owner tag (or by "a player" when hidden). */
export function withOwner(key, text, mode, vars = {}) {
  const marker = '\u0000';
  const parts = t(key, { ...vars, owner: marker }).split(marker);
  const tag = ownerTag(text, mode) || t('gm.ownerHidden');
  return parts.flatMap((p, i) => (i ? [tag, p] : [p]));
}
