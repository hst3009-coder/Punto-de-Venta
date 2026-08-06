import React, { useMemo } from 'react';
import { Closure, Sale, Movement, CustomerRefund, Employee, Customer, DashboardConfig, isMixedSale } from '../../types';
import { getSaleTimestamp } from '../../lib/dates';
import { formatSpanishDate } from '../../lib/dashboardCalculations';
import { 
  X, 
  Printer, 
  Receipt, 
  Coins, 
  CreditCard, 
  Wallet, 
  Users, 
  TrendingDown, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  User, 
  ShieldCheck,
  QrCode,
  DollarSign
} from 'lucide-react';

export interface ClosureDetailModalProps {
  closure: Closure;
  onClose: () => void;
  sales?: Sale[];
  movements?: Movement[];
  customerRefunds?: CustomerRefund[];
  employees?: Employee[];
  customers?: Customer[];
  closures?: Closure[];
  dashboardConfig?: DashboardConfig;
}

export const ClosureDetailModal: React.FC<ClosureDetailModalProps> = ({
  closure,
  onClose,
  sales = [],
  movements = [],
  customerRefunds = [],
  employees = [],
  customers = [],
  closures = [],
  dashboardConfig,
}) => {
  // Sort all closures chronologically to determine the window range
  const allSortedClosures = useMemo(() => {
    return [...closures].sort(
      (a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime()
    );
  }, [closures]);

  // Window start = previous closure timestamp (or 0 if first closure); Window end = this closure timestamp
  const { windowStart, windowEnd } = useMemo(() => {
    const idx = allSortedClosures.findIndex((c) => c.id === closure.id);
    const prev = idx > 0 ? allSortedClosures[idx - 1] : null;
    const start = prev ? new Date(prev.createdAt || prev.date) : new Date(0);
    const end = new Date(closure.createdAt || closure.date);
    return { windowStart: start, windowEnd: end };
  }, [closure, allSortedClosures]);

  // Sales in this shift window
  const shiftSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.isCancelled) return false;
      const sTime = getSaleTimestamp(s);
      return sTime > windowStart.getTime() && sTime <= windowEnd.getTime();
    });
  }, [sales, windowStart, windowEnd]);

  // Sales metrics breakdown
  const salesMetrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let card = 0;
    let transfer = 0;
    let credit = 0;
    let qr = 0;
    let mixed = 0;

    shiftSales.forEach((sale) => {
      total += sale.total;
      if (isMixedSale(sale)) {
        mixed += sale.total;
        sale.paymentBreakdown.forEach((b) => {
          if (b.method === 'cash') cash += b.amount;
          else if (b.method === 'card') card += b.amount;
          else if (b.method === 'transfer') transfer += b.amount;
          else if (b.method === 'credit') credit += b.amount;
          else if ((b.method as string) === 'qr') qr += b.amount;
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

    return { total, cash, card, transfer, credit, qr, mixed, count: shiftSales.length };
  }, [shiftSales]);

  // Credit sales in this shift
  const shiftCreditSales = useMemo(() => {
    return shiftSales
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
  }, [shiftSales, customers]);

  // Expenses / Outflows in this shift
  const shiftMovements = useMemo(() => {
    return movements.filter((m) => {
      if (m.type !== 'out') return false;
      const source = m.source ?? 'shift';
      if (source !== 'shift') return false;
      if (closure.employeeId && m.employeeId && m.employeeId !== closure.employeeId) return false;
      const mTime = new Date(m.createdAt || m.date).getTime();
      return mTime > windowStart.getTime() && mTime <= windowEnd.getTime();
    });
  }, [movements, closure, windowStart, windowEnd]);

  const totalMovementsAmount = useMemo(() => {
    return shiftMovements.reduce((sum, m) => sum + m.amount, 0);
  }, [shiftMovements]);

  // Customer Refunds in this shift
  const shiftRefunds = useMemo(() => {
    return customerRefunds.filter((r) => {
      const rTime = new Date(r.createdAt || r.date).getTime();
      if (closure.employeeId && r.employeeId && r.employeeId !== closure.employeeId) return false;
      return rTime > windowStart.getTime() && rTime <= windowEnd.getTime();
    });
  }, [customerRefunds, closure, windowStart, windowEnd]);

  const totalRefundsAmount = useMemo(() => {
    return shiftRefunds.reduce((sum, r) => sum + r.amount, 0);
  }, [shiftRefunds]);

  // Cash refunds component
  const cashRefundsAmount = useMemo(() => {
    return shiftRefunds
      .filter((r) => (r.paymentMethod || 'cash') === 'cash')
      .reduce((sum, r) => sum + r.amount, 0);
  }, [shiftRefunds]);

  // Formatted date and time string for closing
  const closingDateObj = useMemo(() => {
    return new Date(closure.createdAt || closure.date);
  }, [closure]);

  const formattedDate = formatSpanishDate(closingDateObj);
  const formattedTime = closingDateObj.toLocaleTimeString('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const clerkDisplayName = useMemo(() => {
    if (closure.clerkName) return closure.clerkName;
    if (closure.employeeId) {
      const emp = employees.find((e) => e.id === closure.employeeId);
      if (emp) return emp.name;
    }
    return 'Cajero general';
  }, [closure, employees]);

  // Closed by admin info
  const isClosedByAdmin = Boolean(closure.closedByAdminName || closure.closedByAdminId);
  const adminName = closure.closedByAdminName || (closure.closedByAdminId ? (employees.find(e => e.id === closure.closedByAdminId)?.name || 'Administrador') : '');

  // Cash to remove calculation
  const calculatedCashToRemove = closure.cashToRemove ?? Math.max(0, closure.actualCash - (closure.initialCash ?? 0));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in print:bg-white print:p-0 print:static print:inset-auto print:block">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-200 flex flex-col print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none animate-scale-up">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-150 bg-slate-50/80 flex flex-wrap items-center justify-between gap-4 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-lg">Detalle del Corte de Caja</h3>
                {isClosedByAdmin && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px] uppercase flex items-center gap-1 border border-amber-200">
                    <ShieldCheck className="w-3 h-3 text-amber-600" />
                    Cerrado por Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-semibold flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {formattedDate}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {formattedTime}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400" /> {clerkDisplayName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-100 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Only Header */}
        <div className="hidden print:block p-6 border-b border-slate-300 text-center">
          <h1 className="text-xl font-black text-slate-900 uppercase">
            {dashboardConfig?.storeName || 'PUNTO DE VENTA'}
          </h1>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mt-1">
            REPORTE DE CORTE DE CAJA (CIERRE DE TURNO)
          </h2>
          <div className="text-xs text-slate-600 font-medium mt-2 flex justify-center gap-4">
            <span><strong>Fecha:</strong> {formattedDate}</span>
            <span><strong>Hora:</strong> {formattedTime}</span>
            <span><strong>Cajero:</strong> {clerkDisplayName}</span>
          </div>
          {isClosedByAdmin && (
            <p className="text-xs font-bold text-amber-800 mt-1">
              * Cierre forzado por administrador: {adminName}
            </p>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 print:overflow-visible print:p-6">

          {/* 1. Resumen de Caja */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-600" />
              <span>Resumen de Cuadre de Caja</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Efectivo Inicial</span>
                <span className="text-sm font-black font-mono text-slate-800">
                  RD$ {(closure.initialCash ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-emerald-700 block mb-1">+ Ventas en Efectivo</span>
                <span className="text-sm font-black font-mono text-emerald-800">
                  RD$ {salesMetrics.cash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-rose-50/60 border border-rose-200 p-3.5 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-rose-700 block mb-1">- Egresos del Turno</span>
                <span className="text-sm font-black font-mono text-rose-800">
                  RD$ {totalMovementsAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {cashRefundsAmount > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-amber-700 block mb-1">- Devoluciones Efectivo</span>
                  <span className="text-sm font-black font-mono text-amber-800">
                    RD$ {cashRefundsAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Efectivo Esperado</span>
                <span className="text-sm font-black font-mono text-slate-800">
                  RD$ {closure.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-indigo-700 block mb-1">Efectivo Contado</span>
                <span className="text-sm font-black font-mono text-indigo-900">
                  RD$ {closure.actualCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className={`border p-3.5 rounded-2xl ${
                closure.difference < 0 
                  ? 'bg-rose-50 border-rose-300 text-rose-900' 
                  : closure.difference > 0 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <span className="text-[10px] font-black uppercase opacity-80 block mb-1">Diferencia</span>
                <span className="text-sm font-black font-mono flex items-center gap-1">
                  {closure.difference < 0 && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                  {closure.difference > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  RD$ {closure.difference.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-indigo-600 text-white p-3.5 rounded-2xl shadow-md">
                <span className="text-[10px] font-black uppercase opacity-80 block mb-1">Dinero a Retirar</span>
                <span className="text-sm font-black font-mono">
                  RD$ {calculatedCashToRemove.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Discrepancia Terminal de Tarjetas (si aplica) */}
          {(closure.cardTerminalReportedAmount !== undefined || closure.cardTerminalMatched !== undefined) && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-amber-700" />
                  <span>Control de Terminal de Tarjetas</span>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  closure.cardTerminalMatched
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  {closure.cardTerminalMatched ? '✓ Cuadre Correcto' : '⚠️ Discrepancia'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Reportado en Voucher</span>
                  <span className="font-extrabold font-mono text-slate-800">
                    RD$ {(closure.cardTerminalReportedAmount ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Sistema POS</span>
                  <span className="font-extrabold font-mono text-slate-800">
                    RD$ {(closure.cardTerminalSystemAmount ?? salesMetrics.card).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Diferencia Vouchers</span>
                  <span className={`font-extrabold font-mono ${
                    ((closure.cardTerminalReportedAmount ?? 0) - (closure.cardTerminalSystemAmount ?? salesMetrics.card)) !== 0
                      ? 'text-rose-600'
                      : 'text-emerald-600'
                  }`}>
                    RD$ {((closure.cardTerminalReportedAmount ?? 0) - (closure.cardTerminalSystemAmount ?? salesMetrics.card)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3. Desglose de Ventas por Método de Pago */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span>Ventas del Turno por Método de Pago</span>
              </h4>
              <span className="text-xs font-bold text-slate-500">
                Total Facturado: <strong className="text-slate-900 font-mono">RD$ {salesMetrics.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong> ({salesMetrics.count} facturas)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center gap-2.5">
                <Coins className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Efectivo</span>
                  <span className="text-xs font-extrabold font-mono text-slate-800">
                    RD$ {salesMetrics.cash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Tarjeta</span>
                  <span className="text-xs font-extrabold font-mono text-slate-800">
                    RD$ {salesMetrics.card.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center gap-2.5">
                <Wallet className="w-4 h-4 text-purple-600 shrink-0" />
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Transferencia</span>
                  <span className="text-xs font-extrabold font-mono text-slate-800">
                    RD$ {salesMetrics.transfer.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center gap-2.5">
                <Users className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Crédito</span>
                  <span className="text-xs font-extrabold font-mono text-slate-800">
                    RD$ {salesMetrics.credit.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {salesMetrics.qr > 0 && (
                <div className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center gap-2.5">
                  <QrCode className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">QR</span>
                    <span className="text-xs font-extrabold font-mono text-slate-800">
                      RD$ {salesMetrics.qr.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Lista de Ventas Individuales del Turno */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Lista de Ventas del Turno ({shiftSales.length})
            </h4>

            {shiftSales.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                No se registraron ventas en este turno.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="max-h-56 overflow-y-auto print:max-h-none">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-extrabold text-[10px] sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Ticket</th>
                        <th className="py-2.5 px-3">Hora</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Método</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {shiftSales.map((sale) => {
                        const dateVal = sale.createdAt || sale.date;
                        const timeStr = dateVal
                          ? new Date(dateVal).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                          : '--:--';

                        return (
                          <tr key={sale.id} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-bold text-slate-800">
                              #{sale.ticketNumber}
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px] font-mono">
                              {timeStr}
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-semibold truncate max-w-[150px]">
                              {sale.customerName || 'Público General'}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                                sale.paymentMethod === 'cash' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : sale.paymentMethod === 'card'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : sale.paymentMethod === 'transfer'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : sale.paymentMethod === 'credit' || sale.isCredit
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                {isMixedSale(sale) ? 'Mixto' : sale.paymentMethod}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-black font-mono text-slate-900">
                              RD$ {sale.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 5. Ventas a Crédito del Turno */}
          {shiftCreditSales.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-600" />
                <span>Ventas a Crédito ({shiftCreditSales.length})</span>
              </h4>

              <div className="border border-amber-200 rounded-2xl overflow-hidden bg-amber-50/30">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-100/60 text-amber-900 uppercase font-extrabold text-[10px] border-b border-amber-200">
                    <tr>
                      <th className="py-2.5 px-3">Ticket</th>
                      <th className="py-2.5 px-3">Hora</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3 text-right">Monto Crédito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 font-medium">
                    {shiftCreditSales.map((cs) => (
                      <tr key={cs.id} className="hover:bg-amber-50/80">
                        <td className="py-2 px-3 font-bold text-slate-800">#{cs.ticketNumber}</td>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{cs.timeStr}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{cs.customerName}</td>
                        <td className="py-2 px-3 text-right font-black font-mono text-amber-900">
                          RD$ {cs.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. Egresos Detallados del Turno */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <span>Egresos / Salidas de Caja del Turno ({shiftMovements.length})</span>
            </h4>

            {shiftMovements.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                No hubo egresos registrados durante este turno.
              </p>
            ) : (
              <div className="border border-rose-200 rounded-2xl overflow-hidden bg-rose-50/20">
                <table className="w-full text-left text-xs">
                  <thead className="bg-rose-100/60 text-rose-900 uppercase font-extrabold text-[10px] border-b border-rose-200">
                    <tr>
                      <th className="py-2.5 px-3">Hora</th>
                      <th className="py-2.5 px-3">Concepto / Motivo</th>
                      <th className="py-2.5 px-3">Categoría</th>
                      <th className="py-2.5 px-3">Empleado</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100 font-medium">
                    {shiftMovements.map((m) => {
                      const mTime = new Date(m.createdAt || m.date).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const empName = m.employeeName || (employees.find((e) => e.id === m.employeeId)?.name || 'Cajero');

                      return (
                        <tr key={m.id} className="hover:bg-rose-50/50">
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{mTime}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{m.description || m.reason || 'Egreso de caja'}</td>
                          <td className="py-2 px-3 text-slate-600 text-[11px]">{m.category || 'General'}</td>
                          <td className="py-2 px-3 text-slate-700">{empName}</td>
                          <td className="py-2 px-3 text-right font-black font-mono text-rose-700">
                            RD$ {m.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 7. Devoluciones Detalladas del Turno */}
          {shiftRefunds.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>Devoluciones a Clientes del Turno ({shiftRefunds.length})</span>
              </h4>

              <div className="border border-amber-200 rounded-2xl overflow-hidden bg-amber-50/20">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-100/60 text-amber-900 uppercase font-extrabold text-[10px] border-b border-amber-200">
                    <tr>
                      <th className="py-2.5 px-3">Hora</th>
                      <th className="py-2.5 px-3">Ticket</th>
                      <th className="py-2.5 px-3">Motivo</th>
                      <th className="py-2.5 px-3">Método</th>
                      <th className="py-2.5 px-3 text-right">Monto Devuelto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 font-medium">
                    {shiftRefunds.map((r) => {
                      const rTime = new Date(r.createdAt || r.date).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <tr key={r.id} className="hover:bg-amber-50/50">
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{rTime}</td>
                          <td className="py-2 px-3 font-bold text-slate-800">#{r.ticketNumber || r.saleId || '--'}</td>
                          <td className="py-2 px-3 text-slate-700">{r.reason || 'Devolución de productos'}</td>
                          <td className="py-2 px-3 text-slate-600 uppercase text-[10px] font-bold">{r.paymentMethod || 'Efectivo'}</td>
                          <td className="py-2 px-3 text-right font-black font-mono text-amber-900">
                            RD$ {r.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer (screen only) */}
        <div className="p-4 sm:p-5 border-t border-slate-150 bg-slate-50/80 flex items-center justify-between shrink-0 print:hidden">
          <span className="text-xs text-slate-500 font-semibold">
            ID de Corte: <code className="font-mono text-slate-700">{closure.id.slice(0, 8)}</code>
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Cierre</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
