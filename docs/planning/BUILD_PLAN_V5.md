# Build Plan V5: Drop More File Types

**Status:** M26 (T41) is Planned. No open plan decisions.
**Date:** 2026-10-15
**Inputs:** `REQUIREMENTS_V2.md` section 3.7 (DRP-1 to DRP-6), `REQUIREMENTS_V4.md` (EXT-1), `BUILD_PLAN_V3.md` (TD-41, TD-42), `AGENTS.md`
**Codebase:** v1 to v4 are built. Line references in this file are for `main` at 2b5e3c0.

---

## 0. Execution rules for coding agents

1. Read `AGENTS.md` before any work. Precedence: this file's requirements (section 2) > `REQUIREMENTS_V4.md` > `REQUIREMENTS_V3.md` > `REQUIREMENTS_V2.md` > `REQUIREMENTS.md` > `AGENTS.md` > the rest of this plan.
2. T41 is one commit or one PR.
3. Write the failing test first. Prove the failure on an assertion, not on a missing import (`AGENTS.md` Testing rule 1).
4. The task ends with `npm test` and `npm run test:e2e` green.
5. End the milestone with the two-pass review (`PLAN_REVIEW.md` section 1). Log it in a new `PLAN_REVIEW.md` section 17, "V5 review log".
6. Update section 7 when the task is done.
7. Do not build anything in section 5 or 6.
8. If the task needs a product decision that this plan does not give, stop and ask the owner.

---

## 1. Problem and outcome

- **Problem:** drop opens only `.md`, `.markdown`, `.txt`, `.html` and `.htm` (`web/src/drop.js:7`). A dropped `.json`, `.css`, `.js`, `.ts`, `.py` or `.yaml` file is rejected, although Margin highlights all six languages (`web/src/languages.js:41-61`).
- **Outcome:** the owner drops those files on the page. Each opens in a new tab with the correct highlighting, with the same rules as the current drop.

---

## 2. Requirements

### 2.1 Decisions

| ID | Topic | Decision | Rejected options |
|----|-------|----------|------------------|
| D80 | Extension scope | The six named types and their aliases: `.json`, `.css`, `.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`, `.py`, `.yaml`, `.yml`. | Exactly the six named extensions. All highlighted types (adds `.sql`, `.sh`, `.bash`, `.zsh`). |
| D81 | Reject reason for a wrong type | Generic text: "this file type cannot be opened". The README keeps the full list. | A list of every accepted extension in the message |
| D82 | Name clash of an extension-only name (`.yml`, `.md`) | The number goes before the extension: `.yml`, then `(2).yml`, `(3).yml`. The copy keeps its extension and highlighting. | `.yml (2)` (today, opens as Plain text). A separate later fix. Accept as is. |

### 2.2 Requirements

| ID | Requirement | Done when |
|----|-------------|-----------|
| DRP-7 | Drop also accepts the 11 extensions of D80. The current 5 stay. The check ignores case (DRP-3). | A dropped `data.json`, `style.css`, `app.js`, `lib.mjs`, `cfg.cjs`, `main.ts`, `mod.mts`, `x.cts`, `run.py`, `ci.yaml` and `ci.YML` each open in a new tab. |
| DRP-8 | A dropped file of a D80 type gets the language of its extension (DRP-6, EDT-4). The stored language stays Auto (v3 NEW-1). | A dropped `ci.yml` shows `data-language="yaml"`. A dropped `main.ts` shows `data-language="typescript"`. |
| DRP-9 | A file of any other type is rejected with the reason "this file type cannot be opened" (D81). | Dropping `report.pdf` shows "Not opened: report.pdf (this file type cannot be opened)." |
| DRP-10 | The drop overlay text names no extension list: "Drop files to open them". | The overlay shows that text during a file drag. |
| DRP-11 | A clash on an extension-only name gives `(n).<ext>` (D82). This applies to every accepted type, also `.md`. | `uniqueName('.yml', {'.yml'})` is `(2).yml`. `uniqueName('.md', {'.md', '(2).md'})` is `(3).md`. A second dropped `.yml` shows `data-language="yaml"`. |

All other drop behavior stays unchanged: names and clash suffixes (DRP-2, except DRP-11), drop order and active tab (DRP-4), the overlay and editor text drags (DRP-5), CRLF and byte order mark handling (DRP-6), the 1 MB limit and UTF-8 check (EDGE-10 to EDGE-14), the active workspace (v3 WS-6) and the drop lock (v3 TD-42).

### 2.3 Edge cases and failure behavior

| ID | Case | Behavior |
|----|------|----------|
| EDGE-52 | The OS reports a `.ts` file with the MIME type `video/mp2t`, or a file has no MIME type. | It is accepted. The check reads the name only (`web/src/drop.js:8`). |
| EDGE-53 | A dropped `.json` or `.yaml` file holds invalid JSON or YAML. | It opens. Drop does not validate syntax. |
| EDGE-54 | A dropped `.sql`, `.sh`, `.bash` or `.zsh` file. | Rejected with the DRP-9 reason (D80). |
| EDGE-55 | A file named `.yml` (no base name) or `notes.YAML`. | Both accepted. EXT-1 gives `.yml` the extension `yml`. The check ignores case. A clash on `.yml` gives `(2).yml` (DRP-11). Today it gives `.yml (2)`, which has no extension by EXT-1 and opens as Plain text (`web/src/drop.js:18-23`). |

---

## 3. Technical decisions

| ID | Decision | Reason |
|----|----------|--------|
| TD-43 | Extend the `ACCEPTED` set in `web/src/drop.js:7` with the 11 extensions of D80. Do not derive it from `BY_EXTENSION` in `web/src/languages.js`. | D80 excludes `.sql` and the shell extensions, which `BY_EXTENSION` holds. One literal list is the fewest moving parts. |
| TD-44 | Replace the string `'only .md, .txt and .html files'` (`web/src/drop.js:34`) with `'this file type cannot be opened'`. | D81. The message stays correct when the list changes. |
| TD-45 | Change the overlay text at `web/index.html:74` to "Drop files to open them". | DRP-10. Same reason as TD-44. |
| TD-46 | No server change. `POST /api/documents` already accepts any valid name and content. | The language comes from the name on the client (`web/src/languages.js:104`). |
| TD-47 | In `uniqueName` (`web/src/drop.js:17`), when `baseName(name) === name` and `extensionOf(name)` is not empty, the candidate is `(n).<ext>`. Other names keep `<base> (n).<ext>`. | DRP-11. `baseName` returns the whole name for `.yml` (`shared/contract.js:53-56`), so today the suffix lands after the extension. |

---

## 4. Task

### M26 Drop more file types

#### T41 Accept the D80 extensions (S)

- **Covers:** DRP-7 to DRP-11, EDGE-52 to EDGE-55
- **Depends on:** none
- **Files:**
  1. `web/src/drop.js` (TD-43, TD-44, TD-47, file header comment: add DRP-7 to DRP-11)
  2. `web/index.html` (TD-45)
  3. `web/test/drop.test.js` (unit tests below)
  4. `e2e/export-drop.spec.js` (e2e tests below)
  5. `README.md` line 109 (the accepted list) and line 9 (feature summary)
  6. `docs/error-messages.csv` row 52: set the current message to "Not opened: <file> (this file type cannot be opened)." and refresh the verification result with the T41 unit and e2e tests
- **Unit tests first (`web/test/drop.test.js`):**
  1. Each D80 extension, also in upper case, returns `{ text }` from `droppedText`. Fails on the old code with the old reason.
  2. `a.pdf`, `md`, `a.sql`, `a.sh`, `a.bash` and `a.zsh` return `{ error: 'this file type cannot be opened' }`.
  3. `uniqueName('.yml', new Set(['.yml']))` is `(2).yml` and `extensionOf` of it is `yml`. `uniqueName('.md', new Set(['.md', '(2).md']))` is `(3).md`. Fails on the old code with `.yml (2)`.
  4. Update the expected reject text in the two existing tests (`web/test/drop.test.js:22-23`, `:57`).
- **E2e tests first (`e2e/export-drop.spec.js`):**
  1. Drop `ci.yml` and `main.ts`. Both tabs open. The active tab shows `data-language="typescript"`. Select `ci.yml`: it shows `yaml`. Both documents are in `/api/documents`.
  2. Update the expected reject text at `e2e/export-drop.spec.js:132` and `:154`.
  3. Assert the overlay text during a file drag (DRP-10).
  4. Drop two files named `.yml`. The second tab is `(2).yml` and shows `data-language="yaml"` (DRP-11).
- **Acceptance criteria:** every "Done when" of DRP-7 to DRP-11 holds. The existing drop tests pass with only the reject text changed.
- **Validation:** `npm test`, then `npm run test:e2e`.

---

## 5. Non-goals

- `.sql`, `.sh`, `.bash` and `.zsh` (D80)
- Any UTF-8 file regardless of extension
- An Open file button or file picker
- An OS file handler for the installed app
- Syntax validation of dropped JSON or YAML
- Changes to the 1 MB limit, the UTF-8 rule or name clash handling, except DRP-11

---

## 6. Deferred ideas

- Accept `.sql` and the shell extensions, so drop matches every highlighted type.
- Accept any UTF-8 text file and open unknown types as Plain text.

---

## 7. Status

| Task | Name | Milestone | Size | Depends on | Status | Evidence |
|------|------|-----------|------|------------|--------|----------|
| T41 | Accept the D80 extensions | M26 | S | none | Planned | |

---

## 8. Changes to v2

| Item | Change |
|------|--------|
| v2 DRP-1, DRP-3 | The accepted list grows by the 11 extensions of D80 (DRP-7). |
| v2 DRP-2 | A clash on an extension-only name gives `(n).<ext>` (DRP-11). Other names are unchanged. |
| v2 DRP-4 | The reject reason for a wrong type changes to "this file type cannot be opened" (DRP-9). |
| v2 DRP-5 | The overlay text no longer lists extensions (DRP-10). |
| README | Update the drop list and the feature summary in T41. |
| `docs/error-messages.csv` | Row 52 gets the new reject text in T41. |

---

## 9. Open questions

None.
