import React from 'react';
import { DashboardConfig } from '../../types';
import { Calendar, Plus, Trash2, Banknote } from 'lucide-react';

interface CashAndHolidaysSectionProps {
  dashboardConfig: DashboardConfig;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
}

export const CashAndHolidaysSection: React.FC<CashAndHolidaysSectionProps> = ({
  dashboardConfig,
  onUpdateDashboardConfig,
}) => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <Calendar className="w-4 h-4 text-indigo-600" />
        <h4 className="font-bold text-slate-800 text-sm">Efectivo Inicial y Días Feriados</h4>
      </div>

      {/* Efectivo Inicial Configurable */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 mb-1">
          <Banknote className="w-3.5 h-3.5 text-slate-500" />
          <label className="text-xs font-bold text-slate-700 block">Efectivo Inicial por Defecto (RD$)</label>
        </div>
        <div className="relative">
          <input autoComplete="off"
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            value={dashboardConfig?.defaultInitialCash ?? 500}
            onChange={(e) =>
              onUpdateDashboardConfig({
                ...dashboardConfig,
                defaultInitialCash: parseFloat(e.target.value) || 0,
              })
            }
            className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">RD$</span>
        </div>
        <p className="text-[10px] text-slate-400 font-semibold">
          Monto precargado para el efectivo inicial en la apertura y corte de turno/caja.
        </p>
      </div>

      {/* Listado de Feriados */}
      <div className="space-y-3 pt-3 border-t border-slate-200">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <label className="text-xs font-bold text-slate-800">Días Feriados / No Laborables</label>
        </div>

        {/* Formulario para agregar feriado */}
        <div className="flex gap-2">
          <input autoComplete="off"
            type="date"
            id="new-holiday-date"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const input = document.getElementById('new-holiday-date') as HTMLInputElement;
              if (input && input.value) {
                const dateStr = input.value; // YYYY-MM-DD
                const currentHolidays = dashboardConfig?.holidays ?? [];
                if (!currentHolidays.includes(dateStr)) {
                  const updatedHolidays = [...currentHolidays, dateStr].sort();
                  onUpdateDashboardConfig({
                    ...dashboardConfig,
                    holidays: updatedHolidays,
                  });
                }
                input.value = '';
              }
            }}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        </div>

        {/* Lista de feriados */}
        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
          {!dashboardConfig?.holidays || dashboardConfig.holidays.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium italic text-center py-2">
              No hay días feriados registrados.
            </p>
          ) : (
            dashboardConfig.holidays.map((h) => {
              const parts = h.split('-');
              const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : h;
              return (
                <div key={h} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-1.5">
                  <span className="text-xs font-semibold text-slate-700">{displayDate}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateDashboardConfig({
                        ...dashboardConfig,
                        holidays: (dashboardConfig.holidays || []).filter((item) => item !== h),
                      });
                    }}
                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
