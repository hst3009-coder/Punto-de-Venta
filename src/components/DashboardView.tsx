import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Product, Sale, Customer, CustomerPayment, Employee, Closure, Movement, AccountPayable, PayablePayment, CardDeposit, DashboardConfig, SupplierReturn, CustomerRefund, CreditNote, SupplierCreditNote, AuditLogEntry } from '../types';
import { getCustomerDebt } from '../lib/customerDebt';
import { getPayableBalance, getTotalPayablesBalance } from '../lib/payableDebt';
import { getNextBusinessDay } from '../lib/businessDays';
import { isProductBelowTargetProfit } from '../lib/money';
import { getStringValue } from '../lib/normalize';
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
  Ban,
  Search,
  Printer,
  RotateCcw
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
import { usePermissions } from '../hooks/usePermissions';
import { firestoreService } from '../lib/firebase';

function lazyWithRetry(componentImport: () => Promise<any>, exportName?: string) {
  return React.lazy(async () => {
    try {
      const m = await componentImport();
      return { default: exportName ? m[exportName] : (m.default || m) };
    } catch (error) {
      console.warn('Dynamic import failed, retrying...', error);
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const m = await componentImport();
        return { default: exportName ? m[exportName] : (m.default || m) };
      } catch (retryErr) {
        throw retryErr;
      }
    }
  });
}

const ResumenTab = lazyWithRetry(() => import('./dashboard/ResumenTab'), 'ResumenTab');
const VentasTab = lazyWithRetry(() => import('./dashboard/VentasTab'), 'VentasTab');
const CreditosTab = lazyWithRetry(() => import('./dashboard/CreditosTab'), 'CreditosTab');
const InventarioTab = lazyWithRetry(() => import('./dashboard/InventarioTab'), 'InventarioTab');
const EmpleadosTab = lazyWithRetry(() => import('./dashboard/EmpleadosTab'), 'EmpleadosTab');
const PayablesTab = lazyWithRetry(() => import('./dashboard/PayablesTab'), 'PayablesTab');
const DevolucionesTab = lazyWithRetry(() => import('./dashboard/DevolucionesTab'), 'DevolucionesTab');
const BancosTab = lazyWithRetry(() => import('./dashboard/BancosTab'), 'BancosTab');
const NotasCreditoTab = lazyWithRetry(() => import('./dashboard/NotasCreditoTab'), 'NotasCreditoTab');
const EstadoResultadosTab = lazyWithRetry(() => import('./dashboard/EstadoResultadosTab'), 'EstadoResultadosTab');
const EgresosTab = lazyWithRetry(() => import('./dashboard/EgresosTab'), 'EgresosTab');

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

type DashboardTab = 'resumen' | 'ventas' | 'creditos' | 'cuentas_pagar' | 'bancos' | 'inventario' | 'devoluciones' | 'notas_credito' | 'estado_resultados' | 'empleados' | 'egresos';

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
  const [selectedClosureModal, setSelectedClosureModal] = useState<Closure | null>(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [isLiquidityModalOpen, setIsLiquidityModalOpen] = useState(false);

  // Credit notes tab filter states
  const [creditNoteSearch, setCreditNoteSearch] = useState('');
  const [creditNoteStatusFilter, setCreditNoteStatusFilter] = useState<'all' | 'active' | 'depleted' | 'voided'>('all');
  const [noteToVoid, setNoteToVoid] = useState<CreditNote | null>(null);
  const [voidReasonInput, setVoidReasonInput] = useState('');

  // Credit Note Lookup Modal state (Query only)
  const [isQueryCreditNoteOpen, setIsQueryCreditNoteOpen] = useState(false);
  const [queryCreditNoteCode, setQueryCreditNoteCode] = useState('');
  const [queryCreditNoteResult, setQueryCreditNoteResult] = useState<CreditNote | 'not_found' | null>(null);

  const isProcessingRef = useRef(false);

  // --- Auto-create CardDeposit entries for card sales ---
  useEffect(() => {
    if (!isOpen || sales.length === 0) return;

    const generateMissingCardDeposits = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
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

        await firestoreService.runBatch(ops);
        console.log(`Auto-processed ${ops.length} card deposit operations.`);
      } catch (err) {
        console.error('Error auto-processing card deposits:', err);
      } finally {
        isProcessingRef.current = false;
      }
    };

    generateMissingCardDeposits();
  }, [isOpen, sales, cardDeposits, dashboardConfig]);

  // --- Admin Closure States and Helpers ---
  const [editingClosure, setEditingClosure] = useState<Closure | null>(null);
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [savingPendingClosure, setSavingPendingClosure] = useState(false);

  const permissions = usePermissions(currentEmployee);
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
          const source = m.source ?? 'shift';
          if (source !== 'shift') return false;
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

      // Audit Log for closing shift admin
      try {
        const auditData: Omit<AuditLogEntry, 'id'> = {
          action: 'close_shift_admin',
          description: `Cerró el turno de ${shift.employee.name} (pendiente de contar)`,
          employeeId: currentEmployee?.id || '',
          employeeName: currentEmployee?.name || 'Administrador',
          targetEmployeeId: shift.employee.id,
          createdAt: new Date().toISOString()
        };
        await firestoreService.addDoc('auditLogs', auditData);
      } catch (auditErr) {
        console.error('Error recording audit log for close_shift_admin:', auditErr);
      }

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

    // Reste los egresos en efectivo que ocurrieron ANTES de un corte (o egresos directos de dashboard que restan de inmediato)
    const cashExpenses = movements.filter(m => m.type === 'out' && m.paymentMethod === 'cash');
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
        name: labels[key] || String(key),
        value: Number(value || 0),
        color: colors[key] || '#94A3B8'
      }))
      .filter(item => item.value > 0);
  }, [filteredSales]);

  // --- 2. ALERT PANEL DATA ---
  const lowStockAlerts = useMemo(() => {
    return products
      .filter(p => {
        const stock = Number(p.stock || 0);
        const minStock = p.minStock !== undefined ? Number(p.minStock) : 0;
        return (minStock > 0 && stock <= minStock) || stock <= 0;
      })
      .map(p => ({
        id: String(p.id || ''),
        name: getStringValue(p.name, 'Sin nombre'),
        stock: Number(p.stock || 0),
        minStock: p.minStock !== undefined ? Number(p.minStock) : 0
      }));
  }, [products]);

  const overlimitCustomerAlerts = useMemo(() => {
    return customers
      .map(c => {
        const debt = Number(customerDebts[c.id] || 0);
        const limit = Number(c.creditLimit || 0);
        const exceeded = debt - limit;
        return {
          id: String(c.id || ''),
          name: getStringValue(c.name, 'Sin nombre'),
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
          isSoon: diffDays <= 5
        };
      })
      .filter(item => item.balance > 0 && (item.isOverdue || item.isSoon))
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [payables, payablePayments]);

  const [showAllPayablesAlerts, setShowAllPayablesAlerts] = useState(false);

  const [showAllLowMargin, setShowAllLowMargin] = useState(false);
  const lowMarginAlerts = useMemo(() => {
    const targets = (dashboardConfig as DashboardConfig)?.categoryProfitTargets;
    return products
      .map(p => {
        const info = isProductBelowTargetProfit(p, targets);
        const catStr = getStringValue(p.category, 'Sin categoría');
        return {
          id: String(p.id || ''),
          name: getStringValue(p.name, 'Sin nombre'),
          category: catStr,
          actualMargin: Number(info.actualMargin || 0),
          targetMargin: Number(info.targetMargin || 0),
          diff: Number(info.diff || 0),
          isBelow: Boolean(info.isBelow)
        };
      })
      .filter(item => item.isBelow)
      .sort((a, b) => b.diff - a.diff);
  }, [products, (dashboardConfig as DashboardConfig)?.categoryProfitTargets]);

  // --- 3. TOP 5 MOST SOLD PRODUCTS ---
  const topProductsData = useMemo(() => {
    const map: Record<string, { qty: number, total: number }> = {};
    filteredSales.forEach(s => {
      if (!s.items || !Array.isArray(s.items)) return;
      s.items.forEach(item => {
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
        const prod = products.find(p => p.id === id);
        const prodName = prod ? getStringValue(prod.name, '') : `Producto (${id.slice(0, 5)})`;
        return {
          id: String(id),
          name: prodName,
          qty: Number(stats.qty || 0),
          total: Number(stats.total || 0)
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
        if (!p.expirationDate || typeof p.expirationDate !== 'string') return false;
        const expDate = new Date(p.expirationDate + 'T00:00:00');
        if (isNaN(expDate.getTime())) return false;
        return expDate >= todayStart && expDate <= sevenDaysLater;
      })
      .map(p => {
        const expDate = new Date(p.expirationDate! + 'T00:00:00');
        const daysLeft = Math.ceil((expDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: String(p.id || ''),
          name: getStringValue(p.name, 'Sin nombre'),
          expirationDate: String(p.expirationDate || ''),
          daysLeft: Number(daysLeft || 0)
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
        return data.map(({ label, total, tickets }) => ({ label, total, tickets }));
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

  // Chronological closures array for modal time window calculations
  const allSortedClosures = useMemo(() => {
    return [...closures].sort((a, b) => 
      new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime()
    );
  }, [closures]);

  // --- Selected Closure Detail Modal Calculations ---
  const modalSales = useMemo(() => {
    if (!selectedClosureModal) return [];
    const idx = allSortedClosures.findIndex(c => c.id === selectedClosureModal.id);
    const prevClosure = idx > 0 ? allSortedClosures[idx - 1] : null;
    const windowStart = prevClosure ? new Date(prevClosure.createdAt || prevClosure.date) : new Date(0);
    const windowEnd = new Date(selectedClosureModal.createdAt || selectedClosureModal.date);

    return sales.filter(s => {
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

    modalSales.forEach(sale => {
      total += sale.total;
      if (sale.paymentMethod === 'mixed' && sale.paymentBreakdown && sale.paymentBreakdown.length > 0) {
        mixed += sale.total;
        sale.paymentBreakdown.forEach(b => {
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
      .map(sale => {
        let creditAmount = 0;
        if (sale.paymentMethod === 'credit' || sale.isCredit) {
          creditAmount = sale.total;
        } else if (sale.paymentMethod === 'mixed' && sale.paymentBreakdown) {
          creditAmount = sale.paymentBreakdown
            .filter(b => b.method === 'credit')
            .reduce((sum, b) => sum + b.amount, 0);
        }

        if (creditAmount <= 0) return null;

        const dateVal = sale.createdAt || sale.date;
        const timeStr = dateVal 
          ? new Date(dateVal).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) 
          : '--:--';
        const cust = customers.find(c => c.id === sale.customerId);
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
    const idx = allSortedClosures.findIndex(c => c.id === selectedClosureModal.id);
    const prevClosure = idx > 0 ? allSortedClosures[idx - 1] : null;
    const windowStart = prevClosure ? new Date(prevClosure.createdAt || prevClosure.date) : new Date(0);
    const windowEnd = new Date(selectedClosureModal.createdAt || selectedClosureModal.date);

    return movements.filter(m => {
      if (m.type !== 'out') return false;
      const source = m.source ?? 'shift';
      if (source !== 'shift') return false;
      if (selectedClosureModal.employeeId && m.employeeId && m.employeeId !== selectedClosureModal.employeeId) return false;
      const mTime = new Date(m.createdAt || m.date).getTime();
      return mTime > windowStart.getTime() && mTime <= windowEnd.getTime();
    });
  }, [selectedClosureModal, allSortedClosures, movements]);

  const modalExpensesTotal = useMemo(() => {
    return modalMovements.reduce((sum, m) => sum + m.amount, 0);
  }, [modalMovements]);

  const modalRefunds = useMemo(() => {
    if (!selectedClosureModal) return [];
    const idx = allSortedClosures.findIndex(c => c.id === selectedClosureModal.id);
    const prevClosure = idx > 0 ? allSortedClosures[idx - 1] : null;
    const windowStart = prevClosure ? new Date(prevClosure.createdAt || prevClosure.date) : new Date(0);
    const windowEnd = new Date(selectedClosureModal.createdAt || selectedClosureModal.date);

    return customerRefunds.filter(r => {
      const rTime = new Date(r.createdAt || r.date).getTime();
      if (selectedClosureModal.employeeId && r.employeeId && r.employeeId !== selectedClosureModal.employeeId) return false;
      return rTime > windowStart.getTime() && rTime <= windowEnd.getTime();
    });
  }, [selectedClosureModal, allSortedClosures, customerRefunds]);

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
          { id: 'egresos', label: 'Egresos' },
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
        <React.Suspense fallback={
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 font-bold">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Cargando pestaña...</span>
          </div>
        }>
          {activeTab === 'resumen' && (
            <ResumenTab
              totalSalesAmount={totalSalesAmount}
              totalTicketsCount={totalTicketsCount}
              marginPercent={marginPercent}
              salesVariationPercent={salesVariationPercent}
              totalOutstandingCredit={totalOutstandingCredit}
              cashLiquidityTotal={cashLiquidityTotal}
              bankLiquidityTotal={bankLiquidityTotal}
              onOpenLiquidityModal={() => setIsLiquidityModalOpen(true)}
              lowStockAlerts={lowStockAlerts}
              overlimitCustomerAlerts={overlimitCustomerAlerts}
              upcomingPayablesAlerts={upcomingPayablesAlerts}
              lowMarginAlerts={lowMarginAlerts}
              topProductsData={topProductsData}
              expiringSoonProducts={expiringSoonProducts}
              paymentMethodsData={paymentMethodsData}
              chartData={chartData}
              filterType={filterType}
              onNavigateToProduct={onNavigateToProduct}
              onNavigateToCustomer={onNavigateToCustomer}
            />
          )}

          {activeTab === 'ventas' && (
            <VentasTab
              paymentMethodsData={paymentMethodsData}
              totalSalesAmount={totalSalesAmount}
              chartData={chartData}
              closuresWithSales={closuresWithSales}
              setSelectedClosureModal={setSelectedClosureModal}
            />
          )}

          {activeTab === 'egresos' && (
            <EgresosTab
              movements={movements}
              currentEmployee={currentEmployee}
              clerkName={currentEmployee?.name || 'Administrador'}
              dashboardConfig={dashboardConfig}
              employees={employees}
            />
          )}

          {activeTab === 'creditos' && (
            <CreditosTab
              totalOutstandingCredit={totalOutstandingCredit}
              customers={customers}
              customerDebts={customerDebts}
              customerPayments={customerPayments}
              onNavigateToCustomer={onNavigateToCustomer}
            />
          )}

          {activeTab === 'cuentas_pagar' && (
            <PayablesTab
              products={products}
              payables={payables}
              payablePayments={payablePayments}
              currentEmployee={currentEmployee}
              dashboardConfig={dashboardConfig}
              supplierCreditNotes={supplierCreditNotes}
            />
          )}

          {activeTab === 'bancos' && (
            <BancosTab
              cardDeposits={cardDeposits}
              permissions={permissions}
              currentEmployee={currentEmployee}
              firestoreService={firestoreService}
              showAlert={showAlert}
            />
          )}

          {activeTab === 'inventario' && (
            <InventarioTab
              inventoryStats={inventoryStats}
              onNavigateToProduct={onNavigateToProduct}
            />
          )}

          {activeTab === 'devoluciones' && (
            <DevolucionesTab
              products={products}
              supplierReturns={supplierReturns}
              currentEmployee={currentEmployee}
              supplierCreditNotes={supplierCreditNotes}
              payables={payables}
            />
          )}

          {activeTab === 'notas_credito' && (
            <NotasCreditoTab
              creditNotes={creditNotes}
              permissions={permissions}
              creditNoteSearch={creditNoteSearch}
              setCreditNoteSearch={setCreditNoteSearch}
              creditNoteStatusFilter={creditNoteStatusFilter}
              setCreditNoteStatusFilter={setCreditNoteStatusFilter}
              setIsQueryCreditNoteOpen={setIsQueryCreditNoteOpen}
              setQueryCreditNoteCode={setQueryCreditNoteCode}
              setQueryCreditNoteResult={setQueryCreditNoteResult}
              setNoteToVoid={setNoteToVoid}
              setVoidReasonInput={setVoidReasonInput}
            />
          )}

          {activeTab === 'estado_resultados' && (
            <EstadoResultadosTab
              plReportData={plReportData}
              totalOutstandingCredit={totalOutstandingCredit}
              payables={payables}
              payablePayments={payablePayments}
              exportToExcel={exportToExcel}
            />
          )}

          {activeTab === 'empleados' && (
            <EmpleadosTab
              canManageEmployees={permissions.manageEmployees}
              openShifts={openShifts}
              pendingClosures={pendingClosures}
              editingClosure={editingClosure}
              actualCashInput={actualCashInput}
              savingPendingClosure={savingPendingClosure}
              employeeStats={employeeStats}
              expandedEmployeeId={expandedEmployeeId}
              setExpandedEmployeeId={setExpandedEmployeeId}
              handleCloseShiftAdmin={handleCloseShiftAdmin}
              handleEditPendingClosure={handleEditPendingClosure}
              setEditingClosure={setEditingClosure}
              setActualCashInput={setActualCashInput}
              handleSavePendingClosure={handleSavePendingClosure}
              getEmployeeTrend={getEmployeeTrend}
            />
          )}
        </React.Suspense>
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

                  // Audit Log for voiding credit note
                  try {
                    const auditData: Omit<AuditLogEntry, 'id'> = {
                      action: 'void_credit_note',
                      description: `Anuló la Nota de Crédito ${updatedNote.code}. Motivo: ${reason}`,
                      employeeId: currentEmployee?.id || '',
                      employeeName: currentEmployee?.name || 'Sistema',
                      createdAt: new Date().toISOString()
                    };
                    await firestoreService.addDoc('auditLogs', auditData);
                  } catch (auditErr) {
                    console.error('Error recording audit log for void_credit_note:', auditErr);
                  }

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

      {/* Modal: Consultar Saldo de Nota de Crédito (Solo lectura) */}
      {isQueryCreditNoteOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Consultar Nota de Crédito</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Verifica el saldo disponible y estado de la nota sin realizar cambios</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsQueryCreditNoteOpen(false);
                  setQueryCreditNoteCode('');
                  setQueryCreditNoteResult(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Search Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = queryCreditNoteCode.trim().toUpperCase();
                  if (!clean) return;
                  const found = creditNotes.find(cn => (cn.code || '').trim().toUpperCase() === clean);
                  setQueryCreditNoteResult(found || 'not_found');
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wide mb-1.5">
                    Código de Nota de Crédito
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Ej. A1B2C3D4"
                      value={queryCreditNoteCode}
                      onChange={(e) => {
                        setQueryCreditNoteCode(e.target.value);
                        if (queryCreditNoteResult !== null) setQueryCreditNoteResult(null);
                      }}
                      className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white placeholder-slate-400 uppercase"
                    />
                    <button
                      type="submit"
                      disabled={!queryCreditNoteCode.trim()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <Search className="w-4 h-4" />
                      <span>Buscar</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Result View */}
              {queryCreditNoteResult === 'not_found' && (
                <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 text-center space-y-1 animate-fade-in">
                  <div className="flex justify-center text-rose-500 mb-1">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black text-rose-800">Nota de Crédito no encontrada</p>
                  <p className="text-[11px] font-medium text-rose-600">No existe ninguna nota de crédito con el código ingresado. Verifique e intente de nuevo.</p>
                </div>
              )}

              {queryCreditNoteResult && queryCreditNoteResult !== 'not_found' && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3.5 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">Código de Nota</span>
                      <span className="text-sm font-black font-mono text-slate-900">#{queryCreditNoteResult.code}</span>
                    </div>
                    <div>
                      {queryCreditNoteResult.status === 'active' && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ACTIVA
                        </span>
                      )}
                      {queryCreditNoteResult.status === 'depleted' && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-200 text-slate-700 border border-slate-300">
                          AGOTADA
                        </span>
                      )}
                      {queryCreditNoteResult.status === 'voided' && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                          ANULADA
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-200/60">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block mb-0.5">Monto Original</span>
                      <span className="text-sm font-black font-mono text-slate-800">
                        RD$ {queryCreditNoteResult.originalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200/60">
                      <span className="text-[9px] font-extrabold uppercase text-slate-400 block mb-0.5">Saldo Disponible</span>
                      <span className="text-sm font-black font-mono text-indigo-600">
                        RD$ {queryCreditNoteResult.remainingBalance.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {(queryCreditNoteResult.createdAt || queryCreditNoteResult.employeeName) && (
                    <div className="pt-2 text-[11px] font-semibold text-slate-500 space-y-0.5">
                      {queryCreditNoteResult.createdAt && (
                        <div>Emitida el: <span className="text-slate-800 font-bold">{new Date(queryCreditNoteResult.createdAt).toLocaleDateString('es-DO')}</span></div>
                      )}
                      {queryCreditNoteResult.employeeName && (
                        <div>Emitida por: <span className="text-slate-800 font-bold">{queryCreditNoteResult.employeeName}</span></div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsQueryCreditNoteOpen(false);
                  setQueryCreditNoteCode('');
                  setQueryCreditNoteResult(null);
                }}
                className="px-5 py-2.5 text-xs font-black text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SHIFT CLOSURE DETAIL MODAL --- */}
      {selectedClosureModal && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedClosureModal(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:bg-white print:p-0 print:static"
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] print:border-none print:shadow-none print:max-h-full print:w-full animate-scale-up">
            
            {/* Header (Screen) */}
            <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-slate-50/80 shrink-0 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800">Detalle del Corte de Turno</h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedClosureModal.clerkName} • {formatSpanishDate(new Date(selectedClosureModal.createdAt || selectedClosureModal.date))}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClosureModal(null)}
                  className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block text-center border-b border-dashed pb-4 mb-4 p-6">
              <h1 className="text-xl font-bold uppercase tracking-wider">Reporte de Corte de Turno</h1>
              <p className="text-xs font-mono mt-1">
                Cajero: {selectedClosureModal.clerkName} • Fecha: {new Date(selectedClosureModal.createdAt || selectedClosureModal.date).toLocaleString('es-DO')}
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              
              {/* 1. ENCABEZADO DEL CORTE */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Información General</span>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-700">
                    <span>Cajero: <strong className="text-slate-900">{selectedClosureModal.clerkName}</strong></span>
                    <span>Fecha: <strong className="text-slate-900">{formatSpanishDate(new Date(selectedClosureModal.createdAt || selectedClosureModal.date))}</strong></span>
                    <span>Hora Cierre: <strong className="text-slate-900">{new Date(selectedClosureModal.createdAt || selectedClosureModal.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                  </div>
                </div>
                
                {(selectedClosureModal.pendingCashCount || selectedClosureModal.closedByAdminName) && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      Cerrado por admin ({selectedClosureModal.closedByAdminName || 'Administrador'})
                      {selectedClosureModal.pendingCashCount && ' — Conteo pendiente'}
                    </span>
                  </div>
                )}
              </div>

              {/* 2. RESUMEN DE CAJA */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-indigo-500" />
                  <span>Resumen de Caja</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Fondo Inicial</span>
                    <span className="text-sm font-black font-mono text-slate-800">
                      RD$ {selectedClosureModal.initialCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Ventas en Efectivo</span>
                    <span className="text-sm font-black font-mono text-emerald-600">
                      + RD$ {modalSalesMetrics.cash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Egresos del Turno</span>
                    <span className="text-sm font-black font-mono text-rose-600">
                      - RD$ {modalExpensesTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Efectivo Esperado</span>
                    <span className="text-sm font-black font-mono text-slate-800">
                      RD$ {selectedClosureModal.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Efectivo Contado</span>
                    <span className="text-sm font-black font-mono text-slate-800">
                      RD$ {selectedClosureModal.actualCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      {selectedClosureModal.pendingCashCount && <span className="text-[9px] text-amber-600 ml-1 font-sans">(Pendiente)</span>}
                    </span>
                  </div>
                  <div className={`p-3 border rounded-2xl ${
                    selectedClosureModal.difference < 0 ? 'bg-rose-50 border-rose-200 text-rose-800' :
                    selectedClosureModal.difference > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <span className="text-[9px] font-black uppercase opacity-70 block">Diferencia</span>
                    <span className="text-sm font-black font-mono">
                      RD$ {selectedClosureModal.difference.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl col-span-2 sm:col-span-3 flex justify-between items-center">
                    <div>
                      <span className="text-[9px] font-black uppercase text-emerald-800 block">Retirar de Caja</span>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        (dejando fondo de RD$ {selectedClosureModal.initialCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })})
                      </span>
                    </div>
                    <span className="text-sm font-black font-mono text-emerald-700">
                      RD$ {(selectedClosureModal.cashToRemove ?? Math.max(0, selectedClosureModal.actualCash - selectedClosureModal.initialCash)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. VENTAS DEL TURNO */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-emerald-500" />
                    <span>Ventas del Turno ({modalSalesMetrics.count})</span>
                  </h3>
                  <span className="text-xs font-black font-mono text-slate-800">
                    Total: RD$ {modalSalesMetrics.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Desglose por método de pago */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Efectivo</span>
                    <span className="text-xs font-extrabold font-mono text-slate-700">RD$ {modalSalesMetrics.cash.toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Tarjeta</span>
                    <span className="text-xs font-extrabold font-mono text-slate-700">RD$ {modalSalesMetrics.card.toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Transferencia</span>
                    <span className="text-xs font-extrabold font-mono text-slate-700">RD$ {modalSalesMetrics.transfer.toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Crédito</span>
                    <span className="text-xs font-extrabold font-mono text-slate-700">RD$ {modalSalesMetrics.credit.toFixed(2)}</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl col-span-2 sm:col-span-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Mixto (Total)</span>
                    <span className="text-xs font-extrabold font-mono text-slate-700">RD$ {modalSalesMetrics.mixed.toFixed(2)}</span>
                  </div>
                </div>

                {/* Tabla de ventas individuales */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                  {modalSales.length === 0 ? (
                    <p className="p-4 text-center text-xs font-medium text-slate-400">No se registraron ventas en este turno.</p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Ticket</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Hora</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Método</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px] text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {modalSales.map(sale => (
                          <tr key={sale.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-bold text-slate-800">{sale.ticketNumber}</td>
                            <td className="py-2 px-3 text-slate-500 font-medium">
                              {new Date(getSaleTimestamp(sale)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold uppercase text-[9px]">
                                {sale.paymentMethod}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-right text-slate-800">
                              RD$ {sale.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* 4. VENTAS A CRÉDITO DE ESE TURNO */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                  <span>Ventas a Crédito del Turno ({modalCreditSales.length})</span>
                </h3>
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-44 overflow-y-auto">
                  {modalCreditSales.length === 0 ? (
                    <p className="p-4 text-center text-xs font-medium text-slate-400">No hubo ventas a crédito en este turno.</p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Cliente</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Ticket</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Hora</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px] text-right">Monto Crédito</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {modalCreditSales.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-bold text-slate-800">{item.customerName}</td>
                            <td className="py-2 px-3 text-slate-600 font-medium">{item.ticketNumber}</td>
                            <td className="py-2 px-3 text-slate-500 font-medium">{item.timeStr}</td>
                            <td className="py-2 px-3 font-mono font-bold text-right text-amber-700">
                              RD$ {item.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* 5. EGRESOS DETALLADOS DE ESE TURNO */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                  <span>Egresos Detallados del Turno ({modalMovements.length})</span>
                </h3>
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-44 overflow-y-auto">
                  {modalMovements.length === 0 ? (
                    <p className="p-4 text-center text-xs font-medium text-slate-400">No hubo egresos registrados en este turno.</p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Concepto</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Categoría</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Hora</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px] text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {modalMovements.map(m => (
                          <tr key={m.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-bold text-slate-800">
                              {m.concept}
                              {m.expenseType === 'pago_factura' && m.invoiceNumber && (
                                <span className="text-indigo-600 font-bold normal-case ml-1">
                                  — Factura #{m.invoiceNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-medium">{m.category}</td>
                            <td className="py-2 px-3 text-slate-500 font-medium">
                              {new Date(m.createdAt || m.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-right text-rose-600">
                              RD$ {m.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* 6. DEVOLUCIONES DETALLADAS DE ESE TURNO */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-purple-500" />
                  <span>Devoluciones Detalladas del Turno ({modalRefunds.length})</span>
                </h3>
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-44 overflow-y-auto">
                  {modalRefunds.length === 0 ? (
                    <p className="p-4 text-center text-xs font-medium text-slate-400">No hubo devoluciones en este turno.</p>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Ticket Orig.</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Cliente</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Método</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px]">Motivo</th>
                          <th className="py-2 px-3 font-black text-slate-400 uppercase tracking-wider text-[10px] text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {modalRefunds.map(r => {
                          const cust = customers.find(c => c.id === r.customerId);
                          const customerName = cust?.name || r.customerName || 'Cliente';
                          const methodLabel = r.method === 'cash' ? 'Efectivo' : r.method === 'credit_note' ? 'Nota de Crédito' : 'Reducción de Crédito';
                          return (
                            <tr key={r.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-bold text-slate-800">{r.ticketNumber}</td>
                              <td className="py-2 px-3 text-slate-700 font-medium">{customerName}</td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold uppercase text-[9px]">
                                  {methodLabel}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-500 font-medium truncate max-w-xs">{r.reason}</td>
                              <td className="py-2 px-3 font-mono font-bold text-right text-purple-700">
                                RD$ {r.amount.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-150 bg-slate-50/80 flex items-center justify-between shrink-0 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Reporte</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedClosureModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
