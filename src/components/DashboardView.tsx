import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Product, Sale, Customer, CustomerPayment, Employee, Closure, Movement, AccountPayable, PayablePayment, CardDeposit, DashboardConfig, SupplierReturn, CustomerRefund, CreditNote, SupplierCreditNote } from '../types';
import { getCustomerDebt } from '../lib/customerDebt';
import { getPayableBalance, getTotalPayablesBalance } from '../lib/payableDebt';
import { getNextBusinessDay } from '../lib/businessDays';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  LayoutDashboard, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  User,
  Package, 
  AlertCircle, 
  DollarSign, 
  Receipt, 
  ShoppingBag, 
  Award,
  CreditCard,
  Percent,
  Calendar,
  AlertTriangle,
  Coins,
  Info,
  Check,
  X,
  Landmark,
  FileBarChart,
  Ban
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  addDays, 
  subDays, 
  addMonths, 
  subMonths, 
  differenceInDays,
  format
} from 'date-fns';
import { useAlert } from '../context/AlertContext';
import { getSaleTimestamp } from '../lib/dates';
import { getPreTaxAmount, roundCents } from '../lib/money';
import { getEmployeePermissions } from '../lib/permissions';
import { firestoreService } from '../lib/firebase';
import { PayablesView } from './PayablesView';
import { ReturnsView } from './ReturnsView';

interface DashboardViewProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  customerPayments: CustomerPayment[];
  employees: Employee[];
  closures: Closure[];
  movements?: Movement[];
  customerRefunds?: CustomerRefund[];
  onNavigateToCustomer: (customerId: string) => void;
  onNavigateToProduct: (productId: string) => void;
  onOpenExpenses?: () => void;
  currentEmployee?: Employee | null;
  payables?: AccountPayable[];
  payablePayments?: PayablePayment[];
  cardDeposits?: CardDeposit[];
  dashboardConfig?: DashboardConfig;
  onOpenMenudo?: () => void;
  supplierReturns?: SupplierReturn[];
  supplierCreditNotes?: SupplierCreditNote[];
  creditNotes?: CreditNote[];
}

type DashboardTab = 'resumen' | 'ventas' | 'creditos' | 'cuentas_pagar' | 'bancos' | 'inventario' | 'devoluciones' | 'notas_credito' | 'estado_resultados' | 'empleados';

export const DashboardView: React.FC<DashboardViewProps> = ({
  isOpen,
  onClose,
  products,
  sales,
  customers,
  customerPayments,
  employees,
  closures,
  movements = [],
  customerRefunds = [],
  creditNotes = [],
  onNavigateToCustomer,
  onNavigateToProduct,
  onOpenExpenses,
  currentEmployee = null,
  payables = [],
  payablePayments = [],
  cardDeposits = [],
  dashboardConfig = { id: 'dashboardConfig', cardFeePercent: 3.8, holidays: [] },
  onOpenMenudo,
  supplierReturns = [],
  supplierCreditNotes = [],
}) => {
  const { showAlert, showConfirm } = useAlert();
  const [activeTab, setActiveTab] = useState<DashboardTab>('resumen');
  const [expandedClosureId, setExpandedClosureId] = useState<string | null>(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [isLiquidityModalOpen, setIsLiquidityModalOpen] = useState(false);
  const [confirmingDeposit, setConfirmingDeposit] = useState<CardDeposit | null>(null);
  const [confirmedAmountInput, setConfirmedAmountInput] = useState<string>('');

  // Credit notes tab filter states
  const [creditNoteSearch, setCreditNoteSearch] = useState('');
  const [creditNoteStatusFilter, setCreditNoteStatusFilter] = useState<'all' | 'active' | 'depleted' | 'voided'>('all');
  const [noteToVoid, setNoteToVoid] = useState<CreditNote | null>(null);
  const [voidReasonInput, setVoidReasonInput] = useState('');

  // --- Auto-create CardDeposit entries for card sales ---
  useEffect(() => {
    if (!isOpen || sales.length === 0) return;

    const generateMissingCardDeposits = async () => {
      // 1. Group sales by YYYY-MM-DD
      const cardSalesByDate: Record<string, number> = {};
      
      sales.forEach((sale) => {
        if (!sale.createdAt) return;
        const dateStr = sale.createdAt.substring(0, 10); // YYYY-MM-DD
        if (sale.paymentMethod === 'card') {
          cardSalesByDate[dateStr] = (cardSalesByDate[dateStr] || 0) + sale.total;
        } else if (sale.paymentMethod === 'mixed' && sale.paymentBreakdown) {
          const cardAmount = sale.paymentBreakdown
            .filter(b => b.method === 'card')
            .reduce((sum, b) => sum + b.amount, 0);
          if (cardAmount > 0) {
            cardSalesByDate[dateStr] = (cardSalesByDate[dateStr] || 0) + cardAmount;
          }
        }
      });

      // Operations array for batch
      const ops: any[] = [];

      // 2. Process each date we have card sales for
      Object.entries(cardSalesByDate).forEach(([dateStr, calculatedGross]) => {
        const depositsForDate = cardDeposits.filter((d) => d.batchDate === dateStr);

        if (depositsForDate.length === 0) {
          // Create new CardDeposit
          const feePercent = dashboardConfig?.cardFeePercent ?? 3.8;
          const netAmount = roundCents(calculatedGross * (1 - feePercent / 100));
          
          const parsedDate = new Date(dateStr + 'T00:00:00');
          const expectedDepositDateDate = getNextBusinessDay(parsedDate, dashboardConfig?.holidays ?? []);
          const expectedDepositDate = format(expectedDepositDateDate, 'yyyy-MM-dd');
          
          const newDeposit: CardDeposit = {
            id: `deposit_${dateStr}_${Date.now()}`,
            batchDate: dateStr,
            expectedDepositDate,
            grossAmount: calculatedGross,
            feePercent,
            netAmount,
            status: 'pending',
            createdAt: new Date().toISOString()
          };

          ops.push({
            type: 'set' as const,
            collectionName: 'cardDeposits',
            id: newDeposit.id,
            data: newDeposit
          });
        } else {
          // Update any existing 'pending' deposits if the gross amount has changed
          depositsForDate.forEach((deposit) => {
            if (deposit.status === 'pending' && deposit.grossAmount !== calculatedGross) {
              const newNetAmount = roundCents(calculatedGross * (1 - deposit.feePercent / 100));
              
              ops.push({
                type: 'update' as const,
                collectionName: 'cardDeposits',
                id: deposit.id,
                data: {
                  grossAmount: calculatedGross,
                  netAmount: newNetAmount
                }
              });
            }
          });
        }
      });

      if (ops.length === 0) return;

      try {
        await firestoreService.runBatch(ops);
        console.log(`Auto-processed ${ops.length} card deposit operations.`);
      } catch (err) {
        console.error('Error auto-processing card deposits:', err);
      }
    };

    generateMissingCardDeposits();
  }, [isOpen, sales, cardDeposits, dashboardConfig]);

  // --- Admin Closure States and Helpers ---
  const [editingClosure, setEditingClosure] = useState<Closure | null>(null);
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [savingPendingClosure, setSavingPendingClosure] = useState(false);

  const permissions = useMemo(() => getEmployeePermissions(currentEmployee), [currentEmployee]);
  const canManageEmployees = currentEmployee?.role === 'admin' || permissions.manageEmployees;

  const openShifts = useMemo(() => {
    // 1. Iterate through active employees
    const activeEmployees = employees.filter(emp => emp.active);
    
    const shifts: Array<{
      employee: Employee;
      firstSaleTime: number;
      expectedCash: number;
      totalSalesSum: number;
    }> = [];

    activeEmployees.forEach(emp => {
      // Find the last closure of this employee
      const empClosures = closures.filter(c => c.employeeId === emp.id);
      let lastClosure: Closure | null = null;
      empClosures.forEach(current => {
        if (!lastClosure) {
          lastClosure = current;
          return;
        }
        const latestTime = new Date(lastClosure.createdAt || lastClosure.date).getTime();
        const currentTime = new Date(current.createdAt || current.date).getTime();
        if (currentTime > latestTime) {
          lastClosure = current;
        }
      });

      const lastClosureTime = lastClosure 
        ? new Date(lastClosure.createdAt || lastClosure.date).getTime() 
        : 0;

      // Filter sales since last closure
      const empSales = sales.filter(sale => {
        if (!sale.date || sale.isCancelled) return false;
        if (sale.soldBy?.id !== emp.id) return false;
        return getSaleTimestamp(sale) > lastClosureTime;
      });

      // Only include employees who have sales since their last closure
      if (empSales.length > 0) {
        // Find the earliest sale after the last closure
        const sortedEmpSales = [...empSales].sort((a, b) => getSaleTimestamp(a) - getSaleTimestamp(b));
        const firstSaleTime = getSaleTimestamp(sortedEmpSales[0]);

        // Calculate expectedCash (using initialCash = 500)
        const initialCash = 500;
        
        const empCashSalesSum = empSales.reduce((acc, s) => {
          if (s.paymentMethod === 'cash') return acc + s.total;
          if (s.paymentMethod === 'mixed' && s.paymentBreakdown) {
            const cashPart = s.paymentBreakdown
              .filter(b => b.method === 'cash')
              .reduce((sum, b) => sum + b.amount, 0);
            return acc + cashPart;
          }
          return acc;
        }, 0);

        const empExpenses = movements.filter(m => {
          if (m.type !== 'out') return false;
          if (m.employeeId !== emp.id) return false;
          const mTime = new Date(m.createdAt || m.date).getTime();
          return mTime > lastClosureTime;
        });

        const empCashExpensesSum = empExpenses
          .filter(m => m.paymentMethod === 'cash')
          .reduce((acc, m) => acc + m.amount, 0);

        const expectedCash = initialCash + empCashSalesSum - empCashExpensesSum;
        const totalSalesSum = empSales.reduce((acc, s) => acc + s.total, 0);

        shifts.push({
          employee: emp,
          firstSaleTime,
          expectedCash,
          totalSalesSum
        });
      }
    });

    return shifts;
  }, [employees, closures, sales, movements]);

  const pendingClosures = useMemo(() => {
    return closures.filter(c => c.pendingCashCount === true);
  }, [closures]);

  const handleCloseShiftAdmin = async (shift: any) => {
    if (!canManageEmployees) {
      await showAlert('Acceso Denegado', 'No tienes permisos para cerrar turnos de otros empleados.', 'error');
      return;
    }

    const confirmed = await showConfirm(
      'Cierre Administrativo de Turno',
      `¿Estás seguro de que deseas cerrar administrativamente el turno de ${shift.employee.name}? El efectivo esperado (${shift.expectedCash.toFixed(2)}) se registrará como un estimado y quedará pendiente de conteo físico real.`,
      'Sí, Cerrar Turno',
      'Cancelar'
    );

    if (!confirmed) return;

    try {
      const d = new Date();
      const dateString = d.toISOString().split('T')[0];

      const closureData = {
        date: dateString,
        clerkName: shift.employee.name,
        employeeId: shift.employee.id,
        initialCash: 500,
        salesTotal: shift.totalSalesSum,
        expectedCash: shift.expectedCash,
        actualCash: shift.expectedCash, // marker
        difference: 0,
        status: 'closed' as const,
        createdAt: new Date().toISOString(),
        pendingCashCount: true,
        closedByAdminId: currentEmployee?.id || 'admin',
        closedByAdminName: currentEmployee?.name || 'Administrador'
      };

      await firestoreService.addDoc('closures', closureData);
      await showAlert('Cierre Registrado', `El turno de ${shift.employee.name} ha sido cerrado. Recuerda registrar el conteo real en la sección "Cierres Pendientes de Contar" cuando cuentes el efectivo.`, 'success');
    } catch (err: any) {
      console.error('Error creating admin closure:', err);
      await showAlert('Error', 'No se pudo cerrar el turno: ' + err.message, 'error');
    }
  };

  const handleEditPendingClosure = (closure: Closure) => {
    setEditingClosure(closure);
    setActualCashInput(closure.expectedCash.toFixed(2));
  };

  const handleSavePendingClosure = async () => {
    if (!editingClosure) return;
    const val = parseFloat(actualCashInput);
    if (isNaN(val)) {
      await showAlert('Valor Inválido', 'Por favor, ingresa un número válido para el efectivo contado.', 'warning');
      return;
    }

    try {
      setSavingPendingClosure(true);
      const newActualCash = val;
      const newDifference = newActualCash - editingClosure.expectedCash;

      await firestoreService.updateDoc('closures', editingClosure.id, {
        actualCash: newActualCash,
        difference: newDifference,
        pendingCashCount: false,
        updatedAt: new Date().toISOString()
      });

      await showAlert('Arqueo Registrado', 'El conteo físico de caja ha sido registrado exitosamente.', 'success');
      setEditingClosure(null);
      setActualCashInput('');
    } catch (err: any) {
      console.error('Error updating closure:', err);
      await showAlert('Error', 'No se pudo guardar el conteo: ' + err.message, 'error');
    } finally {
      setSavingPendingClosure(false);
    }
  };

  // --- Flexible Time Filter State ---
  const [filterType, setFilterType] = useState<'Día' | 'Semana' | 'Mes' | 'Rango'>('Mes');
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [selectedWeekAnchor, setSelectedWeekAnchor] = useState<Date>(() => new Date());
  const [selectedMonthAnchor, setSelectedMonthAnchor] = useState<Date>(() => new Date());
  const [customRangeStart, setCustomRangeStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customRangeEnd, setCustomRangeEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // --- Compute Active Time Filter Range { start, end } ---
  const { start, end } = useMemo(() => {
    if (filterType === 'Día') {
      return {
        start: startOfDay(selectedDay),
        end: endOfDay(selectedDay)
      };
    } else if (filterType === 'Semana') {
      return {
        start: startOfWeek(selectedWeekAnchor, { weekStartsOn: 1 }), // Week starts on Monday
        end: endOfWeek(selectedWeekAnchor, { weekStartsOn: 1 })
      };
    } else if (filterType === 'Mes') {
      return {
        start: startOfMonth(selectedMonthAnchor),
        end: endOfMonth(selectedMonthAnchor)
      };
    } else { // Rango
      const startDate = new Date(customRangeStart + 'T00:00:00');
      const endDate = new Date(customRangeEnd + 'T23:59:59');
      return {
        start: startOfDay(isNaN(startDate.getTime()) ? new Date() : startDate),
        end: endOfDay(isNaN(endDate.getTime()) ? new Date() : endDate)
      };
    }
  }, [filterType, selectedDay, selectedWeekAnchor, selectedMonthAnchor, customRangeStart, customRangeEnd]);

  // --- Arrow Navigation Handlers ---
  const handlePrev = () => {
    if (filterType === 'Día') {
      setSelectedDay(prev => subDays(prev, 1));
    } else if (filterType === 'Semana') {
      setSelectedWeekAnchor(prev => subDays(prev, 7));
    } else if (filterType === 'Mes') {
      setSelectedMonthAnchor(prev => subMonths(prev, 1));
    }
  };

  const handleNext = () => {
    if (filterType === 'Día') {
      setSelectedDay(prev => addDays(prev, 1));
    } else if (filterType === 'Semana') {
      setSelectedWeekAnchor(prev => addDays(prev, 7));
    } else if (filterType === 'Mes') {
      setSelectedMonthAnchor(prev => addMonths(prev, 1));
    }
  };

  // --- Spanish Date Formatting Helpers ---
  const spanishMonths = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const spanishMonthsShort = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  const formatSpanishDate = (date: Date): string => {
    return `${date.getDate()} de ${spanishMonths[date.getMonth()]}, ${date.getFullYear()}`;
  };

  const formatSpanishMonthYear = (date: Date): string => {
    return `${spanishMonths[date.getMonth()]} ${date.getFullYear()}`;
  };

  const formatSpanishWeekRange = (weekStart: Date, weekEnd: Date): string => {
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
  };

  const formattedRangeText = useMemo(() => {
    if (filterType === 'Día') {
      return formatSpanishDate(selectedDay);
    } else if (filterType === 'Semana') {
      const wStart = startOfWeek(selectedWeekAnchor, { weekStartsOn: 1 });
      const wEnd = endOfWeek(selectedWeekAnchor, { weekStartsOn: 1 });
      return formatSpanishWeekRange(wStart, wEnd);
    } else if (filterType === 'Mes') {
      return formatSpanishMonthYear(selectedMonthAnchor);
    }
    return '';
  }, [filterType, selectedDay, selectedWeekAnchor, selectedMonthAnchor]);

  // --- Filtered Sales ---
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (s.isCancelled) return false;

      const employeeId = s.soldBy?.id;
      const saleTime = getSaleTimestamp(s);

      if (employeeId) {
        const isShiftClosed = closures.some(closure => {
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
    return movements.filter(m => {
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
      .filter(r => r.status === 'pending')
      .reduce((acc, r) => acc + (r.cost || 0), 0);
  }, [supplierReturns]);

  const pendingReturnsCount = useMemo(() => {
    return (supplierReturns ?? []).filter(r => r.status === 'pending').length;
  }, [supplierReturns]);

  // Breakdown by payment method
  const expensesBreakdown = useMemo(() => {
    let cash = 0;
    let card = 0;
    let transfer = 0;
    filteredMovements.forEach(m => {
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
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const prod = products.find(p => p.id === item.product.id);
        const isGeneric = item.product.category === 'Genérico' || prod?.category === 'Genérico';
        if (isGeneric) return;

        const cost = prod?.cost ?? item.product.cost ?? 0;
        const price = item.product.price; // Sale price per unit
        const preTaxPrice = getPreTaxAmount(price, item.product.taxExempt || prod?.taxExempt);
        const profitPerUnit = preTaxPrice - cost;
        totalProfit += profitPerUnit * item.quantity;
        applicableSalesAmount += preTaxPrice * item.quantity;
      });
    });
    if (applicableSalesAmount === 0) return 0;
    return (totalProfit / applicableSalesAmount) * 100;
  }, [filteredSales, products]);

  // --- KPI b: Cuentas por Cobrar (CON DATOS REALES a HOY, global, no depende del filtro) ---
  const customerDebts = useMemo(() => {
    const debts: Record<string, number> = {};
    customers.forEach(c => {
      debts[c.id] = getCustomerDebt(c.id, sales, customerPayments, customers, customerRefunds);
    });
    return debts;
  }, [customers, sales, customerPayments, customerRefunds]);

  const totalOutstandingCredit = useMemo(() => {
    let sum = 0;
    customers.forEach(c => {
      sum += customerDebts[c.id] || 0;
    });
    return sum;
  }, [customers, customerDebts]);

  const activeCreditNotesBalance = useMemo(() => {
    return creditNotes
      .filter(cn => cn.status === 'active')
      .reduce((sum, cn) => sum + (cn.remainingBalance || 0), 0);
  }, [creditNotes]);

  // --- KPI f: Liquidez en Efectivo (CON DATOS REALES históricos aprox) ---
  const cashLiquidityTotal = useMemo(() => {
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

      if (sale.paymentMethod === 'cash') {
        return acc + sale.total;
      } else if (sale.paymentMethod === 'mixed' && sale.paymentBreakdown) {
        const cashPart = sale.paymentBreakdown
          .filter(b => b.method === 'cash')
          .reduce((sum, b) => sum + b.amount, 0);
        return acc + cashPart;
      }
      return acc;
    }, 0);

    // Reste los egresos en efectivo que ocurrieron ANTES de un corte
    const cashExpenses = movements.filter(m => m.type === 'out' && m.paymentMethod === 'cash');
    const closedCashExpenses = cashExpenses.filter(expense => {
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

    // Reste los reembolsos en efectivo que ocurrieron ANTES de un corte
    const cashRefunds = (customerRefunds || []).filter(r => r.method === 'cash');
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
  }, [sales, closures, movements, customerRefunds]);

  // --- KPI g: Liquidez Bancos (DATOS REALES históricos a la fecha) ---
  const bankLiquidityTotal = useMemo(() => {
    const confirmedCardDepositsSum = cardDeposits
      .filter(d => d.status === 'confirmed')
      .reduce((acc, d) => acc + (d.confirmedAmount ?? d.netAmount), 0);

    const transferSalesSum = sales
      .filter(s => !s.isCancelled)
      .reduce((acc, s) => {
        if (s.paymentMethod === 'transfer') return acc + s.total;
        if (s.paymentMethod === 'mixed' && s.paymentBreakdown) {
          const tPart = s.paymentBreakdown
            .filter(b => b.method === 'transfer')
            .reduce((sum, b) => sum + b.amount, 0);
          return acc + tPart;
        }
        return acc;
      }, 0);

    const bankCustomerPaymentsSum = customerPayments
      .filter(p => p.paymentMethod === 'card' || p.paymentMethod === 'transfer')
      .reduce((acc, p) => acc + p.amount, 0);

    return roundCents(confirmedCardDepositsSum + transferSalesSum + bankCustomerPaymentsSum);
  }, [cardDeposits, sales, customerPayments]);

  // --- P&L Report Data ---
  const plReportData = useMemo(() => {
    let totalSalesPreTax = 0;
    let totalCOGS = 0;

    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const prod = products.find(p => p.id === item.product.id);
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

    // Operational expenses: movements type 'out' where isOperational is true or undefined/not defined
    const operationalExpenses = filteredMovements
      .filter(m => m.type === 'out' && (m.isOperational === true || m.isOperational === undefined))
      .reduce((sum, m) => sum + m.amount, 0);

    const netOperatingProfit = grossProfit - operationalExpenses;

    // Personal expenses: movements type 'out' where isOperational is false
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

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();

    // Data rows
    const data = [
      ['ESTADO DE RESULTADOS (P&L)'],
      [`Periodo: ${filterType === 'Día' ? formatSpanishDate(selectedDay) : filterType === 'Semana' ? formatSpanishWeekRange(start, end) : filterType === 'Mes' ? formatSpanishMonthYear(selectedMonthAnchor) : `${customRangeStart} a ${customRangeEnd}`}`],
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
      ['Cuentas por Pagar Totales', getTotalPayablesBalance(payables, payablePayments)]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
      { wch: 45 }, // Concepto
      { wch: 20 }  // Monto
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'P&L');
    XLSX.writeFile(wb, filename);
  };

  // --- KPI f: Detail of Cash Liquidity for Modal ---
  const cashLiquidityDetail = useMemo(() => {
    let closedSalesSum = 0;
    const groupedSales: Record<string, { dateStr: string, count: number, total: number, timestamp: number }> = {};

    sales.filter(s => !s.isCancelled).forEach(sale => {
      const employeeId = sale.soldBy?.id;
      if (employeeId) {
        const saleTime = getSaleTimestamp(sale);
        const isClosed = closures.some(closure => {
          if (closure.employeeId !== employeeId) return false;
          const closureTime = new Date(closure.createdAt || closure.date).getTime();
          return closureTime > saleTime;
        });
        if (!isClosed) return;
      }

      let cashPart = 0;
      if (sale.paymentMethod === 'cash') {
        cashPart = sale.total;
      } else if (sale.paymentMethod === 'mixed' && sale.paymentBreakdown) {
        cashPart = sale.paymentBreakdown.filter(b => b.method === 'cash').reduce((sum, b) => sum + b.amount, 0);
      }

      if (cashPart > 0) {
        closedSalesSum += cashPart;
        const t = getSaleTimestamp(sale);
        const d = new Date(t);
        const key = d.toISOString().split('T')[0]; // "YYYY-MM-DD"
        
        const displayDate = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        if (!groupedSales[key]) {
          groupedSales[key] = {
            dateStr: displayDate,
            count: 0,
            total: 0,
            timestamp: t
          };
        }
        groupedSales[key].count += 1;
        groupedSales[key].total += cashPart;
      }
    });

    const entries = Object.values(groupedSales).sort((a, b) => b.timestamp - a.timestamp);

    const cashExpenses = movements.filter(m => m.type === 'out' && m.paymentMethod === 'cash');
    const closedCashExpenses = cashExpenses.filter(expense => {
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

    const exits = closedCashExpenses.map(expense => {
      const t = new Date(expense.createdAt || expense.date).getTime();
      const d = new Date(t);
      const displayDate = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      const emp = employees.find(e => e.id === expense.employeeId);
      const registeredBy = emp ? emp.name : (expense.registeredBy || 'Desconocido');
      return {
        id: expense.id,
        dateStr: displayDate,
        concept: expense.concept || 'Gasto/Egreso',
        registeredBy,
        amount: expense.amount,
        timestamp: t
      };
    }).sort((a, b) => b.timestamp - a.timestamp);

    // Filter closed refunds
    const cashRefunds = (customerRefunds || []).filter(r => r.method === 'cash');
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

    const groupedRefunds: Record<string, { dateStr: string, count: number, total: number, timestamp: number }> = {};
    closedCashRefunds.forEach(refund => {
      const t = new Date(refund.createdAt || refund.date).getTime();
      const d = new Date(t);
      const key = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!groupedRefunds[key]) {
        groupedRefunds[key] = {
          dateStr: displayDate,
          count: 0,
          total: 0,
          timestamp: t
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
      totalLiquidity: Math.max(0, closedSalesSum - closedExpensesSum - closedRefundsSum)
    };
  }, [sales, closures, movements, employees, customerRefunds]);

  // --- 1. DISTRIBUTION BY PAYMENT METHOD ---
  const paymentMethodsData = useMemo(() => {
    const totals: Record<string, number> = {
      cash: 0,
      card: 0,
      transfer: 0,
      qr: 0,
      credit: 0,
    };
    filteredSales.forEach(s => {
      if (s.paymentMethod === 'mixed' && s.paymentBreakdown && s.paymentBreakdown.length > 0) {
        s.paymentBreakdown.forEach(b => {
          const method = b.method || 'cash';
          if (totals[method] !== undefined) {
            totals[method] += b.amount;
          } else {
            totals[method] = b.amount;
          }
        });
      } else {
        const method = s.paymentMethod || 'cash';
        totals[method] = (totals[method] || 0) + s.total;
      }
    });
    
    const labels: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      qr: 'Código QR',
      credit: 'Crédito'
    };
    
    const colors: Record<string, string> = {
      cash: '#10B981', // emerald
      card: '#3B82F6', // blue
      transfer: '#8B5CF6', // purple
      qr: '#EC4899', // pink
      credit: '#F59E0B' // amber
    };

    return Object.entries(totals)
      .map(([key, value]) => ({
        name: labels[key] || key,
        value,
        color: colors[key] || '#94A3B8'
      }))
      .filter(item => item.value > 0);
  }, [filteredSales]);

  // --- 2. ALERT PANEL DATA ---
  const lowStockAlerts = useMemo(() => {
    return products
      .filter(p => p.minStock !== undefined && p.minStock > 0 && p.stock <= p.minStock)
      .map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock!
      }));
  }, [products]);

  const overlimitCustomerAlerts = useMemo(() => {
    return customers
      .map(c => {
        const debt = customerDebts[c.id] || 0;
        const limit = c.creditLimit || 0;
        const exceeded = debt - limit;
        return {
          id: c.id,
          name: c.name,
          debt,
          limit,
          exceeded
        };
      })
      .filter(item => item.limit > 0 && item.exceeded > 0)
      .sort((a, b) => b.exceeded - a.exceeded);
  }, [customers, customerDebts]);

  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [showAllOverlimit, setShowAllOverlimit] = useState(false);

  const upcomingPayablesAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return payables
      .map(p => {
        const bal = getPayableBalance(p.id, payables, payablePayments);
        const due = new Date(p.dueDate);
        due.setHours(0, 0, 0, 0);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          id: p.id,
          supplierName: p.supplierName,
          concept: p.concept,
          balance: bal,
          dueDate: p.dueDate,
          diffDays,
          isOverdue: diffDays < 0,
          isSoon: diffDays <= 5
        };
      })
      .filter(item => item.balance > 0 && (item.isOverdue || item.isSoon))
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [payables, payablePayments]);

  const [showAllPayablesAlerts, setShowAllPayablesAlerts] = useState(false);

  // --- 3. TOP 5 MOST SOLD PRODUCTS ---
  const topProductsData = useMemo(() => {
    const map: Record<string, { qty: number, total: number }> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const pId = item.product.id;
        if (!map[pId]) {
          map[pId] = { qty: 0, total: 0 };
        }
        map[pId].qty += item.quantity;
        map[pId].total += item.product.price * item.quantity;
      });
    });

    return Object.entries(map)
      .map(([id, stats]) => {
        const prod = products.find(p => p.id === id);
        return {
          id,
          name: prod?.name || `Producto Desconocido (${id.slice(0, 5)})`,
          qty: stats.qty,
          total: stats.total
        };
      })
      .sort((a, b) => b.qty - a.qty);
  }, [filteredSales, products]);

  // --- 4. EXPIRING SOON PRODUCTS ---
  const expiringSoonProducts = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const sevenDaysLater = endOfDay(addDays(todayStart, 7));

    return products
      .filter(p => {
        if (!p.expirationDate) return false;
        const expDate = new Date(p.expirationDate + 'T00:00:00');
        if (isNaN(expDate.getTime())) return false;
        return expDate >= todayStart && expDate <= sevenDaysLater;
      })
      .map(p => {
        const expDate = new Date(p.expirationDate! + 'T00:00:00');
        const daysLeft = Math.ceil((expDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: p.id,
          name: p.name,
          expirationDate: p.expirationDate!,
          daysLeft
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [products]);

  // --- 5. COMPARISON WITH PREVIOUS PERIOD ---
  const previousPeriod = useMemo(() => {
    if (filterType === 'Día') {
      const prevDay = subDays(selectedDay, 7);
      return {
        start: startOfDay(prevDay),
        end: endOfDay(prevDay)
      };
    } else if (filterType === 'Semana') {
      const prevWeekAnchor = subDays(selectedWeekAnchor, 7);
      return {
        start: startOfWeek(prevWeekAnchor, { weekStartsOn: 1 }),
        end: endOfWeek(prevWeekAnchor, { weekStartsOn: 1 })
      };
    } else if (filterType === 'Mes') {
      const prevMonthAnchor = subMonths(selectedMonthAnchor, 1);
      return {
        start: startOfMonth(prevMonthAnchor),
        end: endOfMonth(prevMonthAnchor)
      };
    } else { // Rango
      const durationMs = end.getTime() - start.getTime() + 1;
      return {
        start: new Date(start.getTime() - durationMs),
        end: new Date(end.getTime() - durationMs)
      };
    }
  }, [filterType, selectedDay, selectedWeekAnchor, selectedMonthAnchor, start, end]);

  const prevPeriodSales = useMemo(() => {
    return sales.filter(s => {
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

  // --- Menudo Handler ---
  const handleMenudoClick = () => {
    if (onOpenMenudo) {
      onOpenMenudo();
    }
  };

  // --- Chart Data Calculation ---
  const chartData = useMemo(() => {
    if (filterType === 'Día') {
      const data = Array.from({ length: 24 }, (_, i) => ({
        label: `${i.toString().padStart(2, '0')}:00`,
        total: 0,
        tickets: 0
      }));
      filteredSales.forEach(s => {
        const hour = new Date(getSaleTimestamp(s)).getHours();
        if (hour >= 0 && hour < 24) {
          data[hour].total += s.total;
          data[hour].tickets += 1;
        }
      });
      // Show standard business hours or active hours to keep graph dense
      return data.filter(d => d.total > 0 || (parseInt(d.label) >= 8 && parseInt(d.label) <= 21));
    } else if (filterType === 'Semana') {
      const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const data = daysOfWeek.map(day => ({
        label: day,
        total: 0,
        tickets: 0
      }));
      filteredSales.forEach(s => {
        const d = new Date(getSaleTimestamp(s));
        let dayIndex = d.getDay(); // 0 is Sunday, 1 is Monday, etc.
        const adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1; // Map Sunday (0) to index 6, Monday (1) to 0
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
        tickets: 0
      }));
      filteredSales.forEach(s => {
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
    } else { // Rango
      const diffDays = differenceInDays(end, start);
      if (diffDays <= 60) {
        const dataMap: Record<string, { label: string, total: number, tickets: number, dateObj: Date }> = {};
        let temp = new Date(start);
        while (temp <= end) {
          const key = temp.toISOString().split('T')[0];
          const dayLabel = `${temp.getDate()}/${temp.getMonth() + 1}`;
          dataMap[key] = { label: dayLabel, total: 0, tickets: 0, dateObj: new Date(temp) };
          temp = addDays(temp, 1);
        }
        filteredSales.forEach(s => {
          const key = s.date.split('T')[0];
          if (dataMap[key]) {
            dataMap[key].total += s.total;
            dataMap[key].tickets += 1;
          }
        });
        return Object.values(dataMap).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
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
            tickets: 0
          };
        });
        filteredSales.forEach(s => {
          const sDate = new Date(getSaleTimestamp(s));
          const matchedWeek = data.find(w => sDate >= w.weekStart && sDate <= w.weekEnd);
          if (matchedWeek) {
            matchedWeek.total += s.total;
            matchedWeek.tickets += 1;
          }
        });
        return data;
      }
    }
  }, [filterType, filteredSales, start, end, selectedMonthAnchor]);

  // --- 6. VENTAS POR CORTE DE CAJA ---
  const closuresWithSales = useMemo(() => {
    // 1. Sort all closures by time (asc for window logic)
    const sortedClosures = [...closures].sort((a, b) => 
      new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime()
    );

    // 2. Map closures to their sales
    const result = sortedClosures.map((closure, idx) => {
      const prevClosure = idx > 0 ? sortedClosures[idx - 1] : null;
      const windowStart = prevClosure ? new Date(prevClosure.createdAt || prevClosure.date) : new Date(0);
      const windowEnd = new Date(closure.createdAt || closure.date);

      const closureSales = sales.filter(s => {
        if (s.isCancelled) return false;
        const sTime = getSaleTimestamp(s);
        return sTime > windowStart.getTime() && sTime <= windowEnd.getTime();
      });

      return {
        ...closure,
        sales: closureSales,
        salesCount: closureSales.length,
        actualTotal: closureSales.reduce((acc, s) => acc + s.total, 0)
      };
    });

    // 3. Return sorted desc for the list (most recent first)
    return result.sort((a, b) => 
      new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
    ).filter(c => {
      const cDate = new Date(c.createdAt || c.date);
      return cDate >= start && cDate <= end;
    });
  }, [closures, sales, start, end]);

  // --- 7. EMPLOYEES STATS ---
  const employeeStats = useMemo(() => {
    const stats: Record<string, { 
      tickets: number, 
      total: number, 
      id: string, 
      name: string, 
      role: string,
      active: boolean 
    }> = {};

    employees.forEach(emp => {
      stats[emp.id] = { 
        id: emp.id, 
        name: emp.name, 
        role: emp.role, 
        active: emp.active,
        tickets: 0, 
        total: 0 
      };
    });

    filteredSales.forEach(s => {
      if (s.soldBy?.id && stats[s.soldBy.id]) {
        stats[s.soldBy.id].tickets += 1;
        stats[s.soldBy.id].total += s.total;
      }
    });

    return Object.values(stats)
      .filter(s => s.tickets > 0 || s.active) // Show active employees or those with sales
      .sort((a, b) => b.total - a.total);
  }, [employees, filteredSales]);

  // Trend data for last 6 months for a specific employee
  const getEmployeeTrend = (empId: string) => {
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const mStart = startOfMonth(d);
      const mEnd = endOfMonth(d);
      
      const mSales = sales.filter(s => {
        if (s.isCancelled || s.soldBy?.id !== empId) return false;
        const sDate = new Date(getSaleTimestamp(s));
        return sDate >= mStart && sDate <= mEnd;
      });

      result.push({
        label: spanishMonthsShort[d.getMonth()],
        total: mSales.reduce((acc, s) => acc + s.total, 0)
      });
    }
    return result;
  };

  // --- 8. INVENTARIO TAB CALCULATIONS ---
  const inventoryStats = useMemo(() => {
    const visibleProducts = products.filter(p => p.visible !== false);
    const totalValue = visibleProducts.reduce((acc, p) => acc + (p.stock * (p.cost || 0)), 0);
    const lowStockCount = visibleProducts.filter(p => p.stock <= (p.minStock || 0)).length;
    const outOfStockCount = visibleProducts.filter(p => p.stock <= 0).length;

    // ABC Classification (90 days)
    const ninetyDaysAgo = subDays(new Date(), 90);
    const recentSales = sales.filter(s => !s.isCancelled && new Date(getSaleTimestamp(s)) >= ninetyDaysAgo);
    
    const productSalesMap: Record<string, number> = {};
    recentSales.forEach(s => {
      s.items.forEach(item => {
        const pid = item.product.id;
        productSalesMap[pid] = (productSalesMap[pid] || 0) + (item.product.price * item.quantity);
      });
    });

    const productsWithRevenue = visibleProducts.map(p => ({
      ...p,
      revenue: productSalesMap[p.id] || 0
    })).sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = Object.values(productSalesMap).reduce((acc, v) => acc + v, 0);
    
    let cumulativeRevenue = 0;
    const abcProducts = productsWithRevenue.map(p => {
      cumulativeRevenue += p.revenue;
      const pct = totalRevenue > 0 ? (cumulativeRevenue / totalRevenue) * 100 : 100;
      
      let abcClass: 'A' | 'B' | 'C' = 'C';
      if (totalRevenue === 0 || p.revenue === 0) {
        abcClass = 'C';
      } else if (pct <= 80) {
        abcClass = 'A';
      } else if (pct <= 95) {
        abcClass = 'B';
      } else {
        abcClass = 'C';
      }
      
      return { ...p, abcClass };
    });

    const abcSummary = {
      A: { 
        count: abcProducts.filter(p => p.abcClass === 'A').length, 
        value: abcProducts.filter(p => p.abcClass === 'A').reduce((acc, p) => acc + (p.stock * (p.cost || 0)), 0) 
      },
      B: { 
        count: abcProducts.filter(p => p.abcClass === 'B').length, 
        value: abcProducts.filter(p => p.abcClass === 'B').reduce((acc, p) => acc + (p.stock * (p.cost || 0)), 0) 
      },
      C: { 
        count: abcProducts.filter(p => p.abcClass === 'C').length, 
        value: abcProducts.filter(p => p.abcClass === 'C').reduce((acc, p) => acc + (p.stock * (p.cost || 0)), 0) 
      },
    };

    // Inventory Value by Category
    const categoryValueMap: Record<string, number> = {};
    visibleProducts.forEach(p => {
      const val = p.stock * (p.cost || 0);
      const catName = p.category || 'Sin Categoría';
      categoryValueMap[catName] = (categoryValueMap[catName] || 0) + val;
    });
    
    const categoryValues = Object.entries(categoryValueMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Critical products
    const criticalProducts = visibleProducts
      .filter(p => p.stock <= (p.minStock || 0))
      .sort((a, b) => (a.stock - (a.minStock || 0)) - (b.stock - (b.minStock || 0)));

    return {
      totalValue,
      lowStockCount,
      outOfStockCount,
      abcProducts,
      abcSummary,
      categoryValues,
      criticalProducts
    };
  }, [products, sales]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 animate-fade-in h-screen w-screen overflow-hidden text-slate-800">
      
      {/* 1. Header Area */}
      <header className="bg-white border-b border-slate-200 shrink-0 shadow-xs px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer text-slate-500 hover:text-slate-800"
            title="Volver a ventas"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-850 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-indigo-600" />
              <span>Centro de Control y Analíticas</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Métricas de rendimiento del negocio</p>
          </div>
        </div>

        {/* Flexible Time Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Main Filter Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['Día', 'Semana', 'Mes', 'Rango'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  filterType === type 
                    ? 'bg-white text-indigo-600 shadow-xs font-black' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Navigators / Date Selectors depending on filter type */}
          <div className="flex items-center gap-2">
            {filterType !== 'Rango' ? (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-xs">
                <button
                  onClick={handlePrev}
                  className="p-1.5 hover:bg-white rounded-lg transition-all cursor-pointer text-slate-500 hover:text-slate-800 border border-transparent hover:border-slate-200"
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="px-3 text-xs font-black text-slate-700 uppercase tracking-wider font-mono text-center min-w-[150px] whitespace-nowrap">
                  {formattedRangeText}
                </span>

                <button
                  onClick={handleNext}
                  className="p-1.5 hover:bg-white rounded-lg transition-all cursor-pointer text-slate-500 hover:text-slate-800 border border-transparent hover:border-slate-200"
                  title="Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Date Inputs to allow jumping specifically */}
                {filterType === 'Día' && (
                  <input 
                    type="date"
                    value={selectedDay.toISOString().split('T')[0]}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDay(new Date(e.target.value + 'T00:00:00'));
                      }
                    }}
                    className="ml-2 py-0.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                )}

                {filterType === 'Semana' && (
                  <input 
                    type="date"
                    value={selectedWeekAnchor.toISOString().split('T')[0]}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedWeekAnchor(new Date(e.target.value + 'T00:00:00'));
                      }
                    }}
                    className="ml-2 py-0.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 shadow-xs">
                <span className="text-[10px] font-black uppercase text-slate-400">Desde</span>
                <input 
                  type="date" 
                  value={customRangeStart}
                  onChange={(e) => setCustomRangeStart(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-mono text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[10px] font-black uppercase text-slate-400">Hasta</span>
                <input 
                  type="date" 
                  value={customRangeEnd}
                  onChange={(e) => setCustomRangeEnd(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-mono text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Menudo Button */}
            <button
              onClick={handleMenudoClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl font-bold text-amber-700 transition-colors cursor-pointer shadow-xs"
              title="Módulo de Menudo"
            >
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-black uppercase tracking-wider">Menudo</span>
            </button>

          </div>
        </div>
      </header>

      {/* 2. Top Tabs bar */}
      <div className="bg-white px-6 border-b border-slate-200 shrink-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
        {[
          { id: 'resumen', label: 'Resumen' },
          { id: 'ventas', label: 'Ventas' },
          { id: 'creditos', label: 'Créditos' },
          { id: 'cuentas_pagar', label: 'Cuentas por Pagar' },
          { id: 'bancos', label: 'Bancos' },
          { id: 'inventario', label: 'Inventario' },
          { id: 'devoluciones', label: 'Devoluciones' },
          { id: 'notas_credito', label: 'Notas de Crédito' },
          { id: 'estado_resultados', label: 'Estado de Resultados' },
          { id: 'empleados', label: 'Empleados' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as DashboardTab)}
            className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-650'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        
        {/* --- RESUMEN TAB --- */}
        {activeTab === 'resumen' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            
            {/* 8 KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4">
              
              {/* Card 1: Ventas Cerradas */}
              <div 
                onClick={() => setActiveTab('ventas')}
                className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Ventas Cerradas</span>
                  <span className="text-sm font-black font-mono text-emerald-600 block">
                    RD$ {totalSalesAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {/* Variation Indicator */}
                  <div className="mt-1 flex items-center gap-1">
                    {salesVariationPercent > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                        <TrendingUp className="w-2.5 h-2.5" />
                        <span>+{salesVariationPercent.toFixed(1)}%</span>
                      </span>
                    ) : salesVariationPercent < 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                        <TrendingDown className="w-2.5 h-2.5" />
                        <span>{salesVariationPercent.toFixed(1)}%</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-200">
                        <span>= 0.0%</span>
                      </span>
                    )}
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">vs anterior</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
                  <span className="text-[10px] text-slate-500 font-bold">{totalTicketsCount} tickets</span>
                  <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                    Margen: {marginPercent.toFixed(1)}%
                    <div className="group relative inline-block cursor-pointer">
                      <Info className="w-3 h-3 text-slate-400" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-[9px] font-normal py-1 px-2 rounded whitespace-nowrap z-50 shadow-md">
                        Margen calculado con costo actual del producto
                      </div>
                    </div>
                  </span>
                </div>
              </div>

              {/* Card 2: Cuentas por Cobrar */}
              <div 
                onClick={() => setActiveTab('creditos')}
                className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Cuentas por Cobrar</span>
                  <span className="text-sm font-black font-mono text-amber-600">
                    RD$ {totalOutstandingCredit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saldo actual global</span>
                </div>
              </div>

              {/* Card 3: Cuentas por Pagar */}
              <div 
                onClick={() => setActiveTab('cuentas_pagar')}
                className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Cuentas por Pagar</span>
                  <span className="text-sm font-black font-mono text-rose-600 block">
                    RD$ {getTotalPayablesBalance(payables, payablePayments).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab('notas_credito');
                    }}
                    className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors group cursor-pointer"
                    title="Ver Notas de Crédito"
                  >
                    <span>+ Notas de Crédito:</span>
                    <span className="font-mono font-extrabold text-slate-700 group-hover:text-indigo-600">
                      RD$ {activeCreditNotesBalance.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saldo pendiente global</span>
                </div>
              </div>

              {/* Card 4: Egresos */}
              <div 
                onClick={() => onOpenExpenses?.()}
                className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Egresos</span>
                  <span className="text-sm font-black font-mono text-rose-600 block">
                    RD$ {totalExpensesAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-0.5">
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                    <span>Efectivo:</span>
                    <span className="font-mono text-slate-700">${expensesBreakdown.cash.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                    <span>Tarjeta:</span>
                    <span className="font-mono text-slate-700">${expensesBreakdown.card.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                    <span>Transf.:</span>
                    <span className="font-mono text-slate-700">${expensesBreakdown.transfer.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Card 5: Devoluciones */}
              <div 
                onClick={() => setActiveTab('devoluciones')}
                className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Devoluciones</span>
                  <span className="text-sm font-black font-mono text-amber-600">
                    RD$ {totalPendingReturns.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {pendingReturnsCount} pendientes
                  </span>
                </div>
              </div>

              {/* Card 6: Liquidez en Efectivo */}
              <div 
                onClick={() => setIsLiquidityModalOpen(true)}
                className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Liquidez Efectivo</span>
                  <span className="text-sm font-black font-mono text-indigo-600">
                    RD$ {cashLiquidityTotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[9px] text-slate-400 font-medium leading-none block">
                    Resta egresos de caja cerrados
                  </span>
                </div>
              </div>

              {/* Card 7: Liquidez Bancos */}
              <div 
                onClick={() => setActiveTab('bancos')}
                className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Liquidez Bancos</span>
                  <span className="text-sm font-black font-mono text-indigo-600">
                    RD$ {bankLiquidityTotal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[9px] text-slate-400 font-medium leading-none block">
                    Tarjetas confirmadas, transferencias y abonos
                  </span>
                </div>
              </div>

              {/* Card 8: Estado de Resultados */}
              <div 
                onClick={() => setActiveTab('estado_resultados')}
                className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs relative overflow-hidden flex flex-col justify-between cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">Estado de Resultados</span>
                  <span className={`text-sm font-black font-mono block ${plReportData.netOperatingProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    RD$ {plReportData.netOperatingProfit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[9px] text-slate-400 font-medium leading-none block">
                    Utilidad Neta Operativa del período
                  </span>
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recharts BarChart Visualization Card */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                  <div>
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Distribución de Ventas</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Representación gráfica según filtro activo</p>
                  </div>
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 font-mono font-black py-0.5 px-2 rounded-lg border border-indigo-100 uppercase tracking-wider">
                    Métrica en RD$
                  </span>
                </div>

                <div className="h-72 w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="label" stroke="#64748B" fontSize={10} fontWeight="600" tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748B" fontSize={10} fontWeight="600" tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: 'none' }}
                          labelStyle={{ color: '#F8FAFC', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase' }}
                          itemStyle={{ color: '#818CF8', fontSize: '11px' }}
                          formatter={(value: any) => [`RD$ ${parseFloat(value).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`, 'Ventas']}
                        />
                        <Bar dataKey="total" fill="#4F46E5" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill="#4F46E5" className="hover:opacity-85 transition-opacity" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-2xl">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Sin datos de venta para el rango seleccionado</span>
                    </div>
                  )}
                </div>
              </div>

              {/* PieChart: Distribución por Método de Pago */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div>
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Métodos de Pago</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Distribución de ingresos por tipo</p>
                    </div>
                  </div>

                  <div className="h-52 w-full relative flex items-center justify-center">
                    {paymentMethodsData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentMethodsData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {paymentMethodsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1E293B', borderRadius: '12px', border: 'none' }}
                            itemStyle={{ color: '#F8FAFC', fontSize: '11px' }}
                            formatter={(value: any) => [`RD$ ${parseFloat(value).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`, 'Monto']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-2xl">
                        <AlertCircle className="w-6 h-6 text-slate-300" />
                        <span className="text-[10px] font-black uppercase text-slate-400 text-center">Sin ventas registradas</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Legends with explicit RD$ values */}
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-left">
                  {paymentMethodsData.map((item, index) => (
                    <div key={index} className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase truncate">{item.name}</span>
                      </div>
                      <span className="text-xs font-black font-mono text-slate-700 pl-4">
                        RD$ {item.value.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bento Lists Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Panel de Alertas */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs flex flex-col">
                <div className="mb-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Panel de Alertas</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Acciones preventivas requeridas</p>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto">
                  {/* Alert 1: Stock Mínimo */}
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Bajo Stock ({lowStockAlerts.length})</span>
                      {lowStockAlerts.length > 5 && (
                        <button 
                          onClick={() => setShowAllLowStock(!showAllLowStock)}
                          className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline cursor-pointer"
                        >
                          {showAllLowStock ? 'Ver menos' : 'Ver todas'}
                        </button>
                      )}
                    </h4>

                    {lowStockAlerts.length > 0 ? (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {lowStockAlerts.slice(0, showAllLowStock ? undefined : 5).map(p => (
                          <div key={p.id} className="flex items-center justify-between p-2 bg-rose-50 border border-rose-100 rounded-xl">
                            <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{p.name}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Stock:</span>
                              <span className="text-xs font-black text-rose-600 font-mono">{p.stock}</span>
                              <span className="text-[10px] text-slate-400 font-bold font-mono">/ {p.minStock}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-xl text-[10px] font-bold text-slate-400 uppercase text-center border border-dashed border-slate-200">
                        Inventario óptimo
                      </div>
                    )}
                  </div>

                  {/* Alert 2: Exceso de Límite de Crédito */}
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Límite de Crédito Excedido ({overlimitCustomerAlerts.length})</span>
                      {overlimitCustomerAlerts.length > 5 && (
                        <button 
                          onClick={() => setShowAllOverlimit(!showAllOverlimit)}
                          className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline cursor-pointer"
                        >
                          {showAllOverlimit ? 'Ver menos' : 'Ver todas'}
                        </button>
                      )}
                    </h4>

                    {overlimitCustomerAlerts.length > 0 ? (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {overlimitCustomerAlerts.slice(0, showAllOverlimit ? undefined : 5).map(c => (
                          <div key={c.id} className="flex flex-col p-2 bg-amber-50 border border-amber-100 rounded-xl">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{c.name}</span>
                              <span className="text-xs font-black text-amber-600 font-mono">
                                +RD$ {c.exceeded.toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[9px] text-slate-400 font-bold uppercase font-mono">
                              <span>Deuda: RD$ {c.debt.toLocaleString('es-DO', { maximumFractionDigits: 0 })}</span>
                              <span>Límite: RD$ {c.limit.toLocaleString('es-DO', { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-xl text-[10px] font-bold text-slate-400 uppercase text-center border border-dashed border-slate-200">
                        Créditos bajo control
                      </div>
                    )}
                  </div>

                  {/* Alert 3: Cuentas por Vencer/Vencidas */}
                  <div>
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Cuentas por Pagar Alerta ({upcomingPayablesAlerts.length})</span>
                      {upcomingPayablesAlerts.length > 5 && (
                        <button 
                          onClick={() => setShowAllPayablesAlerts(!showAllPayablesAlerts)}
                          className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline cursor-pointer"
                        >
                          {showAllPayablesAlerts ? 'Ver menos' : 'Ver todas'}
                        </button>
                      )}
                    </h4>

                    {upcomingPayablesAlerts.length > 0 ? (
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {upcomingPayablesAlerts.slice(0, showAllPayablesAlerts ? undefined : 5).map(ap => (
                          <div key={ap.id} className={`flex flex-col p-2 rounded-xl border ${
                            ap.isOverdue 
                              ? 'bg-rose-50 border-rose-100' 
                              : 'bg-amber-50 border-amber-100'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{ap.supplierName}</span>
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                ap.isOverdue 
                                  ? 'bg-rose-100 text-rose-700' 
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {ap.isOverdue ? 'VENCIDA' : 'VENCE PRONTO'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[9px] text-slate-500 font-bold uppercase font-mono">
                              <span className="truncate max-w-[130px] font-medium text-slate-600">{ap.concept}</span>
                              <span className="text-slate-800 font-black">RD$ {ap.balance.toLocaleString('es-DO', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5 text-[8px] text-slate-400 font-bold uppercase font-mono">
                              <span>Vence: {ap.dueDate}</span>
                              <span className={ap.isOverdue ? 'text-rose-600 font-black' : 'text-amber-600 font-black'}>
                                {ap.isOverdue ? `Hace ${Math.abs(ap.diffDays)} días` : ap.diffDays === 0 ? 'Hoy' : ap.diffDays === 1 ? 'Mañana' : `En ${ap.diffDays} días`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-xl text-[10px] font-bold text-slate-400 uppercase text-center border border-dashed border-slate-200">
                        Cuentas al día
                      </div>
                    )}
                  </div>

                  {/* Todo en orden state if absolutely no alerts */}
                  {lowStockAlerts.length === 0 && overlimitCustomerAlerts.length === 0 && upcomingPayablesAlerts.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 border border-emerald-150 rounded-3xl text-center">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-2 shadow-xs">
                        <Check className="w-5 h-5 stroke-[3px]" />
                      </div>
                      <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider">Todo en orden</h4>
                      <p className="text-[10px] text-emerald-600 mt-1 uppercase font-bold leading-none">No hay acciones preventivas pendientes</p>
                    </div>
                  )}

                </div>
              </div>

              {/* Top 5 Productos más vendidos */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs flex flex-col">
                <div className="mb-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-500" />
                    <span>Top 5 Más Vendidos</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Mayor volumen en el período</p>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto">
                  {topProductsData.length > 0 ? (
                    topProductsData.slice(0, 5).map((p, idx) => (
                      <div key={p.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 font-mono text-xs font-black text-slate-500 flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-700 block truncate">{p.name}</span>
                            <span className="text-[9px] text-slate-400 font-bold font-mono">{p.qty} unidades vendidas</span>
                          </div>
                        </div>
                        <span className="text-xs font-black font-mono text-slate-800">
                          RD$ {p.total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-2xl p-6">
                      <ShoppingBag className="w-6 h-6 text-slate-300 animate-bounce" />
                      <span className="text-[10px] font-black uppercase text-slate-400 text-center">Sin transacciones en este período</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Productos por vencer pronto */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs flex flex-col">
                <div className="mb-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rose-500" />
                    <span>Vencimiento Próximo</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Caducidad en los próximos 7 días</p>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto">
                  {expiringSoonProducts.length > 0 ? (
                    expiringSoonProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-700 block truncate">{p.name}</span>
                          <span className="text-[9px] text-slate-400 font-bold font-mono uppercase tracking-wider">Vence el: {p.expirationDate}</span>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-xl shadow-2xs font-mono shrink-0 ${
                          p.daysLeft === 0 
                            ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse' 
                            : p.daysLeft === 1 
                            ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                        }`}>
                          {p.daysLeft === 0 ? 'Hoy' : p.daysLeft === 1 ? 'Mañana' : `En ${p.daysLeft} días`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 border-2 border-dashed border-slate-200 rounded-2xl p-6">
                      <Check className="w-6 h-6 text-slate-300" />
                      <span className="text-[10px] font-black uppercase text-slate-400 text-center leading-normal">Sin productos por vencer en 7 días</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* --- VENTAS TAB --- */}
        {activeTab === 'ventas' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {paymentMethodsData.map(method => (
                <div key={method.name} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: method.color }} />
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{method.name}</span>
                  </div>
                  <span className="text-sm font-black font-mono text-slate-800">
                    RD$ {method.value.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              <div className="bg-indigo-600 p-4 rounded-2xl shadow-md text-white flex flex-col justify-center">
                <span className="text-[10px] font-black uppercase opacity-80 tracking-wider">Total del Período</span>
                <span className="text-lg font-black font-mono">
                  RD$ {totalSalesAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Sales Chart */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
              <div className="mb-6">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Tendencia de Ventas Diaria</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Ingresos brutos por fecha</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                      formatter={(v: any) => [`RD$ ${v.toLocaleString()}`, 'Ventas']}
                    />
                    <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Closures List */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Cortes de Caja (Cierres de Turno)</h3>
              {closuresWithSales.length === 0 ? (
                <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl text-slate-400">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-xs font-bold uppercase tracking-wider">No se encontraron cortes de caja en este período</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {closuresWithSales.map(closure => {
                    const isExpanded = expandedClosureId === closure.id;
                    return (
                      <div key={closure.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all">
                        <button 
                          onClick={() => setExpandedClosureId(isExpanded ? null : closure.id)}
                          className="w-full p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                              <Receipt className="w-5 h-5 text-slate-500" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-slate-800 block">
                                {formatSpanishDate(new Date(closure.createdAt || closure.date))}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Cajero: {closure.clerkName}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-6">
                            <div className="text-right">
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Ventas Total</span>
                              <span className="text-sm font-black font-mono text-slate-800">RD$ {closure.actualTotal.toLocaleString()}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] font-black text-slate-400 uppercase block">Diferencia</span>
                              <span className={`text-sm font-black font-mono ${closure.difference < 0 ? 'text-rose-600' : closure.difference > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                RD$ {closure.difference.toLocaleString()}
                              </span>
                            </div>
                            <div className="p-2 text-slate-400">
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-slate-100 animate-slide-down">
                            <div className="mt-4 overflow-x-auto">
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-100">
                                    <th className="py-2 font-black text-slate-400 uppercase tracking-widest">Ticket</th>
                                    <th className="py-2 font-black text-slate-400 uppercase tracking-widest">Hora</th>
                                    <th className="py-2 font-black text-slate-400 uppercase tracking-widest">Método</th>
                                    <th className="py-2 font-black text-slate-400 uppercase tracking-widest text-right">Monto</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {closure.sales.map(sale => (
                                    <tr key={sale.id}>
                                      <td className="py-2 font-bold text-slate-700">{sale.ticketNumber}</td>
                                      <td className="py-2 text-slate-500">{new Date(getSaleTimestamp(sale)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
                                      <td className="py-2">
                                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold uppercase text-[9px]">
                                          {sale.paymentMethod}
                                        </span>
                                      </td>
                                      <td className="py-2 font-mono font-bold text-right">RD$ {sale.total.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- CRÉDITOS TAB --- */}
        {activeTab === 'creditos' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header KPI Card */}
            <div className="bg-rose-600 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xs font-black uppercase opacity-80 tracking-widest mb-2">Cartera de Deuda Total</h3>
                <span className="text-4xl font-black font-mono">
                  RD$ {totalOutstandingCredit.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
                <p className="text-xs mt-4 opacity-70 font-medium">Saldo pendiente global de todos los clientes activos.</p>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ranking de Clientes */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                <div className="mb-6">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Ranking de Deudores</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Clientes con saldo pendiente actual</p>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {customers
                    .map(c => ({ ...c, debt: customerDebts[c.id] || 0 }))
                    .filter(c => c.debt > 0)
                    .sort((a, b) => b.debt - a.debt)
                    .map(c => {
                      const limit = c.creditLimit || 5000;
                      const progress = Math.min(100, (c.debt / limit) * 100);
                      const isOverLimit = c.debt > limit;

                      return (
                        <div key={c.id} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/30">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <span className="text-sm font-black text-slate-800 block">{c.name}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                Límite: RD$ {limit.toLocaleString()}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`text-sm font-black font-mono block ${isOverLimit ? 'text-rose-600' : 'text-slate-800'}`}>
                                RD$ {c.debt.toLocaleString()}
                              </span>
                              <button 
                                onClick={() => onNavigateToCustomer(c.id)}
                                className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline cursor-pointer"
                              >
                                Ver en Clientes
                              </button>
                            </div>
                          </div>
                          
                          <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`absolute inset-y-0 left-0 transition-all duration-1000 rounded-full ${isOverLimit ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-indigo-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          {isOverLimit && (
                            <span className="text-[9px] font-black text-rose-500 uppercase mt-1 block">Excedió el límite por RD$ {(c.debt - limit).toLocaleString()}</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Log de Abonos */}
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                <div className="mb-6">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Últimos Abonos Recibidos</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Registro histórico global</p>
                </div>

                <div className="space-y-3">
                  {customerPayments
                    .sort((a, b) => getSaleTimestamp(b as any) - getSaleTimestamp(a as any))
                    .slice(0, 10)
                    .map(p => {
                      const cust = customers.find(c => c.id === p.customerId);
                      return (
                        <div key={p.id} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                              <Coins className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-slate-800 block">{cust?.name || 'Cliente'}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">
                                {new Date(p.date).toLocaleDateString()} • {p.employeeName || 'Cajero'}
                              </span>
                            </div>
                          </div>
                          <span className="text-sm font-black font-mono text-emerald-600">
                            +RD$ {p.amount.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- CUENTAS POR PAGAR TAB --- */}
        {activeTab === 'cuentas_pagar' && (
          <div className="max-w-7xl mx-auto h-full min-h-[500px]">
            <PayablesView
              products={products}
              payables={payables}
              payablePayments={payablePayments}
              currentEmployee={currentEmployee}
              dashboardConfig={dashboardConfig}
              supplierCreditNotes={supplierCreditNotes}
            />
          </div>
        )}

        {/* --- DEVOLUCIONES TAB --- */}
        {activeTab === 'devoluciones' && (
          <div className="max-w-7xl mx-auto h-full min-h-[500px]">
            <ReturnsView
              products={products}
              supplierReturns={supplierReturns}
              currentEmployee={currentEmployee}
              supplierCreditNotes={supplierCreditNotes}
              payables={payables}
            />
          </div>
        )}

        {/* --- ESTADO DE RESULTADOS TAB --- */}
        {activeTab === 'estado_resultados' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">Estado de Resultados (P&L)</h3>
                  <p className="text-xs text-slate-400">Análisis detallado de ingresos, costos y utilidad operativa del período seleccionado</p>
                </div>
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                >
                  <FileBarChart className="w-4 h-4" />
                  <span>Exportar a Excel</span>
                </button>
              </div>

              {/* Main Report Body */}
              <div className="mt-6 space-y-6">
                
                {/* Ingresos & Costos Section */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">Estructura Operativa</span>
                  
                  {/* Ingresos por Ventas */}
                  <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Ingresos por Ventas</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Suma sin ITBIS. Incluye artículos Genéricos</span>
                    </div>
                    <span className="text-sm font-black font-mono text-slate-800">
                      RD$ {plReportData.totalSalesPreTax.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Costo de Mercancía Vendida */}
                  <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">(-) Costo de Mercancía Vendida (CMV)</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Excluye artículos de categoría 'Genérico'</span>
                    </div>
                    <span className="text-sm font-black font-mono text-slate-800">
                      RD$ {plReportData.totalCOGS.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Utilidad Bruta */}
                  <div className="flex justify-between items-center py-3.5 px-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
                    <span className="text-xs font-black text-indigo-900 uppercase tracking-wide">= Utilidad Bruta</span>
                    <span className="text-base font-black font-mono text-indigo-950">
                      RD$ {plReportData.grossProfit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Gastos & Utilidad Neta Section */}
                <div className="space-y-3">
                  {/* Gastos Operativos */}
                  <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wide">(-) Gastos Operativos</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Egresos operativos del período</span>
                    </div>
                    <span className="text-sm font-black font-mono text-slate-800">
                      RD$ {plReportData.operationalExpenses.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Utilidad Neta Operativa */}
                  <div className={`flex justify-between items-center py-4 px-4 rounded-2xl border ${
                    plReportData.netOperatingProfit >= 0 
                      ? 'bg-emerald-50/30 border-emerald-100/80' 
                      : 'bg-rose-50/30 border-rose-100/80'
                  }`}>
                    <div className="flex flex-col">
                      <span className={`text-sm font-black uppercase tracking-wide ${
                        plReportData.netOperatingProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'
                      }`}>
                        = Utilidad Neta Operativa
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Resultado del ejercicio del negocio</span>
                    </div>
                    <span className={`text-lg font-black font-mono ${
                      plReportData.netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      RD$ {plReportData.netOperatingProfit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Gastos Personales Box (Separated, grey, informative) */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Gastos Personales del Período</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Suma de egresos no operativos</span>
                    </div>
                    <span className="text-sm font-black font-mono text-slate-600">
                      RD$ {plReportData.personalExpenses.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold leading-normal border-t border-slate-200/60 pt-2 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>Nota: Estos egresos están marcados como no operativos y son de carácter personal del dueño. No afectan la Utilidad Neta Operativa del negocio mostrada arriba, sirviendo únicamente como dato informativo.</span>
                  </div>
                </div>

                {/* Saldos Pendientes (Reference) */}
                <div className="border-t border-slate-200/80 pt-5 space-y-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">Saldos Pendientes (A la fecha de hoy)</span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase leading-normal">Referencia de posición financiera global, independiente del filtro de tiempo.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cuentas por Cobrar */}
                    <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50/30 rounded-xl border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Cuentas por Cobrar Totales</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Deuda acumulada de clientes</span>
                      </div>
                      <span className="text-xs font-black font-mono text-amber-600">
                        RD$ {totalOutstandingCredit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Cuentas por Pagar */}
                    <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50/30 rounded-xl border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Cuentas por Pagar Totales</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Deuda pendiente con proveedores</span>
                      </div>
                      <span className="text-xs font-black font-mono text-rose-600">
                        RD$ {getTotalPayablesBalance(payables, payablePayments).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* --- BANCOS TAB --- */}
        {activeTab === 'bancos' && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Top Summaries / KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Conciliado en Banco */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Monto Conciliado en Banco</span>
                  <span className="text-xl font-black font-mono text-emerald-600">
                    RD$ {cardDeposits
                      .filter(d => d.status === 'confirmed')
                      .reduce((acc, d) => acc + (d.confirmedAmount ?? d.netAmount), 0)
                      .toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    Total neto real depositado y verificado.
                  </span>
                </div>
              </div>

              {/* Card 2: Pendiente de Tránsito */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Pendiente en Tránsito</span>
                  <span className="text-xl font-black font-mono text-amber-500">
                    RD$ {cardDeposits
                      .filter(d => d.status === 'pending')
                      .reduce((acc, d) => acc + d.netAmount, 0)
                      .toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    Ventas con tarjeta estimadas a ingresar el próximo día hábil.
                  </span>
                </div>
              </div>

              {/* Card 3: Comisión Total Pagada */}
              <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Comisiones Acumuladas</span>
                  <span className="text-xl font-black font-mono text-rose-500">
                    RD$ {cardDeposits
                      .reduce((acc, d) => acc + (d.grossAmount - d.netAmount), 0)
                      .toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    Tasa estándar de tarjetas descontada del bruto.
                  </span>
                </div>
              </div>
            </div>

            {/* Main List Table */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight">Depósitos de Tarjeta</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Control de acreditaciones bancarias y comisiones</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase bg-slate-50/50">
                      <th className="py-3 px-4">Fecha Lote</th>
                      <th className="py-3 px-4">Fecha Esperada</th>
                      <th className="py-3 px-4 text-right">Monto Bruto</th>
                      <th className="py-3 px-4 text-right">Comisión (%)</th>
                      <th className="py-3 px-4 text-right">Monto Neto Est.</th>
                      <th className="py-3 px-4 text-right">Monto Real Dep.</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardDeposits.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-xs text-slate-400 font-medium italic">
                          No hay depósitos de tarjetas registrados. Realiza ventas con tarjeta para generarlos.
                        </td>
                      </tr>
                    ) : (
                      [...cardDeposits]
                        .sort((a, b) => a.expectedDepositDate.localeCompare(b.expectedDepositDate))
                        .map((deposit) => {
                          const displayBatch = deposit.batchDate.split('-').reverse().join('/');
                          const displayExpected = deposit.expectedDepositDate.split('-').reverse().join('/');
                          return (
                            <tr key={deposit.id} className="border-b border-slate-100 hover:bg-slate-50/55 transition-colors text-xs font-semibold text-slate-700">
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{displayBatch}</td>
                              <td className="py-3.5 px-4 font-mono">{displayExpected}</td>
                              <td className="py-3.5 px-4 text-right font-mono">RD$ {deposit.grossAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3.5 px-4 text-right text-rose-500 font-mono">-{deposit.feePercent}%</td>
                              <td className="py-3.5 px-4 text-right font-mono text-indigo-600">RD$ {deposit.netAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3.5 px-4 text-right font-mono text-emerald-600">
                                {deposit.status === 'confirmed' 
                                  ? `RD$ ${(deposit.confirmedAmount ?? deposit.netAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`
                                  : '—'}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider inline-block ${
                                  deposit.status === 'confirmed'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {deposit.status === 'confirmed' ? 'Confirmado' : 'Pendiente'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {deposit.status === 'pending' ? (
                                  permissions.confirmBankDeposits ? (
                                    <button
                                      onClick={() => {
                                        setConfirmingDeposit(deposit);
                                        setConfirmedAmountInput(deposit.netAmount.toString());
                                      }}
                                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase rounded-lg transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                                    >
                                      <Check className="w-3 h-3" /> Confirmar
                                    </button>
                                  ) : (
                                    <span className="text-xs text-slate-400 font-medium">Pendiente</span>
                                  )
                                ) : (
                                  <div className="text-[10px] text-slate-400 block font-normal leading-normal">
                                    <span className="font-bold">{deposit.confirmedByEmployeeName || 'Cajero'}</span>
                                    <br />
                                    {new Date(deposit.confirmedAt!).toLocaleDateString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Deposit Confirmation Modal dialog */}
        {confirmingDeposit && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-scale-up m-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-indigo-600" />
                  Confirmar Depósito Bancario
                </h3>
                <button
                  onClick={() => setConfirmingDeposit(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha Lote</span>
                    <span className="text-slate-700 font-mono font-bold">{confirmingDeposit.batchDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha Esperada</span>
                    <span className="text-slate-700 font-mono font-bold">{confirmingDeposit.expectedDepositDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Monto Bruto</span>
                    <span className="text-slate-700 font-mono">RD$ {confirmingDeposit.grossAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Comisión ({confirmingDeposit.feePercent}%)</span>
                    <span className="text-slate-700 font-mono">RD$ {roundCents(confirmingDeposit.grossAmount * confirmingDeposit.feePercent / 100).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block">Monto Neto Calculado</label>
                  <span className="text-lg font-black font-mono text-indigo-600 block">
                    RD$ {confirmingDeposit.netAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Monto Depositado Real (Banco)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">RD$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={confirmedAmountInput}
                      onChange={(e) => setConfirmedAmountInput(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">Ajusta este monto si el banco depositó una cantidad diferente por retenciones o comisiones reales.</p>
                </div>
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmingDeposit(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const amount = parseFloat(confirmedAmountInput);
                    if (isNaN(amount) || amount <= 0) {
                      showAlert('Por favor introduce un monto de depósito válido.');
                      return;
                    }
                    try {
                      const updatedDeposit: Partial<CardDeposit> = {
                        status: 'confirmed',
                        confirmedAmount: amount,
                        confirmedAt: new Date().toISOString(),
                        confirmedByEmployeeId: currentEmployee?.id || 'unknown',
                        confirmedByEmployeeName: currentEmployee?.name || 'Cajero'
                      };
                      await firestoreService.updateDoc('cardDeposits', confirmingDeposit.id, updatedDeposit);
                      setConfirmingDeposit(null);
                      showAlert('Depósito confirmado y conciliado con éxito.');
                    } catch (err) {
                      console.error('Error confirming deposit:', err);
                      showAlert('Hubo un error al confirmar el depósito.');
                    }
                  }}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" /> Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- EMPLEADOS TAB --- */}
        {activeTab === 'empleados' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Section: Turnos Abiertos (Admin only) */}
            {canManageEmployees && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Panel: Turnos Abiertos */}
                <div className="bg-white border border-slate-200 rounded-3xl shadow-xs p-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      Turnos Abiertos Actualmente
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Empleados activos con ventas desde su último corte</p>
                  </div>

                  {openShifts.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-medium">
                      No hay turnos abiertos con ventas registradas en este momento.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                      {openShifts.map(shift => {
                        const elapsedMs = Date.now() - shift.firstSaleTime;
                        const elapsedMinutes = Math.floor(elapsedMs / 60000);
                        let elapsedStr = `${elapsedMinutes} min`;
                        if (elapsedMinutes >= 60) {
                          const elapsedHours = Math.floor(elapsedMinutes / 60);
                          if (elapsedHours >= 24) {
                            elapsedStr = `${Math.floor(elapsedHours / 24)} días y ${elapsedHours % 24} hrs`;
                          } else {
                            elapsedStr = `${elapsedHours} hrs y ${elapsedMinutes % 60} min`;
                          }
                        }

                        return (
                          <div key={shift.employee.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                            <div>
                              <span className="text-sm font-black text-slate-800 block">{shift.employee.name}</span>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-bold uppercase">
                                <span>Abierto hace {elapsedStr}</span>
                                <span>•</span>
                                <span>Régimen: {shift.employee.role}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <span className="text-[10px] text-slate-450 font-bold uppercase block">Esperado Neto</span>
                                <span className="text-sm font-black font-mono text-slate-800">RD$ {shift.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                              </div>

                              <button
                                onClick={() => handleCloseShiftAdmin(shift)}
                                className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs uppercase tracking-wider"
                              >
                                Cerrar (Admin)
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Panel: Cierres Pendientes de Contar */}
                <div className="bg-white border border-slate-200 rounded-3xl shadow-xs p-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      Cierres Pendientes de Conteo
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Cortes administrativos que requieren conteo físico de caja</p>
                  </div>

                  {pendingClosures.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-medium">
                      No hay cierres pendientes de conteo físico en este momento.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                      {pendingClosures.map(closure => (
                        <div key={closure.id} className="py-4 first:pt-0 last:pb-0">
                          {editingClosure?.id === closure.id ? (
                            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-slate-800">Registrar Arqueo: {closure.clerkName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{new Date(closure.createdAt || closure.date).toLocaleString()}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Efectivo Esperado</span>
                                  <span className="font-bold text-slate-800 font-mono">RD$ {closure.expectedCash.toFixed(2)}</span>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Efectivo Real Contado ($)</label>
                                  <input
                                    type="number"
                                    value={actualCashInput}
                                    onChange={(e) => setActualCashInput(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-250 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                    placeholder="0.00"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 text-xs">
                                <button
                                  onClick={() => setEditingClosure(null)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg font-bold cursor-pointer transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={handleSavePendingClosure}
                                  disabled={savingPendingClosure}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black cursor-pointer transition-colors shadow-sm"
                                >
                                  {savingPendingClosure ? 'Guardando...' : 'Guardar Conteo'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <span className="text-sm font-black text-slate-800 block">{closure.clerkName}</span>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-bold uppercase">
                                  <span>Corte: {new Date(closure.createdAt || closure.date).toLocaleDateString()}</span>
                                  <span>•</span>
                                  <span>Estimado por: {closure.closedByAdminName || 'Admin'}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-450 font-bold uppercase block">Monto Esperado</span>
                                  <span className="text-sm font-black font-mono text-indigo-600">RD$ {closure.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                                </div>

                                <button
                                  onClick={() => handleEditPendingClosure(closure)}
                                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs uppercase tracking-wider"
                                >
                                  Contar Caja
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Existing Employee Stats Table */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Empleado</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Tickets</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Venta Total</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Promedio Ticket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employeeStats.map((emp, idx) => {
                    const avg = emp.tickets > 0 ? emp.total / emp.tickets : 0;
                    const isExpanded = expandedEmployeeId === emp.id;
                    return (
                      <React.Fragment key={emp.id}>
                        <tr 
                          onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                          className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                                  <User className="w-5 h-5 text-slate-400" />
                                </div>
                                {idx < 3 && (
                                  <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm border border-white ${
                                    idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-300' : 'bg-orange-600'
                                  }`}>
                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                                  </div>
                                )}
                              </div>
                              <div>
                                <span className="text-sm font-black text-slate-800 block">{emp.name}</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{emp.role}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-black font-mono text-slate-700">{emp.tickets}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-black font-mono text-indigo-600">
                              RD$ {emp.total.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-black font-mono text-slate-600">
                              RD$ {avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={4} className="px-6 pb-6 pt-2 bg-slate-50/30">
                              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-inner">
                                <div className="mb-4 flex items-center justify-between">
                                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tendencia de Venta Individual (Últimos 6 meses)</h4>
                                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div className="h-40">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={getEmployeeTrend(emp.id)}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                      <XAxis dataKey="label" fontSize={9} axisLine={false} tickLine={false} />
                                      <YAxis fontSize={9} axisLine={false} tickLine={false} />
                                      <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                                        formatter={(v: any) => [`RD$ ${v.toLocaleString()}`, 'Ventas']}
                                      />
                                      <Bar dataKey="total" fill="#6366f1" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- INVENTARIO TAB --- */}
        {activeTab === 'inventario' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor del Inventario</h3>
                </div>
                <span className="text-2xl font-black font-mono text-slate-800">
                  RD$ {inventoryStats.totalValue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Costo total de existencias</p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Bajo</h3>
                </div>
                <span className="text-2xl font-black font-mono text-amber-600">
                  {inventoryStats.lowStockCount}
                </span>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Productos bajo el mínimo</p>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin Existencia</h3>
                </div>
                <span className="text-2xl font-black font-mono text-rose-600">
                  {inventoryStats.outOfStockCount}
                </span>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Productos con stock 0 o menor</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ABC Classification Summary */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                  <div className="mb-6">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Clasificación ABC</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Basado en ventas (90 días)</p>
                  </div>

                  <div className="space-y-4">
                    {['A', 'B', 'C'].map((cls) => {
                      const data = inventoryStats.abcSummary[cls as 'A' | 'B' | 'C'];
                      const pctOfValue = inventoryStats.totalValue > 0 ? (data.value / inventoryStats.totalValue) * 100 : 0;
                      return (
                        <div key={cls} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/30">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white ${
                                cls === 'A' ? 'bg-emerald-500' : cls === 'B' ? 'bg-amber-500' : 'bg-slate-400'
                              }`}>
                                {cls}
                              </span>
                              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                                Clase {cls} ({data.count} prod.)
                              </span>
                            </div>
                            <span className="text-xs font-black font-mono text-slate-800">
                              {pctOfValue.toFixed(1)}% val.
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${
                                cls === 'A' ? 'bg-emerald-500' : cls === 'B' ? 'bg-amber-500' : 'bg-slate-400'
                              }`}
                              style={{ width: `${pctOfValue}%` }}
                            />
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">
                            {cls === 'A' ? 'Alta rotación (80% ventas)' : cls === 'B' ? 'Rotación media (15% ventas)' : 'Baja rotación (5% ventas)'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Inventory Value by Category */}
                <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
                  <div className="mb-6">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Valor por Categoría</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Distribución del capital</p>
                  </div>
                  <div className="space-y-3">
                    {inventoryStats.categoryValues.slice(0, 5).map((cat, idx) => {
                      const pct = inventoryStats.totalValue > 0 ? (cat.value / inventoryStats.totalValue) * 100 : 0;
                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                            <span className="text-slate-500 truncate max-w-[150px]">{cat.name}</span>
                            <span className="text-slate-800">RD$ {cat.value.toLocaleString()}</span>
                          </div>
                          <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ABC Product Table */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Catálogo y Clasificación ABC</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Análisis de rentabilidad y stock</p>
                </div>
                <div className="overflow-x-auto flex-1 max-h-[600px]">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Clase</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Venta (90d)</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Stock</th>
                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {inventoryStats.abcProducts.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{p.emoji}</span>
                              <div>
                                <span className="text-xs font-black text-slate-800 block">{p.name}</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase">{p.category}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black text-white ${
                              p.abcClass === 'A' ? 'bg-emerald-500' : p.abcClass === 'B' ? 'bg-amber-500' : 'bg-slate-400'
                            }`}>
                              {p.abcClass}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-[11px] font-black font-mono text-slate-700">RD$ {p.revenue.toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className={`text-[11px] font-black font-mono ${p.stock <= (p.minStock || 0) ? 'text-rose-600' : 'text-slate-700'}`}>
                              {p.stock}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-[11px] font-black font-mono text-slate-500">
                              RD$ {(p.stock * (p.cost || 0)).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Critical Stock List */}
            <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Productos en Alerta de Stock</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Bajo el mínimo establecido</p>
                </div>
                <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {inventoryStats.criticalProducts.length} Alertas
                </div>
              </div>

              {inventoryStats.criticalProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl">
                  <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Todo en orden • Stock suficiente</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventoryStats.criticalProducts.map(p => (
                    <div key={p.id} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p.emoji}</span>
                        <div>
                          <span className="text-xs font-black text-slate-800 block truncate max-w-[120px]">{p.name}</span>
                          <span className="text-[10px] font-black text-rose-500 uppercase">Stock: {p.stock} / Mín: {p.minStock}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => onNavigateToProduct(p.id)}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        Reabastecer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- NOTAS DE CRÉDITO TAB --- */}
        {activeTab === 'notas_credito' && (() => {
          const totalActiveBalance = creditNotes
            .filter(cn => cn.status === 'active')
            .reduce((sum, cn) => sum + (cn.remainingBalance || 0), 0);
          const totalCreatedCount = creditNotes.length;
          const activeCount = creditNotes.filter(cn => cn.status === 'active').length;
          const depletedCount = creditNotes.filter(cn => cn.status === 'depleted').length;
          const voidedCount = creditNotes.filter(cn => cn.status === 'voided').length;

          const filteredNotes = creditNotes.filter(cn => {
            const codeMatch = cn.code.toLowerCase().includes(creditNoteSearch.toLowerCase()) ||
              (cn.employeeName || '').toLowerCase().includes(creditNoteSearch.toLowerCase());
            const statusMatch = creditNoteStatusFilter === 'all' || cn.status === creditNoteStatusFilter;
            return codeMatch && statusMatch;
          });

          return (
            <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    🏷️ Notas de Crédito
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Gestión de notas de crédito emitidas por devoluciones y saldo disponible para canje en ventas.
                  </p>
                </div>
              </div>

              {/* Top Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-black uppercase tracking-wider">Saldo Total Disponible</span>
                    <Receipt className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black font-mono text-indigo-600">
                    RD$ {totalActiveBalance.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Monto pendiente de canje en ventas.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-black uppercase tracking-wider">Notas Creadas</span>
                    <Package className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-800">
                    {totalCreatedCount} <span className="text-xs font-bold text-slate-400">notas</span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Historial total de emisiones.
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-black uppercase tracking-wider">Estado de Notas</span>
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Activas"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400" title="Agotadas"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300" title="Anuladas"></span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xl font-black text-emerald-600">{activeCount} <span className="text-[10px] font-bold text-emerald-700">Activas</span></span>
                    <span className="text-sm font-bold text-slate-300">/</span>
                    <span className="text-lg font-bold text-slate-600">{depletedCount} <span className="text-[10px] font-semibold text-slate-500">Agotadas</span></span>
                    <span className="text-sm font-bold text-slate-300">/</span>
                    <span className="text-lg font-bold text-slate-500">{voidedCount} <span className="text-[10px] font-semibold text-slate-400">Anuladas</span></span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Proporción del estado de las notas.
                  </p>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    placeholder="Buscar por código de nota o empleado..."
                    value={creditNoteSearch}
                    onChange={(e) => setCreditNoteSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  {(['all', 'active', 'depleted', 'voided'] as const).map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setCreditNoteStatusFilter(status)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        creditNoteStatusFilter === status
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {status === 'all' && 'Todas'}
                      {status === 'active' && 'Activas'}
                      {status === 'depleted' && 'Agotadas'}
                      {status === 'voided' && 'Anuladas'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Credit Notes Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                {filteredNotes.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <p className="text-sm font-bold text-slate-600">No se encontraron notas de crédito</p>
                    <p className="text-xs text-slate-400">
                      {creditNoteSearch || creditNoteStatusFilter !== 'all'
                        ? 'Pruebe ajustando los filtros de búsqueda.'
                        : 'Las notas de crédito aparecerán aquí al emitirse en devoluciones.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          <th className="py-3 px-4">Código</th>
                          <th className="py-3 px-4">Monto Original</th>
                          <th className="py-3 px-4">Saldo Disponible</th>
                          <th className="py-3 px-4">Estado</th>
                          <th className="py-3 px-4">Empleado</th>
                          <th className="py-3 px-4">Fecha de Emisión</th>
                          {permissions.manageReturns && <th className="py-3 px-4 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                        {filteredNotes.map((note) => (
                          <tr key={note.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-black text-indigo-600 text-sm">
                              {note.code}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                              RD$ {note.originalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-600">
                              RD$ {note.remainingBalance.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-4">
                              {note.status === 'active' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Activa
                                </span>
                              )}
                              {note.status === 'depleted' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Agotada
                                </span>
                              )}
                              {note.status === 'voided' && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-300 w-fit">
                                    <Ban className="w-3 h-3 text-slate-400" />
                                    <span className="line-through">Anulada</span>
                                  </span>
                                  {note.voidReason && (
                                    <span className="text-[10px] text-slate-500 font-normal italic truncate max-w-[160px]" title={note.voidReason}>
                                      Motivo: {note.voidReason}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-600">
                              {note.employeeName || 'Sistema'}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-500">
                              {note.createdAt ? new Date(note.createdAt).toLocaleString('es-DO') : '—'}
                            </td>
                            {permissions.manageReturns && (
                              <td className="py-3.5 px-4 text-right">
                                {note.status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNoteToVoid(note);
                                      setVoidReasonInput('');
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    Anular
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      </div>

      {/* Detalle de Liquidez en Efectivo Modal */}
      {isLiquidityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[85vh] animate-scale-up">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-2.5">
                <Coins className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Detalle de Liquidez en Efectivo</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Monto en caja de turnos ya cerrados</p>
                </div>
              </div>
              <button
                onClick={() => setIsLiquidityModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Sección Entradas (emerald) */}
              <div>
                <h4 className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  Entradas (Ventas en Efectivo)
                </h4>
                {cashLiquidityDetail.entries.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-2">Sin movimientos</p>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {cashLiquidityDetail.entries.map((entry, index) => (
                      <div key={index} className="px-4 py-3 bg-white flex items-center justify-between text-xs font-medium">
                        <div className="flex flex-col">
                          <span className="text-slate-700 font-bold capitalize">{entry.dateStr}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{entry.count} {entry.count === 1 ? 'venta' : 'ventas'}</span>
                        </div>
                        <span className="font-mono font-black text-emerald-600">
                          +RD$ {entry.total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sección Salidas (rose) */}
              <div>
                <h4 className="text-xs font-black text-rose-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  Salidas (Egresos en Efectivo)
                </h4>
                {cashLiquidityDetail.exits.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-2">Sin movimientos</p>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {cashLiquidityDetail.exits.map((exit) => (
                      <div key={exit.id} className="px-4 py-3 bg-white flex items-center justify-between text-xs font-medium">
                        <div className="flex flex-col max-w-[70%]">
                          <span className="text-slate-700 font-bold capitalize">{exit.dateStr}</span>
                          <span className="text-[10px] text-slate-500 font-semibold truncate" title={exit.concept}>{exit.concept}</span>
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider">Registrado por: {exit.registeredBy}</span>
                        </div>
                        <span className="font-mono font-black text-rose-600 whitespace-nowrap">
                          -RD$ {exit.amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sección Reembolsos a Clientes (rose) */}
              <div>
                <h4 className="text-xs font-black text-rose-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  Reembolsos a Clientes (Efectivo)
                </h4>
                {cashLiquidityDetail.refunds.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-2">Sin movimientos</p>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {cashLiquidityDetail.refunds.map((refund, index) => (
                      <div key={index} className="px-4 py-3 bg-white flex items-center justify-between text-xs font-medium">
                        <div className="flex flex-col">
                          <span className="text-slate-700 font-bold capitalize">{refund.dateStr}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{refund.count} {refund.count === 1 ? 'devolución' : 'devoluciones'}</span>
                        </div>
                        <span className="font-mono font-black text-rose-600">
                          -RD$ {refund.total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Footer / Pie */}
            <div className="p-5 border-t border-slate-100 bg-slate-50">
              <div className="space-y-1.5 text-xs text-slate-500 font-semibold">
                <div className="flex justify-between">
                  <span>Total Entradas:</span>
                  <span className="font-mono text-emerald-600">+RD$ {cashLiquidityDetail.totalEntries.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Salidas:</span>
                  <span className="font-mono text-rose-600">-RD$ {cashLiquidityDetail.totalExits.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Reembolsos:</span>
                  <span className="font-mono text-rose-600">-RD$ {cashLiquidityDetail.totalRefunds.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                  <span className="uppercase tracking-tight">Liquidez en Efectivo:</span>
                  <span className="font-mono text-indigo-600">RD$ {cashLiquidityDetail.totalLiquidity.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <button
                onClick={() => setIsLiquidityModalOpen(false)}
                className="mt-4 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors shadow-sm cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Anular Nota de Crédito Modal */}
      {noteToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in text-slate-800">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col animate-scale-up">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Anular Nota de Crédito</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Código: {noteToVoid.code}</p>
                </div>
              </div>
              <button
                onClick={() => { setNoteToVoid(null); setVoidReasonInput(''); }}
                className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const reason = voidReasonInput.trim();
                if (!reason) {
                  await showAlert('Motivo obligatorio', 'Debe ingresar un motivo para anular la nota de crédito.', 'warning');
                  return;
                }

                const confirmed = await showConfirm(
                  'Confirmar Anulación de Nota',
                  `¿Está seguro de anular la nota de crédito ${noteToVoid.code} con saldo disponible de RD$ ${noteToVoid.remainingBalance.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}?`
                );

                if (!confirmed) return;

                try {
                  const updatedNote: CreditNote = {
                    ...noteToVoid,
                    status: 'voided',
                    voidReason: reason,
                    voidedAt: new Date().toISOString(),
                    voidedByEmployeeId: currentEmployee?.id || '',
                    voidedByEmployeeName: currentEmployee?.name || 'Sistema'
                  };

                  await firestoreService.setDocWithId('creditNotes', updatedNote.id, updatedNote);

                  setNoteToVoid(null);
                  setVoidReasonInput('');
                  await showAlert('Nota Anulada', `La nota de crédito ${updatedNote.code} ha sido anulada con éxito.`, 'success');
                } catch (err) {
                  console.error('Error voiding credit note:', err);
                  await showAlert('Error', 'No se pudo anular la nota de crédito. Intente nuevamente.', 'error');
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs space-y-1">
                <div className="flex justify-between font-bold text-slate-700">
                  <span>Monto Original:</span>
                  <span>RD$ {noteToVoid.originalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-black text-indigo-600">
                  <span>Saldo Disponible:</span>
                  <span>RD$ {noteToVoid.remainingBalance.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1.5">
                  Motivo de Anulación <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Ej. Error al imprimir, nota extraviada..."
                  value={voidReasonInput}
                  onChange={(e) => setVoidReasonInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white placeholder-slate-400"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Al anular esta nota, se dejará rastro y no podrá volver a ser utilizada ni canjeada en ventas.
              </p>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setNoteToVoid(null); setVoidReasonInput(''); }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Anular Nota
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
