import { Employee, Closure, Sale, CustomerRefund } from '../types';

export interface HighReturnRateAnomaly {
  employeeId: string;
  employeeName: string;
  totalSales: number;
  returnRefundCount: number;
  cancelledCount: number;
  returnRate: number; // e.g. 0.25 (25%)
  overallAvgRate: number; // e.g. 0.08 (8%)
}

export interface CashDiscrepancyAnomaly {
  employeeId: string;
  employeeName: string;
  direction: 'faltante' | 'sobrante';
  occurrences: number; // e.g. 4 out of last 10
  totalClosuresAnalyzed: number;
  avgDiscrepancy: number; // absolute or signed average
}

export interface CreditSpikeAnomaly {
  employeeId: string;
  employeeName: string;
  recentCreditTotal: number;
  historicalAvg30d: number;
  ratio: number; // e.g. 4.2x
}

export function detectHighReturnRate(
  employees: Employee[],
  sales: Sale[],
  customerRefunds: CustomerRefund[],
  closures: Closure[] = [],
  days: number = 30
): HighReturnRateAnomaly[] {
  if (!employees || employees.length === 0) return [];

  const now = new Date().getTime();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  // Filter sales in the last `days` days
  const recentSales = (sales || []).filter((s) => {
    const t = new Date(s.date || s.createdAt || '').getTime();
    return !isNaN(t) && t >= cutoff;
  });

  // Filter refunds in the last `days` days
  const recentRefunds = (customerRefunds || []).filter((r) => {
    const t = new Date(r.date || r.createdAt || '').getTime();
    return !isNaN(t) && t >= cutoff;
  });

  // Helper to resolve employee id for a sale
  const getSaleEmployeeId = (sale: Sale): string | null => {
    if (sale.soldBy?.id) return sale.soldBy.id;
    if (sale.soldBy?.name) {
      const emp = employees.find((e) => e.name.toLowerCase() === sale.soldBy?.name.toLowerCase());
      if (emp) return emp.id;
    }
    return null;
  };

  // Helper to resolve employee id for a refund
  const getRefundEmployeeId = (refund: CustomerRefund): string | null => {
    if (refund.employeeId) return refund.employeeId;
    if (refund.employeeName) {
      const emp = employees.find((e) => e.name.toLowerCase() === refund.employeeName?.toLowerCase());
      if (emp) return emp.id;
    }
    // Fallback: look up sale
    if (refund.saleId) {
      const sale = sales.find((s) => s.id === refund.saleId);
      if (sale) return getSaleEmployeeId(sale);
    }
    return null;
  };

  // Map employee metrics
  const empStats: Record<
    string,
    {
      totalSales: number;
      cancelledCount: number;
      refundCount: number;
    }
  > = {};

  for (const emp of employees) {
    empStats[emp.id] = { totalSales: 0, cancelledCount: 0, refundCount: 0 };
  }

  for (const sale of recentSales) {
    const empId = getSaleEmployeeId(sale);
    if (empId && empStats[empId]) {
      empStats[empId].totalSales += 1;
      if (sale.isCancelled) {
        empStats[empId].cancelledCount += 1;
      }
    }
  }

  for (const refund of recentRefunds) {
    const empId = getRefundEmployeeId(refund);
    if (empId && empStats[empId]) {
      empStats[empId].refundCount += 1;
    }
  }

  // Calculate rate for employees with at least 10 sales
  const eligibleEmployees: {
    emp: Employee;
    totalSales: number;
    cancelledCount: number;
    refundCount: number;
    rate: number;
  }[] = [];

  let totalRateSum = 0;

  for (const emp of employees) {
    const stats = empStats[emp.id];
    if (stats.totalSales >= 10) {
      const rate = (stats.refundCount + stats.cancelledCount) / stats.totalSales;
      eligibleEmployees.push({
        emp,
        totalSales: stats.totalSales,
        cancelledCount: stats.cancelledCount,
        refundCount: stats.refundCount,
        rate,
      });
      totalRateSum += rate;
    }
  }

  if (eligibleEmployees.length === 0) return [];

  const overallAvgRate = totalRateSum / eligibleEmployees.length;

  const anomalies: HighReturnRateAnomaly[] = [];

  for (const item of eligibleEmployees) {
    // Flag if rate > 2x overall average AND rate > 0
    if (item.rate > 0 && item.rate > 2 * overallAvgRate) {
      anomalies.push({
        employeeId: item.emp.id,
        employeeName: item.emp.name,
        totalSales: item.totalSales,
        returnRefundCount: item.refundCount,
        cancelledCount: item.cancelledCount,
        returnRate: item.rate,
        overallAvgRate,
      });
    }
  }

  return anomalies;
}

export function detectRepeatedCashDiscrepancies(
  employees: Employee[],
  closures: Closure[],
  minOccurrences: number = 3
): CashDiscrepancyAnomaly[] {
  if (!employees || employees.length === 0 || !closures || closures.length === 0) return [];

  const sortedClosures = [...closures].sort((a, b) => {
    const ta = new Date(a.date || a.createdAt || '').getTime();
    const tb = new Date(b.date || b.createdAt || '').getTime();
    return tb - ta; // newest first
  });

  const getClosureEmployeeId = (closure: Closure): string | null => {
    if (closure.employeeId) return closure.employeeId;
    if (closure.clerkName) {
      const emp = employees.find((e) => e.name.toLowerCase() === closure.clerkName.toLowerCase());
      if (emp) return emp.id;
    }
    return null;
  };

  const anomalies: CashDiscrepancyAnomaly[] = [];

  for (const emp of employees) {
    const empClosures = sortedClosures.filter((c) => getClosureEmployeeId(c) === emp.id).slice(0, 10);

    if (empClosures.length === 0) continue;

    let faltanteCount = 0;
    let sobranteCount = 0;
    let faltanteSum = 0;
    let sobranteSum = 0;

    for (const c of empClosures) {
      const diff = typeof c.difference === 'number' ? c.difference : (c.actualCash || 0) - (c.expectedCash || 0);
      if (diff < -0.01) {
        faltanteCount += 1;
        faltanteSum += Math.abs(diff);
      } else if (diff > 0.01) {
        sobranteCount += 1;
        sobranteSum += diff;
      }
    }

    if (faltanteCount >= minOccurrences && faltanteCount >= sobranteCount) {
      anomalies.push({
        employeeId: emp.id,
        employeeName: emp.name,
        direction: 'faltante',
        occurrences: faltanteCount,
        totalClosuresAnalyzed: empClosures.length,
        avgDiscrepancy: faltanteSum / faltanteCount,
      });
    } else if (sobranteCount >= minOccurrences) {
      anomalies.push({
        employeeId: emp.id,
        employeeName: emp.name,
        direction: 'sobrante',
        occurrences: sobranteCount,
        totalClosuresAnalyzed: empClosures.length,
        avgDiscrepancy: sobranteSum / sobranteCount,
      });
    }
  }

  return anomalies;
}

export function detectCreditSalesSpike(
  employees: Employee[],
  sales: Sale[],
  days: number = 30
): CreditSpikeAnomaly[] {
  if (!employees || employees.length === 0 || !sales || sales.length === 0) return [];

  const now = new Date().getTime();
  const recentStart = now - days * 24 * 60 * 60 * 1000;
  const historicalStart = recentStart - 90 * 24 * 60 * 60 * 1000;

  const getSaleEmployeeId = (sale: Sale): string | null => {
    if (sale.soldBy?.id) return sale.soldBy.id;
    if (sale.soldBy?.name) {
      const emp = employees.find((e) => e.name.toLowerCase() === sale.soldBy?.name.toLowerCase());
      if (emp) return emp.id;
    }
    return null;
  };

  const getCreditAmount = (sale: Sale): number => {
    if (sale.isCancelled) return 0;
    if (sale.isCredit || sale.paymentMethod === 'credit') {
      return sale.total || 0;
    }
    if (sale.paymentMethod === 'mixed' && Array.isArray(sale.paymentBreakdown)) {
      return sale.paymentBreakdown
        .filter((b) => b.method === 'credit')
        .reduce((sum, b) => sum + (b.amount || 0), 0);
    }
    return 0;
  };

  const anomalies: CreditSpikeAnomaly[] = [];

  for (const emp of employees) {
    // Check if employee has history going back at least 90 days before recent period (i.e. <= historicalStart or created <= recentStart)
    const empSales = sales.filter((s) => getSaleEmployeeId(s) === emp.id);
    if (empSales.length === 0) continue;

    const earliestSaleTime = Math.min(
      ...empSales.map((s) => new Date(s.date || s.createdAt || '').getTime()).filter((t) => !isNaN(t))
    );

    const empCreatedTime = emp.createdAt ? new Date(emp.createdAt).getTime() : Infinity;
    const earliestRecordTime = Math.min(earliestSaleTime, empCreatedTime);

    // Employee must have at least 90 days of tenure/history prior to recent window start
    if (earliestRecordTime > recentStart) {
      // New employee (less than 30+90 days history) -> skip false positive
      continue;
    }

    let recentCreditTotal = 0;
    let historicalCreditTotal = 0;

    for (const sale of empSales) {
      const t = new Date(sale.date || sale.createdAt || '').getTime();
      if (isNaN(t)) continue;

      const creditAmt = getCreditAmount(sale);
      if (creditAmt <= 0) continue;

      if (t >= recentStart) {
        recentCreditTotal += creditAmt;
      } else if (t >= historicalStart && t < recentStart) {
        historicalCreditTotal += creditAmt;
      }
    }

    const historicalAvg30d = historicalCreditTotal / 3; // 90 days = 3 x 30-day windows

    if (historicalAvg30d > 0 && recentCreditTotal > 3 * historicalAvg30d) {
      anomalies.push({
        employeeId: emp.id,
        employeeName: emp.name,
        recentCreditTotal,
        historicalAvg30d,
        ratio: recentCreditTotal / historicalAvg30d,
      });
    }
  }

  return anomalies;
}
