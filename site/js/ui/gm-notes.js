// ============================================================
// GM mode, Notes tab: the GM's notebook for one table, with search. It is the sheet's notebook block,
// fed with a small stand-in for the sheet state, and saved in the table (device + the GM's hidden Drive file).
// ============================================================
import * as gm from '../gm.js';
import { t } from '../i18n.js';
import { h, toast } from './util.js';
import { notebookBlock } from './sheet.js';

const view = {}; // tableId → { noteQuery, focusNote }, while the app is open
let timer = null, pending = null;

async function flush() {
  clearTimeout(timer); timer = null;
  const p = pending; pending = null;
  if (p) await gm.saveNotes(p.tableId, p.notes).catch(e => toast(e.message, 'error'));
}
window.addEventListener('hashchange', () => { if (pending) flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pending) flush(); });

export function notesTab({ tb, redraw }) {
  const notes = gm.notesOf(tb);
  const st = (view[tb.id] ||= {});
  st.sheet = { notebooks: { gm: notes } };
  // typing: saved half a second after the last key
  st.save = () => { pending = { tableId: tb.id, notes }; clearTimeout(timer); timer = setTimeout(flush, 500); };
  // a change to the list (new, removed, opened): saved now, then drawn again
  st.change = async () => { pending = { tableId: tb.id, notes }; await flush(); redraw(); };
  return [h('div.card.gm-notes', notebookBlock(st, { id: 'gm', title: t('gmNotes.title') }), h('p.muted.small', t('gmNotes.hint')))];
}
