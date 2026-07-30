import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Product, Category, DashboardConfig, ProductPackaging } from '../../types';
import { getPreTaxAmount, roundCents } from '../../lib/money';
import { matchesProductSearch } from '../../lib/search';
import { firestoreService } from '../../lib/firebase';
import { useAlert } from '../../context/AlertContext';
import { CategoryPicker } from '../CategoryPicker';
import { getListPrice } from '../../lib/priceLists';
import {
  Search,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  ShoppingBag,
  ArrowRight,
  X,
  Tags,
  Users,
  Package,
  Check,
  Info,
} from 'lucide-react';

interface StockAddTabProps {
  products: Product[];
  categories?: Category[];
  dashboardConfig?: DashboardConfig;
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
  updatedPackagings?: ProductPackaging[];
}

export const StockAddTab: React.FC<StockAddTabProps> = ({
  products,
  categories,
  dashboardConfig,
  onBatchSuccess,
}) => {
  const { showAlert } = useAlert();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addQuantityInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  // Auto focus search input when tab is opened
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Form fields for the selected product
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [profitPercent, setProfitPercent] = useState('');
  const [addQuantity, setAddQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  // Packagings state and edits for selected product
  const [currentPackagings, setCurrentPackagings] = useState<ProductPackaging[]>([]);
  const [pkgEdits, setPkgEdits] = useState<Record<string, string>>({});
  const [appliedPkgIds, setAppliedPkgIds] = useState<Set<string>>(new Set());

  // Staged items list (right panel)
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filter products by search query and category for selection
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() && (selectedCategory === 'all' || !selectedCategory)) return [];
    return products
      .filter((prod) => {
        const matchesCat = selectedCategory === 'all' || !selectedCategory || prod.category === selectedCategory;
        if (!matchesCat) return false;
        if (!searchQuery.trim()) return true;
        return matchesProductSearch(prod, searchQuery);
      })
      .slice(0, 8);
  }, [products, searchQuery, selectedCategory]);

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setCost(prod.cost != null ? prod.cost.toString() : '');
    setPrice(prod.price != null ? prod.price.toString() : '');
    setProfitPercent(prod.profitPercent != null ? prod.profitPercent.toString() : '');
    setAddQuantity('');
    setExpirationDate(prod.expirationDate || '');
    setSearchQuery(''); // clear search query after select
    setCurrentPackagings(prod.packagings ? JSON.parse(JSON.stringify(prod.packagings)) : []);
    setPkgEdits({});
    setAppliedPkgIds(new Set());
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const cleanQuery = searchQuery.trim();
    if (!cleanQuery) return;

    // Filter products by selected category if selected
    const candidateProducts = products.filter((prod) => {
      return selectedCategory === 'all' || !selectedCategory || prod.category === selectedCategory;
    });

    const cleanQueryCode = cleanQuery.replace(/^0+/, '');

    // 1. Search exact code/barcode/SKU/id match
    const exactMatch = candidateProducts.find((p) => {
      const cleanBarcode = p.barcode ? p.barcode.trim().replace(/^0+/, '') : '';
      const cleanCode = p.code ? p.code.trim().replace(/^0+/, '') : '';
      const cleanId = p.id ? p.id.trim().replace(/^0+/, '') : '';
      const cleanSku = p.sku ? p.sku.trim().replace(/^0+/, '') : '';
      return (
        (cleanBarcode && cleanBarcode === cleanQueryCode) ||
        (cleanCode && cleanCode === cleanQueryCode) ||
        (cleanId && cleanId === cleanQueryCode) ||
        (cleanSku && cleanSku === cleanQueryCode)
      );
    });

    if (exactMatch) {
      handleSelectProduct(exactMatch);
      setSearchQuery('');
      setTimeout(() => {
        addQuantityInputRef.current?.focus();
      }, 50);
      return;
    }

    // 2. Search text matches if no exact code match
    const textMatches = candidateProducts.filter((p) => matchesProductSearch(p, cleanQuery));

    if (textMatches.length === 1) {
      handleSelectProduct(textMatches[0]);
      setSearchQuery('');
      setTimeout(() => {
        addQuantityInputRef.current?.focus();
      }, 50);
    } else if (textMatches.length === 0) {
      setSearchQuery('');
      showToast(`Producto no encontrado: ${cleanQuery}`);
    } else {
      // More than 1 match -> keep list open for manual selection or further typing
    }
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
      const calculatedPricePreTax = parsedCost * (1 + parsedProfit / 100);
      const calculatedPriceWithTax = selectedProduct?.taxExempt
        ? calculatedPricePreTax
        : calculatedPricePreTax * 1.18;
      setPrice(calculatedPriceWithTax.toFixed(2));
    }
  };

  // Calculations for Precios Relacionados preview
  const draftCostNum = cost !== '' ? parseFloat(cost) : selectedProduct?.cost || 0;
  const draftPriceNum = price !== '' ? parseFloat(price) : selectedProduct?.price || 0;

  const draftProductForLists: Product = useMemo(() => {
    if (!selectedProduct) return {} as Product;
    return {
      ...selectedProduct,
      cost: !isNaN(draftCostNum) ? draftCostNum : selectedProduct.cost || 0,
      price: !isNaN(draftPriceNum) ? draftPriceNum : selectedProduct.price || 0,
    };
  }, [selectedProduct, draftCostNum, draftPriceNum]);

  const clientPriceLists = useMemo(() => {
    return dashboardConfig?.clientPriceLists || [];
  }, [dashboardConfig?.clientPriceLists]);

  const hasPackagings = Boolean(selectedProduct?.packagings && selectedProduct.packagings.length > 0);
  const hasPriceLists = Boolean(clientPriceLists.length > 0);
  const showRelatedPrices = Boolean(selectedProduct && (hasPackagings || hasPriceLists));

  const computeSuggestedPackagingPrice = useCallback(
    (pkg: ProductPackaging, oldUnitPrice: number, newUnitPrice: number): number => {
      if (oldUnitPrice > 0 && newUnitPrice > 0) {
        const ratio = newUnitPrice / oldUnitPrice;
        return roundCents(pkg.price * ratio);
      }
      if (newUnitPrice > 0) {
        return roundCents(newUnitPrice * pkg.unitsPerPackage);
      }
      return pkg.price;
    },
    []
  );

  const handleApplySinglePackaging = (pkgId: string, valueStr: string) => {
    const valNum = parseFloat(valueStr);
    if (isNaN(valNum) || valNum < 0) return;

    setCurrentPackagings((prev) =>
      prev.map((p) => (p.id === pkgId ? { ...p, price: roundCents(valNum) } : p))
    );
    setAppliedPkgIds((prev) => {
      const next = new Set(prev);
      next.add(pkgId);
      return next;
    });
  };

  const handleApplyAllPackagings = () => {
    if (!selectedProduct || !selectedProduct.packagings) return;
    const oldUnitPrice = selectedProduct.price || 0;
    const newUnitPrice = !isNaN(draftPriceNum) ? draftPriceNum : oldUnitPrice;

    const nextPackagings = currentPackagings.map((pkg) => {
      const origPkg = selectedProduct.packagings?.find((p) => p.id === pkg.id) || pkg;
      const suggested = computeSuggestedPackagingPrice(origPkg, oldUnitPrice, newUnitPrice);
      const valStr = pkgEdits[pkg.id] !== undefined ? pkgEdits[pkg.id] : suggested.toString();
      const valNum = parseFloat(valStr);
      return {
        ...pkg,
        price: !isNaN(valNum) && valNum >= 0 ? roundCents(valNum) : pkg.price,
      };
    });

    setCurrentPackagings(nextPackagings);
    setAppliedPkgIds(new Set(nextPackagings.map((p) => p.id)));
  };

  const handleAddToStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qty = parseInt(addQuantity);
    if (isNaN(qty) || qty <= 0) {
      await showAlert('Cantidad Inválida', 'Ingresa una cantidad válida mayor a 0', 'warning');
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
      updatedPackagings: currentPackagings.length > 0 ? currentPackagings : undefined,
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
          updatedPackagings:
            currentPackagings.length > 0 ? currentPackagings : updated[existingIdx].updatedPackagings,
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
    setAddQuantity('');
    setExpirationDate('');
    setCurrentPackagings([]);
    setPkgEdits({});
    setAppliedPkgIds(new Set());

    // Focus back on search input for fast keyboard loop
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
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
        if (item.updatedPackagings) updateData.packagings = item.updatedPackagings;

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

  const oldUnitPrice = selectedProduct?.price || 0;
  const newUnitPrice = !isNaN(draftPriceNum) ? draftPriceNum : oldUnitPrice;

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-100 overflow-hidden">
      {/* LEFT PANEL: Search and Product staging form */}
      <div className="flex-1 p-6 bg-white border-r border-slate-200 overflow-y-auto space-y-6">
        {/* Large search query and category picker */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Categoría / Dpto
              </label>
              <CategoryPicker
                value={selectedCategory}
                onChange={setSelectedCategory}
                categories={categories}
                products={products}
                placeholder="Todas..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Buscar Producto para Sumar Stock
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="MAYÚSCULAS O ESCÁNER..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl text-sm font-black text-slate-800 focus:outline-none transition-all placeholder:text-slate-400 uppercase"
                />
              </div>
            </div>
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
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{prod.emoji || '🏷️'}</span>
                    <div className="min-w-0">
                      <h5 className="text-xs font-black text-slate-800 uppercase truncate" title={prod.name}>
                        {prod.name}
                      </h5>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">
                        Cód: {prod.code || prod.barcode || prod.id} | Stock: {prod.stock}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Product form */}
        {selectedProduct ? (
          <form
            onSubmit={handleAddToStage}
            className="p-5 border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl space-y-4 animate-fade-in"
          >
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
                  ref={addQuantityInputRef}
                  type="number"
                  required
                  min="1"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const qty = parseInt(addQuantity);
                      if (isNaN(qty) || qty <= 0) {
                        addQuantityInputRef.current?.focus();
                        return;
                      }
                      handleAddToStage(e);
                    }
                  }}
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

            {/* SECCIÓN PRECIOS RELACIONADOS */}
            {showRelatedPrices && (
              <div className="mt-4 pt-4 border-t border-indigo-200/60 space-y-4">
                <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs uppercase tracking-wider">
                  <Tags className="w-4 h-4 text-indigo-600" />
                  <span>Precios Relacionados (Previsualización)</span>
                </div>

                {/* SUB-SECCIÓN LISTAS DE CLIENTES */}
                {hasPriceLists && (
                  <div className="p-3 bg-white/90 border border-indigo-100 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Listas de Clientes</span>
                      </span>
                      <span className="text-[10px] text-slate-400 italic">Informativo</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {clientPriceLists.map((list) => {
                        const listPrice = getListPrice(draftProductForLists, list);
                        return (
                          <div
                            key={list.id}
                            className="p-2 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between"
                          >
                            <div>
                              <p className="text-[11px] font-black text-slate-800">{list.name}</p>
                              <p className="text-[9px] text-slate-400 font-medium">
                                Margen: +{list.profitPercent}%
                              </p>
                            </div>
                            <span className="text-xs font-black text-indigo-700 font-mono">
                              RD$ {listPrice.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium flex items-center gap-1 mt-1">
                      <Info className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Estos precios se recalculan automáticamente, no requieren acción.</span>
                    </p>
                  </div>
                )}

                {/* SUB-SECCIÓN EMPAQUES */}
                {hasPackagings && (
                  <div className="p-3 bg-white/90 border border-indigo-100 rounded-xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Empaques</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyAllPackagings}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Aplicar a todos los empaques</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {currentPackagings.map((pkg) => {
                        const origPkg = selectedProduct.packagings?.find((p) => p.id === pkg.id) || pkg;
                        const suggested = computeSuggestedPackagingPrice(origPkg, oldUnitPrice, newUnitPrice);
                        const currentInputValue =
                          pkgEdits[pkg.id] ?? (suggested !== undefined && !isNaN(suggested) ? suggested.toString() : '');
                        const isApplied = appliedPkgIds.has(pkg.id);

                        return (
                          <div
                            key={pkg.id}
                            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <h6 className="text-[11px] font-black text-slate-800">{pkg.name}</h6>
                                <p className="text-[10px] text-slate-400 font-medium">
                                  Contiene {pkg.unitsPerPackage} pza{pkg.unitsPerPackage !== 1 ? 's' : ''} |
                                  Guardado: <span className="font-bold text-slate-600">RD$ {pkg.price.toFixed(2)}</span>
                                </p>
                              </div>
                              {isApplied && (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                  <Check className="w-2.5 h-2.5" /> Aplicado
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                  Precio Sugerido / Editado ($)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={currentInputValue}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPkgEdits((prev) => ({ ...prev, [pkg.id]: val }));
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleApplySinglePackaging(pkg.id, currentInputValue)}
                                className="self-end px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all shadow-xs"
                              >
                                Aplicar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

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
            <p className="text-[10px] text-slate-400 mt-1">
              Podrás editar sus costos de compra, precio de venta, margen y fecha de vencimiento al sumarlo.
            </p>
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
              <p className="text-[10px] text-slate-400 mt-0.5">
                Agrega productos desde el panel izquierdo para procesar en lote.
              </p>
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
                  {item.updatedPackagings && item.updatedPackagings.length > 0 && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                      <Package className="w-2.5 h-2.5" /> Empaques actualizados
                    </span>
                  )}
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
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                notification.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-150'
                  : 'bg-rose-50 text-rose-800 border-rose-150'
              }`}
            >
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

      {/* Floating Non-blocking Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center gap-2.5 text-xs font-bold animate-fade-in backdrop-blur-md pointer-events-none">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
