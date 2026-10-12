// v4 tab rename (REQUIREMENTS_V4.md REN-1 to REN-12, EDGE-35 to EDGE-42).
import { expect, login, openDocs, test } from './fixtures.js';

const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const field = (page) => page.locator('.tab-name-input');
const editor = (page) => page.locator('.cm-content');
const message = (page) => page.locator('#status-message');
const languageSelect = (page) => page.getByRole('combobox', { name: 'Language' });
const text = { 'Content-Type': 'text/plain' };

const selection = (locator) => locator.evaluate((input) => [input.selectionStart, input.selectionEnd]);
const isFocused = (locator) => locator.evaluate((input) => document.activeElement === input);

/** The stored document of an id. */
async function stored(api, id) {
  return (await api.get(`/api/documents/${id}`)).json();
}

/** Counts the PATCH requests of the page from now on. */
function countPatches(page) {
  const patches = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH') patches.push(request.postDataJSON());
  });
  return patches;
}

test('a double-click and F2 each open the name field on the tab (REN-1)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa']]);
  await tab(page, 'a.txt').dblclick();
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('a.txt');
  await page.keyboard.press('Escape');
  await expect(field(page)).toHaveCount(0);
  await expect(tab(page, 'a.txt')).toBeFocused();
  await page.keyboard.press('F2');
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveAccessibleName('Document name');
  // The field's own style wins over the dialog fields' style.
  await expect(field(page)).toHaveCSS('padding-top', '1px');
});

test('Enter and Escape that end an IME composition leave the field open (REN-3)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa']]);
  const patches = countPatches(page);
  await tab(page, 'a.txt').dblclick();
  for (const key of ['Enter', 'Escape']) {
    await field(page).evaluate((input, key) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key, isComposing: true, bubbles: true, cancelable: true }));
    }, key);
  }
  await expect(field(page)).toBeFocused();
  expect(patches).toEqual([]);
});

test('a double-click on an inactive tab makes it active and opens the field (REN-1)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb']]);
  await tab(page, 'b.txt').dblclick();
  await expect(tab(page, 'b.txt')).toHaveAttribute('aria-selected', 'true');
  await expect(editor(page)).toHaveText('bbb');
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('b.txt');
});

test('the field selects the base name, or the whole name with no extension or no base name (REN-2)', async ({ page, api }) => {
  await openDocs(page, api, [['script.py', ''], ['New 01', ''], ['.env', '']]);
  for (const [name, range] of [['script.py', [0, 6]], ['New 01', [0, 6]], ['.env', [0, 4]]]) {
    await tab(page, name).dblclick();
    await expect(field(page)).toHaveValue(name);
    expect(await selection(field(page))).toEqual(range);
    await page.keyboard.press('Escape');
  }
});

test('Enter commits, Escape cancels and focus loss commits (REN-3)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('enter');
  await page.keyboard.press('Enter');
  await expect(tab(page, 'enter.txt')).toBeFocused();
  expect((await stored(api, id)).name).toBe('enter.txt');

  await page.keyboard.press('F2');
  await page.keyboard.type('escaped');
  await page.keyboard.press('Escape');
  await expect(tab(page, 'enter.txt').locator('.tab-name')).toHaveText('enter');
  await expect(field(page)).toHaveCount(0);
  expect((await stored(api, id)).name).toBe('enter.txt');

  await page.keyboard.press('F2');
  await page.keyboard.type('blurred');
  await editor(page).click();
  await expect(tab(page, 'blurred.txt')).toBeVisible();
  await expect(field(page)).toHaveCount(0);
  await expect(editor(page)).toBeFocused();
  expect((await stored(api, id)).name).toBe('blurred.txt');
});

test('Ctrl+S during an edit stores the typed name (REN-4)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('saved');
  await page.keyboard.press('Control+s');
  await expect(tab(page, 'saved.txt')).toBeVisible();
  expect((await stored(api, id)).name).toBe('saved.txt');
});

test('a name with no extension gets .md and an unchanged name sends no request (REN-5, REN-6)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['New 01', '']]);
  const patches = countPatches(page);
  await tab(page, 'New 01').dblclick();
  await page.keyboard.press('Enter');
  await expect(field(page)).toHaveCount(0);
  await expect(tab(page, 'New 01')).toBeFocused();
  expect(patches).toEqual([]);
  expect((await stored(api, id)).name).toBe('New 01');

  await page.keyboard.press('F2');
  await page.keyboard.type('todo.');
  await page.keyboard.press('Enter');
  await expect(tab(page, 'todo.md')).toBeVisible();
  expect((await stored(api, id)).name).toBe('todo.md');
});

test('a changed extension sets the language to Auto, the same extension keeps the override (REN-8)', async ({ page, api }) => {
  const created = await (await api.post('/api/documents?name=New%2001&language=markdown', { data: 'x = 1', headers: text })).json();
  const notes = await (await api.post('/api/documents?name=notes.txt&language=markdown', { data: '# Hi', headers: text })).json();
  const upper = await (await api.post('/api/documents?name=a.MD&language=python', { data: 'x = 1', headers: text })).json();
  await login(page);
  await page.evaluate(
    (ids) => localStorage.setItem('pn.openTabs.v1', JSON.stringify({ ids, activeId: ids[0] })),
    [created.id, notes.id, upper.id],
  );
  await page.reload();
  await expect(languageSelect(page)).toHaveValue('markdown');

  await tab(page, 'New 01').dblclick();
  await page.keyboard.type('script.py');
  await page.keyboard.press('Enter');
  await expect(tab(page, 'script.py')).toBeVisible();
  await expect(editor(page)).toHaveAttribute('data-language', 'python');
  await expect(languageSelect(page)).toHaveValue('');
  expect((await stored(api, created.id)).language).toBe(null);

  await tab(page, 'notes.txt').dblclick();
  await page.keyboard.type('plan');
  await page.keyboard.press('Enter');
  await expect(tab(page, 'plan.txt')).toBeVisible();
  await expect(editor(page)).toHaveAttribute('data-language', 'markdown');
  await expect(languageSelect(page)).toHaveValue('markdown');

  await tab(page, 'a.MD').dblclick();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.type('md');
  await page.keyboard.press('Enter');
  await expect(tab(page, 'a.md')).toBeVisible();
  await expect(languageSelect(page)).toHaveValue('python');
  expect((await stored(api, upper.id)).language).toBe('python');
});

test('the Rename dialog appends .md and clears the override like the tab (REN-10)', async ({ page, api }) => {
  const doc = await (await api.post('/api/documents?name=todo.txt&language=python', { data: '# Hi', headers: text })).json();
  await login(page);
  await page.evaluate((id) => localStorage.setItem('pn.openTabs.v1', JSON.stringify({ ids: [id], activeId: id })), doc.id);
  await page.reload();
  await expect(languageSelect(page)).toHaveValue('python');
  await page.getByRole('button', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'Rename todo.txt' }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename document' });
  await dialog.getByLabel('Name').fill('todo');
  await dialog.getByRole('button', { name: 'Rename' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#doclist .doc-name')).toHaveText(['todo.md']);
  await expect(tab(page, 'todo.md')).toBeVisible();
  await expect(languageSelect(page)).toHaveValue('');
  await expect(editor(page)).toHaveAttribute('data-language', 'markdown');
  expect(await stored(api, doc.id)).toMatchObject({ name: 'todo.md', language: null });
});

test('an unchanged name in the Rename dialog sends no request (REN-10, REN-6)', async ({ page, api }) => {
  await api.post('/api/documents?name=New%2001', { data: '', headers: text });
  await login(page);
  const patches = countPatches(page);
  await page.getByRole('button', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'Rename New 01' }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename document' });
  await dialog.getByRole('button', { name: 'Rename' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#doclist .doc-name')).toHaveText(['New 01']);
  expect(patches).toEqual([]);
});

test('the tab text hides the extension, the tooltip and the accessible name keep the full name (REN-11, EDGE-42)', async ({ page, api }) => {
  await openDocs(page, api, [['todo.md', ''], ['New 01', ''], ['.env', ''], ['notes.md', ''], ['notes.txt', '']]);
  for (const [name, shown] of [['todo.md', 'todo'], ['New 01', 'New 01'], ['.env', '.env'], ['notes.md', 'notes'], ['notes.txt', 'notes']]) {
    await expect(tab(page, name).locator('.tab-name')).toHaveText(shown);
    await expect(tab(page, name)).toHaveAttribute('title', name);
    await expect(tab(page, name)).toHaveAccessibleName(name);
  }
});

test('a failed rename keeps the field open with the typed text and a message, and Escape restores the name (REN-12)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa']]);
  await tab(page, 'a.txt').dblclick();
  await field(page).fill('. . .');
  await page.keyboard.press('Enter');
  await expect(message(page)).toHaveText('Use a name of 1 to 255 characters, with no tabs or line breaks.');
  await expect(field(page)).toHaveValue('. . .');
  await expect(field(page)).toBeFocused();

  for (const [fulfil, text] of [
    [(route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not_found"}' }), 'This document no longer exists.'],
    [(route) => route.abort(), 'Cannot connect to the server. Try again.'],
  ]) {
    await page.evaluate(() => (document.getElementById('status-message').textContent = ''));
    await page.route((url) => url.pathname.startsWith('/api/documents/'), (route) =>
      route.request().method() === 'PATCH' ? fulfil(route) : route.continue(),
    );
    await field(page).fill('good.txt');
    await page.keyboard.press('Enter');
    await expect(message(page)).toHaveText(text);
    await expect(field(page)).toHaveValue('good.txt');
    await page.unrouteAll();
  }
  await page.keyboard.press('Escape');
  await expect(field(page)).toHaveCount(0);
  await expect(tab(page, 'a.txt')).toBeVisible();
});

test('a save status change during an edit keeps the field text, selection and focus (EDGE-35)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa']]);
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route('**/api/documents/*/content', async (route) => {
    await held;
    await route.continue();
  });
  await editor(page).click();
  await page.keyboard.type('more');
  await expect(page.locator('#save-status')).toHaveText('Saving...');
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('typed');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  release();
  await expect(page.locator('#save-status')).toHaveText('Saved');
  await expect(field(page)).toHaveValue('typed.txt');
  expect(await selection(field(page))).toEqual([3, 5]);
  expect(await isFocused(field(page))).toBe(true);
});

test('Delete, Backspace, arrows, Home, End and Space in the field edit the text only (EDGE-36)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb']]);
  await tab(page, 'a.txt').dblclick();
  for (const key of ['Home', 'Delete', 'End', 'Backspace', 'ArrowLeft', 'ArrowRight', 'Space']) await page.keyboard.press(key);
  await expect(field(page)).toHaveValue('.tx ');
  await expect(field(page)).toBeFocused();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(2);
});

test('a tab whose content loads after the edit starts leaves the focus in the field (EDGE-37)', async ({ page, api }) => {
  const [, second] = await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb']]);
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route(`**/api/documents/${second}`, async (route) => {
    await held;
    await route.continue();
  });
  await tab(page, 'b.txt').dblclick();
  await expect(field(page)).toBeFocused();
  release();
  await expect(editor(page)).toHaveText('bbb');
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
  expect(await isFocused(field(page))).toBe(true);
});

test('a rename from another device during an edit keeps the typed text, and the typed name wins (EDGE-38)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('mine');
  await api.patch(`/api/documents/${id}`, { data: { name: 'theirs.txt' } });
  const listed = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/documents');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await listed;
  await expect(tab(page, 'theirs.txt')).toBeVisible();
  await expect(field(page)).toHaveValue('mine.txt');
  await page.keyboard.press('Enter');
  await expect(tab(page, 'mine.txt')).toBeVisible();
  expect((await stored(api, id)).name).toBe('mine.txt');
});

test('a rename whose request runs during a workspace switch renames the document in its own workspace (EDGE-39)', async ({ page, api }) => {
  await openDocs(page, api, [['home.md', 'x']]);
  let release;
  const held = new Promise((resolve) => (release = resolve));
  let arrived;
  const holding = new Promise((resolve) => (arrived = resolve));
  await page.route((url) => url.pathname.startsWith('/api/documents/'), async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    arrived();
    await held;
    await route.continue();
  });
  await tab(page, 'home.md').dblclick();
  await page.keyboard.type('house');
  await page.keyboard.press('Enter');
  await holding;
  await page.locator('#workspace-switch').click();
  await expect(page).toHaveTitle('Work - Margin');
  const replied = page.waitForResponse((res) => res.request().method() === 'PATCH');
  release();
  await replied;
  await expect
    .poll(async () => (await (await api.get('/api/documents')).json()).map((doc) => doc.name))
    .toEqual(['house.md']);
  expect(await (await api.get('/api/documents?workspace=work')).json()).toEqual([]);
  await expect(page.getByRole('tab')).toHaveCount(0);
  // A reply read as stale would say "Cannot connect". The message clears
  // itself after 5 seconds, so it is read once.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
  expect(await message(page).textContent()).toBe('');
});

test('a rename that fails after a workspace switch closed its tab still shows the message (REN-12)', async ({ page, api }) => {
  await openDocs(page, api, [['home.md', 'x']]);
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route((url) => url.pathname.startsWith('/api/documents/'), async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    await held;
    await route.abort();
  });
  await tab(page, 'home.md').dblclick();
  await page.keyboard.type('house');
  await page.locator('#workspace-switch').click();
  await expect(page).toHaveTitle('Work - Margin');
  release();
  await expect(message(page)).toHaveText('Cannot connect to the server. Try again.');
});

test('an empty new document renamed on its tab asks Keep or Delete on close (EDGE-41)', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const active = page.locator('.tab[aria-selected="true"]');
  await expect(active).toHaveCount(1);
  await active.dblclick();
  await page.keyboard.type('todo');
  await page.keyboard.press('Enter');
  await expect(tab(page, 'todo.md')).toBeVisible();
  await tab(page, 'todo.md').locator('.tab-close').click();
  await expect(page.getByRole('dialog', { name: 'Close document' })).toBeVisible();
});

test('a tab that shows "Loading" starts no edit until its name is known (EDGE-40)', async ({ page, api }) => {
  const [, second] = await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb']]);
  await page.route(
    (url) => url.pathname === '/api/documents',
    (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 500, body: '' }) : route.continue()),
  );
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route(`**/api/documents/${second}`, async (route) => {
    await held;
    await route.continue();
  });
  await page.reload();
  await expect(tab(page, 'a.txt')).toBeVisible();
  const loading = tab(page, 'Loading');
  await expect(loading).toBeVisible();
  await loading.dblclick();
  await page.keyboard.press('F2');
  await expect(field(page)).toHaveCount(0);
  release();
  await expect(tab(page, 'b.txt')).toHaveAttribute('aria-selected', 'true');
  await tab(page, 'b.txt').dblclick();
  await expect(field(page)).toHaveValue('b.txt');
});
