import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baseName, extensionOf, NEW_NAME, newName } from '../../shared/contract.js';

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

test('New names have at least 2 digits (NEW-4)', () => {
  assert.deepEqual([1, 9, 10, 99, 100].map(newName), ['New 01', 'New 09', 'New 10', 'New 99', 'New 100']);
});

test('the New name pattern is "New", a space and digits only (NEW-5, NEW-7)', () => {
  for (const name of ['New 01', 'New 1', 'New 100']) assert.match(name, NEW_NAME);
  for (const name of ['Untitled 1', 'New01', 'new 01', 'New 01.md', 'New 1a', 'New ']) assert.doesNotMatch(name, NEW_NAME);
});
