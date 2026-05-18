/**
 * Видаляє коментарі без «фрагментів коду» (ідентифікатори, літерали, шляхи, HTTP-коди тощо).
 * Закоментований код не чіпає.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const targets = [path.join(root, 'src')];

function hasCodeFragment(text) {
  const t = text.replace(/^\s*\/\*+|\*+\/\s*$/g, '').replace(/^\s*\/\/\s?/gm, '').trim();
  if (!t) return false;
  if (/^\s*@(param|returns|deprecated|internal|see|link|example|inheritdoc|type)\b/i.test(t)) return true;
  if (/\b(eslint-disable|istanbul|ts-expect-error|ts-ignore|ngSkipHydration)\b/i.test(t)) return true;
  if (/`[^`]+`/.test(t)) return true;
  if (/'[^']+'/.test(t) || /"[^"]+"/.test(t)) return true;
  if (/[a-z][a-z0-9]*[A-Z][\w]*/.test(t)) return true;
  if (/\b[A-Z][a-z]+(?:[A-Z][a-zA-Z0-9]*)+\b/.test(t)) return true;
  if (/\b[A-Z]{2,}\b/.test(t)) return true;
  if (/\b[a-z]+(?:_[a-z0-9]+)+\b/.test(t)) return true;
  if (/\/[\w./:?&=%-]+/.test(t)) return true;
  if (/\b\d{3}\b/.test(t)) return true;
  if (/->|=>|::ng-deep|\.mat-|#{\$|--[a-z]/i.test(t)) return true;
  if (
    /\b(?:null|undefined|void|true|false|typeof|inject|signal|computed|Observable|Promise|Record|Map|Set)\b/.test(
      t,
    )
  )
    return true;
  return false;
}

function isCommentedOutCode(body) {
  const c = body.trim();
  if (!c) return false;
  if (/^(import|export|const|let|var|return|if|for|while|class|interface|type)\b/.test(c)) return true;
  if (/[=;{}()[\]|]/.test(c) && /[a-zA-Z_$]/.test(c)) return true;
  return false;
}

function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;

  while (i < n) {
  // strings
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === quote) {
          j++;
          break;
        }
        j++;
      }
      out += source.slice(i, j);
      i = j;
      continue;
    }

    if (ch === '/' && next === '/') {
      const lineEnd = source.indexOf('\n', i);
      const end = lineEnd === -1 ? n : lineEnd;
      const body = source.slice(i + 2, end);
      if (!isCommentedOutCode(body) && !hasCodeFragment(body)) {
        if (end < n) out += '\n';
      } else {
        out += source.slice(i, end);
      }
      i = end;
      continue;
    }

    if (ch === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      const end = close === -1 ? n : close + 2;
      const body = source.slice(i + 2, close === -1 ? n : close);
      if (!isCommentedOutCode(body) && !hasCodeFragment(body)) {
        // drop
      } else {
        out += source.slice(i, end);
      }
      i = end;
      continue;
    }

    out += ch;
    i++;
  }

  return out.replace(/\n{3,}/g, '\n\n');
}

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.angular') continue;
      walk(p, acc);
    } else if (/\.(ts|html|css|scss|mjs)$/.test(ent.name)) {
      acc.push(p);
    }
  }
  return acc;
}

let changed = 0;
for (const base of targets) {
  for (const file of walk(base)) {
    if (file.includes('remove-prose-comments')) continue;
    const src = fs.readFileSync(file, 'utf8');
    const next = stripComments(src);
    if (next !== src) {
      fs.writeFileSync(file, next, 'utf8');
      changed++;
      console.log(path.relative(root, file));
    }
  }
}
console.log(`Updated ${changed} file(s).`);
