import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-retrieval-'));
process.env.DATA_DIR = temp;
process.env.BANK_DATA_DIR = temp;
const { documents, readDocument } = await import('../src/ingestion/pipeline');
const { chunkDocument } = await import('../src/ingestion/chunker');
const { isCurrent } = await import('../src/retrieval/search');
const doc = (id: string) => documents().find((d) => d.id === id)!;
test('every chunk carries document metadata and starts with the title', () => {
  const d = doc('aurora-fees-2026');
  const chunks = chunkDocument(d, readDocument(d));
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.equal(chunk.title, d.title);
    assert.equal(chunk.version, d.version);
    assert.equal(chunk.validFrom, d.validFrom);
    assert.equal(chunk.validTo, d.validTo);
    assert.ok(chunk.text.startsWith(`${d.title} (${d.id} v${d.version})`));
    assert.ok(chunk.text.length <= 1400);
  }
  assert.equal(new Set(chunks.map((c) => c.text)).size, chunks.length);
});
test('different documents never share a chunk text', () => {
  const a = new Set(
    chunkDocument(doc('aurora-fees-2026'), readDocument(doc('aurora-fees-2026'))).map(
      (c) => c.text,
    ),
  );
  const b = chunkDocument(doc('horizon-fees-2026'), readDocument(doc('horizon-fees-2026'))).map(
    (c) => c.text,
  );
  assert.ok(b.every((text) => !a.has(text)));
});
test('isCurrent filters archived and future documents', () => {
  assert.equal(isCurrent({ validFrom: '2026-01-01', validTo: '2026-08-31' }), false);
  assert.equal(isCurrent({ validFrom: '2026-09-01', validTo: null }), true);
  assert.equal(isCurrent({ validFrom: null, validTo: null }), true);
  assert.equal(isCurrent({ validFrom: '2027-01-01', validTo: null }), false);
});
