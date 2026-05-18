// Перевірка конвенцій іменування Leveleo-frontend. Exit 1 при порушеннях.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const appDir = path.join(root, 'src', 'app');
const i18nDir = path.join(root, 'src', 'assets', 'i18n');

const issues = [];

const CAMEL_FILE = /[a-z][A-Z].*\.ts$/;
const KEBAB_FILE = /^[a-z0-9]+(-[a-z0-9]+)*(\.(component|service|guard|util|types|spec|directive))?\.ts$/;

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

for (const file of walk(appDir)) {
  if (!file.endsWith('.ts')) continue;
  const base = path.basename(file);
  if (base.endsWith('.spec.ts')) continue;
  if (CAMEL_FILE.test(base) && !KEBAB_FILE.test(base)) {
    issues.push(`File not kebab-case: ${path.relative(root, file)}`);
  }
}

for (const typesFile of walk(appDir).filter(
  (f) => f.endsWith('.types.ts') && f.includes(`${path.sep}features${path.sep}`),
)) {
  const src = fs.readFileSync(typesFile, 'utf8');
  for (const m of src.matchAll(/export interface (\w+)/g)) {
    const name = m[1];
    if (!name.endsWith('Dto') && !name.startsWith('PagedResult')) {
      issues.push(`DTO interface without Dto suffix: ${name} in ${path.relative(root, typesFile)}`);
    }
  }
}

for (const ts of walk(appDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))) {
  const src = fs.readFileSync(ts, 'utf8');
  for (const m of src.matchAll(/selector:\s*['"]([^'"]+)['"]/g)) {
    const sel = m[1];
    if (sel.startsWith('[')) continue; // attribute directive
    if (!sel.startsWith('app-')) {
      issues.push(`Selector must start with app-: "${sel}" in ${path.relative(root, ts)}`);
    } else if (!/^app-[a-z0-9]+(-[a-z0-9]+)*$/.test(sel)) {
      issues.push(`Selector not app-kebab-case: "${sel}" in ${path.relative(root, ts)}`);
    }
  }
}

const SEGMENT = /^[A-Z][A-Z0-9_]*$/;
const I18N_EXCEPTION = new Set(['Pending', 'Processing', 'Shipped', 'Completed', 'Cancelled', 'PaymentFailed', 'Success', 'Failure', 'Refunded']);

function checkI18nKeys(obj, prefix = []) {
  for (const [k, v] of Object.entries(obj)) {
    const pathParts = [...prefix, k];
    if (!SEGMENT.test(k) && !I18N_EXCEPTION.has(k)) {
      issues.push(`i18n segment not UPPER_SNAKE: ${pathParts.join('.')}`);
    }
    if (k.startsWith('2')) {
      issues.push(`i18n segment must not start with digit: ${pathParts.join('.')}`);
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) checkI18nKeys(v, pathParts);
  }
}

for (const lang of ['en.json', 'uk.json']) {
  const file = path.join(i18nDir, lang);
  if (fs.existsSync(file)) {
    checkI18nKeys(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
}

if (issues.length) {
  console.error(`Naming check failed (${issues.length} issue(s)):\n`);
  for (const i of issues.slice(0, 50)) console.error(`  - ${i}`);
  if (issues.length > 50) console.error(`  ... and ${issues.length - 50} more`);
  process.exit(1);
}

console.log('Naming conventions OK.');
