import React, { useState, useMemo } from 'react';
import { 
  TrendingDown, 
  Plus, 
  Search, 
  Calendar, 
  CreditCard, 
  Building2, 
  Filter, 
  DollarSign, 
  Tag, 
  FileText, 
  User, 
  X, 
  CheckCircle, 
  ArrowDownCircle, 
  ShieldAlert, 
  Briefcase, 
  HelpCircle,
  Clock,
  Layers,
  Trash2
} from 'lucide-react';
import { Movement, Employee, DashboardConfig } from '../types';
import { firestoreService } from '../lib/firebase';
import { useAlert } from '../context/AlertContext';
import { motion, AnimatePresence } from 'motion/react';

interface ExpensesViewProps {
  movements: Movement[];
  currentEmployee: Employee | null;
  clerkName: string;
  dashboardConfig: DashboardConfig | null;
  employees?: Employee[];
}

const CATEGORY_SUGGESTIONS = [
  'Servicios',
  'Renta',
  'Suministros',
  'Nómina',
  'Mantenimiento',
  'Transporte',
  'Publicidad',
  'Impuestos',
  'Otro'
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  movements,
  currentEmployee,
  clerkName,
  dashboardConfig,
  employees = []
}) => {
  const { showAlert, showConfirm } = useAlert();

  // Filter states
  const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card' | 'transfer'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'operational' | 'personal' | 'pago_factura'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'shift' | 'dashboard'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // New Egreso Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [concept, setConcept] = useState<string>('');
  const [category, setCategory] = useState<string>('Servicios');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [expenseType, setExpenseType] = useState<'gasto' | 'pago_factura'>('gasto');
  const [isOperational, setIsOperational] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active bank accounts
  const activeBankAccounts = useMemo(() => {
    return (dashboardConfig?.bankAccounts ?? []).filter(ba => ba.active);
  }, [dashboardConfig]);

  // Handle preset date changes
  const handleDatePresetChange = (preset: 'today' | 'week' | 'month' | 'all' | 'custom') => {
    setDatePreset(preset);
    if (preset === 'today') {
      const todayStr = new Date().toISOString().substring(0, 10);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'week') {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(sevenDaysAgo.toISOString().substring(0, 10));
      setEndDate(now.toISOString().substring(0, 10));
    } else if (preset === 'month') {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().substring(0, 10));
      setEndDate(now.toISOString().substring(0, 10));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Initialize date preset default to 'month'
  React.useEffect(() => {
    if (datePreset === 'month' && !startDate && !endDate) {
      handleDatePresetChange('month');
    }
  }, []);

  // Filtered movements list
  const filteredMovements = useMemo(() => {
    return movements
      .filter(m => m.type === 'out')
      .filter(m => {
        // Date range filter
        if (startDate || endDate) {
          const mDateStr = (m.createdAt || m.date).substring(0, 10);
          if (startDate && mDateStr < startDate) return false;
          if (endDate && mDateStr > endDate) return false;
        }

        // Payment method filter
        if (paymentFilter !== 'all' && m.paymentMethod !== paymentFilter) return false;

        // Type / Operatividad filter
        if (typeFilter === 'operational') {
          if (m.isOperational === false) return false;
        } else if (typeFilter === 'personal') {
          if (m.isOperational !== false) return false;
        } else if (typeFilter === 'pago_factura') {
          if (m.expenseType !== 'pago_factura') return false;
        }

        // Source filter
        if (sourceFilter !== 'all') {
          const mSource = m.source ?? 'shift';
          if (mSource !== sourceFilter) return false;
        }

        // Search term
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const conceptMatch = m.concept?.toLowerCase().includes(term);
          const catMatch = m.category?.toLowerCase().includes(term);
          const clerkMatch = m.clerkName?.toLowerCase().includes(term) || m.employeeName?.toLowerCase().includes(term);
          const amountMatch = m.amount.toString().includes(term);
          if (!conceptMatch && !catMatch && !clerkMatch && !amountMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || a.date).getTime();
        const timeB = new Date(b.createdAt || b.date).getTime();
        return timeB - timeA;
      });
  }, [movements, startDate, endDate, paymentFilter, typeFilter, sourceFilter, searchTerm]);

  // KPI Metrics calculation
  const metrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let card = 0;
    let transfer = 0;
    let operational = 0;
    let personal = 0;
    let shiftSource = 0;
    let dashboardSource = 0;

    filteredMovements.forEach(m => {
      total += m.amount;
      if (m.paymentMethod === 'cash') cash += m.amount;
      else if (m.paymentMethod === 'card') card += m.amount;
      else if (m.paymentMethod === 'transfer') transfer += m.amount;

      if (m.isOperational === false) {
        personal += m.amount;
      } else {
        operational += m.amount;
      }

      if ((m.source ?? 'shift') === 'dashboard') {
        dashboardSource += m.amount;
      } else {
        shiftSource += m.amount;
      }
    });

    return { total, cash, card, transfer, operational, personal, shiftSource, dashboardSource };
  }, [filteredMovements]);

  // Submit new egreso from dashboard
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showAlert('Por favor ingrese un monto válido mayor a 0', 'error');
      return;
    }

    if (!concept.trim()) {
      showAlert('Por favor ingrese un concepto para el egreso', 'error');
      return;
    }

    const activeCategory = category === 'Otro' ? customCategory : category;
    if (category === 'Otro' && !customCategory.trim()) {
      showAlert('Por favor especifique la categoría del egreso', 'error');
      return;
    }

    if (paymentMethod === 'transfer' && !bankAccountId && activeBankAccounts.length > 0) {
      showAlert('Por favor seleccione una cuenta bancaria para la transferencia', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const expenseData = {
        type: 'out' as const,
        amount: parsedAmount,
        concept: concept.trim(),
        category: activeCategory.trim(),
        paymentMethod,
        bankAccountId: paymentMethod === 'transfer' ? (bankAccountId || undefined) : undefined,
        clerkName: clerkName || currentEmployee?.name || 'Administrador',
        employeeId: currentEmployee?.id || undefined,
        employeeName: currentEmployee?.name || undefined,
        date: new Date().toLocaleString('es-ES', { hour12: false }),
        createdAt: new Date().toISOString(),
        expenseType,
        isOperational: expenseType === 'pago_factura' ? true : isOperational,
        source: 'dashboard' as const
      };

      await firestoreService.addDoc('movements', expenseData);
      showAlert('Egreso del Dashboard registrado con éxito', 'success');

      // Reset Form & Close Modal
      setAmount('');
      setConcept('');
      setCategory('Servicios');
      setCustomCategory('');
      setPaymentMethod('cash');
      setBankAccountId('');
      setExpenseType('gasto');
      setIsOperational(true);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error creating expense:', err);
      showAlert('Ocurrió un error al guardar el egreso', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete movement action
  const handleDeleteMovement = async (movementId: string) => {
    const confirmed = await showConfirm(
      '¿Está seguro de eliminar este registro de egreso?',
      'Esta acción eliminará el movimiento permanentemente.',
      'Eliminar',
      'Cancelar'
    );

    if (confirmed) {
      try {
        await firestoreService.deleteDoc('movements', movementId);
        showAlert('Egreso eliminado correctamente', 'success');
      } catch (err) {
        console.error('Error deleting movement:', err);
        showAlert('No se pudo eliminar el movimiento', 'error');
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner & New Expense Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-600">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Gestión de Egresos</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Control completo de gastos operativos, facturas y salidas directas
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setPaymentMethod('cash');
            setBankAccountId(activeBankAccounts[0]?.id || '');
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Egreso</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Egresos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Total Egresos ({filteredMovements.length})
          </span>
          <span className="text-lg font-black font-mono text-rose-600 block">
            RD$ {metrics.total.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
            <span>Operativos:</span>
            <span className="font-bold text-slate-700">${metrics.operational.toFixed(2)}</span>
          </div>
        </div>

        {/* Efectivo */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Efectivo
          </span>
          <span className="text-lg font-black font-mono text-emerald-700 block">
            RD$ {metrics.cash.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
            <span>En turnos:</span>
            <span className="font-bold text-slate-700">${metrics.shiftSource.toFixed(2)}</span>
          </div>
        </div>

        {/* Tarjeta */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Tarjeta
          </span>
          <span className="text-lg font-black font-mono text-indigo-600 block">
            RD$ {metrics.card.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
            <span>Directos:</span>
            <span className="font-bold text-slate-700">${metrics.dashboardSource.toFixed(2)}</span>
          </div>
        </div>

        {/* Transferencia */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Transferencia
          </span>
          <span className="text-lg font-black font-mono text-purple-600 block">
            RD$ {metrics.transfer.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
            <span>Cuentas Bco:</span>
            <span className="font-bold text-slate-700">{activeBankAccounts.length} activas</span>
          </div>
        </div>

        {/* Personales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Gastos Personales
          </span>
          <span className="text-lg font-black font-mono text-amber-700 block">
            RD$ {metrics.personal.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
            <span>No Operativo</span>
            <span className="font-bold text-amber-800">Retiros</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-600" /> Filtros de Búsqueda
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {(['month', 'today', 'week', 'all', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => handleDatePresetChange(p)}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition-all ${
                  datePreset === p 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p === 'month' ? 'Este Mes' : p === 'today' ? 'Hoy' : p === 'week' ? 'Últimos 7 días' : p === 'all' ? 'Todo' : 'Personalizado'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {/* Custom Date Inputs */}
          {datePreset === 'custom' && (
            <div className="sm:col-span-2 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Desde:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Hasta:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          )}

          {/* Payment Method Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Método de Pago:</label>
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Todos los Métodos</option>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
            </select>
          </div>

          {/* Type / Classification Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Clasificación:</label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Todas las clasificaciones</option>
              <option value="operational">Gastos Operativos</option>
              <option value="personal">Gastos Personales</option>
              <option value="pago_factura">Pago de Factura</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Origen / Registro:</label>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">Todos los Orígenes</option>
              <option value="shift">Turno / Caja Venta</option>
              <option value="dashboard">Dashboard (Directo)</option>
            </select>
          </div>

          {/* Search Term Input */}
          <div className={datePreset === 'custom' ? 'sm:col-span-2 md:col-span-1' : ''}>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Buscar:</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Concepto, categoría..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4">Concepto y Categoría</th>
                <th className="py-3 px-4">Método de Pago</th>
                <th className="py-3 px-4">Origen</th>
                <th className="py-3 px-4">Clasificación</th>
                <th className="py-3 px-4">Registrado por</th>
                <th className="py-3 px-4 text-right">Monto</th>
                <th className="py-3 px-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMovements.length > 0 ? (
                filteredMovements.map(m => {
                  const mSource = m.source ?? 'shift';
                  const dateVal = m.createdAt || m.date;
                  const dateObj = new Date(dateVal);
                  const dateStr = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                    : m.date;
                  const timeStr = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  // Find bank account label if transfer
                  let bankAccountLabel = '';
                  if (m.paymentMethod === 'transfer' && m.bankAccountId) {
                    const ba = (dashboardConfig?.bankAccounts ?? []).find(b => b.id === m.bankAccountId);
                    if (ba) {
                      bankAccountLabel = `${ba.bankName} (${ba.accountLabel})`;
                    }
                  }

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{dateStr}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{timeStr}</div>
                      </td>

                      {/* Concept & Category */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 max-w-xs truncate">{m.concept}</div>
                        <div className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md mt-0.5">
                          <Tag className="w-2.5 h-2.5 text-slate-400" />
                          <span>{m.category}</span>
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {m.paymentMethod === 'cash' && (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl text-[10px]">
                            <DollarSign className="w-3 h-3 text-emerald-600" /> Efectivo
                          </span>
                        )}
                        {m.paymentMethod === 'card' && (
                          <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-xl text-[10px]">
                            <CreditCard className="w-3 h-3 text-indigo-600" /> Tarjeta
                          </span>
                        )}
                        {m.paymentMethod === 'transfer' && (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-xl text-[10px]">
                              <Building2 className="w-3 h-3 text-purple-600" /> Transferencia
                            </span>
                            {bankAccountLabel && (
                              <span className="text-[9px] text-purple-900/70 font-semibold mt-0.5 ml-1 truncate max-w-[150px]">
                                {bankAccountLabel}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Origen / Source */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {mSource === 'dashboard' ? (
                          <span className="inline-flex items-center gap-1 font-extrabold text-indigo-800 bg-indigo-100/70 border border-indigo-200 px-2.5 py-1 rounded-xl text-[10px]">
                            <Briefcase className="w-3 h-3 text-indigo-600" /> Dashboard
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl text-[10px]">
                            <Clock className="w-3 h-3 text-slate-500" /> Turno (Caja)
                          </span>
                        )}
                      </td>

                      {/* Classification */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {m.expenseType === 'pago_factura' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg text-[10px]">
                            Pago Factura
                          </span>
                        ) : m.isOperational === false ? (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-[10px]">
                            Personal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg text-[10px]">
                            Operativo
                          </span>
                        )}
                      </td>

                      {/* Registered by */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {m.clerkName || m.employeeName || 'Administrador'}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-extrabold font-mono text-rose-600 text-sm whitespace-nowrap">
                        -RD$ {m.amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteMovement(m.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar egreso"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center gap-2">
                      <TrendingDown className="w-8 h-8 text-slate-300" />
                      <span>No se encontraron egresos con los filtros seleccionados</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW EGRESO MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-rose-500/20 rounded-xl text-rose-400">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base tracking-tight">Registrar Egreso (Dashboard)</h3>
                    <p className="text-[11px] text-slate-400">Salida de dinero directa no asociada a caja de turno</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateExpense} className="p-6 space-y-4 overflow-y-auto">
                {/* Monto */}
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                    Monto del Egreso ($)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-black text-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* Concepto */}
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                    Concepto / Descripción
                  </label>
                  <input
                    type="text"
                    required
                    value={concept}
                    onChange={e => setConcept(e.target.value)}
                    placeholder="Ej. Pago de servicio de internet, compra de resma de papel..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  >
                    {CATEGORY_SUGGESTIONS.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  {category === 'Otro' && (
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)}
                      placeholder="Escriba la categoría personalizada..."
                      className="w-full mt-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                    />
                  )}
                </div>

                {/* Método de Pago */}
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-2.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Efectivo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-2.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethod === 'card'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span>Tarjeta</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('transfer');
                        if (!bankAccountId && activeBankAccounts.length > 0) {
                          setBankAccountId(activeBankAccounts[0].id);
                        }
                      }}
                      className={`p-2.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethod === 'transfer'
                          ? 'bg-purple-50 border-purple-500 text-purple-800 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Building2 className="w-4 h-4 text-purple-600" />
                      <span>Transferencia</span>
                    </button>
                  </div>
                </div>

                {/* Cuenta Bancaria Selector (Only if paymentMethod === 'transfer') */}
                {paymentMethod === 'transfer' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="text-xs font-black uppercase text-slate-500 tracking-wider block mb-1.5">
                      Cuenta Bancaria de Salida
                    </label>
                    {activeBankAccounts.length > 0 ? (
                      <select
                        value={bankAccountId}
                        onChange={e => setBankAccountId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      >
                        {activeBankAccounts.map(ba => (
                          <option key={ba.id} value={ba.id}>
                            {ba.bankName} - {ba.accountLabel}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                        No hay cuentas bancarias activas registradas en configuración.
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Tipo de Egreso & Operatividad */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      Tipo de Registro
                    </label>
                    <select
                      value={expenseType}
                      onChange={e => setExpenseType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-800"
                    >
                      <option value="gasto">Gasto General</option>
                      <option value="pago_factura">Pago de Factura</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      Clasificación
                    </label>
                    <select
                      value={expenseType === 'pago_factura' ? 'true' : String(isOperational)}
                      disabled={expenseType === 'pago_factura'}
                      onChange={e => setIsOperational(e.target.value === 'true')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-800 disabled:opacity-60"
                    >
                      <option value="true">Gasto Operativo</option>
                      <option value="false">Gasto Personal / Retiro</option>
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar Egreso'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
