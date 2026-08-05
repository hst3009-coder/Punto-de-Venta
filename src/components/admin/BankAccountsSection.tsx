import React, { useState } from 'react';
import { DashboardConfig } from '../../types';
import { Database, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';

interface BankAccountsSectionProps {
  dashboardConfig: DashboardConfig;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
}

export const BankAccountsSection: React.FC<BankAccountsSectionProps> = ({
  dashboardConfig,
  onUpdateDashboardConfig,
}) => {
  const [newBankName, setNewBankName] = useState('');
  const [newAccountLabel, setNewAccountLabel] = useState('');

  const bankAccounts = dashboardConfig?.bankAccounts ?? [];

  const handleToggleBankAccount = (id: string) => {
    const updated = bankAccounts.map((ba) => {
      if (ba.id === id) {
        return { ...ba, active: !ba.active };
      }
      return ba;
    });
    onUpdateDashboardConfig({
      ...dashboardConfig,
      bankAccounts: updated,
    });
  };

  const handleAddBankAccount = () => {
    if (!newBankName.trim() || !newAccountLabel.trim()) return;
    const newBa = {
      id: `bank_${Date.now()}`,
      bankName: newBankName.trim(),
      accountLabel: newAccountLabel.trim(),
      active: true,
    };
    onUpdateDashboardConfig({
      ...dashboardConfig,
      bankAccounts: [...bankAccounts, newBa],
    });
    setNewBankName('');
    setNewAccountLabel('');
  };

  const handleDeleteBankAccount = (id: string) => {
    const updated = bankAccounts.filter((ba) => ba.id !== id);
    onUpdateDashboardConfig({
      ...dashboardConfig,
      bankAccounts: updated,
    });
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-indigo-600" />
        <h4 className="font-bold text-slate-800 text-sm">Cuentas Bancarias</h4>
      </div>

      {/* Formulario para agregar cuenta bancaria */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input autoComplete="off"
            type="text"
            placeholder="Banco (ej. Banreservas)"
            value={newBankName}
            onChange={(e) => setNewBankName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
          <input autoComplete="off"
            type="text"
            placeholder="Etiqueta (ej. Cuenta 1234)"
            value={newAccountLabel}
            onChange={(e) => setNewAccountLabel(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={handleAddBankAccount}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar Cuenta Bancaria
        </button>
      </div>

      {/* Lista de cuentas bancarias */}
      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
        {bankAccounts.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium italic text-center py-2">
            No hay cuentas bancarias registradas.
          </p>
        ) : (
          bankAccounts.map((ba) => (
            <div key={ba.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-1.5">
              <div className="flex flex-col">
                <span className={`text-xs font-bold ${ba.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                  {ba.bankName}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {ba.accountLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggleBankAccount(ba.id)}
                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  title={ba.active ? 'Desactivar' : 'Activar'}
                >
                  {ba.active ? (
                    <ToggleRight className="w-6 h-6 text-indigo-600 cursor-pointer" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-300 cursor-pointer" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBankAccount(ba.id)}
                  className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
