import {describe, expect, it} from 'vitest';
import {
  hasValidGtinCheckDigit,
  parseAndValidateProduct
} from '../src/models/product-schema.js';
import {loadFanFixture} from './helpers.js';

describe('product identity contract', () => {
  it('accepts the canonical demo GTIN', () => {
    expect(hasValidGtinCheckDigit('00047199990002')).toBe(true);
  });

  it('rejects the two invalid GTINs from the old branch fixtures', () => {
    expect(hasValidGtinCheckDigit('047199990001')).toBe(false);
    expect(hasValidGtinCheckDigit('04710000000000')).toBe(false);
  });

  it('rejects a product id that disagrees with GTIN or serial', async () => {
    const product = await loadFanFixture();
    expect(() => parseAndValidateProduct({
      ...product,
      serialNumber: 'FAN-2026-999'
    })).toThrowError(expect.objectContaining({code: 'PRODUCT_ID_MISMATCH'}));
  });
});
