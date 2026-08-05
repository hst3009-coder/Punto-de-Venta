import { describe, it, expect } from 'vitest';
import { Product, Sale } from '../types';
import { rankSearchResults, sortProductsEmptySearch, getPackagingBarcode, matchesProductSearch } from './search';
import { calculateABCClassification } from './abcAnalysis';

const createProduct = (id: string, name: string, category = 'General', code = ''): Product => ({
  id,
  name,
  category,
  price: 100,
  stock: 10,
  minStock: 2,
  cost: 50,
  code,
  visible: true,
  color: '#000000',
  emoji: '📦',
});

describe('Search Performance (Parte A)', () => {
  it('should return exact/substring matches without running fuzzy match when exact match exists', () => {
    const products: Product[] = [
      createProduct('1', 'Coca Cola 2L'),
      createProduct('2', 'Coca Cola Zero'),
      createProduct('3', 'Pepsi Cola'),
    ];

    const results = rankSearchResults(products, 'Coca');
    expect(results).toHaveLength(2);
    expect(results.map((p) => p.name)).toEqual(['Coca Cola 2L', 'Coca Cola Zero']);
  });

  it('should run fuzzy search as second pass when exact/substring returns 0 matches', () => {
    const products: Product[] = [
      createProduct('1', 'Coca Cola 2L'),
      createProduct('2', 'Sprite 500ml'),
    ];

    // Typo "coka" matches nothing exactly or by substring, but matches "Coca" fuzzily (Levenshtein distance 1)
    const results = rankSearchResults(products, 'coka');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Coca Cola 2L');
  });
});

describe('Search Fallback Sorting when Query is Empty (Parte B)', () => {
  const p1 = createProduct('1', 'Arroz Premium');
  const p2 = createProduct('2', 'Habichuelas');
  const p3 = createProduct('3', 'Aceite Vegetal');
  const products = [p1, p2, p3];

  it('1. Sorts by current month sales descending when current month sales exist', () => {
    const monthlySalesCount = new Map<string, number>([
      ['1', 5],  // Arroz: 5 units
      ['2', 20], // Habichuelas: 20 units
      ['3', 10], // Aceite: 10 units
    ]);

    const result = sortProductsEmptySearch(products, monthlySalesCount);
    // All 3 products must remain visible
    expect(result).toHaveLength(3);
    // Ordered by monthly sales descending: Habichuelas (20) -> Aceite (10) -> Arroz (5)
    expect(result.map((p) => p.id)).toEqual(['2', '3', '1']);
  });

  it('2. Sorts by ABC classification (A -> B -> C) when no sales in current month', () => {
    const monthlySalesCount = new Map<string, number>(); // 0 sales this month

    const abcMap = new Map<string, 'A' | 'B' | 'C'>([
      ['1', 'C'],
      ['2', 'A'],
      ['3', 'B'],
    ]);

    const result = sortProductsEmptySearch(products, monthlySalesCount, abcMap, true);
    expect(result).toHaveLength(3);
    // Ordered by ABC: '2' (A) -> '3' (B) -> '1' (C)
    expect(result.map((p) => p.id)).toEqual(['2', '3', '1']);
  });

  it('3. Falls back to compareProductsNatural when no sales history exists for ABC', () => {
    const monthlySalesCount = new Map<string, number>();
    const abcMap = new Map<string, 'A' | 'B' | 'C'>();

    const result = sortProductsEmptySearch(products, monthlySalesCount, abcMap, false);
    expect(result).toHaveLength(3);
    // Natural alphabetical order: "Aceite Vegetal" -> "Arroz Premium" -> "Habichuelas"
    expect(result.map((p) => p.name)).toEqual(['Aceite Vegetal', 'Arroz Premium', 'Habichuelas']);
  });

  it('Calculates ABC classification correctly based on revenue thresholds', () => {
    const sales: Sale[] = [
      {
        id: 's1',
        total: 800,
        amountPaid: 800,
        change: 0,
        ticketNumber: '001',
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        items: [{ product: createProduct('1', 'Product A', 'General', ''), quantity: 8 }],
        isCancelled: false,
      },
      {
        id: 's2',
        total: 150,
        amountPaid: 150,
        change: 0,
        ticketNumber: '002',
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        items: [{ product: createProduct('2', 'Product B', 'General', ''), quantity: 1.5 }],
        isCancelled: false,
      },
      {
        id: 's3',
        total: 50,
        amountPaid: 50,
        change: 0,
        ticketNumber: '003',
        date: new Date().toISOString(),
        paymentMethod: 'cash',
        items: [{ product: createProduct('3', 'Product C', 'General', ''), quantity: 0.5 }],
        isCancelled: false,
      },
    ];

    const { abcMap, hasHistory } = calculateABCClassification(products, sales);
    expect(hasHistory).toBe(true);
    expect(abcMap.get('1')).toBe('A'); // 800 / 1000 = 80%
    expect(abcMap.get('2')).toBe('B'); // 950 / 1000 = 95%
    expect(abcMap.get('3')).toBe('C'); // 1000 / 1000 = 100%
  });
});

describe('Packaging Barcode Support', () => {
  const prod: Product = {
    ...createProduct('prod1', 'Aceite Crisol', 'General', '8025337133780'),
    barcode: '8025337133780',
    packagings: [
      { id: 'pkg1', name: 'Caja 12u', unitsPerPackage: 12, price: 1200 },
      { id: 'pkg2', name: 'Fardo 24u', unitsPerPackage: 24, price: 2300, barcode: '7461234567890' },
    ],
  };

  it('calculates derived barcode when custom barcode is not present', () => {
    expect(getPackagingBarcode(prod, prod.packagings![0])).toBe('8025337133780-12');
  });

  it('returns custom barcode when custom barcode is present', () => {
    expect(getPackagingBarcode(prod, prod.packagings![1])).toBe('7461234567890');
  });

  it('matches product by packaging custom barcode', () => {
    expect(matchesProductSearch(prod, '7461234567890')).toBe(true);
  });

  it('matches product by packaging derived barcode', () => {
    expect(matchesProductSearch(prod, '8025337133780-12')).toBe(true);
  });
});
