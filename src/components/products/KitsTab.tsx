import React, { useState, useMemo } from 'react';
import { Product, Category } from '../../types';
import { matchesProductSearch } from '../../lib/search';
import { useAlert } from '../../context/AlertContext';
import { Search, Plus, Trash2, CheckCircle, Package, Layers, X, Edit3, Sparkles } from 'lucide-react';

interface KitsTabProps {
  products: Product[];
  categories: Category[];
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

interface KitComponentStaged {
  productId: string;
  code: string;
  name: string;
  quantity: number;
  cost: number;
  price: number;
}

export const KitsTab: React.FC<KitsTabProps> = ({
  products,
  categories,
  onAddProduct,
  onDeleteProduct,
}) => {
  const { showAlert, showConfirm } = useAlert();
  const [isEditing, setIsEditing] = useState(false);
  const [editingKitId, setEditingKitId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [price, setPrice] = useState('');
  const [emoji, setEmoji] = useState('📦');
  const [stagedComponents, setStagedComponents] = useState<KitComponentStaged[]>([]);

  // Search components
  const [componentSearchQuery, setComponentSearchQuery] = useState('');

  // Filter products that are NOT kits to add as components
  const nonKitProducts = useMemo(() => {
    return products.filter((p) => !p.isKit);
  }, [products]);

  const kitSearchResults = useMemo(() => {
    if (!componentSearchQuery.trim()) return [];
    return nonKitProducts.filter((p) => matchesProductSearch(p, componentSearchQuery)).slice(0, 5);
  }, [nonKitProducts, componentSearchQuery]);

  // List of existing kits
  const kitsList = useMemo(() => {
    return products.filter((p) => p.isKit === true);
  }, [products]);

  // Calculations for current kit
  const totalCost = useMemo(() => {
    return stagedComponents.reduce((sum, comp) => sum + (comp.cost * comp.quantity), 0);
  }, [stagedComponents]);

  const recommendedPrice = useMemo(() => {
    return stagedComponents.reduce((sum, comp) => sum + (comp.price * comp.quantity), 0);
  }, [stagedComponents]);

  const currentMargin = useMemo(() => {
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0 || totalCost <= 0) return 0;
    return ((parsedPrice - totalCost) / totalCost) * 100;
  }, [price, totalCost]);

  const handleAddComponent = (prod: Product) => {
    const existing = stagedComponents.find((c) => c.productId === prod.id);
    if (existing) {
      setStagedComponents(stagedComponents.map((c) => 
        c.productId === prod.id ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setStagedComponents([
        ...stagedComponents,
        {
          productId: prod.id,
          code: prod.code || prod.barcode || prod.id,
          name: prod.name,
          quantity: 1,
          cost: prod.cost || 0,
          price: prod.price,
        },
      ]);
    }
    setComponentSearchQuery('');
  };

  const handleRemoveComponent = (productId: string) => {
    setStagedComponents(stagedComponents.filter((c) => c.productId !== productId));
  };

  const handleQtyChange = (productId: string, val: string) => {
    const qty = parseInt(val);
    if (isNaN(qty) || qty <= 0) return;
    setStagedComponents(stagedComponents.map((c) => 
      c.productId === productId ? { ...c, quantity: qty } : c
    ));
  };

  const handleEditKit = (kit: Product) => {
    setIsEditing(true);
    setEditingKitId(kit.id);
    setName(kit.name);
    setCode(kit.code || kit.barcode || kit.id);
    setPrice(kit.price.toString());
    setEmoji(kit.emoji || '📦');
    setStagedComponents(kit.kitComponents || []);
  };

  const handleNewKitClick = () => {
    setIsEditing(true);
    setEditingKitId(null);
    setName('');
    setCode('');
    setPrice('');
    setEmoji('📦');
    setStagedComponents([]);
  };

  const handleSaveKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      await showAlert(
        'Nombre Obligatorio',
        'El nombre del kit es obligatorio',
        'warning'
      );
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      await showAlert(
        'Precio Inválido',
        'Ingresa un precio de venta válido mayor a 0',
        'warning'
      );
      return;
    }

    if (stagedComponents.length === 0) {
      await showAlert(
        'Componente Requerido',
        'Debes agregar al menos un componente al kit/combo',
        'warning'
      );
      return;
    }

    const finalBarcode = code.trim() || (editingKitId ? '' : 'KIT-' + Math.floor(1000 + Math.random() * 9000));

    // Category for kits: default to 'kits' or first available
    const kitsCategory = categories.find((c) => c.id === 'kits' || c.id === 'promos') ? 'kits' : (categories[0]?.id || 'cafeteria');

    const updatedKit: Product = {
      id: editingKitId || 'custom-kit-' + crypto.randomUUID(),
      name: name.trim(),
      price: parsedPrice,
      category: kitsCategory,
      stock: 9999, // Kits usually have high or virtual stock, or we manage components stock in real sales. We set a dummy high number or 9999.
      color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      emoji: emoji || '📦',
      barcode: finalBarcode,
      code: finalBarcode,
      isKit: true,
      kitComponents: stagedComponents,
      cost: totalCost,
      profitPercent: currentMargin,
    };

    onAddProduct(updatedKit);
    setIsEditing(false);
    setEditingKitId(null);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-100 overflow-hidden">
      
      {/* LEFT PANEL: Kits list */}
      <div className="w-full md:w-[400px] border-r border-slate-200 bg-white p-6 flex flex-col min-h-0 shrink-0">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-800" />
              <span>Combos & Kits</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Agrupaciones de productos con precio único</p>
          </div>
          <button
            onClick={handleNewKitClick}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-slate-900/10"
          >
            Nuevo Kit
          </button>
        </div>

        {/* Kits list scrollable */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {kitsList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <Layers className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-extrabold text-slate-500 font-bold">No hay combos registrados</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Haz clic en "Nuevo Kit" para empaquetar ofertas.</p>
            </div>
          ) : (
            kitsList.map((kit) => {
              const compCount = kit.kitComponents?.length || 0;
              const margin = kit.profitPercent !== undefined ? kit.profitPercent : 0;
              return (
                <div
                  key={kit.id}
                  className="p-3 border border-slate-200 rounded-xl bg-white hover:border-indigo-200 transition-all shadow-xs space-y-2.5"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xl w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 border border-slate-150">
                        {kit.emoji || '📦'}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-850 truncate">{kit.name}</h4>
                        <span className="text-[9px] text-slate-400 font-mono font-bold uppercase">
                          Cód: {kit.code || kit.barcode || kit.id}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEditKit(kit)}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md cursor-pointer"
                        title="Editar combo"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const confirmDelete = await showConfirm(
                            'Eliminar Combo/Kit',
                            `¿Eliminar el kit "${kit.name}"?`
                          );
                          if (confirmDelete) {
                            onDeleteProduct(kit.id);
                          }
                        }}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer"
                        title="Eliminar combo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-150 text-center">
                    <div>
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Componentes</span>
                      <span className="text-[10px] font-black text-slate-700">{compCount} prod.</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Costo total</span>
                      <span className="text-[10px] font-black text-slate-700">${(kit.cost || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase block">Precio</span>
                      <span className="text-[10px] font-black text-slate-800 font-extrabold">${kit.price.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-450 font-bold">Margen:</span>
                    <span className={`font-black ${margin >= 30 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      {margin.toFixed(0)}% de ganancia
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Kit build & configuration form */}
      <div className="flex-1 bg-slate-50 p-6 overflow-y-auto">
        {isEditing ? (
          <form onSubmit={handleSaveKit} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-md space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-md font-black text-slate-800 uppercase tracking-tight">
                  {editingKitId ? 'Editar Combo/Kit' : 'Configurar Nuevo Combo/Kit'}
                </h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Agrupa productos y ponles un precio final promocional</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-150 px-3 py-1 rounded-xl cursor-pointer"
              >
                Cerrar editor
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Nombre del Combo / Kit *
                </label>
                <input autoComplete="off"
                  type="text"
                  required
                  placeholder="Ej. Combo Desayuno Completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Código de Combo (Escanear o Interno)
                </label>
                <input autoComplete="off"
                  type="text"
                  placeholder="Ej. COMBO-DES"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Component Search */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Buscar productos para agregar al combo
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input autoComplete="off"
                  type="text"
                  placeholder="Escribe nombre o escanea código del componente..."
                  value={componentSearchQuery}
                  onChange={(e) => setComponentSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              {kitSearchResults.length > 0 && (
                <div className="border border-slate-250 rounded-xl bg-white shadow-lg overflow-hidden divide-y divide-slate-100 max-h-44 overflow-y-auto">
                  {kitSearchResults.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleAddComponent(prod)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{prod.emoji || '🏷️'}</span>
                        <div>
                          <span className="font-extrabold text-slate-850 block">{prod.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-bold">
                            Costo: ${prod.cost || 0} | Precio: ${prod.price}
                          </span>
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Staged components list */}
            <div className="space-y-3">
              <h5 className="text-[10px] font-black text-slate-450 uppercase tracking-wider block border-b border-slate-100 pb-1.5">
                Componentes de este Combo / Kit
              </h5>
              
              {stagedComponents.length === 0 ? (
                <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center p-4">
                  <Package className="w-6 h-6 text-slate-350 mb-1" />
                  <p className="text-[11px] font-extrabold text-slate-500">No hay componentes agregados</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">Utiliza el buscador de arriba para agregar productos a este combo.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                  {stagedComponents.map((comp) => (
                    <div key={comp.productId} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="font-extrabold text-slate-800 block truncate">{comp.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Costo: ${comp.cost.toFixed(2)} | Venta: ${comp.price.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Quantity input */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase text-slate-400">Cant:</span>
                          <input autoComplete="off"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            value={comp.quantity ?? ''}
                            onChange={(e) => handleQtyChange(comp.productId, e.target.value)}
                            className="w-12 text-center py-1 border border-slate-250 rounded-lg text-xs font-black focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveComponent(comp.productId)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Calculations & price setup */}
            {stagedComponents.length > 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="bg-white border border-slate-150 p-2.5 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Costo total sumado</span>
                    <span className="text-xs font-black text-slate-700">${totalCost.toFixed(2)}</span>
                  </div>
                  <div className="bg-white border border-slate-150 p-2.5 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Precio de venta recomendado</span>
                    <span className="text-xs font-black text-indigo-650 flex items-center justify-center gap-0.5">
                      <span>${recommendedPrice.toFixed(2)}</span>
                      <Sparkles className="w-3 h-3 text-amber-500" title="Suma de precios individuales" />
                    </span>
                  </div>
                  <div className="bg-white border border-slate-150 p-2.5 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Margen de ganancia</span>
                    <span className={`text-xs font-black ${currentMargin >= 30 ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {currentMargin.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-600 block">
                      Precio de Venta del Combo ($) *
                    </label>
                    <div className="relative max-w-xs">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                      <input autoComplete="off"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-6 pr-3 py-2 border border-slate-200 bg-white rounded-xl text-xs font-extrabold text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPrice(recommendedPrice.toFixed(2))}
                    className="px-3 py-2 border border-dashed border-indigo-200 hover:border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-[10px] font-black uppercase tracking-wider rounded-xl cursor-pointer self-end shrink-0"
                  >
                    Usar recomendado (${recommendedPrice.toFixed(2)})
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold text-xs uppercase cursor-pointer"
              >
                Atrás
              </button>
              <button
                type="submit"
                className="px-7 py-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{editingKitId ? 'Guardar Cambios' : 'Crear Combo / Kit'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white max-w-lg mx-auto">
            <Layers className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="text-sm font-black text-slate-600 uppercase">Panel de Edición de Combos</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Haz clic en "Nuevo Kit" o selecciona un kit de la barra lateral para configurar sus componentes, costos, precios e imágenes representativas.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
