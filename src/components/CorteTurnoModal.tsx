import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, 
  TrendingUp, 
  Receipt, 
  Coins, 
  CreditCard, 
  ArrowRight, 
  Printer, 
  Lock, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  Users
} from 'lucide-react';
import { Sale, Employee, Closure, Movement, CustomerRefund, DashboardConfig } from '../types';
import { firestoreService } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useAlert } from '../context/AlertContext';
import { getSaleTimestamp } from '../lib/dates';

interface CorteTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesHistory: Sale[];
  clerkName: string;
  currentEmployee: Employee | null;
  closures: Closure[];
  movements: Movement[];
  customerRefunds?: CustomerRefund[];
  onSuccess?: () => void;
  externalCashTotal?: number | null;
  onOpenMenudo?: () => void;
  dashboardConfig?: DashboardConfig;
}

export const CorteTurnoModal: React.FC<CorteTurnoModalProps> = ({
  isOpen,
  onClose,
  salesHistory,
  clerkName,
  currentEmployee,
  closures,
  movements,
  customerRefunds = [],
  onSuccess,
  externalCashTotal = null,
  onOpenMenudo,
  dashboardConfig,
}) => {
  const { showAlert } = useAlert();
  const configuredInitialCash = dashboardConfig?.defaultInitialCash ?? 500;
  const [initialCashStr, setInitialCashStr] = useState<string>(String(configuredInitialCash)); // Configurable starting cash
  const [actualCashStr, setActualCashStr] = useState<string>('');
  const [isTouched, setIsTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [cardTerminalMatched, setCardTerminalMatched] = useState<boolean | null>(null);
  const [cardTerminalReportedAmountStr, setCardTerminalReportedAmountStr] = useState<string>('');

  const [cashMismatchAlert, setCashMismatchAlert] = useState<{ oldVal: number; newVal: number } | null>(null);
  const lastKnownExpectedCashRef = useRef<number | null>(null);

  // Sync initial cash from dashboardConfig when modal opens
  useEffect(() => {
    if (isOpen) {
      setInitialCashStr(String(dashboardConfig?.defaultInitialCash ?? 500));
    }
  }, [isOpen, dashboardConfig?.defaultInitialCash]);

  // Parse cash values safely
  const initialCash = parseFloat(initialCashStr) || 0;
  const actualCash = parseFloat(actualCashStr) || 0;

  // React to external cash total updates from Menudo calculator
  useEffect(() => {
    if (isOpen && externalCashTotal !== null && externalCashTotal !== undefined) {
      if (!isTouched) {
        setIsTouched(true);
      }
      setActualCashStr(externalCashTotal.toString());
    }
  }, [isOpen, externalCashTotal, isTouched]);

  // Filter sales for today / current employee's active shift
  const todaySales = useMemo(() => {
    if (currentEmployee) {
      // Find the last closure of this employee
      const empClosures = closures.filter(c => c.employeeId === currentEmployee.id);
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

      return salesHistory.filter(sale => {
        if (!sale.date) return false;
        if (sale.soldBy?.id !== currentEmployee.id) return false;
        
        return getSaleTimestamp(sale) > lastClosureTime;
      });
    } else {
      // Fallback behavior: "all of today" for when no currentEmployee exists
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayTime = startOfToday.getTime();

      return salesHistory.filter(sale => {
        if (!sale.date) return false;
        return getSaleTimestamp(sale) >= startOfTodayTime;
      });
    }
  }, [salesHistory, currentEmployee, closures]);

  // Calculations for today's sales by payment method
  const salesMetrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let card = 0;
    let transfer = 0;
    let qr = 0;
    let credit = 0;

    todaySales.forEach(sale => {
      total += sale.total;
      if (sale.paymentMethod === 'mixed' && sale.paymentBreakdown && sale.paymentBreakdown.length > 0) {
        sale.paymentBreakdown.forEach(b => {
          if (b.method === 'cash') cash += b.amount;
          else if (b.method === 'card') card += b.amount;
          else if (b.method === 'transfer') transfer += b.amount;
          else if (b.method === 'qr') qr += b.amount;
          else if (b.method === 'credit') credit += b.amount;
        });
      } else if (sale.paymentMethod === 'cash') {
        cash += sale.total;
      } else if (sale.paymentMethod === 'card') {
        card += sale.total;
      } else if (sale.paymentMethod === 'transfer') {
        transfer += sale.total;
      } else if (sale.paymentMethod === 'qr') {
        qr += sale.total;
      } else if (sale.paymentMethod === 'credit' || sale.isCredit) {
        credit += sale.total;
      }
    });

    return { total, cash, card, transfer, qr, credit, count: todaySales.length };
  }, [todaySales]);

  // Filter credit sales (full credit or credit breakdown component) for current shift
  const shiftCreditSales = useMemo(() => {
    return todaySales
      .map(sale => {
        let creditAmount = 0;
        if (sale.paymentMethod === 'credit') {
          creditAmount = sale.total;
        } else if (sale.paymentMethod === 'mixed' && sale.paymentBreakdown) {
          creditAmount = sale.paymentBreakdown
            .filter(b => b.method === 'credit')
            .reduce((sum, b) => sum + b.amount, 0);
        } else if (sale.isCredit) {
          creditAmount = sale.total;
        }

        if (creditAmount <= 0) return null;

        const dateVal = sale.createdAt || sale.date;
        const timeStr = dateVal 
          ? new Date(dateVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : '--:--';
        const customerName = sale.customerName || 'Cliente sin nombre';

        return {
          id: sale.id,
          ticketNumber: sale.ticketNumber,
          customerName,
          amount: creditAmount,
          timeStr,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [todaySales]);

  const shiftCreditSalesTotal = useMemo(() => {
    return shiftCreditSales.reduce((acc, item) => acc + item.amount, 0);
  }, [shiftCreditSales]);

  // Expected cash in register: Initial cash + Cash Sales
  // Filter movements (egresos) for the current shift using the same shift boundaries as sales
  const shiftExpenses = useMemo(() => {
    if (currentEmployee) {
      // Find the last closure of this employee
      const empClosures = closures.filter(c => c.employeeId === currentEmployee.id);
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

      return movements.filter(m => {
        if (m.type !== 'out') return false;
        const source = m.source ?? 'shift';
        if (source !== 'shift') return false;
        if (m.employeeId !== currentEmployee.id) return false;
        const mTime = new Date(m.createdAt || m.date).getTime();
        return mTime > lastClosureTime;
      });
    } else {
      // Fallback behavior: "all of today" for when no currentEmployee exists
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayTime = startOfToday.getTime();

      return movements.filter(m => {
        if (m.type !== 'out') return false;
        const source = m.source ?? 'shift';
        if (source !== 'shift') return false;
        const mTime = new Date(m.createdAt || m.date).getTime();
        return mTime >= startOfTodayTime;
      });
    }
  }, [movements, currentEmployee, closures]);

  // Sum of shift cash expenses
  const shiftCashExpensesTotal = useMemo(() => {
    return shiftExpenses
      .filter(m => m.paymentMethod === 'cash')
      .reduce((acc, m) => acc + m.amount, 0);
  }, [shiftExpenses]);

  // Detailed breakdown list of expenses for the shift
  const shiftExpensesDetailed = useMemo(() => {
    return shiftExpenses.map(m => {
      const dateVal = m.createdAt || m.date;
      const timeStr = dateVal 
        ? new Date(dateVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        : '--:--';
      const concept = m.concept || m.category || 'Gasto / Egreso';
      const methodLabel = m.paymentMethod === 'cash' ? 'Efectivo' : m.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia';
      return {
        id: m.id,
        concept,
        amount: m.amount,
        paymentMethod: m.paymentMethod,
        methodLabel,
        timeStr,
      };
    });
  }, [shiftExpenses]);

  const shiftExpensesTotalAll = useMemo(() => {
    return shiftExpenses.reduce((acc, m) => acc + m.amount, 0);
  }, [shiftExpenses]);

  // Filter customer refunds (method 'cash') for current shift
  const shiftRefunds = useMemo(() => {
    if (currentEmployee) {
      const empClosures = closures.filter(c => c.employeeId === currentEmployee.id);
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

      return (customerRefunds || []).filter(r => {
        if (r.method !== 'cash') return false;
        if (r.employeeId && r.employeeId !== currentEmployee.id) return false;
        const rTime = new Date(r.createdAt || r.date).getTime();
        return rTime > lastClosureTime;
      });
    } else {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayTime = startOfToday.getTime();

      return (customerRefunds || []).filter(r => {
        if (r.method !== 'cash') return false;
        const rTime = new Date(r.createdAt || r.date).getTime();
        return rTime >= startOfTodayTime;
      });
    }
  }, [customerRefunds, currentEmployee, closures]);

  const shiftCashRefundsTotal = useMemo(() => {
    return shiftRefunds.reduce((acc, r) => acc + r.amount, 0);
  }, [shiftRefunds]);

  const expectedCash = initialCash + salesMetrics.cash - shiftCashExpensesTotal - shiftCashRefundsTotal;

  // Cash discrepancy: Actual - Expected
  const discrepancy = actualCash - expectedCash;

  // Cash to remove physically from register, leaving only the initial Cash fund
  const cashToRemove = Math.max(0, actualCash - initialCash);

  // Reset touch state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsTouched(false);
      setCashMismatchAlert(null);
      lastKnownExpectedCashRef.current = null;
      setCardTerminalMatched(null);
      setCardTerminalReportedAmountStr('');
    }
  }, [isOpen]);

  // Set actualCashStr to expectedCash if not touched yet
  useEffect(() => {
    if (!isTouched && isOpen) {
      setActualCashStr(expectedCash.toFixed(2));
    }
  }, [expectedCash, isTouched, isOpen]);

  // Detect if expectedCash changes while isTouched is true
  useEffect(() => {
    if (!isOpen) return;

    if (isTouched) {
      if (lastKnownExpectedCashRef.current === null) {
        lastKnownExpectedCashRef.current = expectedCash;
      } else if (Math.abs(expectedCash - lastKnownExpectedCashRef.current) > 0.001) {
        const oldVal = lastKnownExpectedCashRef.current;
        const newVal = expectedCash;
        setCashMismatchAlert({ oldVal, newVal });
        lastKnownExpectedCashRef.current = expectedCash;
      }
    }
  }, [expectedCash, isTouched, isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSaveClosure = async () => {
    if (cashMismatchAlert) {
      return;
    }

    if (!actualCashStr) {
      await showAlert(
        'Efectivo Requerido',
        'Por favor, introduce el efectivo real contado en caja.',
        'warning'
      );
      return;
    }

    if (salesMetrics.card > 0) {
      if (cardTerminalMatched === null) {
        await showAlert(
          'Confirmación de Terminal Requerida',
          `Por favor confirma si el cierre de la terminal de tarjetas coincidió con el monto del sistema (RD$ ${salesMetrics.card.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`,
          'warning'
        );
        return;
      }

      if (cardTerminalMatched === false) {
        const reportedAmt = parseFloat(cardTerminalReportedAmountStr);
        if (!cardTerminalReportedAmountStr || isNaN(reportedAmt) || reportedAmt < 0) {
          await showAlert(
            'Monto de Terminal Requerido',
            'Por favor ingresa el monto real que reportó la terminal de tarjetas.',
            'warning'
          );
          return;
        }
      }
    }

    try {
      setSaving(true);
      setSaveStatus(null);

      const d = new Date();
      const dateString = d.toISOString().split('T')[0]; // YYYY-MM-DD

      const closureData: Omit<Closure, 'id'> = {
        date: dateString,
        clerkName,
        employeeId: currentEmployee?.id || undefined,
        initialCash,
        salesTotal: salesMetrics.total,
        expectedCash,
        actualCash,
        cashToRemove,
        difference: discrepancy,
        status: 'closed' as const,
        createdAt: new Date().toISOString(),
        ...(salesMetrics.card > 0 ? {
          cardTerminalMatched: cardTerminalMatched === true,
          cardTerminalSystemAmount: salesMetrics.card,
          ...(cardTerminalMatched === false ? {
            cardTerminalReportedAmount: parseFloat(cardTerminalReportedAmountStr) || 0
          } : {})
        } : {})
      };

      await firestoreService.addDoc('closures', closureData);
      
      try {
        await firestoreService.addDoc('auditLogs', {
          action: 'close_shift',
          description: `Corte de turno realizado por ${clerkName}. Efectivo real: RD$ ${actualCash.toFixed(2)}, Diferencia: RD$ ${discrepancy.toFixed(2)}${salesMetrics.card > 0 ? (cardTerminalMatched ? ' (Terminal Tarjetas concilio ok)' : ` (Terminal Tarjetas discrepancia: reportado RD$ ${parseFloat(cardTerminalReportedAmountStr).toFixed(2)} vs sistema RD$ ${salesMetrics.card.toFixed(2)})`) : ''}`,
          employeeId: currentEmployee?.id || '',
          employeeName: clerkName || 'Cajero',
          createdAt: new Date().toISOString()
        });
      } catch (auditErr) {
        console.error('Error logging close_shift audit:', auditErr);
      }

      setSaveStatus({
        text: 'Corte de caja registrado exitosamente en Firestore',
        type: 'success'
      });

      // Imprimir reporte de cierre y realizar limpieza tras finalizar impresión o timeout de 4s
      let cleanedUp = false;
      let timerId: ReturnType<typeof setTimeout> | null = null;

      const doCleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        if (timerId !== null) {
          clearTimeout(timerId);
          timerId = null;
        }
        window.removeEventListener('afterprint', handleAfterPrint);
        setActualCashStr('');
        setCardTerminalMatched(null);
        setCardTerminalReportedAmountStr('');
        setSaveStatus(null);
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      };

      const handleAfterPrint = () => {
        doCleanup();
      };

      timerId = setTimeout(() => {
        doCleanup();
      }, 4000);

      window.addEventListener('afterprint', handleAfterPrint);
      window.print();

    } catch (err: any) {
      console.error('Error saving closure:', err);
      setSaveStatus({
        text: 'Error al registrar corte: ' + err.message,
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:bg-white print:p-0"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] print:border-none print:shadow-none print:max-h-full animate-scale-up">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-slate-50/80 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Arqueo y Corte de Turno</h3>
              <p className="text-xs text-slate-500">Resumen administrativo de caja de este turno</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-250 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Print-only layout header */}
          <div className="hidden print:block text-center border-b border-dashed pb-4 mb-4">
            <h1 className="text-xl font-bold uppercase tracking-wider">Reporte de Corte de Turno</h1>
            <p className="text-xs font-mono mt-1">Cajero: {clerkName} • Fecha: {new Date().toLocaleString()}</p>
          </div>

          {/* Mid-count expected cash change warning banner */}
          <AnimatePresence>
            {cashMismatchAlert && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 text-xs shadow-sm space-y-3 shrink-0 print:hidden"
              >
                <div className="flex items-start gap-2.5 font-bold">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    El monto esperado cambió de RD${cashMismatchAlert.oldVal.toFixed(2)} a RD${cashMismatchAlert.newVal.toFixed(2)} desde que empezaste a contar (probablemente por una venta, egreso, o devolución nueva) — verifica tu conteo físico de nuevo antes de guardar.
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setCashMismatchAlert(null)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-extrabold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Entendido, ya verifiqué
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status feedback banner */}
          <AnimatePresence>
            {saveStatus && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs font-bold ${
                  saveStatus.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {saveStatus.type === 'success' ? (
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4.5 h-4.5 text-red-500 shrink-0" />
                )}
                <span>{saveStatus.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core breakdown table */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-slate-400" /> Desglose de Ventas de este Turno
            </h4>
            
            <div className="bg-slate-50 rounded-2xl border border-slate-150 p-4 space-y-3.5 font-medium text-xs">
              <div className="flex justify-between items-center text-slate-500">
                <span>Tickets Emitidos:</span>
                <span className="font-bold text-slate-800 font-mono text-sm bg-slate-200/50 px-2.5 py-0.5 rounded-lg">{salesMetrics.count}</span>
              </div>
              
              <div className="border-t border-slate-200/60 my-2" />
              
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">💵 Ventas en Efectivo:</span>
                <span className="font-bold text-slate-800">${salesMetrics.cash.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">💳 Ventas con Tarjeta:</span>
                <span className="font-bold text-slate-800">${salesMetrics.card.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">📲 Transferencias:</span>
                <span className="font-bold text-slate-800">${salesMetrics.transfer.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1.5">📱 Código QR:</span>
                <span className="font-bold text-slate-800">${salesMetrics.qr.toFixed(2)}</span>
              </div>

              {salesMetrics.credit > 0 && (
                <div className="flex justify-between items-center text-amber-800 font-semibold">
                  <span className="flex items-center gap-1.5">👥 Ventas a Crédito:</span>
                  <span className="font-bold font-mono">${salesMetrics.credit.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-sm font-black text-slate-900 bg-slate-100/50 -mx-4 -mb-4 p-4 rounded-b-2xl">
                <span>Venta Total del Turno:</span>
                <span className="text-indigo-600 text-base font-extrabold">${salesMetrics.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Detailed Expenses Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-rose-600" /> Egresos del Turno ({shiftExpensesDetailed.length})
              </span>
              <span className="font-mono text-rose-600 font-bold">-${shiftExpensesTotalAll.toFixed(2)}</span>
            </h4>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-2 text-xs">
              {shiftExpensesDetailed.length > 0 ? (
                shiftExpensesDetailed.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-slate-200/60 last:border-none">
                    <div className="flex flex-col pr-2">
                      <span className="font-bold text-slate-800">{m.concept}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {m.timeStr} • {m.methodLabel}
                      </span>
                    </div>
                    <span className="font-extrabold text-rose-600 font-mono shrink-0">-${m.amount.toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-slate-400 font-medium text-[11px] italic">
                  Sin egresos registrados en este turno
                </div>
              )}
            </div>
          </div>

          {/* Credit Sales Breakdown (only shown if there are credit sales) */}
          {shiftCreditSales.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-600" /> Ventas a Crédito de este Turno ({shiftCreditSales.length})
                </span>
                <span className="font-mono text-amber-700 font-extrabold">${shiftCreditSalesTotal.toFixed(2)}</span>
              </h4>

              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-2 text-xs">
                {shiftCreditSales.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-slate-200/60 last:border-none">
                    <div className="flex flex-col pr-2">
                      <span className="font-bold text-slate-800">{item.customerName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.ticketNumber ? `Ticket #${item.ticketNumber} • ` : ''}{item.timeStr}
                      </span>
                    </div>
                    <span className="font-extrabold text-amber-800 font-mono shrink-0">${item.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reconciliation fields & summary */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-slate-400" /> Conciliación y Arqueo de Caja
            </h4>

            {/* Input controls (hidden in print) */}
            <div className="grid grid-cols-2 gap-4 print:hidden">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Fondo Inicial ($)
                </label>
                <input
                  type="number"
                  value={initialCashStr}
                  onChange={(e) => setInitialCashStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-250 bg-slate-50/50 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  placeholder="Fondo de caja"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-500 block">
                    Efectivo Real Contado ($)
                  </label>
                  {onOpenMenudo && (
                    <button
                      type="button"
                      onClick={onOpenMenudo}
                      className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors border border-amber-200 cursor-pointer"
                    >
                      <Coins className="w-2.5 h-2.5 text-amber-600" />
                      Calculadora
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  value={actualCashStr}
                  onChange={(e) => {
                    if (!isTouched) {
                      setIsTouched(true);
                    }
                    setActualCashStr(e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-xl border-2 border-indigo-200 bg-indigo-50/20 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-extrabold placeholder:font-normal placeholder:text-slate-400"
                  placeholder="Contado en caja"
                  autoFocus
                />
              </div>
            </div>

            {/* Summary card (visible on screen and in print) */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Fondo Inicial:</span>
                <span className="font-bold text-slate-800 font-mono">${initialCash.toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Ventas en Efectivo (+):</span>
                <span className="font-bold text-emerald-600 font-mono">+${salesMetrics.cash.toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-medium text-rose-600">
                <span>Egresos del turno (Efectivo):</span>
                <span className="font-bold font-mono">-RD${shiftCashExpensesTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-medium text-rose-600">
                <span>Reembolsos a clientes:</span>
                <span className="font-bold font-mono">-RD${shiftCashRefundsTotal.toFixed(2)}</span>
              </div>

              <div className="border-t border-slate-200/60 my-1" />

              <div className="flex justify-between font-medium">
                <span className="text-slate-500 font-bold">Efectivo Esperado Neto:</span>
                <span className="font-bold text-slate-800 font-mono">${expectedCash.toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Efectivo Real Contado:</span>
                <span className="font-bold text-slate-800 font-mono">${actualCash.toFixed(2)}</span>
              </div>

              <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center font-bold">
                <span className="text-slate-700">Diferencia:</span>
                {actualCashStr ? (
                  <span className={`font-mono text-sm px-2.5 py-0.5 rounded-lg ${
                    discrepancy === 0 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                      : discrepancy > 0 
                      ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                      : 'bg-red-50 text-red-700 border border-red-100'
                  }`}>
                    {discrepancy >= 0 ? '+' : ''}${discrepancy.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-slate-400 italic font-normal text-[11px]">Esperando conteo...</span>
                )}
              </div>

              {/* RETIRAR DE CAJA */}
              <div className="mt-3 pt-3 border-t border-slate-200/80 bg-emerald-50/80 rounded-xl p-3 flex justify-between items-center text-xs">
                <span className="font-extrabold text-emerald-950 uppercase tracking-tight">Retirar de caja:</span>
                <div className="text-right">
                  <span className="font-mono text-sm font-black text-emerald-700 block">
                    RD$ {cashToRemove.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold block">
                    (dejando fondo de RD$ {initialCash.toFixed(2)})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Terminal Confirmation */}
          {salesMetrics.card > 0 && (
            <div className="space-y-3 bg-slate-50 rounded-2xl border border-slate-200 p-4 print:hidden">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Confirmación de Terminal de Tarjetas
                </h4>
              </div>
              
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                ¿Hiciste el cierre en la terminal de tarjetas y el monto coincidió con el sistema (RD$ {salesMetrics.card.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})?
              </p>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCardTerminalMatched(true);
                    setCardTerminalReportedAmountStr('');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border ${
                    cardTerminalMatched === true
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-250 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Sí
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCardTerminalMatched(false);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border ${
                    cardTerminalMatched === false
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-250 hover:bg-slate-100'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  No
                </button>
              </div>

              {cardTerminalMatched === false && (
                <div className="pt-2 animate-fade-in space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    ¿Cuál fue el monto real que reportó la terminal? ($) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cardTerminalReportedAmountStr}
                    onChange={(e) => setCardTerminalReportedAmountStr(e.target.value)}
                    placeholder="Monto real reportado por la terminal"
                    className="w-full px-3 py-2 rounded-xl border-2 border-rose-300 bg-rose-50/30 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-slate-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* Warnings on discrepancy */}
          {actualCashStr && Math.abs(discrepancy) > 0.01 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex gap-2 font-medium shrink-0 print:hidden">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Diferencia detectada:</span> El efectivo real difiere del esperado por {' '}
                <span className="font-bold">${Math.abs(discrepancy).toFixed(2)}</span>. 
                {discrepancy < 0 ? ' Falta dinero en caja.' : ' Sobra dinero en caja.'}
              </div>
            </div>
          )}

        </div>

        {/* Modal Actions */}
        <div className="p-6 border-t border-slate-150 bg-slate-50/80 flex gap-3 shrink-0 print:hidden justify-end">
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl border border-slate-250 text-slate-600 bg-white hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir Reporte
          </button>

          <button
            onClick={handleSaveClosure}
            disabled={saving || !!cashMismatchAlert}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors ${
              actualCashStr && !cashMismatchAlert
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/10 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Guardando...' : 'Guardar y Cerrar Turno'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
