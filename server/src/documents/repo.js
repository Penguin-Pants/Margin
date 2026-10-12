// Document storage (BUILD_PLAN.md section 2.6). Every query names the
// workspace (v3 TD-24): a document of the other workspace reads as missing.
import { randomUUID } from 'node:crypto';
import { extensionOf, NEW_NAME, newName } from '../../../shared/contract.js';
import { transaction } from '../db.js';

// node:sqlite (seen in Node 24.13) cuts a bound TEXT value at its first NUL
// character, so content is stored as UTF-8 bytes (a BLOB in the TEXT column).
const encodeContent = (text) => Buffer.from(text, 'utf8');
const decodeContent = (value) => (typeof value === 'string' ? value : Buffer.from(value).toString('utf8'));

/**
 * @typedef {object} DocumentMeta
 * @property {string} id
 * @property {string} name
 * @property {number} version Counts content changes only (TD-6).
 * @property {string | null} language Manual override. null = auto.
 * @property {number} updatedAt Unix ms.
 */

/** @returns {DocumentMeta} */
const toMeta = (row) => ({
  id: row.id,
  name: row.name,
  version: row.version,
  language: row.language,
  updatedAt: row.updated_at,
});

/**
 * Newest first. No content.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} workspace
 */
export function listDocuments(db, workspace) {
  return db
    .prepare(
      'SELECT id, name, version, language, updated_at FROM documents WHERE workspace = ? ORDER BY updated_at DESC, rowid DESC',
    )
    .all(workspace)
    .map(toMeta);
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ workspace: string, name?: string, content: string, language?: string | null, now: number }} input
 *   name must already be normalized and language validated. No language = auto.
 * @returns {DocumentMeta}
 */
export function createDocument(db, { workspace, name, content, language = null, now }) {
  return transaction(db, () => {
    const id = randomUUID();
    const finalName = name ?? nextNewName(db, workspace);
    db.prepare(
      'INSERT INTO documents (id, workspace, name, content, language, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(id, workspace, finalName, encodeContent(content), language, now, now);
    return { id, name: finalName, version: 1, language, updatedAt: now };
  });
}

// The number is 1 + the highest number among names "New NN" in the
// workspace (v4 NEW-5, TD-25). "Untitled N" names do not count. Runs inside
// the insert transaction.
function nextNewName(db, workspace) {
  let highest = 0;
  const rows = db.prepare("SELECT name FROM documents WHERE workspace = ? AND name LIKE 'New %'").all(workspace);
  for (const { name } of rows) {
    const n = Number(NEW_NAME.exec(name)?.[1]);
    if (Number.isSafeInteger(n) && n > highest) highest = n;
  }
  return newName(highest + 1);
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} workspace
 * @param {string} id
 * @returns {(DocumentMeta & { content: string }) | undefined}
 */
export function getDocument(db, workspace, id) {
  const row = db
    .prepare('SELECT id, name, content, version, language, updated_at FROM documents WHERE id = ? AND workspace = ?')
    .get(id, workspace);
  return row && { ...toMeta(row), content: decodeContent(row.content) };
}

/**
 * Saves content only when the stored version still equals expectedVersion.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ workspace: string, id: string, content: string, expectedVersion: number, now: number }} input
 * @returns {{ ok: true, version: number, updatedAt: number } | { ok: false, currentVersion: number | null }}
 *   currentVersion is null when the document does not exist in the workspace.
 */
export function saveContent(db, { workspace, id, content, expectedVersion, now }) {
  const { changes } = db
    .prepare(
      'UPDATE documents SET content = ?, version = version + 1, updated_at = ? WHERE id = ? AND workspace = ? AND version = ?',
    )
    .run(encodeContent(content), now, id, workspace, expectedVersion);
  if (changes === 1) return { ok: true, version: expectedVersion + 1, updatedAt: now };
  const row = db.prepare('SELECT version FROM documents WHERE id = ? AND workspace = ?').get(id, workspace);
  return { ok: false, currentVersion: row?.version ?? null };
}

/**
 * Applies a rename, a language override and/or a move to the other
 * workspace. Only a rename changes updated_at (section 2.6), so a move keeps
 * the sort position (v3 TD-26). None changes version (TD-6). A rename that
 * changes the extension (letter case ignored) and sends no language sets the
 * language to Auto in the same transaction (v4 REN-8, REN-9).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} workspace The document's workspace now.
 * @param {string} id
 * @param {{ name?: string, language?: string | null, workspace?: string }} changes Already validated.
 *   The name comes from renamedName (shared/contract.js).
 * @param {number} now
 * @returns {DocumentMeta | undefined} undefined when the document does not exist in the workspace.
 */
export function updateMeta(db, workspace, id, { name, language, workspace: target }, now) {
  return transaction(db, () => {
    const current = db.prepare('SELECT name FROM documents WHERE id = ? AND workspace = ?').get(id, workspace);
    if (!current) return undefined;
    const sameExtension = (a, b) => extensionOf(a).toLowerCase() === extensionOf(b).toLowerCase();
    if (name !== undefined && language === undefined && !sameExtension(current.name, name)) language = null;
    if (name !== undefined) db.prepare('UPDATE documents SET name = ?, updated_at = ? WHERE id = ?').run(name, now, id);
    if (language !== undefined) db.prepare('UPDATE documents SET language = ? WHERE id = ?').run(language, id);
    if (target !== undefined) db.prepare('UPDATE documents SET workspace = ? WHERE id = ?').run(target, id);
    // By id only: a moved row is in the target workspace now.
    const row = db.prepare('SELECT id, name, version, language, updated_at FROM documents WHERE id = ?').get(id);
    return row && toMeta(row);
  });
}

/**
 * Deletes a document. With expectedVersion, only while the stored version
 * still equals it, so text saved on another device stays (audit C1).
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} workspace
 * @param {string} id
 * @param {number} [expectedVersion]
 * @returns {{ ok: true } | { ok: false, currentVersion: number | null }}
 *   currentVersion is null when the document does not exist in the workspace.
 */
export function deleteDocument(db, workspace, id, expectedVersion) {
  const { changes } =
    expectedVersion === undefined
      ? db.prepare('DELETE FROM documents WHERE id = ? AND workspace = ?').run(id, workspace)
      : db.prepare('DELETE FROM documents WHERE id = ? AND workspace = ? AND version = ?').run(id, workspace, expectedVersion);
  if (changes === 1) return { ok: true };
  const row = db.prepare('SELECT version FROM documents WHERE id = ? AND workspace = ?').get(id, workspace);
  return { ok: false, currentVersion: row?.version ?? null };
}
