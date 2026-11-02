import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameAccount, parseInvite, makeInvite, validEmail, snapshot, createShare, updateShare, deleteShare, checkShare, permissionsAreSafe, MAX_SHARE_BYTES } from '../site/js/engine/share.js';

// A small fake Google Drive: files with an owner and permissions. Like the real one,
// it refuses writes from anyone who is not the owner or a writer.
function fakeDrive({ as = 'player@x.com', tamper = null, failPermission = false, canonical = null, noop = false } = {}) {
  const files = new Map();
  const calls = [];
  let n = 0;
  const res = (status, body = {}) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
  const api = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({ method, url, body: opts.body });
    const u = new URL(url);
    const m = u.pathname.match(/\/files(?:\/([\w-]+))?(\/permissions)?(?:\/([\w-]+))?$/);
    const id = m?.[1];
    if (u.pathname.startsWith('/upload') && method === 'POST') {
      const fid = `file${String(++n).padStart(8, '0')}`;
      files.set(fid, { owner: api.as, content: opts.body, perms: [{ id: 'o', type: 'user', role: 'owner', emailAddress: api.as }] });
      return res(200, { id: fid });
    }
    const f = files.get(id);
    if (!f) return res(404);
    const role = f.owner === api.as ? 'owner' : f.perms.find(p => p.emailAddress === api.as)?.role;
    if (!role) return res(404);
    if (m[2] && method === 'POST') {
      if (role !== 'owner') return res(403);
      if (failPermission) return res(400);
      const p = { id: `p${++n}`, ...JSON.parse(opts.body) };
      if (canonical) p.emailAddress = canonical;
      if (!noop) f.perms.push(p);
      if (tamper) f.perms.push(tamper);
      return res(200, { id: p.id });
    }
    if (m[2]) return res(200, { permissions: f.perms });
    if (method === 'PATCH') { if (role !== 'owner' && role !== 'writer') return res(403); f.content = opts.body; return res(200, { id }); }
    if (method === 'DELETE') { if (role !== 'owner') return res(403); files.delete(id); return res(204); }
    return res(200, JSON.parse(f.content.split('\r\n\r\n').pop().split('\r\n--')[0]));
  };
  api.as = as; api.files = files; api.calls = calls;
  return api;
}
const sheet = { id: 's1', name: 'Rex <img src=x onerror=alert(1)>', system: 'fallout-2.2-pt', extensions: [], attributes: {} };
const inst = { 'fallout-2.2-pt': { version: '1.15.0' } };

test('invite links: valid ones parse, anything odd is refused', () => {
  const link = makeInvite('https://gabrielgugg.github.io/statforge/site/#/settings', { email: 'GM@Mesa.com', table: 'Vault Texas', system: 'fallout-2.2-pt' });
  assert.match(link, /^https:\/\/gabrielgugg\.github\.io\/statforge\/site\/#\/join\?gm=gm%40mesa\.com/);
  assert.deepEqual(parseInvite(link), { email: 'gm@mesa.com', table: 'Vault Texas', system: 'fallout-2.2-pt' });
  for (const bad of ['', 'https://x/#/join?gm=notanemail', 'https://x/#/join?gm=a@b.com%20<script>', 'https://x/#/join?gm="a"@b.com', 'gm=a@b', 'x'.repeat(3000)]) assert.equal(parseInvite(bad), null, bad);
  // hidden direction-override characters are stripped from the table name; a bad system id is dropped
  const p = parseInvite('#/join?gm=a@b.com&t=Mesa‮evil&s=../../x');
  assert.equal(p.table, 'Mesaevil'); assert.equal(p.system, '');
  assert.equal(validEmail('a@b.co'), true); assert.equal(validEmail('a@b'), false); assert.equal(validEmail('a b@c.com'), false);
});

test('snapshot carries the sheet and package versions, and refuses huge sheets', () => {
  const s = JSON.parse(snapshot(sheet, inst, '1.3.0'));
  assert.equal(s.statforge_share, 1); assert.deepEqual(s.packages, [{ id: 'fallout-2.2-pt', version: '1.15.0' }]); assert.equal(s.sheet.name, sheet.name);
  assert.throws(() => snapshot({ ...sheet, notes: 'x'.repeat(MAX_SHARE_BYTES) }, inst, '1.3.0'), /SHARE_TOO_BIG/);
});

test('sharing gives exactly one reader permission, and the GM cannot write', async () => {
  const api = fakeDrive();
  const { fileId } = await createShare(api, { sheet, body: snapshot(sheet, inst, '1.3.0'), email: 'gm@mesa.com' });
  const perms = api.files.get(fileId).perms;
  assert.equal(perms.length, 2);
  assert.deepEqual(perms[1], { id: perms[1].id, type: 'user', role: 'reader', emailAddress: 'gm@mesa.com' });
  assert.ok(!api.calls.some(c => /anyone|writer/.test(c.body || '')), 'never anyone/writer');
  // The GM (reader) tries to write or delete: Drive refuses.
  api.as = 'gm@mesa.com';
  await assert.rejects(updateShare(api, fileId, '{"hacked":true}'), /DRIVE_403/);
  await assert.rejects(deleteShare(api, fileId), /DRIVE_403/);
  assert.equal(JSON.parse(api.files.get(fileId).content.split('\r\n\r\n').pop().split('\r\n--')[0]).sheet.id, 's1');
});

test('unexpected access or a failed permission deletes the copy at once', async () => {
  const api = fakeDrive({ tamper: { id: 'x', type: 'anyone', role: 'reader' } });
  await assert.rejects(createShare(api, { sheet, body: '{}', email: 'gm@mesa.com' }), /SHARE_UNEXPECTED_ACCESS/);
  assert.equal(api.files.size, 0);
  const api2 = fakeDrive({ failPermission: true });
  await assert.rejects(createShare(api2, { sheet, body: '{}', email: 'gm@mesa.com' }), /DRIVE_400/);
  assert.equal(api2.files.size, 0);
  const before = api2.calls.length;
  await assert.rejects(createShare(api2, { sheet, body: '{}', email: 'not an email' }), /INVALID_EMAIL/);
  assert.equal(api2.calls.length, before, 'bad e-mail: nothing sent to Drive');
});

test('checking a share: ok, extra access, revoked, gone; stopping deletes the file', async () => {
  const api = fakeDrive();
  const { fileId } = await createShare(api, { sheet, body: '{}', email: 'gm@mesa.com' });
  assert.equal((await checkShare(api, fileId, 'gm@mesa.com')).state, 'ok');
  api.files.get(fileId).perms.push({ id: 'z', type: 'user', role: 'reader', emailAddress: 'stranger@x.com' });
  assert.equal((await checkShare(api, fileId, 'gm@mesa.com')).state, 'unsafe');
  api.files.get(fileId).perms = api.files.get(fileId).perms.filter(p => p.emailAddress !== 'gm@mesa.com');
  assert.equal((await checkShare(api, fileId, 'gm@mesa.com')).state, 'revoked');
  await deleteShare(api, fileId);
  assert.equal(api.files.size, 0);
  assert.equal((await checkShare(api, fileId, 'gm@mesa.com')).state, 'gone');
  await deleteShare(api, fileId); // already gone: not an error
  assert.equal(permissionsAreSafe([{ role: 'owner' }, { type: 'user', role: 'writer', emailAddress: 'gm@mesa.com' }], 'gm@mesa.com'), false);
});

test('Gmail spellings count as the same account; self-share and silent no-ops are refused', async () => {
  assert.equal(sameAccount('Plinio.Aug+rpg@gmail.com', 'plinioaug@gmail.com'), true);
  assert.equal(sameAccount('a.b@empresa.com', 'ab@empresa.com'), false);
  // Drive answers with the account's own spelling: still the right reader, share is kept
  const api = fakeDrive({ canonical: 'plinioaug@gmail.com' });
  const { fileId } = await createShare(api, { sheet, body: '{}', email: 'plinio.aug@gmail.com' });
  assert.equal(api.files.size, 1);
  assert.equal((await checkShare(api, fileId, 'plinio.aug@gmail.com')).state, 'ok');
  const api2 = fakeDrive();
  await assert.rejects(createShare(api2, { sheet, body: '{}', email: 'Player@x.com', ownEmail: 'player@x.com' }), /SHARE_SELF/);
  assert.equal(api2.calls.length, 0);
  const api3 = fakeDrive({ noop: true });
  await assert.rejects(createShare(api3, { sheet, body: '{}', email: 'gm@mesa.com' }), e => e.message === 'SHARE_NOT_GRANTED' && e.detail === 'owner (user)');
  assert.equal(api3.files.size, 0);
});
