import React, { useState, useEffect, useMemo } from 'react';
import { Product, Category, DashboardConfig, ProductPackaging } from '../../types';
import { getPreTaxAmount, getCategoryProfitTarget } from '../../lib/money';
import { SupplierPicker } from '../SupplierPicker';
import { Check, X, Tag, Barcode, DollarSign, Percent, Folder, Plus, ShoppingBag, AlertTriangle, Sparkles, TrendingUp, Package, Trash2 } from 'lucide-react';

interface ProductFormTabProps {
  id: string | null;
  products: Product[];
  categories: Category[];
  dashboardConfig?: DashboardConfig;
  onSuccess: (product: Product) => void;
  onCancel: () => void;
}

const EMOJI_OPTIONS = ['📦', '🧴', '🧵', '🧺', '💄', '🧽', '🔌', '🪒', '🧻', '👕', '🎀', '🖊️', '🏷️', '🛍️', '👟', '🕶️', '💊', '🔋', '🛠️', '📱', '📚', '🧼', '🧸', '💡', '🎒', '🧢', '🔑', '🍳', '🥣', '🛒'];

export const ProductFormTab: React.FC<ProductFormTabProps> = ({
  id,
  products,
  categories,
  dashboardConfig,
  onSuccess,
  onCancel,
}) => {
  const isEditing = id !== null;

  // Form Fields
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [code, setCode] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');

  const suggestedTargetProfit = useMemo(() => {
    return getCategoryProfitTarget(category, dashboardConfig?.categoryProfitTargets, categories);
  }, [category, dashboardConfig?.categoryProfitTargets, categories]);
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [profitPercent, setProfitPercent] = useState('');
  const [stock, setStock] = useState('');
  const [emoji, setEmoji] = useState('📦');
  const [imageUrl, setImageUrl] = useState('');
  const [imageType, setImageType] = useState<'emoji' | 'url'>('emoji');
  const [provider, setProvider] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [taxExempt, setTaxExempt] = useState(false);
  const [packagings, setPackagings] = useState<ProductPackaging[]>([]);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgUnits, setNewPkgUnits] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  // AI Category Suggestion State
  const [aiSuggestedCategory, setAiSuggestedCategory] = useState<string | null>(null);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);

  // Load product if editing
  useEffect(() => {
    if (isEditing && id) {
      const prod = products.find((p) => p.id === id);
      if (prod) {
        setName(prod.name || '');
        setBarcode(prod.barcode || '');
        setCode(prod.code || '');
        setSku(prod.sku || '');
        setCost(prod.cost != null ? prod.cost.toString() : '');
        setPrice(prod.price != null ? prod.price.toString() : '');
        setProfitPercent(prod.profitPercent != null ? prod.profitPercent.toString() : '');
        setCategory(prod.category || '');
        setStock(prod.stock != null ? prod.stock.toString() : '0');
        setEmoji(prod.emoji || '📦');
        setImageUrl(prod.imageUrl || '');
        setImageType(prod.imageUrl ? 'url' : 'emoji');
        setProvider(prod.provider || '');
        setExpirationDate(prod.expirationDate || '');
        setTaxExempt(!!prod.taxExempt);
        setPackagings(prod.packagings || []);
      }
    } else {
      // Set defaults for new product
      setName('');
      setBarcode('');
      setCode('');
      setSku('');
      setCost('');
      setPrice('');
      setProfitPercent('');
      setCategory(categories.filter((c) => c.id !== 'all')[0]?.id || 'otros');
      setStock('');
      setEmoji('📦');
      setImageUrl('');
      setImageType('emoji');
      setProvider('');
      setExpirationDate('');
      setTaxExempt(false);
      setPackagings([]);
    }
    setNewPkgName('');
    setNewPkgUnits('');
    setNewPkgPrice('');
    setError(null);
  }, [id, isEditing, products, categories]);

  // AI Category suggestion effect (~800ms debounce)
  useEffect(() => {
    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      setAiSuggestedCategory(null);
      setIsSuggestingCategory(false);
      return;
    }

    setIsSuggestingCategory(true);
    const timer = setTimeout(async () => {
      try {
        const activeCats = categories
          .filter((c) => c.id !== 'all')
          .map((c) => ({ id: c.id, name: c.name }));

        const res = await fetch('/api/suggest-category', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productName: trimmedName, categories: activeCats }),
        });

        if (!res.ok) {
          throw new Error('Failed to get AI category suggestion');
        }

        const data = await res.json();
        if (data.suggestion) {
          setAiSuggestedCategory(data.suggestion);
        } else {
          setAiSuggestedCategory(null);
        }
      } catch (err) {
        console.warn('AI category suggestion failed:', err);
        setAiSuggestedCategory(null);
      } finally {
        setIsSuggestingCategory(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [name, categories]);

  const handleApplyAiCategory = () => {
    if (!aiSuggestedCategory) return;
    const matched = categories.find(
      (c) => c.id.toLowerCase() === aiSuggestedCategory.toLowerCase() ||
             c.name.toLowerCase() === aiSuggestedCategory.toLowerCase()
    );
    if (matched) {
      setCategory(matched.id);
    } else {
      setCategory(aiSuggestedCategory);
    }
  };

  // Real-time check for duplicate barcode or code
  const barcodeDuplicate = useMemo(() => {
    const clean = barcode.trim().toUpperCase();
    if (!clean) return null;
    return products.find((p) =>
      (!isEditing || p.id !== id) &&
      ((p.barcode && p.barcode.trim().toUpperCase() === clean) ||
       (p.code && p.code.trim().toUpperCase() === clean))
    );
  }, [barcode, products, isEditing, id]);

  const codeDuplicate = useMemo(() => {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    return products.find((p) =>
      (!isEditing || p.id !== id) &&
      ((p.barcode && p.barcode.trim().toUpperCase() === clean) ||
       (p.code && p.code.trim().toUpperCase() === clean))
    );
  }, [code, products, isEditing, id]);

  // Recalculations
  const handleCostChange = (val: string) => {
    setCost(val);
    const parsedCost = parseFloat(val);
    const parsedPrice = parseFloat(price);
    
    if (!isNaN(parsedCost) && !isNaN(parsedPrice) && parsedCost > 0) {
      const pricePreTax = getPreTaxAmount(parsedPrice, taxExempt);
      const margin = ((pricePreTax - parsedCost) / parsedCost) * 100;
      setProfitPercent(margin.toFixed(1));
    }
  };

  const handlePriceChange = (val: string) => {
    setPrice(val);
    const parsedPrice = parseFloat(val);
    const parsedCost = parseFloat(cost);
    
    if (!isNaN(parsedPrice) && !isNaN(parsedCost) && parsedCost > 0) {
      const pricePreTax = getPreTaxAmount(parsedPrice, taxExempt);
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
      const calculatedPriceWithTax = taxExempt ? calculatedPricePreTax : calculatedPricePreTax * 1.18;
      setPrice(calculatedPriceWithTax.toFixed(2));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre del producto es obligatorio');
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError('Por favor, ingresa un precio de venta válido');
      return;
    }

    const parsedCost = cost ? parseFloat(cost) : undefined;
    if (parsedCost !== undefined && (isNaN(parsedCost) || parsedCost < 0)) {
      setError('Por favor, ingresa un costo válido');
      return;
    }

    if (parsedCost !== undefined && parsedPrice < parsedCost) {
      setError('No se puede guardar el producto: El precio de venta no puede ser inferior al costo de compra (margen de ganancia negativo).');
      return;
    }

    const cleanBarcode = barcode.trim();
    const cleanCode = code.trim();

    // Block saving if barcode is duplicate
    if (cleanBarcode && barcodeDuplicate) {
      setError(`Este código de barras ya está en uso por ${barcodeDuplicate.name}`);
      return;
    }

    if (cleanCode && codeDuplicate) {
      setError(`Este código de barras ya está en uso por ${codeDuplicate.name}`);
      return;
    }

    const parsedProfit = profitPercent ? parseFloat(profitPercent) : undefined;
    const parsedStock = stock.trim() === '' ? 0 : (parseInt(stock) || 0);

    // Auto-generate 12-digit barcode if field is left empty
    let finalBarcode = cleanBarcode;
    let finalCode = cleanCode;

    if (!finalBarcode && !finalCode) {
      let generated = '';
      let exists = true;
      while (exists) {
        generated = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        exists = products.some((p) => p.barcode === generated || p.code === generated);
      }
      finalBarcode = generated;
      finalCode = generated;
    } else if (!finalBarcode && finalCode) {
      finalBarcode = finalCode;
    } else if (finalBarcode && !finalCode) {
      finalCode = finalBarcode;
    }

    // Setup colors
    const colors = [
      'bg-amber-50 text-amber-800 border-amber-200',
      'bg-red-50 text-red-800 border-red-200',
      'bg-blue-50 text-blue-800 border-blue-200',
      'bg-green-50 text-green-800 border-green-200',
      'bg-pink-50 text-pink-800 border-pink-200',
      'bg-yellow-50 text-yellow-800 border-yellow-200',
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const updatedProduct: Product = {
      id: isEditing && id ? id : 'custom-' + crypto.randomUUID(),
      name: name.trim(),
      price: parsedPrice,
      category,
      stock: parsedStock,
      color: isEditing && id ? (products.find(p => p.id === id)?.color || randomColor) : randomColor,
      emoji: emoji || '🏷️',
      imageUrl: imageType === 'url' && imageUrl.trim() ? imageUrl.trim() : undefined,
      barcode: finalBarcode || undefined,
      code: finalCode || undefined,
      sku: sku.trim() || undefined,
      cost: parsedCost,
      profitPercent: parsedProfit,
      provider: provider.trim() || undefined,
      expirationDate: expirationDate || undefined,
      taxExempt,
      packagings: packagings.length > 0 ? packagings : undefined,
    };

    onSuccess(updatedProduct);

    // If creating new product, clear form so user can enter another product without changing tabs
    if (!isEditing) {
      setName('');
      setBarcode('');
      setCode('');
      setSku('');
      setCost('');
      setPrice('');
      setProfitPercent('');
      setCategory(categories.filter((c) => c.id !== 'all')[0]?.id || 'otros');
      setStock('');
      setEmoji('📦');
      setImageUrl('');
      setImageType('emoji');
      setProvider('');
      setExpirationDate('');
      setTaxExempt(false);
      setPackagings([]);
      setNewPkgName('');
      setNewPkgUnits('');
      setNewPkgPrice('');
      setError(null);
      setAiSuggestedCategory(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-white p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
            {isEditing ? 'Editar Producto' : 'Crear Nuevo Producto'}
          </h3>
          <p className="text-xs text-slate-400">Introduce las propiedades y costos del producto</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl cursor-pointer"
        >
          Cancelar
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Side: General Info */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
              Nombre del Producto *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Detergente Líquido Multiusos"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Categoría principal *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-850 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all cursor-pointer"
              >
                {category && !categories.some(c => c.id === category || c.name.toLowerCase() === category.toLowerCase()) && (
                  <option value={category}>
                    ✨ {category}
                  </option>
                )}
                {categories
                  .filter((c) => c.id !== 'all')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
              </select>

              {/* AI Category Suggestion Chip */}
              {isSuggestingCategory && (
                <p className="text-[10px] text-indigo-500 font-bold mt-1.5 flex items-center gap-1 animate-pulse">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>Sugerencia IA consultando...</span>
                </p>
              )}

              {!isSuggestingCategory && aiSuggestedCategory && (
                <div className="mt-1.5">
                  <button
                    type="button"
                    onClick={handleApplyAiCategory}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer shadow-2xs group"
                    title="Hacer clic para aplicar esta sugerencia de categoría"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 group-hover:rotate-12 transition-transform shrink-0" />
                    <span>Sugerencia: <strong className="underline decoration-indigo-300">{aiSuggestedCategory}</strong> — usar</span>
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Stock Inicial *
              </label>
              <input
                type="number"
                required
                min="0"
                placeholder="Ej. 0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Código de barras
              </label>
              <input
                type="text"
                placeholder="Escanear o ingresar"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl border ${barcodeDuplicate ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 bg-slate-50'} focus:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all`}
              />
              {barcodeDuplicate && (
                <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Este código de barras ya está en uso por {barcodeDuplicate.name}</span>
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Código Interno
              </label>
              <input
                type="text"
                placeholder="Código POS"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl border ${codeDuplicate ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 bg-slate-50'} focus:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all`}
              />
              {codeDuplicate && (
                <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Este código de barras ya está en uso por {codeDuplicate.name}</span>
                </p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                SKU / Referencia
              </label>
              <input
                type="text"
                placeholder="SKU-XXX"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Proveedor
              </label>
              <SupplierPicker
                value={provider}
                onChange={setProvider}
                products={products}
                placeholder="Distribuidora S.A."
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Fecha Vencimiento
              </label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Bidirectional Margins & Emoji Picker */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-4">
            <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">Cálculo de Margen de Ganancia</h4>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Costo de Compra ($)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-extrabold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={cost}
                    onChange={(e) => handleCostChange(e.target.value)}
                    className="w-full pl-6 pr-2 py-2 rounded-xl border border-slate-200 bg-white focus:bg-white text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Ganancia % (Markup)
                </label>
                <div className="relative">
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-extrabold">%</span>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    value={profitPercent}
                    onChange={(e) => handleProfitChange(e.target.value)}
                    className="w-full pl-2 pr-6 py-2 rounded-xl border border-slate-200 bg-white focus:bg-white text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Precio de Venta ($) *
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-extrabold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className="w-full pl-6 pr-2 py-2 rounded-xl border border-slate-200 bg-white focus:bg-white text-xs font-extrabold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {suggestedTargetProfit !== undefined && (
              <div className="mt-2 text-[11px] font-bold text-indigo-700 bg-indigo-50/80 border border-indigo-200/80 rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-2xs">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Sugerido para esta categoría: <strong>{suggestedTargetProfit}%</strong></span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="taxExempt"
                checked={taxExempt}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setTaxExempt(checked);
                  const parsedCost = parseFloat(cost);
                  const parsedPrice = parseFloat(price);
                  if (!isNaN(parsedCost) && !isNaN(parsedPrice) && parsedCost > 0) {
                    const pricePreTax = getPreTaxAmount(parsedPrice, checked);
                    const margin = ((pricePreTax - parsedCost) / parsedCost) * 100;
                    setProfitPercent(margin.toFixed(1));
                  }
                }}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="taxExempt" className="text-[10px] font-black uppercase text-slate-500 tracking-wider cursor-pointer select-none">
                Exento de ITBIS (18%)
              </label>
            </div>

            {(() => {
              const parsedPrice = parseFloat(price);
              const parsedCost = parseFloat(cost);
              if (!isNaN(parsedPrice) && !isNaN(parsedCost) && parsedPrice < parsedCost) {
                return (
                  <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl flex items-start gap-2.5 text-rose-700 animate-pulse">
                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-rose-600" />
                    <div className="text-[10px] font-bold leading-normal">
                      <p className="uppercase tracking-wide text-rose-800 font-black mb-0.5">¡Margen de Ganancia Negativo!</p>
                      El precio de venta (RD$ {parsedPrice.toFixed(2)}) es inferior al costo de compra (RD$ {parsedCost.toFixed(2)}). Corrija los valores antes de guardar el producto.
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="text-[10px] text-slate-500 font-medium leading-relaxed leading-snug">
              Fórmula aplicada: <code className="bg-slate-200/80 px-1 rounded font-mono text-slate-600 font-bold">Precio = Costo * (1 + %Ganancia/100)</code>. Las modificaciones de cualquier campo actualizarán los otros automáticamente.
            </div>
          </div>

          {/* Media / Representation Selector (Emoji or Photo URL) */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              Imagen o Identificador Visual
            </label>
            
            {/* Type selector tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full max-w-xs">
              <button
                type="button"
                onClick={() => setImageType('emoji')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center ${
                  imageType === 'emoji'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Emoji / Ícono
              </button>
              <button
                type="button"
                onClick={() => setImageType('url')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center ${
                  imageType === 'url'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Foto (Enlace URL)
              </button>
            </div>

            {/* Container */}
            <div className="p-4 border border-slate-150 rounded-2xl bg-slate-50/50 space-y-4">
              {imageType === 'emoji' ? (
                <div className="flex items-center gap-3">
                  <div className="text-3xl w-14 h-14 bg-white border border-slate-250 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                    {emoji}
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1 max-h-28 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-white flex-1 shadow-inner">
                    {EMOJI_OPTIONS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setEmoji(em)}
                        className={`text-lg p-1 rounded-lg transition-all hover:bg-slate-50 flex items-center justify-center cursor-pointer ${
                          emoji === em ? 'bg-slate-100 ring-2 ring-indigo-500 shadow-xs' : ''
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                      URL del enlace de la foto
                    </label>
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/foto.jpg"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all shadow-xs"
                    />
                  </div>

                  {/* Image Live Preview */}
                  <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-150 shadow-inner">
                    <div className="relative w-14 h-14 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {imageUrl.trim() ? (
                        <img
                          src={imageUrl}
                          alt="Vista previa del producto"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // If load fails, replace with a camera/photo emoji placeholder
                            (e.target as HTMLImageElement).style.display = 'none';
                            const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-preview');
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <span className={`fallback-preview text-2xl ${imageUrl.trim() ? 'hidden' : ''}`}>
                        🖼️
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-450 leading-relaxed font-semibold">
                      {imageUrl.trim() ? (
                        <span className="text-emerald-650 font-black">✓ Vista previa cargada</span>
                      ) : (
                        <span>Inserta un enlace HTTP/HTTPS para mostrar una foto real del producto en el catálogo.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full Width Section: Empaques Alternativos */}
        <div className="col-span-1 md:col-span-2 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Empaques Alternativos / Presentaciones</h4>
                <p className="text-[10px] text-slate-400 font-semibold">Configura ventas por caja, pallet o paquete con su equivalencia en unidades y precio del empaque completo.</p>
              </div>
            </div>
          </div>

          {/* Form to add a new packaging */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-white p-3 rounded-xl border border-slate-200">
            <div className="sm:col-span-5">
              <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Nombre del empaque</label>
              <input
                type="text"
                placeholder="Ej. Caja de 12, Pallet de 100"
                value={newPkgName}
                onChange={(e) => setNewPkgName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Unidades por empaque</label>
              <input
                type="number"
                min="1"
                placeholder="Ej. 12"
                value={newPkgUnits}
                onChange={(e) => setNewPkgUnits(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Precio total ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej. 550.00"
                value={newPkgPrice}
                onChange={(e) => setNewPkgPrice(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-1 flex items-end">
              <button
                type="button"
                onClick={() => {
                  if (!newPkgName.trim()) {
                    setError('Ingresa el nombre del empaque (ej. Caja de 12)');
                    return;
                  }
                  const units = parseInt(newPkgUnits);
                  if (isNaN(units) || units <= 0) {
                    setError('Ingresa un número válido de unidades por empaque (mínimo 1)');
                    return;
                  }
                  const pkgPrice = parseFloat(newPkgPrice);
                  if (isNaN(pkgPrice) || pkgPrice < 0) {
                    setError('Ingresa un precio válido para el empaque');
                    return;
                  }

                  const newPackaging: ProductPackaging = {
                    id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    name: newPkgName.trim(),
                    unitsPerPackage: units,
                    price: pkgPrice,
                  };

                  setPackagings((prev) => [...prev, newPackaging]);
                  setNewPkgName('');
                  setNewPkgUnits('');
                  setNewPkgPrice('');
                  setError(null);
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                title="Agregar Empaque"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List of configured packagings */}
          {packagings.length === 0 ? (
            <p className="text-xs text-slate-400 italic font-medium text-center py-2">
              Sin empaques adicionales configurados (se venderá únicamente por unidad individual).
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {packagings.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-indigo-500" />
                      {pkg.name}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      Contiene {pkg.unitsPerPackage} {pkg.unitsPerPackage === 1 ? 'unidad' : 'unidades'} • RD$ {pkg.price.toFixed(2)}
                      {pkg.unitsPerPackage > 0 && (
                        <span className="text-slate-400 ml-1 font-normal">
                          (RD$ {(pkg.price / pkg.unitsPerPackage).toFixed(2)}/u)
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPackagings((prev) => prev.filter((p) => p.id !== pkg.id))}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar Empaque"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
        >
          Atrás
        </button>
        <button
          type="submit"
          className="px-8 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-slate-900/10"
        >
          <Check className="w-4 h-4" />
          <span>{isEditing ? 'Guardar Cambios' : 'Registrar Producto'}</span>
        </button>
      </div>
    </form>
  );
};
