import { describe, it, expect } from 'vitest';
import { getPayableBalance, getTotalPayablesBalance } from './payableDebt';
import { AccountPayable, PayablePayment } from '../types';

describe('payableDebt.ts unit tests', () => {
  const payableId1 = 'pay-1';
  const payableId2 = 'pay-2';

  describe('getPayableBalance', () => {
    it('returns 0 if the payable is not found', () => {
      const balance = getPayableBalance('non-existent', [], []);
      expect(balance).toBe(0);
    });

    it('returns totalAmount when invoice has no payments', () => {
      const payables: AccountPayable[] = [
        { id: payableId1, totalAmount: 500, status: 'pending' } as unknown as AccountPayable
      ];
      const balance = getPayableBalance(payableId1, payables, []);
      expect(balance).toBe(500);
    });

    it('subtracts partial payments correctly', () => {
      const payables: AccountPayable[] = [
        { id: payableId1, totalAmount: 500, status: 'pending' } as unknown as AccountPayable
      ];
      const payments: PayablePayment[] = [
        { id: 'p1', payableId: payableId1, amount: 150 } as PayablePayment,
        { id: 'p2', payableId: payableId1, amount: 100 } as PayablePayment
      ];
      // 500 - (150 + 100) = 250
      const balance = getPayableBalance(payableId1, payables, payments);
      expect(balance).toBe(250);
    });

    it('returns 0 and never negative when payments exceed totalAmount', () => {
      const payables: AccountPayable[] = [
        { id: payableId1, totalAmount: 300, status: 'pending' } as unknown as AccountPayable
      ];
      const payments: PayablePayment[] = [
        { id: 'p1', payableId: payableId1, amount: 400 } as PayablePayment
      ];
      const balance = getPayableBalance(payableId1, payables, payments);
      expect(balance).toBe(0);
    });
  });

  describe('getTotalPayablesBalance', () => {
    it('sums balances of all active/unpaid account payables', () => {
      const payables: AccountPayable[] = [
        { id: payableId1, totalAmount: 500, status: 'pending' } as unknown as AccountPayable,
        { id: payableId2, totalAmount: 300, status: 'partially_paid' } as unknown as AccountPayable,
        { id: 'pay-3', totalAmount: 200, status: 'paid' } as unknown as AccountPayable
      ];
      const payments: PayablePayment[] = [
        { id: 'p1', payableId: payableId1, amount: 100 } as PayablePayment, // rem 400
        { id: 'p2', payableId: payableId2, amount: 100 } as PayablePayment, // rem 200
        { id: 'p3', payableId: 'pay-3', amount: 200 } as PayablePayment    // rem 0
      ];

      const totalBalance = getTotalPayablesBalance(payables, payments);
      expect(totalBalance).toBe(600); // 400 + 200
    });
  });
});
