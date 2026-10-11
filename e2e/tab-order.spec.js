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

/** The x of a point past the right end of the last tab. */
async function pastLast(page) {
  const box = await page.getByRole('tab').last().boundingBox();
  return box.x + box.width + 30;
}

test('a tab dragged right or left moves there, and the order is kept after a reload (TAB-1, TAB-2)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb'], ['c.txt', 'ccc']]);
  await drag(page, 'a.txt', await pastLast(page));
  await expect.poll(() => order(page)).toEqual(['b.txt', 'c.txt', 'a.txt']);
  await drag(page, 'a.txt', await leftOf(page, 'c.txt'));
  await expect.poll(() => order(page)).toEqual(['b.txt', 'a.txt', 'c.txt']);
  // An inactive tab to the first place. A drag activates no tab.
  await drag(page, 'c.txt', (await page.locator('#tabstrip').boundingBox()).x + 1);
  await expect.poll(() => order(page)).toEqual(['c.txt', 'b.txt', 'a.txt']);
  await expect(tab(page, 'a.txt')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, 'c.txt')).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('.cm-content')).toHaveText('aaa');
  await page.reload();
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect.poll(() => order(page)).toEqual(['c.txt', 'b.txt', 'a.txt']);
});

test('a press that moves less than 5 px is a click, 5 px or more starts a drag (TAB-3)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb']]);
  const box = await tab(page, 'b.txt').locator('.tab-name').boundingBox();
  const x = box.x + 4;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 3, y + 3); // 4.2 px
  await expect(page.locator('.tab.dragging')).toHaveCount(0);
  await page.mouse.up();
  await expect(tab(page, 'b.txt')).toHaveAttribute('aria-selected', 'true');
  expect(await order(page)).toEqual(['a.txt', 'b.txt']);

  // A 5 px drag of the inactive tab a, dropped on itself, activates nothing.
  const first = await tab(page, 'a.txt').locator('.tab-name').boundingBox();
  await page.mouse.move(first.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(first.x + 8, y + 3); // 5 px
  await expect(page.locator('.tab.dragging')).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator('.tab.dragging')).toHaveCount(0);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 200)));
  await expect(tab(page, 'a.txt')).toHaveAttribute('aria-selected', 'false');
  expect(await order(page)).toEqual(['a.txt', 'b.txt']);
});

test('a touch or pen press moves no tab (D78)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb']]);
  const box = await tab(page, 'a.txt').locator('.tab-name').boundingBox();
  const end = await pastLast(page);
  await tab(page, 'a.txt').evaluate((node, { x, y, end }) => {
    const send = (type, clientX) =>
      node.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX, clientY: y }));
    send('pointerdown', x);
    for (let step = x; step < end; step += 10) window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', isPrimary: true, buttons: 1, clientX: step, clientY: y }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', isPrimary: true, clientX: end, clientY: y }));
  }, { x: box.x + 4, y: box.y + box.height / 2, end });
  expect(await order(page)).toEqual(['a.txt', 'b.txt']);
});

test('a drag whose button is no longer held stops (TAB-1)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb'], ['c.txt', 'ccc']]);
  const box = await tab(page, 'a.txt').locator('.tab-name').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 4, y);
  await page.mouse.down();
  await page.mouse.move(await rightOf(page, 'b.txt'), y, { steps: 8 });
  await expect.poll(() => order(page)).toEqual(['b.txt', 'a.txt', 'c.txt']);
  // A move with no button held, as after a lost pointerup.
  await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', isPrimary: true, buttons: 0, clientX: x, clientY: y })), { x: await pastLast(page), y });
  await page.evaluate(({ x, y }) => window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', isPrimary: true, buttons: 1, clientX: x, clientY: y })), { x: await pastLast(page), y });
  expect(await order(page)).toEqual(['b.txt', 'a.txt', 'c.txt']);
  await page.mouse.up();
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
  expect(await field.evaluate((input) => input.selectionEnd - input.selectionStart)).toBeGreaterThan(0);
  expect(await order(page)).toEqual(['a.txt', 'b.txt']);
});

test('a drag that leaves the strip keeps the last place it reached (EDGE-51)', async ({ page, api }) => {
  await openDocs(page, api, [['a.txt', 'aaa'], ['b.txt', 'bbb'], ['c.txt', 'ccc']]);
  const box = await tab(page, 'a.txt').locator('.tab-name').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(await rightOf(page, 'b.txt'), y, { steps: 8 });
  await expect.poll(() => order(page)).toEqual(['b.txt', 'a.txt', 'c.txt']);
  const outside = y + 300;
  await page.mouse.move(await rightOf(page, 'b.txt'), outside, { steps: 8 });
  // Left and right outside the strip move nothing.
  await page.mouse.move((await page.locator('#tabstrip').boundingBox()).x + 1, outside, { steps: 8 });
  await page.mouse.move(await pastLast(page), outside, { steps: 8 });
  expect(await order(page)).toEqual(['b.txt', 'a.txt', 'c.txt']);
  // A fast move that jumps out of the strip to its left, at strip height
  // (over the outline), in one pointer event.
  await page.mouse.move(await rightOf(page, 'a.txt'), y, { steps: 4 });
  await page.mouse.move((await page.locator('#tabstrip').boundingBox()).x - 20, y, { steps: 1 });
  expect(await order(page)).toEqual(['b.txt', 'a.txt', 'c.txt']);
  await page.mouse.up();
  // The drop ended the drag: a move over the strip changes nothing.
  await page.mouse.move((await page.locator('#tabstrip').boundingBox()).x + 1, y, { steps: 8 });
  expect(await order(page)).toEqual(['b.txt', 'a.txt', 'c.txt']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
