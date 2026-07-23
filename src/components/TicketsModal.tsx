import React, { useState, useMemo } from 'react';
import { Sale, Product, PaymentMethod, StoreIdentity, CartItem, Employee, Closure, CustomerRefund, CreditNote, DashboardConfig } from '../types';
import { 
  X, Search, Calendar, Trash2, Printer, Check, Undo2, 
  CreditCard, Wallet, QrCode, Coins, ArrowRight, Receipt, 
  Edit, HelpCircle, RefreshCw, AlertTriangle, Tag
} from 'lucide-react';
import { firestoreService } from '../lib/firebase';
import { getSaleTimestamp } from '../lib/dates';
import { ReceiptTemplate } from './ReceiptTemplate';

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
  // 'full' for full cancellation, or specific item details
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
      year: 'numeric'
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
      // Fallback parse "18/7/2026 05:43:27"
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
      // Fallback: all of today
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayTime = startOfToday.getTime();

      return salesHistory.filter(sale => {
        if (!sale.date) return false;
        return getSaleTimestamp(sale) >= startOfTodayTime;
      });
    }
  }, [salesHistory, currentEmployee, closures]);

  // Filtered sales based on filterType and search query
  const filteredSales = useMemo(() => {
    return salesHistory.filter((sale) => {
      // Normalization
      const cleanQuery = searchQuery.trim().toLowerCase();

      // Filter by type if searchQuery is empty
      if (cleanQuery === '') {
        if (filterType === 'shift') {
          return shiftSales.some(s => s.id === sale.id);
        } else {
          return isSaleFromSelectedDate(sale);
        }
      }

      // Special search wildcard " " to view all history
      if (searchQuery === ' ') {
        return true;
      }

      // Search filters:
      // 1. Ticket number
      const matchTicket = sale.ticketNumber.toLowerCase().includes(cleanQuery);
      
      // 2. Total amount
      const matchAmount = sale.total.toFixed(2).includes(cleanQuery);

      // 3. Product name in items
      const matchProduct = sale.items.some((item) => 
        item.product.name.toLowerCase().includes(cleanQuery)
      );

      const matchesSearch = matchTicket || matchAmount || matchProduct;

      // Filter the search result down to active selection as well
      if (filterType === 'shift') {
        return matchesSearch && shiftSales.some(s => s.id === sale.id);
      } else {
        return matchesSearch && isSaleFromSelectedDate(sale);
      }
    });
  }, [salesHistory, searchQuery, selectedDateStr, filterType, shiftSales]);

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

    // 1. Calculate stock restorations
    for (const item of sale.items) {
      const prod = products.find((p) => p.id === item.product.id);
      if (prod) {
        const alreadyReturned = (sale as any).returnedItems?.filter((r: any) => r.productId === item.product.id)
          .reduce((sum: number, r: any) => sum + r.quantity, 0) || 0;
        const qtyToRestore = Math.max(0, item.quantity - alreadyReturned);
        if (qtyToRestore > 0) {
          operations.push({
            type: 'update',
            collectionName: 'products',
            id: item.product.id,
            data: { stock: prod.stock + qtyToRestore }
          });
        }
      }
    }

    // 2. Cancellation sale update
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
      merge: true
    });

    try {
      await firestoreService.runBatch(operations);

      // Local state update ONLY if runBatch succeeds
      const updatedProducts = products.map((p) => {
        const saleItem = sale.items.find((item) => item.product.id === p.id);
        if (saleItem) {
          const alreadyReturned = (sale as any).returnedItems?.filter((r: any) => r.productId === p.id)
            .reduce((sum: number, r: any) => sum + r.quantity, 0) || 0;
          const qtyToRestore = Math.max(0, saleItem.quantity - alreadyReturned);
          return { ...p, stock: p.stock + qtyToRestore };
        }
        return p;
      });
      onUpdateProducts(updatedProducts);
      localStorage.setItem('pos_products', JSON.stringify(updatedProducts));

      const updatedSales = salesHistory.map((s) => s.id === cancellingSaleId ? cancelledSaleData : s);
      onUpdateSalesHistory(updatedSales);
      localStorage.setItem('pos_sales', JSON.stringify(updatedSales));

      setSelectedSale(cancelledSaleData);
      setActiveReceiptView('return'); // Auto show return ticket
      setIsCancelling(false);
      setCancellingSaleId(null);
    } catch (err) {
      console.error('Error updating sale cancellation in Firestore:', err);
      setCancelError('Error al cancelar la factura en la base de datos.');
    }
  };

  // Handle Edit Payment Method
  const handleUpdatePaymentMethod = async (method: PaymentMethod) => {
    if (!selectedSale) return;

    const updatedSale = {
      ...selectedSale,
      paymentMethod: method
    };

    const updatedSales = salesHistory.map((s) => s.id === selectedSale.id ? updatedSale : s);
    onUpdateSalesHistory(updatedSales);
    localStorage.setItem('pos_sales', JSON.stringify(updatedSales));

    try {
      await firestoreService.setDocWithId('sales', selectedSale.id, updatedSale);
    } catch (err) {
      console.error('Error saving payment method edit to Firestore:', err);
    }

    setSelectedSale(updatedSale);
    setIsEditingPayment(false);
  };

  // Open Individual Item Return
  const handleOpenItemReturn = (item: CartItem) => {
    // Check how many have been returned already
    const alreadyReturned = selectedSale?.returnedItems?.filter((r: any) => r.productId === item.product.id)
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

    const alreadyReturned = selectedSale.returnedItems?.filter((r: any) => r.productId === returningItem.product.id)
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

    // 1. Prepare item return record
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

    // Check if ALL items have been returned now
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
      cancelReason: allReturned ? 'Devolución completa de todos los artículos.' : (selectedSale as any).cancelReason,
    };

    // 2. Prepare CustomerRefund & optional CreditNote data
    const isCreditSale = Boolean(
      (selectedSale.paymentMethod === 'credit' ||
       selectedSale.isCredit ||
       (selectedSale.paymentMethod === 'mixed' && selectedSale.paymentBreakdown?.some(b => b.method === 'credit'))) &&
      selectedSale.customerId
    );

    const refundAmount = returningItem.product.price * returningItemQty;
    const now = new Date();
    const refundId = crypto.randomUUID();

    let createdCn: CreditNote | null = null;
    let refundMethod: 'cash' | 'credit_note' | 'credit_reduction' = isCreditSale ? 'credit_reduction' : refundMethodChoice;

    if (!isCreditSale && refundMethodChoice === 'credit_note') {
      let code = '';
      let exists = true;
      while (exists) {
        code = crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
        exists = creditNotes.some(cn => cn.code === code);
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

    // 3. Assemble atomic batch operations
    const operations: Array<{
      type: 'set' | 'update' | 'delete';
      collectionName: string;
      id: string;
      data?: any;
      merge?: boolean;
    }> = [];

    // Op A: Restore product stock
    const prod = products.find((p) => p.id === returningItem.product.id);
    if (prod) {
      operations.push({
        type: 'update',
        collectionName: 'products',
        id: returningItem.product.id,
        data: { stock: prod.stock + returningItemQty }
      });
    }

    // Op B: Update sale with returned items
    operations.push({
      type: 'set',
      collectionName: 'sales',
      id: selectedSale.id,
      data: updatedSale,
      merge: true
    });

    // Op C: Optional credit note creation
    if (createdCn) {
      operations.push({
        type: 'set',
        collectionName: 'creditNotes',
        id: createdCn.id,
        data: createdCn,
        merge: true
      });
    }

    // Op D: Customer refund record creation
    operations.push({
      type: 'set',
      collectionName: 'customerRefunds',
      id: refundRecord.id,
      data: refundRecord,
      merge: true
    });

    try {
      await firestoreService.runBatch(operations);

      // Local state updates ONLY when runBatch succeeds
      const updatedProducts = products.map((p) => {
        if (p.id === returningItem.product.id) {
          return { ...p, stock: p.stock + returningItemQty };
        }
        return p;
      });
      onUpdateProducts(updatedProducts);
      localStorage.setItem('pos_products', JSON.stringify(updatedProducts));

      const updatedSales = salesHistory.map((s) => s.id === selectedSale.id ? updatedSale : s);
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
      setActiveReceiptView('return'); // view return ticket
    } catch (err) {
      console.error('Error processing item return batch in Firestore:', err);
      setReturningItemError('Error al guardar la devolución en la base de datos.');
    }
  };

  // Helper to format payment method
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
      return sale.total; // full total returned
    }
    const list = (sale as any).returnedItems || [];
    return list.reduce((sum: number, r: any) => sum + (r.price * r.quantity), 0);
  };

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
              <p className="text-xs text-slate-500 font-semibold">Consulte, reimprima, edite pagos y realice devoluciones de mercancía</p>
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
          
          {/* LEFT COLUMN: Search & Sales List */}
          <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white">
            
            {/* Search and Date badge row */}
            <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/50 shrink-0">
              {/* Segmented control for Filter Type */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterType('shift')}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                    filterType === 'shift'
                      ? 'bg-white text-indigo-700 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Turno Activo ({shiftSales.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('date')}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                    filterType === 'date'
                      ? 'bg-white text-indigo-700 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Por Fecha ({salesHistory.filter(isSaleFromSelectedDate).length})
                </button>
              </div>

              <div className="flex gap-2.5 items-center">
                {/* Search query input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 placeholder-slate-400"
                    placeholder="Buscar por producto, factura o monto..."
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs"
                    >
                      X
                    </button>
                  )}
                </div>

                {/* Today's date badge - now interactive with embedded calendar date picker */}
                <div className={`relative border rounded-xl px-3 py-2 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer group ${
                  filterType === 'date'
                    ? 'bg-indigo-50 hover:bg-indigo-150 border-indigo-100 hover:border-indigo-200 text-indigo-700'
                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
                }`}>
                  <Calendar className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black tracking-tight">
                    {filterType === 'shift' ? 'Filtro por Fecha' : formattedFilterDate}
                  </span>
                  <input
                    type="date"
                    value={selectedDateStr}
                    onChange={(e) => {
                      setSelectedDateStr(e.target.value);
                      setFilterType('date'); // Auto-switch to date filter on selection
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Haga clic para cambiar la fecha de filtro"
                  />
                </div>
              </div>

              {/* Filtering logic description banner */}
              <div className="text-[10px] text-slate-400 font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-100 flex items-center justify-between">
                <span>
                  {searchQuery 
                    ? '🔍 Mostrando resultados históricos para su búsqueda' 
                    : filterType === 'shift'
                      ? `📅 Mostrando facturas del TURNO ACTIVO de ${currentEmployee?.name || clerkName}`
                      : isSelectedDateToday 
                        ? '📅 Mostrando solo facturas de HOY' 
                        : `📅 Mostrando facturas del ${formattedFilterDate}`}
                </span>
                <div className="flex gap-2.5 items-center">
                  {filterType === 'date' && !isSelectedDateToday && (
                    <button
                      onClick={() => setSelectedDateStr(todayStrISO)}
                      className="text-rose-500 hover:text-rose-700 font-black cursor-pointer hover:underline text-[9px] uppercase tracking-tight"
                    >
                      Restablecer a hoy
                    </button>
                  )}
                  {searchQuery === '' && (
                    <span 
                      className="text-indigo-500 font-extrabold cursor-pointer hover:underline text-[9px]" 
                      onClick={() => setSearchQuery(' ')}
                    >
                      Ver todo el historial →
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sales List Container */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredSales.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                  <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-3 border border-slate-100">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-700 text-sm">No se encontraron facturas</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    {searchQuery 
                      ? 'Intente modificando el término de búsqueda para localizar la factura.' 
                      : `Aún no se registran facturas el ${formattedFilterDate}. Las facturas de esta fecha aparecerán aquí.`}
                  </p>
                </div>
              ) : (
                filteredSales.map((sale) => {
                  const isSelected = selectedSale?.id === sale.id;
                  const isCancelled = sale.isCancelled;
                  const refundAmount = getRefundTotal(sale);

                  return (
                    <div
                      key={sale.id}
                      onClick={() => {
                        setSelectedSale(sale);
                        setActiveReceiptView('original');
                        setIsEditingPayment(false);
                      }}
                      className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-indigo-50/70 border-l-4 border-indigo-600' 
                          : 'hover:bg-slate-50/50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-800">
                            #{sale.ticketNumber}
                          </span>
                          {isCancelled && (
                            <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                              Cancelado / Devuelto
                            </span>
                          )}
                          {!isCancelled && (sale as any).returnedItems && (sale as any).returnedItems.length > 0 && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                              Devolución Parcial
                            </span>
                          )}
                        </div>

                        {/* List items preview */}
                        <p className="text-[10px] text-slate-400 font-semibold truncate max-w-xs">
                          {sale.items.map((i) => `${i.product.name} (x${i.quantity})`).join(', ')}
                        </p>

                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold">
                          <span>{sale.date}</span>
                          <span>•</span>
                          <span>{getPaymentBadge(sale.paymentMethod)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className={`text-sm font-black ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            ${sale.total.toFixed(2)}
                          </div>
                          {refundAmount > 0 && (
                            <div className="text-[9px] font-extrabold text-rose-600 mt-0.5">
                              Dev: ${refundAmount.toFixed(2)}
                            </div>
                          )}
                        </div>

                        {/* Fast delete/cancel icon */}
                        <button
                          type="button"
                          disabled={isCancelled}
                          onClick={(e) => handleOpenCancelPrompt(sale.id, e)}
                          title="Anular factura completa"
                          className={`p-2 rounded-lg border transition-all ${
                            isCancelled 
                              ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed' 
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-500 border-rose-100 hover:border-rose-200 cursor-pointer'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Ticket Viewer & Operations */}
          <div className="w-1/2 flex flex-col bg-slate-50 overflow-y-auto">
            {!selectedSale ? (
              <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mb-4 border border-slate-200">
                  <Receipt className="w-8 h-8" />
                </div>
                <h3 className="font-bold text-slate-700 text-base">Factura no seleccionada</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Seleccione una factura de la lista de la izquierda para ver su contenido, modificar el pago, imprimir o realizar devoluciones.
                </p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                
                {/* Mode Selector Toggle */}
                <div className="bg-white p-1 rounded-xl border border-slate-200 grid grid-cols-2 text-center shrink-0">
                  <button
                    onClick={() => setActiveReceiptView('original')}
                    className={`py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      activeReceiptView === 'original'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 cursor-pointer'
                    }`}
                  >
                    <Receipt className="w-4 h-4" /> Factura Original
                  </button>
                  <button
                    onClick={() => setActiveReceiptView('return')}
                    disabled={!selectedSale.isCancelled && !((selectedSale as any).returnedItems && (selectedSale as any).returnedItems.length > 0)}
                    className={`py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      activeReceiptView === 'return'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : selectedSale.isCancelled || ((selectedSale as any).returnedItems && (selectedSale as any).returnedItems.length > 0)
                          ? 'text-slate-500 hover:text-slate-800 cursor-pointer'
                          : 'text-slate-300 cursor-not-allowed bg-slate-50'
                    }`}
                  >
                    <Undo2 className="w-4 h-4" /> Ticket de Devolución
                  </button>
                </div>

                {/* Receipt Thermal container */}
                <div className="flex justify-center">
                  <ReceiptTemplate
                    sale={selectedSale}
                    clerkName={clerkName}
                    storeIdentity={storeIdentity}
                    ticketConfig={dashboardConfig?.ticketConfig}
                    viewType={activeReceiptView}
                  />
                </div>

                {/* --- OPERATIONS / EDITING PANEL --- */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 shadow-xs">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Acciones Rápidas del Administrador</h4>

                  {/* 1. PRINT BUTTON */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs border border-slate-200"
                    >
                      <Printer className="w-4 h-4 text-slate-500" /> 
                      {activeReceiptView === 'original' ? 'Reimprimir Factura' : 'Imprimir Reembolso'}
                    </button>
                  </div>

                  {/* 2. PAYMENT METHOD EDITOR */}
                  <div className="border-t border-slate-100 pt-4 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                        <Edit className="w-3.5 h-3.5 text-indigo-500" /> Método de Pago:
                      </span>
                      {isEditingPayment ? (
                        <button 
                          onClick={() => setIsEditingPayment(false)}
                          className="text-[10px] font-black text-slate-400 hover:text-slate-600"
                        >
                          Cancelar
                        </button>
                      ) : (
                        <button 
                          onClick={() => setIsEditingPayment(true)}
                          className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 hover:underline"
                        >
                          Editar Pago
                        </button>
                      )}
                    </div>

                    {isEditingPayment ? (
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['cash', 'card', 'transfer', 'qr'] as PaymentMethod[]).map((method) => {
                          const isCurrent = selectedSale.paymentMethod === method;
                          return (
                            <button
                              key={method}
                              onClick={() => handleUpdatePaymentMethod(method)}
                              className={`py-2 px-1 rounded-xl text-[9px] font-black flex flex-col items-center gap-1 border transition-all ${
                                isCurrent 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer'
                              }`}
                            >
                              {method === 'cash' && <Coins className="w-3.5 h-3.5" />}
                              {method === 'card' && <CreditCard className="w-3.5 h-3.5" />}
                              {method === 'transfer' && <Wallet className="w-3.5 h-3.5" />}
                              {method === 'qr' && <QrCode className="w-3.5 h-3.5" />}
                              <span className="capitalize">{
                                method === 'cash' ? 'Efectivo' :
                                method === 'card' ? 'Tarjeta' :
                                method === 'transfer' ? 'Transf.' : 'QR'
                              }</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-150 flex justify-between items-center">
                          <span>Registrado como:</span>
                          {getPaymentBadge(selectedSale.paymentMethod)}
                        </div>
                        {selectedSale.paymentMethod === 'mixed' && selectedSale.paymentBreakdown && selectedSale.paymentBreakdown.length > 0 && (
                          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 space-y-1 text-xs">
                            <span className="text-[10px] font-black uppercase text-amber-800 block mb-1">Desglose de Pago Mixto:</span>
                            {selectedSale.paymentBreakdown.map((b, i) => (
                              <div key={b.id || i} className="flex justify-between font-semibold text-slate-700">
                                <span>
                                  {b.method === 'cash' ? '💵 Efectivo' : b.method === 'card' ? '💳 Tarjeta' : b.method === 'transfer' ? '🏦 Transferencia' : b.method === 'credit' ? '👥 Crédito' : '🏷️ Nota de Crédito'}:
                                </span>
                                <span>RD$ {b.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3. ITEM-BY-ITEM RETURNS */}
                  {activeReceiptView === 'original' && !selectedSale.isCancelled && (
                    <div className="border-t border-slate-100 pt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                          <Undo2 className="w-3.5 h-3.5 text-rose-500" /> Devolución de Artículos Individuales:
                        </span>
                      </div>

                      <div className="space-y-2">
                        {selectedSale.items.map((item, idx) => {
                          // Calculate already returned
                          const returned = (selectedSale as any).returnedItems
                            ?.filter((r: any) => r.productId === item.product.id)
                            ?.reduce((sum: number, r: any) => sum + r.quantity, 0) || 0;
                          
                          const remaining = item.quantity - returned;
                          const isFullyReturned = remaining <= 0;

                          return (
                            <div key={idx} className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl border border-slate-150 bg-slate-50/50">
                              <div className="min-w-0 flex-1">
                                <span className={`font-bold block truncate text-slate-800 ${isFullyReturned ? 'line-through text-slate-400' : ''}`}>
                                  {item.product.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold block">
                                  Precio: ${item.product.price.toFixed(2)} | Comprados: {item.quantity} {returned > 0 && `(${returned} dev.)`}
                                </span>
                              </div>
                              
                              {isFullyReturned ? (
                                <span className="bg-slate-100 text-slate-400 font-bold text-[9px] py-1 px-2.5 rounded-lg border border-slate-200">
                                  Completado
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenItemReturn(item)}
                                  className="py-1 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-150 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                                >
                                  Devolver
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cancel warning if fully cancelled */}
                  {selectedSale.isCancelled && (
                    <div className="bg-rose-50 border border-rose-150 p-3.5 rounded-xl text-xs text-rose-800 font-semibold space-y-1">
                      <span className="font-extrabold block">🚫 Esta Factura ha sido Cancelada</span>
                      <p className="text-[10px] text-rose-700/90 leading-normal font-medium">
                        La mercancía correspondiente ha sido devuelta automáticamente al inventario activo. Puede reimprimir el comprobante de reembolso en cualquier momento seleccionando la pestaña "Ticket de Devolución".
                      </p>
                    </div>
                  )}

                </div>

              </div>
            )}
          </div>

        </div>

      </div>

      {/* --- INLINE OVERLAY: ENTER ENTIRE TICKET CANCELLATION REASON --- */}
      {isCancelling && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setIsCancelling(false); }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4 animate-scale-up">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0 animate-bounce" />
              <h3 className="text-base font-black">Justificación de Cancelación</h3>
            </div>
            
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Está a punto de anular la factura completa. Esta acción devolverá todos los artículos de este ticket al inventario activo de inmediato. Por seguridad, ingrese una justificación para el supervisor:
            </p>

            <div className="space-y-1.5">
              <textarea
                value={cancelJustification}
                onChange={(e) => {
                  setCancelJustification(e.target.value);
                  setCancelError('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800 placeholder-slate-400"
                placeholder="Escriba aquí la justificación (ej. El cliente se arrepintió, error en facturación, etc.)..."
                rows={3}
                autoFocus
              />
              {cancelError && <p className="text-[10px] font-bold text-rose-600">{cancelError}</p>}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setIsCancelling(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-black transition-colors bg-white cursor-pointer"
              >
                Cancelar Acción
              </button>
              <button
                onClick={handleConfirmCancellation}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-100 transition-colors cursor-pointer"
              >
                Confirmar Devolución
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- INLINE OVERLAY: INDIVIDUAL ITEM RETURN MODAL --- */}
      {returningItem && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setReturningItem(null); }}
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4 animate-scale-up">
            <div className="flex items-center gap-2 text-indigo-600">
              <Undo2 className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-black">Devolución de Artículo</h3>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1">
              <span className="font-bold text-slate-800 text-xs block">{returningItem.product.name}</span>
              <span className="text-[10px] text-slate-400 font-bold block">
                Precio Unitario: ${returningItem.product.price.toFixed(2)} | Comprados: {returningItem.quantity}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">Cantidad a Devolver</label>
                <input
                  type="number"
                  min="1"
                  max={returningItem.quantity - ((selectedSale as any).returnedItems?.filter((r: any) => r.productId === returningItem.product.id).reduce((sum: number, r: any) => sum + r.quantity, 0) || 0)}
                  value={returningItemQty}
                  onChange={(e) => {
                    setReturningItemQty(parseInt(e.target.value) || 1);
                    setReturningItemError('');
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-extrabold focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase">Monto Reembolso Est.</label>
                <div className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-rose-600 flex items-center h-9">
                  ${(returningItem.product.price * returningItemQty).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Refund method indicator/selector */}
            {selectedSale && Boolean(
              (selectedSale.paymentMethod === 'credit' ||
               selectedSale.isCredit ||
               (selectedSale.paymentMethod === 'mixed' && selectedSale.paymentBreakdown?.some(b => b.method === 'credit'))) &&
              selectedSale.customerId
            ) ? (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 space-y-1">
                <span className="font-extrabold flex items-center gap-1.5 text-xs text-amber-900">
                  👥 Reducción Automática de Crédito
                </span>
                <p className="text-[11px] text-amber-800 leading-snug">
                  Esta venta fue realizada a crédito ({selectedSale.customerName || 'Cliente'}). La devolución reducirá automáticamente <strong>RD$ {(returningItem.product.price * returningItemQty).toFixed(2)}</strong> del saldo adeudado por el cliente.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase">¿Cómo se reembolsa este dinero?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMethodChoice('cash')}
                    className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                      refundMethodChoice === 'cash'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>💵 Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRefundMethodChoice('credit_note')}
                    className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      refundMethodChoice === 'credit_note'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span>🏷️ Nota de Crédito</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase">Motivo de la Devolución</label>
              <textarea
                value={returningItemReason}
                onChange={(e) => {
                  setReturningItemReason(e.target.value);
                  setReturningItemError('');
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800 placeholder-slate-400"
                placeholder="Indique el motivo (ej. Defectuoso, talla incorrecta, error de compra, etc.)..."
                rows={2}
                autoFocus
              />
              {returningItemError && <p className="text-[10px] font-bold text-rose-600">{returningItemError}</p>}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setReturningItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-black transition-colors bg-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmItemReturn}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-100 transition-colors cursor-pointer"
              >
                Procesar Reembolso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Nota de Crédito */}
      {createdCreditNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-6 animate-scale-up">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
              <Receipt className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-extrabold text-slate-800">Nota de Crédito Emitida</h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Nota de Crédito: <strong className="text-indigo-600 font-mono tracking-wider font-extrabold">{createdCreditNote.code}</strong> — Guarda este código, es necesario para usarlo después.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Código de Canje</span>
              <div className="text-3xl font-black font-mono tracking-widest text-indigo-700 bg-white border border-slate-200 rounded-xl py-2 shadow-2xs select-all">
                {createdCreditNote.code}
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-bold text-slate-700">
                <span>Monto Disponible:</span>
                <span className="font-mono text-indigo-700 font-black">RD$ {createdCreditNote.originalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl border border-slate-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimir Nota</span>
              </button>

              <button
                type="button"
                onClick={() => setCreatedCreditNote(null)}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer"
              >
                Entendido / Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
