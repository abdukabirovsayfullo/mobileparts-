import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usdToUzs, uzsToUsd } from './currency';

test('dollar costs convert to whole so\'m and back to cents', () => {
  assert.equal(usdToUzs(2.5, 12650), 31625);
  assert.equal(usdToUzs(0.333, 12650), 4212);
  assert.equal(usdToUzs(5, 0), 0);
  assert.equal(usdToUzs(-3, 12650), 0);
  assert.equal(uzsToUsd(31625, 12650), 2.5);
  assert.equal(uzsToUsd(10000, 0), 0);
});