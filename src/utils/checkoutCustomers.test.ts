import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingCheckoutCustomers, paidAfterMethodChange } from './checkoutCustomers.ts';

const nurullo = { id: 'nurullo', name: 'NURULLO AKA USTA', phone: '+998 90 123 45 67', address: 'Paxtaobod' };
test('worker checkout finds a permanent customer from server with no local customer list', () => {
  assert.deepEqual(matchingCheckoutCustomers([], [nurullo], 'nuru'), [nurullo]);
});
test('search includes customers beyond the eight quick choices and supports word order', () => {
  const locals = Array.from({ length: 8 }, (_, i) => ({ ...nurullo, id: String(i), name: `OTHER ${i}` }));
  assert.deepEqual(matchingCheckoutCustomers([...locals, nurullo], [], 'USTA NURU'), [nurullo]);
});
test('server profile updates replace stale local fields, without duplicate results', () => {
  assert.deepEqual(matchingCheckoutCustomers([{ ...nurullo, name: 'OLD' }], [nurullo], 'nuru'), [nurullo]);
  assert.deepEqual(matchingCheckoutCustomers([nurullo], [], 'absent'), []);
});
test('switching from paid cash to credit clears cash while repeat credit selection preserves advance', () => {
  assert.equal(paidAfterMethodChange('naqd', 'nasiya', 3000), 0);
  assert.equal(paidAfterMethodChange('nasiya', 'nasiya', 1000), 1000);
  assert.equal(paidAfterMethodChange('naqd', 'click_payme', 3000), 3000);
});
