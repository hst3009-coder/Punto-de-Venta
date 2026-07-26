import { describe, it, expect } from 'vitest';
import { getCustomerDebt } from './customerDebt';
import { Sale, CustomerPayment, Customer, CustomerRefund } from '../types';

describe('customerDebt.ts unit tests', () => {
  const customerId = 'cust-123';

  it('returns 0 for a customer without opening debt, sales, payments or refunds', () => {
    const customers: Customer[] = [{ id: customerId, name: 'Juan Perez', openingDebt: 0 }];
    const debt = getCustomerDebt(customerId, [], [], customers, []);
    expect(debt).toBe(0);
  });

  it('returns openingDebt when customer has initial debt and no sales/payments', () => {
    const customers: Customer[] = [{ id: customerId, name: 'Juan Perez', openingDebt: 150.50 }];
    const debt = getCustomerDebt(customerId, [], [], customers, []);
    expect(debt).toBe(150.50);
  });

  it('correctly sums pending credit sales and mixed credit sales', () => {
    const customers: Customer[] = [{ id: customerId, name: 'Juan Perez', openingDebt: 50 }];
    const sales: Sale[] = [
      {
        id: 'sale-1',
        items: [],
        total: 100,
        paymentMethod: 'credit',
        isCredit: true,
        creditStatus: 'pending',
        customerId,
        timestamp: '2026-07-01'
      } as unknown as Sale,
      {
        id: 'sale-2',
        items: [],
        total: 200,
        paymentMethod: 'mixed',
        paymentBreakdown: [
          { id: '1', method: 'cash', amount: 120 },
          { id: '2', method: 'credit', amount: 80 }
        ],
        creditStatus: 'pending',
        customerId,
        timestamp: '2026-07-02'
      } as unknown as Sale,
      {
        // Paid credit sale should be ignored
        id: 'sale-3',
        items: [],
        total: 50,
        paymentMethod: 'credit',
        isCredit: true,
        creditStatus: 'paid',
        customerId,
        timestamp: '2026-07-03'
      } as unknown as Sale
    ];

    // Total debt: opening (50) + sale-1 (100) + sale-2 credit portion (80) = 230
    const debt = getCustomerDebt(customerId, sales, [], customers, []);
    expect(debt).toBe(230);
  });

  it('subtracts customer payments correctly', () => {
    const customers: Customer[] = [{ id: customerId, name: 'Juan Perez', openingDebt: 0 }];
    const sales: Sale[] = [
      {
        id: 'sale-1',
        items: [],
        total: 200,
        paymentMethod: 'credit',
        isCredit: true,
        creditStatus: 'pending',
        customerId,
        timestamp: '2026-07-01'
      } as unknown as Sale
    ];
    const payments: CustomerPayment[] = [
      { id: 'pay-1', customerId, amount: 50, date: '2026-07-02' } as CustomerPayment,
      { id: 'pay-2', customerId, amount: 30, date: '2026-07-03' } as CustomerPayment
    ];

    // Debt: 200 - 50 - 30 = 120
    const debt = getCustomerDebt(customerId, sales, payments, customers, []);
    expect(debt).toBe(120);
  });

  it('subtracts credit_reduction refunds correctly', () => {
    const customers: Customer[] = [{ id: customerId, name: 'Juan Perez', openingDebt: 0 }];
    const sales: Sale[] = [
      {
        id: 'sale-1',
        items: [],
        total: 300,
        paymentMethod: 'credit',
        isCredit: true,
        creditStatus: 'pending',
        customerId,
        timestamp: '2026-07-01'
      } as unknown as Sale
    ];
    const refunds: CustomerRefund[] = [
      { id: 'ref-1', customerId, method: 'credit_reduction', amount: 40, date: '2026-07-02' } as CustomerRefund,
      { id: 'ref-2', customerId, method: 'cash', amount: 50, date: '2026-07-03' } as CustomerRefund // cash refund shouldn't reduce credit debt
    ];

    // Debt: 300 - 40 = 260
    const debt = getCustomerDebt(customerId, sales, [], customers, refunds);
    expect(debt).toBe(260);
  });

  it('returns 0 and never negative when payments/refunds exceed total debt', () => {
    const customers: Customer[] = [{ id: customerId, name: 'Juan Perez', openingDebt: 50 }];
    const payments: CustomerPayment[] = [
      { id: 'pay-1', customerId, amount: 100, date: '2026-07-02' } as CustomerPayment
    ];

    // Math: 50 - 100 = -50 -> Should clamp to 0
    const debt = getCustomerDebt(customerId, [], payments, customers, []);
    expect(debt).toBe(0);
  });
});
