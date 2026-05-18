// Видаляє styleUrl з компонентів і файли src/app/**/*.scss
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const appDir = path.join(root, 'src', 'app');

function walkTs(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTs(p, acc);
    else if (ent.name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

let tsUpdated = 0;
for (const file of walkTs(appDir)) {
  let src = fs.readFileSync(file, 'utf8');
  const next = src.replace(/\n\s*styleUrl:\s*['"][^'"]+['"],?/g, '');
  if (next !== src) {
    fs.writeFileSync(file, next, 'utf8');
    tsUpdated++;
  }
}

let scssRemoved = 0;
function walkScss(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkScss(p);
    else if (ent.name.endsWith('.scss')) {
      fs.unlinkSync(p);
      scssRemoved++;
    }
  }
}
walkScss(appDir);
if (fs.existsSync(path.join(appDir, 'app.scss'))) {
  fs.unlinkSync(path.join(appDir, 'app.scss'));
  scssRemoved++;
}

console.log(`Updated ${tsUpdated} TS files, removed ${scssRemoved} SCSS files`);
