// Values that the server and the browser must agree on (audit C5). The
// server imports this file and esbuild bundles it into the browser code, so
// each value is written once. Migration 2 also holds the workspace list in
// its CHECK, because a released migration never changes.

/** The two fixed workspaces (v3 WS-1, TD-20). The first is the default. */
export const WORKSPACES = /** @type {['personal', 'work']} */ (['personal', 'work']);

/** The language ids of the manual override (EDT-4). The browser adds the labels. */
export const LANGUAGE_IDS = ['plain', 'markdown', 'json', 'html', 'css', 'javascript', 'typescript', 'python', 'sql', 'yaml', 'shell'];

/** The most UTF-8 bytes that one document can hold (DOC-8, INT-1). */
export const CONTENT_LIMIT_BYTES = 1_048_576;

/** The most characters (Unicode code points) in a document name, after trimming. */
export const NAME_MAX_LENGTH = 255;

/** A name that New gives (v4 NEW-5, NEW-7): "New", a space and digits. Group 1 is the number. */
export const NEW_NAME = /^New (\d+)$/;

/**
 * The name that New gives document number n (v4 NEW-4).
 * @param {number} n
 */
export const newName = (n) => `New ${String(n).padStart(2, '0')}`;

/** The autosave delay until the owner sets one (SAV-2). */
export const AUTOSAVE_DEFAULT_SECONDS = 5;

/** A name's extension (v4 EXT-1). Group 1 is the extension without the dot. */
const EXTENSION = /\.([\p{L}\p{Nd}]{1,10})$/u;

/**
 * The extension as written, without the dot, or ''. It is the text after the
 * last dot when that is 1 to 10 letters or digits with at least one letter
 * (v4 EXT-1): `data.csv`, `a.7z` and `.env` have one, `Meeting 10.15` and
 * `todo.` do not.
 * @param {string | null | undefined} name
 */
export function extensionOf(name) {
  const extension = EXTENSION.exec(name ?? '')?.[1] ?? '';
  return /\p{L}/u.test(extension) ? extension : '';
}

/**
 * The name without its extension and dot, or the whole name when that leaves
 * nothing (`.env`).
 * @param {string} name
 */
export function baseName(name) {
  const extension = extensionOf(name);
  return (extension ? name.slice(0, -extension.length - 1) : name) || name;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * Returns the trimmed name, or null when it breaks the name rule:
 * 1 to NAME_MAX_LENGTH characters after trimming and no control characters.
 * @param {unknown} value
 */
export function normalizeName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  const length = [...name].length;
  return length >= 1 && length <= NAME_MAX_LENGTH && !CONTROL_CHARS.test(name) ? name : null;
}

/**
 * The stored name of a rename (v4 REN-5, REN-7), or null when it breaks the
 * name rule: trimmed, trailing dots removed, then `.md` appended when it has
 * no extension (EXT-1). The limit counts the appended `.md`.
 * @param {unknown} value
 */
export function renamedName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/[.\s]+$/u, '');
  if (name === '') return null;
  return normalizeName(extensionOf(name) ? name : `${name}.md`);
}
