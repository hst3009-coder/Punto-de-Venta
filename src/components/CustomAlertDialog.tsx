import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface CustomAlertConfig {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'confirm';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface CustomAlertDialogProps {
  alert: CustomAlertConfig | null;
  onClose: () => void;
}

export const CustomAlertDialog: React.FC<CustomAlertDialogProps> = ({ alert, onClose }) => {
  const handleConfirm = () => {
    if (alert?.onConfirm) alert.onConfirm();
    onClose();
  };

  const handleCancel = () => {
    if (alert?.onCancel) alert.onCancel();
    onClose();
  };

  useEffect(() => {
    if (!alert) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (alert.type === 'confirm') {
          handleCancel();
        } else {
          handleConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [alert, onClose]);

  if (!alert) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
        >
          {/* Header Accent */}
          <div className={`h-1.5 w-full ${
            alert.type === 'success' ? 'bg-emerald-500' :
            alert.type === 'error' ? 'bg-rose-500' :
            alert.type === 'warning' ? 'bg-amber-500' :
            alert.type === 'confirm' ? 'bg-indigo-500' : 'bg-slate-500'
          }`} />

          <div className="p-6">
            <div className="flex gap-4">
              {/* Icon Container */}
              <div className={`p-2.5 rounded-xl shrink-0 ${
                alert.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                alert.type === 'error' ? 'bg-rose-50 text-rose-600' :
                alert.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                alert.type === 'confirm' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'
              }`}>
                {alert.type === 'success' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : alert.type === 'confirm' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>

              {/* Text */}
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight">
                  {alert.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {alert.message}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-2.5">
              {alert.type === 'confirm' ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {alert.cancelLabel || 'Cancelar'}
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md shadow-indigo-100"
                  >
                    {alert.confirmLabel || 'Confirmar'}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer shadow-md ${
                    alert.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-50' :
                    alert.type === 'error' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-50' :
                    alert.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-50' :
                    'bg-slate-800 hover:bg-slate-900 shadow-slate-50'
                  }`}
                >
                  {alert.confirmLabel || 'Aceptar'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
