import { describe, it, expect } from 'vitest';
import {
  detectHighReturnRate,
  detectRepeatedCashDiscrepancies,
  detectCreditSalesSpike,
} from './anomalyDetection';
import { Employee, Sale, CustomerRefund, Closure } from '../types';

describe('anomalyDetection', () => {
  const emp1: Employee = { id: 'e1', name: 'Juan Perez', role: 'cashier', active: true };
  const emp2: Employee = { id: 'e2', name: 'Maria Gomez', role: 'cashier', active: true };
  const emp3: Employee = { id: 'e3', name: 'Carlos Ruiz', role: 'cashier', active: true };

  const employees = [emp1, emp2, emp3];

  it('detectHighReturnRate flags employee with >2x average return rate', () => {
    const today = new Date().toISOString();

    // Emp1: 20 sales, 0 returns (rate = 0)
    // Emp2: 20 sales, 1 return (rate = 0.05)
    // Emp3: 20 sales, 10 returns/cancellations (rate = 0.5)
    // Average rate = (0 + 0.05 + 0.5) / 3 = 0.183
    // 2x average = 0.366
    // Emp3 rate 0.5 > 0.366 -> FLAGGED!

    const sales: Sale[] = [];
    const customerRefunds: CustomerRefund[] = [];

    // Emp1: 20 sales
    for (let i = 0; i < 20; i++) {
      sales.push({
        id: `s1_${i}`,
        date: today,
        total: 100,
        amountPaid: 100,
        change: 0,
        paymentMethod: 'cash',
        ticketNumber: `T1_${i}`,
        items: [],
        soldBy: { id: emp1.id, name: emp1.name },
      });
    }

    // Emp2: 20 sales, 1 refund
    for (let i = 0; i < 20; i++) {
      sales.push({
        id: `s2_${i}`,
        date: today,
        total: 100,
        amountPaid: 100,
        change: 0,
        paymentMethod: 'cash',
        ticketNumber: `T2_${i}`,
        items: [],
        soldBy: { id: emp2.id, name: emp2.name },
      });
    }
    customerRefunds.push({
      id: 'r1',
      saleId: 's2_0',
      ticketNumber: 'T2_0',
      amount: 100,
      method: 'cash',
      reason: 'Defect',
      date: today,
      employeeId: emp2.id,
      employeeName: emp2.name,
    });

    // Emp3: 20 sales, 10 cancelled
    for (let i = 0; i < 20; i++) {
      sales.push({
        id: `s3_${i}`,
        date: today,
        total: 100,
        amountPaid: 100,
        change: 0,
        paymentMethod: 'cash',
        ticketNumber: `T3_${i}`,
        items: [],
        isCancelled: i < 10,
        soldBy: { id: emp3.id, name: emp3.name },
      });
    }

    const anomalies = detectHighReturnRate(employees, sales, customerRefunds);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].employeeId).toBe('e3');
    expect(anomalies[0].returnRate).toBe(0.5);
  });

  it('detectRepeatedCashDiscrepancies flags employee with 3+ shortages in last 10 closures', () => {
    const today = new Date().toISOString();

    const closures: Closure[] = [
      { id: 'c1', date: today, clerkName: 'Juan Perez', employeeId: 'e1', initialCash: 100, expectedCash: 500, actualCash: 480, salesTotal: 400, difference: -20, status: 'closed' },
      { id: 'c2', date: today, clerkName: 'Juan Perez', employeeId: 'e1', initialCash: 100, expectedCash: 500, actualCash: 470, salesTotal: 400, difference: -30, status: 'closed' },
      { id: 'c3', date: today, clerkName: 'Juan Perez', employeeId: 'e1', initialCash: 100, expectedCash: 500, actualCash: 490, salesTotal: 400, difference: -10, status: 'closed' },
      { id: 'c4', date: today, clerkName: 'Juan Perez', employeeId: 'e1', initialCash: 100, expectedCash: 500, actualCash: 500, salesTotal: 400, difference: 0, status: 'closed' },

      { id: 'c5', date: today, clerkName: 'Maria Gomez', employeeId: 'e2', initialCash: 100, expectedCash: 500, actualCash: 500, salesTotal: 400, difference: 0, status: 'closed' },
      { id: 'c6', date: today, clerkName: 'Maria Gomez', employeeId: 'e2', initialCash: 100, expectedCash: 500, actualCash: 490, salesTotal: 400, difference: -10, status: 'closed' },
    ];

    const anomalies = detectRepeatedCashDiscrepancies(employees, closures);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].employeeId).toBe('e1');
    expect(anomalies[0].direction).toBe('faltante');
    expect(anomalies[0].occurrences).toBe(3);
    expect(anomalies[0].avgDiscrepancy).toBe(20);
  });

  it('detectCreditSalesSpike flags employee whose recent credit sales > 3x historical avg', () => {
    const now = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // Emp1 history: created 150 days ago
    const emp1WithOldDate: Employee = { ...emp1, createdAt: new Date(now - 150 * dayMs).toISOString() };

    const sales: Sale[] = [];

    // Historical credit sales for emp1 (60 days ago = in [now-120d, now-30d]): $1,000 total -> historical 30d avg = $333.33
    sales.push({
      id: 's_hist_1',
      date: new Date(now - 60 * dayMs).toISOString(),
      total: 1000,
      amountPaid: 0,
      change: 0,
      paymentMethod: 'credit',
      isCredit: true,
      ticketNumber: 'TH1',
      items: [],
      soldBy: { id: emp1.id, name: emp1.name },
    });

    // Recent credit sales for emp1 (10 days ago = in [now-30d, now]): $2,000 total (> 3 x $333.33 = $1,000) -> FLAGGED!
    sales.push({
      id: 's_rec_1',
      date: new Date(now - 10 * dayMs).toISOString(),
      total: 2000,
      amountPaid: 0,
      change: 0,
      paymentMethod: 'credit',
      isCredit: true,
      ticketNumber: 'TR1',
      items: [],
      soldBy: { id: emp1.id, name: emp1.name },
    });

    const anomalies = detectCreditSalesSpike([emp1WithOldDate], sales);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].employeeId).toBe('e1');
    expect(anomalies[0].recentCreditTotal).toBe(2000);
    expect(anomalies[0].historicalAvg30d).toBeCloseTo(333.33, 1);
  });
});
