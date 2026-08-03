import React from 'react';
import { Category, DashboardConfig, EmployeePermissions, Product } from '../../types';
import { TrendingUp } from 'lucide-react';

interface CategoryProfitTargetsSectionProps {
  dashboardConfig: DashboardConfig;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
  permissions: EmployeePermissions;
  categories?: Category[];
  products?: Product[];
}

export const CategoryProfitTargetsSection: React.FC<CategoryProfitTargetsSectionProps> = ({
  dashboardConfig,
  onUpdateDashboardConfig,
  permissions,
  categories = [],
  products = [],
}) => {
  const categoryProfitTargets = dashboardConfig?.categoryProfitTargets || {};

  // Calculate list of all unique categories in store
  const allCategoryList = (() => {
    const map = new Map<string, { id: string; name: string; emoji?: string }>();
    if (categories && categories.length > 0) {
      categories.forEach((c) => {
        if (c.id !== 'all' && c.name && c.name !== 'Todos') {
          map.set(c.name, { id: c.id, name: c.name, emoji: c.emoji });
        }
      });
    }
    products.forEach((p) => {
      if (p.category && p.category.trim() && p.category !== 'all') {
        const catName = p.category.trim();
        if (!map.has(catName)) {
          map.set(catName, { id: catName, name: catName });
        }
      }
    });
    Object.keys(categoryProfitTargets).forEach((k) => {
      if (k && k !== 'all' && !map.has(k)) {
        map.set(k, { id: k, name: k });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-indigo-600" />
        <h4 className="font-bold text-slate-800 text-sm">Metas de Ganancia por Categoría</h4>
      </div>
      <p className="text-[10px] text-slate-400 font-semibold">
        Establece el % de ganancia objetivo para cada categoría. Generará una alerta para productos con margen 5% o más por debajo.
      </p>

      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
        {allCategoryList.length === 0 ? (
          <p className="text-xs text-slate-400 font-medium italic text-center py-2">
            No hay categorías en el catálogo.
          </p>
        ) : (
          allCategoryList.map((catItem) => {
            const catKey = catItem.name;
            const currentTarget = categoryProfitTargets[catKey] ?? categoryProfitTargets[catItem.id] ?? '';
            return (
              <div
                key={catItem.id || catItem.name}
                className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-3.5 py-2"
              >
                <span className="text-xs font-bold text-slate-700 truncate max-w-[180px]" title={catItem.name}>
                  {catItem.emoji ? `${catItem.emoji} ` : ''}
                  {catItem.name}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="0.5"
                    placeholder="Ej. 40"
                    disabled={!permissions.editStoreSettings}
                    value={currentTarget}
                    onChange={(e) => {
                      if (!permissions.editStoreSettings) return;
                      const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                      const newTargets = { ...categoryProfitTargets };
                      if (val === undefined || isNaN(val)) {
                        delete newTargets[catKey];
                        delete newTargets[catItem.id];
                      } else {
                        newTargets[catKey] = val;
                      }
                      onUpdateDashboardConfig({
                        ...dashboardConfig,
                        categoryProfitTargets: newTargets,
                      });
                    }}
                    className={`w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      !permissions.editStoreSettings
                        ? 'bg-slate-100 cursor-not-allowed'
                        : 'bg-slate-50 focus:bg-white'
                    }`}
                  />
                  <span className="text-xs font-bold text-slate-400">%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
