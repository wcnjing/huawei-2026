// Reports literal t("...") / translate(lang, "...") keys missing from any language,
// and translations whose {placeholders} differ from the English key.
// Usage: node scripts/check-i18n.mjs [path-prefix]   (prefix limits which files are scanned)
import { build } from 'esbuild';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const prefix = process.argv[2] ? join(root, process.argv[2]) : join(root, 'src/app');

const bundled = await build({
  entryPoints: [join(root, 'src/app/i18n/locales/index.ts')],
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'silent',
});
const { DICTIONARIES } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'i18n') walk(p, out); }
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(p);
  }
  return out;
}

const patterns = [
  /\bt\(\s*"((?:[^"\\]|\\.)*)"/g,
  /\bt\(\s*'((?:[^'\\]|\\.)*)'/g,
  /\btranslate\([^,()]+,\s*"((?:[^"\\]|\\.)*)"/g,
  /\btranslate\([^,()]+,\s*'((?:[^'\\]|\\.)*)'/g,
];
const unescape = (s) => { try { return JSON.parse(`"${s.replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"')}"`); } catch { return s; } };
const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const scanRoot = statSync(prefix).isDirectory() ? prefix : null;
const files = scanRoot ? walk(scanRoot) : [prefix];
const keys = new Map();
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      const key = unescape(m[1]);
      if (!keys.has(key)) keys.set(key, relative(root, file));
    }
  }
}

let problems = 0;
for (const [key, file] of keys) {
  for (const lang of ['zh', 'ms', 'ta']) {
    const value = DICTIONARIES[lang][key];
    if (value === undefined) { problems++; console.log(`MISSING ${lang}  ${file}  ${JSON.stringify(key)}`); }
    else if (vars(value) !== vars(key)) { problems++; console.log(`PLACEHOLDER ${lang}  ${file}  ${JSON.stringify(key)} -> ${JSON.stringify(value)}`); }
  }
}
console.log(`${keys.size} keys scanned in ${files.length} files, ${problems} problem(s).`);
process.exit(problems ? 1 : 0);
