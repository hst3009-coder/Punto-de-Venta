import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Customer, PaymentMethod, PaymentBreakdownItem, DashboardConfig, Product } from '../../types';
import { X, Users, CreditCard, Coins, Wallet, Layers, Plus, Trash2, AlertCircle, Tag, Check } from 'lucide-react';
import { getListPrice } from '../../lib/priceLists';
import { calculateSaleTotals } from '../../lib/saleProcessor';
import { roundCents } from '../../lib/money';

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSale: Sale | null;
  customers: Customer[];
  products: Product[];
  dashboardConfig?: DashboardConfig;
  onSavePayment: (updatedSale: Sale) => Promise<void>;
}

export const EditPaymentModal: React.FC<EditPaymentModalProps> = ({
  isOpen,
  onClose,
  selectedSale,
  customers = [],
  products = [],
  dashboardConfig,
  onSavePayment,
}) => {
  if (!isOpen || !selectedSale) return null;

  // Form states initialized with selectedSale values
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(selectedSale.customerId || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(selectedSale.paymentMethod || 'cash');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>(selectedSale.bankAccountId || '');

  // Mixed payment breakdown
  const [mixedBreakdown, setMixedBreakdown] = useState<PaymentBreakdownItem[]>(() => {
    if (selectedSale.paymentBreakdown && selectedSale.paymentBreakdown.length > 0) {
      return selectedSale.paymentBreakdown.map(b => ({ ...b }));
    }
    return [{ id: crypto.randomUUID(), method: 'cash', amount: selectedSale.total }];
  });

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active bank accounts
  const activeBankAccounts = useMemo(() => {
    return (dashboardConfig?.bankAccounts ?? []).filter(ba => ba.active);
  }, [dashboardConfig?.bankAccounts]);

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Active price list for selected customer
  const activePriceList = useMemo(() => {
    if (!selectedCustomer?.priceListId) return null;
    return (dashboardConfig?.clientPriceLists || []).find(pl => pl.id === selectedCustomer.priceListId) || null;
  }, [selectedCustomer, dashboardConfig?.clientPriceLists]);

  // Recalculated items and totals if customer has an active price list
  const { recalculatedItems, recalculatedSubtotal, recalculatedTax, recalculatedTotal, isPriceListApplied } = useMemo(() => {
    if (!activePriceList) {
      return {
        recalculatedItems: selectedSale.items,
        recalculatedSubtotal: selectedSale.subtotal ?? 0,
        recalculatedTax: selectedSale.tax ?? 0,
        recalculatedTotal: selectedSale.total,
        isPriceListApplied: false,
      };
    }

    const items = selectedSale.items.map((item) => {
      const currentProd = products.find(p => p.id === item.product.id) || item.product;
      let baseListPrice = getListPrice(currentProd, activePriceList);
      if (item.selectedPackaging && item.selectedPackaging.unitsPerPackage > 1) {
        baseListPrice = baseListPrice * item.selectedPackaging.unitsPerPackage;
      }
      return {
        ...item,
        product: {
          ...item.product,
          price: baseListPrice,
        },
      };
    });

    const totals = calculateSaleTotals(items);
    return {
      recalculatedItems: items,
      recalculatedSubtotal: totals.subtotal,
      recalculatedTax: totals.tax,
      recalculatedTotal: totals.total,
      isPriceListApplied: true,
    };
  }, [selectedSale, activePriceList, products]);

  // Handle customer change
  const handleCustomerChange = (cid: string) => {
    setSelectedCustomerId(cid);
    setErrorMsg('');
  };

  // Keep mixed breakdown updated if total changes or method changes to mixed
  useEffect(() => {
    if (paymentMethod === 'mixed' && mixedBreakdown.length === 1) {
      setMixedBreakdown([{ id: crypto.randomUUID(), method: 'cash', amount: recalculatedTotal }]);
    }
  }, [paymentMethod, recalculatedTotal]);

  // Mixed breakdown calculations
  const mixedSum = useMemo(() => {
    return roundCents(mixedBreakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  }, [mixedBreakdown]);

  const mixedDifference = roundCents(recalculatedTotal - mixedSum);

  const handleAddBreakdownRow = () => {
    const remaining = Math.max(0, mixedDifference);
    setMixedBreakdown(prev => [
      ...prev,
      { id: crypto.randomUUID(), method: 'cash', amount: remaining }
    ]);
  };

  const handleRemoveBreakdownRow = (id: string) => {
    if (mixedBreakdown.length <= 1) return;
    setMixedBreakdown(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateBreakdownRow = (id: string, field: keyof PaymentBreakdownItem, val: any) => {
    setMixedBreakdown(prev => prev.map(r => {
      if (r.id !== id) return r;
      return { ...r, [field]: val };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validations
    if (paymentMethod === 'credit') {
      if (!selectedCustomerId) {
        setErrorMsg('⚠️ Las ventas a crédito requieren seleccionar un cliente.');
        return;
      }
    }

    if (paymentMethod === 'transfer') {
      if (activeBankAccounts.length > 0 && !selectedBankAccountId) {
        setErrorMsg('⚠️ Seleccione la cuenta bancaria de destino para la transferencia.');
        return;
      }
    }

    if (paymentMethod === 'mixed') {
      if (Math.abs(mixedDifference) > 0.01) {
        setErrorMsg(`⚠️ La suma del desglose mixto (RD$ ${mixedSum.toFixed(2)}) debe coincidir exactamente con el total de la venta (RD$ ${recalculatedTotal.toFixed(2)}).`);
        return;
      }

      const hasCreditRow = mixedBreakdown.some(b => b.method === 'credit');
      if (hasCreditRow && !selectedCustomerId) {
        setErrorMsg('⚠️ El cobro a crédito dentro del pago mixto requiere seleccionar un cliente.');
        return;
      }

      const hasTransferRow = mixedBreakdown.some(b => b.method === 'transfer');
      if (hasTransferRow && activeBankAccounts.length > 0) {
        const invalidTransferRow = mixedBreakdown.some(b => b.method === 'transfer' && !b.bankAccountId && !selectedBankAccountId);
        if (invalidTransferRow) {
          setErrorMsg('⚠️ Seleccione la cuenta bancaria de destino para los cobros por transferencia.');
          return;
        }
      }
    }

    const isCredit = paymentMethod === 'credit' || (paymentMethod === 'mixed' && mixedBreakdown.some(b => b.method === 'credit'));

    // Clean customer name
    const custName = selectedCustomerId ? (customers.find(c => c.id === selectedCustomerId)?.name || '') : undefined;

    const updatedSale: Sale = {
      ...selectedSale,
      customerId: selectedCustomerId || undefined,
      customerName: custName,
      paymentMethod,
      paymentBreakdown: paymentMethod === 'mixed' ? mixedBreakdown.map(b => ({
        ...b,
        bankAccountId: b.method === 'transfer' ? (b.bankAccountId || selectedBankAccountId) : undefined
      })) : undefined,
      bankAccountId: paymentMethod === 'transfer' ? selectedBankAccountId : undefined,
      isCredit,
      creditStatus: isCredit ? (selectedSale.creditStatus || 'pending') : undefined,
      items: recalculatedItems,
      total: recalculatedTotal,
      subtotal: recalculatedSubtotal,
      tax: recalculatedTax,
      amountPaid: recalculatedTotal,
      change: 0,
    };

    try {
      setIsSubmitting(true);
      await onSavePayment(updatedSale);
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error('Error saving updated payment:', err);
      setErrorMsg('Error al guardar los cambios en la base de datos.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-5 border border-slate-200 overflow-y-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Editar Pago de Venta</h3>
              <p className="text-xs text-slate-500 font-semibold">
                Factura #{selectedSale.ticketNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Customer Selector */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" />
                <span>Cliente Asociado</span>
              </label>
              {selectedCustomerId && (
                <button
                  type="button"
                  onClick={() => handleCustomerChange('')}
                  className="text-xs text-rose-500 font-extrabold hover:underline cursor-pointer"
                >
                  Remover Cliente
                </button>
              )}
            </div>

            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">-- Sin Cliente (Público General) --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''} {c.priceListId ? '🏷️' : ''}
                </option>
              ))}
            </select>

            {/* Price list badge notice */}
            {isPriceListApplied && activePriceList && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 space-y-1 animate-fade-in">
                <div className="font-bold flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Lista de Precios Activa: {activePriceList.name} (+{activePriceList.profitPercent}%)</span>
                </div>
                <p className="text-[11px] text-indigo-700/90 font-medium">
                  Los precios de los artículos se re-calcularán con esta lista.{' '}
                  Total original: <span className="line-through">RD$ {selectedSale.total.toFixed(2)}</span> ➔ Nuevo total: <strong>RD$ {recalculatedTotal.toFixed(2)}</strong>
                </p>
              </div>
            )}
          </div>

          {/* 2. Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Método de Pago
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 'cash', label: 'Efectivo', icon: Coins },
                { id: 'card', label: 'Tarjeta', icon: CreditCard },
                { id: 'transfer', label: 'Transf.', icon: Wallet },
                { id: 'credit', label: 'Crédito', icon: Users },
                { id: 'mixed', label: 'Mixto', icon: Layers },
              ].map(pm => {
                const Icon = pm.icon;
                const isSelected = paymentMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(pm.id as PaymentMethod);
                      setErrorMsg('');
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px]">{pm.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Method Specific Options */}
          {paymentMethod === 'transfer' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 animate-fade-in">
              <label className="text-xs font-extrabold text-slate-700 block">
                Cuenta Bancaria Destino (Obligatorio)
              </label>
              {activeBankAccounts.length === 0 ? (
                <p className="text-xs text-amber-800 font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  ⚠️ No hay cuentas bancarias activas registradas.
                </p>
              ) : (
                <select
                  value={selectedBankAccountId}
                  onChange={(e) => setSelectedBankAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">-- Seleccionar Cuenta Bancaria --</option>
                  {activeBankAccounts.map(ba => (
                    <option key={ba.id} value={ba.id}>
                      {ba.bankName} - {ba.accountNumber} ({ba.accountType})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {paymentMethod === 'credit' && !selectedCustomerId && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Para registrar esta venta a crédito, debe seleccionar un cliente arriba.</span>
            </div>
          )}

          {paymentMethod === 'mixed' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-slate-700">Desglose de Pago Mixto</span>
                <span className="text-xs font-bold text-slate-500">
                  Total: RD$ {recalculatedTotal.toFixed(2)}
                </span>
              </div>

              <div className="space-y-2">
                {mixedBreakdown.map((row) => (
                  <div key={row.id} className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={row.method}
                        onChange={(e) => handleUpdateBreakdownRow(row.id, 'method', e.target.value)}
                        className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="cash">💵 Efectivo</option>
                        <option value="card">💳 Tarjeta</option>
                        <option value="transfer">🏦 Transferencia</option>
                        <option value="credit">👥 Crédito</option>
                      </select>

                      <div className="flex-1 flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                        <span className="text-xs font-bold text-slate-400">RD$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount || ''}
                          onChange={(e) => handleUpdateBreakdownRow(row.id, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent text-xs font-black text-slate-800 focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>

                      {mixedBreakdown.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBreakdownRow(row.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {row.method === 'transfer' && activeBankAccounts.length > 0 && (
                      <select
                        value={row.bankAccountId || selectedBankAccountId}
                        onChange={(e) => handleUpdateBreakdownRow(row.id, 'bankAccountId', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Cuenta Bancaria Destino --</option>
                        {activeBankAccounts.map(ba => (
                          <option key={ba.id} value={ba.id}>
                            {ba.bankName} - {ba.accountNumber}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddBreakdownRow}
                className="w-full py-2 bg-white hover:bg-slate-100 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Agregar forma de pago</span>
              </button>

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold">
                <span className={Math.abs(mixedDifference) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}>
                  {Math.abs(mixedDifference) < 0.01
                    ? '✓ Suma completa'
                    : mixedDifference > 0
                    ? `Falta: RD$ ${mixedDifference.toFixed(2)}`
                    : `Excede por: RD$ ${Math.abs(mixedDifference).toFixed(2)}`}
                </span>
                <span className="text-slate-600">Ingresado: RD$ {mixedSum.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Validation Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
