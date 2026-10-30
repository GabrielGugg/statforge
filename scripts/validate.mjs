// Validates .json packages from the command line, without opening the app.
//   npm run validate -- path/package.json [other.json ...]
// Messages follow the LANG environment variable (e.g. LANG=pt_BR.UTF-8).
import { readFileSync } from 'node:fs';
import { validatePackage } from '../site/js/engine/package.js';
import { setLanguage, matchLanguage } from '../site/js/i18n.js';

setLanguage(matchLanguage(String(process.env.LANG || 'en').split('.')[0].replace('_', '-')));
const files = process.argv.slice(2);
if (!files.length) { console.log('Usage: npm run validate -- package.json [other.json ...]'); process.exit(1); }
let failed = false;
for (const file of files) {
  let p;
  try { p = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.log(`✗ ${file}: invalid JSON (${e.message})`); failed = true; continue; }
  const { errors, warnings } = validatePackage(p);
  console.log(`${errors.length ? '✗' : '✓'} ${file} — ${p.name || p.id || '?'} (${p.type || '?'}${p.language ? `, ${p.language}` : ''})`);
  for (const e of errors) console.log(`   error: ${e}`);
  for (const w of warnings) console.log(`   warning: ${w}`);
  if (errors.length) failed = true;
}
process.exit(failed ? 1 : 0);
