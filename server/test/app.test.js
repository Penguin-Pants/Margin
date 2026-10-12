import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createTestApp, login, ORIGIN } from './helpers.js';

test('logs redact cookie and authorization headers', async (t) => {
  let output = '';
  const stream = new Writable({
    write(chunk, _encoding, done) {
      output += chunk;
      done();
    },
  });
  const app = await buildApp({ config: loadConfig({}), logger: { stream } });
  t.after(() => app.close());
  const headers = { cookie: 'pn_session=cookie-secret', authorization: 'Basic auth-secret', accept: 'text/plain' };
  app.log.info({ headers });
  app.log.info({ request: { headers } });
  assert.match(output, /text\/plain/);
  assert.doesNotMatch(output, /cookie-secret|auth-secret/);
});

test('a signed-in request for an unknown route or a missing file gets 404 not_found (section 2.7)', async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  const cookie = await login(ctx.app);
  const requests = [
    { method: 'GET', url: '/api/no-such-route' },
    { method: 'DELETE', url: '/api/no-such-route', headers: { origin: ORIGIN } },
    { method: 'GET', url: '/no-such-file.txt' },
    { method: 'GET', url: '/chunks/no-such-chunk.js' },
  ];
  for (const { method, url, headers } of requests) {
    const res = await ctx.app.inject({ method, url, headers: { cookie, ...headers } });
    assert.equal(res.statusCode, 404, `${method} ${url}`);
    assert.deepEqual(res.json(), { error: 'not_found' }, `${method} ${url}`);
  }
});

test('a browser page request for an unknown page or a bad address gets a plain page with a way back, not raw JSON', async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  const cookie = await login(ctx.app);
  const accept = 'text/html,application/xhtml+xml';
  const missing = await ctx.app.inject({ method: 'GET', url: '/no-such-page', headers: { cookie, accept } });
  assert.equal(missing.statusCode, 404);
  assert.match(missing.headers['content-type'], /^text\/html/);
  assert.match(missing.body, /This page does not exist\./);
  assert.match(missing.body, /<a href="\/">Open Margin<\/a>/);
  assert.doesNotMatch(missing.body, /not_found|error/);
  const bad = await ctx.app.inject({ method: 'GET', url: '/%E0%A4%A', headers: { accept } });
  assert.equal(bad.statusCode, 400);
  assert.match(bad.headers['content-type'], /^text\/html/);
  assert.match(bad.body, /This address is not valid\./);
  assert.match(bad.headers['content-security-policy'], /default-src 'self'/);
  // API calls and other clients keep the JSON body.
  const api = await ctx.app.inject({ method: 'GET', url: '/api/no-such-route', headers: { cookie, accept } });
  assert.deepEqual(api.json(), { error: 'not_found' });
  const plain = await ctx.app.inject({ method: 'GET', url: '/%E0%A4%A' });
  assert.deepEqual(plain.json(), { error: 'bad_request' });
});

test('a server error during a browser page load shows a plain page, not raw JSON', async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  ctx.app.get('/boom', async () => {
    throw new Error('SQLITE_BUSY: database is locked');
  });
  const cookie = await login(ctx.app);
  const page = await ctx.app.inject({ method: 'GET', url: '/boom', headers: { cookie, accept: 'text/html' } });
  assert.equal(page.statusCode, 500);
  assert.match(page.headers['content-type'], /^text\/html/);
  assert.match(page.body, /Something went wrong\. Reload the page to try again\./);
  assert.doesNotMatch(page.body, /SQLITE|internal_error/);
  const json = await ctx.app.inject({ method: 'GET', url: '/boom', headers: { cookie } });
  assert.deepEqual(json.json(), { error: 'internal_error' });
});
