import React from 'react';
import { DollarSign, AlertTriangle, AlertCircle, Check } from 'lucide-react';
import { Product } from '../../types';
import { getStringValue } from '../../lib/normalize';

export interface ABCProduct {
  id: string;
  name: string;
  category: string;
  emoji: string;
  stock: number;
  minStock?: number;
  cost?: number;
  abcClass: 'A' | 'B' | 'C';
  revenue: number;
}

interface InventarioTabProps {
  inventoryStats: {
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    abcProducts: ABCProduct[];
    abcSummary: Record<'A' | 'B' | 'C', { count: number; value: number }>;
    categoryValues: Array<{ name: string; value: number }>;
    criticalProducts: Product[];
  };
  onNavigateToProduct: (productId: string) => void;
}

export const InventarioTab: React.FC<InventarioTabProps> = ({
  inventoryStats,
  onNavigateToProduct
}) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor del Inventario</h3>
          </div>
          <span className="text-2xl font-black font-mono text-slate-800">
            RD$ {inventoryStats.totalValue.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Costo total de existencias</p>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Bajo</h3>
          </div>
          <span className="text-2xl font-black font-mono text-amber-600">
            {inventoryStats.lowStockCount}
          </span>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Productos bajo el mínimo</p>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin Existencia</h3>
          </div>
          <span className="text-2xl font-black font-mono text-rose-600">
            {inventoryStats.outOfStockCount}
          </span>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Productos con stock 0 o menor</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ABC Classification Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
            <div className="mb-6">
              <h3 className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Clasificación ABC</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Basado en ventas (90 días)</p>
            </div>

            <div className="space-y-4">
              {(['A', 'B', 'C'] as const).map((cls) => {
                const data = inventoryStats.abcSummary[cls];
                const pctOfValue = inventoryStats.totalValue > 0 ? (data.value / inventoryStats.totalValue) * 100 : 0;
                return (
                  <div key={cls} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/30">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white ${
                          cls === 'A' ? 'bg-emerald-500' : cls === 'B' ? 'bg-amber-500' : 'bg-slate-400'
                        }`}>
                          {cls}
                        </span>
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                          Clase {cls} ({data.count} prod.)
                        </span>
                      </div>
                      <span className="text-xs font-black font-mono text-slate-800">
                        {pctOfValue.toFixed(1)}% val.
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          cls === 'A' ? 'bg-emerald-500' : cls === 'B' ? 'bg-amber-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${pctOfValue}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">
                      {cls === 'A' ? 'Alta rotación (80% ventas)' : cls === 'B' ? 'Rotación media (15% ventas)' : 'Baja rotación (5% ventas)'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inventory Value by Category */}
          <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
            <div className="mb-6">
              <h3 className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Valor por Categoría</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Distribución del capital</p>
            </div>
            <div className="space-y-3">
              {inventoryStats.categoryValues.slice(0, 5).map((cat) => {
                const pct = inventoryStats.totalValue > 0 ? (cat.value / inventoryStats.totalValue) * 100 : 0;
                return (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-wider">
                      <span className="text-slate-500 truncate max-w-[150px]">{cat.name}</span>
                      <span className="text-slate-800">RD$ {cat.value.toLocaleString()}</span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ABC Product Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Catálogo y Clasificación ABC</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Análisis de rentabilidad y stock</p>
          </div>
          <div className="flex-1 max-h-[600px] overflow-y-auto">
            {/* Desktop Table */}
            <table className="w-full text-left hidden md:table">
              <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Clase</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Venta (90d)</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Stock</th>
                  <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {inventoryStats.abcProducts.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{p.emoji}</span>
                        <div>
                          <span className="text-xs font-black text-slate-800 block">{getStringValue(p.name)}</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">{getStringValue(p.category)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black text-white ${
                        p.abcClass === 'A' ? 'bg-emerald-500' : p.abcClass === 'B' ? 'bg-amber-500' : 'bg-slate-400'
                      }`}>
                        {p.abcClass}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-[11px] font-black font-mono text-slate-700">RD$ {p.revenue.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={`text-[11px] font-black font-mono ${p.stock <= (p.minStock || 0) ? 'text-rose-600' : 'text-slate-700'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-[11px] font-black font-mono text-slate-500">
                        RD$ {(p.stock * (p.cost || 0)).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="block md:hidden p-4 space-y-3">
              {inventoryStats.abcProducts.map(p => (
                <div key={p.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl shrink-0">{p.emoji}</span>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-800 block truncate">{getStringValue(p.name)}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{getStringValue(p.category)}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black text-white shrink-0 ${
                      p.abcClass === 'A' ? 'bg-emerald-500' : p.abcClass === 'B' ? 'bg-amber-500' : 'bg-slate-400'
                    }`}>
                      Clase {p.abcClass}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-[10px] font-mono">
                    <div>
                      <span className="text-slate-400 block font-sans text-[9px] font-bold uppercase">Ventas 90d</span>
                      <span className="font-black text-slate-700">RD$ {p.revenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans text-[9px] font-bold uppercase">Stock</span>
                      <span className={`font-black ${p.stock <= (p.minStock || 0) ? 'text-rose-600' : 'text-slate-700'}`}>
                        {p.stock}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans text-[9px] font-bold uppercase">Valor Est.</span>
                      <span className="font-black text-slate-500">RD$ {(p.stock * (p.cost || 0)).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Critical Stock List */}
      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Productos en Alerta de Stock</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Bajo el mínimo establecido</p>
          </div>
          <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest">
            {inventoryStats.criticalProducts.length} Alertas
          </div>
        </div>

        {inventoryStats.criticalProducts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl">
            <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-[10px] font-black uppercase tracking-widest">Todo en orden • Stock suficiente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventoryStats.criticalProducts.map(p => (
              <div key={p.id} className="p-4 border border-slate-100 rounded-2xl bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.emoji}</span>
                  <div>
                    <span className="text-xs font-black text-slate-800 block truncate max-w-[120px]">{p.name}</span>
                    <span className="text-[10px] font-black text-rose-500 uppercase">Stock: {p.stock} / Mín: {p.minStock}</span>
                  </div>
                </div>
                <button 
                  onClick={() => onNavigateToProduct(p.id)}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                >
                  Reabastecer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventarioTab;
