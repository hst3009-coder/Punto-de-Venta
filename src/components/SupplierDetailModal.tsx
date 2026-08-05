import React, { useState, useMemo } from 'react';
import { 
  X, 
  Building2, 
  ShoppingBag, 
  DollarSign, 
  RotateCcw, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ArrowUpRight,
  CreditCard,
  Banknote,
  Receipt,
  Tag
} from 'lucide-react';
import { 
  PurchaseOrder, 
  PurchaseReceipt, 
  AccountPayable, 
  PayablePayment, 
  Movement, 
  SupplierReturn 
} from '../types';
import { getTotalPayablesBalance } from '../lib/payableDebt';
import { getStringValue } from '../lib/normalize';

interface SupplierDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierName: string | null;
  purchaseOrders?: PurchaseOrder[];
  purchaseReceipts?: PurchaseReceipt[];
  accountsPayable?: AccountPayable[];
  payablePayments?: PayablePayment[];
  movements?: Movement[];
  supplierReturns?: SupplierReturn[];
}

export const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  isOpen,
  onClose,
  supplierName,
  purchaseOrders = [],
  purchaseReceipts = [],
  accountsPayable = [],
  payablePayments = [],
  movements = [],
  supplierReturns = []
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'payments' | 'returns'>('orders');

  const displaySupplierName = useMemo(() => {
    return getStringValue(supplierName).trim();
  }, [supplierName]);

  const normalizedSupplierName = useMemo(() => {
    return displaySupplierName.toLowerCase();
  }, [displaySupplierName]);

  // 1. Purchase Orders
  const supplierPOs = useMemo(() => {
    if (!normalizedSupplierName) return [];
    return purchaseOrders.filter(
      po => getStringValue(po.supplierName).trim().toLowerCase() === normalizedSupplierName
    );
  }, [purchaseOrders, normalizedSupplierName]);

  // 2. Purchase Receipts
  const supplierReceipts = useMemo(() => {
    if (!normalizedSupplierName) return [];
    const poIds = new Set(supplierPOs.map(po => po.id));
    return purchaseReceipts.filter(pr => poIds.has(pr.purchaseOrderId));
  }, [purchaseReceipts, supplierPOs, normalizedSupplierName]);

  // Total purchased historically (Sum of PurchaseReceipt.totalAmount)
  const totalPurchased = useMemo(() => {
    return supplierReceipts.reduce((sum, pr) => sum + (pr.totalAmount || 0), 0);
  }, [supplierReceipts]);

  // 3. Accounts Payable
  const supplierPayables = useMemo(() => {
    if (!normalizedSupplierName) return [];
    return accountsPayable.filter(
      ap => getStringValue(ap.supplierName).trim().toLowerCase() === normalizedSupplierName
    );
  }, [accountsPayable, normalizedSupplierName]);

  // Current debt
  const totalDebt = useMemo(() => {
    return getTotalPayablesBalance(supplierPayables, payablePayments);
  }, [supplierPayables, payablePayments]);

  // 4. Supplier Returns
  const supplierReturnsList = useMemo(() => {
    if (!normalizedSupplierName) return [];
    return supplierReturns.filter(
      sr => getStringValue(sr.supplierName).trim().toLowerCase() === normalizedSupplierName
    );
  }, [supplierReturns, normalizedSupplierName]);

  // Total returns cost sum
  const totalReturnsCost = useMemo(() => {
    return supplierReturnsList.reduce((sum, sr) => sum + (sr.cost || 0), 0);
  }, [supplierReturnsList]);

  // 5. Consolidated Payment History (payablePayments + movements)
  const paymentHistory = useMemo(() => {
    if (!normalizedSupplierName) return [];

    const payableIds = new Set(supplierPayables.map(p => p.id));
    const payableMap = new Map<string, AccountPayable>(supplierPayables.map(p => [p.id, p]));

    // Payments registered against Accounts Payable
    const pPayments = payablePayments
      .filter(pay => payableIds.has(pay.payableId))
      .map(pay => {
        const payable = payableMap.get(pay.payableId);
        return {
          id: pay.id,
          date: pay.date || pay.createdAt || '',
          amount: pay.amount,
          paymentMethod: pay.paymentMethod,
          concept: payable?.concept ? `Pago: ${payable.concept}` : `Pago a Cuenta por Pagar`,
          sourceType: 'payable_payment' as const
        };
      });

    // Movements registered directly or from payments
    const directMovements = movements
      .filter(m => {
        if (m.expenseType !== 'pago_factura') return false;
        const movSupplier = getStringValue(m.supplierName).trim().toLowerCase();
        const movConcept = getStringValue(m.concept).trim().toLowerCase();

        const matchesSupplier = movSupplier === normalizedSupplierName || movConcept.includes(normalizedSupplierName);
        if (!matchesSupplier) return false;

        // Skip duplicate cash movement entries automatically created when paying a payable
        if (movConcept.startsWith('pago a proveedor:')) {
          const mDate = (m.date || m.createdAt || '').split('T')[0];
          const hasMatchingPayablePayment = pPayments.some(
            pp => pp.amount === m.amount && (pp.date || '').split('T')[0] === mDate && pp.paymentMethod === 'cash'
          );
          if (hasMatchingPayablePayment) {
            return false;
          }
        }

        return true;
      })
      .map(m => ({
        id: m.id,
        date: m.date || m.createdAt || '',
        amount: m.amount,
        paymentMethod: m.paymentMethod,
        concept: getStringValue(m.concept) + (m.invoiceNumber ? ` (Factura #${m.invoiceNumber})` : ''),
        sourceType: 'movement' as const
      }));

    const combined = [...pPayments, ...directMovements];
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return combined;
  }, [normalizedSupplierName, supplierPayables, payablePayments, movements]);

  if (!isOpen || !supplierName) return null;

  const renderPaymentMethodBadge = (method: string) => {
    switch (method) {
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Banknote className="w-3 h-3" /> Efectivo
          </span>
        );
      case 'card':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <CreditCard className="w-3 h-3" /> Tarjeta
          </span>
        );
      case 'transfer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <ArrowUpRight className="w-3 h-3" /> Transferencia
          </span>
        );
      case 'credit_note':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Tag className="w-3 h-3" /> Nota de Crédito
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {method}
          </span>
        );
    }
  };

  const renderOrderStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Abierta
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" /> Parcial
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Completada
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3 h-3" /> Cancelada
          </span>
        );
    }
  };

  const renderReturnStatusBadge = (status: SupplierReturn['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Pendiente
          </span>
        );
      case 'credited':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Acreditada
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl w-full max-w-4xl h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border-0 sm:border border-slate-100 animate-scale-up">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-indigo-300 block">Ficha Consolidada</span>
              <h2 className="text-xl font-extrabold text-white tracking-tight">{displaySupplierName}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Cards */}
        <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-200 shrink-0 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto sm:overflow-visible max-h-[30vh] sm:max-h-none">
          
          {/* Card 1: Total Comprado */}
          <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-0.5">
                Total Comprado (Histórico)
              </span>
              <div className="text-lg font-black text-slate-900">
                RD$ {totalPurchased.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {supplierReceipts.length} recepciones de compra
              </span>
            </div>
          </div>

          {/* Card 2: Deuda Actual */}
          <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className={`p-3 rounded-xl shrink-0 ${totalDebt > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-0.5">
                Deuda Actual
              </span>
              <div className={`text-lg font-black ${totalDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                RD$ {totalDebt.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {supplierPayables.filter(p => p.status !== 'paid').length} cuentas pendientes
              </span>
            </div>
          </div>

          {/* Card 3: Devoluciones */}
          <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider block mb-0.5">
                Devoluciones Registradas
              </span>
              <div className="text-lg font-black text-slate-900">
                RD$ {totalReturnsCost.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                {supplierReturnsList.length} registro(s) de devolución
              </span>
            </div>
          </div>

        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 bg-white border-b border-slate-200 shrink-0 flex items-center gap-2 pt-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-3.5 text-xs font-extrabold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'orders'
                ? 'border-indigo-600 text-indigo-600 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Órdenes de Compra ({supplierPOs.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`pb-3 px-3.5 text-xs font-extrabold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'payments'
                ? 'border-indigo-600 text-indigo-600 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Historial de Pagos ({paymentHistory.length})
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            className={`pb-3 px-3.5 text-xs font-extrabold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'returns'
                ? 'border-indigo-600 text-indigo-600 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Devoluciones ({supplierReturnsList.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* TAB 1: Órdenes de Compra */}
          {activeTab === 'orders' && (
            <div>
              {supplierPOs.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">No hay órdenes de compra registradas para este proveedor.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Items / Productos</th>
                        <th className="py-3 px-4">Solicitante</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {supplierPOs.map((po) => {
                        const totalItems = (po.items || []).reduce((sum, item) => sum + (item.quantityOrdered || 0), 0);
                        return (
                          <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {po.createdAt ? new Date(po.createdAt).toLocaleDateString('es-DO', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">
                                {po.items?.length || 0} producto(s) ({totalItems} unids.)
                              </div>
                              <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                {po.items?.map(i => i.productName).join(', ')}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-600">
                              {po.employeeName || 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {renderOrderStatusBadge(po.status)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Historial de Pagos */}
          {activeTab === 'payments' && (
            <div>
              {paymentHistory.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">No hay pagos ni egresos de facturas registrados para este proveedor.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Concepto / Referencia</th>
                        <th className="py-3 px-4">Método de Pago</th>
                        <th className="py-3 px-4 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {paymentHistory.map((pay) => (
                        <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {pay.date ? new Date(pay.date).toLocaleDateString('es-DO', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800 max-w-md truncate">
                              {pay.concept}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {renderPaymentMethodBadge(pay.paymentMethod)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                            RD$ {pay.amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Devoluciones */}
          {activeTab === 'returns' && (
            <div>
              {supplierReturnsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <RotateCcw className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">No hay devoluciones a proveedor registradas.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Producto</th>
                        <th className="py-3 px-4 text-center">Cant.</th>
                        <th className="py-3 px-4">Razón</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                        <th className="py-3 px-4 text-right">Costo Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                      {supplierReturnsList.map((ret) => (
                        <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {ret.date ? new Date(ret.date).toLocaleDateString('es-DO', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {getStringValue(ret.productName)}
                          </td>
                          <td className="py-3 px-4 text-center font-black text-slate-900">
                            {ret.quantity}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {getStringValue(ret.reason)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {renderReturnStatusBadge(ret.status)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                            RD$ {(ret.cost || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
