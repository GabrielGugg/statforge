// ============================================================
// Small Markdown reader for the app's own documents (changelog, guide).
// Builds DOM nodes, never HTML text: whatever the file says shows as text.
// Supports headings, paragraphs, lists (- and 1.), quotes (>), **bold**, `code`
// and links. Links go out only to https (new tab, no referrer); links to the
// app itself become in-app links; links to other .md files show as plain text.
// ============================================================
import { h } from './util.js';

const APP = 'https://gabrielgugg.github.io/statforge/site/';

/** Where a Markdown link may go: an in-app hash, an https page, or nowhere (null). */
export function linkTarget(url) {
  const u = String(url || '').trim();
  if (u.startsWith(APP)) return { href: `#/${u.slice(APP.length).replace(/^#?\/?/, '')}`, internal: true };
  if (/^#\//.test(u)) return { href: u, internal: true };
  if (/^https:\/\//i.test(u)) { try { return { href: new URL(u).href, internal: false }; } catch { return null; } }
  return null;
}

function inline(text) {
  const frag = document.createDocumentFragment();
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|https:\/\/[^\s)]+)/g;
  let last = 0;
  for (const m of String(text).matchAll(re)) {
    if (m.index > last) frag.append(text.slice(last, m.index));
    const p = m[0];
    if (p.startsWith('**')) frag.append(h('strong', p.slice(2, -2)));
    else if (p.startsWith('`')) frag.append(h('code', p.slice(1, -1)));
    else {
      const [, label, url] = p.startsWith('[') ? p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) : [p, p, p];
      const to = linkTarget(url);
      if (!to) frag.append(label);
      else if (to.internal) frag.append(h('a', { href: to.href }, label));
      else frag.append(h('a', { href: to.href, target: '_blank', rel: 'noopener noreferrer' }, label));
    }
    last = m.index + p.length;
  }
  if (last < String(text).length) frag.append(String(text).slice(last));
  return frag;
}

/**
 * Markdown text → list of nodes. options.skipLanguageLine drops a first-lines link that only
 * switches to the other language's file ("[Read in English](GUIDE.md)"), which makes no sense in the app.
 */
export function markdown(txt, { skipLanguageLine = true, headingOffset = 1 } = {}) {
  const out = [];
  let list = null, listTag = null, quote = null;
  const close = () => { list = null; listTag = null; quote = null; };
  for (const raw of String(txt).replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (skipLanguageLine && /^\[[^\]]+\]\([^)]*\.md\)$/.test(line.trim())) continue;
    const head = line.match(/^(#{1,4})\s+(.*)/);
    if (head) { close(); out.push(h(`h${Math.min(4, head[1].length + headingOffset)}`, inline(head[2]))); continue; }
    const q = line.match(/^>\s?(.*)/);
    if (q) {
      list = null; listTag = null;
      if (!quote) { quote = h('div.alert'); out.push(quote); }
      if (q[1].trim()) quote.append(h('p', { style: { margin: '.2rem 0' } }, inline(q[1])));
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)/), num = line.match(/^\s*\d+\.\s+(.*)/);
    if (bullet || num) {
      quote = null;
      const tag = bullet ? 'ul' : 'ol';
      // An indented bullet under a numbered step stays inside that step.
      if (/^\s{2,}/.test(line) && list?.lastElementChild) {
        let sub = list.lastElementChild.querySelector(':scope > ul, :scope > ol');
        if (!sub) { sub = h(tag); list.lastElementChild.append(sub); }
        sub.append(h('li', inline((bullet || num)[1])));
        continue;
      }
      if (!list || listTag !== tag) { list = h(tag); listTag = tag; out.push(list); }
      list.append(h('li', inline((bullet || num)[1])));
      continue;
    }
    close();
    if (line.trim()) out.push(h('p', inline(line.trim())));
  }
  return out;
}
