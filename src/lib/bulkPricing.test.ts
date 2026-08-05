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

  it('applies bulk pricing based on real units when buying by packaging (2 pkgs x 3 units = 6 units)', () => {
    const product: Product = {
      id: 'p2',
      name: 'Refresco Cola',
      price: 35,
      cost: 15,
      stock: 100,
      category: 'Bebidas',
      color: '#000000',
      emoji: '🥤',
      bulkPricing: [
        { minQuantity: 6, price: 25 }, // 6+ u -> $25/unit
      ],
      packagings: [
        { id: 'pkg1', name: 'Paquete 3u', unitsPerPackage: 3, price: 100 }, // $33.33/unit
      ],
    };

    const packaging = product.packagings![0];

    // Buying 2 packages = 6 units. Bulk pricing at 6+ units ($25/u) beats packaging ($33.33/u).
    const info = getEffectiveItemInfo(product, 2, null, packaging);

    expect(info.appliedType).toBe('bulk_pricing');
    expect(info.bulkTierApplied?.minQuantity).toBe(6);
    // Effective price per package slot should be 25 * 3 = 75
    expect(info.unitPrice).toBe(75);
    // Total for row = 75 * 2 = 150 (25 * 6 real units)
    expect(info.unitPrice * 2).toBe(150);
  });

  it('keeps packaging price if packaging is cheaper per unit than bulk pricing tier', () => {
    const product: Product = {
      id: 'p3',
      name: 'Agua MIneral',
      price: 35,
      cost: 10,
      stock: 100,
      category: 'Bebidas',
      color: '#000000',
      emoji: '💧',
      bulkPricing: [
        { minQuantity: 6, price: 25 }, // 6+ u -> $25/unit
      ],
      packagings: [
        { id: 'pkg1', name: 'Paquete 3u', unitsPerPackage: 3, price: 60 }, // $20/unit
      ],
    };

    const packaging = product.packagings![0];

    // Buying 2 packages = 6 units. Packaging ($20/u) is cheaper than bulk pricing ($25/u).
    const info = getEffectiveItemInfo(product, 2, null, packaging);

    expect(info.appliedType).toBe('packaging');
    expect(info.unitPrice).toBe(60);
    expect(info.unitPrice * 2).toBe(120);
  });
});
