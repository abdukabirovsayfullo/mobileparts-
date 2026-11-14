import test from 'node:test';
import assert from 'node:assert/strict';
import { paidAfterMethodChange } from './checkoutCustomers';

test('switching from paid cash to credit clears cash while repeat credit selection preserves advance', () => {
  assert.equal(paidAfterMethodChange('naqd', 'nasiya', 3000), 0);
  assert.equal(paidAfterMethodChange('nasiya', 'nasiya', 1000), 1000);
  assert.equal(paidAfterMethodChange('naqd', 'click_payme', 3000), 3000);
});
