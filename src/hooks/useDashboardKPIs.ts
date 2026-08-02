import { useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  subMonths,
  differenceInDays,
  format,
} from 'date-fns';
import {
  Product,
  Sale,
  Customer,
  CustomerPayment,
  Employee,
  Closure,
  Movement,
  AccountPayable,
  PayablePayment,
  CardDeposit,
  DashboardConfig,
  SupplierReturn,
  CustomerRefund,
  CreditNote,
  isMixedSale,
} from '../types';
import { getCustomerDebt } from '../lib/customerDebt';
import { getPayableBalance, getTotalPayablesBalance } from '../lib/payableDebt';
import { isProductBelowTargetProfit } from '../lib/money';
import { getStringValue } from '../lib/normalize';
import { getSaleTimestamp } from '../lib/dates';
import { getPreTaxAmount, roundCents } from '../lib/money';
import {
  FilterType,
  formatSpanishDate,
  formatSpanishMonthYear,
  formatSpanishWeekRange,
} from './useDashboardDateFilter';

interface UseDashboardKPIsProps {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  customerPayments: CustomerPayment[];
  employees: Employee[];
  closures: Closure[];
  movements?: Movement[];
  customerRefunds?: CustomerRefund[];
  creditNotes?: CreditNote[];
  payables?: AccountPayable[];
  payablePayments?: PayablePayment[];
  cardDeposits?: CardDeposit[];
  supplierReturns?: SupplierReturn[];
  dashboardConfig?: DashboardConfig;
  filterType: FilterType;
  selectedDay: Date;
  selectedWeekAnchor: Date;
  selectedMonthAnchor: Date;
  customRangeStart: string;
  customRangeEnd: string;
  start: Date;
  end: Date;
  selectedClosureModal: Closure | null;
}

export function useDashboardKPIs({
  products,
  sales,
  customers,
  customerPayments,
  employees,
  closures,
  movements = [],
  customerRefunds = [],
  creditNotes = [],
  payables = [],
  payablePayments = [],
  cardDeposits = [],
  supplierReturns = [],
  dashboardConfig = { id: 'dashboardConfig', cardFeePercent: 3.8, holidays: [] },
  filterType,
  selectedDay,
  selectedWeekAnchor,
  selectedMonthAnchor,
  customRangeStart,
  customRangeEnd,
  start,
  end,
  selectedClosureModal,
}: UseDashboardKPIsProps) {
  // --- Filtered Sales ---
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.isCancelled) return false;

      const employeeId = s.soldBy?.id;
      const saleTime = getSaleTimestamp(s);

      if (employeeId) {
        const isShiftClosed = closures.some((closure) => {
          if (closure.employeeId !== employeeId) return false;
          const closureTime = new Date(closure.createdAt || closure.date).getTime();
          return closureTime > saleTime;
        });

        if (!isShiftClosed) return false;
      }

      const sDate = new Date(saleTime);
      return sDate >= start && sDate <= end;
    });
  }, [sales, start, end, closures]);

  // --- Filtered Movements (Egresos) ---
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (m.type !== 'out') return false;
      const mDate = new Date(m.createdAt || m.date);
      return mDate >= start && mDate <= end;
    });
  }, [movements, start, end]);

  // Sum of expenses
  const totalExpensesAmount = useMemo(() => {
    return filteredMovements.reduce((acc, m) => acc + m.amount, 0);
  }, [filteredMovements]);

  // --- Supplier Returns KPIs ---
  const totalPendingReturns = useMemo(() => {
    return (supplierReturns ?? [])
      .filter((r) => r.status === 'pending')
      .reduce((acc, r) => acc + (r.cost || 0), 0);
  }, [supplierReturns]);

  const pendingReturnsCount = useMemo(() => {
    return (supplierReturns ?? []).filter((r) => r.status === 'pending').length;
  }, [supplierReturns]);

  // Breakdown by payment method
  const expensesBreakdown = useMemo(() => {
    let cash = 0;
    let card = 0;
    let transfer = 0;
    filteredMovements.forEach((m) => {
      if (m.paymentMethod === 'cash') cash += m.amount;
      else if (m.paymentMethod === 'card') card += m.amount;
      else if (m.paymentMethod === 'transfer') transfer += m.amount;
    });
    return { cash, card, transfer };
  }, [filteredMovements]);

  // --- KPI a: Ventas Cerradas ---
  const totalSalesAmount = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + s.total, 0);
  }, [filteredSales]);

  const totalTicketsCount = filteredSales.length;

  const marginPercent = useMemo(() => {
    let totalProfit = 0;
    let applicableSalesAmount = 0;
    filteredSales.forEach((s) => {
      s.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.product.id);
        const isGeneric = item.product.category === 'Genérico' || prod?.category === 'Genérico';
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
  }, [filteredSales, products]);

  // --- KPI b: Cuentas por Cobrar ---
  const customerDebts = useMemo(() => {
    const debts: Record<string, number> = {};
    customers.forEach((c) => {
      debts[c.id] = getCustomerDebt(c.id, sales, customerPayments, customers, customerRefunds);
    });
    return debts;
  }, [customers, sales, customerPayments, customerRefunds]);

  const totalOutstandingCredit = useMemo(() => {
    let sum = 0;
    customers.forEach((c) => {
      sum += customerDebts[c.id] || 0;
    });
    return sum;
  }, [customers, customerDebts]);

  const activeCreditNotesBalance = useMemo(() => {
    return creditNotes
      .filter((cn) => cn.status === 'active')
      .reduce((sum, cn) => sum + (cn.remainingBalance || 0), 0);
  }, [creditNotes]);

  // --- KPI f: Liquidez en Efectivo ---
  const cashLiquidityTotal = useMemo(() => {
    const closedSalesSum = sales.filter((s) => !s.isCancelled).reduce((acc, sale) => {
      const employeeId = sale.soldBy?.id;
      if (employeeId) {
        const saleTime = getSaleTimestamp(sale);
        const isClosed = closures.some((closure) => {
          if (closure.employeeId !== employeeId) return false;
          const closureTime = new Date(closure.createdAt || closure.date).getTime();
          return closureTime > saleTime;
        });
        if (!isClosed) return acc;
      }

      if (sale.paymentMethod === 'cash') {
        return acc + sale.total;
      } else if (isMixedSale(sale)) {
        const cashPart = sale.paymentBreakdown
          .filter((b) => b.method === 'cash')
          .reduce((sum, b) => sum + b.amount, 0);
        return acc + cashPart;
      }
      return acc;
    }, 0);

    const cashExpenses = movements.filter((m) => m.type === 'out' && m.paymentMethod === 'cash');
    const closedCashExpenses = cashExpenses.filter((expense) => {
      const source = expense.source ?? 'shift';
      if (source === 'dashboard') return true;

      const employeeId = expense.employeeId;
      if (!employeeId) return true;

      const expenseTime = new Date(expense.createdAt || expense.date).getTime();
      return closures.some((closure) => {
        if (closure.employeeId !== employeeId) return false;
        const closureTime = new Date(closure.createdAt || closure.date).getTime();
        return closureTime > expenseTime;
      });
    });

    const closedExpensesSum = closedCashExpenses.reduce((acc, m) => acc + m.amount, 0);

    const cashRefunds = (customerRefunds || []).filter((r) => r.method === 'cash');
    const closedCashRefunds = cashRefunds.filter((refund) => {
      const employeeId = refund.employeeId;
      if (!employeeId) return true;

      const refundTime = new Date(refund.createdAt || refund.date).getTime();
      return closures.some((closure) => {
        if (closure.employeeId !== employeeId) return false;
        const closureTime = new Date(closure.createdAt || closure.date).getTime();
        return closureTime > refundTime;
      });
    });
    const closedRefundsSum = closedCashRefunds.reduce((acc, r) => acc + r.amount, 0);

    return Math.max(0, closedSalesSum - closedExpensesSum - closedRefundsSum);
  }, [sales, closures, movements, customerRefunds]);

  // --- KPI g: Liquidez Bancos ---
  const bankLiquidityTotal = useMemo(() => {
    const confirmedCardDepositsSum = cardDeposits
      .filter((d) => d.status === 'confirmed')
      .reduce((acc, d) => acc + (d.confirmedAmount ?? d.netAmount), 0);

    const transferSalesSum = sales
      .filter((s) => !s.isCancelled)
      .reduce((acc, s) => {
        if (s.paymentMethod === 'transfer') return acc + s.total;
        if (isMixedSale(s)) {
          const tPart = s.paymentBreakdown
            .filter((b) => b.method === 'transfer')
            .reduce((sum, b) => sum + b.amount, 0);
          return acc + tPart;
        }
        return acc;
      }, 0);

    const bankCustomerPaymentsSum = customerPayments
      .filter((p) => p.paymentMethod === 'card' || p.paymentMethod === 'transfer')
      .reduce((acc, p) => acc + p.amount, 0);

    return roundCents(confirmedCardDepositsSum + transferSalesSum + bankCustomerPaymentsSum);
  }, [cardDeposits, sales, customerPayments]);

  // --- P&L Report Data ---
  const plReportData = useMemo(() => {
    let totalSalesPreTax = 0;
    let totalCOGS = 0;

    filteredSales.forEach((s) => {
      s.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.product.id);
        const isGeneric = item.product.category === 'Genérico' || prod?.category === 'Genérico';

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
      .filter((m) => m.type === 'out' && (m.isOperational === true || m.isOperational === undefined))
      .reduce((sum, m) => sum + m.amount, 0);

    const netOperatingProfit = grossProfit - operationalExpenses;

    const personalExpenses = filteredMovements
      .filter((m) => m.type === 'out' && m.isOperational === false)
      .reduce((sum, m) => sum + m.amount, 0);

    return {
      totalSalesPreTax,
      totalCOGS,
      grossProfit,
      operationalExpenses,
      netOperatingProfit,
      personalExpenses,
    };
  }, [filteredSales, filteredMovements, products]);

  // --- Export P&L Report to Excel ---
  const exportToExcel = () => {
    let dateStr = '';
    if (filterType === 'Día') {
      dateStr = format(selectedDay, 'yyyy-MM-dd');
    } else if (filterType === 'Semana') {
      dateStr = `${format(start, 'yyyy-MM-dd')}_a_${format(end, 'yyyy-MM-dd')}`;
    } else if (filterType === 'Mes') {
      dateStr = format(selectedMonthAnchor, 'yyyy-MM');
    } else {
      dateStr = `${customRangeStart}_a_${customRangeEnd}`;
    }

    const filename = `Estado_de_Resultados_${dateStr}.xlsx`;
    const wb = XLSX.utils.book_new();

    const data = [
      ['ESTADO DE RESULTADOS (P&L)'],
      [
        `Periodo: ${
          filterType === 'Día'
            ? formatSpanishDate(selectedDay)
            : filterType === 'Semana'
            ? formatSpanishWeekRange(start, end)
            : filterType === 'Mes'
            ? formatSpanishMonthYear(selectedMonthAnchor)
            : `${customRangeStart} a ${customRangeEnd}`
        }`,
      ],
      [],
      ['CONCEPTO', 'MONTO (RD$)'],
      [],
      ['Ingresos por Ventas', plReportData.totalSalesPreTax],
      ['(-) Costo de Mercancía Vendida (CMV)', plReportData.totalCOGS],
      ['= Utilidad Bruta', plReportData.grossProfit],
      [],
      ['(-) Gastos Operativos', plReportData.operationalExpenses],
      ['= Utilidad Neta Operativa', plReportData.netOperatingProfit],
      [],
      ['INFORMACIÓN ADICIONAL'],
      ['Gastos Personales del Período (Informativo)', plReportData.personalExpenses],
      [],
      ['SALDOS PENDIENTES (A LA FECHA DE HOY)'],
      ['Cuentas por Cobrar Totales', totalOutstandingCredit],
      ['Cuentas por Pagar Totales', getTotalPayablesBalance(payables, payablePayments)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 45 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, 'P&L');
    XLSX.writeFile(wb, filename);
  };

  // --- Detail of Cash Liquidity for Modal ---
  const cashLiquidityDetail = useMemo(() => {
    let closedSalesSum = 0;
    const groupedSales: Record<
      string,
      { dateStr: string; count: number; total: number; timestamp: number }
    > = {};

    sales
      .filter((s) => !s.isCancelled)
      .forEach((sale) => {
        const employeeId = sale.soldBy?.id;
        if (employeeId) {
          const saleTime = getSaleTimestamp(sale);
          const isClosed = closures.some((closure) => {
            if (closure.employeeId !== employeeId) return false;
            const closureTime = new Date(closure.createdAt || closure.date).getTime();
            return closureTime > saleTime;
          });
          if (!isClosed) return;
        }

        let cashPart = 0;
        if (sale.paymentMethod === 'cash') {
          cashPart = sale.total;
        } else if (isMixedSale(sale)) {
          cashPart = sale.paymentBreakdown
            .filter((b) => b.method === 'cash')
            .reduce((sum, b) => sum + b.amount, 0);
        }

        if (cashPart > 0) {
          closedSalesSum += cashPart;
          const t = getSaleTimestamp(sale);
          const d = new Date(t);
          const key = d.toISOString().split('T')[0];

          const displayDate = d.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
          if (!groupedSales[key]) {
            groupedSales[key] = {
              dateStr: displayDate,
              count: 0,
              total: 0,
              timestamp: t,
            };
          }
          groupedSales[key].count += 1;
          groupedSales[key].total += cashPart;
        }
      });

    const entries = Object.values(groupedSales).sort((a, b) => b.timestamp - a.timestamp);

    const cashExpenses = movements.filter((m) => m.type === 'out' && m.paymentMethod === 'cash');
    const closedCashExpenses = cashExpenses.filter((expense) => {
      const source = expense.source ?? 'shift';
      if (source === 'dashboard') return true;

      const employeeId = expense.employeeId;
      if (!employeeId) return true;

      const expenseTime = new Date(expense.createdAt || expense.date).getTime();
      return closures.some((closure) => {
        if (closure.employeeId !== employeeId) return false;
        const closureTime = new Date(closure.createdAt || closure.date).getTime();
        return closureTime > expenseTime;
      });
    });

    const closedExpensesSum = closedCashExpenses.reduce((acc, m) => acc + m.amount, 0);

    const exits = closedCashExpenses
      .map((expense) => {
        const t = new Date(expense.createdAt || expense.date).getTime();
        const d = new Date(t);
        const displayDate = d.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const emp = employees.find((e) => e.id === expense.employeeId);
        const registeredBy = emp ? emp.name : (expense.employeeName || expense.clerkName || 'Desconocido');
        return {
          id: expense.id,
          dateStr: displayDate,
          concept: expense.concept || 'Gasto/Egreso',
          registeredBy,
          amount: expense.amount,
          timestamp: t,
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    const cashRefunds = (customerRefunds || []).filter((r) => r.method === 'cash');
    const closedCashRefunds = cashRefunds.filter((refund) => {
      const employeeId = refund.employeeId;
      if (!employeeId) return true;

      const refundTime = new Date(refund.createdAt || refund.date).getTime();
      return closures.some((closure) => {
        if (closure.employeeId !== employeeId) return false;
        const closureTime = new Date(closure.createdAt || closure.date).getTime();
        return closureTime > refundTime;
      });
    });

    const closedRefundsSum = closedCashRefunds.reduce((acc, r) => acc + r.amount, 0);

    const groupedRefunds: Record<
      string,
      { dateStr: string; count: number; total: number; timestamp: number }
    > = {};
    closedCashRefunds.forEach((refund) => {
      const t = new Date(refund.createdAt || refund.date).getTime();
      const d = new Date(t);
      const key = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      if (!groupedRefunds[key]) {
        groupedRefunds[key] = {
          dateStr: displayDate,
          count: 0,
          total: 0,
          timestamp: t,
        };
      }
      groupedRefunds[key].count += 1;
      groupedRefunds[key].total += refund.amount;
    });

    const refunds = Object.values(groupedRefunds).sort((a, b) => b.timestamp - a.timestamp);

    return {
      entries,
      exits,
      refunds,
      totalEntries: closedSalesSum,
      totalExits: closedExpensesSum,
      totalRefunds: closedRefundsSum,
      totalLiquidity: Math.max(0, closedSalesSum - closedExpensesSum - closedRefundsSum),
    };
  }, [sales, closures, movements, employees, customerRefunds]);

  // --- Payment Methods Distribution ---
  const paymentMethodsData = useMemo(() => {
    const totals: Record<string, number> = {
      cash: 0,
      card: 0,
      transfer: 0,
      qr: 0,
      credit: 0,
    };
    filteredSales.forEach((s) => {
      if (isMixedSale(s)) {
        s.paymentBreakdown.forEach((b) => {
          const method = getStringValue(b.method, 'cash');
          const amt = Number(b.amount || 0);
          if (totals[method] !== undefined) {
            totals[method] += amt;
          } else {
            totals[method] = amt;
          }
        });
      } else {
        const method = getStringValue(s.paymentMethod, 'cash');
        const total = Number(s.total || 0);
        totals[method] = (totals[method] || 0) + total;
      }
    });

    const labels: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      qr: 'Código QR',
      credit: 'Crédito',
    };

    const colors: Record<string, string> = {
      cash: '#10B981',
      card: '#3B82F6',
      transfer: '#8B5CF6',
      qr: '#EC4899',
      credit: '#F59E0B',
    };

    return Object.entries(totals)
      .map(([key, value]) => ({
        name: labels[key] || String(key),
        value: Number(value || 0),
        color: colors[key] || '#94A3B8',
      }))
      .filter((item) => item.value > 0);
  }, [filteredSales]);

  // --- Alerts Panel Data ---
  const lowStockAlerts = useMemo(() => {
    return products
      .filter((p) => {
        const stock = Number(p.stock || 0);
        const minStock = p.minStock !== undefined ? Number(p.minStock) : 0;
        return (minStock > 0 && stock <= minStock) || stock <= 0;
      })
      .map((p) => ({
        id: String(p.id || ''),
        name: getStringValue(p.name, 'Sin nombre'),
        stock: Number(p.stock || 0),
        minStock: p.minStock !== undefined ? Number(p.minStock) : 0,
      }));
  }, [products]);

  const overlimitCustomerAlerts = useMemo(() => {
    return customers
      .map((c) => {
        const debt = Number(customerDebts[c.id] || 0);
        const limit = Number(c.creditLimit || 0);
        const exceeded = debt - limit;
        return {
          id: String(c.id || ''),
          name: getStringValue(c.name, 'Sin nombre'),
          debt,
          limit,
          exceeded,
        };
      })
      .filter((item) => item.limit > 0 && item.exceeded > 0)
      .sort((a, b) => b.exceeded - a.exceeded);
  }, [customers, customerDebts]);

  const upcomingPayablesAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return payables
      .map((p) => {
        const bal = Number(getPayableBalance(p.id, payables, payablePayments) || 0);
        const due = new Date(p.dueDate);
        due.setHours(0, 0, 0, 0);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = isNaN(diffTime) ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          id: String(p.id || ''),
          supplierName: getStringValue(p.supplierName, 'Sin proveedor'),
          concept: getStringValue(p.concept, ''),
          balance: bal,
          dueDate: String(p.dueDate || ''),
          diffDays,
          isOverdue: diffDays < 0,
          isSoon: diffDays <= 5,
        };
      })
      .filter((item) => item.balance > 0 && (item.isOverdue || item.isSoon))
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [payables, payablePayments]);

  const lowMarginAlerts = useMemo(() => {
    const targets = dashboardConfig?.categoryProfitTargets;
    return products
      .map((p) => {
        const info = isProductBelowTargetProfit(p, targets);
        const catStr = getStringValue(p.category, 'Sin categoría');
        return {
          id: String(p.id || ''),
          name: getStringValue(p.name, 'Sin nombre'),
          category: catStr,
          actualMargin: Number(info.actualMargin || 0),
          targetMargin: Number(info.targetMargin || 0),
          diff: Number(info.diff || 0),
          isBelow: Boolean(info.isBelow),
        };
      })
      .filter((item) => item.isBelow)
      .sort((a, b) => b.diff - a.diff);
  }, [products, dashboardConfig?.categoryProfitTargets]);

  const cardTerminalAlerts = useMemo(() => {
    return (closures || [])
      .filter((c) => c.cardTerminalMatched === false)
      .map((c) => {
        const dateVal = c.createdAt || c.date;
        const formattedDate = dateVal
          ? new Date(dateVal).toLocaleDateString('es-DO', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : c.date;
        return {
          id: String(c.id || ''),
          date: String(c.date || ''),
          formattedDate,
          employeeName: getStringValue(c.clerkName, 'Empleado'),
          systemAmount: Number(c.cardTerminalSystemAmount ?? 0),
          reportedAmount: Number(c.cardTerminalReportedAmount ?? 0),
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [closures]);

  // --- Top Products Data ---
  const topProductsData = useMemo(() => {
    const map: Record<string, { qty: number; total: number }> = {};
    filteredSales.forEach((s) => {
      if (!s.items || !Array.isArray(s.items)) return;
      s.items.forEach((item) => {
        if (!item || !item.product) return;
        const pId = getStringValue(item.product.id, 'unknown');
        if (!map[pId]) {
          map[pId] = { qty: 0, total: 0 };
        }
        const qty = Number(item.quantity || 0);
        const price = Number(item.product.price || 0);
        map[pId].qty += qty;
        map[pId].total += price * qty;
      });
    });

    return Object.entries(map)
      .map(([id, stats]) => {
        const prod = products.find((p) => p.id === id);
        const prodName = prod ? getStringValue(prod.name, '') : `Producto (${id.slice(0, 5)})`;
        return {
          id: String(id),
          name: prodName,
          qty: Number(stats.qty || 0),
          total: Number(stats.total || 0),
        };
      })
      .sort((a, b) => b.qty - a.qty);
  }, [filteredSales, products]);

  // --- Expiring Soon Products ---
  const expiringSoonProducts = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const sevenDaysLater = endOfDay(addDays(todayStart, 7));

    return products
      .filter((p) => {
        if (!p.expirationDate || typeof p.expirationDate !== 'string') return false;
        const expDate = new Date(p.expirationDate + 'T00:00:00');
        if (isNaN(expDate.getTime())) return false;
        return expDate >= todayStart && expDate <= sevenDaysLater;
      })
      .map((p) => {
        const expDate = new Date(p.expirationDate! + 'T00:00:00');
        const daysLeft = Math.ceil((expDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: String(p.id || ''),
          name: getStringValue(p.name, 'Sin nombre'),
          expirationDate: String(p.expirationDate || ''),
          daysLeft: Number(daysLeft || 0),
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [products]);

  // --- Comparison with Previous Period ---
  const previousPeriod = useMemo(() => {
    if (filterType === 'Día') {
      const prevDay = subDays(selectedDay, 7);
      return {
        start: startOfDay(prevDay),
        end: endOfDay(prevDay),
      };
    } else if (filterType === 'Semana') {
      const prevWeekAnchor = subDays(selectedWeekAnchor, 7);
      return {
        start: startOfWeek(prevWeekAnchor, { weekStartsOn: 1 }),
        end: endOfWeek(prevWeekAnchor, { weekStartsOn: 1 }),
      };
    } else if (filterType === 'Mes') {
      const prevMonthAnchor = subMonths(selectedMonthAnchor, 1);
      return {
        start: startOfMonth(prevMonthAnchor),
        end: endOfMonth(prevMonthAnchor),
      };
    } else {
      const durationMs = end.getTime() - start.getTime() + 1;
      return {
        start: new Date(start.getTime() - durationMs),
        end: new Date(end.getTime() - durationMs),
      };
    }
  }, [filterType, selectedDay, selectedWeekAnchor, selectedMonthAnchor, start, end]);

  const prevPeriodSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.isCancelled) return false;
      const sDate = new Date(getSaleTimestamp(s));
      return sDate >= previousPeriod.start && sDate <= previousPeriod.end;
    });
  }, [sales, previousPeriod]);

  const totalPrevSalesAmount = useMemo(() => {
    return prevPeriodSales.reduce((acc, s) => acc + s.total, 0);
  }, [prevPeriodSales]);

  const salesVariationPercent = useMemo(() => {
    if (totalPrevSalesAmount === 0) {
      if (totalSalesAmount > 0) return 100;
      return 0;
    }
    return ((totalSalesAmount - totalPrevSalesAmount) / totalPrevSalesAmount) * 100;
  }, [totalSalesAmount, totalPrevSalesAmount]);

  // --- Chart Data Calculation ---
  const chartData = useMemo(() => {
    if (filterType === 'Día') {
      const data = Array.from({ length: 24 }, (_, i) => ({
        label: `${i.toString().padStart(2, '0')}:00`,
        total: 0,
        tickets: 0,
      }));
      filteredSales.forEach((s) => {
        const hour = new Date(getSaleTimestamp(s)).getHours();
        if (hour >= 0 && hour < 24) {
          data[hour].total += s.total;
          data[hour].tickets += 1;
        }
      });
      return data.filter((d) => d.total > 0 || (parseInt(d.label) >= 8 && parseInt(d.label) <= 21));
    } else if (filterType === 'Semana') {
      const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const data = daysOfWeek.map((day) => ({
        label: day,
        total: 0,
        tickets: 0,
      }));
      filteredSales.forEach((s) => {
        const d = new Date(getSaleTimestamp(s));
        const dayIndex = d.getDay();
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;
        if (adjustedIndex >= 0 && adjustedIndex < 7) {
          data[adjustedIndex].total += s.total;
          data[adjustedIndex].tickets += 1;
        }
      });
      return data;
    } else if (filterType === 'Mes') {
      const year = selectedMonthAnchor.getFullYear();
      const month = selectedMonthAnchor.getMonth();
      const numDays = new Date(year, month + 1, 0).getDate();
      const data = Array.from({ length: numDays }, (_, i) => ({
        label: `${i + 1}`,
        total: 0,
        tickets: 0,
      }));
      filteredSales.forEach((s) => {
        const d = new Date(getSaleTimestamp(s));
        if (d.getFullYear() === year && d.getMonth() === month) {
          const dayNum = d.getDate();
          if (dayNum >= 1 && dayNum <= numDays) {
            data[dayNum - 1].total += s.total;
            data[dayNum - 1].tickets += 1;
          }
        }
      });
      return data;
    } else {
      const diffDays = differenceInDays(end, start);
      if (diffDays <= 60) {
        const dataMap: Record<
          string,
          { label: string; total: number; tickets: number; dateObj: Date }
        > = {};
        let temp = new Date(start);
        while (temp <= end) {
          const key = temp.toISOString().split('T')[0];
          const dayLabel = `${temp.getDate()}/${temp.getMonth() + 1}`;
          dataMap[key] = { label: dayLabel, total: 0, tickets: 0, dateObj: new Date(temp) };
          temp = addDays(temp, 1);
        }
        filteredSales.forEach((s) => {
          const key = s.date.split('T')[0];
          if (dataMap[key]) {
            dataMap[key].total += s.total;
            dataMap[key].tickets += 1;
          }
        });
        return Object.values(dataMap)
          .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
          .map(({ label, total, tickets }) => ({ label, total, tickets }));
      } else {
        const numWeeks = Math.ceil(diffDays / 7);
        const data = Array.from({ length: numWeeks }, (_, i) => {
          const weekStart = addDays(start, i * 7);
          const weekEnd = addDays(weekStart, 6);
          const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
          return {
            label,
            weekStart,
            weekEnd,
            total: 0,
            tickets: 0,
          };
        });
        filteredSales.forEach((s) => {
          const sDate = new Date(getSaleTimestamp(s));
          const matchedWeek = data.find((w) => sDate >= w.weekStart && sDate <= w.weekEnd);
          if (matchedWeek) {
            matchedWeek.total += s.total;
            matchedWeek.tickets += 1;
          }
        });
        return data.map(({ label, total, tickets }) => ({ label, total, tickets }));
      }
    }
  }, [filterType, filteredSales, start, end, selectedMonthAnchor]);

  // --- Closures With Sales ---
  const closuresWithSales = useMemo(() => {
    const sortedClosures = [...closures].sort(
      (a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime()
    );

    const result = sortedClosures.map((closure, idx) => {
      const prevClosure = idx > 0 ? sortedClosures[idx - 1] : null;
      const windowStart = prevClosure ? new Date(prevClosure.createdAt || prevClosure.date) : new Date(0);
      const windowEnd = new Date(closure.createdAt || closure.date);

      const closureSales = sales.filter((s) => {
        if (s.isCancelled) return false;
        const sTime = getSaleTimestamp(s);
        return sTime > windowStart.getTime() && sTime <= windowEnd.getTime();
      });

      return {
        ...closure,
        sales: closureSales,
        salesCount: closureSales.length,
        actualTotal: closureSales.reduce((acc, s) => acc + s.total, 0),
      };
    });

    return result
      .sort(
        (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
      )
      .filter((c) => {
        const cDate = new Date(c.createdAt || c.date);
        return cDate >= start && cDate <= end;
      });
  }, [closures, sales, start, end]);

  const allSortedClosures = useMemo(() => {
    return [...closures].sort(
      (a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime()
    );
  }, [closures]);

  // --- Modal Closure Details ---
  const modalSales = useMemo(() => {
    if (!selectedClosureModal) return [];
    const idx = allSortedClosures.findIndex((c) => c.id === selectedClosureModal.id);
    const prevClosure = idx > 0 ? allSortedClosures[idx - 1] : null;
    const windowStart = prevClosure ? new Date(prevClosure.createdAt || prevClosure.date) : new Date(0);
    const windowEnd = new Date(selectedClosureModal.createdAt || selectedClosureModal.date);

    return sales.filter((s) => {
      if (s.isCancelled) return false;
      const sTime = getSaleTimestamp(s);
      return sTime > windowStart.getTime() && sTime <= windowEnd.getTime();
    });
  }, [selectedClosureModal, allSortedClosures, sales]);

  const modalSalesMetrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let card = 0;
    let transfer = 0;
    let credit = 0;
    let mixed = 0;

    modalSales.forEach((sale) => {
      total += sale.total;
      if (isMixedSale(sale)) {
        mixed += sale.total;
        sale.paymentBreakdown.forEach((b) => {
          if (b.method === 'cash') cash += b.amount;
          else if (b.method === 'card') card += b.amount;
          else if (b.method === 'transfer') transfer += b.amount;
          else if (b.method === 'credit') credit += b.amount;
        });
      } else if (sale.paymentMethod === 'cash') {
        cash += sale.total;
      } else if (sale.paymentMethod === 'card') {
        card += sale.total;
      } else if (sale.paymentMethod === 'transfer') {
        transfer += sale.total;
      } else if (sale.paymentMethod === 'credit' || sale.isCredit) {
        credit += sale.total;
      }
    });

    return { total, cash, card, transfer, credit, mixed, count: modalSales.length };
  }, [modalSales]);

  const modalCreditSales = useMemo(() => {
    if (!selectedClosureModal) return [];
    return modalSales
      .map((sale) => {
        let creditAmount = 0;
        if (sale.paymentMethod === 'credit' || sale.isCredit) {
          creditAmount = sale.total;
        } else if (isMixedSale(sale)) {
          creditAmount = sale.paymentBreakdown
            .filter((b) => b.method === 'credit')
            .reduce((sum, b) => sum + b.amount, 0);
        }

        if (creditAmount <= 0) return null;

        const dateVal = sale.createdAt || sale.date;
        const timeStr = dateVal
          ? new Date(dateVal).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          : '--:--';
        const cust = customers.find((c) => c.id === sale.customerId);
        const customerName = sale.customerName || cust?.name || 'Cliente sin nombre';

        return {
          id: sale.id,
          ticketNumber: sale.ticketNumber,
          customerName,
          amount: creditAmount,
          timeStr,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [selectedClosureModal, modalSales, customers]);

  const modalMovements = useMemo(() => {
    if (!selectedClosureModal) return [];
    const idx = allSortedClosures.findIndex((c) => c.id === selectedClosureModal.id);
    const prevClosure = idx > 0 ? allSortedClosures[idx - 1] : null;
    const windowStart = prevClosure ? new Date(prevClosure.createdAt || prevClosure.date) : new Date(0);
    const windowEnd = new Date(selectedClosureModal.createdAt || selectedClosureModal.date);

    return movements.filter((m) => {
      if (m.type !== 'out') return false;
      const source = m.source ?? 'shift';
      if (source !== 'shift') return false;
      if (
        selectedClosureModal.employeeId &&
        m.employeeId &&
        m.employeeId !== selectedClosureModal.employeeId
      )
        return false;
      const mTime = new Date(m.createdAt || m.date).getTime();
      return mTime > windowStart.getTime() && mTime <= windowEnd.getTime();
    });
  }, [selectedClosureModal, allSortedClosures, movements]);

  const modalExpensesTotal = useMemo(() => {
    return modalMovements.reduce((sum, m) => sum + m.amount, 0);
  }, [modalMovements]);

  const modalRefunds = useMemo(() => {
    if (!selectedClosureModal) return [];
    const idx = allSortedClosures.findIndex((c) => c.id === selectedClosureModal.id);
    const prevClosure = idx > 0 ? allSortedClosures[idx - 1] : null;
    const windowStart = prevClosure ? new Date(prevClosure.createdAt || prevClosure.date) : new Date(0);
    const windowEnd = new Date(selectedClosureModal.createdAt || selectedClosureModal.date);

    return customerRefunds.filter((r) => {
      const rTime = new Date(r.createdAt || r.date).getTime();
      if (
        selectedClosureModal.employeeId &&
        r.employeeId &&
        r.employeeId !== selectedClosureModal.employeeId
      )
        return false;
      return rTime > windowStart.getTime() && rTime <= windowEnd.getTime();
    });
  }, [selectedClosureModal, allSortedClosures, customerRefunds]);

  // --- Employee Stats ---
  const employeeStats = useMemo(() => {
    const stats: Record<
      string,
      {
        tickets: number;
        total: number;
        id: string;
        name: string;
        role: string;
        active: boolean;
      }
    > = {};

    employees.forEach((emp) => {
      stats[emp.id] = {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        active: emp.active,
        tickets: 0,
        total: 0,
      };
    });

    filteredSales.forEach((s) => {
      if (s.soldBy?.id && stats[s.soldBy.id]) {
        stats[s.soldBy.id].tickets += 1;
        stats[s.soldBy.id].total += s.total;
      }
    });

    return Object.values(stats)
      .filter((s) => s.tickets > 0 || s.active)
      .sort((a, b) => b.total - a.total);
  }, [employees, filteredSales]);

  const getEmployeeTrend = (empId: string) => {
    const now = new Date();
    const result = [];
    const spanishMonthsShort = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
    ];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const mStart = startOfMonth(d);
      const mEnd = endOfMonth(d);

      const mSales = sales.filter((s) => {
        if (s.isCancelled || s.soldBy?.id !== empId) return false;
        const sDate = new Date(getSaleTimestamp(s));
        return sDate >= mStart && sDate <= mEnd;
      });

      result.push({
        label: spanishMonthsShort[d.getMonth()],
        total: mSales.reduce((acc, s) => acc + s.total, 0),
      });
    }
    return result;
  };

  // --- Inventory Stats ---
  const inventoryStats = useMemo(() => {
    const visibleProducts = products.filter((p) => p.visible !== false);
    const totalValue = visibleProducts.reduce(
      (acc, p) => acc + p.stock * (p.cost || 0),
      0
    );
    const lowStockCount = visibleProducts.filter(
      (p) => p.stock <= (p.minStock || 0)
    ).length;
    const outOfStockCount = visibleProducts.filter((p) => p.stock <= 0).length;

    const ninetyDaysAgo = subDays(new Date(), 90);
    const recentSales = sales.filter(
      (s) => !s.isCancelled && new Date(getSaleTimestamp(s)) >= ninetyDaysAgo
    );

    const productSalesMap: Record<string, number> = {};
    recentSales.forEach((s) => {
      s.items?.forEach((item) => {
        if (item.product?.id) {
          productSalesMap[item.product.id] =
            (productSalesMap[item.product.id] || 0) + (item.quantity || 1);
        }
      });
    });

    return {
      totalValue,
      lowStockCount,
      outOfStockCount,
      productSalesMap,
    };
  }, [products, sales]);

  return {
    filteredSales,
    filteredMovements,
    totalExpensesAmount,
    totalPendingReturns,
    pendingReturnsCount,
    expensesBreakdown,
    totalSalesAmount,
    totalTicketsCount,
    marginPercent,
    customerDebts,
    totalOutstandingCredit,
    activeCreditNotesBalance,
    cashLiquidityTotal,
    bankLiquidityTotal,
    plReportData,
    exportToExcel,
    cashLiquidityDetail,
    paymentMethodsData,
    lowStockAlerts,
    overlimitCustomerAlerts,
    upcomingPayablesAlerts,
    lowMarginAlerts,
    cardTerminalAlerts,
    topProductsData,
    expiringSoonProducts,
    previousPeriod,
    prevPeriodSales,
    totalPrevSalesAmount,
    salesVariationPercent,
    chartData,
    closuresWithSales,
    allSortedClosures,
    modalSales,
    modalSalesMetrics,
    modalCreditSales,
    modalMovements,
    modalExpensesTotal,
    modalRefunds,
    employeeStats,
    getEmployeeTrend,
    inventoryStats,
  };
}
