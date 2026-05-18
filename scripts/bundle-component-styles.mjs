// Збирає стилі з src/app у src/styles/global-components.css (без auth-modal-shared).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const appDir = path.join(root, 'src', 'app');
const outFile = path.join(root, 'src', 'styles', 'global-components.css');

const AUTH_USE = /@use\s+['"][^'"]*auth-modal-shared['"]\s+as\s+\*;\s*/g;
const MAT_USE = /@use\s+['"]@angular\/material['"]\s+as\s+mat;\s*/g;
const SCSS_COMMENT = /\/\/.*$/gm;

const ELEVATION = {
  1: '0 2px 1px -1px rgba(0,0,0,.2), 0 1px 1px 0 rgba(0,0,0,.14), 0 1px 3px 0 rgba(0,0,0,.12)',
  2: '0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12)',
};

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith('.scss')) acc.push(p);
  }
  return acc;
}

function findSelector(scssPath) {
  const dir = path.dirname(scssPath);
  const base = path.basename(scssPath, '.scss').replace(/\.component$/, '');
  const candidates = [
    path.join(dir, `${base}.component.ts`),
    path.join(dir, `${base}.ts`),
    path.join(dir, path.basename(scssPath, '.scss') + '.ts'),
  ];
  for (const tsPath of candidates) {
    if (!fs.existsSync(tsPath)) continue;
    const m = fs.readFileSync(tsPath, 'utf8').match(/selector:\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
  }
  return null;
}

function transformScss(content, scssPath) {
  const selector = findSelector(scssPath);
  let s = content.replace(AUTH_USE, '').replace(MAT_USE, '').replace(SCSS_COMMENT, '');
  s = s.replace(/@include\s+mat\.elevation\((\d+)\)/g, (_, n) => {
    const shadow = ELEVATION[Number(n)] ?? ELEVATION[2];
    return `box-shadow: ${shadow}`;
  });
  s = s.replace(/\$carousel-cap-width:\s*1330px;/g, '');
  s = s.replace(/\$carousel-21-9-height:\s*[^;]+;/g, '');
  s = s.replace(/#{\$carousel-21-9-height}/g, 'calc(1330px * 9 / 21)');
  s = s.replace(/\$carousel-21-9-height/g, 'calc(1330px * 9 / 21)');

  if (selector) {
    s = s.replace(/:host-context\(([^)]+)\)/g, (_, ctx) => `${ctx.trim()} ${selector}`);
    s = s.replace(/:host/g, selector);
  }

  return s.trim();
}

function isAuthOnly(content) {
  const stripped = content.replace(AUTH_USE, '').trim();
  return stripped.length === 0;
}

const files = walk(appDir).sort();
const chunks = [
  '/* Auto-generated component styles. Regenerate: node scripts/bundle-component-styles.mjs */\n',
];

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  if (isAuthOnly(raw)) continue;
  const body = transformScss(raw, file);
  if (!body) continue;
  chunks.push(`/* --- ${path.relative(root, file).replace(/\\/g, '/')} --- */\n`);
  chunks.push(body);
  chunks.push('\n\n');
}

fs.writeFileSync(outFile, chunks.join(''), 'utf8');
console.log(`Wrote ${outFile} (${chunks.length} sections from ${files.length} files)`);
