// ============================================================
// New sheet: name, system, active extensions (or a table).
// ============================================================
import * as db from '../storage.js';
import * as pk from '../packages.js';
import { checkSet } from '../engine/package.js';
import { emptySheet } from '../engine/calc.js';
import { t } from '../i18n.js';
import { h, toast, uid, byName } from './util.js';
import { languageBadge } from './packages.js';
import { creationWizard } from './creation.js';

export async function newSheetScreen(app) {
  const inst = await pk.installed();
  const order = await pk.order();
  const systems = Object.values(inst).filter(p => p.type === 'system').sort((a, b) => byName(a.name, b.name));
  const tables = Object.values(inst).filter(p => p.type === 'table' && inst[p._system]);

  if (!systems.length) {
    app.append(h('div.card.empty', h('p', t('new.needSystem')), h('a.button.primary', { href: '#/packages' }, t('new.goPackages'))));
    return;
  }

  const name = h('input', { type: 'text', placeholder: t('new.namePlaceholder'), required: true });
  const selSystem = h('select', systems.map(s => h('option', { value: s.id }, `${s.name} (v${s.version || '0'}${s.language ? `, ${s.language}` : ''})`)));
  const extBox = h('div');
  const warnBox = h('div');
  const useWizard = h('input', { type: 'checkbox', checked: true });
  const wizardRow = h('label.check', useWizard, h('span', t('new.useWizard')));
  const updateWizardRow = () => { wizardRow.hidden = !inst[selSystem.value]?.creation?.steps?.length; };
  let checked = new Set();

  function drawExtensions() {
    const sid = selSystem.value;
    const exts = order.filter(id => inst[id]?.system === sid);
    extBox.replaceChildren(exts.length
      ? h('div', exts.map(id => h('label.check',
        h('input', { type: 'checkbox', checked: checked.has(id), onchange: e => { e.target.checked ? checked.add(id) : checked.delete(id); check(); } }),
        h('span', inst[id].name, h('span.muted.small', ` v${inst[id].version || '0'} `), languageBadge(inst[id])))))
      : h('p.muted.small', t('new.noExtensions')));
    check();
  }
  function check() {
    const active = order.filter(id => checked.has(id));
    const w = checkSet(selSystem.value, active, inst);
    warnBox.replaceChildren(...(w.length ? [h('div.alert', { class: w.some(a => a.level === 'error') ? 'error' : '' },
      h('ul', w.map(a => h('li', `${inst[a.package]?.name || a.package}: ${a.msg}`))))] : []));
  }
  selSystem.addEventListener('change', () => { checked = new Set(); drawExtensions(); updateWizardRow(); });

  const selTable = tables.length ? h('select', { onchange: e => {
    const m = inst[e.target.value];
    if (!m) return;
    selSystem.value = m._system;
    checked = new Set(m._extensions || []);
    drawExtensions();
    updateWizardRow();
  } }, h('option', { value: '' }, t('new.manual')), tables.map(m => h('option', { value: m.id }, m.name))) : null;

  async function create(e) {
    e.preventDefault();
    const sid = selSystem.value;
    const active = order.filter(id => checked.has(id));
    try {
      const { rules } = await pk.rulesForSheet({ system: sid, extensions: active });
      const base = emptySheet(rules, {
        id: uid(), name: name.value.trim(), system: sid, extensions: active,
        versions: Object.fromEntries([sid, ...active].map(id => [id, inst[id]?.version || '0'])),
        created: new Date().toISOString(), updated: new Date().toISOString(),
      });
      const save = async sheet => {
        try {
          await db.put('sheets', sheet);
          location.hash = `#/sheet/${encodeURIComponent(sheet.id)}`;
        } catch (err) { toast(err.message, 'error'); }
      };
      if (useWizard.checked && rules.creation?.steps?.length) {
        app.replaceChildren();
        creationWizard(app, { rules, inst, base, onDone: save, onSkip: () => save(base) });
      } else await save(base);
    } catch (err) { toast(err.message, 'error'); }
  }

  app.append(h('form.card.narrow', { onsubmit: create },
    h('h1', t('new.title')),
    h('label.field', h('span', t('new.name')), name),
    selTable ? h('label.field', h('span', t('new.table')), selTable) : null,
    h('label.field', h('span', t('type.system')), selSystem),
    h('fieldset', { style: { border: 0, padding: 0, margin: '0 0 .75rem' } },
      h('legend.muted.small', t('new.extensionsLegend')), extBox),
    wizardRow,
    warnBox,
    h('div.row', h('button.primary', { type: 'submit' }, t('new.create')), h('a.button', { href: '#/' }, t('common.cancel')))));
  drawExtensions();
  updateWizardRow();
  name.focus();
}
