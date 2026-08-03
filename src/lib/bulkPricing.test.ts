import { describe, it, expect } from 'vitest';
import { validateBulkTiers, getEffectiveItemInfo } from './bulkPricing';
import { getListPrice } from './priceLists';
import { Product, ClientPriceList } from '../types';

describe('bulkPricing & priceLists validation rules', () => {
  it('validates 15% margin on bulk pricing tiers when cost is provided', () => {
    const cost = 100;
    // Minimum price for 15% margin = 100 * 1.15 = 115
    const failingTiers = [{ minQuantity: 5, price: 110 }];
    const err = validateBulkTiers(failingTiers, 150, cost);
    expect(err).toContain('está por debajo del margen mínimo de 15% sobre el costo');

    const validTiers = [{ minQuantity: 5, price: 120 }];
    const validErr = validateBulkTiers(validTiers, 150, cost);
    expect(validErr).toBeNull();
  });

  it('getListPrice returns product.price if cost <= 0', () => {
    const product: Product = {
      id: 'p1',
      name: 'Item without cost',
      price: 200,
      cost: 0,
      stock: 10,
      category: 'General',
      color: '#000000',
      emoji: '📦',
    };
    const priceList: ClientPriceList = {
      id: 'l1',
      name: 'Lista Preferencial',
      profitPercent: 25,
    };

    const price = getListPrice(product, priceList);
    expect(price).toBe(200);
  });

  it('getEffectiveItemInfo flags priceListFallbackNoCost when active list is used for product with no cost', () => {
    const product: Product = {
      id: 'p1',
      name: 'Item without cost',
      price: 200,
      cost: 0,
      stock: 10,
      category: 'General',
      color: '#000000',
      emoji: '📦',
    };
    const priceList: ClientPriceList = {
      id: 'l1',
      name: 'Lista Preferencial',
      profitPercent: 25,
    };

    const info = getEffectiveItemInfo(product, 1, priceList);
    expect(info.priceListFallbackNoCost).toBe(true);
    expect(info.unitPrice).toBe(200);
  });
});
