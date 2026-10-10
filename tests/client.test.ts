import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-client-'));
process.env.DATA_DIR = temp;
process.env.BANK_URL = 'http://127.0.0.1:4104';
const { bankRequest, BankError } = await import('../src/banking/client');
const { closeAppDb } = await import('../src/db');
let server: http.Server;
before(async () => {
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('not json');
  });
  await new Promise<void>((r) => server.listen(4104, '127.0.0.1', r));
});
test('an unreadable response body is an ambiguous bank error', async () => {
  const error = await bankRequest('lucia', '/v1/accounts').then(
    () => null,
    (e) => e,
  );
  assert.ok(error instanceof BankError);
  assert.ok(error.status >= 500);
});
test('no response at all is a timeout', async () => {
  server.close();
  const error = await bankRequest('lucia', '/v1/accounts').then(
    () => null,
    (e) => e,
  );
  assert.ok(error instanceof BankError);
  assert.equal(error.status, 504);
});
after(() => {
  server.close();
  closeAppDb();
  fs.rmSync(temp, { recursive: true, force: true });
});
