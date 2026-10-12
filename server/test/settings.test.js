import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createTestApp, login, ORIGIN } from './helpers.js';

let ctx;
let cookie;

beforeEach(async () => {
  ctx = await createTestApp();
  cookie = await login(ctx.app);
});

afterEach(() => ctx.close());

const get = () => ctx.app.inject({ method: 'GET', url: '/api/settings', headers: { cookie } });
const put = (payload) =>
  ctx.app.inject({ method: 'PUT', url: '/api/settings', headers: { cookie, origin: ORIGIN }, payload });

test('the autosave delay is 5 seconds by default', async () => {
  const res = await get();
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().autosaveSeconds, 5);
});

test('a saved delay is returned and survives a restart', async () => {
  const res = await put({ autosaveSeconds: 12 });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().autosaveSeconds, 12);
  assert.equal((await get()).json().autosaveSeconds, 12);
  await ctx.restart();
  cookie = await login(ctx.app);
  assert.equal((await get()).json().autosaveSeconds, 12);
});

test('1 and 60 are accepted', async () => {
  assert.equal((await put({ autosaveSeconds: 1 })).statusCode, 200);
  assert.equal((await put({ autosaveSeconds: 60 })).statusCode, 200);
  assert.equal((await get()).json().autosaveSeconds, 60);
});

test('values outside whole numbers 1 to 60 are rejected and the stored value stays (SAV-3)', async () => {
  await put({ autosaveSeconds: 7 });
  for (const autosaveSeconds of [0, 61, 2.5, -1, '5', null, true]) {
    const res = await put({ autosaveSeconds });
    assert.equal(res.statusCode, 400, `value ${JSON.stringify(autosaveSeconds)}`);
    assert.deepEqual(res.json(), { error: 'invalid_autosave_seconds' });
  }
  assert.equal((await put({})).statusCode, 400);
  assert.equal((await get()).json().autosaveSeconds, 7);
});

test('a body that is not an object is rejected', async () => {
  for (const payload of [[5], '5']) {
    const res = await ctx.app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.json(), { error: 'invalid_request' });
  }
});

test('a stored value that breaks the rule reads as the default', async () => {
  for (const bad of ['abc', '0', '61', '2.5', '']) {
    ctx.db
      .prepare("INSERT INTO settings (key, value) VALUES ('autosave_seconds', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
      .run(bad);
    assert.equal((await get()).json().autosaveSeconds, 5, `stored ${JSON.stringify(bad)}`);
  }
});

// Workspace colors (v3 CLR-2 to CLR-4, TD-27).
const colors = async () => (await get()).json().workspaceColors;

test('both workspace colors are null (the default) at first', async () => {
  assert.deepEqual(await colors(), { personal: null, work: null });
});

test('#RGB and #RRGGBB in any letter case are stored and survive a restart (CLR-3, CLR-4)', async () => {
  const res = await put({ autosaveSeconds: 5, workspaceColors: { personal: '#AbC', work: '#0f766e' } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json().workspaceColors, { personal: '#AbC', work: '#0f766e' });
  await ctx.restart();
  cookie = await login(ctx.app);
  assert.deepEqual(await colors(), { personal: '#AbC', work: '#0f766e' });
});

test('null returns a workspace to its default color (CLR-2)', async () => {
  await put({ autosaveSeconds: 5, workspaceColors: { personal: '#123', work: '#456' } });
  await put({ autosaveSeconds: 5, workspaceColors: { personal: null, work: '#456' } });
  assert.deepEqual(await colors(), { personal: null, work: '#456' });
});

test('other color values are rejected with the workspace, and nothing is saved (CLR-3)', async () => {
  await put({ autosaveSeconds: 7, workspaceColors: { personal: '#111', work: '#222' } });
  for (const bad of ['#12', 'red', '#GGGGGG', '123456', '#1234', ' #123', '', 5, true, {}]) {
    const res = await put({ autosaveSeconds: 9, workspaceColors: { personal: '#333', work: bad } });
    assert.deepEqual([res.statusCode, res.json()], [400, { error: 'invalid_color', workspace: 'work' }], JSON.stringify(bad));
  }
  const res = await put({ autosaveSeconds: 9, workspaceColors: { personal: 'blue', work: '#333' } });
  assert.deepEqual(res.json(), { error: 'invalid_color', workspace: 'personal' });
  assert.deepEqual((await get()).json(), { autosaveSeconds: 7, workspaceColors: { personal: '#111', work: '#222' }, brandTheme: 'classic' });
});

test('workspaceColors must hold both workspaces and nothing else', async () => {
  for (const workspaceColors of [{ personal: '#111' }, { personal: '#111', work: '#222', team: '#333' }, null, [], '#111']) {
    const res = await put({ autosaveSeconds: 5, workspaceColors });
    assert.deepEqual([res.statusCode, res.json()], [400, { error: 'invalid_request' }], JSON.stringify(workspaceColors));
  }
});

test('a PUT without workspaceColors keeps the colors', async () => {
  await put({ autosaveSeconds: 5, workspaceColors: { personal: '#111', work: '#222' } });
  assert.equal((await put({ autosaveSeconds: 8 })).statusCode, 200);
  assert.deepEqual((await get()).json(), { autosaveSeconds: 8, workspaceColors: { personal: '#111', work: '#222' }, brandTheme: 'classic' });
});

test('an invalid delay with valid colors saves neither (TD-27)', async () => {
  await put({ autosaveSeconds: 7, workspaceColors: { personal: '#111', work: '#222' } });
  const res = await put({ autosaveSeconds: 0, workspaceColors: { personal: '#999', work: '#999' } });
  assert.deepEqual(res.json(), { error: 'invalid_autosave_seconds' });
  assert.deepEqual((await get()).json(), { autosaveSeconds: 7, workspaceColors: { personal: '#111', work: '#222' }, brandTheme: 'classic' });
});

test('a stored color that breaks the rule reads as the default (CLR-3)', async () => {
  for (const bad of ['red', '#12', '']) {
    ctx.db
      .prepare("INSERT INTO settings (key, value) VALUES ('color_work', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
      .run(bad);
    assert.deepEqual(await colors(), { personal: null, work: null }, `stored ${JSON.stringify(bad)}`);
  }
});

// Brand theme: Classic or Dr. Claw, one value for every device.
const brandTheme = async () => (await get()).json().brandTheme;

test('the brand theme is classic by default', async () => {
  assert.equal(await brandTheme(), 'classic');
});

test('dr-claw is stored, survives a restart and can go back to classic', async () => {
  const res = await put({ autosaveSeconds: 5, brandTheme: 'dr-claw' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().brandTheme, 'dr-claw');
  await ctx.restart();
  cookie = await login(ctx.app);
  assert.equal(await brandTheme(), 'dr-claw');
  await put({ autosaveSeconds: 5, brandTheme: 'classic' });
  assert.equal(await brandTheme(), 'classic');
});

test('a PUT without brandTheme keeps the brand theme', async () => {
  await put({ autosaveSeconds: 5, brandTheme: 'dr-claw' });
  assert.equal((await put({ autosaveSeconds: 9 })).statusCode, 200);
  assert.equal(await brandTheme(), 'dr-claw');
});

test('other brand themes are rejected and nothing is saved', async () => {
  await put({ autosaveSeconds: 7, brandTheme: 'dr-claw' });
  for (const bad of ['blue', 'Classic', '', null, true, 1, {}]) {
    const res = await put({ autosaveSeconds: 9, brandTheme: bad });
    assert.deepEqual([res.statusCode, res.json()], [400, { error: 'invalid_brand_theme' }], JSON.stringify(bad));
  }
  assert.deepEqual((await get()).json(), { autosaveSeconds: 7, workspaceColors: { personal: null, work: null }, brandTheme: 'dr-claw' });
});

test('a stored brand theme that breaks the rule reads as classic', async () => {
  for (const bad of ['blue', '']) {
    ctx.db
      .prepare("INSERT INTO settings (key, value) VALUES ('brand_theme', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value")
      .run(bad);
    assert.equal(await brandTheme(), 'classic', `stored ${JSON.stringify(bad)}`);
  }
});
