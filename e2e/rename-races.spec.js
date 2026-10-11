// A pending tab rename and the actions that can run beside it (Codex review
// of PR #16, PLAN_REVIEW.md section 16). A 30-second autosave delay keeps
// autosave out of each test.
import { expect, login, openDocs, test } from './fixtures.js';

test.use({ autosaveSeconds: 30 });

const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const field = (page) => page.locator('.tab-name-input');
const editor = (page) => page.locator('.cm-content');
const message = (page) => page.locator('#status-message');
const text = { 'Content-Type': 'text/plain' };

/** Holds the first rename PATCH of a document until release() is called. */
async function holdRename(page, id) {
  let release;
  const held = new Promise((resolve) => (release = resolve));
  let arrived;
  const holding = new Promise((resolve) => (arrived = resolve));
  let first = true;
  await page.route(`**/api/documents/${id}*`, async (route) => {
    const request = route.request();
    if (request.method() !== 'PATCH' || !first || !('name' in (request.postDataJSON() ?? {}))) return route.continue();
    first = false;
    arrived();
    await held;
    await route.continue();
  });
  return { release: () => release(), holding };
}

async function stored(api, id) {
  return (await api.get(`/api/documents/${id}`)).json();
}

test('the close mark during a rename of an empty new document asks Keep or Delete for the new name (Codex 1, EDGE-41)', async ({ page, api }) => {
  const created = await (await api.post('/api/documents?name=New%2001&language=markdown', { data: '', headers: text })).json();
  await login(page);
  await page.evaluate((id) => localStorage.setItem('pn.openTabs.v1', JSON.stringify({ ids: [id], activeId: id })), created.id);
  await page.reload();
  await expect(tab(page, 'New 01')).toBeVisible();
  await tab(page, 'New 01').dblclick();
  await page.keyboard.type('todo');
  await tab(page, 'New 01').locator('.tab-close').click();
  await expect(page.getByRole('dialog', { name: 'Close document' })).toBeVisible();
  expect((await stored(api, created.id)).name).toBe('todo.md');
});

test('a list refresh that started before a rename does not bring the old name back (Codex 2)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  let releaseList;
  const listHeld = new Promise((resolve) => (releaseList = resolve));
  let holdLists = true;
  await page.route(
    (url) => url.pathname === '/api/documents',
    async (route) => {
      if (route.request().method() !== 'GET' || !holdLists) return route.continue();
      // The server answers now, with the old name. The reply arrives later.
      const response = await route.fetch();
      await listHeld;
      await route.fulfill({ response });
    },
  );
  const listed = page.waitForRequest((request) => request.method() === 'GET' && new URL(request.url()).pathname === '/api/documents');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await listed;
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('fresh');
  await page.keyboard.press('Enter');
  await expect(tab(page, 'fresh.txt')).toBeVisible();
  holdLists = false;
  releaseList();
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
  await expect(tab(page, 'fresh.txt')).toBeVisible();
  expect((await stored(api, id)).name).toBe('fresh.txt');
});

test('Ctrl+S during a slow rename saves the tab where it was pressed, also after a tab change (Codex 3)', async ({ page, api }) => {
  const [first] = await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb']]);
  await editor(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('1');
  const { release, holding } = await holdRename(page, first);
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('renamed');
  await page.keyboard.press('Control+s');
  await holding;
  await tab(page, 'b.txt').click();
  await expect(editor(page)).toHaveText('bbb');
  release();
  await expect.poll(async () => (await stored(api, first)).content).toBe('aaa1');
});

test('a document deleted elsewhere keeps an open name field, and its commit says so (Codex 4, REN-12)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('kept');
  await api.delete(`/api/documents/${id}`);
  const listed = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/documents');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await listed;
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  await expect(field(page)).toHaveValue('kept.txt');
  await field(page).press('Enter');
  await expect(message(page)).toHaveText('This document no longer exists.');
});

test('a language chosen while a rename is pending wins over the Auto reset of the rename (Codex 6)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'x = 1']]);
  const { release, holding } = await holdRename(page, id);
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('b');
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.type('md');
  await page.keyboard.press('Enter');
  await holding;
  await page.getByRole('combobox', { name: 'Language' }).selectOption('python');
  release();
  await expect.poll(async () => (await stored(api, id)).language).toBe('python');
  expect((await stored(api, id)).name).toBe('b.md');
  await expect(editor(page)).toHaveAttribute('data-language', 'python');
});

test('a Rename dialog submitted while a tab rename is pending keeps the dialog name (Codex 12)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  const { release, holding } = await holdRename(page, id);
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('inline');
  await page.getByRole('button', { name: 'Documents' }).click();
  await holding;
  await page.getByRole('button', { name: 'Rename a.txt' }).click();
  const dialog = page.getByRole('dialog', { name: 'Rename document' });
  await dialog.getByLabel('Name').fill('dialog.txt');
  await dialog.getByRole('button', { name: 'Rename' }).click();
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  release();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await stored(api, id)).name).toBe('dialog.txt');
});

test('a Move while a tab rename is pending moves the renamed document (Codex 9)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  const { release, holding } = await holdRename(page, id);
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('inline');
  await page.getByRole('button', { name: 'Documents' }).click();
  await holding;
  await page.getByRole('button', { name: 'Move a.txt to Work' }).click();
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  release();
  await expect
    .poll(async () => (await (await api.get('/api/documents?workspace=work')).json()).map((doc) => doc.name))
    .toEqual(['inline.txt']);
  await expect(message(page)).not.toHaveText('This document no longer exists.');
});
