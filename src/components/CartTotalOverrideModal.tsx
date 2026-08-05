import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CartItem } from '../types';
import { calculateWaterFillingCartTotalOverride } from '../lib/cartTotalOverride';
import { X, Calculator, AlertCircle, CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';

interface CartTotalOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  currentTotal: number;
  onConfirm: (overrides: { itemKey: string; newUnitPrice: number }[]) => void;
  onResetAll?: () => void;
}

export const CartTotalOverrideModal: React.FC<CartTotalOverrideModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  currentTotal,
  onConfirm,
  onResetAll,
}) => {
  const [totalStr, setTotalStr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTotalStr(currentTotal ? currentTotal.toFixed(2) : '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentTotal]);

  const totalUnits = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  const currentSubtotalSum = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cartItems]);

  const hasAnyOverride = useMemo(() => {
    return cartItems.some((item) => item.priceOverride !== undefined);
  }, [cartItems]);

  const proposedTotal = parseFloat(totalStr);

  const calculationResult = useMemo(() => {
    return calculateWaterFillingCartTotalOverride(cartItems, proposedTotal);
  }, [cartItems, proposedTotal]);

  if (!isOpen || cartItems.length === 0) return null;

  const {
    itemCalculations,
    failingItems,
    hasFailingItems,
    suggestedMinTotal,
    isValidTotalInput,
    totalDiff,
    deltaPerUnit,
    errorMessage,
    isValid,
  } = calculationResult;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const overrides = itemCalculations.map((calc) => ({
      itemKey: calc.itemKey,
      newUnitPrice: calc.proposedUnitPrice,
    }));

    onConfirm(overrides);
    onClose();
  };

  const handleReset = () => {
    if (onResetAll) {
      onResetAll();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[95dvh] overflow-y-auto transition-all">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
              <Calculator className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-snug">Ajuste de Total Neto Venta</h3>
              <p className="text-[11px] text-slate-300">
                Ajuste proporcional en {cartItems.length} producto(s) ({totalUnits} u. en total)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Summary Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-500">Total Actual Carrito:</span>
              <p className="text-sm font-black text-slate-900">RD$ {currentSubtotalSum.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Total Unidades:</span>
              <p className="text-sm font-black text-slate-800">{totalUnits} unidades</p>
            </div>
          </div>

          {/* New Total Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Nuevo Total Deseado para la Venta (RD$) *
            </label>
            <input autoComplete="off"
              ref={inputRef}
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={totalStr}
              onChange={(e) => setTotalStr(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 rounded-xl font-mono text-xl font-black text-slate-900 focus:outline-none transition-all"
            />
          </div>

          {/* Diff Indicator */}
          {isValidTotalInput && (
            <div className="flex justify-between items-center text-xs px-1 text-slate-600 font-medium">
              <span>
                Ajuste Global: <strong className={totalDiff < 0 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                  {totalDiff >= 0 ? '+' : ''}RD$ {totalDiff.toFixed(2)}
                </strong>
              </span>
              <span>
                Proporción/Unidad: <strong className="text-slate-800">
                  {deltaPerUnit >= 0 ? '+' : ''}RD$ {deltaPerUnit.toFixed(2)} / u.
                </strong>
              </span>
            </div>
          )}

          {/* Real-time Validation Box */}
          {!isValidTotalInput ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          ) : hasFailingItems ? (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="font-bold">{errorMessage}</p>
              </div>

              <div className="max-h-28 overflow-y-auto space-y-1 pl-6 text-[11px] font-medium text-red-700">
                {failingItems.map((item) => (
                  <div key={item.itemKey} className="flex justify-between items-center bg-red-100/60 px-2 py-1 rounded">
                    <span className="font-semibold truncate max-w-[200px]">{item.productName} ({item.quantity}u)</span>
                    <span>
                      Propuesto: <strong className="line-through opacity-80">RD$ {item.proposedUnitPrice.toFixed(2)}</strong> → Mín 15%: <strong className="text-red-900">RD$ {item.minUnitPrice.toFixed(2)}</strong>
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-red-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-red-600">Sugerencia Mínima Alcanzable:</span>
                  <p className="text-xs font-black text-red-900">RD$ {suggestedMinTotal.toFixed(2)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTotalStr(suggestedMinTotal.toFixed(2))}
                  className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  Usar Total Mínimo <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Ajuste global válido para todos los productos</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Todos los {cartItems.length} productos mantienen al menos el 15% de margen sobre su costo.
                </p>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {hasAnyOverride && onResetAll ? (
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Restablecer Todo
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!isValid}
                className={`px-5 py-2.5 rounded-xl text-xs font-black text-white transition-all shadow-md ${
                  isValid
                    ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 cursor-pointer'
                    : 'bg-slate-300 cursor-not-allowed opacity-60'
                }`}
              >
                Aplicar Ajuste Total
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
