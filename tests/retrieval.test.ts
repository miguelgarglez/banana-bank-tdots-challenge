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
const { isCurrent, diversify } = await import('../src/retrieval/search');
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
test('diversify caps results per document preserving order', () => {
  const ranked = [
    { documentId: 'a', score: 10 },
    { documentId: 'a', score: 9 },
    { documentId: 'b', score: 8 },
    { documentId: 'a', score: 7 },
    { documentId: 'c', score: 6 },
    { documentId: 'b', score: 5 },
    { documentId: 'a', score: 4 },
  ];
  const result = diversify(ranked, 5);
  assert.deepEqual(
    result.map((x) => x.documentId),
    ['a', 'a', 'b', 'c', 'b'],
  );
  assert.deepEqual(
    result.map((x) => x.score),
    [10, 9, 8, 6, 5],
  );
  for (const id of ['a', 'b', 'c'])
    assert.ok(result.filter((x) => x.documentId === id).length <= 2);
});
test('isCurrent filters archived and future documents', () => {
  assert.equal(isCurrent({ validFrom: '2026-01-01', validTo: '2026-08-31' }), false);
  assert.equal(isCurrent({ validFrom: '2026-09-01', validTo: null }), true);
  assert.equal(isCurrent({ validFrom: null, validTo: null }), true);
  assert.equal(isCurrent({ validFrom: '2027-01-01', validTo: null }), false);
});
test('readDocument converts the HTML guide to markdown', () => {
  const text = readDocument(doc('context-guide-1'));
  const lines = text.split('\n');
  assert.ok(lines.includes('# Support guide'));
  assert.ok(lines.includes('## How to answer'));
  assert.ok(!text.includes('<'));
});
test('readDocument parses the CSV notice into markdown sections', () => {
  const text = readDocument(doc('notice-aurora'));
  assert.ok(text.startsWith('# Aurora policy update'));
  assert.ok(text.includes('\n\n## What changes'));
});
test('no document emits "## " outside a line start', () => {
  for (const d of documents()) {
    const text = readDocument(d);
    const bad = text.split('\n').some((l) => l.includes('## ') && !l.startsWith('#'));
    assert.ok(!bad, `${d.id} has an inline ##`);
  }
});
test('manifest ids are unique and every file exists', () => {
  const docs = documents();
  assert.equal(new Set(docs.map((d) => d.id)).size, docs.length);
  for (const d of docs)
    assert.ok(fs.existsSync(path.resolve('fixtures/documents', d.file)), d.file);
});
test('each product has one current fees-2026 document and one v1 archive', () => {
  const docs = documents();
  for (const p of [
    'aurora',
    'horizon',
    'cloud',
    'travel',
    'family',
    'professional',
    'young',
    'community',
  ]) {
    const current = docs.filter((d) => d.id === `${p}-fees-2026`);
    assert.equal(current.length, 1, `${p} current fees`);
    assert.equal(current[0].validTo, null);
    const archive = docs.filter((d) => d.family === p && d.validTo);
    assert.ok(archive.length >= 1, `${p} archive`);
    assert.ok(
      archive.every((d) => d.version === 1),
      `${p} archive version`,
    );
  }
});
