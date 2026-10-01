import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const required = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'sw.js',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png'
];

for (const file of required) {
  await access(new URL(`../${file}`, import.meta.url), constants.R_OK);
}

JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
console.log('✓ Done Today source check passed');
