import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface CancelSaleFlowProps {
  isCancelling: boolean;
  cancelJustification: string;
  setCancelJustification: (value: string) => void;
  cancelError: string;
  setCancelError: (value: string) => void;
  onClose: () => void;
  onConfirmCancellation: () => void;
}

export const CancelSaleFlow: React.FC<CancelSaleFlowProps> = ({
  isCancelling,
  cancelJustification,
  setCancelJustification,
  cancelError,
  setCancelError,
  onClose,
  onConfirmCancellation,
}) => {
  if (!isCancelling) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4 animate-scale-up">
        <div className="flex items-center gap-2 text-rose-600">
          <AlertTriangle className="w-5 h-5 shrink-0 animate-bounce" />
          <h3 className="text-base font-black">Justificación de Cancelación</h3>
        </div>

        <p className="text-xs text-slate-500 font-semibold leading-relaxed">
          Está a punto de anular la factura completa. Esta acción devolverá todos los artículos de este ticket al inventario activo de inmediato. Por seguridad, ingrese una justificación para el supervisor:
        </p>

        <div className="space-y-1.5">
          <textarea
            value={cancelJustification}
            onChange={(e) => {
              setCancelJustification(e.target.value);
              setCancelError('');
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800 placeholder-slate-400"
            placeholder="Escriba aquí la justificación (ej. El cliente se arrepintió, error en facturación, etc.)..."
            rows={3}
            autoFocus
          />
          {cancelError && <p className="text-[10px] font-bold text-rose-600">{cancelError}</p>}
        </div>

        <div className="flex gap-2.5 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-black transition-colors bg-white cursor-pointer"
          >
            Cancelar Acción
          </button>
          <button
            onClick={onConfirmCancellation}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-100 transition-colors cursor-pointer"
          >
            Confirmar Devolución
          </button>
        </div>
      </div>
    </div>
  );
};
