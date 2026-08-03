import React from 'react';
import { DashboardConfig, EmployeePermissions } from '../../types';
import { Percent, Trash2, Loader2 } from 'lucide-react';

interface CardCommissionsDepositsSectionProps {
  dashboardConfig: DashboardConfig;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
  permissions: EmployeePermissions;
  isCleaningDeposits: boolean;
  onCleanupDuplicateCardDeposits: () => void;
}

export const CardCommissionsDepositsSection: React.FC<CardCommissionsDepositsSectionProps> = ({
  dashboardConfig,
  onUpdateDashboardConfig,
  permissions,
  isCleaningDeposits,
  onCleanupDuplicateCardDeposits,
}) => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <Percent className="w-4 h-4 text-indigo-600" />
        <h4 className="font-bold text-slate-800 text-sm">Comisiones y Depósitos de Tarjeta</h4>
      </div>

      {/* Comisión de Tarjeta */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-500 block">Comisión de Tarjeta (%)</label>
        <div className="relative">
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={dashboardConfig?.cardFeePercent ?? 3.8}
            onChange={(e) =>
              onUpdateDashboardConfig({
                ...dashboardConfig,
                cardFeePercent: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
        </div>
        <p className="text-[10px] text-slate-400 font-semibold">
          Tasa estándar descontada automáticamente para el cálculo de depósitos netos.
        </p>
      </div>

      {/* Depósitos de Tarjeta: Limpieza de Duplicados */}
      {permissions.editStoreSettings && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 mt-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h5 className="font-bold text-slate-800 text-xs">Mantenimiento de Depósitos de Tarjeta</h5>
              <p className="text-[10px] text-slate-500 font-medium">
                Detecta y elimina registros duplicados creados para la misma fecha de lote.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCleanupDuplicateCardDeposits}
            disabled={isCleaningDeposits}
            className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98"
          >
            {isCleaningDeposits ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Buscando Duplicados...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Buscar y Limpiar Depósitos Duplicados</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
