import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baseName, extensionOf } from '../../shared/contract.js';

test('an extension is 1 to 10 letters or digits after the last dot, with at least one letter (EXT-1)', () => {
  for (const [name, extension] of [
    ['data.csv', 'csv'],
    ['a.7z', '7z'],
    ['.env', 'env'],
    ['a.tar.MD', 'MD'],
    ['notes.markdown', 'markdown'],
    ['x.abcdefghij', 'abcdefghij'],
    ['Bericht.Übersicht', 'Übersicht'],
  ]) {
    assert.equal(extensionOf(name), extension, name);
  }
  for (const name of ['v1.2 notes', 'Meeting 10.15', 'todo.', 'New 01', 'notes', 'dir.d/notes', 'x.abcdefghijk', 'a.b-c', '', null]) {
    assert.equal(extensionOf(name), '', String(name));
  }
});

test('the base name is the name without its extension and dot, or the whole name when that leaves nothing', () => {
  assert.equal(baseName('script.py'), 'script');
  assert.equal(baseName('a.tar.md'), 'a.tar');
  assert.equal(baseName('Meeting 10.15'), 'Meeting 10.15');
  assert.equal(baseName('New 01'), 'New 01');
  assert.equal(baseName('.env'), '.env');
});
