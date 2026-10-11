import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount,
  transferPhase,
  expiresIn,
  isExpired,
  sanitizeAmountInput,
} from '../app/lib/transfer';

test('sanitizeAmountInput filters keystrokes to digits and one decimal separator', () => {
  assert.equal(sanitizeAmountInput('12'), '12');
  assert.equal(sanitizeAmountInput('12,'), '12.');
  assert.equal(sanitizeAmountInput('12.345'), null);
  assert.equal(sanitizeAmountInput('abc'), null);
  assert.equal(sanitizeAmountInput('1e3'), null);
  assert.equal(sanitizeAmountInput(''), '');
  assert.equal(sanitizeAmountInput('1234567'), null);
  assert.equal(sanitizeAmountInput('0.5'), '0.5');
});

test('parseAmount parses euros to cents and rejects invalid input', () => {
  assert.equal(parseAmount('50'), 5000);
  assert.equal(parseAmount('50,5'), 5050);
  assert.equal(parseAmount('50.50'), 5050);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('-1'), null);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('100001'), null);
});

test('transferPhase maps approval/outcome to draft/review/done', () => {
  assert.equal(transferPhase(null, null), 'draft');
  assert.equal(transferPhase({ id: 'a1' }, null), 'review');
  assert.equal(transferPhase({ id: 'a1' }, { status: 'completed' }), 'done');
});

test('expiresIn formats mm:ss and never goes negative', () => {
  const now = Date.now();
  assert.equal(expiresIn(new Date(now + 599 * 1000).toISOString(), now), '09:59');
  assert.equal(expiresIn(new Date(now - 1000).toISOString(), now), '00:00');
});

test('isExpired detects past expiry and boundary', () => {
  const now = Date.now();
  assert.equal(isExpired(new Date(now - 1).toISOString(), now), true);
  assert.equal(isExpired(new Date(now).toISOString(), now), true);
  assert.equal(isExpired(new Date(now + 60_000).toISOString(), now), false);
});
