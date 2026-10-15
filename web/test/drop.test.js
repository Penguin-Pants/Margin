import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extensionOf } from '../../shared/contract.js';
import { droppedText, openDropped, uniqueName } from '../src/drop.js';

const bytes = (text) => new TextEncoder().encode(text);

test('a free name stays, a taken one gets (2), (3) and so on before the extension, ignoring case (DRP-2)', () => {
  assert.equal(uniqueName('notes.md', new Set()), 'notes.md');
  assert.equal(uniqueName('notes.md', new Set(['notes.md'])), 'notes (2).md');
  assert.equal(uniqueName('Notes.MD', new Set(['notes.md', 'notes (2).md'])), 'Notes (3).MD');
  assert.equal(uniqueName('README', new Set(['readme'])), 'README (2)');
  assert.equal(uniqueName('a.tar.md', new Set(['a.tar.md'])), 'a.tar (2).md');
});

test('a taken extension-only name gets (2), (3) and so on before the extension, so it keeps the extension (DRP-11)', () => {
  assert.equal(uniqueName('.yml', new Set(['.yml'])), '(2).yml');
  assert.equal(extensionOf(uniqueName('.yml', new Set(['.yml']))), 'yml');
  assert.equal(uniqueName('.md', new Set(['.md', '(2).md'])), '(3).md');
  assert.equal(uniqueName('.YML', new Set(['.yml'])), '(2).YML');
  // A base name before the extension, or no extension by EXT-1: the suffix stays after the base name.
  assert.equal(uniqueName('.env.yml', new Set(['.env.yml'])), '.env (2).yml');
  assert.equal(uniqueName('todo.', new Set(['todo.'])), 'todo. (2)');
});

test('accepted files become text with LF line breaks and no byte order mark, also when empty (DRP-1, DRP-3, DRP-6, EDGE-13)', () => {
  assert.deepEqual(droppedText({ name: 'README.MD', bytes: bytes('﻿# Hi\r\nthere\rnow') }), { text: '# Hi\nthere\nnow' });
  for (const name of ['a.md', 'a.markdown', 'a.txt', 'a.html', 'a.HTM']) assert.deepEqual(droppedText({ name, bytes: bytes('x') }), { text: 'x' }, name);
  assert.deepEqual(droppedText({ name: 'empty.txt', bytes: new Uint8Array() }), { text: '' }, 'EDGE-13');
});

test('code and data files of D80 are accepted in any case (DRP-7, EDGE-55)', () => {
  const names = ['a.json', 'a.css', 'a.js', 'a.mjs', 'a.cjs', 'a.ts', 'a.mts', 'a.cts', 'a.py', 'a.yaml', 'a.yml', '.yml'];
  for (const name of names.flatMap((n) => [n, n.toUpperCase()])) assert.deepEqual(droppedText({ name, bytes: bytes('x') }), { text: 'x' }, name);
});

test('other extensions, files over 1 MB and text that is not UTF-8 are rejected with a reason (DRP-9, EDGE-10 to EDGE-12, EDGE-54)', () => {
  for (const name of ['a.pdf', 'md', 'a.sql', 'a.sh', 'a.bash', 'a.zsh']) {
    assert.deepEqual(droppedText({ name, bytes: bytes('x') }), { error: 'this file type cannot be opened' }, name);
  }
  assert.deepEqual(droppedText({ name: 'big.md', bytes: new Uint8Array(1_048_577) }), { error: 'larger than 1 MB' });
  assert.deepEqual(droppedText({ name: 'max.md', bytes: new Uint8Array(1_048_576).fill(97) }).text.length, 1_048_576);
  assert.deepEqual(droppedText({ name: 'latin.txt', bytes: new Uint8Array([0x63, 0x61, 0x66, 0xe9]) }), { error: 'the text is not UTF-8; save the file as UTF-8 first' });
});

const file = (name, text = 'x', size) => {
  const data = bytes(text);
  return { name, size: size ?? data.length, arrayBuffer: async () => data.buffer };
};

function fakes({ list = { status: 200, data: [{ name: 'notes.md' }] }, statuses = [] } = {}) {
  const created = [];
  const opened = [];
  const messages = [];
  let n = 0;
  const api = {
    listDocuments: async () => list,
    createDocument: async (text, name) => {
      const status = statuses[created.length] ?? 201;
      created.push({ name, text });
      n += 1;
      return { status, data: status === 201 ? { id: `id${n}`, name } : { error: 'x' } };
    },
  };
  return { api, created, opened, messages, open: async (meta, text) => opened.push([meta.name, text]), showMessage: (text) => messages.push(text) };
}

test('dropped files open in drop order with free names, and rejected ones are named in one message (DRP-1, DRP-2, DRP-4)', async () => {
  const f = fakes();
  const files = [file('notes.md', 'a'), file('report.pdf'), file('NOTES.md', 'b'), file('page.html', '<p>')];
  await openDropped({ files, ...f });
  assert.deepEqual(f.created.map((c) => c.name), ['notes (2).md', 'NOTES (3).md', 'page.html']);
  assert.deepEqual(f.opened, [['notes (2).md', 'a'], ['NOTES (3).md', 'b'], ['page.html', '<p>']]);
  assert.deepEqual(f.messages, ['Not opened: report.pdf (this file type cannot be opened).']);
});

test('a file over 1 MB is not read or created (EDGE-10)', async () => {
  const f = fakes();
  await openDropped({ files: [{ name: 'big.md', size: 2_000_000, arrayBuffer: () => assert.fail('read') }], ...f });
  assert.deepEqual(f.created, []);
  assert.deepEqual(f.messages, ['Not opened: big.md (larger than 1 MB).']);
});

test('no connection or no session creates nothing more and says so (EDGE-14)', async () => {
  const message = 'Could not open the dropped files. Check the connection or sign in, then drop them again.';
  const offline = fakes({ list: { status: 0, data: null } });
  await openDropped({ files: [file('a.md')], ...offline });
  assert.deepEqual(offline.created, []);
  assert.deepEqual(offline.messages, [message]);
  const expired = fakes({ statuses: [201, 401] });
  await openDropped({ files: [file('a.md'), file('b.md'), file('c.md')], ...expired });
  assert.deepEqual(expired.created.map((c) => c.name), ['a.md', 'b.md']);
  assert.deepEqual(expired.opened.map(([name]) => name), ['a.md']);
  assert.deepEqual(expired.messages, [message]);
});

test('a name the server rejects is named in the message and the rest still open', async () => {
  const f = fakes({ statuses: [400, 201] });
  await openDropped({ files: [file('bad.md'), file('good.md')], ...f });
  assert.deepEqual(f.opened.map(([name]) => name), ['good.md']);
  assert.deepEqual(f.messages, ['Not opened: bad.md (could not be saved).']);
});

test('a file that cannot be read is named in the message and the rest still open', async () => {
  const f = fakes();
  const gone = { name: 'gone.md', size: 1, arrayBuffer: async () => Promise.reject(new Error('NotFoundError')) };
  await openDropped({ files: [gone, file('b.md')], ...f });
  assert.deepEqual(f.opened.map(([name]) => name), ['b.md']);
  assert.deepEqual(f.messages, ['Not opened: gone.md (could not be read).']);
});
