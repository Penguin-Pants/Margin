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

/** A name that New gives (DOC-4, TD-25). Group 1 is N. */
export const UNTITLED_NAME = /^Untitled (\d+)$/;

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
