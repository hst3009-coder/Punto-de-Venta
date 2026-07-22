import React, { useState, useMemo } from 'react';
import { AccountPayable, PayablePayment, Product, Employee, Movement, DashboardConfig } from '../types';
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
  TrendingDown
} from 'lucide-react';

interface PayablesViewProps {
  products: Product[];
  payables: AccountPayable[];
  payablePayments: PayablePayment[];
  currentEmployee: Employee | null;
  dashboardConfig?: DashboardConfig;
}

export const PayablesView: React.FC<PayablesViewProps> = ({
  products,
  payables,
  payablePayments,
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
  const [showProviderSuggestions, setShowProviderSuggestions] = useState(false);

  // New abono form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');

  // Get unique providers from products list
  const suggestedProviders = useMemo(() => {
    const providers = new Set<string>();
    products.forEach(p => {
      if (p.provider && p.provider.trim()) {
        providers.add(p.provider.trim());
      }
    });
    return Array.from(providers);
  }, [products]);

  // Filter providers based on typed name
  const filteredSuggestions = useMemo(() => {
    if (!supplierName) return suggestedProviders;
    return suggestedProviders.filter(p => 
      p.toLowerCase().includes(supplierName.toLowerCase())
    );
  }, [supplierName, suggestedProviders]);

  // Selected payable object
  const selectedPayable = useMemo(() => {
    return payables.find(p => p.id === selectedPayableId) || null;
  }, [payables, selectedPayableId]);

  // Balance of selected payable
  const selectedPayableBalance = useMemo(() => {
    if (!selectedPayableId) return 0;
    return getPayableBalance(selectedPayableId, payables, payablePayments);
  }, [selectedPayableId, payables, payablePayments]);

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

    const confirmPayment = await showConfirm(
      'Confirmar Pago',
      `¿Está seguro de registrar este pago de RD$ ${amt.toLocaleString('es-DO', { minimumFractionDigits: 2 })} por concepto de "${selectedPayable.concept}" al proveedor "${selectedPayable.supplierName}"?`
    );

    if (!confirmPayment) return;

    try {
      const newBalance = selectedPayableBalance - amt;

      // 1. Create PayablePayment document
      const paymentData: Partial<PayablePayment> = {
        payableId: selectedPayable.id,
        amount: amt,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: paymentMethod,
        bankAccountId: ['transfer', 'card'].includes(paymentMethod) ? selectedBankAccountId || undefined : undefined,
        employeeId: currentEmployee?.id || '',
        employeeName: currentEmployee?.name || 'Sistema'
      };

      await firestoreService.addDoc('payablePayments', paymentData);

      // 2. Update status of the payable if fully paid
      if (newBalance <= 0) {
        await firestoreService.updateDoc('accountsPayable', selectedPayable.id, {
          status: 'paid'
        });
      }

      // 3. Create Movement automatically if CASH payment
      if (paymentMethod === 'cash') {
        const movementData: Partial<Movement> = {
          type: 'out',
          expenseType: 'pago_factura',
          amount: amt,
          concept: `Pago a proveedor: ${selectedPayable.supplierName}`,
          category: 'Suministros', // fits supplier payments best
          paymentMethod: 'cash',
          clerkName: currentEmployee?.name || 'Sistema',
          employeeId: currentEmployee?.id || '',
          employeeName: currentEmployee?.name || 'Sistema',
          date: new Date().toISOString().split('T')[0],
          isOperational: true
        };

        await firestoreService.addDoc('movements', movementData);
      }

      await showAlert('Éxito', 'Pago registrado correctamente.', 'success');
      setPaymentAmount('');
      setSelectedBankAccountId('');
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
      return { text: `Vencido hace ${Math.abs(diffDays)} días`, isOverdue: true, isSoon: false };
    } else if (diffDays === 0) {
      return { text: 'Vence hoy', isOverdue: false, isSoon: true };
    } else if (diffDays === 1) {
      return { text: 'Vence mañana', isOverdue: false, isSoon: true };
    } else {
      return { text: `Vence en ${diffDays} días`, isOverdue: false, isSoon: diffDays <= 5 };
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
      
      {/* LEFT COLUMN: Search & List */}
      <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        
        {/* Search & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">Cuentas por Pagar</h3>
            <p className="text-xs text-slate-400">Facturas y deudas pendientes con proveedores</p>
          </div>
          {permissions.managePayables && (
            <button
              onClick={() => {
                setSelectedPayableId(null);
                setShowAddForm(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cuenta</span>
            </button>
          )}
        </div>

        {/* Filters and Search Bar */}
        <div className="space-y-3 mb-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por proveedor o concepto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            {(['pending', 'paid', 'all'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  filterTab === tab
                    ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'pending' ? 'Pendientes' : tab === 'paid' ? 'Pagadas' : 'Todas'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredPayables.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
              <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-black text-slate-500 uppercase tracking-wide">No se encontraron deudas</p>
              <p className="text-[10px] text-slate-400">Las deudas filtradas aparecerán en esta sección</p>
            </div>
          ) : (
            filteredPayables.map((p) => {
              const bal = getPayableBalance(p.id, payables, payablePayments);
              const { text: daysText, isOverdue, isSoon } = getDaysRemainingText(p.dueDate);
              const isSelected = selectedPayableId === p.id;
              
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedPayableId(p.id);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/50 border-indigo-200 shadow-xs'
                      : 'bg-white hover:bg-slate-50/50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs text-slate-800 leading-tight">
                        {p.supplierName}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                        {p.concept}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black font-mono text-xs text-slate-800">
                        RD$ {bal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </div>
                      {p.totalAmount > bal && bal > 0 && (
                        <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                          Total: RD$ {p.totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t border-slate-100/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] font-black text-slate-600 font-mono">
                        {p.dueDate}
                      </span>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                        isOverdue 
                          ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                          : isSoon 
                            ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                            : 'bg-slate-100 text-slate-500'
                      }`}>
                        {daysText}
                      </span>
                    </div>

                    <div>
                      {bal === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[9px] font-black uppercase border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Pagada</span>
                        </span>
                      ) : p.totalAmount > bal ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[9px] font-black uppercase border border-amber-100">
                          Abono Parcial
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md text-[9px] font-black uppercase border border-rose-100">
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Detail pane OR New payable form */}
      <div className="w-full lg:w-[420px] shrink-0 flex flex-col min-h-0 bg-slate-50/50 border border-slate-200 rounded-3xl p-5">
        
        {/* NEW PAYABLE FORM */}
        {showAddForm && (
          <form onSubmit={handleCreatePayable} className="flex-1 flex flex-col justify-between min-h-0">
            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-black text-slate-800 uppercase tracking-wide">Nueva Cuenta por Pagar</span>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="p-1 rounded-lg hover:bg-slate-150 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Supplier Input with suggestions */}
              <div className="space-y-1 relative">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Proveedor</label>
                <SupplierPicker
                  value={supplierName}
                  onChange={setSupplierName}
                  products={products}
                  payables={payables}
                  placeholder="Escribe o selecciona proveedor..."
                />
              </div>

              {/* Concept Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Concepto / Descripción</label>
                <div className="relative">
                  <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ej. Factura #8928, compra de embutidos..."
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Total Amount Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Monto Total (RD$)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono transition-all"
                  />
                </div>
              </div>

              {/* Due Date Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Fecha de Vencimiento</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
              >
                Registrar
              </button>
            </div>
          </form>
        )}

        {/* DETAILS PANEL & REGISTER ABONO FORM */}
        {!showAddForm && selectedPayable && (
          <div className="flex-1 flex flex-col justify-between min-h-0">
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Detalle de Deuda</span>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">{selectedPayable.supplierName}</h4>
                </div>
                <button
                  onClick={() => setSelectedPayableId(null)}
                  className="p-1 rounded-lg hover:bg-slate-150 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Details card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Concepto:</span>
                  <span className="text-xs text-slate-700 font-medium text-right">{selectedPayable.concept}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Monto original:</span>
                  <span className="text-xs font-bold text-slate-700 font-mono">RD$ {selectedPayable.totalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Saldo pendiente:</span>
                  <span className="text-xs font-black text-rose-600 font-mono bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                    RD$ {selectedPayableBalance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Vencimiento:</span>
                  <span className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {selectedPayable.dueDate}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Creado por:</span>
                  <span className="text-xs font-bold text-slate-500">
                    {selectedPayable.employeeName || 'Sistema'}
                  </span>
                </div>
              </div>

              {/* Payments History */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Historial de Abonos</span>
                {selectedPayablePayments.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center py-4 bg-white border border-slate-100 rounded-2xl">
                    No se han registrado abonos a esta cuenta.
                  </p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 bg-white p-2 border border-slate-150 rounded-2xl">
                    {selectedPayablePayments.map((pay) => (
                      <div key={pay.id} className="flex justify-between items-center p-2 rounded-xl bg-slate-50 text-[10px] border border-slate-100">
                        <div>
                          <div className="font-bold text-slate-700">RD$ {pay.amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</div>
                          <div className="text-[8px] text-slate-400 font-medium">
                            {pay.date} • {pay.paymentMethod === 'cash' ? 'Efectivo' : pay.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}
                          </div>
                        </div>
                        <div className="text-[8px] text-slate-400 italic font-medium">
                          {pay.employeeName || 'Cajero'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Register payment form if still has balance */}
              {selectedPayableBalance > 0 && permissions.managePayables && (
                <form onSubmit={handleRegisterPayment} className="border-t border-slate-200 pt-3 space-y-3">
                  <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">Registrar Abono</span>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    
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
                          className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 font-mono font-bold focus:outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">Método de pago</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => {
                          setPaymentMethod(e.target.value as any);
                          setSelectedBankAccountId('');
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-black uppercase tracking-wide focus:outline-none focus:border-indigo-500 transition-all"
                      >
                        <option value="cash">Efectivo</option>
                        <option value="card">Tarjeta</option>
                        <option value="transfer">Transf.</option>
                      </select>
                    </div>

                  </div>

                  {['transfer', 'card'].includes(paymentMethod) && (() => {
                    const activeBankAccounts = (dashboardConfig?.bankAccounts ?? []).filter(ba => ba.active);
                    return (
                      <div className="space-y-1 mt-2">
                        <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">
                          Cuenta Bancaria {paymentMethod === 'card' ? 'Destino' : 'Origen'} (Obligatorio)
                        </label>
                        {activeBankAccounts.length === 0 ? (
                          <div className="text-[10px] text-amber-800 font-semibold bg-amber-50 border border-amber-250 p-2 rounded-xl">
                            ⚠️ No hay cuentas bancarias activas registradas.
                          </div>
                        ) : (
                          <select
                            value={selectedBankAccountId}
                            onChange={(e) => setSelectedBankAccountId(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-750 font-semibold focus:outline-none focus:border-indigo-500 transition-all"
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
          </div>
        )}

        {/* DEFAULT VIEW: Instruction details */}
        {!showAddForm && !selectedPayable && (
          <div className="flex-1 flex flex-col justify-center items-center text-center p-6 bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
            <TrendingDown className="w-10 h-10 text-slate-300 mb-3" />
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-1">Cuentas por Pagar</h4>
            <p className="text-[10px] text-slate-400 max-w-[240px]">
              Seleccione una cuenta por pagar de la lista para registrar abonos, o haga clic en "Nueva Cuenta" para registrar una nueva deuda con proveedor.
            </p>
          </div>
        )}

      </div>

    </div>
  );
};
