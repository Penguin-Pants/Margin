import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CANNOT_CONNECT, loginErrorText } from '../src/error-text.js';

test('sign-in errors say wrong password, wait in whole minutes, no connection, or a generic failure', () => {
  assert.equal(loginErrorText(401, null), 'Wrong password.');
  assert.equal(loginErrorText(429, { retryAfterSeconds: 61 }), 'Too many failed attempts. Wait 2 minutes, then try again.');
  assert.equal(loginErrorText(429, { retryAfterSeconds: 5 }), 'Too many failed attempts. Wait 1 minute, then try again.');
  assert.equal(loginErrorText(429, null), 'Too many failed attempts. Wait 15 minutes, then try again.');
  assert.equal(loginErrorText(0, null), CANNOT_CONNECT);
  assert.equal(loginErrorText(500, null), 'Sign-in failed. Try again.');
});

test('the no-connection text is the one the e2e specs expect', () => {
  assert.equal(CANNOT_CONNECT, 'Cannot connect to the server. Try again.');
});
