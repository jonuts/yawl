// Assemble what gets uploaded to Netlify: the server (function, migration,
// config) plus the prebuilt static site, into web/deploy/.
//
//   node web/build.mjs && node web/bundle.mjs      (from native-ios/)
//
// Then zip the *contents* of web/deploy/ and deploy that.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'deploy');
if (!fs.existsSync(path.join(here, 'dist', 'index.html'))) throw new Error('Run web/build.mjs first.');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(here, 'server'), out, { recursive: true });
fs.cpSync(path.join(here, 'dist'), path.join(out, 'site'), { recursive: true });
console.log('bundled', out);
