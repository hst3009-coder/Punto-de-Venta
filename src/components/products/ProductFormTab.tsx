import React, { useState, useEffect } from 'react';
import { Product, Category } from '../../types';
import { getPreTaxAmount } from '../../lib/money';
import { SupplierPicker } from '../SupplierPicker';
import { Check, X, Tag, Barcode, DollarSign, Percent, Folder, Plus, ShoppingBag, AlertTriangle } from 'lucide-react';

interface ProductFormTabProps {
  id: string | null;
  products: Product[];
  categories: Category[];
  onSuccess: (product: Product) => void;
  onCancel: () => void;
}

const EMOJI_OPTIONS = ['☕', '🥤', '🥐', '🍔', '🍕', '🍰', '🧁', '🍩', '🥯', '🍟', '🥗', '🥑', '🌮', '🥩', '🍣', '🍎', '🍓', '🍪', '🍫', '🍦', '🍺', '🍷', '💧', '🛍️', '📦'];

export const ProductFormTab: React.FC<ProductFormTabProps> = ({
  id,
  products,
  categories,
  onSuccess,
  onCancel,
}) => {
  const isEditing = id !== null;

  // Form Fields
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [code, setCode] = useState('');
  const [sku, setSku] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [profitPercent, setProfitPercent] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('50');
  const [emoji, setEmoji] = useState('🏷️');
  const [imageUrl, setImageUrl] = useState('');
  const [imageType, setImageType] = useState<'emoji' | 'url'>('emoji');
  const [provider, setProvider] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [taxExempt, setTaxExempt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load product if editing
  useEffect(() => {
    if (isEditing && id) {
      const prod = products.find((p) => p.id === id);
      if (prod) {
        setName(prod.name || '');
        setBarcode(prod.barcode || '');
        setCode(prod.code || '');
        setSku(prod.sku || '');
        setCost(prod.cost !== undefined ? prod.cost.toString() : '');
        setPrice(prod.price !== undefined ? prod.price.toString() : '');
        setProfitPercent(prod.profitPercent !== undefined ? prod.profitPercent.toString() : '');
        setCategory(prod.category || '');
        setStock(prod.stock !== undefined ? prod.stock.toString() : '0');
        setEmoji(prod.emoji || '🏷️');
        setImageUrl(prod.imageUrl || '');
        setImageType(prod.imageUrl ? 'url' : 'emoji');
        setProvider(prod.provider || '');
        setExpirationDate(prod.expirationDate || '');
        setTaxExempt(!!prod.taxExempt);
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
      setCategory(categories.filter((c) => c.id !== 'all')[0]?.id || 'cafeteria');
      setStock('50');
      setEmoji('☕');
      setImageUrl('');
      setImageType('emoji');
      setProvider('');
      setExpirationDate('');
      setTaxExempt(false);
    }
    setError(null);
  }, [id, isEditing, products, categories]);

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

    const parsedProfit = profitPercent ? parseFloat(profitPercent) : undefined;
    const parsedStock = parseInt(stock) || 0;

    // Use barcode value or fallback
    const finalBarcode = barcode.trim() || code.trim() || (isEditing ? '' : Math.floor(1000 + Math.random() * 9000).toString());

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
      code: code.trim() || finalBarcode || undefined,
      sku: sku.trim() || undefined,
      cost: parsedCost,
      profitPercent: parsedProfit,
      provider: provider.trim() || undefined,
      expirationDate: expirationDate || undefined,
      taxExempt,
    };

    onSuccess(updatedProduct);
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
              placeholder="Ej. Café Americano Intenso"
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
                {categories
                  .filter((c) => c.id !== 'all')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Stock Inicial *
              </label>
              <input
                type="number"
                required
                min="0"
                placeholder="50"
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
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all"
              />
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
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all"
              />
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
