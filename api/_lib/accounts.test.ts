import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { handleAccountsRequest, resetAccountAttempts } from './accounts.js';

const dir = mkdtempSync(path.join(tmpdir(), 'cc-accounts-'));
process.env.ACCOUNTS_FILE = path.join(dir, 'accounts.json');
delete process.env.BLOB_READ_WRITE_TOKEN;

const PASSWORD = 'account-pass-1';

function mockRes() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 0,
    headersSent: false,
    payload: '',
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end(body?: string) {
      res.headersSent = true;
      res.payload = body ?? '';
    },
  };
  return {
    res,
    headers,
    json() {
      return JSON.parse(res.payload) as Record<string, unknown>;
    },
  };
}

function mockReq(method: string, body?: unknown, cookie = '') {
  const raw = body == null ? '' : JSON.stringify(body);
  return {
    method,
    url: '/api/accounts',
    headers: { host: 'localhost:5174', cookie, 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() {
      if (raw) yield Buffer.from(raw);
    },
  };
}

function cookieOf(setCookie: string): string {
  return setCookie.split(';', 1)[0];
}

test('a new account keeps its board and a later login restores it', async () => {
  resetAccountAttempts();
  const created = mockRes();
  await handleAccountsRequest(mockReq('POST', { action: 'register', username: 'Ada', password: PASSWORD }), created.res);
  assert.equal(created.res.statusCode, 200);
  assert.equal((created.json().user as { username: string }).username, 'Ada');
  assert.deepEqual((created.json().layout as { widgets: unknown[] }).widgets, []);
  assert.match(created.headers['set-cookie'], /HttpOnly/);
  assert.equal(created.res.payload.includes(PASSWORD), false);
  const stored = readFileSync(process.env.ACCOUNTS_FILE ?? '', 'utf8');
  assert.equal(stored.includes(PASSWORD), false);
  assert.equal(stored.includes('"hash"'), true);

  const cookie = cookieOf(created.headers['set-cookie']);
  const saved = mockRes();
  const layout = {
    version: 1,
    boards: [],
    widgets: [{ id: 'w_todo', type: 'todo', x: 0, y: 4, w: 6, h: 6, page: 'home', settings: {} }],
    updatedAt: 10,
  };
  await handleAccountsRequest(mockReq('POST', { action: 'save', layout }, cookie), saved.res);
  assert.equal(saved.res.statusCode, 200);
  assert.equal(((saved.json().layout as { widgets: { type: string }[] }).widgets)[0].type, 'todo');

  const loggedOut = mockRes();
  await handleAccountsRequest(mockReq('POST', { action: 'logout' }, cookie), loggedOut.res);
  assert.equal(loggedOut.res.statusCode, 200);
  assert.equal(loggedOut.json().user, null);
  assert.match(loggedOut.headers['set-cookie'], /Max-Age=0/);

  const visitor = mockRes();
  await handleAccountsRequest(mockReq('GET'), visitor.res);
  assert.equal(visitor.json().user, null);

  const again = mockRes();
  await handleAccountsRequest(mockReq('POST', { action: 'login', username: 'ada', password: PASSWORD }), again.res);
  assert.equal(again.res.statusCode, 200);
  const restored = (again.json().layout as { widgets: { id: string; y: number }[] }).widgets;
  assert.equal(restored[0].id, 'w_todo');
  assert.equal(restored[0].y, 4);
  assert.equal(again.res.payload.includes(PASSWORD), false);

  const wrong = mockRes();
  await handleAccountsRequest(mockReq('POST', { action: 'login', username: 'Ada', password: 'wrong-pass-2' }), wrong.res);
  assert.equal(wrong.res.statusCode, 401);
  assert.equal(wrong.json().error, 'Wrong username or password.');
  assert.equal(wrong.headers['set-cookie'], undefined);
});
