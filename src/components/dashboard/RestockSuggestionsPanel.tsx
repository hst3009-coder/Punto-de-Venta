import React, { useState, useMemo } from 'react';
import { Product, Sale } from '../../types';
import { getRestockSuggestions, RestockSuggestion } from '../../lib/restockSuggestions';
import {
  Truck,
  Sparkles,
  AlertTriangle,
  PackageCheck,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Clock,
  ArrowRight,
} from 'lucide-react';

export interface DraftOrderItem {
  productId: string;
  productName: string;
  quantityOrdered: number;
  estimatedCost: number;
}

export interface DraftOrderGroup {
  supplierName: string;
  items: DraftOrderItem[];
}

export interface CombinedRestockItem {
  product: Product;
  isLowStock: boolean;
  isHighPace: boolean;
  minStock: number;
  stock: number;
  dailyAvgSales: number;
  daysOfCoverage: number;
  suggestedQty: number;
}

interface RestockSuggestionsPanelProps {
  products: Product[];
  sales: Sale[];
  onCreateDraftOrders: (drafts: DraftOrderGroup[]) => void;
  onNavigateToProduct?: (id: string) => void;
}

export const RestockSuggestionsPanel: React.FC<RestockSuggestionsPanelProps> = ({
  products = [],
  sales = [],
  onCreateDraftOrders,
  onNavigateToProduct,
}) => {
  // Combine low stock + high sales pace items
  const combinedItems = useMemo<CombinedRestockItem[]>(() => {
    const suggestions = getRestockSuggestions(products, sales, 30);
    const sugMap = new Map<string, RestockSuggestion>();
    for (const s of suggestions) {
      if (s.product?.id) {
        sugMap.set(s.product.id, s);
      }
    }

    const itemsMap = new Map<string, CombinedRestockItem>();

    for (const p of products) {
      if (!p || !p.id) continue;
      if (p.visible === false) continue;
      if (p.category === 'Genérico') continue;

      const stock = Number(p.stock || 0);
      const minStock = p.minStock !== undefined ? Number(p.minStock) : 0;
      const isLowStock = (minStock > 0 && stock <= minStock) || stock <= 0;
      const sug = sugMap.get(p.id);
      const isHighPace = !!sug;

      if (isLowStock || isHighPace) {
        const dailyAvgSales = sug ? sug.dailyAvgSales : 0;
        const daysOfCoverage = sug ? sug.daysOfCoverage : Infinity;
        const suggestedQty = sug
          ? sug.suggestedQty
          : Math.max(1, (minStock > 0 ? minStock * 2 : 5) - Math.max(0, stock));

        itemsMap.set(p.id, {
          product: p,
          isLowStock,
          isHighPace,
          minStock,
          stock,
          dailyAvgSales,
          daysOfCoverage,
          suggestedQty,
        });
      }
    }

    const list = Array.from(itemsMap.values());

    // Sort: Both criteria first, then low stock, then high pace. Secondary: lowest daysOfCoverage / stock
    list.sort((a, b) => {
      const scoreA = (a.isLowStock ? 2 : 0) + (a.isHighPace ? 1 : 0);
      const scoreB = (b.isLowStock ? 2 : 0) + (b.isHighPace ? 1 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.daysOfCoverage - b.daysOfCoverage;
    });

    return list;
  }, [products, sales]);

  // Selection state
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => {
    return new Set(combinedItems.map((s) => s.product.id));
  });

  // Sync selection when combinedItems change
  React.useEffect(() => {
    setSelectedProductIds(new Set(combinedItems.map((s) => s.product.id)));
  }, [combinedItems]);

  // UI state
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allSelected = combinedItems.length > 0 && selectedProductIds.size === combinedItems.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(combinedItems.map((s) => s.product.id)));
    }
  };

  const visibleItems = showAll ? combinedItems : combinedItems.slice(0, 6);

  const handleGenerateAiSummary = async () => {
    if (combinedItems.length === 0) return;
    setIsLoadingAi(true);
    setAiError(null);

    try {
      const payload = combinedItems.map((s) => ({
        productName: s.product.name,
        currentStock: s.product.stock,
        daysOfCoverage: s.daysOfCoverage === Infinity ? 'N/A' : s.daysOfCoverage,
        isLowStock: s.isLowStock,
        isHighPace: s.isHighPace,
        suggestedQty: s.suggestedQty,
        supplierName: s.product.provider || 'Sin proveedor',
      }));

      const res = await fetch('/api/suggest-restock-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestions: payload }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al comunicarse con el servidor AI');
      }

      const data = await res.json();
      setAiSummary(data.summary);
    } catch (err: any) {
      console.error('Error generating AI restock summary:', err);
      setAiError(err.message || 'No se pudo generar el resumen AI');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleCreateOrders = () => {
    const selectedItems = combinedItems.filter((s) => selectedProductIds.has(s.product.id));
    if (selectedItems.length === 0) return;

    const groupsBySupplier: Record<string, DraftOrderItem[]> = {};

    for (const item of selectedItems) {
      const supplierName = (item.product.provider && item.product.provider.trim()) || 'Sin Proveedor';
      if (!groupsBySupplier[supplierName]) {
        groupsBySupplier[supplierName] = [];
      }
      groupsBySupplier[supplierName].push({
        productId: item.product.id,
        productName: item.product.name,
        quantityOrdered: item.suggestedQty,
        estimatedCost: item.product.cost || 0,
      });
    }

    const drafts: DraftOrderGroup[] = Object.keys(groupsBySupplier).map((supplierName) => ({
      supplierName,
      items: groupsBySupplier[supplierName],
    }));

    onCreateDraftOrders(drafts);
  };

  if (combinedItems.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                Qué Reabastecer
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                Evaluación de stock mínimo y velocidad de ventas (últimos 30 días)
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
            Inventario Óptimo
          </span>
        </div>
        <div className="mt-4 p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-xs text-emerald-800 font-medium">
          ✅ Todos los productos cuentan con niveles de stock adecuados e inventario superior a 7 días de cobertura.
        </div>
      </div>
    );
  }

  const selectedCount = selectedProductIds.size;

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                Qué Reabastecer
              </h3>
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full uppercase tracking-wider">
                {combinedItems.length} {combinedItems.length === 1 ? 'producto por reabastecer' : 'productos por reabastecer'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Productos bajo mínimo configurado o con menos de 7 días de cobertura según ritmo de ventas
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleGenerateAiSummary}
            disabled={isLoadingAi}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            title="Generar resumen en lenguaje natural usando Gemini"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isLoadingAi ? 'animate-spin' : ''}`} />
            <span>{isLoadingAi ? 'Generando...' : 'Resumen AI'}</span>
          </button>

          <button
            onClick={handleCreateOrders}
            disabled={selectedCount === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Crear Orden ({selectedCount})</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* AI Summary Banner */}
      {aiSummary && (
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl text-xs text-indigo-900 space-y-1 relative">
          <div className="flex items-center gap-1.5 text-indigo-700 font-bold uppercase tracking-wider text-[10px]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Resumen Ejecutivo AI</span>
          </div>
          <p className="leading-relaxed font-medium">{aiSummary}</p>
        </div>
      )}

      {aiError && (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-medium">
          {aiError}
        </div>
      )}

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="space-y-3 pt-2">
          {/* Table Toolbar */}
          <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 font-bold hover:text-slate-800 transition-colors cursor-pointer"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {allSelected ? 'Desmarcar todos' : 'Seleccionar todos los productos'}
              </span>
            </button>
            <span className="text-[11px] font-semibold text-slate-400">
              {selectedCount} de {combinedItems.length} seleccionados
            </span>
          </div>

          {/* List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleItems.map((item) => {
              const isSelected = selectedProductIds.has(item.product.id);
              const coverageDays = item.daysOfCoverage;
              const isVeryUrgent = coverageDays <= 2 || item.stock <= 0;

              return (
                <div
                  key={item.product.id}
                  onClick={() => toggleSelect(item.product.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                    isSelected
                      ? 'border-indigo-300 bg-indigo-50/20 shadow-2xs'
                      : 'border-slate-200/80 bg-slate-50/50 hover:bg-white'
                  }`}
                >
                  {/* Top row */}
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.product.id);
                      }}
                      className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-600 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </button>

                    <div className="text-xl shrink-0">{item.product.emoji || '📦'}</div>

                    <div className="min-w-0 flex-1">
                      <h4 
                        onClick={(e) => {
                          if (onNavigateToProduct) {
                            e.stopPropagation();
                            onNavigateToProduct(item.product.id);
                          }
                        }}
                        className={`text-xs font-bold text-slate-800 truncate ${onNavigateToProduct ? 'hover:text-indigo-600 hover:underline' : ''}`}
                      >
                        {item.product.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                        <span>{item.product.category}</span>
                        {item.product.provider && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 truncate">{item.product.provider}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges for Reasons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {item.isLowStock && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-md text-[9px] font-black uppercase flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                        <span>Bajo mínimo ({item.stock}/{item.minStock || 0})</span>
                      </span>
                    )}
                    {item.isHighPace && (
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-md text-[9px] font-black uppercase flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                        <span>Rotación alta ({coverageDays.toFixed(1)}d)</span>
                      </span>
                    )}
                  </div>

                  {/* Stock & Metrics */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100/80 text-[11px]">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">
                        Stock Actual
                      </span>
                      <span className={`font-mono font-bold ${item.stock <= 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {item.stock} unids
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">
                        Cobertura
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-black ${
                          coverageDays === Infinity
                            ? 'text-slate-500'
                            : isVeryUrgent
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }`}
                      >
                        <Clock className="w-3 h-3 shrink-0" />
                        {coverageDays === Infinity ? 'N/A' : `${coverageDays.toFixed(1)} días`}
                      </span>
                    </div>
                  </div>

                  {/* Suggested Quantity Callout */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">
                      Sugerido pedir:
                    </span>
                    <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                      {item.suggestedQty} unids
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show More Toggle */}
          {combinedItems.length > 6 && (
            <div className="text-center pt-2">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{showAll ? 'Mostrar menos' : `Ver los ${combinedItems.length} productos por reabastecer`}</span>
                {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* Bottom Action bar */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500 font-medium text-center sm:text-left">
              Selecciona productos para generar borradores de Orden de Compra por proveedor.
            </div>

            <button
              onClick={handleCreateOrders}
              disabled={selectedCount === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>Crear Orden de Compra con la selección ({selectedCount})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
