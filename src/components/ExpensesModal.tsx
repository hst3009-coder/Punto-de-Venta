import React, { useState, useMemo } from 'react';
import { 
  X, 
  DollarSign, 
  FileText, 
  Tag, 
  Calendar, 
  User, 
  Plus, 
  History,
  TrendingDown,
  AlertCircle,
  Hash
} from 'lucide-react';
import { Movement, Employee, Closure } from '../types';
import { firestoreService } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useAlert } from '../context/AlertContext';

interface ExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  movements: Movement[];
  currentEmployee: Employee | null;
  clerkName: string;
  forcePaymentMethod?: 'cash' | 'card' | 'transfer';
  closures?: Closure[];
}

const CATEGORY_SUGGESTIONS = [
  'Servicios',
  'Renta',
  'Suministros',
  'Nómina',
  'Otro'
];

export const ExpensesModal: React.FC<ExpensesModalProps> = ({
  isOpen,
  onClose,
  movements,
  currentEmployee,
  clerkName,
  closures = []
}) => {
  const { showAlert } = useAlert();
  const [amount, setAmount] = useState<string>('');
  const [concept, setConcept] = useState<string>('');
  const [category, setCategory] = useState<string>('Servicios');
  const [customCategory, setCustomCategory] = useState<string>('');
  const paymentMethod = 'cash' as const;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseType, setExpenseType] = useState<'gasto' | 'pago_factura'>('gasto');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [isOperational, setIsOperational] = useState(true);

  React.useEffect(() => {
    if (isOpen) {
      setAmount('');
      setConcept('');
      setCategory('Servicios');
      setCustomCategory('');
      setExpenseType('gasto');
      setInvoiceNumber('');
      setIsOperational(true);
    }
  }, [isOpen]);

  const activeCategory = category === 'Otro' ? customCategory : category;

  const handleSubmit = async (e: React.FormEvent) => {
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

    if (category === 'Otro' && !customCategory.trim()) {
      showAlert('Por favor especifique la categoría del egreso', 'error');
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
        clerkName,
        employeeId: currentEmployee?.id || undefined,
        employeeName: currentEmployee?.name || undefined,
        date: new Date().toLocaleString('es-ES', { hour12: false }),
        createdAt: new Date().toISOString(),
        expenseType,
        invoiceNumber: expenseType === 'pago_factura' && invoiceNumber.trim() ? invoiceNumber.trim() : undefined,
        isOperational: expenseType === 'pago_factura' ? true : isOperational,
        source: 'shift' as const
      };

      await firestoreService.addDoc('movements', expenseData);
      try {
        await firestoreService.addDoc('auditLogs', {
          action: 'register_expense',
          description: `Egreso registrado: RD$ ${parsedAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })} - ${concept.trim()} (${activeCategory.trim()})`,
          employeeId: currentEmployee?.id || '',
          employeeName: currentEmployee?.name || clerkName || 'Cajero',
          createdAt: new Date().toISOString()
        });
      } catch (auditErr) {
        console.error('Error logging register_expense audit:', auditErr);
      }
      showAlert('Egreso registrado exitosamente', 'success');
      
      // Reset form
      setAmount('');
      setConcept('');
      setCategory('Servicios');
      setCustomCategory('');
      setExpenseType('gasto');
      setInvoiceNumber('');
      setIsOperational(true);
    } catch (error) {
      console.error('Error saving movement:', error);
      showAlert('Ocurrió un error al registrar el egreso', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const recentExpenses = useMemo(() => {
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

      return movements.filter(m => {
        if (m.type !== 'out') return false;
        const source = m.source ?? 'shift';
        if (source !== 'shift') return false;
        if (m.employeeId !== currentEmployee.id) return false;
        const mTime = new Date(m.createdAt || m.date).getTime();
        return mTime > lastClosureTime;
      });
    } else {
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
        />

        {/* Dialog Container */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className={`relative bg-white w-full ${recentExpenses.length > 0 ? 'max-w-5xl' : 'max-w-xl'} h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 transition-all`}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-xs">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Módulo de Egresos</h3>
                <p className="text-xs text-slate-500">Registra y administra salidas de caja y gastos de la tienda</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Core Layout Split */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            
            {/* Left Hand: Registration Form */}
            <div className={`${recentExpenses.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'} p-6 overflow-y-auto flex flex-col justify-between`}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-rose-50/50 border border-rose-100/80 rounded-2xl p-3.5 flex gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700 leading-relaxed font-medium">
                    Todo egreso reduce la liquidez real disponible en caja en efectivo si se registra como tal. Por favor, asegúrese de ingresar los datos correctos.
                  </p>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Monto del Egreso
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-bold">$</span>
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-8 pr-4 text-slate-800 text-lg font-black focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>

                {/* Concept */}
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Concepto / Razón
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pago de basura, compra de bolsas..."
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm font-medium focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Tipo de Egreso */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    Tipo de Egreso
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExpenseType('gasto')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                        expenseType === 'gasto'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100/50'
                      }`}
                    >
                      Gasto
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseType('pago_factura')}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                        expenseType === 'pago_factura'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100/50'
                      }`}
                    >
                      Pago de Factura
                    </button>
                  </div>
                </div>

                {/* Número de factura (opcional cuando expenseType es 'pago_factura') */}
                {expenseType === 'pago_factura' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5" /> # Factura (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 1234, FACT-0092..."
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-4 text-xs font-medium focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden transition-all placeholder:text-slate-400"
                    />
                  </motion.div>
                )}

                {/* Is Operational Checkbox (only if expenseType is 'gasto') */}
                {expenseType === 'gasto' && (
                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="expense-is-operational"
                      checked={isOperational}
                      onChange={(e) => setIsOperational(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="expense-is-operational" className="text-xs font-semibold text-slate-600 select-none cursor-pointer">
                      Es un gasto operativo del negocio
                    </label>
                  </div>
                )}

                {/* Category Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" /> Categoría
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CATEGORY_SUGGESTIONS.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategory(cat);
                          if (cat !== 'Otro') setCustomCategory('');
                        }}
                        className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all truncate cursor-pointer ${
                          category === cat 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100/50'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {category === 'Otro' && (
                    <motion.input
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      type="text"
                      required
                      placeholder="Especifique la categoría..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 px-4 text-xs font-medium focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden transition-all placeholder:text-slate-400 mt-1.5"
                    />
                  )}
                </div>

                {/* Submitter info (Read only) */}
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 flex justify-between items-center text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Registra:</span>
                  <span className="font-bold text-slate-700">{currentEmployee ? currentEmployee.name : clerkName}</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-rose-600/15 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Registrando...' : 'Registrar Egreso'}</span>
                </button>
              </form>
            </div>

            {/* Right Hand: Recent History */}
            {recentExpenses.length > 0 && (
              <div className="lg:col-span-7 p-6 overflow-hidden flex flex-col h-full bg-slate-50/30">
                <div className="flex items-center gap-1.5 mb-4 shrink-0">
                  <History className="w-4 h-4 text-slate-400" />
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Historial de Egresos Recientes</h4>
                </div>

                <div className="flex-1 overflow-y-auto pr-1">
                  <div className="space-y-2">
                    {recentExpenses.map((expense) => (
                      <div 
                        key={expense.id}
                        className="bg-white border border-slate-150 rounded-xl p-3 flex items-center justify-between hover:border-slate-200 transition-all shadow-xs group"
                      >
                        <div className="space-y-1 flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-rose-600 uppercase tracking-tight px-1.5 py-0.5 bg-rose-50 rounded-md">
                              {expense.category}
                            </span>
                            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight px-1.5 py-0.5 bg-slate-100 rounded-md">
                              {expense.expenseType === 'pago_factura' ? 'Pago de Factura' : 'Gasto'}
                            </span>
                            {expense.isOperational === false && (
                              <span className="text-[10px] font-black text-amber-700 uppercase tracking-tight px-1.5 py-0.5 bg-amber-50 border border-amber-100 rounded-md">
                                Personal
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
                              <Calendar className="w-3 h-3" /> {expense.date}
                            </span>
                          </div>
                          <p className="text-sm font-extrabold text-slate-800 truncate uppercase" title={expense.concept}>
                            {expense.concept}
                            {expense.expenseType === 'pago_factura' && expense.invoiceNumber && (
                              <span className="text-indigo-600 font-bold normal-case ml-1">
                                — Factura #{expense.invoiceNumber}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                            <span className="truncate">Registró: {expense.employeeName || expense.clerkName}</span>
                            <span>•</span>
                            <span className="uppercase font-bold">
                              {expense.paymentMethod === 'cash' ? '💵 Efectivo' :
                               expense.paymentMethod === 'card' ? '💳 Tarjeta' : '🏦 Transf.'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-black text-rose-600">
                            -${expense.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
