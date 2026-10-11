// Open tabs (section 2.8, T17). Tabs persist per browser and per workspace in
// localStorage (v3 TD-31). Content loads on first activation. Clean tabs
// refresh from the server on window focus and on tab activation (TD-15).

import { baseName, NAME_MAX_LENGTH, NEW_NAME } from '../../shared/contract.js';
import { choose } from './dialogs.js';
import { languageSupport, resolveLanguage } from './languages.js';
import { modName } from './shortcuts.js';

/**
 * The localStorage key of a workspace's open tabs. Personal keeps the v1 key,
 * so tabs stored before v3 restore as the Personal tabs (MIG-2).
 * @param {'personal' | 'work'} workspace
 */
export const tabsKey = (workspace) => (workspace === 'work' ? 'pn.openTabs.work.v1' : 'pn.openTabs.v1');

/**
 * @param {() => Pick<Storage, 'getItem'>} getStorage
 * @param {string} key From tabsKey.
 * @returns {{ ids: string[], activeId: string | null }}
 */
export function readOpenTabs(getStorage, key) {
  try {
    const parsed = JSON.parse(getStorage().getItem(key) ?? 'null');
    if (!Array.isArray(parsed?.ids)) return { ids: [], activeId: null };
    const ids = [...new Set(parsed.ids.filter((id) => typeof id === 'string'))];
    return { ids, activeId: ids.includes(parsed.activeId) ? parsed.activeId : null };
  } catch {
    return { ids: [], activeId: null };
  }
}

/**
 * @param {() => Pick<Storage, 'setItem'>} getStorage
 * @param {{ ids: string[], activeId: string | null }} state
 * @param {string} key From tabsKey.
 */
export function writeOpenTabs(getStorage, state, key) {
  try {
    getStorage().setItem(key, JSON.stringify(state));
  } catch {
    // Storage can be blocked. Tabs then last until reload.
  }
}

/**
 * True when a typed name is the stored one after trimming, so a rename
 * sends nothing (v4 REN-6). The server would append `.md` to it.
 * @param {string} typed
 * @param {string} current
 */
export const isUnchangedName = (typed, current) => typed.trim() === current;

/**
 * Decides what a refresh does (TD-15). Only clean tabs change: a dirty tab
 * keeps its text, and its next save reports the conflict or the delete.
 * @param {{ id: string, loaded: boolean, clean: boolean, version: number | null }[]} tabs
 * @param {import('./api.js').DocumentMeta[]} list
 */
export function planRefresh(tabs, list) {
  const byId = new Map(list.map((doc) => [doc.id, doc]));
  const remove = [];
  const reload = [];
  const meta = new Map();
  for (const tab of tabs) {
    const doc = byId.get(tab.id);
    if (!doc) {
      if (tab.clean) remove.push(tab.id);
      continue;
    }
    meta.set(tab.id, doc);
    if (tab.loaded && tab.clean && doc.version > tab.version) reload.push(tab.id);
  }
  return { remove, reload, meta };
}

/**
 * @typedef {object} Tab
 * @property {string} id
 * @property {string} name
 * @property {boolean} named False while the name is unknown ("Loading").
 * @property {string | null} language Manual override, null = auto.
 * @property {import('@codemirror/state').EditorState | null} state Null until loaded.
 * @property {string} [appliedLanguage] The language id the state's parser uses.
 */

/**
 * @param {object} deps
 * @param {ReturnType<typeof import('./editor.js').createEditor>} deps.editor
 * @param {ReturnType<typeof import('./autosave.js').createAutosave>} deps.autosave
 * @param {typeof import('./api.js').api} deps.api
 * @param {() => Storage} deps.getStorage
 * @param {{ strip: HTMLElement, editor: HTMLElement, empty: HTMLElement }} deps.elements
 * @param {() => void} deps.onActiveChange
 * @param {(text: string) => void} deps.showMessage
 */
export function createTabs({ editor, autosave, api, getStorage, elements, onActiveChange, showMessage }) {
  /** @type {Tab[]} */
  let tabs = [];
  /** @type {string | null} */
  let activeId = null;
  // The tab whose state is in the editor view. It can lag behind activeId
  // while a tab's content loads.
  /** @type {string | null} */
  let shownId = null;
  // The open name edit on a tab (v4 REN-1): the tab, its field and the
  // rename request in flight.
  /** @type {{ id: string, input: HTMLInputElement, commit: Promise<boolean> | null } | null} */
  let edit = null;

  const find = (id) => tabs.find((tab) => tab.id === id);
  const isClean = (tab) => tab.state === null || autosave.status(tab.id) === 'saved';
  const storageKey = () => tabsKey(api.workspace());
  const persist = () => writeOpenTabs(getStorage, { ids: tabs.map((tab) => tab.id), activeId }, storageKey());

  /** The live state of a tab: the view's state when the view shows it. */
  const stateOf = (tab) => (tab.id === shownId ? editor.view.state : tab.state);

  // The view's state is the live state of the shown tab. It is copied back
  // into the tab before the view shows anything else.
  function show(tab) {
    if (tab.id === shownId) return;
    const shown = find(shownId);
    if (shown) shown.state = editor.view.state;
    editor.show(tab.state);
    shownId = tab.id;
    syncLanguage(tab);
  }

  /** The language a tab should use now (EDT-4): override, else name extension. */
  const languageOf = (tab) => resolveLanguage(tab.name, tab.language);

  // Brings the shown tab's parser in line with its name and override. A tab
  // that is not shown catches up when show() runs.
  function syncLanguage(tab) {
    if (tab.id !== shownId || tab.appliedLanguage === languageOf(tab)) return;
    tab.appliedLanguage = languageOf(tab);
    editor.setLanguage(languageSupport(tab.appliedLanguage));
  }

  function showBlank() {
    const shown = find(shownId);
    if (shown) shown.state = editor.view.state;
    editor.showBlank();
    shownId = null;
  }

  /** The tab element of a document, or undefined. */
  const tabNode = (id) => [...elements.strip.children].find((node) => node.dataset.id === id);

  // The ARIA tabs pattern with manual activation (audit C4). The tab list is
  // one Tab stop, on the selected tab. The close mark is for the mouse only:
  // a tab's content is presentational, so a button in it would be an
  // unnamed Tab stop. The keyboard closes a tab with Delete. The name field
  // of a rename is in the tab only while it has the focus. Chromium exposes
  // it as a named text box there (PLAN_REVIEW.md section 16, M22 row 1).
  function tabElement(tab) {
    const node = document.createElement('div');
    node.className = 'tab';
    node.setAttribute('role', 'tab');
    node.setAttribute('aria-keyshortcuts', 'Delete F2');
    node.dataset.id = tab.id;
    const name = document.createElement('span');
    name.className = 'tab-name';
    const dot = document.createElement('span');
    dot.className = 'tab-dirty';
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.setAttribute('aria-hidden', 'true');
    close.textContent = '×';
    close.title = `Close (${modName()}+W in the installed app, Alt+W or Delete on the tab)`;
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      controller.close(tab.id);
    });
    node.addEventListener('click', () => controller.activate(tab.id));
    node.addEventListener('dblclick', (event) => {
      if (!(/** @type {HTMLElement} */ (event.target).closest('.tab-close'))) controller.startRename(tab.id);
    });
    node.append(name, dot, close);
    return node;
  }

  // The tab text hides the extension. The tooltip and the accessible name
  // keep the full name (v4 REN-11).
  function decorate(node, tab, stop) {
    node.setAttribute('aria-label', tab.name);
    node.title = tab.name;
    node.tabIndex = tab.id === stop ? 0 : -1;
    node.setAttribute('aria-selected', String(tab.id === activeId));
    node.classList.toggle('dirty', !isClean(tab));
    const name = node.querySelector('.tab-name');
    if (name) name.textContent = baseName(tab.name);
    return node;
  }

  // Each tab keeps its node, so a focused tab, a name field (v4 EDGE-35) and
  // the second click of a double-click stay on the same node. A reorder
  // (TAB-1) moves nodes, and a moved node that had the focus gets it back.
  function render() {
    const focused = elements.strip.contains(document.activeElement) ? document.activeElement : null;
    const stop = find(activeId)?.id ?? tabs[0]?.id;
    const nodes = tabs.map((tab) => decorate(tabNode(tab.id) ?? tabElement(tab), tab, stop));
    for (const child of [...elements.strip.children]) if (!nodes.includes(child)) child.remove();
    nodes.forEach((node, index) => {
      if (elements.strip.children[index] !== node) elements.strip.insertBefore(node, elements.strip.children[index] ?? null);
    });
    if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
    const empty = tabs.length === 0;
    elements.empty.hidden = !empty;
    elements.editor.hidden = empty;
  }

  /**
   * Sends a rename and shows the stored name and language on an open tab.
   * The server appends `.md` and can set the language to Auto (v4 REN-5 to
   * REN-9). An unchanged name sends nothing (REN-6).
   * @returns {Promise<string | null>} The message of a failure, or null.
   */
  async function renameDocument(id, typed, { current, workspace }) {
    if (isUnchangedName(typed, current)) return null;
    const { status, data } = await api.updateDocument(id, { name: typed }, workspace);
    if (status === 200) {
      const tab = find(id);
      if (tab) {
        tab.name = data.name;
        tab.language = data.language;
        syncLanguage(tab);
        render();
        onActiveChange();
      }
      return null;
    }
    if (data?.error === 'invalid_name') return `Use 1 to ${NAME_MAX_LENGTH} characters and no control characters.`;
    if (status === 404) return 'This document no longer exists.';
    if (status === 0) return 'Cannot connect to the server. Try again.';
    return 'Rename failed. Try again.';
  }

  // Ends the name edit. A field that had the focus gives it to its tab.
  function endEdit() {
    const { id, input } = edit;
    const focused = document.activeElement === input;
    edit = null;
    const name = document.createElement('span');
    name.className = 'tab-name';
    input.replaceWith(name);
    render();
    if (focused) tabNode(id)?.focus();
  }

  // Enter, focus loss, Ctrl+S and the Save buttons commit (v4 REN-3, REN-4).
  // The rename acts on the workspace of the commit, also when a switch ends
  // first (EDGE-39). A failure keeps the field open with its text (REN-12).
  // Resolves false when the rename failed.
  /** @returns {Promise<boolean>} */
  function commitEdit() {
    if (!edit) return Promise.resolve(true);
    if (edit.commit) return edit.commit;
    const current = edit;
    const tab = find(current.id);
    current.input.readOnly = true;
    current.commit = renameDocument(current.id, current.input.value, { current: tab.name, workspace: api.workspace() }).then(
      (problem) => {
        // A failure also shows when a close or a switch ended the edit.
        if (problem !== null) showMessage(problem);
        if (edit !== current) return problem === null;
        if (problem === null) {
          endEdit();
          return true;
        }
        current.commit = null;
        current.input.readOnly = false;
        return false;
      },
    );
    return current.commit;
  }

  // Reorder by mouse drag (v4 TAB-1 to TAB-3, D78: the mouse only). A press
  // becomes a drag only after the pointer moves DRAG_DISTANCE px, so a click
  // stays a click, and a drag never ends in a click. A press on the close
  // mark or in the name field starts no drag (EDGE-49, EDGE-50). The move
  // listeners are on the window, and a pointer outside the strip moves
  // nothing, so the tab keeps the last place it reached (EDGE-51).
  const DRAG_DISTANCE = 5;
  elements.strip.addEventListener('pointerdown', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const node = target.closest('.tab');
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
    if (!node || target.closest('.tab-close, .tab-name-input')) return;
    const id = node.dataset.id;
    const start = { x: event.clientX, y: event.clientY };
    let dragging = false;
    const move = (/** @type {PointerEvent} */ moved) => {
      // A move with the button up ends a drag whose pointerup was lost.
      if ((moved.buttons & 1) === 0) {
        end();
        return;
      }
      if (!dragging && Math.hypot(moved.clientX - start.x, moved.clientY - start.y) < DRAG_DISTANCE) return;
      dragging = true;
      tabNode(id)?.classList.add('dragging');
      const strip = elements.strip.getBoundingClientRect();
      if (moved.clientY >= strip.top && moved.clientY <= strip.bottom) moveTab(id, moved.clientX);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      tabNode(id)?.classList.remove('dragging');
      if (!dragging) return;
      if (find(id)) persist();
      // The click that follows the release would activate a tab.
      const swallow = (/** @type {MouseEvent} */ click) => click.stopPropagation();
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });

  // Puts the tab where the pointer is: after every other tab whose middle is
  // left of x. The order is stored at the end of the drag (TAB-2).
  function moveTab(id, x) {
    const from = tabs.findIndex((tab) => tab.id === id);
    if (from < 0) return;
    const to = tabs.filter((tab) => {
      if (tab.id === id) return false;
      const box = tabNode(tab.id)?.getBoundingClientRect();
      return box !== undefined && box.left + box.width / 2 < x;
    }).length;
    if (to === from) return;
    tabs.splice(to, 0, ...tabs.splice(from, 1));
    render();
  }

  const MOVES = { ArrowLeft: -1, ArrowRight: 1 };
  elements.strip.addEventListener('keydown', (event) => {
    const id = event.target.dataset?.id;
    if (!id || event.altKey || event.ctrlKey || event.metaKey) return;
    const nodes = [...elements.strip.children];
    const index = nodes.findIndex((node) => node.dataset.id === id);
    if (event.key in MOVES) nodes[(index + MOVES[event.key] + nodes.length) % nodes.length].focus();
    else if (event.key === 'Home') nodes[0].focus();
    else if (event.key === 'End') nodes.at(-1).focus();
    else if (event.key === 'Enter' || event.key === ' ') controller.activate(id);
    else if (event.key === 'F2') controller.startRename(id);
    else if (event.key === 'Delete' || event.key === 'Backspace') {
      // A cancelled close leaves the focus on the tab, also after a re-render.
      controller.close(id).then((closed) => {
        if (!closed && document.activeElement === document.body) tabNode(id)?.focus();
      });
    } else return;
    event.preventDefault();
  });

  // A double-click on the empty part of the strip, not on a tab, does what
  // New does, also with no tab open (v4 NEW-3). Both presses must be on the
  // strip: a first click on a close mark can remove the tab under the second.
  let pressedOnStrip = false;
  elements.strip.addEventListener('mousedown', (event) => {
    if (event.detail === 1) pressedOnStrip = event.target === elements.strip;
  });
  elements.strip.addEventListener('dblclick', (event) => {
    if (event.target === elements.strip && pressedOnStrip) controller.newDocument();
  });

  /** Makes the tab's state from server content and starts autosave for it. */
  function load(tab, doc) {
    tab.name = doc.name;
    tab.named = true;
    tab.language = doc.language;
    tab.appliedLanguage = languageOf(tab);
    tab.state = editor.createState(doc.content, languageSupport(tab.appliedLanguage));
    autosave.track(tab.id, { version: doc.version, getContent: () => stateOf(tab).doc.toString() });
  }

  function removeTab(id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    autosave.untrack(id);
    tabs.splice(index, 1);
    if (edit?.id === id) edit = null;
    if (shownId === id) {
      editor.showBlank();
      shownId = null;
    }
    if (activeId === id) {
      activeId = null;
      const next = tabs[index] ?? tabs[index - 1];
      if (next) controller.activate(next.id, { refresh: false });
      else onActiveChange();
    }
    persist();
    render();
  }

  // The tab is already closed, so no pending save can reach the document.
  async function deleteOnServer(id) {
    const { status, stale } = await api.deleteDocument(id);
    if (stale) return;
    if (status !== 204 && status !== 404) showMessage('Delete failed. The document is still in the document list.');
  }

  /** Replaces a tab's state with server content. Resets its autosave. */
  function replaceContent(tab, doc) {
    const wasShown = tab.id === shownId;
    if (wasShown) shownId = null;
    load(tab, doc);
    if (wasShown) show(tab);
    render();
    onActiveChange();
  }

  // Replaces a clean tab's text with the server version. Skips the reload
  // when the user typed while the request was in flight.
  async function reload(tab) {
    const before = autosave.version(tab.id);
    const { status, data } = await api.getDocument(tab.id);
    if (status !== 200 || !find(tab.id) || !isClean(tab) || autosave.version(tab.id) !== before) return;
    replaceContent(tab, data);
  }

  const controller = {
    /**
     * Restores the stored tabs of the active workspace, dropping documents
     * that no longer exist.
     * @param {{ list?: import('./api.js').DocumentMeta[] }} [options] The
     *   workspace's list when the caller read it already (a switch, TD-33).
     */
    async boot({ list } = {}) {
      const stored = readOpenTabs(getStorage, storageKey());
      let docs = list ?? null;
      if (!docs) {
        const result = await api.listDocuments();
        // A switch during the read boots the other workspace itself (TD-41).
        if (result.stale) return;
        if (result.status === 200) docs = result.data;
      }
      const byId = docs ? new Map(docs.map((doc) => [doc.id, doc])) : null;
      tabs = stored.ids
        .filter((id) => !byId || byId.has(id))
        .map((id) => ({
          id,
          name: byId?.get(id).name ?? 'Loading',
          named: Boolean(byId),
          language: byId?.get(id).language ?? null,
          state: null,
        }));
      persist();
      render();
      const first = find(stored.activeId) ?? tabs[0];
      if (first) await controller.activate(first.id, { refresh: false });
      else onActiveChange();
    },

    /**
     * Shows a tab. Loads its content the first time.
     * @param {string} id
     * @param {{ refresh?: boolean }} [options]
     */
    async activate(id, { refresh = true } = {}) {
      const tab = find(id);
      if (!tab) return;
      activeId = id;
      persist();
      render();
      if (!tab.state) {
        showBlank();
        onActiveChange();
        const { status, data, stale } = await api.getDocument(id);
        if (stale || !find(id)) return;
        if (status === 404) {
          removeTab(id);
          return;
        }
        if (status !== 200) {
          // The view stays blank and read-only. Activation, focus and
          // sign-in try the load again.
          if (activeId === id) showMessage('Could not open the document. Click its tab to try again.');
          return;
        }
        if (!tab.state) load(tab, data);
        if (activeId !== id) return;
      }
      show(tab);
      // A name edit that started during the load keeps the focus (v4 EDGE-37).
      if (document.activeElement !== edit?.input) editor.focus();
      onActiveChange();
      render();
      if (refresh) controller.refresh();
    },

    /** Opens a document in a tab, or activates its tab when it is open. */
    async open(id, name) {
      if (!find(id)) tabs.push({ id, name: name ?? 'Loading', named: name !== undefined, language: null, state: null });
      await controller.activate(id);
    },

    /** Creates a "New NN" Markdown document and opens it (v4 NEW-6). */
    async newDocument() {
      // An open name edit commits first (v4 EDGE-46). A switch meanwhile
      // drops the create, as a stale reply would (TD-41).
      const workspace = api.workspace();
      await commitEdit();
      if (api.workspace() !== workspace) return;
      const { status, data, stale } = await api.createDocument('', undefined, 'markdown');
      if (stale) return;
      if (status !== 201) {
        showMessage('Could not create a document. Try again.');
        return;
      }
      await controller.addDocument(data, '');
    },

    /**
     * Opens a document that was just created with `content` in a new active tab.
     * @param {import('./api.js').DocumentMeta} meta
     * @param {string} content
     */
    async addDocument(meta, content) {
      const tab = { id: meta.id, name: meta.name, named: true, language: meta.language, state: null };
      tabs.push(tab);
      load(tab, { ...meta, content });
      await controller.activate(tab.id);
    },

    /**
     * Replaces a tab's text with the server version, whatever its state
     * (conflict choice "Load the other version").
     * @returns {Promise<number>} The HTTP status, 200 on success, 0 on a network failure.
     */
    async reloadFromServer(id) {
      const { status, data } = await api.getDocument(id);
      const tab = find(id);
      if (status === 200 && tab) replaceContent(tab, data);
      return status;
    },

    /**
     * The close flow (section 2.8, DOC-5, DOC-6). An empty "New NN" (v4 NEW-7)
     * closes and is deleted with no prompt. Otherwise the user chooses Keep
     * (saves first; a failed save keeps the tab open), Delete permanently or
     * Cancel. Returns true when the tab closed.
     */
    async close(id) {
      const tab = find(id);
      if (!tab) return false;
      let content = controller.content(id);
      if (content === null) {
        const { status, data, stale } = await api.getDocument(id);
        if (stale) return false;
        if (status === 404) {
          removeTab(id);
          return true;
        }
        if (status !== 200) {
          showMessage('Could not close the document. Try again.');
          return false;
        }
        content = data.content;
      }

      if (content === '' && NEW_NAME.test(tab.name)) {
        removeTab(id);
        await deleteOnServer(id);
        return true;
      }

      const answer = await choose({
        title: 'Close document',
        message: `Keep "${tab.name}" in the document list, or delete it permanently? A delete cannot be undone.`,
        choices: [
          { value: 'keep', label: 'Keep', kind: 'primary' },
          { value: 'delete', label: 'Delete permanently', kind: 'danger' },
          { value: 'cancel', label: 'Cancel' },
        ],
        defaultValue: 'keep',
        cancelValue: 'cancel',
      });
      if (answer === 'cancel' || !find(id)) return false;
      if (answer === 'keep') {
        if (!(await autosave.flush(id))) return false;
        removeTab(id);
        return true;
      }
      removeTab(id);
      await deleteOnServer(id);
      return true;
    },

    /** Closes a tab without saving (its document is gone). */
    removeTab,

    /**
     * Closes every tab with no prompt and no delete, before a workspace
     * switch (TD-33). Every tab is saved by then. The stored tab list stays,
     * so the workspace gets its tabs back on the way back (WS-7).
     */
    closeAllSaved() {
      for (const tab of tabs) autosave.untrack(tab.id);
      tabs = [];
      edit = null;
      activeId = null;
      shownId = null;
      editor.showBlank();
      render();
    },

    /**
     * Opens the name field on a tab (v4 REN-1, REN-2): the full name with the
     * base name selected. An inactive tab becomes active. A tab whose name is
     * not known yet does not start the edit (EDGE-40).
     */
    async startRename(id) {
      if (edit?.id === id) return;
      await commitEdit();
      const tab = find(id);
      if (edit || !tab?.named) return;
      if (activeId !== id) controller.activate(id);
      const node = tabNode(id);
      if (!node) return;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'tab-name-input';
      input.value = tab.name;
      input.spellcheck = false;
      input.autocomplete = 'off';
      input.setAttribute('aria-label', 'Document name');
      // Keys edit the text only, so Delete never reaches the tab strip
      // (EDGE-36). Clicks stay in the field.
      input.addEventListener('keydown', (event) => {
        event.stopPropagation();
        // Enter and Escape during an IME composition belong to the IME.
        if (event.isComposing) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          commitEdit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          if (edit?.input === input && !edit.commit) endEdit();
        }
      });
      for (const type of ['click', 'dblclick']) input.addEventListener(type, (event) => event.stopPropagation());
      input.addEventListener('blur', () => {
        if (edit?.input === input) commitEdit();
      });
      node.querySelector('.tab-name').replaceWith(input);
      edit = { id, input, commit: null };
      input.focus();
      const base = baseName(tab.name);
      input.setSelectionRange(0, base === tab.name ? tab.name.length : base.length);
    },

    /** Commits an open name edit. Resolves when its request is done: false when it failed. */
    commitEdit,

    renameDocument,

    /**
     * Stores a manual language override, or null for auto (EDT-4).
     * @returns {Promise<boolean | null>} false when the server did not accept
     *   it. null when a workspace switch dropped the tab meanwhile (TD-41).
     */
    async setLanguage(id, language) {
      const { status, data, stale } = await api.updateDocument(id, { language });
      if (stale) return null;
      const tab = find(id);
      if (status !== 200 || !tab) return false;
      tab.language = data.language;
      syncLanguage(tab);
      onActiveChange();
      return true;
    },

    /** The resolved language id of a tab. */
    languageOf: (id) => {
      const tab = find(id);
      return tab ? languageOf(tab) : null;
    },

    /** Applies server metadata and reloads clean tabs that changed elsewhere. */
    async refresh() {
      // Only tabs that were open before the list was read count. A tab opened
      // during the read (New, a drop) is not in the list yet, but not gone.
      const known = new Set(tabs.map((tab) => tab.id));
      const { status, data } = await api.listDocuments();
      if (status !== 200) return;
      const plan = planRefresh(
        tabs
          .filter((tab) => known.has(tab.id))
          .map((tab) => ({ id: tab.id, loaded: tab.state !== null, clean: isClean(tab), version: autosave.version(tab.id) ?? null })),
        data,
      );
      for (const [id, doc] of plan.meta) {
        const tab = find(id);
        if (!tab) continue;
        tab.name = doc.name;
        tab.named = true;
        tab.language = doc.language;
        syncLanguage(tab);
      }
      for (const id of plan.remove) removeTab(id);
      await Promise.all(plan.reload.map((id) => reload(find(id))));
      render();
      onActiveChange();
      // Retry an active tab whose content failed to load.
      const active = find(activeId);
      if (active && !active.state) await controller.activate(active.id, { refresh: false });
    },

    render,
    /** True when the tab has no unsaved text, or no tab shows the document. */
    isClean: (id) => {
      const tab = find(id);
      return !tab || isClean(tab);
    },
    active: () => find(activeId) ?? null,
    /** The id of the document in the editor view, for autosave. */
    shownId: () => shownId,
    get: find,
    content: (id) => {
      const tab = find(id);
      return tab?.state ? stateOf(tab).doc.toString() : null;
    },
  };
  return controller;
}
