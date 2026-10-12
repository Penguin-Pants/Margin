// Error messages that a user can reach in the browser (docs/error-messages.csv).
// Each one says what went wrong in plain words and, where one exists, how to
// recover. None shows raw JSON, an internal error text or an id.
import { drop, expect, login, OWNER_PASSWORD, openDocs, test } from './fixtures.js';

const message = (page) => page.locator('#status-message');
const editor = (page) => page.locator('.cm-content');
const serverError = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"internal_error"}' });

test('an unknown page shows a plain page with a way back to the app', async ({ page }) => {
  await login(page);
  await page.goto('/no-such-page');
  await expect(page.locator('body')).toContainText('This page does not exist.');
  await expect(page.locator('body')).not.toContainText('not_found');
  await page.getByRole('link', { name: 'Open Margin' }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.locator('#empty-state')).toBeVisible();
});

test('a malformed address shows a plain page, not raw JSON', async ({ page }) => {
  await page.goto('/%E0%A4%A');
  await expect(page.locator('body')).toContainText('This address is not valid.');
  await expect(page.locator('body')).not.toContainText('bad_request');
});

test('a server error at sign-in says so in plain words', async ({ page }) => {
  await page.goto('/login');
  await page.route('**/api/login', serverError);
  await page.getByLabel('Password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#login-error')).toHaveText('Could not sign in. Try again.');
});

test('a failed sign-out says so and keeps the app open', async ({ page }) => {
  await login(page);
  await page.route('**/api/logout', serverError);
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(message(page)).toHaveText('Could not sign out. Try again.');
  await expect(page).toHaveURL(/\/$/);
});

test('a server error in Change password shows in the dialog', async ({ page }) => {
  await login(page);
  await page.route('**/api/password', serverError);
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Change password' }).click();
  const dialog = page.getByRole('dialog', { name: 'Change password' });
  await dialog.getByLabel('Current password').fill(OWNER_PASSWORD);
  await dialog.getByLabel('New password (12 to 256 characters)').fill('another-password-1');
  await dialog.getByLabel('New password again').fill('another-password-1');
  await dialog.getByRole('button', { name: 'Change password' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Could not change the password. Try again.');
});

test('a server error in a tab rename keeps the field and says so', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa']]);
  await page.route((url) => url.pathname.startsWith('/api/documents/'), (route) =>
    route.request().method() === 'PATCH' ? serverError(route) : route.continue(),
  );
  await page.getByRole('tab', { name: 'a.txt' }).dblclick();
  await page.getByRole('textbox', { name: 'Document name' }).fill('b.txt');
  await page.keyboard.press('Enter');
  await expect(message(page)).toHaveText('Could not rename the document. Try again.');
});

test('a failed delete from the document list says so', async ({ page, api }) => {
  await openDocs(page, api, [['a.md', 'aaa']]);
  await page.route((url) => url.pathname.startsWith('/api/documents/'), (route) =>
    route.request().method() === 'DELETE' ? serverError(route) : route.continue(),
  );
  await page.getByRole('button', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'Delete a.md' }).click();
  await page.getByRole('dialog', { name: 'Delete document' }).getByRole('button', { name: 'Delete permanently' }).click();
  await expect(message(page)).toHaveText('Could not delete the document. Try again.');
});

test('dropped files that are not UTF-8 or that the server cannot save are named with a plain reason', async ({ page }) => {
  await login(page);
  await page.route((url) => url.pathname === '/api/documents' && url.search.includes('name=bad.md'), serverError);
  await drop(page, [
    { name: 'latin.txt', bytes: [0x63, 0x61, 0x66, 0xe9] },
    { name: 'bad.md', text: '# bad' },
  ]);
  await expect(message(page)).toHaveText(
    'Not opened: latin.txt (the text is not UTF-8; save the file as UTF-8 first), bad.md (could not be saved).',
  );
});

test('an unexpected export failure shows a plain message, not the internal error', async ({ page, api }) => {
  await openDocs(page, api, [['notes.md', '# Notes']]);
  await page.evaluate(() => {
    URL.createObjectURL = () => {
      throw new TypeError('internal blob failure');
    };
  });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('group', { name: 'Export formats' }).getByRole('button', { name: 'Markdown (.md)' }).click();
  await expect(message(page)).toHaveText('Export failed. Try again.');
});

/** Holds the requests with this method whose URL matches, until release() is called. */
async function hold(page, method, matchUrl) {
  let release;
  const held = new Promise((resolve) => (release = resolve));
  let arrived;
  const holding = new Promise((resolve) => (arrived = resolve));
  await page.route(matchUrl, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    arrived();
    await held;
    await route.continue();
  });
  return { holding, release };
}

test('a workspace switch during another operation names that operation in plain words', async ({ page, api }) => {
  await openDocs(page, api, [['a.md', 'aaa']]);
  const switchButton = page.locator('#workspace-switch');

  const creating = await hold(page, 'POST', (url) => url.pathname === '/api/documents');
  await drop(page, [{ name: 'dropped.md', text: 'x' }]);
  await creating.holding;
  await switchButton.click();
  await expect(message(page)).toHaveText('Wait until the opening of dropped files ends, then try again.');
  creating.release();
  await expect(page.getByRole('tab', { name: 'dropped.md' })).toBeVisible();
  await page.unrouteAll();

  const moving = await hold(page, 'PATCH', (url) => url.pathname.startsWith('/api/documents/'));
  await page.getByRole('button', { name: 'Documents' }).click();
  await page.getByRole('button', { name: 'Move a.md to Work' }).click();
  await moving.holding;
  await switchButton.click();
  await expect(message(page)).toHaveText('Wait until the document move ends, then try again.');
  moving.release();
  await expect(message(page)).toHaveText('Moved a.md to Work.');
  await page.unrouteAll();

  const saving = await hold(page, 'PUT', (url) => url.pathname.endsWith('/content'));
  await page.getByRole('tab', { name: 'dropped.md' }).click();
  await editor(page).click();
  await page.keyboard.type('y');
  await page.getByRole('button', { name: 'Save all' }).click();
  await saving.holding;
  await switchButton.click();
  await expect(message(page)).toHaveText('Wait until the Save all ends, then try again.');
  saving.release();
  await expect(message(page)).toHaveText('All documents saved.');
});

/** Fails GET of one document's content with a server error. */
const failGet = (page, id) =>
  page.route(`**/api/documents/${id}`, (route) => (route.request().method() === 'GET' ? serverError(route) : route.fallback()));

test('a tab whose content fails to load says how to try again', async ({ page, api }) => {
  const [, second] = await openDocs(page, api, [['a.md', 'aaa'], ['b.md', 'bbb']]);
  await failGet(page, second);
  await page.getByRole('tab', { name: 'b.md' }).click();
  await expect(message(page)).toHaveText('Could not open the document. Click its tab to try again.');
  await page.unrouteAll();
  await page.getByRole('tab', { name: 'b.md' }).click();
  await expect(editor(page)).toHaveText('bbb');
});

test('closing a tab whose content cannot be read says so and keeps the tab', async ({ page, api }) => {
  const [, second] = await openDocs(page, api, [['a.md', 'aaa'], ['b.md', 'bbb']]);
  await failGet(page, second);
  await page.getByRole('tab', { name: 'b.md' }).locator('.tab-close').click();
  await expect(message(page)).toHaveText('Could not close the document. Try again.');
  await expect(page.getByRole('tab', { name: 'b.md' })).toBeVisible();
});

test('a failed delete from the close dialog says where the document still is', async ({ page, api }) => {
  await openDocs(page, api, [['a.md', 'aaa']]);
  await page.route((url) => url.pathname.startsWith('/api/documents/'), (route) =>
    route.request().method() === 'DELETE' ? serverError(route) : route.fallback(),
  );
  await page.getByRole('tab', { name: 'a.md' }).locator('.tab-close').click();
  await page.getByRole('dialog', { name: 'Close document' }).getByRole('button', { name: 'Delete permanently' }).click();
  await expect(message(page)).toHaveText('Could not delete the document. It is still in the document list, so delete it from there.');
  expect((await api.get('/api/documents')).status()).toBe(200);
  expect(await (await api.get('/api/documents')).json()).toHaveLength(1);
});

test('a failed language change says so and shows the stored language again', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa']]);
  await page.route((url) => url.pathname.startsWith('/api/documents/'), (route) =>
    route.request().method() === 'PATCH' ? serverError(route) : route.fallback(),
  );
  const select = page.getByRole('combobox', { name: 'Language' });
  await select.selectOption('python');
  await expect(message(page)).toHaveText('Could not change the language. Try again.');
  await expect(select).toHaveValue('');
});
