// v4 "New NN" names and the tab strip double-click (REQUIREMENTS_V4.md NEW-3
// to NEW-7, EDGE-46 and EDGE-47).
import { closeButton, expect, login, openDocs, test } from './fixtures.js';

const strip = (page) => page.locator('#tabstrip');
const tabs = (page) => page.getByRole('tab');
const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const message = (page) => page.locator('#status-message');
const text = { 'Content-Type': 'text/plain' };

/** Double-clicks the strip 20 px from its right end, right of every tab. */
async function doubleClickStripEnd(page) {
  const box = await strip(page).boundingBox();
  await page.mouse.dblclick(box.x + box.width - 20, box.y + box.height / 2);
}

async function names(api) {
  return (await (await api.get('/api/documents')).json()).map((doc) => doc.name);
}

test('a double-click on the empty strip creates one document, also with no tab open (NEW-3)', async ({ page, api }) => {
  await login(page);
  await expect(tabs(page)).toHaveCount(0);
  await doubleClickStripEnd(page);
  await expect(tab(page, 'New 01')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.cm-content')).toBeFocused();
  await doubleClickStripEnd(page);
  await expect(tab(page, 'New 02')).toHaveAttribute('aria-selected', 'true');
  await expect(tabs(page)).toHaveCount(2);
  expect((await names(api)).sort()).toEqual(['New 01', 'New 02']);
});

test('a double-click on a tab creates no document (NEW-3, REN-1)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa']]);
  await tab(page, 'a.txt').dblclick();
  await expect(page.locator('.tab-name-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tabs(page)).toHaveCount(1);
  expect(await names(api)).toEqual(['a.txt']);
});

test('New gives "New 01" in the tab and the Documents list, stored as Markdown (NEW-4, NEW-6)', async ({ page, api }) => {
  await login(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(tab(page, 'New 01')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'New 01').locator('.tab-name')).toHaveText('New 01');
  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('markdown');
  await page.getByRole('button', { name: 'Documents' }).click();
  await expect(page.locator('#doclist .doc-name')).toHaveText(['New 01']);
  const [doc] = await (await api.get('/api/documents')).json();
  expect(doc).toMatchObject({ name: 'New 01', language: 'markdown' });
});

test('an empty "New 01" closes with no prompt, an empty "Untitled 1" asks Keep or Delete (NEW-7)', async ({ page, api }) => {
  await api.post('/api/documents?name=Untitled%201', { data: '', headers: text });
  await login(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(tab(page, 'New 01')).toBeVisible();
  await closeButton(page, 'New 01').click();
  await expect(tab(page, 'New 01')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => names(api)).toEqual(['Untitled 1']);

  await page.getByRole('button', { name: 'Documents' }).click();
  await page.locator('#doclist .doc-open').click();
  await closeButton(page, 'Untitled 1').click();
  await expect(page.getByRole('dialog', { name: 'Close document' })).toBeVisible();
});

test('a double-click on the strip during a name edit commits the name first (EDGE-46)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa']]);
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('kept');
  await doubleClickStripEnd(page);
  await expect(tab(page, 'New 01')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'kept.txt')).toBeVisible();
  expect((await names(api)).sort()).toEqual(['New 01', 'kept.txt']);
});

test('a failed create from the strip shows the New message and opens no tab (EDGE-47)', async ({ page }) => {
  await login(page);
  await page.route(
    (url) => url.pathname === '/api/documents',
    (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()),
  );
  await doubleClickStripEnd(page);
  await expect(message(page)).toHaveText('Could not create a document. Try again.');
  await expect(tabs(page)).toHaveCount(0);
});
