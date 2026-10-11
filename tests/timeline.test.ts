import test from 'node:test';
import assert from 'node:assert/strict';
import { groupTimeline, type TimelineItem } from '../app/lib/timeline';

const ev = (key: string, label: string, ts = '2026-01-01T00:00:00Z'): TimelineItem => ({
  key,
  ts,
  type: 'event',
  label,
  raw: { key },
});

test('groupTimeline collapses consecutive equal labels into one row', () => {
  const rows = groupTimeline([
    ev('a', 'Drafted'),
    ev('b', 'Drafted'),
    ev('c', 'Drafted'),
    ev('d', 'Drafted'),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 4);
  assert.equal(rows[0].raws.length, 4);
  assert.equal(rows[0].key, 'd');
});

test('groupTimeline only merges consecutive runs', () => {
  const rows = groupTimeline([ev('a', 'X'), ev('b', 'X'), ev('c', 'Y'), ev('d', 'X')]);
  assert.deepEqual(
    rows.map((r) => [r.label, r.count]),
    [
      ['X', 2],
      ['Y', 1],
      ['X', 1],
    ],
  );
});

test('groupTimeline never merges messages', () => {
  const msg = (key: string): TimelineItem => ({
    key,
    ts: '2026-01-01T00:00:00Z',
    type: 'message',
  });
  const rows = groupTimeline([msg('a'), msg('b')]);
  assert.equal(rows.length, 2);
});
