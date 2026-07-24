import React, { useState, useMemo } from 'react';
import { Customer, Sale, CustomerPayment, Employee, DashboardConfig, CustomerRefund } from '../types';
import { firestoreService } from '../lib/firebase';
import { useAlert } from '../context/AlertContext';
import { getSaleTimestamp } from '../lib/dates';
import { getCustomerDebt } from '../lib/customerDebt';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  Mail, 
  DollarSign, 
  Receipt, 
  CheckCircle2, 
  X, 
  ArrowLeft,
  Coins,
  Clock,
  Printer,
  ChevronRight,
  AlertCircle,
  Edit3,
  Trash2
} from 'lucide-react';

interface CustomersViewProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  sales: Sale[];
  clerkName: string;
  customerPayments?: CustomerPayment[];
  customerRefunds?: CustomerRefund[];
  currentEmployee?: Employee | null;
  preSelectedCustomerId?: string | null;
  dashboardConfig?: DashboardConfig;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  isOpen,
  onClose,
  customers,
  sales,
  clerkName,
  customerPayments = [],
  customerRefunds = [],
  currentEmployee = null,
  preSelectedCustomerId = null,
  dashboardConfig,
}) => {
  const { showAlert, showConfirm } = useAlert();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Sync pre-selected customer when prop changes
  React.useEffect(() => {
    if (preSelectedCustomerId && isOpen) {
      setSelectedCustomerId(preSelectedCustomerId);
    }
  }, [preSelectedCustomerId, isOpen]);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  
  // Tab within the history pane
  const [historyTab, setHistoryTab] = useState<'pending' | 'all'>('pending');

  // New customer form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCreditLimit, setNewCreditLimit] = useState('5000');
  const [newNoCreditLimit, setNewNoCreditLimit] = useState(false);
  const [newOpeningDebt, setNewOpeningDebt] = useState('');
  const [newPriceListId, setNewPriceListId] = useState('');
  const [formError, setFormError] = useState('');

  // Edit customer form state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('5000');
  const [editNoCreditLimit, setEditNoCreditLimit] = useState(false);
  const [editPriceListId, setEditPriceListId] = useState('');
  const [editFormError, setEditFormError] = useState('');

  // Payment form state
  const [paymentAmountStr, setPaymentAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');

  // Calculate debt for each customer dynamically from sales and payments
  const customerDebts = useMemo(() => {
    const debts: Record<string, number> = {};
    customers.forEach(c => {
      debts[c.id] = getCustomerDebt(c.id, sales, customerPayments, customers, customerRefunds);
    });
    return debts;
  }, [customers, sales, customerPayments, customerRefunds]);

  // Filter payments for selected customer
  const selectedCustomerPayments = useMemo(() => {
    if (!selectedCustomerId) return [];
    return customerPayments.filter(p => p.customerId === selectedCustomerId)
      .sort((a, b) => getSaleTimestamp(b as any) - getSaleTimestamp(a as any));
  }, [customerPayments, selectedCustomerId]);

  // Overall store credit stats
  const totalOutstandingCredit = useMemo(() => {
    return Object.values(customerDebts).reduce((sum: number, val: number) => sum + val, 0);
  }, [customerDebts]);

  // Filter customers by search query
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, searchQuery]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Customer sales list (filtered by selection & tabs)
  const customerSales = useMemo(() => {
    if (!selectedCustomerId) return [];
    
    const relevantSales = sales.filter(s => s.customerId === selectedCustomerId);
    
    if (historyTab === 'pending') {
      // Sales made that are currently pending credit (part of their debt)
      return relevantSales.filter(s => s.isCredit && s.creditStatus === 'pending')
        .sort((a, b) => getSaleTimestamp(b) - getSaleTimestamp(a));
    } else {
      // All sales associated with the customer
      return relevantSales.sort((a, b) => getSaleTimestamp(b) - getSaleTimestamp(a));
    }
  }, [sales, selectedCustomerId, historyTab]);

  const selectedSale = useMemo(() => {
    if (!selectedSaleId) return null;
    return sales.find(s => s.id === selectedSaleId) || null;
  }, [sales, selectedSaleId]);

  if (!isOpen) return null;

  // Handle adding new customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!newName.trim()) {
      setFormError('El nombre es requerido.');
      return;
    }

    const limitVal = parseFloat(newCreditLimit) || 0;
    const openingDebtVal = parseFloat(newOpeningDebt) || 0;

    if (openingDebtVal > 0) {
      const confirmOpening = await showConfirm(
        'Confirmar Deuda Anterior',
        `Vas a registrar RD$${openingDebtVal.toFixed(2)} de deuda anterior para ${newName.trim()}. Este monto no se podrá editar después. ¿Confirmas?`
      );
      if (!confirmOpening) {
        return;
      }
    }

    const newCust: Customer = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
      creditLimit: newNoCreditLimit ? 0 : limitVal,
      noCreditLimit: newNoCreditLimit,
      openingDebt: openingDebtVal || undefined,
      priceListId: newPriceListId || undefined,
      createdAt: new Date().toISOString()
    };

    try {
      await firestoreService.setDocWithId('customers', newCust.id, newCust);
      
      // Auto select the new customer
      setSelectedCustomerId(newCust.id);
      
      // Reset form
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewCreditLimit('5000');
      setNewNoCreditLimit(false);
      setNewOpeningDebt('');
      setNewPriceListId('');
      setShowAddForm(false);
    } catch (err) {
      console.error('Error creating customer:', err);
      setFormError('Error al guardar en la base de datos.');
    }
  };

  const handleOpenEditModal = () => {
    if (!selectedCustomer) return;
    setEditName(selectedCustomer.name);
    setEditPhone(selectedCustomer.phone || '');
    setEditEmail(selectedCustomer.email || '');
    setEditNoCreditLimit(!!selectedCustomer.noCreditLimit);
    setEditCreditLimit(selectedCustomer.creditLimit ? selectedCustomer.creditLimit.toString() : '5000');
    setEditPriceListId(selectedCustomer.priceListId || '');
    setEditFormError('');
    setIsEditModalOpen(true);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setEditFormError('');

    if (!editName.trim()) {
      setEditFormError('El nombre es requerido.');
      return;
    }

    const limitVal = parseFloat(editCreditLimit) || 0;

    const updatedCust: Customer = {
      ...selectedCustomer,
      name: editName.trim(),
      phone: editPhone.trim() || undefined,
      email: editEmail.trim() || undefined,
      noCreditLimit: editNoCreditLimit,
      creditLimit: editNoCreditLimit ? 0 : limitVal,
      priceListId: editPriceListId || undefined,
    };

    try {
      await firestoreService.setDocWithId('customers', selectedCustomer.id, updatedCust);
      setIsEditModalOpen(false);
      await showAlert('Cliente Actualizado', 'Los datos del cliente se actualizaron con éxito.', 'success');
    } catch (err) {
      console.error('Error updating customer:', err);
      setEditFormError('Error al actualizar en la base de datos.');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    const currentDebt = customerDebts[selectedCustomer.id] || 0;

    if (currentDebt > 0) {
      await showAlert(
        'No se puede eliminar',
        `Este cliente tiene una deuda pendiente de RD$ ${currentDebt.toFixed(2)}, no se puede eliminar.`,
        'warning'
      );
      return;
    }

    const confirmDelete = await showConfirm(
      'Eliminar Cliente',
      `¿Está seguro de que desea eliminar al cliente "${selectedCustomer.name}"? Esta acción no se puede deshacer.`
    );

    if (confirmDelete) {
      try {
        await firestoreService.deleteDoc('customers', selectedCustomer.id);
        setSelectedCustomerId(null);
        await showAlert('Cliente Eliminado', 'El cliente ha sido eliminado exitosamente.', 'success');
      } catch (err) {
        console.error('Error deleting customer:', err);
        await showAlert('Error', 'No se pudo eliminar el cliente.', 'error');
      }
    }
  };

  // Handle registering an payment (abono)
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const currentDebt = customerDebts[selectedCustomer.id] || 0;
    const amount = parseFloat(paymentAmountStr);

    if (isNaN(amount) || amount <= 0) {
      await showAlert('Monto Inválido', 'El abono debe ser un número mayor a 0.', 'warning');
      return;
    }

    if (amount > currentDebt) {
      await showAlert('Monto Excedido', `El abono no puede ser mayor a la deuda pendiente actual (RD$ ${currentDebt.toFixed(2)}).`, 'warning');
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
      'Confirmar Abono',
      `¿Confirmar abono de RD$ ${amount.toFixed(2)} para el cliente "${selectedCustomer.name}"?`
    );

    if (!confirmPayment) {
      return;
    }

    const paymentId = crypto.randomUUID();
    const newPayment: CustomerPayment = {
      id: paymentId,
      customerId: selectedCustomer.id,
      amount: amount,
      date: new Date().toISOString(),
      paymentMethod: paymentMethod,
      bankAccountId: ['transfer', 'card'].includes(paymentMethod) ? selectedBankAccountId || undefined : undefined,
      employeeId: currentEmployee?.id || undefined,
      employeeName: currentEmployee?.name || clerkName || undefined,
    };

    try {
      await firestoreService.setDocWithId('customerPayments', paymentId, newPayment);
      
      setPaymentAmountStr('');
      setPaymentMethod('cash');
      setSelectedBankAccountId('');
      await showAlert(
        'Abono Registrado',
        `Se ha registrado el abono de RD$ ${amount.toFixed(2)} con éxito.`,
        'success'
      );
    } catch (err) {
      console.error('Error registering customer payment:', err);
      await showAlert(
        'Error',
        'Ocurrió un error al registrar el abono.',
        'error'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 animate-fade-in h-screen w-screen overflow-hidden">
      
      {/* 1. Header Area */}
      <header className="bg-white border-b border-slate-200 shrink-0 shadow-xs px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              <Users className="w-5.5 h-5.5 text-indigo-600" />
              <span>CARTERA DE CLIENTES Y CRÉDITOS</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Historial de deudas, abonos y liquidaciones de cuentas por cobrar</p>
          </div>
        </div>

        {/* Global Stats */}
        <div className="flex items-center gap-4 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2 text-rose-800">
          <DollarSign className="w-5 h-5 text-rose-500 shrink-0" />
          <div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 block">Total Cuentas x Cobrar</span>
            <span className="text-sm font-black font-mono">RD$ {totalOutstandingCredit.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0 uppercase tracking-wider"
        >
          <span>Cerrar</span>
        </button>
      </header>

      {/* 2. Three-Pane Dashboard */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* ================= PANE 1: Customer List & Registration ================= */}
        <aside className="w-80 border-r border-slate-200 bg-white flex flex-col h-full shrink-0">
          {/* List Toolbar */}
          <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full pl-9 pr-4 py-2 bg-slate-150 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{showAddForm ? 'Cancelar Registro' : 'Registrar Nuevo Cliente'}</span>
            </button>
          </div>

          {/* Scrolling Panel body */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/40 divide-y divide-slate-100">
            {/* Create Customer form inline if active */}
            {showAddForm && (
              <form onSubmit={handleAddCustomer} className="p-4 bg-indigo-50/30 border-b border-indigo-100/50 space-y-3 animate-fade-in">
                <h3 className="text-xs font-extrabold text-indigo-800 uppercase tracking-wider mb-2">Nuevo Cliente</h3>
                {formError && <p className="text-[10px] text-rose-600 font-bold">{formError}</p>}
                
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Celular</label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="809-555-0100"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1 font-mono">Límite Crédito</label>
                    <input
                      type="number"
                      value={newCreditLimit}
                      disabled={newNoCreditLimit}
                      onChange={(e) => setNewCreditLimit(e.target.value)}
                      placeholder="5000"
                      className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none ${
                        newNoCreditLimit ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="checkbox"
                        id="newNoCreditLimit"
                        checked={newNoCreditLimit}
                        onChange={(e) => setNewNoCreditLimit(e.target.checked)}
                        className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 cursor-pointer"
                      />
                      <label htmlFor="newNoCreditLimit" className="text-[10px] font-bold text-slate-600 cursor-pointer select-none">
                        Sin límite
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Deuda anterior (de otro sistema)</label>
                  <input
                    type="number"
                    step="any"
                    value={newOpeningDebt}
                    onChange={(e) => setNewOpeningDebt(e.target.value)}
                    placeholder="RD$ 0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Lista de Precios Especial</label>
                  <select
                    value={newPriceListId}
                    onChange={(e) => setNewPriceListId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Ninguna (Precio Normal) --</option>
                    {(dashboardConfig?.clientPriceLists || []).map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name} (+{pl.profitPercent}% ganancia sobre costo)
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-colors"
                >
                  Guardar Cliente
                </button>
              </form>
            )}

            {/* Customers list rows */}
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No se encontraron clientes
              </div>
            ) : (
              filteredCustomers.map(c => {
                const debt = customerDebts[c.id] || 0;
                const isSelected = selectedCustomerId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setSelectedSaleId(null); // Reset invoice selection when changing customer
                    }}
                    className={`w-full text-left p-3.5 flex justify-between items-center transition-all border-l-4 cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-50/60 border-indigo-600 shadow-sm' 
                        : 'bg-white border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-xs text-slate-800 truncate uppercase" title={c.name}>{c.name}</p>
                      {c.phone && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{c.phone}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 pl-3">
                      <span className={`text-xs font-black font-mono px-2 py-1 rounded-xl ${
                        debt > 0 
                          ? 'bg-rose-50 text-rose-700 border border-rose-100 font-black' 
                          : 'bg-slate-100 text-slate-500 font-medium'
                      }`}>
                        ${debt.toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ================= PANE 2: Customer Detail & History (Bill by Bill) ================= */}
        <section className="flex-1 bg-white border-r border-slate-200 flex flex-col h-full min-w-0">
          {selectedCustomer ? (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              {/* Customer Top Detail Bar */}
              <div className="p-6 border-b border-slate-150 bg-slate-50/60 shrink-0 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
                      <span>{selectedCustomer.name}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-600 font-mono font-black py-0.5 px-2 rounded-lg">ID: {selectedCustomer.id.slice(0, 6)}</span>
                    </h2>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 font-medium mt-1.5">
                      {selectedCustomer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {selectedCustomer.phone}
                        </span>
                      )}
                      {selectedCustomer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {selectedCustomer.email}
                        </span>
                      )}
                      <span className="text-slate-400">
                        Límite Crédito: {selectedCustomer.noCreditLimit ? 'Sin límite' : `RD$ ${(selectedCustomer.creditLimit || 0).toFixed(2)}`}
                      </span>
                      {selectedCustomer.priceListId && (
                        (() => {
                          const pl = (dashboardConfig?.clientPriceLists || []).find(p => p.id === selectedCustomer.priceListId);
                          return pl ? (
                            <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg font-bold">
                              🏷️ Lista: {pl.name} (+{pl.profitPercent}%)
                            </span>
                          ) : null;
                        })()
                      )}
                    </div>
                  </div>

                  {/* Account Actions / Debt Balance */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 mr-2">
                      <button
                        onClick={handleOpenEditModal}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={handleDeleteCustomer}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Deuda Pendiente</span>
                      <span className={`text-xl font-black font-mono ${
                        (customerDebts[selectedCustomer.id] || 0) > 0 ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        RD$ {(customerDebts[selectedCustomer.id] || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Registrar Abono Form when debt > 0 */}
                {(customerDebts[selectedCustomer.id] || 0) > 0 && (
                  <form onSubmit={handleRegisterPayment} className="pt-4 border-t border-slate-200 flex flex-col gap-3 w-full">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Registrar Nuevo Abono</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Amount Input */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">Monto a abonar</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">RD$</span>
                          <input
                            type="number"
                            step="any"
                            required
                            value={paymentAmountStr}
                            onChange={(e) => setPaymentAmountStr(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-11 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-[36px]"
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
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-700 tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500 h-[36px]"
                        >
                          <option value="cash">Efectivo</option>
                          <option value="card">Tarjeta</option>
                          <option value="transfer">Transferencia</option>
                        </select>
                      </div>
                    </div>

                    {/* Bank Account Selector (for transfer or card) */}
                    {['transfer', 'card'].includes(paymentMethod) && (() => {
                      const activeBankAccounts = (dashboardConfig?.bankAccounts ?? []).filter(ba => ba.active);
                      return (
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">
                            Cuenta Bancaria {paymentMethod === 'card' ? 'Destino' : 'Origen'} (Obligatorio)
                          </label>
                          {activeBankAccounts.length === 0 ? (
                            <div className="text-xs text-amber-800 font-semibold bg-amber-50 border border-amber-250 p-2.5 rounded-xl">
                              ⚠️ No hay cuentas bancarias activas registradas. Configure una cuenta en Configuración &gt; Dashboard.
                            </div>
                          ) : (
                            <select
                              value={selectedBankAccountId}
                              onChange={(e) => setSelectedBankAccountId(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="">-- Seleccionar Cuenta Bancaria --</option>
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

                    <div className="flex justify-end mt-1">
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md hover:shadow-emerald-100 transition-all cursor-pointer h-[36px]"
                      >
                        <Coins className="w-4 h-4" />
                        <span>Confirmar Abono</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Purchase history filter options */}
              <div className="px-6 py-3 border-b border-slate-100 bg-white shrink-0 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historial de Compras (Facturas)</span>
                
                {/* Pending vs All tab toggler */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setHistoryTab('pending')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      historyTab === 'pending'
                        ? 'bg-white text-slate-800 shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-rose-500" />
                    <span>Solo Deuda Pendiente</span>
                  </button>
                  <button
                    onClick={() => setHistoryTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      historyTab === 'all'
                        ? 'bg-white text-slate-800 shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5 text-slate-400" />
                    <span>Todas las Compras</span>
                  </button>
                </div>
              </div>

              {/* Bill by Bill Grid and Abonos History */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6 min-h-0">
                {/* Historial de Compras (Facturas) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                    {historyTab === 'pending' ? 'Facturas con Deuda Pendiente' : 'Historial de Compras'}
                  </h3>
                  
                  {customerSales.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[160px]">
                      <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mb-2">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-slate-700 text-xs">No hay compras registradas</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[250px]">
                        {historyTab === 'pending' 
                          ? 'Este cliente no tiene cuentas pendientes activas.' 
                          : 'Este cliente no tiene ninguna compra registrada.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customerSales.map(s => {
                        const isSelected = selectedSaleId === s.id;
                        const isSalePending = s.isCredit && s.creditStatus === 'pending';
                        
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSaleId(s.id)}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex justify-between items-center shadow-xs ${
                              isSelected 
                                ? 'border-indigo-600 bg-indigo-50/30 shadow-md ring-1 ring-indigo-500' 
                                : 'border-slate-200 bg-white hover:border-slate-350 hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-4">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs text-slate-800 font-mono">{s.ticketNumber}</span>
                                
                                {/* Status Badge */}
                                <span className={`text-[9px] font-black tracking-wider px-2 py-0.5 rounded-md ${
                                  isSalePending 
                                    ? 'bg-rose-100 text-rose-800 animate-pulse' 
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {isSalePending ? 'PENDIENTE' : 'LIQUIDADA / PAGADA'}
                                </span>
                              </div>
                              
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                                <span>📅 {s.date}</span>
                                <span>•</span>
                                <span>Atendió: {s.soldBy?.name || 'Cajero Principal'}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block font-semibold">Total</span>
                                <span className="text-sm font-black font-mono text-slate-800">RD$ {s.total.toFixed(2)}</span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Historial de Abonos */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-emerald-600" />
                    <span>Historial de Abonos Recibidos</span>
                  </h3>
                  
                  {selectedCustomerPayments.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs font-semibold">
                      No hay abonos registrados para este cliente.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedCustomerPayments.map(p => (
                        <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center shadow-xs">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-[9px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">ABONO</span>
                              <span className="text-[10px] text-slate-400 font-mono">{new Date(p.date).toLocaleString('es-ES', { hour12: false })}</span>
                            </div>
                            {p.employeeName && (
                              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Registró: {p.employeeName}</p>
                            )}
                          </div>
                          <span className="text-xs font-black text-emerald-600 font-mono">
                            + RD$ {p.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Users className="w-16 h-16 text-slate-300 mb-4 stroke-[1.5]" />
              <h3 className="font-bold text-slate-800 text-sm">Ningún Cliente Seleccionado</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-sm">
                Seleccione un cliente de la lista de la izquierda para ver su historial de deudas, abonos, cuentas pendientes y realizar liquidaciones de pago.
              </p>
            </div>
          )}
        </section>

        {/* ================= PANE 3: Invoice Detailed Viewer ================= */}
        <aside className="w-80 bg-slate-50 flex flex-col h-full overflow-hidden shrink-0">
          <div className="p-4 border-b border-slate-200 bg-white shrink-0">
            <span className="text-xs font-black text-slate-400 block uppercase tracking-wider">Detalle del Ticket Seleccionado</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0 bg-slate-100">
            {selectedSale ? (
              <div className="bg-white border border-slate-250 rounded-xl p-5 shadow-md font-mono text-xs text-slate-800 leading-relaxed relative overflow-hidden animate-scale-up mx-auto w-full max-w-xs">
                {/* Zigzag cut top */}
                <div className="absolute top-0 inset-x-0 h-1 flex justify-between">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="w-2.5 h-1.5 bg-slate-100 rotate-45 -translate-y-1.5" />
                  ))}
                </div>

                {/* Header info */}
                <div className="pt-2 text-center border-b border-dashed border-slate-200 pb-4 space-y-1">
                  <h4 className="font-extrabold text-xs text-slate-900 tracking-tight uppercase">FACTURA DETALLADA</h4>
                  <p className="text-[10px] text-slate-400">PUNTO DE VENTA DEUDAS</p>
                </div>

                {/* Audit details */}
                <div className="py-2.5 border-b border-dashed border-slate-200 space-y-1 text-slate-500">
                  <div className="flex justify-between">
                    <span>Ticket:</span>
                    <span className="font-bold text-slate-900">{selectedSale.ticketNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fecha:</span>
                    <span>{selectedSale.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vendedor:</span>
                    <span>{selectedSale.soldBy?.name || 'Caja 1'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cliente:</span>
                    <span className="truncate max-w-[120px] font-bold text-slate-800">{selectedSale.customerName || 'No indicado'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Forma Pago:</span>
                    <span className="font-black text-rose-700 uppercase">A Crédito</span>
                  </div>
                </div>

                {/* Products Purchased list */}
                <div className="py-3 border-b border-dashed border-slate-200 space-y-2.5">
                  <div className="flex justify-between font-bold text-slate-900 pb-0.5">
                    <span>Descripción</span>
                    <span className="text-right">Importe</span>
                  </div>
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-0.5">
                    {selectedSale.items.map((item) => (
                      <div key={item.product.id} className="flex justify-between items-start text-slate-650 gap-4 text-[10px]">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold text-slate-800">{item.product.name}</div>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            {item.quantity} pza{item.quantity !== 1 ? 's' : ''} x ${item.product.price.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right font-bold text-slate-800 shrink-0">
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing summary */}
                <div className="py-2.5 border-b border-dashed border-slate-200 space-y-1">
                  <div className="flex justify-between text-sm font-extrabold text-slate-950">
                    <span>TOTAL:</span>
                    <span>RD$ {selectedSale.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Status audit */}
                <div className="pt-2 text-center">
                  <div className={`p-2 rounded-lg font-sans font-black tracking-wider text-[10px] text-center ${
                    selectedSale.isCredit && selectedSale.creditStatus === 'pending'
                      ? 'bg-rose-50 text-rose-700 border border-rose-100 animate-pulse'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}>
                    {selectedSale.isCredit && selectedSale.creditStatus === 'pending'
                      ? '⚠️ PENDIENTE DE COBRO'
                      : '✅ LIQUIDADO EN CAJA'}
                  </div>
                  
                  <button 
                    onClick={() => window.print()}
                    className="mt-3.5 w-full py-1.5 px-3 rounded-lg border border-slate-250 hover:bg-slate-50 transition-colors font-sans text-[10px] text-slate-600 font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Reimprimir Recibo
                  </button>
                </div>

                {/* Zigzag cut bottom */}
                <div className="absolute bottom-0 inset-x-0 h-1 flex justify-between rotate-180">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="w-2.5 h-1.5 bg-slate-100 rotate-45 -translate-y-1.5" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-4 border border-dashed border-slate-300 rounded-xl bg-white/50">
                <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-500">Ninguna factura seleccionada</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[160px]">Haga clic en una factura del historial del cliente para ver su contenido aquí.</p>
              </div>
            )}
          </div>
        </aside>

      </div>

      {/* Edit Customer Modal */}
      {isEditModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-850 uppercase">Editar Cliente</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editFormError && (
              <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                {editFormError}
              </p>
            )}

            <form onSubmit={handleUpdateCustomer} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Celular</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="809-555-0100"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Límite Crédito</label>
                  <input
                    type="number"
                    value={editCreditLimit}
                    disabled={editNoCreditLimit}
                    onChange={(e) => setEditCreditLimit(e.target.value)}
                    placeholder="5000"
                    className={`w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none ${
                      editNoCreditLimit ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
                    }`}
                  />
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="checkbox"
                      id="editNoCreditLimit"
                      checked={editNoCreditLimit}
                      onChange={(e) => setEditNoCreditLimit(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="editNoCreditLimit" className="text-[10px] font-bold text-slate-600 cursor-pointer select-none">
                      Sin límite
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Lista de Precios Especial</label>
                <select
                  value={editPriceListId}
                  onChange={(e) => setEditPriceListId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Ninguna (Precio Normal) --</option>
                  {(dashboardConfig?.clientPriceLists || []).map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} (+{pl.profitPercent}% ganancia sobre costo)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Deuda Anterior (No Editable)</label>
                <input
                  type="text"
                  disabled
                  value={`RD$ ${(selectedCustomer.openingDebt || 0).toFixed(2)}`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-100 text-slate-500 font-bold cursor-not-allowed"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
