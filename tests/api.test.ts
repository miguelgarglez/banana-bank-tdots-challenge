import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-api-'));
process.env.DATA_DIR = temp;
process.env.BANK_DATA_DIR = temp;
process.env.BANK_PORT = '4105';
process.env.BANK_URL = 'http://127.0.0.1:4105';
const { seedBank } = await import('../simulator/seed');
const { seedApp } = await import('../src/seed');
const { dispatch, defineRoute } = await import('../src/api/router');
const { routes } = await import('../src/api/routes');
const { sessionToken } = await import('../src/auth');
const cookie = (id: string) => `banana_actor=${sessionToken(id)}`;
const call = (method: string, route: string, opts: { cookie?: string; body?: unknown } = {}) =>
  dispatch(
    new Request(`http://localhost/api/${route}`, {
      method,
      headers: {
        'content-type': 'application/json',
        host: 'localhost',
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
    route,
    routes,
  );

test('router matches patterns, params and literal-before-param order', async () => {
  const hits: string[] = [];
  const r = [
    defineRoute('ANY', 'conversations', 'none', ({ json }) => {
      hits.push('list');
      return json({ hit: 'list' });
    }),
    defineRoute('ANY', 'conversations/:id', 'none', ({ json, params }) => {
      hits.push(`id:${params.id}`);
      return json({ hit: params.id });
    }),
  ];
  let res = await dispatch(new Request('http://x/api/conversations'), 'conversations', r);
  assert.deepEqual(hits, ['list']);
  res = await dispatch(new Request('http://x/api/conversations/abc'), 'conversations/abc', r);
  assert.deepEqual(await res.json(), { hit: 'abc' });
  res = await dispatch(
    new Request('http://x/api/conversations/abc/messages'),
    'conversations/abc/messages',
    r,
  );
  assert.equal(res.status, 404);
});

test('router returns 404, 401 and 403 with exact messages', async () => {
  let res = await call('GET', 'no-such-route');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Route not found.' });
  res = await call('GET', 'dashboard');
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'Select a person to continue.' });
  res = await call('GET', 'conversations', { cookie: cookie('marta') });
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'Select a customer to open a chat.' });
});

test('router maps ZodError to 400 Invalid request data', async () => {
  const res = await call('POST', 'session', { body: { wrong: 1 } });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'Invalid request data.' });
});

let bank: ChildProcess;
before(async () => {
  seedBank();
  seedApp();
  bank = spawn(process.execPath, ['--import', 'tsx', 'simulator/server.ts'], {
    env: process.env,
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${process.env.BANK_URL}/health`, {
        signal: AbortSignal.timeout(500),
      });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('The bank could not be started.');
});
after(async () => {
  if (bank) bank.kill();
});

test('HTTP contract through the real handler', async () => {
  const { POST } = await import('../app/api/[...path]/route');
  const post = (route: string[], body: unknown, c?: string) =>
    POST(
      new Request(`http://localhost/api/${route.join('/')}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'localhost',
          ...(c ? { cookie: c } : {}),
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ path: route }) },
    );
  const get = (route: string[], c: string) =>
    POST(new Request(`http://localhost/api/${route.join('/')}`, { headers: { cookie: c } }), {
      params: Promise.resolve({ path: route }),
    });

  const login = await post(['session'], { userId: 'lucia' });
  assert.equal(login.status, 200);
  const lucia = (login.headers.get('set-cookie') || '').split(';')[0];

  const dash = await get(['dashboard'], lucia);
  assert.equal(dash.status, 200);
  const dashboard = await dash.json();
  assert.equal(dashboard.accounts.length, 2);

  const incidents = await get(['incidents'], cookie('lucia'));
  assert.equal(incidents.status, 403);
  assert.deepEqual(await incidents.json(), { error: 'Operator role required.' });

  const action = await post(['actions'], { name: 'list_accounts', arguments: {} }, cookie('marta'));
  assert.equal(action.status, 403);
  assert.deepEqual(await action.json(), { error: 'A customer is required.' });

  const missing = await get(['nope/nothing'], cookie('lucia'));
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Route not found.' });
});
