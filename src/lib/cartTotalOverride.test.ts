import { describe, it, expect } from 'vitest';
import { Product, CartItem } from '../types';
import { calculateWaterFillingCartTotalOverride } from './cartTotalOverride';
import { roundCents } from './money';

describe('Water-filling Cart Total Override Algorithm', () => {
  const taxExemptProduct: Product = {
    id: 'p1',
    name: 'Exempt Item',
    price: 100,
    cost: 80, // min 15% margin pre-tax = 80 * 1.15 = 92. Min unit price = 92
    stock: 50,
    category: 'General',
    color: '#000000',
    emoji: '📦',
    taxExempt: true,
  };

  const taxableProduct: Product = {
    id: 'p2',
    name: 'Taxable Item',
    price: 150,
    cost: 100, // min 15% margin pre-tax = 100 * 1.15 = 115. Min unit price = 115 * 1.18 = 135.70
    stock: 50,
    category: 'General',
    color: '#000000',
    emoji: '📦',
    taxExempt: false,
  };

  const cartItems: CartItem[] = [
    { product: taxExemptProduct, quantity: 2 },
    { product: taxableProduct, quantity: 1 },
  ];

  it('calculates proportional adjustment when all items stay above 15% margin floor', () => {
    // Original total = 2 * 100 + 1 * 150 = 350
    const proposedTotal = 335;
    const result = calculateWaterFillingCartTotalOverride(cartItems, proposedTotal);

    expect(result.isValid).toBe(true);
    expect(result.hasFailingItems).toBe(false);
    // Delta per unit = -15 / 3 = -5
    expect(result.itemCalculations[0].proposedUnitPrice).toBe(95); // 95 >= 92 floor
    expect(result.itemCalculations[1].proposedUnitPrice).toBe(145); // 145 >= 135.70 floor
  });

  it('fixes item at floor (15%) and redistributes remaining adjustment to free items when 1 item violates floor', () => {
    // If proposed total is 320:
    // Round 1: delta = -30 / 3 = -10. P1 proposed = 90 (< 92 floor -> VIOLATES!). P2 = 140 (>= 135.70 -> PASSES).
    // P1 moves to fixed (92 * 2 = 184).
    // Round 2: free item = P2 (1 unit, orig 150). sumaFijados = 184.
    // ajusteRestante = 320 - 184 - 150 = -14. P2 tentative = 150 - 14 = 136 (>= 135.70 floor -> PASSES!).
    const proposedTotal = 320;
    const result = calculateWaterFillingCartTotalOverride(cartItems, proposedTotal);

    expect(result.isValid).toBe(true);
    expect(result.hasFailingItems).toBe(false);
    expect(result.itemCalculations[0].proposedUnitPrice).toBe(92); // Fixed to floor!
    expect(result.itemCalculations[0].isFixed).toBe(true);
    expect(result.itemCalculations[1].proposedUnitPrice).toBe(136); // Absorbed rest of discount!
    expect(result.itemCalculations[1].isFixed).toBe(false);

    // Sum of proposed prices = 2 * 92 + 1 * 136 = 184 + 136 = 320!
    const totalAchieved = result.itemCalculations.reduce(
      (sum, calc) => sum + calc.proposedUnitPrice * calc.quantity,
      0
    );
    expect(totalAchieved).toBe(320);
  });

  it('reports failing items and minimum reachable total when proposed total is lower than all items at floor', () => {
    // Min total possible = 2 * 92 + 1 * 135.70 = 184 + 135.70 = 319.70
    const absoluteMinTotal = roundCents(2 * 92 + 1 * 135.70); // 319.70
    const proposedTotal = 300; // Too low!

    const result = calculateWaterFillingCartTotalOverride(cartItems, proposedTotal);
    expect(result.isValid).toBe(false);
    expect(result.hasFailingItems).toBe(true);
    expect(result.suggestedMinTotal).toBe(absoluteMinTotal);

    // Now test accepting the suggested minimum total:
    const minResult = calculateWaterFillingCartTotalOverride(cartItems, result.suggestedMinTotal);
    expect(minResult.isValid).toBe(true);
    expect(minResult.hasFailingItems).toBe(false);
    expect(minResult.itemCalculations[0].proposedUnitPrice).toBe(92);
    expect(minResult.itemCalculations[1].proposedUnitPrice).toBe(135.70);
  });
});
