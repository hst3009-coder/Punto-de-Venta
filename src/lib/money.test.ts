import { describe, it, expect } from 'vitest';
import { roundCents, roundUpToNearestFive, getPreTaxAmount } from './money';

describe('money.ts unit tests', () => {
  describe('roundCents', () => {
    it('rounds numbers correctly to 2 decimal places', () => {
      expect(roundCents(10.1234)).toBe(10.12);
      expect(roundCents(10.126)).toBe(10.13);
    });

    it('handles edge cases and negative numbers', () => {
      expect(roundCents(0.005)).toBe(0.01);
      expect(roundCents(-10.555)).toBe(-10.55); // Math.round(-1055.5) / 100
      expect(roundCents(0)).toBe(0);
    });
  });

  describe('roundUpToNearestFive', () => {
    it('returns exact values for integers without changes', () => {
      expect(roundUpToNearestFive(5)).toBe(5);
      expect(roundUpToNearestFive(10)).toBe(10);
      expect(roundUpToNearestFive(12)).toBe(12);
      expect(roundUpToNearestFive(7)).toBe(7);
    });

    it('rounds values with decimals up to the next multiple of 5', () => {
      expect(roundUpToNearestFive(10.01)).toBe(15);
      expect(roundUpToNearestFive(12.3)).toBe(15);
      expect(roundUpToNearestFive(15.001)).toBe(20);
      expect(roundUpToNearestFive(0.1)).toBe(5);
    });
  });

  describe('getPreTaxAmount', () => {
    it('returns the same price when taxExempt is true', () => {
      expect(getPreTaxAmount(100, true)).toBe(100);
      expect(getPreTaxAmount(118, true)).toBe(118);
    });

    it('divides by 1.18 and rounds to 2 decimal places when taxExempt is false or undefined', () => {
      expect(getPreTaxAmount(118, false)).toBe(100);
      expect(getPreTaxAmount(118, undefined)).toBe(100);
      expect(getPreTaxAmount(59, false)).toBe(50);
      expect(getPreTaxAmount(100, false)).toBe(84.75); // 100 / 1.18 = 84.74576... -> 84.75
    });
  });
});
