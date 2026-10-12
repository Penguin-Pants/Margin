import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// margin-brand/ holds the approved Margin assets (margin-brand/README.md).
// The app serves copies: the tab and touch icons at the web root, where
// browsers also look for them without a link, and the install icons in
// web/icons/.
const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const webDir = join(rootDir, 'web');
const brandDir = join(rootDir, 'margin-brand');

/** Each served icon URL and its source in margin-brand/. */
const SOURCES = {
  '/favicon.ico': 'assets/exported/favicon.ico',
  '/favicon.svg': 'assets/source/favicon.svg',
  '/apple-touch-icon.png': 'assets/exported/apple-touch-icon.png',
  '/icons/icon-192.png': 'assets/exported/icon-192.png',
  '/icons/icon-512.png': 'assets/exported/icon-512.png',
  '/icons/icon-maskable-512.png': 'assets/exported/icon-maskable-512.png',
};

const readPage = (name) => readFile(join(webDir, name), 'utf8');
const readManifest = async () => JSON.parse(await readFile(join(webDir, 'manifest.webmanifest'), 'utf8'));

/** The `rel href` of each icon link in a page. */
function iconLinks(html) {
  return [...html.matchAll(/<link\s[^>]*>/g)]
    .map(([tag]) => [/\srel="([^"]*)"/.exec(tag)?.[1], /\shref="([^"]*)"/.exec(tag)?.[1]])
    .filter(([rel]) => rel === 'icon' || rel === 'apple-touch-icon')
    .map(([rel, href]) => `${rel} ${href}`);
}

/** Every icon URL that a page or the manifest names. */
async function iconUrls() {
  const pages = await Promise.all(['index.html', 'login.html'].map(readPage));
  const linked = pages.flatMap(iconLinks).map((link) => link.split(' ')[1]);
  const listed = (await readManifest()).icons.map((icon) => icon.src);
  return [...new Set([...linked, ...listed])].sort();
}

test('each page has its Margin title and links the favicon, the SVG favicon and the Apple touch icon', async () => {
  for (const [name, title] of [['index.html', 'Margin'], ['login.html', 'Sign in - Margin']]) {
    const html = await readPage(name);
    assert.equal(/<title>([^<]*)<\/title>/.exec(html)?.[1], title, name);
    assert.deepEqual(iconLinks(html), ['icon /favicon.ico', 'icon /favicon.svg', 'apple-touch-icon /apple-touch-icon.png'], name);
  }
  assert.match(await readPage('login.html'), /<h1>Margin<\/h1>/);
});

test('the manifest names the app Margin and keeps its three install icons', async () => {
  const manifest = await readManifest();
  assert.equal(manifest.name, 'Margin');
  assert.equal(manifest.short_name, 'Margin');
  assert.equal(manifest.description, 'Private notes and code, in one place.');
  assert.deepEqual(manifest.icons.map((icon) => icon.src), ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png']);
});

test('each icon that a page or the manifest names is the approved file from margin-brand/', async () => {
  const urls = await iconUrls();
  assert.deepEqual(urls, Object.keys(SOURCES).sort());
  for (const url of urls) {
    assert.deepEqual(await readFile(join(webDir, url)), await readFile(join(brandDir, SOURCES[url])), url);
  }
});

test('web/icons/ holds only the install icons that the manifest names', async () => {
  const files = (await readdir(join(webDir, 'icons'))).map((name) => `/icons/${name}`).sort();
  assert.deepEqual(files, (await readManifest()).icons.map((icon) => icon.src).sort());
});
