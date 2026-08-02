import { Sale, Product, Customer, CustomerPayment, Closure, Movement, CustomerRefund, AccountPayable, PayablePayment, CardDeposit, DashboardConfig, Employee, isMixedSale } from '../types';
import { getSaleTimestamp } from './dates';
import { getPreTaxAmount, roundCents, isProductBelowTargetProfit } from './money';
import { getCustomerDebt } from './customerDebt';
import { getPayableBalance, getTotalPayablesBalance } from './payableDebt';
export { getTotalPayablesBalance };
import { getStringValue } from './normalize';
import { startOfDay, endOfDay, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, addMonths, differenceInDays, format } from 'date-fns';

export const spanishMonths = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const spanishMonthsShort = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export function formatSpanishDate(date: Date): string {
  return `${date.getDate()} de ${spanishMonths[date.getMonth()]}, ${date.getFullYear()}`;
}

export function formatSpanishMonthYear(date: Date): string {
  return `${spanishMonths[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatSpanishWeekRange(weekStart: Date, weekEnd: Date): string {
  const startDay = weekStart.getDate();
  const startMonth = spanishMonthsShort[weekStart.getMonth()];
  const endDay = weekEnd.getDate();
  const endMonth = spanishMonthsShort[weekEnd.getMonth()];
  const startYear = weekStart.getFullYear();
  const endYear = weekEnd.getFullYear();
  
  if (startYear === endYear) {
    if (weekStart.getMonth() === weekEnd.getMonth()) {
      return `Semana del ${startDay} al ${endDay} de ${spanishMonths[weekStart.getMonth()]}, ${startYear}`;
    } else {
      return `Semana del ${startDay} de ${startMonth} al ${endDay} de ${endMonth}, ${startYear}`;
    }
  } else {
    return `Semana del ${startDay} de ${startMonth}, ${startYear} al ${endDay} de ${endMonth}, ${endYear}`;
  }
}

export function calculateMarginPercent(filteredSales: Sale[], products: Product[]): number {
  let totalProfit = 0;
  let applicableSalesAmount = 0;
  filteredSales.forEach(s => {
    s.items.forEach(item => {
      const prod = products.find(p => p.id === item.product.id);
      const itemCat = getStringValue(item.product.category);
      const prodCat = getStringValue(prod?.category);
      const isGeneric = itemCat === 'Genérico' || prodCat === 'Genérico';
      if (isGeneric) return;

      const cost = prod?.cost ?? item.product.cost ?? 0;
      const price = item.product.price;
      const preTaxPrice = getPreTaxAmount(price, item.product.taxExempt || prod?.taxExempt);
      const profitPerUnit = preTaxPrice - cost;
      totalProfit += profitPerUnit * item.quantity;
      applicableSalesAmount += preTaxPrice * item.quantity;
    });
  });
  if (applicableSalesAmount === 0) return 0;
  return (totalProfit / applicableSalesAmount) * 100;
}

export function calculateCashLiquidityTotal(
  sales: Sale[],
  closures: Closure[],
  movements: Movement[] = [],
  customerRefunds: CustomerRefund[] = []
): number {
  const closedSalesSum = sales.filter(s => !s.isCancelled).reduce((acc, sale) => {
    const employeeId = sale.soldBy?.id;
    if (employeeId) {
      const saleTime = getSaleTimestamp(sale);
      const isClosed = closures.some(closure => {
        if (closure.employeeId !== employeeId) return false;
        const closureTime = new Date(closure.createdAt || closure.date).getTime();
        return closureTime > saleTime;
      });
      if (!isClosed) return acc;
    }

    const pm = getStringValue(sale.paymentMethod, 'cash');
    if (pm === 'cash') {
      return acc + sale.total;
    } else if (isMixedSale(sale)) {
      const cashPart = sale.paymentBreakdown
        .filter(b => getStringValue(b.method) === 'cash')
        .reduce((sum, b) => sum + b.amount, 0);
      return acc + cashPart;
    }
    return acc;
  }, 0);

  const cashExpenses = movements.filter(m => m.type === 'out' && getStringValue(m.paymentMethod) === 'cash');
  const closedCashExpenses = cashExpenses.filter(expense => {
    const source = expense.source ?? 'shift';
    if (source === 'dashboard') return true;

    const employeeId = expense.employeeId;
    if (!employeeId) return true;

    const expenseTime = new Date(expense.createdAt || expense.date).getTime();
    return closures.some(closure => {
      if (closure.employeeId !== employeeId) return false;
      const closureTime = new Date(closure.createdAt || closure.date).getTime();
      return closureTime > expenseTime;
    });
  });

  const closedExpensesSum = closedCashExpenses.reduce((acc, m) => acc + m.amount, 0);

  const cashRefunds = (customerRefunds || []).filter(r => getStringValue(r.method) === 'cash');
  const closedCashRefunds = cashRefunds.filter(refund => {
    const employeeId = refund.employeeId;
    if (!employeeId) return true;

    const refundTime = new Date(refund.createdAt || refund.date).getTime();
    return closures.some(closure => {
      if (closure.employeeId !== employeeId) return false;
      const closureTime = new Date(closure.createdAt || closure.date).getTime();
      return closureTime > refundTime;
    });
  });
  const closedRefundsSum = closedCashRefunds.reduce((acc, r) => acc + r.amount, 0);

  return Math.max(0, closedSalesSum - closedExpensesSum - closedRefundsSum);
}

export function calculateBankLiquidityTotal(
  cardDeposits: CardDeposit[] = [],
  sales: Sale[],
  customerPayments: CustomerPayment[] = []
): number {
  const confirmedCardDepositsSum = cardDeposits
    .filter(d => d.status === 'confirmed')
    .reduce((acc, d) => acc + (d.confirmedAmount ?? d.netAmount), 0);

  const transferSalesSum = sales
    .filter(s => !s.isCancelled)
    .reduce((acc, s) => {
      const pm = getStringValue(s.paymentMethod);
      if (pm === 'transfer') return acc + s.total;
      if (isMixedSale(s)) {
        const tPart = s.paymentBreakdown
          .filter(b => getStringValue(b.method) === 'transfer')
          .reduce((sum, b) => sum + b.amount, 0);
        return acc + tPart;
      }
      return acc;
    }, 0);

  const bankCustomerPaymentsSum = customerPayments
    .filter(p => {
      const pm = getStringValue(p.paymentMethod);
      return pm === 'card' || pm === 'transfer';
    })
    .reduce((acc, p) => acc + p.amount, 0);

  return roundCents(confirmedCardDepositsSum + transferSalesSum + bankCustomerPaymentsSum);
}

export function calculatePLReportData(
  filteredSales: Sale[],
  filteredMovements: Movement[],
  products: Product[]
) {
  let totalSalesPreTax = 0;
  let totalCOGS = 0;

  filteredSales.forEach(s => {
    s.items.forEach(item => {
      const prod = products.find(p => p.id === item.product.id);
      const itemCat = getStringValue(item.product.category);
      const prodCat = getStringValue(prod?.category);
      const isGeneric = itemCat === 'Genérico' || prodCat === 'Genérico';
      
      const price = item.product.price;
      const taxExempt = item.product.taxExempt || prod?.taxExempt;
      const preTaxPrice = getPreTaxAmount(price, taxExempt);
      
      totalSalesPreTax += preTaxPrice * item.quantity;

      if (!isGeneric) {
        const cost = prod?.cost ?? item.product.cost ?? 0;
        totalCOGS += cost * item.quantity;
      }
    });
  });

  const grossProfit = totalSalesPreTax - totalCOGS;

  const operationalExpenses = filteredMovements
    .filter(m => m.type === 'out' && (m.isOperational === true || m.isOperational === undefined))
    .reduce((sum, m) => sum + m.amount, 0);

  const netOperatingProfit = grossProfit - operationalExpenses;

  const personalExpenses = filteredMovements
    .filter(m => m.type === 'out' && m.isOperational === false)
    .reduce((sum, m) => sum + m.amount, 0);

  return {
    totalSalesPreTax,
    totalCOGS,
    grossProfit,
    operationalExpenses,
    netOperatingProfit,
    personalExpenses
  };
}
