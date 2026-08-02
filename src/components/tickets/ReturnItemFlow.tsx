import React from 'react';
import { Sale, CartItem, CreditNote, isMixedSale } from '../../types';
import { Undo2, Receipt, Printer } from 'lucide-react';

export interface ReturnItemFlowProps {
  returningItem: CartItem | null;
  selectedSale: Sale | null;
  returningItemQty: number;
  setReturningItemQty: (qty: number) => void;
  returningItemReason: string;
  setReturningItemReason: (reason: string) => void;
  returningItemError: string;
  setReturningItemError: (err: string) => void;
  refundMethodChoice: 'cash' | 'credit_note';
  setRefundMethodChoice: (method: 'cash' | 'credit_note') => void;
  createdCreditNote: CreditNote | null;
  setCreatedCreditNote: (cn: CreditNote | null) => void;
  onCloseReturnItem: () => void;
  onConfirmItemReturn: () => void;
}

export const ReturnItemFlow: React.FC<ReturnItemFlowProps> = ({
  returningItem,
  selectedSale,
  returningItemQty,
  setReturningItemQty,
  returningItemReason,
  setReturningItemReason,
  returningItemError,
  setReturningItemError,
  refundMethodChoice,
  setRefundMethodChoice,
  createdCreditNote,
  setCreatedCreditNote,
  onCloseReturnItem,
  onConfirmItemReturn,
}) => {
  const isCreditSale = Boolean(
    selectedSale &&
    (selectedSale.paymentMethod === 'credit' ||
     selectedSale.isCredit ||
     (isMixedSale(selectedSale) && selectedSale.paymentBreakdown.some(b => b.method === 'credit'))) &&
    selectedSale.customerId
  );

  return (
    <>
      {/* Individual Item Return Modal */}
      {returningItem && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseReturnItem();
          }}
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
                  max={
                    returningItem.quantity -
                    ((selectedSale as any)?.returnedItems
                      ?.filter((r: any) => r.productId === returningItem.product.id)
                      .reduce((sum: number, r: any) => sum + r.quantity, 0) || 0)
                  }
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
            {isCreditSale ? (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 space-y-1">
                <span className="font-extrabold flex items-center gap-1.5 text-xs text-amber-900">
                  👥 Reducción Automática de Crédito
                </span>
                <p className="text-[11px] text-amber-800 leading-snug">
                  Esta venta fue realizada a crédito ({selectedSale?.customerName || 'Cliente'}). La devolución reducirá automáticamente <strong>RD$ {(returningItem.product.price * returningItemQty).toFixed(2)}</strong> del saldo adeudado por el cliente.
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
                onClick={onCloseReturnItem}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-black transition-colors bg-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirmItemReturn}
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
                <span className="font-mono text-indigo-700 font-black">
                  RD$ {createdCreditNote.originalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
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
    </>
  );
};
