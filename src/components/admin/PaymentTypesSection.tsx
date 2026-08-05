import React, { useState } from 'react';
import { DashboardConfig } from '../../types';
import { Percent, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

interface PaymentTypesSectionProps {
  dashboardConfig: DashboardConfig;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
}

export const PaymentTypesSection: React.FC<PaymentTypesSectionProps> = ({
  dashboardConfig,
  onUpdateDashboardConfig,
}) => {
  const [newPaymentTypeLabel, setNewPaymentTypeLabel] = useState('');

  const paymentTypes = dashboardConfig?.paymentTypes ?? [
    { id: 'cash', label: 'Efectivo', active: true },
    { id: 'card', label: 'Tarjeta', active: true },
    { id: 'transfer', label: 'Transferencia', active: true },
    { id: 'credit', label: 'Crédito', active: true },
  ];

  const handleTogglePaymentType = (id: string) => {
    const updated = paymentTypes.map((pt) => {
      if (pt.id === id) {
        return { ...pt, active: !pt.active };
      }
      return pt;
    });
    onUpdateDashboardConfig({
      ...dashboardConfig,
      paymentTypes: updated,
    });
  };

  const handleAddPaymentType = () => {
    if (!newPaymentTypeLabel.trim()) return;
    const newPt = {
      id: `custom_${Date.now()}`,
      label: newPaymentTypeLabel.trim(),
      active: true,
    };
    onUpdateDashboardConfig({
      ...dashboardConfig,
      paymentTypes: [...paymentTypes, newPt],
    });
    setNewPaymentTypeLabel('');
  };

  const handleDeletePaymentType = (id: string) => {
    if (['cash', 'card', 'transfer', 'credit'].includes(id)) return;
    const updated = paymentTypes.filter((pt) => pt.id !== id);
    onUpdateDashboardConfig({
      ...dashboardConfig,
      paymentTypes: updated,
    });
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Percent className="w-4 h-4 text-indigo-600" />
        <h4 className="font-bold text-slate-800 text-sm">Tipos de Cobro</h4>
      </div>

      {/* Formulario para agregar tipo de cobro */}
      <div className="flex gap-2">
        <input autoComplete="off"
          type="text"
          placeholder="Ej. Transferencia USD, Cheque"
          value={newPaymentTypeLabel}
          onChange={(e) => setNewPaymentTypeLabel(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAddPaymentType}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>

      {/* Lista de tipos de cobro */}
      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
        {paymentTypes.map((pt) => {
          const isOriginal = ['cash', 'card', 'transfer', 'credit'].includes(pt.id);
          return (
            <div key={pt.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-1.5">
              <span className={`text-xs font-semibold ${pt.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                {pt.label} {isOriginal && <span className="text-[9px] text-indigo-500 font-bold uppercase ml-1">(Básico)</span>}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTogglePaymentType(pt.id)}
                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  title={pt.active ? 'Desactivar' : 'Activar'}
                >
                  {pt.active ? (
                    <ToggleRight className="w-6 h-6 text-indigo-600 cursor-pointer" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-300 cursor-pointer" />
                  )}
                </button>
                {!isOriginal && (
                  <button
                    type="button"
                    onClick={() => handleDeletePaymentType(pt.id)}
                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
