import React, { useState, useMemo } from 'react';
import { AccountPayable, PayablePayment, Product, Employee, Movement, DashboardConfig, SupplierCreditNote } from '../types';
import { SupplierPicker } from './SupplierPicker';
import { firestoreService } from '../lib/firebase';
import { useAlert } from '../context/AlertContext';
import { getPayableBalance } from '../lib/payableDebt';
import { getEmployeePermissions } from '../lib/permissions';
import { 
  Search, 
  Plus, 
  Calendar, 
  Clock, 
  DollarSign, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Tag, 
  CreditCard, 
  Send, 
  X,
  FileText,
  User,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from 'lucide-react';

interface PayablesViewProps {
  products: Product[];
  payables: AccountPayable[];
  payablePayments: PayablePayment[];
  supplierCreditNotes?: SupplierCreditNote[];
  currentEmployee: Employee | null;
  dashboardConfig?: DashboardConfig;
}

export const PayablesView: React.FC<PayablesViewProps> = ({
  products,
  payables,
  payablePayments,
  supplierCreditNotes = [],
  currentEmployee,
  dashboardConfig,
}) => {
  const { showAlert, showConfirm } = useAlert();
  const permissions = useMemo(() => getEmployeePermissions(currentEmployee), [currentEmployee]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayableId, setSelectedPayableId] = useState<string | null>(null);
  
  // Tab filters
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'paid'>('pending');

  // New payable form state
  const [supplierName, setSupplierName] = useState('');
  const [concept, setConcept] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // New abono form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'credit_note'>('cash');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<string>('');

  // Toggle supplier credit notes panel
  const [showCreditNotesPanel, setShowCreditNotesPanel] = useState(false);

  // Selected payable object
  const selectedPayable = useMemo(() => {
    return payables.find(p => p.id === selectedPayableId) || null;
  }, [payables, selectedPayableId]);

  // Balance of selected payable
  const selectedPayableBalance = useMemo(() => {
    if (!selectedPayableId) return 0;
    return getPayableBalance(selectedPayableId, payables, payablePayments);
  }, [selectedPayableId, payables, payablePayments]);

  // Active credit notes for the selected payable's supplier
  const activeNotesForSupplier = useMemo(() => {
    if (!selectedPayable) return [];
    const targetName = selectedPayable.supplierName.trim().toLowerCase();
    return supplierCreditNotes.filter(n => 
      n.status === 'active' && 
      (n.remainingBalance || 0) > 0 && 
      n.supplierName.trim().toLowerCase() === targetName
    );
  }, [selectedPayable, supplierCreditNotes]);

  // Selected credit note object
  const selectedCreditNote = useMemo(() => {
    if (!selectedCreditNoteId) return activeNotesForSupplier[0] || null;
    return activeNotesForSupplier.find(n => n.id === selectedCreditNoteId) || activeNotesForSupplier[0] || null;
  }, [selectedCreditNoteId, activeNotesForSupplier]);

  // Total available supplier credit notes across all suppliers
  const totalAvailableSupplierCredits = useMemo(() => {
    return supplierCreditNotes
      .filter(n => n.status === 'active')
      .reduce((sum, n) => sum + (n.remainingBalance || 0), 0);
  }, [supplierCreditNotes]);

  // Payments for selected payable
  const selectedPayablePayments = useMemo(() => {
    if (!selectedPayableId) return [];
    return payablePayments
      .filter(p => p.payableId === selectedPayableId)
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
  }, [payablePayments, selectedPayableId]);

  // Main filtered and sorted payables list
  const filteredPayables = useMemo(() => {
    let list = [...payables];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.supplierName.toLowerCase().includes(q) || 
        p.concept.toLowerCase().includes(q)
      );
    }

    // Filter by tab
    if (filterTab === 'pending') {
      list = list.filter(p => {
        const bal = getPayableBalance(p.id, payables, payablePayments);
        return p.status !== 'paid' && bal > 0;
      });
    } else if (filterTab === 'paid') {
      list = list.filter(p => {
        const bal = getPayableBalance(p.id, payables, payablePayments);
        return p.status === 'paid' || bal === 0;
      });
    }

    // Sort by dueDate ascending (soonest first)
    list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return list;
  }, [payables, payablePayments, searchQuery, filterTab]);

  // Reset payable form
  const resetForm = () => {
    setSupplierName('');
    setConcept('');
    setTotalAmount('');
    setDueDate('');
    setShowAddForm(false);
  };

  // Pre-fill payment amount when selected payable changes
  React.useEffect(() => {
    if (selectedPayableId) {
      setPaymentAmount(selectedPayableBalance.toString());
      setSelectedCreditNoteId('');
    } else {
      setPaymentAmount('');
    }
  }, [selectedPayableId, selectedPayableBalance]);

  // Submit new payable
  const handleCreatePayable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      await showAlert('Error', 'Debe escribir o seleccionar un proveedor.', 'error');
      return;
    }
    if (!concept.trim()) {
      await showAlert('Error', 'Debe ingresar un concepto.', 'error');
      return;
    }
    const amt = parseFloat(totalAmount);
    if (isNaN(amt) || amt <= 0) {
      await showAlert('Error', 'El monto total debe ser un número mayor a cero.', 'error');
      return;
    }
    if (!dueDate) {
      await showAlert('Error', 'Debe seleccionar una fecha de vencimiento.', 'error');
      return;
    }

    try {
      const newPayable: Partial<AccountPayable> = {
        supplierName: supplierName.trim(),
        concept: concept.trim(),
        totalAmount: amt,
        dueDate: dueDate,
        status: 'pending',
        employeeId: currentEmployee?.id || '',
        employeeName: currentEmployee?.name || 'Sistema'
      };

      await firestoreService.addDoc('accountsPayable', newPayable);
      await showAlert('Éxito', 'Cuenta por pagar registrada correctamente.', 'success');
      resetForm();
    } catch (error) {
      console.error('Error creating account payable:', error);
      await showAlert('Error', 'No se pudo guardar la cuenta por pagar.', 'error');
    }
  };

  // Submit payment (abono)
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      await showAlert('Error', 'El monto debe ser un número mayor a cero.', 'error');
      return;
    }

    if (amt > selectedPayableBalance) {
      await showAlert('Error', `El abono no puede exceder el saldo pendiente (RD$ ${selectedPayableBalance.toFixed(2)}).`, 'error');
      return;
    }

    if (['transfer', 'card'].includes(paymentMethod) && !selectedBankAccountId) {
      await showAlert(
        'Cuenta requerida',
        'Debe seleccionar una cuenta bancaria de origen/destino para registrar abonos con transferencia o tarjeta.',
        'warning'
      );
      return;
    }

    if (paymentMethod === 'credit_note') {
      if (!selectedCreditNote) {
        await showAlert('Sin nota de crédito', `No hay notas de crédito activas disponibles para el proveedor ${selectedPayable.supplierName}.`, 'warning');
        return;
      }
      if (amt > selectedCreditNote.remainingBalance) {
        await showAlert('Monto excede nota', `El abono (RD$ ${amt.toFixed(2)}) no puede exceder el saldo disponible en la nota de crédito seleccionada (RD$ ${selectedCreditNote.remainingBalance.toFixed(2)}).`, 'error');
        return;
      }
    }

    const confirmPayment = await showConfirm(
      'Confirmar Pago',
      `¿Está seguro de registrar este pago de RD$ ${amt.toLocaleString('es-DO', { minimumFractionDigits: 2 })} (${paymentMethod === 'credit_note' ? 'Nota de Crédito' : paymentMethod}) por concepto de "${selectedPayable.concept}" al proveedor "${selectedPayable.supplierName}"?`
    );

    if (!confirmPayment) return;

    try {
      const newBalance = selectedPayableBalance - amt;

      const operations: Array<{
        type: 'set' | 'update' | 'delete';
        collectionName: string;
        id: string;
        data?: any;
        merge?: boolean;
      }> = [];

      // 1. Create PayablePayment document
      const paymentId = crypto.randomUUID();
      const paymentData: PayablePayment = {
        id: paymentId,
        payableId: selectedPayable.id,
        amount: amt,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: paymentMethod,
        bankAccountId: ['transfer', 'card'].includes(paymentMethod) ? selectedBankAccountId || undefined : undefined,
        supplierCreditNoteId: paymentMethod === 'credit_note' ? selectedCreditNote?.id : undefined,
        employeeId: currentEmployee?.id || '',
        employeeName: currentEmployee?.name || 'Sistema'
      };

      operations.push({
        type: 'set',
        collectionName: 'payablePayments',
        id: paymentId,
        data: paymentData,
        merge: true
      });

      // 2. Update Supplier Credit Note if applicable
      if (paymentMethod === 'credit_note' && selectedCreditNote) {
        const newRemaining = Math.max(0, selectedCreditNote.remainingBalance - amt);
        const newStatus = newRemaining <= 0 ? 'depleted' : 'active';
        operations.push({
          type: 'update',
          collectionName: 'supplierCreditNotes',
          id: selectedCreditNote.id,
          data: {
            remainingBalance: newRemaining,
            status: newStatus
          }
        });
      }

      // 3. Update status of the payable if fully paid
      if (newBalance <= 0) {
        operations.push({
          type: 'update',
          collectionName: 'accountsPayable',
          id: selectedPayable.id,
          data: {
            status: 'paid'
          }
        });
      }

      // 4. Create Movement automatically ONLY if CASH payment
      if (paymentMethod === 'cash') {
        const movementId = crypto.randomUUID();
        const movementData: Movement = {
          id: movementId,
          type: 'out',
          expenseType: 'pago_factura',
          amount: amt,
          concept: `Pago a proveedor: ${selectedPayable.supplierName}`,
          category: 'Suministros',
          paymentMethod: 'cash',
          clerkName: currentEmployee?.name || 'Sistema',
          employeeId: currentEmployee?.id || '',
          employeeName: currentEmployee?.name || 'Sistema',
          date: new Date().toISOString().split('T')[0],
          isOperational: true
        };

        operations.push({
          type: 'set',
          collectionName: 'movements',
          id: movementId,
          data: movementData,
          merge: true
        });
      }

      await firestoreService.runBatch(operations);

      await showAlert('Éxito', 'Pago registrado correctamente.', 'success');
      setPaymentAmount('');
      setSelectedBankAccountId('');
      setSelectedCreditNoteId('');
    } catch (error) {
      console.error('Error saving payable payment:', error);
      await showAlert('Error', 'No se pudo guardar el pago.', 'error');
    }
  };

  // Helper to calculate days remaining
  const getDaysRemainingText = (dueDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Vencida hace ${Math.abs(diffDays)}d`, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    } else if (diffDays === 0) {
      return { text: 'Vence hoy', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    } else if (diffDays <= 3) {
      return { text: `Vence en ${diffDays}d`, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    } else {
      return { text: `Vence en ${diffDays}d`, color: 'text-slate-500 bg-slate-50 border-slate-200' };
    }
  };

  return (
    <div id="payables-view-root" className="flex flex-col gap-4 h-full">
      
      {/* Top Banner: Available Supplier Credit Notes Bar */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
              Notas de Crédito de Proveedores
            </div>
            <div className="text-xs font-bold text-emerald-950 font-mono">
              RD$ {totalAvailableSupplierCredits.toLocaleString('es-DO', { minimumFractionDigits: 2 })} disponibles en notas a favor
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreditNotesPanel(!showCreditNotesPanel)}
          className="px-3.5 py-1.5 bg-white hover:bg-emerald-100/60 text-emerald-800 border border-emerald-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs self-start sm:self-center flex items-center gap-1"
        >
          <span>{showCreditNotesPanel ? 'Ocultar Resumen' : 'Ver Notas de Crédito'}</span>
          {showCreditNotesPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Supplier Credit Notes Sub-Section */}
      {showCreditNotesPanel && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Resumen de Notas de Crédito con Proveedores
            </h4>
            <span className="text-[10px] font-bold text-slate-400">
              {supplierCreditNotes.filter(n => n.status === 'active').length} notas activas
            </span>
          </div>

          {supplierCreditNotes.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">
              No tienes notas de crédito registradas de proveedores. Se generarán al acreditar devoluciones o registrar notas manuales en la sección de Devoluciones.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {supplierCreditNotes.map((note) => (
                <div
                  key={note.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between text-xs space-y-1.5 ${
                    note.status === 'active'
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-slate-150 bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-black text-slate-800 uppercase text-[11px]">{note.supplierName}</span>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                      note.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {note.status === 'active' ? 'Activa' : 'Agotada'}
                    </span>
                  </div>

                  <p className="text-[9px] text-slate-500 truncate">{note.reason}</p>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[10px] font-mono">
                    <span className="text-slate-400 font-sans text-[9px]">Saldo:</span>
                    <span className="font-black text-emerald-700">
                      RD$ {(note.remainingBalance || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Layout: Accounts Payable */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start min-h-[450px]">
        
        {/* Left Column: Accounts Payable List (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col h-full">
          
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Cuentas por Pagar</h3>
              <p className="text-[10px] font-bold text-slate-400">Deudas y facturas pendientes con proveedores</p>
            </div>

            {permissions.managePayables && (
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setSelectedPayableId(null);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs flex items-center gap-1 self-start sm:self-center"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva Cuenta</span>
              </button>
            )}
          </div>

          {/* Filters & Search */}
          <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setFilterTab('pending')}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                  filterTab === 'pending' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setFilterTab('paid')}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                  filterTab === 'paid' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Pagadas
              </button>
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                  filterTab === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Todas
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por proveedor o concepto..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          {/* List */}
          <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
            {filteredPayables.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold">No hay cuentas por pagar {filterTab === 'pending' ? 'pendientes' : ''}</p>
              </div>
            ) : (
              filteredPayables.map((item) => {
                const bal = getPayableBalance(item.id, payables, payablePayments);
                const isSelected = item.id === selectedPayableId;
                const daysInfo = getDaysRemainingText(item.dueDate);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedPayableId(isSelected ? null : item.id);
                      setShowAddForm(false);
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/20 shadow-xs'
                        : bal === 0
                        ? 'border-slate-150 bg-slate-50/50 opacity-70'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase text-slate-800">
                          {item.supplierName}
                        </span>
                        {bal > 0 ? (
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${daysInfo.color}`}>
                            {daysInfo.text}
                          </span>
                        ) : (
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Pagada
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500 font-semibold">
                        {item.concept}
                      </p>

                      <div className="text-[9px] text-slate-400 flex items-center gap-2">
                        <span>Vence: {item.dueDate}</span>
                      </div>
                    </div>

                    <div className="text-right self-start sm:self-center font-mono">
                      <div className="text-xs font-black text-slate-900">
                        RD$ {bal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[9px] text-slate-400 font-sans">
                        Total: RD$ {item.totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Add Payable Form OR Selected Payable Details & Abonos (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col h-full min-h-[450px]">
          
          {/* Option A: Add New Payable Form */}
          {showAddForm && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Nueva Cuenta por Pagar</h3>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreatePayable} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">Proveedor</label>
                  <SupplierPicker
                    value={supplierName}
                    onChange={setSupplierName}
                    products={products}
                    payables={payables}
                    placeholder="Escriba o seleccione proveedor..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">Concepto / NCF / Factura</label>
                  <input
                    type="text"
                    required
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Ej. Factura #45821 - Compra mercancía"
                    className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">Monto Total (RD$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">Fecha Vencimiento</label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 mt-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Guardar Cuenta</span>
                </button>
              </form>
            </div>
          )}

          {/* Option B: Selected Payable Details & Abonos */}
          {!showAddForm && selectedPayable && (
            <div className="space-y-4 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Detalle de Cuenta</span>
                  <button
                    onClick={() => setSelectedPayableId(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase">{selectedPayable.supplierName}</h4>
                      <p className="text-[10px] text-slate-500 font-medium">{selectedPayable.concept}</p>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-slate-500">
                      Vence: {selectedPayable.dueDate}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 font-mono text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Total Deuda</span>
                      <span className="font-bold text-slate-700">
                        RD$ {selectedPayable.totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Saldo Pendiente</span>
                      <span className="font-black text-rose-600">
                        RD$ {selectedPayableBalance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payments History for this Payable */}
                <div className="mt-3 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Historial de Abonos</span>
                  {selectedPayablePayments.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic text-center py-3 bg-slate-50 border border-slate-150 rounded-xl">
                      Sin abonos registrados.
                    </p>
                  ) : (
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1 bg-slate-50/50 p-2 border border-slate-200 rounded-xl">
                      {selectedPayablePayments.map((pay) => (
                        <div key={pay.id} className="flex justify-between items-center p-2 rounded-lg bg-white text-[10px] border border-slate-150">
                          <div>
                            <span className="font-bold text-slate-800 font-mono">RD$ {pay.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                            <div className="text-[8px] text-slate-400 font-medium flex items-center gap-1">
                              <span>{pay.date}</span>
                              <span>•</span>
                              <span className="uppercase font-bold text-indigo-600">
                                {pay.paymentMethod === 'cash' ? 'Efectivo' : pay.paymentMethod === 'card' ? 'Tarjeta' : pay.paymentMethod === 'credit_note' ? 'Nota de Crédito' : 'Transferencia'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[8px] text-slate-400 italic">
                            {pay.employeeName || 'Cajero'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Register payment form if balance remains */}
              {selectedPayableBalance > 0 && permissions.managePayables && (
                <form onSubmit={handleRegisterPayment} className="border-t border-slate-200 pt-3 space-y-2.5">
                  <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">Registrar Abono</span>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Amount Input */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">Monto a pagar</label>
                      <div className="relative">
                        <DollarSign className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="number"
                          step="0.01"
                          max={selectedPayableBalance}
                          min="0.01"
                          placeholder="0.00"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="w-full pl-7 pr-2 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-mono font-bold focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">Método de pago</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => {
                          setPaymentMethod(e.target.value as any);
                          setSelectedBankAccountId('');
                          setSelectedCreditNoteId('');
                        }}
                        className="w-full px-2 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-extrabold uppercase tracking-wide focus:outline-none focus:border-indigo-500"
                      >
                        <option value="cash">Efectivo</option>
                        <option value="card">Tarjeta</option>
                        <option value="transfer">Transf.</option>
                        <option value="credit_note">
                          Nota de Crédito ({activeNotesForSupplier.length})
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* If Credit Note selected */}
                  {paymentMethod === 'credit_note' && (
                    <div className="space-y-1.5 bg-indigo-50/70 p-2.5 border border-indigo-150 rounded-xl">
                      <label className="text-[9px] font-bold uppercase text-indigo-800 tracking-wide block">
                        Nota de Crédito del Proveedor ({selectedPayable.supplierName})
                      </label>
                      {activeNotesForSupplier.length === 0 ? (
                        <div className="text-[10px] text-amber-800 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                          ⚠️ No tienes notas de crédito activas registradas para {selectedPayable.supplierName}.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {activeNotesForSupplier.length > 1 && (
                            <select
                              value={selectedCreditNoteId}
                              onChange={(e) => setSelectedCreditNoteId(e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                            >
                              {activeNotesForSupplier.map(n => (
                                <option key={n.id} value={n.id}>
                                  RD$ {n.remainingBalance.toFixed(2)} - {n.reason}
                                </option>
                              ))}
                            </select>
                          )}
                          {selectedCreditNote && (
                            <div className="text-[10px] text-emerald-800 font-extrabold flex justify-between items-center bg-white p-2 rounded-lg border border-emerald-200">
                              <span>Saldo disponible en esta nota:</span>
                              <span className="font-mono text-xs">
                                RD$ {selectedCreditNote.remainingBalance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* If Transfer / Card selected */}
                  {['transfer', 'card'].includes(paymentMethod) && (() => {
                    const activeBankAccounts = (dashboardConfig?.bankAccounts ?? []).filter(ba => ba.active);
                    return (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">
                          Cuenta Bancaria (Obligatorio)
                        </label>
                        {activeBankAccounts.length === 0 ? (
                          <div className="text-[10px] text-amber-800 font-semibold bg-amber-50 border border-amber-250 p-2 rounded-xl">
                            ⚠️ No hay cuentas bancarias activas registradas.
                          </div>
                        ) : (
                          <select
                            value={selectedBankAccountId}
                            onChange={(e) => setSelectedBankAccountId(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none focus:border-indigo-500"
                          >
                            <option value="">-- Seleccionar Cuenta --</option>
                            {activeBankAccounts.map(ba => (
                              <option key={ba.id} value={ba.id}>
                                {ba.bankName} - {ba.accountLabel}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })()}

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Guardar Abono</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Option C: Default Placeholder */}
          {!showAddForm && !selectedPayable && (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <TrendingDown className="w-10 h-10 text-slate-300 mb-3" />
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-1">Cuentas por Pagar</h4>
              <p className="text-[10px] text-slate-400 max-w-[240px]">
                Seleccione una cuenta de la lista para registrar abonos o aplicar notas de crédito de proveedores.
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
