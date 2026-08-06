import React, { useState, useMemo } from 'react';
import { Sale, Product, PaymentMethod, StoreIdentity, CartItem, Employee, Closure, CustomerRefund, CreditNote, DashboardConfig, Customer } from '../types';
import { X, Receipt } from 'lucide-react';
import { firestoreService } from '../lib/firebase';
import { increment } from 'firebase/firestore';
import { getSaleTimestamp } from '../lib/dates';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { isFuzzyMatch } from '../lib/textSearch';
import { TicketsSearchList } from './tickets/TicketsSearchList';
import { CancelSaleFlow } from './tickets/CancelSaleFlow';
import { ReturnItemFlow } from './tickets/ReturnItemFlow';
import { ReprintView } from './tickets/ReprintView';
import { EditPaymentModal } from './tickets/EditPaymentModal';

interface TicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesHistory: Sale[];
  onUpdateSalesHistory: (updatedSales: Sale[]) => void;
  products: Product[];
  onUpdateProducts: (updatedProducts: Product[]) => void;
  storeIdentity: StoreIdentity;
  clerkName: string;
  currentEmployee: Employee | null;
  closures: Closure[];
  customers?: Customer[];
  customerRefunds?: CustomerRefund[];
  onAddCustomerRefund?: (refund: CustomerRefund) => void;
  creditNotes?: CreditNote[];
  onAddCreditNote?: (note: CreditNote) => void;
  dashboardConfig?: DashboardConfig;
}

export const TicketsModal: React.FC<TicketsModalProps> = ({
  isOpen,
  onClose,
  salesHistory,
  onUpdateSalesHistory,
  products,
  onUpdateProducts,
  storeIdentity,
  clerkName,
  currentEmployee,
  closures,
  customers = [],
  customerRefunds = [],
  onAddCustomerRefund,
  creditNotes = [],
  onAddCreditNote,
  dashboardConfig,
}) => {
  // Active states
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refundMethodChoice, setRefundMethodChoice] = useState<'cash' | 'credit_note'>('cash');
  const [createdCreditNote, setCreatedCreditNote] = useState<CreditNote | null>(null);

  // Entire Invoice Cancellation state
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelJustification, setCancelJustification] = useState('');
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState('');

  // Individual item return state
  const [returningItem, setReturningItem] = useState<CartItem | null>(null);
  const [returningItemQty, setReturningItemQty] = useState(1);
  const [returningItemReason, setReturningItemReason] = useState('');
  const [returningItemError, setReturningItemError] = useState('');

  // Payment editing state
  const [isEditingPayment, setIsEditingPayment] = useState(false);

  // Return ticket to display/print (null means original ticket is displayed)
  const [activeReceiptView, setActiveReceiptView] = useState<'original' | 'return'>('original');

  // Filter mode: 'shift' (default) or 'date' (calendar filter)
  const [filterType, setFilterType] = useState<'shift' | 'date'>('shift');

  // Custom date picker filter state (defaults to today's date in YYYY-MM-DD format)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const todayStrISO = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const isSelectedDateToday = selectedDateStr === todayStrISO;

  // Formatting selected date nicely in Spanish (e.g., "18 de julio de 2026")
  const formattedFilterDate = useMemo(() => {
    if (!selectedDateStr) return '';
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDateStr]);

  // Check if sale is from the selected filter date
  const isSaleFromSelectedDate = (sale: Sale) => {
    if (!selectedDateStr) return true;

    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const filterDateOnly = new Date(year, month - 1, day).toDateString();

    if (sale.createdAt) {
      return new Date(sale.createdAt).toDateString() === filterDateOnly;
    }
    try {
      const parts = sale.date.split(' ');
      const datePart = parts[0].replace(',', '');
      const [d, m, y] = datePart.split('/');
      const saleDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      return saleDate.toDateString() === filterDateOnly;
    } catch (e) {
      return false;
    }
  };

  // Calculate current shift sales
  const shiftSales = useMemo(() => {
    if (currentEmployee && closures) {
      const empClosures = closures.filter((c) => c.employeeId === currentEmployee.id);
      let lastClosure: Closure | null = null;
      empClosures.forEach((current) => {
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

      return salesHistory.filter((sale) => {
        if (!sale.date) return false;
        if (sale.soldBy?.id !== currentEmployee.id) return false;

        return getSaleTimestamp(sale) > lastClosureTime;
      });
    } else {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayTime = startOfToday.getTime();

      return salesHistory.filter((sale) => {
        if (!sale.date) return false;
        return getSaleTimestamp(sale) >= startOfTodayTime;
      });
    }
  }, [salesHistory, currentEmployee, closures]);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);

  // Filtered sales based on filterType and search query
  const filteredSales = useMemo(() => {
    return salesHistory.filter((sale) => {
      const cleanQuery = debouncedSearchQuery.trim();

      if (cleanQuery === '') {
        if (filterType === 'shift') {
          return shiftSales.some((s) => s.id === sale.id);
        } else {
          return isSaleFromSelectedDate(sale);
        }
      }

      if (searchQuery === ' ') {
        return true;
      }

      const matchTicket = isFuzzyMatch(cleanQuery, sale.ticketNumber);
      const matchAmount = sale.total.toFixed(2).includes(cleanQuery.toLowerCase());
      const matchProduct = sale.items.some((item) =>
        isFuzzyMatch(cleanQuery, item.product.name)
      );

      const matchesSearch = matchTicket || matchAmount || matchProduct;

      if (filterType === 'shift') {
        return matchesSearch && shiftSales.some((s) => s.id === sale.id);
      } else {
        return matchesSearch && isSaleFromSelectedDate(sale);
      }
    });
  }, [salesHistory, searchQuery, debouncedSearchQuery, selectedDateStr, filterType, shiftSales]);

  if (!isOpen) return null;

  // Handle Full Invoice Cancellation (Delete/Void)
  const handleOpenCancelPrompt = (saleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCancellingSaleId(saleId);
    setCancelJustification('');
    setCancelError('');
    setIsCancelling(true);
  };

  const handleConfirmCancellation = async () => {
    if (!cancellingSaleId) return;
    if (!cancelJustification.trim()) {
      setCancelError('La justificación es obligatoria para cancelar.');
      return;
    }

    const sale = salesHistory.find((s) => s.id === cancellingSaleId);
    if (!sale) return;

    const operations: Array<{
      type: 'set' | 'update' | 'delete';
      collectionName: string;
      id: string;
      data?: any;
      merge?: boolean;
    }> = [];

    for (const item of sale.items) {
      const prod = products.find((p) => p.id === item.product.id);
      if (prod) {
        const alreadyReturned =
          (sale as any).returnedItems
            ?.filter((r: any) => r.productId === item.product.id)
            .reduce((sum: number, r: any) => sum + r.quantity, 0) || 0;
        const qtyToRestore = Math.max(0, item.quantity - alreadyReturned);
        if (qtyToRestore > 0) {
          operations.push({
            type: 'update',
            collectionName: 'products',
            id: item.product.id,
            data: { stock: increment(qtyToRestore) },
          });
        }
      }
    }

    const cancelledSaleData = {
      ...sale,
      isCancelled: true,
      cancelReason: cancelJustification.trim(),
      cancelledAt: new Date().toISOString(),
    };

    operations.push({
      type: 'set',
      collectionName: 'sales',
      id: cancelledSaleData.id,
      data: cancelledSaleData,
      merge: true,
    });

    try {
      await firestoreService.runBatch(operations);

      const updatedProducts = products.map((p) => {
        const saleItem = sale.items.find((item) => item.product.id === p.id);
        if (saleItem) {
          const alreadyReturned =
            (sale as any).returnedItems
              ?.filter((r: any) => r.productId === p.id)
              .reduce((sum: number, r: any) => sum + r.quantity, 0) || 0;
          const qtyToRestore = Math.max(0, saleItem.quantity - alreadyReturned);
          return { ...p, stock: p.stock + qtyToRestore };
        }
        return p;
      });
      onUpdateProducts(updatedProducts);
      localStorage.setItem('pos_products', JSON.stringify(updatedProducts));

      const updatedSales = salesHistory.map((s) =>
        s.id === cancellingSaleId ? cancelledSaleData : s
      );
      onUpdateSalesHistory(updatedSales);
      localStorage.setItem('pos_sales', JSON.stringify(updatedSales));

      setSelectedSale(cancelledSaleData);
      setActiveReceiptView('return');
      setIsCancelling(false);
      setCancellingSaleId(null);
    } catch (err) {
      console.error('Error updating sale cancellation in Firestore:', err);
      setCancelError('Error al cancelar la factura en la base de datos.');
    }
  };

  // Handle Edit Payment and Customer
  const handleSaveEditedPayment = async (updatedSale: Sale) => {
    const operations = [
      {
        type: 'set' as const,
        collectionName: 'sales',
        id: updatedSale.id,
        data: updatedSale,
        merge: false,
      },
    ];

    await firestoreService.runBatch(operations);

    const updatedSales = salesHistory.map((s) => (s.id === updatedSale.id ? updatedSale : s));
    onUpdateSalesHistory(updatedSales);
    localStorage.setItem('pos_sales', JSON.stringify(updatedSales));

    setSelectedSale(updatedSale);
    setIsEditingPayment(false);
  };

  // Open Individual Item Return
  const handleOpenItemReturn = (item: CartItem) => {
    const alreadyReturned =
      selectedSale?.returnedItems
        ?.filter((r: any) => r.productId === item.product.id)
        .reduce((sum: number, r: any) => sum + r.quantity, 0) || 0;

    const maxReturnable = item.quantity - alreadyReturned;
    if (maxReturnable <= 0) return;

    setReturningItem(item);
    setReturningItemQty(maxReturnable);
    setReturningItemReason('');
    setReturningItemError('');
  };

  // Confirm Individual Item Return
  const handleConfirmItemReturn = async () => {
    if (!selectedSale || !returningItem) return;

    const alreadyReturned =
      selectedSale.returnedItems
        ?.filter((r: any) => r.productId === returningItem.product.id)
        .reduce((sum: number, r: any) => sum + r.quantity, 0) || 0;
    const maxReturnable = returningItem.quantity - alreadyReturned;

    if (returningItemQty <= 0 || returningItemQty > maxReturnable) {
      setReturningItemError(`Cantidad inválida. Puede devolver máximo ${maxReturnable} unidades.`);
      return;
    }

    if (!returningItemReason.trim()) {
      setReturningItemError('Debe ingresar un motivo para la devolución.');
      return;
    }

    const returnRecord = {
      productId: returningItem.product.id,
      productName: returningItem.product.name,
      quantity: returningItemQty,
      price: returningItem.product.price,
      reason: returningItemReason.trim(),
      date: new Date().toLocaleString('es-ES', { hour12: false }),
    };

    const originalReturnedList = (selectedSale as any).returnedItems || [];
    const updatedReturnedList = [...originalReturnedList, returnRecord];

    let allReturned = true;
    for (const item of selectedSale.items) {
      const totalReturnedForThisItem = updatedReturnedList
        .filter((r: any) => r.productId === item.product.id)
        .reduce((sum: number, r: any) => sum + r.quantity, 0);
      if (totalReturnedForThisItem < item.quantity) {
        allReturned = false;
        break;
      }
    }

    const updatedSale = {
      ...selectedSale,
      returnedItems: updatedReturnedList,
      isCancelled: allReturned ? true : selectedSale.isCancelled,
      cancelReason: allReturned
        ? 'Devolución completa de todos los artículos.'
        : (selectedSale as any).cancelReason,
    };

    const isCreditSale = Boolean(
      (selectedSale.paymentMethod === 'credit' ||
        selectedSale.isCredit ||
        (selectedSale.paymentBreakdown && selectedSale.paymentBreakdown.some((b) => b.method === 'credit'))) &&
        selectedSale.customerId
    );

    const refundAmount = returningItem.product.price * returningItemQty;
    const now = new Date();
    const refundId = crypto.randomUUID();

    let createdCn: CreditNote | null = null;
    let refundMethod: 'cash' | 'credit_note' | 'credit_reduction' = isCreditSale
      ? 'credit_reduction'
      : refundMethodChoice;

    if (!isCreditSale && refundMethodChoice === 'credit_note') {
      let code = '';
      let exists = true;
      while (exists) {
        code = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
        exists = creditNotes.some((cn) => cn.code === code);
      }

      createdCn = {
        id: crypto.randomUUID(),
        code,
        originalAmount: refundAmount,
        remainingBalance: refundAmount,
        status: 'active',
        createdFromRefundId: refundId,
        employeeId: currentEmployee?.id,
        employeeName: currentEmployee?.name || clerkName,
        createdAt: now.toISOString(),
      };
    }

    const refundRecord: CustomerRefund = {
      id: refundId,
      saleId: selectedSale.id,
      ticketNumber: selectedSale.ticketNumber,
      amount: refundAmount,
      method: refundMethod,
      creditNoteId: createdCn ? createdCn.id : undefined,
      customerId: isCreditSale ? selectedSale.customerId : undefined,
      reason: returningItemReason.trim(),
      date: now.toLocaleDateString('es-DO'),
      employeeId: currentEmployee?.id,
      employeeName: currentEmployee?.name || clerkName,
      createdAt: now.toISOString(),
    };

    const operations: Array<{
      type: 'set' | 'update' | 'delete';
      collectionName: string;
      id: string;
      data?: any;
      merge?: boolean;
    }> = [];

    const prod = products.find((p) => p.id === returningItem.product.id);
    if (prod) {
      operations.push({
        type: 'update',
        collectionName: 'products',
        id: returningItem.product.id,
        data: { stock: increment(returningItemQty) },
      });
    }

    operations.push({
      type: 'set',
      collectionName: 'sales',
      id: selectedSale.id,
      data: updatedSale,
      merge: true,
    });

    if (createdCn) {
      operations.push({
        type: 'set',
        collectionName: 'creditNotes',
        id: createdCn.id,
        data: createdCn,
        merge: true,
      });
    }

    operations.push({
      type: 'set',
      collectionName: 'customerRefunds',
      id: refundRecord.id,
      data: refundRecord,
      merge: true,
    });

    try {
      await firestoreService.runBatch(operations);

      const updatedProducts = products.map((p) => {
        if (p.id === returningItem.product.id) {
          return { ...p, stock: p.stock + returningItemQty };
        }
        return p;
      });
      onUpdateProducts(updatedProducts);
      localStorage.setItem('pos_products', JSON.stringify(updatedProducts));

      const updatedSales = salesHistory.map((s) => (s.id === selectedSale.id ? updatedSale : s));
      onUpdateSalesHistory(updatedSales);
      localStorage.setItem('pos_sales', JSON.stringify(updatedSales));

      if (createdCn) {
        if (onAddCreditNote) {
          onAddCreditNote(createdCn);
        }
        setCreatedCreditNote(createdCn);
      }

      if (onAddCustomerRefund) {
        onAddCustomerRefund(refundRecord);
      }

      setSelectedSale(updatedSale);
      setReturningItem(null);
      setActiveReceiptView('return');
    } catch (err) {
      console.error('Error processing item return batch in Firestore:', err);
      setReturningItemError('Error al guardar la devolución en la base de datos.');
    }
  };

  // Helper to format payment method badge
  const getPaymentBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'cash':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">💵 Efectivo</span>;
      case 'card':
        return <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">💳 Tarjeta</span>;
      case 'transfer':
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">🏦 Transf.</span>;
      case 'qr':
        return <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">📱 QR Copec</span>;
      case 'mixed':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">🔀 Mixto</span>;
      case 'credit':
        return <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">👥 Crédito</span>;
      default:
        return null;
    }
  };

  // Calculate total amount refunded for a returned invoice
  const getRefundTotal = (sale: Sale) => {
    if (sale.isCancelled && !(sale as any).returnedItems) {
      return sale.total;
    }
    const list = (sale as any).returnedItems || [];
    return list.reduce((sum: number, r: any) => sum + r.price * r.quantity, 0);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full h-[88vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Historial de Facturación</h2>
              <p className="text-xs text-slate-500 font-semibold">
                Consulte, reimprima, edite pagos y realice devoluciones de mercancía
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Outer Split Layout */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-50/30">
          <TicketsSearchList
            filteredSales={filteredSales}
            salesHistory={salesHistory}
            shiftSales={shiftSales}
            filterType={filterType}
            setFilterType={setFilterType}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedDateStr={selectedDateStr}
            setSelectedDateStr={setSelectedDateStr}
            todayStrISO={todayStrISO}
            isSelectedDateToday={isSelectedDateToday}
            formattedFilterDate={formattedFilterDate}
            currentEmployee={currentEmployee}
            clerkName={clerkName}
            isSaleFromSelectedDate={isSaleFromSelectedDate}
            selectedSale={selectedSale}
            onSelectSale={(sale) => {
              setSelectedSale(sale);
              setActiveReceiptView('original');
              setIsEditingPayment(false);
            }}
            onOpenCancelPrompt={handleOpenCancelPrompt}
            getPaymentBadge={getPaymentBadge}
            getRefundTotal={getRefundTotal}
          />

          <ReprintView
            selectedSale={selectedSale}
            activeReceiptView={activeReceiptView}
            setActiveReceiptView={setActiveReceiptView}
            clerkName={clerkName}
            storeIdentity={storeIdentity}
            dashboardConfig={dashboardConfig}
            customers={customers}
            closures={closures}
            isEditingPayment={isEditingPayment}
            setIsEditingPayment={setIsEditingPayment}
            getPaymentBadge={getPaymentBadge}
            handleOpenItemReturn={handleOpenItemReturn}
          />
        </div>
      </div>

      <EditPaymentModal
        isOpen={isEditingPayment}
        onClose={() => setIsEditingPayment(false)}
        selectedSale={selectedSale}
        customers={customers}
        products={products}
        dashboardConfig={dashboardConfig}
        onSavePayment={handleSaveEditedPayment}
      />

      <CancelSaleFlow
        isCancelling={isCancelling}
        cancelJustification={cancelJustification}
        setCancelJustification={setCancelJustification}
        cancelError={cancelError}
        setCancelError={setCancelError}
        onClose={() => setIsCancelling(false)}
        onConfirmCancellation={handleConfirmCancellation}
      />

      <ReturnItemFlow
        returningItem={returningItem}
        selectedSale={selectedSale}
        returningItemQty={returningItemQty}
        setReturningItemQty={setReturningItemQty}
        returningItemReason={returningItemReason}
        setReturningItemReason={setReturningItemReason}
        returningItemError={returningItemError}
        setReturningItemError={setReturningItemError}
        refundMethodChoice={refundMethodChoice}
        setRefundMethodChoice={setRefundMethodChoice}
        createdCreditNote={createdCreditNote}
        setCreatedCreditNote={setCreatedCreditNote}
        onCloseReturnItem={() => setReturningItem(null)}
        onConfirmItemReturn={handleConfirmItemReturn}
      />
    </div>
  );
};
