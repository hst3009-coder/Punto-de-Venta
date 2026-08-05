import React, { useState, useEffect, useRef } from 'react';
import { CartItem } from '../types';
import { getPreTaxAmount } from '../lib/money';
import { X, Sliders, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';

interface PriceOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CartItem | null;
  onConfirm: (productId: string, newUnitPrice: number) => void;
  onReset?: (productId: string) => void;
}

export const PriceOverrideModal: React.FC<PriceOverrideModalProps> = ({
  isOpen,
  onClose,
  item,
  onConfirm,
  onReset,
}) => {
  const [priceStr, setPriceStr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && item) {
      const initialVal = item.priceOverride ?? item.product.price;
      setPriceStr(initialVal ? initialVal.toString() : '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const { product } = item;
  const cost = product.cost || 0;
  const hasCost = cost > 0;
  const proposedPrice = parseFloat(priceStr);
  const isValidPrice = !isNaN(proposedPrice) && proposedPrice > 0;

  const preTaxPrice = isValidPrice ? getPreTaxAmount(proposedPrice, product.taxExempt) : 0;
  const marginPct = hasCost && isValidPrice ? ((preTaxPrice - cost) / cost) * 100 : 0;

  let errorMessage: string | null = null;
  let isValid = false;

  if (!hasCost) {
    errorMessage = 'Este producto no tiene costo registrado, no se puede validar el margen mínimo';
  } else if (!isValidPrice) {
    errorMessage = 'Por favor ingresa un precio unitario mayor a 0';
  } else if (marginPct < 15) {
    errorMessage = `No se puede bajar de 15% de ganancia mínima (margen actual: ${marginPct.toFixed(1)}%)`;
  } else {
    isValid = true;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !item) return;
    onConfirm(item.product.id, proposedPrice);
    onClose();
  };

  const handleReset = () => {
    if (!item) return;
    if (onReset) {
      onReset(item.product.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full max-h-[95dvh] overflow-y-auto transition-all">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-400/30">
              <Sliders className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-snug">Ajuste Manual de Precio</h3>
              <p className="text-[11px] text-slate-300">Margen mínimo requerido: 15% sobre costo</p>
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
          {/* Product Summary */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <p className="font-extrabold text-slate-800 uppercase text-sm">{product.name}</p>
            <div className="flex justify-between items-center text-slate-600 font-medium pt-1">
              <span>Precio catálogo: <strong className="text-slate-900">RD$ {product.price.toFixed(2)}</strong></span>
              <span>Costo: <strong className="text-slate-900">{hasCost ? `RD$ ${cost.toFixed(2)}` : 'Sin registro'}</strong></span>
            </div>
            <p className="text-[10px] text-slate-400">
              {product.taxExempt ? 'Exento de ITBIS' : 'Precio incluye 18% ITBIS'}
            </p>
          </div>

          {/* Price Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Nuevo Precio Unitario (RD$) *
            </label>
            <input autoComplete="off"
              ref={inputRef}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-500/20 rounded-xl font-mono text-lg font-black text-slate-900 focus:outline-none transition-all"
            />
          </div>

          {/* Real-time Validation Box */}
          {errorMessage ? (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Margen válido: +{marginPct.toFixed(1)}%</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Precio antes de ITBIS: RD$ {preTaxPrice.toFixed(2)} | Ganancia por unidad: RD$ {(preTaxPrice - cost).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-between gap-3">
            {item.priceOverride !== undefined ? (
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Restablecer
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
                    ? 'bg-purple-600 hover:bg-purple-700 active:scale-95 cursor-pointer'
                    : 'bg-slate-300 cursor-not-allowed opacity-60'
                }`}
              >
                Guardar Ajuste
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
