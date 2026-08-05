import React from 'react';
import { Product, EmployeePermissions } from '../../types';
import { SupplierPicker } from '../SupplierPicker';
import {
  DollarSign,
  Package,
  Users,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  X as XIcon,
  Percent,
} from 'lucide-react';

export interface BulkActionsBarProps {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  permissions: EmployeePermissions;
  products: Product[];
  categoriesList: string[];
  batchActionMenu: 'price' | 'category' | 'provider' | null;
  setBatchActionMenu: (menu: 'price' | 'category' | 'provider' | null) => void;
  batchPriceMode: 'fixed' | 'percent';
  setBatchPriceMode: (mode: 'fixed' | 'percent') => void;
  batchPriceValue: string;
  setBatchPriceValue: (value: string) => void;
  batchTargetId: string;
  setBatchTargetId: (target: string) => void;
  onBatchPriceUpdate: () => void;
  onBatchCategoryUpdate: () => void;
  onBatchProviderUpdate: () => void;
  onBatchToggleVisible: (isVisible: boolean) => void;
  onBatchDelete: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedIds,
  setSelectedIds,
  permissions,
  products,
  categoriesList,
  batchActionMenu,
  setBatchActionMenu,
  batchPriceMode,
  setBatchPriceMode,
  batchPriceValue,
  setBatchPriceValue,
  batchTargetId,
  setBatchTargetId,
  onBatchPriceUpdate,
  onBatchCategoryUpdate,
  onBatchProviderUpdate,
  onBatchToggleVisible,
  onBatchDelete,
}) => {
  if (selectedIds.length < 2 || !permissions.bulkEditProducts) {
    return null;
  }

  return (
    <div className="mb-4 bg-slate-900 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-4">
        <div className="bg-white/20 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider">
          {selectedIds.length} Seleccionados
        </div>
        <div className="flex items-center gap-2">
          {/* Batch Price */}
          <div className="relative group">
            <button
              onClick={() => setBatchActionMenu(batchActionMenu === 'price' ? null : 'price')}
              className="px-3 py-1.5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Cambiar Precio</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {batchActionMenu === 'price' && (
              <div className="absolute top-full left-0 mt-2 bg-white text-slate-800 p-4 rounded-2xl shadow-xl border border-slate-200 w-64 z-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400">Actualizar Precio</span>
                  <button onClick={() => setBatchActionMenu(null)}>
                    <XIcon className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
                <div className="flex gap-1 mb-3 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setBatchPriceMode('fixed')}
                    className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                      batchPriceMode === 'fixed'
                        ? 'bg-white shadow-sm text-indigo-600'
                        : 'text-slate-500'
                    }`}
                  >
                    Fijo
                  </button>
                  <button
                    onClick={() => setBatchPriceMode('percent')}
                    className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                      batchPriceMode === 'percent'
                        ? 'bg-white shadow-sm text-indigo-600'
                        : 'text-slate-500'
                    }`}
                  >
                    % Variación
                  </button>
                </div>
                <div className="relative mb-3">
                  {batchPriceMode === 'fixed' ? (
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  ) : (
                    <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  )}
                  <input autoComplete="off"
                    type="number"
                    inputMode="decimal"
                    placeholder={batchPriceMode === 'fixed' ? 'Nuevo precio RD$' : '% ejemplo: 10 o -5'}
                    value={batchPriceValue}
                    onChange={(e) => setBatchPriceValue(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={onBatchPriceUpdate}
                  disabled={!batchPriceValue}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  Aplicar a {selectedIds.length} ítems
                </button>
              </div>
            )}
          </div>

          {/* Batch Category */}
          <div className="relative group">
            <button
              onClick={() => setBatchActionMenu(batchActionMenu === 'category' ? null : 'category')}
              className="px-3 py-1.5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Categoría</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {batchActionMenu === 'category' && (
              <div className="absolute top-full left-0 mt-2 bg-white text-slate-800 p-4 rounded-2xl shadow-xl border border-slate-200 w-64 z-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400">Mover a Categoría</span>
                  <button onClick={() => setBatchActionMenu(null)}>
                    <XIcon className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
                <select
                  value={batchTargetId}
                  onChange={(e) => setBatchTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none mb-3"
                >
                  <option value="">Seleccionar...</option>
                  {categoriesList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onBatchCategoryUpdate}
                  disabled={!batchTargetId}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  Mover Selección
                </button>
              </div>
            )}
          </div>

          {/* Batch Provider */}
          <div className="relative group">
            <button
              onClick={() => setBatchActionMenu(batchActionMenu === 'provider' ? null : 'provider')}
              className="px-3 py-1.5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Proveedor</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {batchActionMenu === 'provider' && (
              <div className="absolute top-full left-0 mt-2 bg-white text-slate-800 p-4 rounded-2xl shadow-xl border border-slate-200 w-64 z-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black uppercase text-slate-400">Cambiar Proveedor</span>
                  <button onClick={() => setBatchActionMenu(null)}>
                    <XIcon className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
                <SupplierPicker
                  value={batchTargetId}
                  onChange={setBatchTargetId}
                  products={products}
                  placeholder="Nombre del proveedor..."
                  className="mb-3"
                />
                <button
                  onClick={onBatchProviderUpdate}
                  disabled={!batchTargetId}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  Actualizar Proveedor
                </button>
              </div>
            )}
          </div>

          {/* Batch Toggle Visibility */}
          <button
            onClick={() => onBatchToggleVisible(true)}
            className="px-3 py-1.5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
            title="Mostrar todos los seleccionados"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Mostrar</span>
          </button>
          <button
            onClick={() => onBatchToggleVisible(false)}
            className="px-3 py-1.5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
            title="Ocultar todos los seleccionados"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Ocultar</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBatchDelete}
          className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Eliminar Lote</span>
        </button>
        <button
          onClick={() => setSelectedIds([])}
          className="p-2 hover:bg-white/10 rounded-full transition-all"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
