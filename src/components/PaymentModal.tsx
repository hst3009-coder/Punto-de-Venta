import React, { useState, useEffect } from 'react';
import { CartItem, PaymentMethod, PaymentBreakdownItem, Sale, StoreIdentity, Customer, CustomerPayment, DashboardConfig, CustomerRefund } from '../types';
import { X, Check, CreditCard, Wallet, QrCode, Coins, Printer, RefreshCw, Users, Layers, Plus, Trash2, AlertCircle } from 'lucide-react';
import { roundCents } from '../lib/money';
import { useAlert } from '../context/AlertContext';
import { getCustomerDebt } from '../lib/customerDebt';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  onSubmitSale: (sale: Sale) => void;
  clerkName: string;
  storeIdentity: StoreIdentity;
  customers: Customer[];
  sales?: Sale[];
  customerPayments?: CustomerPayment[];
  customerRefunds?: CustomerRefund[];
  dashboardConfig?: DashboardConfig;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  subtotal,
  tax,
  total,
  onSubmitSale,
  clerkName,
  storeIdentity,
  customers,
  sales = [],
  customerPayments = [],
  customerRefunds = [],
  dashboardConfig,
}) => {
  const { showAlert, showConfirm } = useAlert();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [amountPaidStr, setAmountPaidStr] = useState<string>('');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  
  // Mixed payment breakdown state
  const [mixedBreakdown, setMixedBreakdown] = useState<PaymentBreakdownItem[]>([
    { id: '1', method: 'cash', amount: total }
  ]);

  const cashInputRef = React.useRef<HTMLInputElement | null>(null);

  // Reset payment details when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('cash');
      setAmountPaidStr(total.toFixed(2));
      setSelectedCustomerId('');
      setSelectedBankAccountId('');
      setMixedBreakdown([
        { id: crypto.randomUUID(), method: 'cash', amount: total }
      ]);
    }
  }, [isOpen, total]);

  // Auto-fill exact amount for standard payment methods
  useEffect(() => {
    if (isOpen) {
      setAmountPaidStr(total.toFixed(2));
      if (paymentMethod === 'mixed') {
        setMixedBreakdown([
          { id: crypto.randomUUID(), method: 'cash', amount: total }
        ]);
      }
    }
  }, [paymentMethod, total, isOpen]);

  // Focus input when cash mode is selected or when modal opens
  useEffect(() => {
    if (isOpen && paymentMethod === 'cash') {
      setTimeout(() => {
        cashInputRef.current?.focus();
        cashInputRef.current?.select();
      }, 80);
    }
  }, [isOpen, paymentMethod]);

  const amountPaid = roundCents(parseFloat(amountPaidStr) || 0);
  const change = roundCents(Math.max(0, amountPaid - total));
  const isValidAmount = amountPaid >= total;

  // Calculations for Mixed Breakdown
  const activeBankAccounts = (dashboardConfig?.bankAccounts ?? []).filter(ba => ba.active);

  const mixedTotalEntered = roundCents(
    mixedBreakdown.reduce((sum, item) => sum + (item.method !== 'credit_note' ? (Number(item.amount) || 0) : 0), 0)
  );

  const mixedChangeAmount = roundCents(Math.max(0, mixedTotalEntered - total));
  const mixedMissingAmount = roundCents(Math.max(0, total - mixedTotalEntered));
  const mixedCashTotal = roundCents(
    mixedBreakdown
      .filter(item => item.method === 'cash')
      .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  );

  const isConfirmDisabled = 
    (paymentMethod === 'cash' && !isValidAmount) ||
    (paymentMethod === 'credit' && !selectedCustomerId) ||
    (paymentMethod === 'transfer' && !selectedBankAccountId) ||
    (paymentMethod === 'mixed' && mixedTotalEntered < total);

  const selectedCust = customers.find(c => c.id === selectedCustomerId);

  // Calculate current debt
  const currentDebt = selectedCustomerId ? getCustomerDebt(selectedCustomerId, sales || [], customerPayments || [], customers, customerRefunds || []) : 0;

  const creditLimitValue = selectedCust?.creditLimit || 0;
  
  // Mixed credit calculation
  const mixedCreditPart = paymentMethod === 'mixed'
    ? mixedBreakdown.filter(item => item.method === 'credit').reduce((s, item) => s + (Number(item.amount) || 0), 0)
    : 0;

  const creditAmountToCompare = paymentMethod === 'credit' ? total : (paymentMethod === 'mixed' ? mixedCreditPart : 0);
  const newDebtValue = currentDebt + creditAmountToCompare;
  const isCreditLimitExceeded = creditLimitValue > 0 && newDebtValue > creditLimitValue;

  const handleAddBreakdownRow = () => {
    const currentSum = mixedBreakdown.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const remaining = roundCents(Math.max(0, total - currentSum));
    setMixedBreakdown(prev => [
      ...prev,
      { id: crypto.randomUUID(), method: 'cash', amount: remaining }
    ]);
  };

  const handleUpdateBreakdownRow = (id: string, field: keyof PaymentBreakdownItem, value: any) => {
    setMixedBreakdown(prev =>
      prev.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const handleRemoveBreakdownRow = (id: string) => {
    if (mixedBreakdown.length <= 1) return;
    setMixedBreakdown(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmPayment = async (shouldPrint: boolean) => {
    if (paymentMethod === 'cash' && !isValidAmount) return;
    if (paymentMethod === 'credit' && !selectedCustomerId) {
      await showAlert(
        'Venta a Crédito',
        'Debe asociar un cliente antes de poder registrar una venta a crédito.',
        'warning'
      );
      return;
    }
    if (paymentMethod === 'transfer' && !selectedBankAccountId) {
      await showAlert(
        'Transferencia requerida',
        'Debe seleccionar una cuenta bancaria de destino para completar la venta por transferencia.',
        'warning'
      );
      return;
    }

    if (paymentMethod === 'mixed') {
      if (mixedTotalEntered < total) {
        await showAlert(
          'Monto Incompleto',
          `El monto total ingresado (RD$ ${mixedTotalEntered.toFixed(2)}) es menor al total a cobrar (RD$ ${total.toFixed(2)}). Falta RD$ ${mixedMissingAmount.toFixed(2)}.`,
          'warning'
        );
        return;
      }

      if (mixedChangeAmount > 0) {
        if (mixedCashTotal < mixedChangeAmount) {
          await showAlert(
            'Cambio Inválido',
            'El cambio solo puede darse en efectivo, ajusta los montos.',
            'warning'
          );
          return;
        }
      }

      const hasCreditNote = mixedBreakdown.some(r => r.method === 'credit_note');
      if (hasCreditNote) {
        await showAlert(
          'Nota de Crédito No Disponible',
          'El método Nota de Crédito estará disponible próximamente.',
          'info'
        );
        return;
      }

      const missingTransferBank = mixedBreakdown.some(r => r.method === 'transfer' && !r.bankAccountId);
      if (missingTransferBank) {
        await showAlert(
          'Cuenta bancaria requerida',
          'Debe seleccionar una cuenta bancaria destino en los renglones de transferencia.',
          'warning'
        );
        return;
      }

      const hasCreditRow = mixedBreakdown.some(r => r.method === 'credit');
      if (hasCreditRow && !selectedCustomerId) {
        await showAlert(
          'Cliente Requerido',
          'Debe asociar un cliente antes de poder registrar una parte de la venta a crédito.',
          'warning'
        );
        return;
      }
    }

    const ticketNumber = `TKT-${Math.floor(100000 + Math.random() * 900000)}`;
    const selectedCust = customers.find(c => c.id === selectedCustomerId);

    const isCreditSale = paymentMethod === 'credit' || (paymentMethod === 'mixed' && mixedBreakdown.some(r => r.method === 'credit'));

    const saleData: Sale = {
      id: crypto.randomUUID(),
      items: [...cartItems],
      total,
      paymentMethod,
      paymentBreakdown: paymentMethod === 'mixed'
        ? mixedBreakdown
            .filter(r => r.method !== 'credit_note')
            .map(r => ({ ...r, amount: Number(r.amount) || 0 }))
        : undefined,
      amountPaid: paymentMethod === 'cash' ? amountPaid : (paymentMethod === 'mixed' ? mixedTotalEntered : (paymentMethod === 'credit' ? 0 : total)),
      change: paymentMethod === 'cash' ? change : (paymentMethod === 'mixed' ? mixedChangeAmount : 0),
      date: new Date().toLocaleString('es-ES', { hour12: false }),
      createdAt: new Date().toISOString(),
      ticketNumber,
      customerId: selectedCustomerId || undefined,
      customerName: selectedCust?.name || undefined,
      isCredit: isCreditSale,
      creditStatus: isCreditSale ? 'pending' : undefined,
      bankAccountId: paymentMethod === 'transfer' ? selectedBankAccountId || undefined : (paymentMethod === 'mixed' ? mixedBreakdown.find(r => r.method === 'transfer')?.bankAccountId || undefined : undefined),
    };

    // 1. Submit sale
    onSubmitSale(saleData);

    // 2. Print if requested
    if (shouldPrint) {
      window.print();
    }

    // 3. Close modal immediately
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        handleConfirmPayment(true);
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleConfirmPayment(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const methods: PaymentMethod[] = selectedCustomerId
          ? ['cash', 'card', 'transfer', 'qr', 'credit', 'mixed']
          : ['cash', 'card', 'transfer', 'qr', 'mixed'];
        const currentIndex = methods.indexOf(paymentMethod);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % methods.length;
          setPaymentMethod(methods[nextIndex]);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const methods: PaymentMethod[] = selectedCustomerId
          ? ['cash', 'card', 'transfer', 'qr', 'credit', 'mixed']
          : ['cash', 'card', 'transfer', 'qr', 'mixed'];
        const currentIndex = methods.indexOf(paymentMethod);
        if (currentIndex !== -1) {
          const prevIndex = (currentIndex - 1 + methods.length) % methods.length;
          setPaymentMethod(methods[prevIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, paymentMethod, amountPaid, isValidAmount, selectedCustomerId, cartItems, total, selectedBankAccountId, mixedBreakdown, mixedTotalEntered]);

  if (!isOpen) return null;

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden border border-slate-200 animate-scale-up">
        
        {/* Left pane: Checkout details and payment triggers */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">
                Seleccionar Pago
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
                {/* Total Display */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">Total a Cobrar</p>
                    <p className="text-xs text-slate-400 mt-0.5">{cartItems.length} artículos</p>
                  </div>
                  <span className="text-3xl font-extrabold text-indigo-600">
                    ${total.toFixed(2)}
                  </span>
                </div>

                {/* Asociar Cliente (Opcional) */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4.5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-500" />
                      <span>Asociar Cliente (Opcional)</span>
                    </label>
                    {selectedCustomerId && (
                      <button
                        onClick={() => {
                          setSelectedCustomerId('');
                          if (paymentMethod === 'credit') {
                            setPaymentMethod('cash');
                          }
                        }}
                        className="text-xs text-rose-500 font-extrabold hover:underline cursor-pointer"
                      >
                        Remover Cliente
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setSelectedCustomerId(cid);
                      if (!cid && paymentMethod === 'credit') {
                        setPaymentMethod('cash');
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-850 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Sin Cliente (Público General) --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>

                  {paymentMethod === 'credit' && selectedCustomerId && isCreditLimitExceeded && (
                    <div id="credit-limit-warning" className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl space-y-1 animate-fade-in">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <span>⚠️ Advertencia de Límite de Crédito</span>
                      </div>
                      <p>Este cliente excede su límite de crédito. Deuda actual: RD${currentDebt.toFixed(2)}, Límite: RD${creditLimitValue.toFixed(2)}, Nueva deuda total: RD${newDebtValue.toFixed(2)}</p>
                    </div>
                  )}
                </div>

                {/* Payment Methods */}
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-3">Método de Pago</label>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-100'
                          : 'border-slate-200 hover:border-indigo-500 text-slate-600 bg-white shadow-xs'
                      }`}
                    >
                      <Coins className="w-5 h-5 mb-1" />
                      <span className="text-xs font-semibold">Efectivo</span>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'card'
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-100'
                          : 'border-slate-200 hover:border-indigo-500 text-slate-600 bg-white shadow-xs'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 mb-1" />
                      <span className="text-xs font-semibold">Tarjeta</span>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('transfer')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'transfer'
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-100'
                          : 'border-slate-200 hover:border-indigo-500 text-slate-600 bg-white shadow-xs'
                      }`}
                    >
                      <Wallet className="w-5 h-5 mb-1" />
                      <span className="text-xs font-semibold">Transf.</span>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('qr')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'qr'
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-100'
                          : 'border-slate-200 hover:border-indigo-500 text-slate-600 bg-white shadow-xs'
                      }`}
                    >
                      <QrCode className="w-5 h-5 mb-1" />
                      <span className="text-xs font-semibold">QR CoDi</span>
                    </button>

                    <button
                      onClick={async () => {
                        if (selectedCustomerId) {
                          setPaymentMethod('credit');
                        } else {
                          await showAlert(
                            'Seleccionar Cliente',
                            'Seleccione un cliente primero para habilitar ventas a crédito.',
                            'info'
                          );
                        }
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'credit'
                          ? 'border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-100'
                          : selectedCustomerId
                          ? 'border-slate-200 hover:border-rose-500 text-slate-600 bg-white shadow-xs hover:text-rose-600'
                          : 'border-slate-100 opacity-45 text-slate-400 bg-slate-50 cursor-not-allowed'
                      }`}
                      title={!selectedCustomerId ? "Requiere seleccionar un cliente" : "Registrar como crédito"}
                    >
                      <Users className="w-5 h-5 mb-1" />
                      <span className="text-xs font-semibold">A Crédito</span>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('mixed')}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'mixed'
                          ? 'border-amber-600 bg-amber-600 text-white shadow-md shadow-amber-100'
                          : 'border-slate-200 hover:border-amber-500 text-slate-600 bg-white shadow-xs'
                      }`}
                    >
                      <Layers className="w-5 h-5 mb-1" />
                      <span className="text-xs font-semibold">Mixto</span>
                    </button>
                  </div>
                </div>

                {/* Mixed Payment UI */}
                {paymentMethod === 'mixed' && (
                  <div className="space-y-4 bg-slate-50/80 p-4 border border-slate-200 rounded-2xl animate-fade-in">
                    {/* Header Summary Bar */}
                    <div className="grid grid-cols-3 gap-2 text-center bg-white p-3 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total a cobrar</span>
                        <span className="text-sm font-extrabold text-slate-800">RD$ {total.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total ingresado</span>
                        <span className="text-sm font-extrabold text-indigo-600">RD$ {mixedTotalEntered.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          {mixedTotalEntered >= total ? 'Cambio' : 'Falta'}
                        </span>
                        <span className={`text-sm font-extrabold ${mixedTotalEntered >= total ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {mixedTotalEntered >= total
                            ? `RD$ ${mixedChangeAmount.toFixed(2)}`
                            : `RD$ ${mixedMissingAmount.toFixed(2)}`}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Rows */}
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {mixedBreakdown.map((row, idx) => (
                        <div key={row.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 relative shadow-2xs">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-400 w-5">#{idx + 1}</span>
                            
                            {/* Method selector */}
                            <select
                              value={row.method}
                              onChange={(e) => handleUpdateBreakdownRow(row.id, 'method', e.target.value)}
                              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="cash">💵 Efectivo</option>
                              <option value="card">💳 Tarjeta</option>
                              <option value="transfer">🏦 Transferencia</option>
                              <option value="credit">👥 Crédito</option>
                              <option value="credit_note">🏷️ Nota de Crédito</option>
                            </select>

                            {/* Amount field */}
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                              {row.method === 'credit_note' ? (
                                <input
                                  type="text"
                                  disabled
                                  value="0.00"
                                  className="w-full pl-6 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-400 cursor-not-allowed"
                                />
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={row.amount || ''}
                                  onChange={(e) => handleUpdateBreakdownRow(row.id, 'amount', parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                  className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-250 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              )}
                            </div>

                            {/* Remove Row Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveBreakdownRow(row.id)}
                              disabled={mixedBreakdown.length <= 1}
                              className={`p-1.5 rounded-lg border text-rose-600 transition-all ${
                                mixedBreakdown.length <= 1
                                  ? 'opacity-30 border-transparent cursor-not-allowed'
                                  : 'hover:bg-rose-50 border-rose-200 cursor-pointer'
                              }`}
                              title="Eliminar renglón"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Extra requirements per method */}
                          {row.method === 'credit_note' && (
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 p-2 rounded-lg text-amber-800 text-[11px] font-semibold">
                              <span>Próximamente</span>
                              <span className="text-[10px] text-amber-600">(El módulo de notas de crédito se construirá posteriormente)</span>
                            </div>
                          )}

                          {row.method === 'transfer' && (
                            <div className="pl-7 space-y-1">
                              <label className="text-[10px] font-black text-slate-500 uppercase">Cuenta bancaria destino:</label>
                              {activeBankAccounts.length === 0 ? (
                                <p className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded">⚠️ No hay cuentas bancarias activas registradas.</p>
                              ) : (
                                <select
                                  value={row.bankAccountId || ''}
                                  onChange={(e) => handleUpdateBreakdownRow(row.id, 'bankAccountId', e.target.value)}
                                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
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
                          )}

                          {row.method === 'credit' && (
                            <div className="pl-7 space-y-1">
                              {!selectedCustomerId ? (
                                <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 p-1.5 rounded border border-rose-100">
                                  ⚠️ Seleccione un cliente en "Asociar Cliente" arriba para este cobro a crédito.
                                </p>
                              ) : isCreditLimitExceeded ? (
                                <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200">
                                  ⚠️ Excede el límite de crédito del cliente (Deuda + Crédito: RD$ {newDebtValue.toFixed(2)}, Límite: RD$ {creditLimitValue.toFixed(2)}).
                                </p>
                              ) : null}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add row button */}
                    <button
                      type="button"
                      onClick={handleAddBreakdownRow}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Agregar forma de pago</span>
                    </button>
                  </div>
                )}

                {/* Cash Specific Inputs */}
                {paymentMethod === 'cash' && (
                  <div className="space-y-4">
                    {/* Input field and change preview */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Monto Recibido</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                          <input
                            ref={cashInputRef}
                            type="text"
                            value={amountPaidStr}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Allow only numbers and optional single dot with up to 2 decimal places
                              if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                setAmountPaidStr(val);
                              }
                            }}
                            placeholder="0.00"
                            className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-250 bg-white text-slate-800 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Use su teclado para ingresar un monto diferente si lo desea.</p>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Cambio a Entregar</label>
                        <div className={`py-3 px-4 rounded-xl text-xl font-bold border flex items-center justify-between h-[50px] ${
                          amountPaid === 0
                            ? 'bg-slate-50 border-slate-200 text-slate-400'
                            : isValidAmount
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-red-50 border-red-200 text-red-600'
                        }`}>
                          <span>$</span>
                          <span>{change.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                 {/* Other Payment Info */}
                 {paymentMethod !== 'cash' && (
                   <div className="p-6 border border-dashed border-slate-250 rounded-2xl flex flex-col items-center justify-center text-center bg-slate-50">
                     <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                       {paymentMethod === 'card' && <CreditCard className="w-6 h-6" />}
                       {paymentMethod === 'transfer' && <Wallet className="w-6 h-6" />}
                       {paymentMethod === 'qr' && <QrCode className="w-6 h-6" />}
                       {paymentMethod === 'credit' && <Users className="w-6 h-6 text-rose-600" />}
                     </div>
                     <p className="font-semibold text-slate-800">
                       {paymentMethod === 'card' && 'Cobro mediante Terminal Bancaria'}
                       {paymentMethod === 'transfer' && 'Esperando Confirmación de Transferencia'}
                       {paymentMethod === 'qr' && 'Presentar Código QR en Pantalla'}
                       {paymentMethod === 'credit' && `Venta a Crédito: ${customers.find(c => c.id === selectedCustomerId)?.name || 'Cliente'}`}
                     </p>
                     <p className="text-xs text-slate-500 mt-1 max-w-sm">
                       {paymentMethod === 'card' && 'Deslice o acerque la tarjeta al datáfono. Una vez aprobado, haga clic en "Registrar Cobro" abajo.'}
                       {paymentMethod === 'transfer' && 'Verifique en su aplicación bancaria que el depósito por el total se haya recibido.'}
                       {paymentMethod === 'qr' && 'El cliente puede escanear el QR desde su banca móvil. CoDi se procesa de forma instantánea.'}
                       {paymentMethod === 'credit' && 'La deuda se registrará en la cuenta de este cliente y se sumará a su saldo de deudas pendientes.'}
                     </p>

                     {paymentMethod === 'transfer' && (() => {
                       const activeBankAccounts = (dashboardConfig?.bankAccounts ?? []).filter(ba => ba.active);
                       return (
                         <div className="w-full max-w-sm text-left border-t border-slate-200 pt-4 mt-3 space-y-2">
                           <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                             Cuenta Bancaria Destino (Obligatorio)
                           </label>
                           {activeBankAccounts.length === 0 ? (
                             <div className="text-xs text-amber-800 font-semibold bg-amber-50 border border-amber-250 p-3 rounded-xl">
                               ⚠️ No hay cuentas bancarias activas registradas. Agregue y active una cuenta en Configuración &gt; Dashboard.
                             </div>
                           ) : (
                             <select
                               value={selectedBankAccountId}
                               onChange={(e) => setSelectedBankAccountId(e.target.value)}
                               className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

                     {paymentMethod === 'credit' && selectedCustomerId && isCreditLimitExceeded && (
                       <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl text-left space-y-1 w-full max-w-sm">
                         <p className="font-bold text-amber-900">⚠️ Límite de Crédito Excedido</p>
                         <p>Este cliente excede su límite de crédito. Deuda actual: RD${currentDebt.toFixed(2)}, Límite: RD${creditLimitValue.toFixed(2)}, Nueva deuda total: RD${newDebtValue.toFixed(2)}</p>
                       </div>
                     )}
                   </div>
                 )}
              </div>
            </div>

          {/* Action buttons at the bottom of the left pane */}
          <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
            <button
              onClick={() => handleConfirmPayment(true)}
              disabled={isConfirmDisabled}
              className={`py-4 px-4 rounded-2xl font-bold text-base flex flex-col items-center justify-center gap-1 transition-all shadow-lg ${
                isConfirmDisabled
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/15 hover:shadow-emerald-600/35 active:scale-[0.98] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5" />
                <span>Cobrar e Imprimir</span>
              </div>
              <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">Presione F1</span>
            </button>

            <button
              onClick={() => handleConfirmPayment(false)}
              disabled={isConfirmDisabled}
              className={`py-4 px-4 rounded-2xl font-bold text-base flex flex-col items-center justify-center gap-1 transition-all shadow-lg ${
                isConfirmDisabled
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-slate-800 hover:bg-slate-900 text-white shadow-slate-800/15 hover:shadow-slate-800/35 active:scale-[0.98] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>Cobrar sin Imprimir</span>
              </div>
              <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">Presione F2</span>
            </button>
          </div>
        </div>

        {/* Right pane: Ticket preview (Thermal style) */}
        <div className="w-full md:w-[360px] bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-3 uppercase tracking-wider">Vista Previa del Ticket</span>
            
            {/* The thermal ticket card */}
            <div id="thermal-ticket" className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm font-mono text-xs text-slate-800 leading-relaxed relative overflow-hidden">
              {/* Zigzag cut graphic top */}
              <div className="absolute top-0 inset-x-0 h-1 flex justify-between">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="w-2.5 h-1.5 bg-slate-50 rotate-45 -translate-y-1.5" />
                ))}
              </div>

              {/* Ticket content */}
              <div className="pt-2 text-center border-b border-dashed border-slate-200 pb-4 space-y-1">
                {storeIdentity.showLogoOnInvoice && storeIdentity.logoUrl && (
                  <div className="flex justify-center mb-1.5">
                    <div className="w-10 h-10 rounded-xl border border-slate-200 text-slate-700 flex items-center justify-center text-xl font-bold overflow-hidden bg-white shadow-xs">
                      {storeIdentity.logoUrl.startsWith('data:image') || storeIdentity.logoUrl.startsWith('http') ? (
                        <img src={storeIdentity.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        storeIdentity.logoUrl
                      )}
                    </div>
                  </div>
                )}
                {storeIdentity.showNameOnInvoice && (
                  <h4 className="font-extrabold text-sm text-slate-900 tracking-tight uppercase">{storeIdentity.name || 'MI NEGOCIO'}</h4>
                )}
                {storeIdentity.showSloganOnInvoice && storeIdentity.slogan && (
                  <p className="text-[11px] text-slate-500 font-medium italic">{storeIdentity.slogan}</p>
                )}
                {storeIdentity.showAddressOnInvoice && storeIdentity.address && (
                  <p className="text-[11px] text-slate-500">{storeIdentity.address}</p>
                )}
                {storeIdentity.showPhoneOnInvoice && storeIdentity.phone && (
                  <p className="text-[11px] text-slate-500">Tel: {storeIdentity.phone}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-2">SUCURSAL CENTRO • CAJA #1</p>
              </div>

              <div className="py-3 border-b border-dashed border-slate-200 space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Ticket:</span>
                  <span className="font-bold text-slate-900">TKT-XXXXXX</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha:</span>
                  <span>{new Date().toLocaleString('es-ES', { hour12: false })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Atendió:</span>
                  <span>{clerkName}</span>
                </div>
                {selectedCustomerId && (
                  <div className="flex justify-between">
                    <span>Cliente:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[120px]">
                      {customers.find(c => c.id === selectedCustomerId)?.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="py-4 border-b border-dashed border-slate-200 space-y-3">
                <div className="flex justify-between font-bold text-slate-900 pb-1">
                  <span>Descripción</span>
                  <span className="text-right">Importe</span>
                </div>
                <div className="space-y-3 max-h-44 overflow-y-auto pr-1">
                  {cartItems.map((item) => (
                    <div key={item.product.id} className="flex justify-between items-start text-slate-650 gap-4 text-[11px]">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800">{item.product.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {item.quantity} pza{item.quantity !== 1 ? 's' : ''} x ${item.product.price.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right font-semibold text-slate-800 shrink-0">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Section */}
              <div className="py-3 border-b border-dashed border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>ITBIS (18%):</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1">
                  <span>TOTAL:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="py-3 text-slate-600 space-y-1 font-mono">
                {paymentMethod === 'mixed' ? (
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold text-slate-800 border-b border-dashed border-slate-200 pb-1">
                      <span>Forma de pago:</span>
                      <span>Mixto</span>
                    </div>
                    {mixedBreakdown.map((item) => {
                      const label =
                        item.method === 'cash' ? 'Efectivo' :
                        item.method === 'card' ? 'Tarjeta' :
                        item.method === 'transfer' ? 'Transf.' :
                        item.method === 'credit' ? 'Crédito' : 'Nota de Crédito';
                      return (
                        <div key={item.id} className="flex justify-between text-[10px] pl-2 text-slate-700">
                          <span>• {label}:</span>
                          <span>RD$ {(Number(item.amount) || 0).toFixed(2)}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between pt-1 font-semibold text-slate-800">
                      <span>Pagó con:</span>
                      <span>RD$ {mixedTotalEntered.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-950 font-bold">
                      <span>Cambio:</span>
                      <span>RD$ {mixedChangeAmount.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>Forma de pago:</span>
                      <span className="capitalize font-bold text-slate-800">
                        {paymentMethod === 'cash' ? 'Efectivo' : paymentMethod === 'card' ? 'Tarjeta' : paymentMethod === 'transfer' ? 'Transferencia' : paymentMethod === 'qr' ? 'Código QR' : 'A Crédito'}
                      </span>
                    </div>
                    {paymentMethod !== 'credit' ? (
                      <>
                        <div className="flex justify-between">
                          <span>Pagó con:</span>
                          <span>${(paymentMethod === 'cash' ? amountPaid : total).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-950 font-bold">
                          <span>Cambio:</span>
                          <span>${(paymentMethod === 'cash' ? change : 0).toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center font-bold text-rose-700 bg-rose-50 border border-rose-100 py-1.5 px-2 rounded-lg text-[10px] mt-1">
                        PENDIENTE POR COBRAR (DEUDA)
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer barcode/thank you */}
              <div className="pt-4 text-center border-t border-dashed border-slate-200 space-y-2">
                <p className="text-[10px] text-slate-500 font-sans">¡GRACIAS POR SU PREFERENCIA!</p>
                
                {/* Simulated Barcode */}
                <div className="flex flex-col items-center justify-center pt-1">
                  <div className="flex items-end justify-center gap-[1px] h-6 w-32 bg-white">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-black"
                        style={{
                          width: i % 4 === 0 ? '3px' : i % 3 === 0 ? '1px' : '2px',
                          height: i % 5 === 0 ? '80%' : '100%',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[8px] text-slate-400 mt-1 tracking-widest">
                    TKT-0000000
                  </span>
                </div>
              </div>

              {/* Zigzag cut graphic bottom */}
              <div className="absolute bottom-0 inset-x-0 h-1 flex justify-between rotate-180">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="w-2.5 h-1.5 bg-slate-50 rotate-45 -translate-y-1.5" />
                ))}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 text-center mt-4">
            * Para pruebas de impresión física, use el botón de "Imprimir" en el flujo principal.
          </div>
        </div>

      </div>
    </div>
  );
};
