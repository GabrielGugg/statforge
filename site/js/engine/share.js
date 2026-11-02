// ============================================================
// Sharing a sheet with the GM through Google Drive (no DOM, no storage: testable).
//
// Safety rules this file enforces:
// - The shared copy is a separate file in the PLAYER's Drive. The player's app only
//   ever writes to it, never reads it back, so nothing anyone else does to it can
//   change the real sheet.
// - The GM gets exactly one permission: role "reader", type "user", one e-mail.
//   Never "anyone with the link", never "writer". After sharing, the permissions
//   are read back; anything unexpected deletes the file at once.
// - Everything that comes from outside (an invite link, a shared file) is checked
//   before use and only ever shown as text.
// ============================================================

export const FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const SHARE_FORMAT = 1;
export const MAX_SHARE_BYTES = 2 * 1024 * 1024;
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

// Conservative e-mail check: one @, no spaces, quotes or angle brackets, a dot in the domain.
const EMAIL = /^[^\s@<>"'`()\\,;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
export const validEmail = e => typeof e === 'string' && e.length <= 254 && EMAIL.test(e);
const SYSTEM_ID = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
// Control and bidirectional-override characters could disguise what is shown (for example an e-mail
// that reads differently than it is), so they are removed from any text that comes in.
const cleanText = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').trim().slice(0, max);

/** Invite link the GM sends to the group: the site address + #/join?gm=…&t=…&s=… */
export function makeInvite(base, { email, table = '', system = '' }) {
  if (!validEmail(email)) throw new Error('INVALID_EMAIL');
  const q = new URLSearchParams({ gm: email.trim().toLowerCase() });
  if (table) q.set('t', cleanText(table, 80));
  if (system && SYSTEM_ID.test(system)) q.set('s', system);
  return `${String(base).split('#')[0]}#/join?${q}`;
}

/** Reads an invite (a whole link or just the part after "#/join?"). Returns null when it is not a valid one. */
export function parseInvite(text) {
  const raw = String(text ?? '').trim();
  if (raw.length > 2000) return null;
  const i = raw.indexOf('#/join?');
  const query = i >= 0 ? raw.slice(i + 7) : raw.startsWith('gm=') ? raw : null;
  if (query == null) return null;
  const q = new URLSearchParams(query);
  const email = cleanText(q.get('gm'), 254).toLowerCase();
  if (!validEmail(email)) return null;
  const system = q.get('s') || '';
  return { email, table: cleanText(q.get('t'), 80), system: SYSTEM_ID.test(system) ? system : '' };
}

/** What goes into the shared file: the sheet plus which packages (and versions) it uses. */
export function snapshot(sheet, installed, appVersion) {
  const ids = [sheet.system, ...(sheet.extensions || [])].filter(Boolean);
  const data = {
    statforge_share: SHARE_FORMAT,
    app: appVersion,
    shared: new Date().toISOString(),
    packages: ids.map(id => ({ id, version: installed?.[id]?.version ?? null })),
    sheet,
  };
  const body = JSON.stringify(data);
  if (new TextEncoder().encode(body).length > MAX_SHARE_BYTES) throw new Error('SHARE_TOO_BIG');
  return body;
}

export const shareFileName = sheet => `StatForge - ${cleanText(sheet.name, 60) || 'Character'}.json`;

/**
 * Same Google account? Gmail ignores dots and "+anything" in the name, and Drive answers with the
 * account's own spelling, so "Player.Example+rpg@gmail.com" and "playerexample@gmail.com" are the same person.
 */
export function sameAccount(a, b) {
  const norm = e => {
    let [user = '', domain = ''] = String(e || '').trim().toLowerCase().split('@');
    if (domain === 'googlemail.com') domain = 'gmail.com';
    if (domain === 'gmail.com') user = user.split('+')[0].replace(/\./g, '');
    return `${user}@${domain}`;
  };
  return !!a && !!b && norm(a) === norm(b);
}

const isTheReader = (p, email) => p.type === 'user' && p.role === 'reader' && sameAccount(p.emailAddress, email);

/** Only the owner and the one reader may be on the file. */
export function permissionsAreSafe(perms, email) {
  let reader = false;
  for (const p of perms || []) {
    if (p.role === 'owner') continue;
    if (isTheReader(p, email) && !reader) { reader = true; continue; }
    return false;
  }
  return reader;
}

/** Short description of permissions for error messages (no e-mails: "owner, reader (user), reader (anyone)"). */
export const describePermissions = perms => (perms || []).map(p => `${p.role} (${p.type})`).join(', ');

async function ok(r) {
  if (!r.ok) {
    const err = new Error(`DRIVE_${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r;
}

/**
 * Creates the shared copy and gives the GM read access.
 * api(url, opts) = an authorised fetch (sync.js driveRequest), passed in so tests can use a fake Drive.
 * Returns { fileId, permissionId }.
 */
export async function createShare(api, { sheet, body, email, message = '', ownEmail = '' }) {
  if (!validEmail(email)) throw new Error('INVALID_EMAIL');
  // Sharing with yourself gives no permission at all (you already own the file).
  if (sameAccount(email, ownEmail)) throw new Error('SHARE_SELF');
  const boundary = `sf${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const meta = JSON.stringify({
    name: shareFileName(sheet), mimeType: 'application/json',
    description: 'StatForge character sheet shared read-only with the GM. Delete this file to stop sharing.',
    appProperties: { statforge: 'share', sheet: String(sheet.id).slice(0, 100) },
    // Readers may not download, print or copy it through Drive's own screens.
    copyRequiresWriterPermission: true,
  });
  const created = await (await ok(await api(`${UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`,
  }))).json();
  const fileId = created.id;
  if (!fileId || !/^[\w-]{10,200}$/.test(fileId)) throw new Error('DRIVE_BAD_ID');
  try {
    const q = new URLSearchParams({ sendNotificationEmail: 'true', fields: 'id' });
    if (message) q.set('emailMessage', cleanText(message, 300));
    const perm = await (await ok(await api(`${API}/${fileId}/permissions?${q}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: email }),
    }))).json();
    const perms = await listPermissions(api, fileId);
    if (!perms.some(p => isTheReader(p, email))) { const e = new Error('SHARE_NOT_GRANTED'); e.detail = describePermissions(perms); throw e; }
    if (!permissionsAreSafe(perms, email)) { const e = new Error('SHARE_UNEXPECTED_ACCESS'); e.detail = describePermissions(perms); throw e; }
    return { fileId, permissionId: perm.id };
  } catch (e) {
    // Never leave a half-shared copy behind.
    await api(`${API}/${fileId}`, { method: 'DELETE' }).catch(() => {});
    throw e;
  }
}

export async function listPermissions(api, fileId) {
  const r = await ok(await api(`${API}/${fileId}/permissions?fields=permissions(id,type,role,emailAddress)`, {}));
  return (await r.json()).permissions || [];
}

/** Rewrites the content of the shared copy. Only the file we created; only its content. */
export async function updateShare(api, fileId, body) {
  await ok(await api(`${UPLOAD}/${fileId}?uploadType=media&fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }));
}

/** Stops sharing by deleting the copy: every permission goes with it. A copy already gone counts as stopped. */
export async function deleteShare(api, fileId) {
  const r = await api(`${API}/${fileId}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) await ok(r);
}

/**
 * State of a share: 'ok' (only the GM reads it), 'gone' (the file was deleted, e.g. in Drive),
 * or 'unsafe' (someone else got access, e.g. by changing it in Drive).
 */
export async function checkShare(api, fileId, email) {
  try {
    const perms = await listPermissions(api, fileId);
    if (!perms.some(p => isTheReader(p, email))) return { state: 'revoked', perms };
    return { state: permissionsAreSafe(perms, email) ? 'ok' : 'unsafe', perms };
  } catch (e) {
    if (e.status === 404) return { state: 'gone', perms: [] };
    throw e;
  }
}
