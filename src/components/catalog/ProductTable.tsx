import React from 'react';
import { Product, Category, EmployeePermissions, DashboardConfig } from '../../types';
import { SupplierPicker } from '../SupplierPicker';
import { getPreTaxAmount, isProductBelowTargetProfit } from '../../lib/money';
import { getStringValue } from '../../lib/normalize';
import {
  Package,
  Edit3,
  Trash2,
  Check,
  ArrowUpDown,
  AlertTriangle,
  Eye,
  EyeOff,
  X as XIcon,
} from 'lucide-react';

export type SortField = 'name' | 'category' | 'provider' | 'stock' | 'cost' | 'price' | 'profitPercent';
export type SortOrder = 'asc' | 'desc';

export type InlineField = 'price' | 'category' | 'provider' | 'code' | 'sku' | 'cost';

export interface ActiveInlineEdit {
  productId: string;
  field: InlineField;
  value: string;
  originalValue: any;
}

export interface InlineFeedback {
  productId: string;
  field: InlineField;
  type: 'success' | 'error';
}

export interface ProductTableProps {
  products: Product[];
  sortedProducts: Product[];
  categories: Category[];
  dashboardConfig?: DashboardConfig;
  permissions: EmployeePermissions;
  selectedIds: string[];
  toggleSelectAll: () => void;
  toggleSelectProduct: (id: string) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  toggleSort: (field: SortField) => void;
  activeEdit: ActiveInlineEdit | null;
  setActiveEdit: React.Dispatch<React.SetStateAction<ActiveInlineEdit | null>>;
  feedback: InlineFeedback | null;
  handleStartEdit: (prod: Product, field: InlineField) => void;
  saveCurrentEdit: (editToSave?: ActiveInlineEdit | null) => Promise<boolean>;
  allCategoryNames: string[];
  handleToggleVisible: (prod: Product) => void;
  onEdit: (productId: string) => void;
  onDeleteProduct: (productId: string) => void;
  showConfirm: (title: string, message: string) => Promise<boolean>;
}

interface ProductRowProps {
  prod: Product;
  products: Product[];
  categories: Category[];
  dashboardConfig?: DashboardConfig;
  permissions: EmployeePermissions;
  isSelected: boolean;
  toggleSelectProduct: (id: string) => void;
  activeEdit: ActiveInlineEdit | null;
  setActiveEdit: React.Dispatch<React.SetStateAction<ActiveInlineEdit | null>>;
  feedback: InlineFeedback | null;
  handleStartEdit: (prod: Product, field: InlineField) => void;
  saveCurrentEdit: (editToSave?: ActiveInlineEdit | null) => Promise<boolean>;
  allCategoryNames: string[];
  handleToggleVisible: (prod: Product) => void;
  onEdit: (productId: string) => void;
  onDeleteProduct: (productId: string) => void;
  showConfirm: (title: string, message: string) => Promise<boolean>;
  renderFeedbackIcon: (productId: string, field: InlineField) => React.ReactNode;
}

const ProductRow: React.FC<ProductRowProps> = React.memo(({
  prod,
  products,
  categories,
  dashboardConfig,
  permissions,
  isSelected,
  toggleSelectProduct,
  activeEdit,
  setActiveEdit,
  feedback,
  handleStartEdit,
  saveCurrentEdit,
  allCategoryNames,
  handleToggleVisible,
  onEdit,
  onDeleteProduct,
  showConfirm,
  renderFeedbackIcon,
}) => {
  const cost = prod.cost || 0;
  const pricePreTax = getPreTaxAmount(prod.price, prod.taxExempt);
  const margin = cost > 0 ? ((pricePreTax - cost) / cost) * 100 : 0;
  const { isBelow: isMarginBelowTarget, targetMargin } = isProductBelowTargetProfit(
    prod,
    dashboardConfig?.categoryProfitTargets,
    categories
  );

  return (
    <tr
      className={`hover:bg-slate-50/50 transition-colors group ${
        isSelected ? 'bg-indigo-50/40' : ''
      }`}
    >
      {/* Checkbox */}
      <td className="py-3.5 px-5 text-center">
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelectProduct(prod.id)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
        </div>
      </td>

      {/* 1. Nombre o Producto */}
      <td className="py-3.5 px-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative shadow-xs">
            {prod.imageUrl ? (
              <img
                src={prod.imageUrl}
                alt={prod.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).classList.add('hidden');
                  const fallback = (e.target as HTMLImageElement).parentElement?.querySelector(
                    '.fallback-table-icon'
                  );
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
            ) : null}
            <span className={`fallback-table-icon text-xl ${prod.imageUrl ? 'hidden' : ''}`}>
              {prod.emoji || '🏷️'}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="font-extrabold text-slate-800 block truncate leading-tight hover:text-indigo-600 transition-colors cursor-pointer"
                onClick={() => onEdit(prod.id)}
              >
                {prod.name}
              </span>
              {prod.visible === false && (
                <span className="bg-slate-200 text-slate-600 text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-wider">
                  Oculto
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {/* Category Badge */}
              <span
                onClick={() => handleStartEdit(prod, 'category')}
                className={`text-[8px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-black uppercase transition-all ${
                  permissions.manageProducts
                    ? 'hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer'
                    : ''
                }`}
                title={permissions.manageProducts ? 'Clic para editar categoría' : undefined}
              >
                {getStringValue(prod.category, 'Sin categoría')}
              </span>

              {isMarginBelowTarget && (
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-black uppercase inline-flex items-center gap-1 shadow-2xs"
                  title={`Margen actual (${margin.toFixed(1)}%) es 5%+ menor que el objetivo (${targetMargin}%)`}
                >
                  ⚠️ Por debajo del margen objetivo
                </span>
              )}

              {/* SKU Badge or Editor */}
              {activeEdit?.productId === prod.id && activeEdit?.field === 'sku' ? (
                <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
                  <span className="text-[8px] font-bold text-indigo-600">SKU:</span>
                  <input autoComplete="off"
                    type="text"
                    value={activeEdit.value || ''}
                    onChange={(e) => setActiveEdit({ ...activeEdit, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveCurrentEdit();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setActiveEdit(null);
                      }
                    }}
                    onBlur={() => saveCurrentEdit()}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    placeholder="SKU"
                    className="w-24 px-1.5 py-0.5 text-[10px] border border-indigo-500 rounded focus:outline-none bg-white font-mono"
                  />
                </div>
              ) : (
                <div className="inline-flex items-center">
                  <span
                    onClick={() => handleStartEdit(prod, 'sku')}
                    className={`text-[8px] px-1.5 py-0.5 rounded font-bold transition-all ${
                      prod.sku
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-slate-100/80 text-slate-400 hover:text-slate-600'
                    } ${permissions.manageProducts ? 'hover:ring-1 hover:ring-indigo-300 cursor-pointer' : ''}`}
                    title={permissions.manageProducts ? 'Clic para editar SKU' : undefined}
                  >
                    {prod.sku ? `SKU: ${prod.sku}` : '+ SKU'}
                  </span>
                  {renderFeedbackIcon(prod.id, 'sku')}
                </div>
              )}

              {/* CODE Badge or Editor */}
              {activeEdit?.productId === prod.id && activeEdit?.field === 'code' ? (
                <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
                  <span className="text-[9px] text-slate-400 font-mono font-bold">#</span>
                  <input autoComplete="off"
                    type="text"
                    value={activeEdit.value || ''}
                    onChange={(e) => setActiveEdit({ ...activeEdit, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveCurrentEdit();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setActiveEdit(null);
                      }
                    }}
                    onBlur={() => saveCurrentEdit()}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    placeholder="Código"
                    className="w-28 px-1.5 py-0.5 text-[10px] border border-indigo-500 rounded focus:outline-none bg-white font-mono"
                  />
                </div>
              ) : (
                <div className="inline-flex items-center">
                  <span
                    onClick={() => handleStartEdit(prod, 'code')}
                    className={`text-[9px] text-slate-400 font-mono font-bold block uppercase transition-all px-1 rounded ${
                      permissions.manageProducts
                        ? 'hover:bg-slate-100 hover:text-slate-700 hover:ring-1 hover:ring-slate-300 cursor-pointer'
                        : ''
                    }`}
                    title={permissions.manageProducts ? 'Clic para editar código' : undefined}
                  >
                    #{prod.code || prod.barcode || prod.id}
                  </span>
                  {renderFeedbackIcon(prod.id, 'code')}
                </div>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* 2. Categoría */}
      <td className="py-3.5 px-4 font-bold text-slate-650">
        {activeEdit?.productId === prod.id && activeEdit?.field === 'category' ? (
          <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <input autoComplete="off"
              type="text"
              list={`category-list-${prod.id}`}
              value={activeEdit.value || ''}
              onChange={(e) => setActiveEdit({ ...activeEdit, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveCurrentEdit();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setActiveEdit(null);
                }
              }}
              onBlur={() => saveCurrentEdit()}
              autoFocus
              placeholder="Categoría..."
              className="w-32 px-2 py-1 text-xs border border-indigo-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-bold"
            />
            <datalist id={`category-list-${prod.id}`}>
              {allCategoryNames.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        ) : (
          <div className="flex items-center gap-1 group/cell">
            <span
              onClick={() => handleStartEdit(prod, 'category')}
              className={`bg-slate-100/60 px-2 py-1 rounded-lg text-[10px] text-slate-700 transition-all ${
                permissions.manageProducts
                  ? 'hover:bg-indigo-50 hover:text-indigo-700 hover:ring-1 hover:ring-indigo-300 cursor-pointer'
                  : ''
              }`}
              title={permissions.manageProducts ? 'Clic para editar categoría' : undefined}
            >
              {getStringValue(prod.category, 'Sin Categoría')}
            </span>
            {renderFeedbackIcon(prod.id, 'category')}
          </div>
        )}
      </td>

      {/* 3. Proveedor */}
      <td className="py-3.5 px-4 font-bold text-slate-650">
        {activeEdit?.productId === prod.id && activeEdit?.field === 'provider' ? (
          <div className="relative flex items-center gap-1 min-w-[160px]" onMouseDown={(e) => e.stopPropagation()}>
            <SupplierPicker
              value={activeEdit.value}
              onChange={(val) => setActiveEdit((prev) => (prev ? { ...prev, value: val } : null))}
              products={products}
              placeholder="Proveedor..."
              className="w-36 text-xs"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => saveCurrentEdit()}
              className="p-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md cursor-pointer shrink-0"
              title="Guardar"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setActiveEdit(null)}
              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-md cursor-pointer shrink-0"
              title="Cancelar"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group/cell">
            <span
              onClick={() => handleStartEdit(prod, 'provider')}
              className={`px-2 py-1 rounded-lg text-[10px] text-slate-700 bg-slate-100/60 transition-all ${
                permissions.manageProducts
                  ? 'hover:bg-indigo-50 hover:text-indigo-700 hover:ring-1 hover:ring-indigo-300 cursor-pointer'
                  : ''
              }`}
              title={permissions.manageProducts ? 'Clic para editar proveedor' : undefined}
            >
              {getStringValue(prod.provider) ? (
                getStringValue(prod.provider)
              ) : (
                <span className="text-slate-350 italic text-[11px]">No asignado</span>
              )}
            </span>
            {renderFeedbackIcon(prod.id, 'provider')}
          </div>
        )}
      </td>

      {/* 4. Stock */}
      <td className="py-3.5 px-4 text-center">
        <span
          className={`text-xs font-black px-2.5 py-1 rounded-xl shadow-xs inline-block min-w-[70px] ${
            prod.stock <= 5
              ? 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'
              : prod.stock <= 15
              ? 'bg-amber-50 text-amber-700 border border-amber-100'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          }`}
        >
          {prod.stock} un.
        </span>
      </td>

      {/* 5. Costo */}
      <td className="py-3.5 px-4 text-right font-bold text-slate-600 font-mono">
        {activeEdit?.productId === prod.id && activeEdit?.field === 'cost' ? (
          <div className="flex items-center justify-end gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <span className="text-xs font-bold text-slate-400">RD$</span>
            <input autoComplete="off"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={activeEdit.value || ''}
              onChange={(e) => setActiveEdit({ ...activeEdit, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveCurrentEdit();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setActiveEdit(null);
                }
              }}
              onBlur={() => saveCurrentEdit()}
              autoFocus
              onFocus={(e) => e.target.select()}
              className="w-20 px-1.5 py-1 text-xs border border-indigo-500 rounded-lg text-right font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1.5 group/cell">
            <span
              onClick={() => handleStartEdit(prod, 'cost')}
              className={`font-bold text-slate-600 font-mono px-1.5 py-0.5 rounded transition-all ${
                permissions.manageProducts
                  ? 'hover:bg-indigo-50 hover:text-indigo-700 hover:ring-1 hover:ring-indigo-300 cursor-pointer'
                  : ''
              }`}
              title={permissions.manageProducts ? 'Clic para editar costo' : undefined}
            >
              RD$ {cost.toFixed(2)}
            </span>
            {renderFeedbackIcon(prod.id, 'cost')}
          </div>
        )}
      </td>

      {/* 6. Venta */}
      <td className="py-3.5 px-4 text-right font-black text-slate-850 font-mono text-xs">
        {activeEdit?.productId === prod.id && activeEdit?.field === 'price' ? (
          <div className="flex items-center justify-end gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <span className="text-xs font-bold text-slate-400">RD$</span>
            <input autoComplete="off"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={activeEdit.value || ''}
              onChange={(e) => setActiveEdit({ ...activeEdit, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveCurrentEdit();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setActiveEdit(null);
                }
              }}
              onBlur={() => saveCurrentEdit()}
              autoFocus
              onFocus={(e) => e.target.select()}
              className="w-20 px-1.5 py-1 text-xs border border-indigo-500 rounded-lg text-right font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>
        ) : (
          <div className="flex items-center justify-end gap-1.5 group/cell">
            <span
              onClick={() => handleStartEdit(prod, 'price')}
              className={`font-black text-slate-850 font-mono text-xs px-1.5 py-0.5 rounded transition-all ${
                permissions.manageProducts
                  ? 'hover:bg-indigo-50 hover:text-indigo-700 hover:ring-1 hover:ring-indigo-300 cursor-pointer'
                  : ''
              }`}
              title={permissions.manageProducts ? 'Clic para editar precio' : undefined}
            >
              RD$ {prod.price.toFixed(2)}
            </span>
            {renderFeedbackIcon(prod.id, 'price')}
          </div>
        )}
      </td>

      {/* 7. % Ganancia */}
      <td className="py-3.5 px-4 text-center">
        <span
          className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${
            margin >= 40
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
              : margin >= 15
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-150'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}
        >
          {margin.toFixed(0)}%
        </span>
      </td>

      {/* 8. Control */}
      <td className="py-3.5 px-5">
        <div className="flex items-center justify-end gap-3">
          {/* Hide / Show Toggle */}
          {permissions.manageProducts && (
            <button
              onClick={() => handleToggleVisible(prod)}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                prod.visible === false
                  ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title={
                prod.visible === false
                  ? 'Mostrar en catálogo de ventas'
                  : 'Ocultar de catálogo de ventas'
              }
            >
              {prod.visible === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {/* Divider */}
          {permissions.manageProducts && <div className="h-4 w-px bg-slate-200" />}

          {/* Edit & Delete row buttons */}
          {permissions.manageProducts ? (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onEdit(prod.id)}
                className="p-1.5 text-indigo-600 hover:text-indigo-850 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                title="Editar producto"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  const confirmDelete = await showConfirm(
                    'Eliminar Producto',
                    `¿Estás seguro de que deseas eliminar el producto "${prod.name}"?`
                  );
                  if (confirmDelete) {
                    onDeleteProduct(prod.id);
                  }
                }}
                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                title="Eliminar producto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-slate-300 italic">Solo lectura</span>
          )}
        </div>
      </td>
    </tr>
  );
});

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  sortedProducts,
  categories,
  dashboardConfig,
  permissions,
  selectedIds,
  toggleSelectAll,
  toggleSelectProduct,
  sortField,
  sortOrder,
  toggleSort,
  activeEdit,
  setActiveEdit,
  feedback,
  handleStartEdit,
  saveCurrentEdit,
  allCategoryNames,
  handleToggleVisible,
  onEdit,
  onDeleteProduct,
  showConfirm,
}) => {
  const renderFeedbackIcon = (productId: string, field: InlineField) => {
    if (!feedback || feedback.productId !== productId || feedback.field !== field) return null;

    if (feedback.type === 'success') {
      return (
        <span
          className="inline-flex items-center justify-center p-0.5 bg-emerald-100 text-emerald-600 rounded-full animate-bounce shrink-0 ml-1"
          title="Guardado exitosamente"
        >
          <Check className="w-3 h-3 stroke-[3]" />
        </span>
      );
    }

    if (feedback.type === 'error') {
      return (
        <span
          className="inline-flex items-center justify-center p-0.5 bg-rose-100 text-rose-600 rounded-full animate-pulse shrink-0 ml-1"
          title="Error al guardar"
        >
          <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
        </span>
      );
    }

    return null;
  };

  const renderSortHeader = (label: string, field: SortField) => {
    const isActive = sortField === field;
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer uppercase text-[10px] font-black tracking-wider ${
          isActive ? 'text-indigo-600 font-extrabold' : 'text-slate-500'
        }`}
      >
        <span>{label}</span>
        <ArrowUpDown className={`w-3 h-3 ${isActive ? 'text-indigo-600' : 'text-slate-400 opacity-60'}`} />
      </button>
    );
  };

  if (sortedProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-xs max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
          <Package className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-black text-slate-700 uppercase">No se encontraron productos</h4>
        <p className="text-xs text-slate-450 mt-1 max-w-xs leading-relaxed">
          Prueba ajustando los filtros de categoría, el texto de búsqueda o importa un catálogo completo con el botón de Importar.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[950px]">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider select-none">
              <th className="py-3 px-5 w-12 text-center">
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === sortedProducts.length && sortedProducts.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              </th>
              <th className="py-3 px-5 w-[300px]">
                {renderSortHeader('Nombre o Producto', 'name')}
              </th>
              <th className="py-3 px-4">
                {renderSortHeader('Categoría', 'category')}
              </th>
              <th className="py-3 px-4">
                {renderSortHeader('Proveedor', 'provider')}
              </th>
              <th className="py-3 px-4 text-center">
                {renderSortHeader('Stock', 'stock')}
              </th>
              <th className="py-3 px-4 text-right">
                {renderSortHeader('Costo', 'cost')}
              </th>
              <th className="py-3 px-4 text-right">
                {renderSortHeader('Venta', 'price')}
              </th>
              <th className="py-3 px-4 text-center">
                {renderSortHeader('% Ganancia', 'profitPercent')}
              </th>
              <th className="py-3 px-5 text-center w-[160px]">Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 text-xs bg-white">
            {sortedProducts.map((prod) => (
              <ProductRow
                key={prod.id}
                prod={prod}
                products={products}
                categories={categories}
                dashboardConfig={dashboardConfig}
                permissions={permissions}
                isSelected={selectedIds.includes(prod.id)}
                toggleSelectProduct={toggleSelectProduct}
                activeEdit={activeEdit}
                setActiveEdit={setActiveEdit}
                feedback={feedback}
                handleStartEdit={handleStartEdit}
                saveCurrentEdit={saveCurrentEdit}
                allCategoryNames={allCategoryNames}
                handleToggleVisible={handleToggleVisible}
                onEdit={onEdit}
                onDeleteProduct={onDeleteProduct}
                showConfirm={showConfirm}
                renderFeedbackIcon={renderFeedbackIcon}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer Results Counter */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-right text-[11px] text-slate-500 font-bold">
        Mostrando {sortedProducts.length} de {products.length} productos registrados.
      </div>
    </div>
  );
};
