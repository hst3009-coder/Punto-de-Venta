import { describe, it, expect } from 'vitest';
import { getRestockSuggestions } from './restockSuggestions';
import { Product, Sale } from '../types';

describe('getRestockSuggestions', () => {
  const dummyProducts: Product[] = [
    {
      id: 'p1',
      name: 'Shampoo XL',
      price: 100,
      category: 'Capilar',
      stock: 4, // 4 units in stock
      color: 'bg-blue-500',
      emoji: '🧴',
      provider: 'Distribuidora Capilar',
    },
    {
      id: 'p2',
      name: 'Jabon Liquido',
      price: 50,
      category: 'Higiene',
      stock: 50, // 50 units in stock
      color: 'bg-green-500',
      emoji: '🧼',
      provider: 'Distribuidora Higiene',
    },
    {
      id: 'p3',
      name: 'Producto Generico',
      price: 10,
      category: 'Genérico',
      stock: 1,
      color: 'bg-gray-500',
      emoji: '📦',
    },
    {
      id: 'p4',
      name: 'Producto Oculto',
      price: 10,
      category: 'Higiene',
      stock: 1,
      visible: false,
      color: 'bg-gray-500',
      emoji: '📦',
    },
  ];

  it('correctly calculates restock suggestions for products with < 7 days coverage', () => {
    const today = new Date().toISOString();
    // 60 units of Shampoo XL sold in 30 days -> 2 units/day
    // With stock = 4, days of coverage = 4 / 2 = 2 days (< 7 days) -> SUGGESTED!
    // Suggested qty = Math.ceil(2 * 30 - 4) = 56 units.

    // 30 units of Jabon Liquido sold in 30 days -> 1 unit/day
    // With stock = 50, days of coverage = 50 / 1 = 50 days (>= 7 days) -> NOT suggested.

    const dummySales: Sale[] = [
      {
        id: 's1',
        date: today,
        total: 6000,
        amountPaid: 6000,
        change: 0,
        paymentMethod: 'cash',
        ticketNumber: '001',
        items: [
          {
            product: dummyProducts[0],
            quantity: 60,
          },
          {
            product: dummyProducts[1],
            quantity: 30,
          },
        ],
      },
    ];

    const suggestions = getRestockSuggestions(dummyProducts, dummySales, 30);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].product.id).toBe('p1');
    expect(suggestions[0].dailyAvgSales).toBe(2);
    expect(suggestions[0].daysOfCoverage).toBe(2);
    expect(suggestions[0].suggestedQty).toBe(56);
  });

  it('excludes generic and invisible products', () => {
    const today = new Date().toISOString();
    const dummySales: Sale[] = [
      {
        id: 's1',
        date: today,
        total: 100,
        amountPaid: 100,
        change: 0,
        paymentMethod: 'cash',
        ticketNumber: '002',
        items: [
          { product: dummyProducts[2], quantity: 10 },
          { product: dummyProducts[3], quantity: 10 },
        ],
      },
    ];

    const suggestions = getRestockSuggestions(dummyProducts, dummySales, 30);
    expect(suggestions).toHaveLength(0);
  });
});
