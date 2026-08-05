import React, { useState } from 'react';
import { ClientPriceList, DashboardConfig, EmployeePermissions } from '../../types';
import { useAlert } from '../../context/AlertContext';
import { Tags, Plus, Edit3, Trash2 } from 'lucide-react';

interface ClientPriceListsSectionProps {
  dashboardConfig: DashboardConfig;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
  permissions: EmployeePermissions;
}

export const ClientPriceListsSection: React.FC<ClientPriceListsSectionProps> = ({
  dashboardConfig,
  onUpdateDashboardConfig,
  permissions,
}) => {
  const { showAlert } = useAlert();
  const [priceListName, setPriceListName] = useState('');
  const [priceListProfit, setPriceListProfit] = useState('');
  const [editingPriceListId, setEditingPriceListId] = useState<string | null>(null);

  const clientPriceLists = dashboardConfig?.clientPriceLists ?? [];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Tags className="w-4 h-4 text-indigo-600" />
        <h4 className="font-bold text-slate-800 text-sm">Listas de Precios de Clientes (% Ganancia)</h4>
      </div>
      <p className="text-[10px] text-slate-400 font-semibold">
        Define un % de ganancia fijo sobre el costo para los clientes asignados a cada lista (redondeado hacia arriba al peso entero).
      </p>

      {/* Formulario para agregar / editar lista de precios */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input autoComplete="off"
            type="text"
            placeholder="Nombre (ej. Mayorista, Distribuidor)"
            disabled={!permissions.editStoreSettings}
            value={priceListName}
            onChange={(e) => setPriceListName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
          />
          <div className="relative w-28">
            <input autoComplete="off"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              placeholder="% Ganancia"
              disabled={!permissions.editStoreSettings}
              value={priceListProfit}
              onChange={(e) => setPriceListProfit(e.target.value)}
              className="w-full pl-3 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!permissions.editStoreSettings}
            onClick={() => {
              if (!permissions.editStoreSettings) return;
              if (!priceListName.trim()) {
                showAlert('Ingrese el nombre de la lista de precios', 'error');
                return;
              }
              const profitNum = parseFloat(priceListProfit);
              if (isNaN(profitNum) || profitNum < 0) {
                showAlert('Ingrese un % de ganancia válido (0 o mayor)', 'error');
                return;
              }

              if (editingPriceListId) {
                const updated = clientPriceLists.map((pl) =>
                  pl.id === editingPriceListId
                    ? { ...pl, name: priceListName.trim(), profitPercent: profitNum }
                    : pl
                );
                onUpdateDashboardConfig({
                  ...dashboardConfig,
                  clientPriceLists: updated,
                });
                showAlert('Lista de precios actualizada', 'success');
              } else {
                const newPl: ClientPriceList = {
                  id: `pl_${Date.now()}`,
                  name: priceListName.trim(),
                  profitPercent: profitNum,
                };
                onUpdateDashboardConfig({
                  ...dashboardConfig,
                  clientPriceLists: [...clientPriceLists, newPl],
                });
                showAlert('Lista de precios creada', 'success');
              }
              setPriceListName('');
              setPriceListProfit('');
              setEditingPriceListId(null);
            }}
            className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            {editingPriceListId ? 'Guardar Cambios de Lista' : 'Agregar Lista de Precios'}
          </button>
          {editingPriceListId && (
            <button
              type="button"
              onClick={() => {
                setEditingPriceListId(null);
                setPriceListName('');
                setPriceListProfit('');
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Lista de listas de precios configuradas */}
      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
        {clientPriceLists.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium italic text-center py-2">
            No hay listas de precios registradas.
          </p>
        ) : (
          clientPriceLists.map((pl) => (
            <div key={pl.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800 uppercase">{pl.name}</span>
                <span className="text-[10px] text-indigo-600 font-bold">
                  +{pl.profitPercent}% ganancia sobre costo
                </span>
              </div>
              {permissions.editStoreSettings && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPriceListId(pl.id);
                      setPriceListName(pl.name);
                      setPriceListProfit(pl.profitPercent.toString());
                    }}
                    className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                    title="Editar"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = clientPriceLists.filter((item) => item.id !== pl.id);
                      onUpdateDashboardConfig({
                        ...dashboardConfig,
                        clientPriceLists: updated,
                      });
                      if (editingPriceListId === pl.id) {
                        setEditingPriceListId(null);
                        setPriceListName('');
                        setPriceListProfit('');
                      }
                      showAlert('Lista de precios eliminada', 'success');
                    }}
                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
