# Margin v4 Tab Rename, Save Buttons and New Documents: Requirements

**Status:** Decision-complete. Open questions: none. M22 and M23 are built (PR #16). M24 is not built.
**Date:** 2026-10-11
**Purpose:** Single source of truth for v4. No build plan exists yet. This file does not include an implementation.
**Location:** `docs/planning/REQUIREMENTS_V4.md`
**Builds on:** `docs/planning/REQUIREMENTS.md` (v1), `docs/planning/REQUIREMENTS_V2.md` (v2) and `docs/planning/REQUIREMENTS_V3.md` (v3). Their requirements stay in force unless section 10 says otherwise.

---

## 1. Summary

- **Problem:** A rename takes four steps: Documents, find the row, Rename, then a dialog. New documents have no name extension. Saving on demand works only through Ctrl+S, and nothing saves all tabs at once. A new document needs the New button or a shortcut, and its name "Untitled N" does not sort well past 9.
- **User:** The one owner of the private Margin instance (ACC-1).
- **Outcome:** The owner renames a document in place on its tab. A name without an extension gets `.md`. Two top-bar buttons save the active tab or all open tabs now. A double-click on an empty part of the tab strip creates a document. New documents are named "New 01", "New 02" and so on.
- **Out of this version:** A Save As dialog, file downloads through Save, a Save all shortcut and a rename of existing "Untitled N" documents (section 7).

### 1.1 Current behavior (verified)

- Rename exists only in the Documents dropdown, as a dialog (`web/src/doclist.js:105`). It sends `PATCH /api/documents/:id` with the name (`server/src/documents/routes.js:63`).
- Name rule: trimmed, 1 to 255 characters, no control characters (`server/src/documents/repo.js:37`, `shared/contract.js:16`). Duplicate names are allowed (`docs/planning/BUILD_PLAN.md:209`).
- Two different extension rules exist. Language detection and export use the text after the last dot (`web/src/languages.js:103`). The drop name-clash suffix uses its own pattern (`web/src/drop.js:16`).
- New documents are "Untitled N" with no extension and a stored Markdown override (NEW-1, `shared/contract.js:19`). N is 1 + the highest N among "Untitled N" names in the workspace (`server/src/documents/repo.js:75-84`, TD-25). An override wins over the extension (EDT-4).
- An empty "Untitled N" tab closes and is deleted without a prompt (DOC-6, `web/src/tabs.js:384`).
- A click on a tab activates it. The tab strip handles arrows, Home, End, Enter, Space, Delete and Backspace (`web/src/tabs.js:184`). Every save status change redraws all tab nodes (`web/src/tabs.js:142`, `web/src/main.js:224`).
- The tab strip is a flex row at least 32 px high, also with no tab open (`web/styles.css:321-327`). A double-click on it does nothing today.
- Ctrl+S saves the shown tab now (`web/src/main.js:550`). Autosave runs N seconds after an edit (SAV-1).
- Top-bar order: New, Outline, Documents, Export, Find, Visual, then the workspace switch, theme and Account at the right end (`web/index.html:17-41`). Visual shows only on Markdown tabs (`web/src/main.js:298`). Export hides when no tab is open (`web/src/main.js:241`).

---

## 2. Decision log

Numbering continues from v3 (D39 to D56). D57 to D71 and D73 to D77 are owner decisions from the discovery on 2026-10-11. D72 lists builder defaults that the owner saw in the requirements review and published without change.

| # | Topic | Decision | Rejected |
|---|-------|----------|----------|
| D57 | Scope | Four requests: tab rename, Save buttons (first round), tab strip double-click and "New NN" names (second round). The first request said "three"; the owner confirmed two. | None |
| D58 | Name without an extension | Append `.md` to the stored name. | Keep the name as typed and set only the language to Markdown |
| D59 | Tab text | The tab hides every extension to save space. The tooltip and the accessible name keep the full name. | Show the full name, hide only `.md` |
| D60 | What an extension is | Text after the last dot: 1 to 10 letters or digits with at least one letter. | Any text after the last dot (today), known types only |
| D61 | Language override on rename | Back to Auto when the extension changes. Else the override stays. | Always clear, always keep (D54) |
| D62 | Edit field content | The full name with the base name selected. | The base name only |
| D63 | Focus loss | Commits the name, like Enter. | Cancels, like Escape |
| D64 | Rename dialog | Follows the same rules as the tab rename. | Tab rename only |
| D65 | Rename failure | The field stays open with the typed text and a message. | Revert the name and show a status message |
| D66 | Keyboard rename | F2 on a focused tab. | Mouse only |
| D67 | Save meaning | Save now, the same as Ctrl+S. Save all does this for every open tab. | A name prompt for new documents, a file download |
| D68 | Button state | Shown when a tab is open, always enabled. | Disabled when nothing is unsaved, always shown |
| D69 | Extension rule reach | One rule everywhere: rename, tab text, language, export and drop. | Rename and tab text only |
| D70 | Save all feedback | A result message every time. | A message on failure only, no message |
| D71 | Small defaults | Accepted: REN-1 (inactive tab), REN-2 (no base name), REN-5 (trailing dots), REN-6 (unchanged name), REN-7 (limit with `.md`), REN-8 (letter case). | None |
| D72 | Builder defaults | REN-4 (Ctrl+S and the Save buttons commit a pending edit), SVB-5 (tooltips) and EDGE-40 ("Loading" tab). | None |
| D73 | Tab strip double-click | A double-click on an empty part of the tab strip does the same as New. | None |
| D74 | New document name | "New", a space, then the number: "New 01". The request example "New04" was a typo. | "Untitled N" (today), "New01" without a space |
| D75 | Number padding | At least 2 digits: "New 01" to "New 99", then "New 100". | 3 digits from the start ("New 001") |
| D76 | Old "Untitled N" documents | They keep their names. The empty-close rule covers "New NN" only. | Both name patterns in the empty-close rule, a rename by migration |
| D77 | Stored name of a new document | "New 01" with no extension and a stored Markdown override, as today (NEW-1). | "New 01.md" with Auto |

---

## 3. Requirements

"Extension" in this file always means an extension by EXT-1. "Base name" is the name without its extension and its dot. "New NN" means a name that NEW-4 makes.

### 3.1 Extension rule

| ID | Requirement | Done when |
|----|-------------|-----------|
| EXT-1 | A name has an extension when the text after its last dot is 1 to 10 letters or digits with at least one letter (D60). | Unit test: `data.csv`, `a.7z` and `.env` have an extension. `v1.2 notes`, `Meeting 10.15`, `todo.` and `New 01` do not. |
| EXT-2 | One rule in `shared/contract.js` replaces the two current rules (`web/src/languages.js:103`, `web/src/drop.js:16`). Language detection, export, the drop suffix, the tab text and rename all use it. The old code is deleted (D69). | A search finds no other extension parser in `web/src` or `server/src`. |
| EXT-3 | Highlighting does not change for any name. Export reads the extension by EXT-1, so an odd name like `Meeting 10.15` no longer offers "Original (.15)". | The existing language tests pass without change. An export unit test covers `Meeting 10.15`. |

### 3.2 Tab rename

**Start and edit**

| ID | Requirement | Done when |
|----|-------------|-----------|
| REN-1 | A double-click on a tab, or F2 on a focused tab, replaces the tab text with a text field. A double-click on an inactive tab activates it, then starts the edit. The close mark keeps its job (D66, D71). | `e2e`: a double-click and F2 each show the field. A double-click on an inactive tab makes it active and shows the field. |
| REN-2 | The field holds the full name with the base name selected: "script" in `script.py`. A name with no extension or no base name (`.env`) is fully selected (D62, D71). | `e2e`: the selection matches for `script.py`, `New 01` and `.env`. |
| REN-3 | Enter commits. Escape cancels and shows the old name. Focus loss commits (D63). | `e2e`: each of the three gives the stated result on the server and the tab. |
| REN-4 | Ctrl+S and the Save buttons commit a pending edit first (D72). | `e2e`: Ctrl+S during an edit stores the typed name. |

**Name result**

| ID | Requirement | Done when |
|----|-------------|-----------|
| REN-5 | The name is trimmed and trailing dots are removed. Then, when it has no extension, `.md` is appended (D58, D71). | Unit test: `todo` gives `todo.md`, `todo.` gives `todo.md`, `Meeting 10.15` gives `Meeting 10.15.md`, `data.csv` stays. |
| REN-6 | An unchanged name sends no request and appends nothing (D71). | `e2e`: Enter on `New 01` without a change keeps `New 01` and sends no request. |
| REN-7 | The 255-character limit (`shared/contract.js:16`) applies to the final name, `.md` included (D71). | Unit test: 253 characters without an extension are rejected. |
| REN-8 | When the extension changes (letter case ignored), the language override goes back to Auto. Else the override stays (D61, D71). | `e2e`: `New 01` to `script.py` highlights Python with "Auto (detected)". `notes.txt` with a manual Markdown override renamed to `plan.txt` stays Markdown. `a.MD` to `a.md` keeps its override. |
| REN-9 | The name and the override change in one request. No state shows the new name with the old override. | API test: one `PATCH` returns the new name and the new language together. |

**Display, other paths and failure**

| ID | Requirement | Done when |
|----|-------------|-----------|
| REN-10 | The Documents dropdown Rename dialog (`web/src/doclist.js:105`) applies REN-5 to REN-9 too (D64). | `e2e`: the dialog turns `todo` into `todo.md` and clears the override as in REN-8. |
| REN-11 | The tab text hides the extension: `todo.md` shows "todo". A name with no base name shows in full. The tooltip and the accessible name keep the full name (D59). | `e2e`: the tab text, the `title` and the accessible name match for `todo.md`, `New 01` and `.env`. |
| REN-12 | On failure the field stays open with the typed text and the Rename dialog's message (`web/src/doclist.js:116-119`). Escape then shows the old name (D65). | `e2e`: an invalid name, a 404 and a network failure each keep the field open with the matching message. |

### 3.3 Save buttons

| ID | Requirement | Done when |
|----|-------------|-----------|
| SVB-1 | "Save" and then "Save all" sit in the top bar right after the Visual button. On a non-Markdown tab, Visual hides and Save follows Find. | `e2e`: the button order is correct on a Markdown tab and on a `.py` tab. |
| SVB-2 | Both buttons show when a tab is open and hide when none is, like Export. When shown, they are always enabled (D68). | `e2e`: the buttons hide in the empty state and show with one tab. |
| SVB-3 | Save does the same as Ctrl+S: the active tab saves now. The save status label shows the result (DOC-3). No other message (D67). | `e2e`: an edit saves before the autosave delay ends. |
| SVB-4 | Save all saves every open tab of the active workspace now. Then the status bar shows "All documents saved." or "Not saved: a.md, b.md." with the full names (D70). | `e2e`: two dirty tabs save and the success message shows. A failed save lists its document. |
| SVB-5 | Both buttons have accessible names and work from the keyboard (NFR-5). The Save tooltip names Ctrl+S, or Cmd+S on macOS (D72). | A keyboard-only run reaches and uses both buttons. |

### 3.4 New documents

Numbering continues from v3 (NEW-1, NEW-2).

| ID | Requirement | Done when |
|----|-------------|-----------|
| NEW-3 | A double-click on an empty part of the tab strip, not on a tab, does the same as New: it creates a document and opens it in a new active tab. It also works with no tab open. The keyboard keeps New and Alt+N (D73). | `e2e`: a double-click right of the last tab and a double-click on the empty strip each create one document. A double-click on a tab creates none (REN-1). |
| NEW-4 | A new document is named "New", a space, then its number with at least 2 digits: "New 01" to "New 99", then "New 100" (D74, D75). | Unit test: numbers 1, 9, 10, 99 and 100 give "New 01", "New 09", "New 10", "New 99" and "New 100". |
| NEW-5 | The number is 1 + the highest number among names in the workspace that are "New", a space and digits only. Gaps are not filled. "Untitled N" names do not count (TD-25, WS-6). | API test: with "New 01" and "New 07", the next is "New 08". With only "Untitled 3", the next is "New 01". "New 01" can exist in both workspaces. |
| NEW-6 | The stored name has no extension and the stored language is Markdown, as in NEW-1 (D77). | `e2e`: New gives "New 01" in the tab and the Documents list, with "Markdown" in the language list. |
| NEW-7 | The empty-close rule (DOC-6) covers "New NN" names only. One name pattern in `shared/contract.js` replaces `UNTITLED_NAME` (`shared/contract.js:19`). Existing "Untitled N" documents keep their names (D76). | `e2e`: an empty "New 01" closes with no prompt and no document is left. An empty "Untitled 1" shows the Keep or Delete prompt. |

---

## 4. Edge cases and failure behavior

Numbering continues from v3 (EDGE-28 to EDGE-34).

| ID | Situation | Behavior |
|----|-----------|----------|
| EDGE-35 | A save status change redraws the tabs during an edit (`web/src/tabs.js:142`). | The field keeps its text, selection and focus. |
| EDGE-36 | The owner presses Delete, Backspace, an arrow, Home, End or Space in the field. | The key edits the text only. It does not reach the tab strip handler (`web/src/tabs.js:184`), which closes a tab on Delete. |
| EDGE-37 | An inactive tab finishes its content load after the edit starts. Activation focuses the editor (`web/src/tabs.js:313`). | The field keeps the focus. |
| EDGE-38 | Another device renames the document during an edit, and a window focus refresh reads the new name. | The typed text stays. On commit, the typed name wins. Names have no version. |
| EDGE-39 | A workspace switch starts while a rename request runs. | The rename applies to the document's own workspace, like the Rename dialog (`web/src/doclist.js:60-63`). |
| EDGE-40 | The tab shows "Loading" because the list read failed at startup. | The edit does not start until the real name is known (D72). |
| EDGE-41 | An empty "New NN" is renamed, for example to `todo.md`. | It no longer closes without a prompt. Close asks Keep or Delete (`web/src/tabs.js:384`). |
| EDGE-42 | Two tabs show the same text, for example `notes.md` and `notes.txt`. | Both show "notes". The tooltip shows the full names. |
| EDGE-43 | Save or Save all meets a document that cannot save: a conflict, a delete on another device, more than 1 MB or an expired session. | The document stays unsaved. Save all lists it in "Not saved". The existing dialog or status label shows the cause. |
| EDGE-44 | Save or Save all runs with nothing unsaved. | Save shows no change beyond the "Saved" label. Save all still shows "All documents saved." |
| EDGE-45 | A tab closes while Save all runs. | It counts as saved (`web/src/autosave.js:161`). |
| EDGE-46 | The owner double-clicks the empty tab strip while a name edit is open. | The edit commits first (REN-3). Then NEW-3 creates the document. |
| EDGE-47 | The create request from a tab strip double-click fails. | Same as New: the message "Could not create a document. Try again." (`web/src/tabs.js:330`). No tab opens. |
| EDGE-48 | "New 01" to "New 05" exist and "New 05" is deleted. | The next is "New 05" again. The highest number decides (NEW-5). |

---

## 5. Constraints

- **C18:** The name rule and duplicate names stay as they are (`server/src/documents/repo.js:37`, `docs/planning/BUILD_PLAN.md:209`).
- **C19:** An override wins over the extension (EDT-4). New documents store Markdown (NEW-1).
- **C20:** One extension rule and one new-name pattern. All call sites move to them and the old code is deleted (`AGENTS.md`, Edits rules 5 and 6).
- **C21:** Tests come first (`AGENTS.md`, Testing). Unit tests cover EXT-1, REN-5 to REN-8, REN-11 and NEW-4. `e2e` tests cover REN-1 to REN-4, REN-10, REN-12, SVB-1 to SVB-5, NEW-3, NEW-6 and NEW-7.
- **C22:** C5 from v2 and C16 from v3 still apply: vanilla JavaScript, CodeMirror 6, esbuild, Fastify 5, `node:sqlite` and Node.js 24.

---

## 6. Preferences, examples and readings (not requirements)

- **"Untitled 1" (first round):** an example. Rename works on every tab.
- **"e.g. .md":** the owner confirmed `.md` as the appended extension (D58). It is now a requirement.
- **"New04":** a typo for "New 04" (D74).
- **"Top nav bar":** read as the top bar (`header.topbar`, `web/index.html:17`).
- **"Tab bar (not a tab of a document)":** read as the empty part of the tab strip (`#tabstrip`), right of the last tab or all of it with no tab open.
- **Notepad++:** Margin is inspired by it, but Save does not copy its Save As dialog or name prompt (D67).
- **Windows Explorer and VS Code:** reference points for the selection and focus loss choices only.

---

## 7. Non-goals

- **Create paths:** New, dropped files and recovery copies get no `.md`. "New NN" has no extension (NEW-6).
- **Old names:** a rename of existing "Untitled N" documents (D76).
- **Names:** a uniqueness check.
- **Autosave:** changes to its timing, retries or conflict dialogs (SAV-1 to SAV-5).
- **Save and shortcuts:** Save never downloads a file; Export stays the download path. No Save all shortcut.

---

## 8. Deferred ideas

- Ctrl+Shift+S for Save all (Notepad++ uses it). Clashes with browser shortcuts are not checked.
- A name prompt on the first Save of a new document
- Disabled buttons when nothing is unsaved
- New documents stored as `New NN.md`

---

## 9. Build sequence and status

No `BUILD_PLAN_V4.md` exists. The build uses this sequence as the plan, as v2 did (`PLAN_REVIEW.md` section 9, row of 2026-10-11, pending owner approval). Each phase ends with a two-pass review (`PLAN_REVIEW.md` section 1), logged in `PLAN_REVIEW.md` section 16. Deviations go to `PLAN_REVIEW.md` section 9.

| Milestone | Work | Covers | Status |
|-----------|------|--------|--------|
| M22 | Extension rule and tab rename | EXT-1 to EXT-3, REN-1 to REN-12, EDGE-35 to EDGE-42 | Done (PR #16). Owner check: the name field with a screen reader, and in Firefox and Safari (`PLAN_REVIEW.md` section 16, M22 row 1). |
| M23 | Save buttons | SVB-1 to SVB-5, EDGE-43 to EDGE-45 | Done (PR #16) |
| M24 | New document names and tab strip double-click | NEW-3 to NEW-7, EDGE-46 to EDGE-48 | Not started |

### Definition of done

- Every requirement in section 3 meets its "Done when" check.
- Every edge case in section 4 behaves as stated.
- Nothing in section 7 or section 8 is built.
- The v1, v2 and v3 tests still pass, with changes only where section 10 names them.

---

## 10. Changes to v1, v2 and v3

| Item | Change |
|------|--------|
| v1 DOC-4, rename | Also on the tab (REN-1). Both paths append `.md` and can clear the override (REN-5 to REN-10). |
| v1 DOC-4, "Untitled N" | New documents are "New NN" (NEW-4, NEW-5). Existing names stay (D76). |
| v1 DOC-6, empty untitled tab | Covers "New NN" only. An empty "Untitled N" now asks Keep or Delete (NEW-7). |
| v1 EDT-4, language from the extension | The extension is read by EXT-1. Highlighting does not change (EXT-3). |
| v1 EDT-7 and v2 SAV-5, Ctrl+S | Unchanged, but it also commits a pending name edit (REN-4). |
| v2 LAY-1, tabs | The tab text hides the extension (REN-11). A double-click on the empty strip creates a document (NEW-3). |
| v2 EXP-2 and EXP-6, export names | The extension is read by EXT-1 (EXT-3). |
| v2 DRP-2, drop name clash | The suffix goes before the extension by EXT-1. No change for the accepted file types. |
| v2 NFR-5, keyboard and names | Also covers the name field, F2 and both Save buttons. |
| v3 TD-25, numbering per workspace | Still per workspace, now for "New NN" names (NEW-5). |
| v3 NEW-1, New entry points | The tab strip double-click is a fourth entry point (NEW-3). |
| v3 D54, override after rename | A rename that changes the extension sets the language to Auto (REN-8, D61). |
| v1 `BUILD_PLAN.md` section 2.7, `PATCH /api/documents/:id` | If the server applies REN-5 to REN-9, the returned name can differ from the sent name and the language can become `null`. |
| Tests | Tests that expect a generated "Untitled N" name change to "New NN". Tests that store "Untitled N" as plain data stay. |
| README | Update at build time: features, the shortcuts table (F2), "New NN" names, the tab strip double-click and "Known limits" (rename, `.md` and the empty-tab rule). |

---

## 11. Left to the builder

- Where REN-5 to REN-9 run. Recommended: the server `PATCH` route, so one transaction covers the name and the override and both UI paths get the rule. `POST` stays unchanged (section 7).
- Where the focus goes after Enter or Escape
- The field size and style inside the tab
- The Save all tooltip text
- A cap for long "Not saved" lists

---

## 12. Sources

- Repo files cited inline (`web/index.html`, `web/styles.css`, `web/src/main.js`, `web/src/tabs.js`, `web/src/doclist.js`, `web/src/languages.js`, `web/src/drop.js`, `web/src/autosave.js`, `server/src/documents/routes.js`, `server/src/documents/repo.js`, `shared/contract.js`)
- `docs/planning/BUILD_PLAN.md`, `docs/planning/REQUIREMENTS.md`, `docs/planning/REQUIREMENTS_V2.md`, `docs/planning/REQUIREMENTS_V3.md`
- `AGENTS.md` (Edits and Testing rules)

---

## 13. Open questions

None.
