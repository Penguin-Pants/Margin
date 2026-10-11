// v4 Save and Save all buttons (REQUIREMENTS_V4.md SVB-1 to SVB-5, EDGE-43 to
// EDGE-45). A 30-second autosave delay keeps autosave out of each test.
import { expect, login, openDocs, test } from './fixtures.js';

test.use({ autosaveSeconds: 30 });

const editor = (page) => page.locator('.cm-content');
const status = (page) => page.locator('#save-status');
const message = (page) => page.locator('#status-message');
const saveButton = (page) => page.getByRole('button', { name: 'Save', exact: true });
const saveAllButton = (page) => page.getByRole('button', { name: 'Save all', exact: true });
const tab = (page, name) => page.getByRole('tab', { name, exact: true });

/** The text of the visible top-bar buttons from New to the spacer. */
const leftButtons = (page) =>
  page.locator('header.topbar').evaluate((bar) => {
    const names = [];
    for (const child of bar.children) {
      if (child.classList.contains('spacer')) break;
      const button = child.matches('button') ? child : child.querySelector(':scope > button');
      if (button && button.checkVisibility()) names.push(button.textContent);
    }
    return names;
  });

/** Types text at the end of the active tab, so it is unsaved. */
async function edit(page, text) {
  await editor(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(text);
  await expect(status(page)).toHaveText('Unsaved changes');
}

async function stored(api, id) {
  return (await (await api.get(`/api/documents/${id}`)).json()).content;
}

test('Save and Save all follow Visual on a Markdown tab and Find on a .py tab (SVB-1)', async ({ page, api }) => {
  await openDocs(page, api, [['notes.md', '# Hi'], ['app.py', 'x = 1']]);
  await expect.poll(() => leftButtons(page)).toEqual(['New', 'Outline', 'Documents', 'Export', 'Find', 'Visual', 'Save', 'Save all']);
  await tab(page, 'app.py').click();
  await expect.poll(() => leftButtons(page)).toEqual(['New', 'Outline', 'Documents', 'Export', 'Find', 'Save', 'Save all']);
});

test('the buttons hide with no tab open and show with one tab (SVB-2)', async ({ page }) => {
  await login(page);
  await expect(saveButton(page)).toBeHidden();
  await expect(saveAllButton(page)).toBeHidden();
  await page.getByRole('button', { name: 'New document' }).click();
  await expect(saveButton(page)).toBeVisible();
  await expect(saveAllButton(page)).toBeVisible();
  await expect(saveButton(page)).toBeEnabled();
  await expect(saveAllButton(page)).toBeEnabled();
});

test('Save saves the active tab now and shows no message (SVB-3)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  await edit(page, ' more');
  await saveButton(page).click();
  await expect(status(page)).toHaveText('Saved');
  expect(await stored(api, id)).toBe('aaa more');
  expect(await message(page).textContent()).toBe('');
});

test('Save all saves every open tab and says so, also with nothing unsaved (SVB-4, EDGE-44)', async ({ page, api }) => {
  const ids = await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb'], ['c.txt', 'ccc']]);
  await edit(page, '1');
  await tab(page, 'b.txt').click();
  await edit(page, '2');
  await saveAllButton(page).click();
  await expect(message(page)).toHaveText('All documents saved.');
  expect(await Promise.all(ids.map((id) => stored(api, id)))).toEqual(['aaa1', 'bbb2', 'ccc']);
  await expect(page.locator('.tab.dirty')).toHaveCount(0);

  await page.evaluate(() => (document.getElementById('status-message').textContent = ''));
  await saveAllButton(page).click();
  await expect(message(page)).toHaveText('All documents saved.');
});

test('Save all lists each document that cannot save by its full name (SVB-4, EDGE-43)', async ({ page, api }) => {
  const [first, second] = await openDocs(page, api, [['a.md', 'aaa'], ['b.md', 'bbb'], ['c.md', 'ccc']]);
  await edit(page, '1');
  await tab(page, 'b.md').click();
  await edit(page, '2');
  await tab(page, 'c.md').click();
  await edit(page, '3');
  await page.route(`**/api/documents/${first}/content`, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal_error"}' }),
  );
  // b.md changed on another device: a conflict.
  await api.put(`/api/documents/${second}/content`, { data: 'theirs', headers: { 'Content-Type': 'text/plain', 'If-Match': '1' } });
  await saveAllButton(page).click();
  await expect(message(page)).toHaveText('Not saved: a.md, b.md.');
  await expect(page.getByRole('dialog', { name: 'This document changed on another device.' })).toBeVisible();
});

test('Save all lists a document deleted elsewhere, one over 1 MB and, after a 401, every unsaved one (EDGE-43)', async ({ page, api }) => {
  const [first, second, third] = await openDocs(page, api, [['a.md', 'aaa'], ['b.md', 'bbb'], ['c.md', 'ccc']]);
  for (const name of ['a.md', 'b.md', 'c.md']) {
    await tab(page, name).click();
    await edit(page, '1');
  }
  await api.delete(`/api/documents/${first}`);
  await page.route(`**/api/documents/${second}/content`, (route) =>
    route.fulfill({ status: 413, contentType: 'application/json', body: '{"error":"too_large"}' }),
  );
  await saveAllButton(page).click();
  await expect(message(page)).toHaveText('Not saved: a.md, b.md.');
  await expect(page.getByRole('dialog', { name: 'This document was deleted on another device.' })).toBeVisible();
  expect(await stored(api, third)).toBe('ccc1');
});

test('after an expired session Save all lists every unsaved document and asks for the sign-in (EDGE-43)', async ({ page, api }) => {
  await openDocs(page, api, [['a.md', 'aaa'], ['b.md', 'bbb']]);
  await edit(page, '1');
  await tab(page, 'b.md').click();
  await edit(page, '2');
  await page.route('**/api/documents/*/content', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' }),
  );
  await saveAllButton(page).click();
  await expect(page.getByRole('dialog', { name: 'Sign in again' })).toBeVisible();
  await expect(message(page)).toHaveText('Not saved: a.md, b.md.');
});

test('Save shows the cause of a failed save in the save status label only (EDGE-43, SVB-3)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  await page.route(`**/api/documents/${id}/content`, (route) =>
    route.fulfill({ status: 413, contentType: 'application/json', body: '{"error":"too_large"}' }),
  );
  await edit(page, '1');
  await saveButton(page).click();
  await expect(status(page)).toHaveText('Not saved: larger than 1 MB.');
  expect(await message(page).textContent()).toBe('');
});

test('a mouse click on Save gives the focus back to the editor, so typing goes on (SVB-3)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  await edit(page, '1');
  await saveButton(page).click();
  await expect(status(page)).toHaveText('Saved');
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type('2');
  await saveAllButton(page).click();
  await expect(message(page)).toHaveText('All documents saved.');
  await expect(editor(page)).toBeFocused();
  expect(await stored(api, id)).toBe('aaa12');
});

test('Save all during a running workspace switch waits for the switch and keeps its message (SVB-4)', async ({ page, api }) => {
  await openDocs(page, api, [['a.md', 'aaa']]);
  let release;
  const held = new Promise((resolve) => (release = resolve));
  let arrived;
  const holding = new Promise((resolve) => (arrived = resolve));
  await page.route((url) => url.pathname === '/api/documents' && url.searchParams.get('workspace') === 'work', async (route) => {
    arrived();
    await held;
    await route.continue();
  });
  await page.locator('#workspace-switch').click();
  await holding;
  await saveAllButton(page).click();
  await expect(message(page)).toHaveText('Wait until the workspace switch ends, then try again.');
  release();
  await expect(page).toHaveTitle('Work - Margin');
});

test('Save all during a name edit stores the typed name and the text (REN-4)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  await edit(page, '1');
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('both');
  await saveAllButton(page).click();
  await expect(message(page)).toHaveText('All documents saved.');
  expect(await (await api.get(`/api/documents/${id}`)).json()).toMatchObject({ name: 'both.txt', content: 'aaa1' });
});

test('a rename that fails before Save all keeps its message and saves nothing (REN-4, REN-12)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  await edit(page, '1');
  await page.route(`**/api/documents/${id}`, (route) => (route.request().method() === 'PATCH' ? route.abort() : route.continue()));
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('lost');
  await saveAllButton(page).click();
  await expect(message(page)).toHaveText('Cannot connect to the server. Try again.');
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  await expect(message(page)).toHaveText('Cannot connect to the server. Try again.');
  await expect(page.locator('.tab-name-input')).toHaveValue('lost.txt');
  expect(await stored(api, id)).toBe('aaa');
});

test('a tab that closes while Save all runs counts as saved (EDGE-45)', async ({ page, api }) => {
  const [, second] = await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb']]);
  await edit(page, '1');
  await tab(page, 'b.txt').click();
  await edit(page, '2');
  let release;
  const held = new Promise((resolve) => (release = resolve));
  await page.route(`**/api/documents/${second}/content`, async (route) => {
    await held;
    await route.continue();
  });
  await saveAllButton(page).click();
  await tab(page, 'b.txt').locator('.tab-close').click();
  await page.getByRole('dialog', { name: 'Close document' }).getByRole('button', { name: 'Delete permanently' }).click();
  await expect(tab(page, 'b.txt')).toHaveCount(0);
  release();
  await expect(message(page)).toHaveText('All documents saved.');
});

test('Save during a name edit stores the typed name first (REN-4)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.txt', 'aaa']]);
  await tab(page, 'a.txt').dblclick();
  await page.keyboard.type('named');
  await saveButton(page).click();
  await expect(tab(page, 'named.txt')).toBeVisible();
  expect((await (await api.get(`/api/documents/${id}`)).json()).name).toBe('named.txt');
});

test('a keyboard-only run reaches and uses both buttons, and the Save tooltip names the shortcut (SVB-5)', async ({ page, api }) => {
  const [id] = await openDocs(page, api, [['a.md', 'aaa']]);
  await expect(saveButton(page)).toHaveAttribute('title', /Ctrl\+S/);
  await expect(saveAllButton(page)).toHaveAttribute('title', /.+/);
  await edit(page, '1');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+Tab'); // the tab strip
  await page.keyboard.press('Shift+Tab'); // the last top-bar control before it
  for (let i = 0; i < 20 && !(await saveButton(page).evaluate((b) => b === document.activeElement)); i += 1) {
    await page.keyboard.press('Shift+Tab');
  }
  await expect(saveButton(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(status(page)).toHaveText('Saved');
  expect(await stored(api, id)).toBe('aaa1');
  await page.keyboard.press('Tab');
  await expect(saveAllButton(page)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(message(page)).toHaveText('All documents saved.');
});
