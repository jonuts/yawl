// Standalone web build (no Vite, no Capacitor): bundles src/ with esbuild and
// compiles the Tailwind classes it uses, into web/dist/ ready to upload.
//
//   node web/build.mjs            (from native-ios/)
//
// Needs esbuild, tailwindcss (v4), react and react-dom resolvable — either in
// native-ios/node_modules or via NODE_MODULES_DIR.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const modulesDir = process.env.NODE_MODULES_DIR || path.join(root, 'node_modules');
const require = createRequire(path.join(modulesDir, '_'));
const esbuild = require('esbuild');
const tailwind = require('tailwindcss');

const dist = path.join(here, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });

const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
const shim = (f) => path.join(here, 'shims', f);

// ---- JS ----
const js = await esbuild.build({
  entryPoints: [path.join(root, 'src', 'main.jsx')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  nodePaths: [modulesDir],
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: {
    '@capacitor/core': shim('capacitor-core.js'),
    '@capacitor/preferences': shim('capacitor-preferences.js'),
    '@capacitor/local-notifications': shim('capacitor-local-notifications.js'),
    '@capacitor/haptics': shim('capacitor-haptics.js'),
    'lucide-react': shim('lucide-react.jsx'),
  },
  legalComments: 'none',
});
const jsBuf = Buffer.from(js.outputFiles[0].contents);
const jsName = 'assets/app-' + hash(jsBuf) + '.js';
fs.writeFileSync(path.join(dist, jsName), jsBuf);

// ---- CSS ----
const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
const sources = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(jsx?|html)$/.test(f.name)) sources.push(fs.readFileSync(p, 'utf8'));
  }
})(path.join(root, 'src'));
const candidates = new Set();
for (const src of sources) for (const m of src.matchAll(/[^\s"'`<>{}()=,;]+/g)) candidates.add(m[0]);

const compiler = await tailwind.compile(fs.readFileSync(path.join(here, 'web.css'), 'utf8'), {
  base: here,
  loadStylesheet: async (id, base) => {
    const file = id === 'tailwindcss' ? path.join(twDir, 'index.css')
      : id.startsWith('tailwindcss/') ? path.join(twDir, id.slice('tailwindcss/'.length))
      : path.resolve(base, id);
    return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
  },
});
const rawCss = compiler.build([...candidates]);
const css = await esbuild.transform(rawCss, { loader: 'css', minify: true, target: ['safari15'] });
const cssName = 'assets/app-' + hash(css.code) + '.css';
fs.writeFileSync(path.join(dist, cssName), css.code);

// ---- static files ----
for (const f of fs.readdirSync(path.join(here, 'public'))) fs.copyFileSync(path.join(here, 'public', f), path.join(dist, f));
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8').replace('%JS%', './' + jsName).replace('%CSS%', './' + cssName);
fs.writeFileSync(path.join(dist, 'index.html'), html);

console.log('built', jsName, (jsBuf.length / 1024).toFixed(0) + 'kB,', cssName, (css.code.length / 1024).toFixed(0) + 'kB');
