// ============================================================
// Sharing a sheet with the GM: the invite screen (#/join?gm=…) and the dialog on the sheet.
// Everything from the invite is shown with textContent (h()), never as HTML.
// ============================================================
import * as db from '../storage.js';
import * as share from '../share.js';
import { parseInvite } from '../engine/share.js';
import { t } from '../i18n.js';
import { h, toast, dialog, confirm, byName } from './util.js';

const errorText = e => {
  const key = `share.err.${e.message}`;
  const txt = t(key);
  return (txt === key ? t('share.err.generic', { error: e.message }) : txt) + (e.detail ? ` [${e.detail}]` : '');
};
const when = iso => (iso ? new Date(iso).toLocaleString() : '—');

/** #/join?gm=…&t=…&s=… : the player picks a sheet and confirms the GM's e-mail. */
export async function joinScreen(app, hash) {
  const inv = parseInvite(hash);
  if (!inv) {
    app.append(h('div.card', h('h2', t('share.joinTitle')), h('div.alert.error', t('share.badInvite')), h('a.button', { href: '#/' }, t('common.back'))));
    return;
  }
  const all = (await db.list('sheets')).sort((a, b) => byName(a.name || '', b.name || ''));
  const shared = await share.shares();
  const fits = s => !inv.system || s.system === inv.system;
  let chosen = all.find(s => fits(s) && !shared[s.id])?.id || null;

  const email = h('strong.share-email', inv.email);
  const list = h('div.choices', all.length ? all.map(s => {
    const taken = shared[s.id];
    const off = !fits(s) || !!taken;
    return h('div.choice', { class: chosen === s.id ? 'selected' : '' },
      h('label.choice-main',
        h('input', { type: 'radio', name: 'join-sheet', checked: chosen === s.id, disabled: off, onchange: () => { chosen = s.id; draw(); } }),
        h('span.choice-text', h('strong', s.name || t('common.unnamed')),
          taken ? h('span.choice-desc', t('share.alreadyWith', { email: taken.email }))
            : !fits(s) ? h('span.choice-desc', t('share.otherSystem')) : null)));
  }) : h('p.muted', t('share.noSheets')));

  const button = h('button.primary', { type: 'button', disabled: !chosen, onclick: async () => {
    const sheet = all.find(s => s.id === chosen);
    if (!sheet) return;
    if (!(await confirm(t('share.confirmTitle'), t('share.confirmText', { name: sheet.name || t('common.unnamed'), email: inv.email }), { yes: t('share.confirmYes') }))) return;
    button.disabled = true;
    try {
      await share.share(sheet.id, { email: inv.email, table: inv.table, message: t('share.mailMessage', { name: sheet.name || t('common.unnamed') }) });
      toast(t('share.done', { email: inv.email }));
      location.hash = `#/sheet/${encodeURIComponent(sheet.id)}`;
    } catch (e) { toast(errorText(e), 'error'); button.disabled = false; }
  } }, t('share.shareButton'));

  function draw() {
    app.replaceChildren(h('div.card',
      h('h2', t('share.joinTitle')),
      inv.table ? h('p', t('share.tableName'), ' ', h('strong', inv.table)) : null,
      h('p', t('share.gmIs'), ' ', email),
      h('div.alert', t('share.joinWarning')),
      h('h3', t('share.pickSheet')),
      list,
      h('div.row.spread', { style: { marginTop: '1rem' } }, h('a.button', { href: '#/' }, t('common.cancel')), button)));
    // keep the radio state in step with "chosen"
    list.querySelectorAll('.choice').forEach((el, i) => el.classList.toggle('selected', all[i]?.id === chosen));
    button.disabled = !chosen;
  }
  draw();
}

export async function shareDialog(sheetId) {
  const s = await share.shareOf(sheetId);
  if (!s) {
    const input = h('input', { type: 'url', placeholder: 'https://…#/join?gm=…', 'aria-label': t('share.pasteInvite') });
    dialog(t('share.title'), [
      h('p', t('share.howTo')),
      h('label.field', h('span', t('share.pasteInvite')), input),
    ], { actions: [
      { text: t('common.cancel') },
      { text: t('share.openInvite'), primary: true, action: () => {
        const inv = parseInvite(input.value);
        if (!inv) { toast(t('share.badInvite'), 'error'); return false; }
        const q = new URLSearchParams({ gm: inv.email, ...(inv.table ? { t: inv.table } : {}), ...(inv.system ? { s: inv.system } : {}) });
        location.hash = `#/join?${q}`;
      } },
    ] });
    return;
  }
  const status = h('p.muted.small', t('share.checking'));
  const { close } = dialog(t('share.title'), [
    h('p', t('share.sharedWith'), ' ', h('strong.share-email', s.email)),
    s.table ? h('p', t('share.tableName'), ' ', h('strong', s.table)) : null,
    h('p.muted.small', t('share.since', { date: when(s.since) }), ' · ', t('share.lastUpdate', { date: when(s.last) })),
    h('p', t('share.readOnlyNote')),
    status,
  ], { actions: [
    { text: t('common.close') },
    { text: t('share.stop'), danger: true, action: async () => {
      if (!(await confirm(t('share.stopTitle'), t('share.stopText', { email: s.email }), { yes: t('share.stop'), danger: true }))) return false;
      try { await share.stop(sheetId); toast(t('share.stopped')); window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { toast(errorText(e), 'error'); return false; }
    } },
  ] });
  try {
    const r = await share.check(sheetId);
    if (r.state === 'ok') status.textContent = t('share.stateOk', { email: s.email });
    else if (r.state === 'offline') status.textContent = t('share.stateOffline');
    else if (r.state === 'unsafe') {
      status.replaceChildren(h('span.badge.error', t('share.stateUnsafe')), ' ',
        ...r.perms.filter(p => p.role !== 'owner').map(p => h('span.badge', `${p.emailAddress || p.type} (${p.role})`)));
    } else { close(); toast(t('share.stateGone')); window.dispatchEvent(new HashChangeEvent('hashchange')); }
  } catch (e) { status.textContent = errorText(e); }
}
