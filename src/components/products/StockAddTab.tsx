import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { getPreTaxAmount } from '../../lib/money';
import { matchesProductSearch } from '../../lib/search';
import { firestoreService } from '../../lib/firebase';
import { useAlert } from '../../context/AlertContext';
import { Search, Plus, Trash2, CheckCircle, AlertCircle, ShoppingBag, ArrowRight, X } from 'lucide-react';

interface StockAddTabProps {
  products: Product[];
  onBatchSuccess: () => void;
}

interface StagedItem {
  id: string;
  product: Product;
  addQuantity: number;
  cost: number;
  price: number;
  profitPercent: number;
  expirationDate: string;
}

export const StockAddTab: React.FC<StockAddTabProps> = ({ products, onBatchSuccess }) => {
  const { showAlert } = useAlert();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form fields for the selected product
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [profitPercent, setProfitPercent] = useState('');
  const [addQuantity, setAddQuantity] = useState('10');
  const [expirationDate, setExpirationDate] = useState('');

  // Staged items list (right panel)
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filter products by search query for selection
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return products.filter((prod) => matchesProductSearch(prod, searchQuery)).slice(0, 5);
  }, [products, searchQuery]);

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setCost(prod.cost !== undefined ? prod.cost.toString() : '');
    setPrice(prod.price !== undefined ? prod.price.toString() : '');
    setProfitPercent(prod.profitPercent !== undefined ? prod.profitPercent.toString() : '');
    setAddQuantity('10');
    setExpirationDate(prod.expirationDate || '');
    setSearchQuery(''); // clear search query after select
  };

  // Bidirectional calculations
  const handleCostChange = (val: string) => {
    setCost(val);
    const parsedCost = parseFloat(val);
    const parsedPrice = parseFloat(price);
    if (!isNaN(parsedCost) && !isNaN(parsedPrice) && parsedCost > 0) {
      const pricePreTax = getPreTaxAmount(parsedPrice, selectedProduct?.taxExempt);
      const margin = ((pricePreTax - parsedCost) / parsedCost) * 100;
      setProfitPercent(margin.toFixed(1));
    }
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    const parsedPrice = parseFloat(val);
    const parsedCost = parseFloat(cost);
    if (!isNaN(parsedPrice) && !isNaN(parsedCost) && parsedCost > 0) {
      const pricePreTax = getPreTaxAmount(parsedPrice, selectedProduct?.taxExempt);
      const margin = ((pricePreTax - parsedCost) / parsedCost) * 100;
      setProfitPercent(margin.toFixed(1));
    }
  };

  const handleProfitChange = (val: string) => {
    setProfitPercent(val);
    const parsedProfit = parseFloat(val);
    const parsedCost = parseFloat(cost);
    if (!isNaN(parsedProfit) && !isNaN(parsedCost) && parsedCost >= 0) {
      const calculatedPricePreTax = parsedCost * (1 + (parsedProfit / 100));
      const calculatedPriceWithTax = selectedProduct?.taxExempt ? calculatedPricePreTax : calculatedPricePreTax * 1.18;
      setPrice(calculatedPriceWithTax.toFixed(2));
    }
  };

  const handleAddToStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qty = parseInt(addQuantity);
    if (isNaN(qty) || qty <= 0) {
      await showAlert(
        'Cantidad Inválida',
        'Ingresa una cantidad válida mayor a 0',
        'warning'
      );
      return;
    }

    const parsedCost = cost ? parseFloat(cost) : 0;
    const parsedPrice = price ? parseFloat(price) : selectedProduct.price;
    const parsedProfit = profitPercent ? parseFloat(profitPercent) : 0;

    const newItem: StagedItem = {
      id: crypto.randomUUID(),
      product: selectedProduct,
      addQuantity: qty,
      cost: parsedCost,
      price: parsedPrice,
      profitPercent: parsedProfit,
      expirationDate: expirationDate,
    };

    setStagedItems((prev) => {
      // Avoid duplicate product in staging, combine them if necessary or list them separate
      const existingIdx = prev.findIndex((item) => item.product.id === selectedProduct.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          addQuantity: updated[existingIdx].addQuantity + qty,
          cost: parsedCost || updated[existingIdx].cost,
          price: parsedPrice || updated[existingIdx].price,
          profitPercent: parsedProfit || updated[existingIdx].profitPercent,
          expirationDate: expirationDate || updated[existingIdx].expirationDate,
        };
        return updated;
      }
      return [...prev, newItem];
    });

    // Reset selection
    setSelectedProduct(null);
    setCost('');
    setPrice('');
    setProfitPercent('');
    setAddQuantity('10');
    setExpirationDate('');
  };

  const handleRemoveStaged = (id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearStaged = () => {
    setStagedItems([]);
  };

  const handleProcessBatch = async () => {
    if (stagedItems.length === 0) return;
    setIsProcessing(true);
    setNotification(null);

    try {
      const operations: Array<{
        type: 'set' | 'update' | 'delete';
        collectionName: string;
        id: string;
        data?: any;
        merge?: boolean;
      }> = [];

      for (const item of stagedItems) {
        // Find current stock in fresh products list (or item.product.stock)
        const freshProd = products.find((p) => p.id === item.product.id) || item.product;
        const newStock = freshProd.stock + item.addQuantity;

        const updateData: any = {
          stock: newStock,
        };

        if (item.cost > 0) updateData.cost = item.cost;
        if (item.price > 0) updateData.price = item.price;
        if (item.profitPercent > 0) updateData.profitPercent = item.profitPercent;
        if (item.expirationDate) updateData.expirationDate = item.expirationDate;

        operations.push({
          type: 'update',
          collectionName: 'products',
          id: item.product.id,
          data: updateData,
        });
      }

      await firestoreService.runBatch(operations);
      
      setNotification({
        message: `¡Éxito! Se incrementó el stock de ${stagedItems.length} productos correctamente.`,
        type: 'success',
      });
      setStagedItems([]);
      onBatchSuccess();
    } catch (err: any) {
      console.error('Error in batch inventory add:', err);
      setNotification({
        message: 'Hubo un error al procesar el lote: ' + (err.message || String(err)),
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-100 overflow-hidden">
      
      {/* LEFT PANEL: Search and Product staging form */}
      <div className="flex-1 p-6 bg-white border-r border-slate-200 overflow-y-auto space-y-6">
        
        {/* Large search query */}
        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">
            Buscar Producto para Sumar Stock
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="MAYÚSCULAS O ESCÁNER..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-2xl text-md font-black text-slate-800 focus:outline-none transition-all placeholder:text-slate-400 uppercase"
            />
          </div>

          {/* Quick autocomplete dropdown/results list */}
          {searchResults.length > 0 && (
            <div className="border border-slate-200 rounded-2xl bg-white shadow-lg overflow-hidden divide-y divide-slate-100">
              {searchResults.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleSelectProduct(prod)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{prod.emoji || '🏷️'}</span>
                    <div>
                      <h5 className="text-xs font-black text-slate-800">{prod.name}</h5>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">
                        Cód: {prod.code || prod.barcode || prod.id} | Stock: {prod.stock}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Product form */}
        {selectedProduct ? (
          <form onSubmit={handleAddToStage} className="p-5 border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl space-y-4 animate-fade-in">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <span className="text-3xl w-12 h-12 bg-white border border-slate-150 rounded-xl flex items-center justify-center shadow-sm">
                  {selectedProduct.emoji || '🏷️'}
                </span>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">{selectedProduct.name}</h4>
                  <span className="text-[10px] text-indigo-600 font-bold font-mono">
                    SKU: {selectedProduct.sku || 'N/D'} | Stock actual: {selectedProduct.stock}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-full border border-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Costo de Compra ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cost}
                  onChange={(e) => handleCostChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Ganancia %
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={profitPercent}
                  onChange={(e) => handleProfitChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Precio de Venta ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Cantidad a Agregar *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Vencimiento (Opcional)
                </label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/10"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar a la lista temporal</span>
            </button>
          </form>
        ) : (
          <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-6">
            <ShoppingBag className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-extrabold text-slate-500">Busca y selecciona un producto arriba para comenzar</p>
            <p className="text-[10px] text-slate-400 mt-1">Podrás editar sus costos de compra, precio de venta, margen y fecha de vencimiento al sumarlo.</p>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: List of staged item to commit */}
      <div className="w-full md:w-[400px] bg-slate-50 p-6 flex flex-col min-h-0">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200 shrink-0">
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1">
              <span>Lote a Incrementar</span>
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md text-[10px] font-black">
                {stagedItems.length}
              </span>
            </h4>
            <p className="text-[10px] text-slate-400">Cambios pendientes por aplicar</p>
          </div>
          {stagedItems.length > 0 && (
            <button
              onClick={handleClearStaged}
              className="text-[10px] font-black text-rose-600 hover:text-rose-800 hover:underline uppercase tracking-wider cursor-pointer"
            >
              Limpiar todo
            </button>
          )}
        </div>

        {/* List scrollable */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
          {stagedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <ShoppingBag className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-extrabold text-slate-500">Lista de lote vacía</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Agrega productos desde el panel izquierdo para procesar en lote.</p>
            </div>
          ) : (
            stagedItems.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white border border-slate-200 rounded-xl flex justify-between items-center gap-3 hover:border-indigo-150 transition-all shadow-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg shrink-0">{item.product.emoji || '🏷️'}</span>
                    <h5 className="text-xs font-black text-slate-800 truncate" title={item.product.name}>
                      {item.product.name}
                    </h5>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Cód: {item.product.code || item.product.barcode || item.product.id}
                  </p>
                  <p className="text-[10px] text-indigo-600 font-bold mt-1">
                    Costo: ${item.cost.toFixed(2)} | Venta: ${item.price.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg border border-indigo-100">
                      +{item.addQuantity}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveStaged(item.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                    title="Quitar del lote"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Process button */}
        <div className="pt-4 border-t border-slate-200 bg-slate-50 shrink-0 space-y-3">
          {notification && (
            <div className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
              notification.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-150' 
                : 'bg-rose-50 text-rose-800 border-rose-150'
            }`}>
              {notification.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              )}
              <span>{notification.message}</span>
            </div>
          )}

          <button
            onClick={handleProcessBatch}
            disabled={stagedItems.length === 0 || isProcessing}
            className={`w-full py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
              stagedItems.length === 0 || isProcessing
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-slate-900 hover:bg-slate-850 text-white shadow-slate-900/10'
            }`}
          >
            {isProcessing ? (
              <span>Procesando...</span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Procesar e Incrementar Stock</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
};
