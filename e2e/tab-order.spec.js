// Tab reorder by mouse drag (REQUIREMENTS_V4.md TAB-1 to TAB-3, EDGE-49 to
// EDGE-51).
import { expect, openDocs, test } from './fixtures.js';

const tab = (page, name) => page.getByRole('tab', { name, exact: true });
const order = (page) => page.getByRole('tab').evaluateAll((tabs) => tabs.map((node) => node.getAttribute('aria-label')));

/** Presses on a point of a tab, moves the pointer to x in steps and releases. */
async function drag(page, name, toX, { from = 'name' } = {}) {
  const target = from === 'close' ? tab(page, name).locator('.tab-close') : tab(page, name).locator('.tab-name');
  const box = await target.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(toX, y, { steps: 12 });
  await page.mouse.up();
}

/** The x of a point just right of a tab's right edge. */
async function rightOf(page, name) {
  const box = await tab(page, name).boundingBox();
  return box.x + box.width - 2;
}

async function leftOf(page, name) {
  const box = await tab(page, name).boundingBox();
  return box.x + 2;
}

test('a tab dragged right or left moves there, and the order is kept after a reload (TAB-1, TAB-2)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb'], ['c.txt', 'ccc']]);
  await drag(page, 'a.txt', await rightOf(page, 'c.txt'));
  await expect.poll(() => order(page)).toEqual(['b.txt', 'c.txt', 'a.txt']);
  await drag(page, 'a.txt', await leftOf(page, 'c.txt'));
  await expect.poll(() => order(page)).toEqual(['b.txt', 'a.txt', 'c.txt']);
  await expect(tab(page, 'a.txt')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.cm-content')).toHaveText('aaa');
  await page.reload();
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect.poll(() => order(page)).toEqual(['b.txt', 'a.txt', 'c.txt']);
});

test('a press that moves less than the drag distance is a click and keeps the order (TAB-3)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb']]);
  const box = await tab(page, 'b.txt').locator('.tab-name').boundingBox();
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 6, box.y + box.height / 2);
  await page.mouse.up();
  await expect(tab(page, 'b.txt')).toHaveAttribute('aria-selected', 'true');
  expect(await order(page)).toEqual(['a.txt', 'b.txt']);
});

test('a drag that starts on the close mark moves no tab and closes none (EDGE-49)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb'], ['c.txt', 'ccc']]);
  await drag(page, 'a.txt', await rightOf(page, 'c.txt'), { from: 'close' });
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
  expect(await order(page)).toEqual(['a.txt', 'b.txt', 'c.txt']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a drag in the name field selects text and moves no tab (EDGE-50)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb']]);
  await tab(page, 'a.txt').dblclick();
  const field = page.locator('.tab-name-input');
  await expect(field).toBeFocused();
  const box = await field.boundingBox();
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(await rightOf(page, 'b.txt'), box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(field).toBeFocused();
  expect(await order(page)).toEqual(['a.txt', 'b.txt']);
});

test('a drag that leaves the strip keeps the last place it reached (EDGE-51)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb'], ['c.txt', 'ccc']]);
  const box = await tab(page, 'a.txt').locator('.tab-name').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(await rightOf(page, 'b.txt'), y, { steps: 8 });
  await page.mouse.move(await rightOf(page, 'b.txt'), y + 300, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => order(page)).toEqual(['b.txt', 'a.txt', 'c.txt']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
