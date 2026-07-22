import React, { useState, useMemo } from 'react';
import { Product } from '../../types';
import { useAlert } from '../../context/AlertContext';
import { Folder, Users, AlertTriangle, ArrowRight, Plus, Eye, Barcode, HelpCircle } from 'lucide-react';

interface DepartmentsSuppliersTabProps {
  products: Product[];
  onEditProduct: (productId: string) => void;
}

export const DepartmentsSuppliersTab: React.FC<DepartmentsSuppliersTabProps> = ({
  products,
  onEditProduct,
}) => {
  const { showAlert } = useAlert();
  const [mode, setMode] = useState<'category' | 'provider'>('category');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  
  // Keep track of newly created groups from the "+" prompt
  const [customGroups, setCustomGroups] = useState<{ category: string[]; provider: string[] }>({
    category: [],
    provider: [],
  });

  // Calculate existing groups from products catalog
  const groupsFromProducts = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const val = mode === 'category' ? p.category : p.provider;
      if (val && val.trim()) {
        set.add(val.trim());
      }
    });
    return Array.from(set).sort();
  }, [products, mode]);

  // Combined group list (dynamic + custom)
  const groupList = useMemo(() => {
    const list = [...groupsFromProducts];
    const customs = mode === 'category' ? customGroups.category : customGroups.provider;
    customs.forEach((c) => {
      if (!list.includes(c)) {
        list.push(c);
      }
    });
    return list.sort();
  }, [groupsFromProducts, mode, customGroups]);

  // Set default selection when mode changes or groups list is loaded
  React.useEffect(() => {
    if (groupList.length > 0 && (!selectedGroup || !groupList.includes(selectedGroup))) {
      setSelectedGroup(groupList[0]);
    } else if (groupList.length === 0) {
      setSelectedGroup('');
    }
  }, [groupList, selectedGroup]);

  // Products belonging to the selected group
  const groupedProducts = useMemo(() => {
    if (!selectedGroup) return [];
    return products.filter((p) => {
      const val = mode === 'category' ? p.category : p.provider;
      return val && val.trim().toLowerCase() === selectedGroup.toLowerCase();
    });
  }, [products, mode, selectedGroup]);

  // Count items per group helper
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      const val = mode === 'category' ? p.category : p.provider;
      if (val && val.trim()) {
        const cleanVal = val.trim();
        counts[cleanVal] = (counts[cleanVal] || 0) + 1;
      }
    });
    return counts;
  }, [products, mode]);

  const handleCreateGroup = () => {
    const label = mode === 'category' ? 'categoría' : 'proveedor';
    const name = prompt(`Ingrese el nombre del nuevo ${label}:`);
    if (name && name.trim()) {
      const cleanName = name.trim();
      setCustomGroups((prev) => {
        const currentCustoms = mode === 'category' ? prev.category : prev.provider;
        if (currentCustoms.includes(cleanName) || groupsFromProducts.includes(cleanName)) {
          showAlert(
            'Registro Duplicado',
            `Este ${label} ya existe.`,
            'warning'
          );
          return prev;
        }
        return {
          ...prev,
          [mode]: [...currentCustoms, cleanName],
        };
      });
      setSelectedGroup(cleanName);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-100 overflow-hidden">
      
      {/* Dynamic Left sidebar with groups */}
      <div className="w-full md:w-[320px] bg-white border-r border-slate-200 p-6 flex flex-col min-h-0 shrink-0">
        
        {/* Selector Toggle */}
        <div className="bg-slate-100 p-1 rounded-2xl border border-slate-200 flex mb-5 shrink-0">
          <button
            onClick={() => setMode('category')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'category'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Categorías</span>
          </button>
          <button
            onClick={() => setMode('provider')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mode === 'provider'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Proveedores</span>
          </button>
        </div>

        {/* Header list of groups */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0 mb-3">
          <h4 className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">
            Listado de {mode === 'category' ? 'Categorías' : 'Proveedores'}
          </h4>
          <button
            onClick={handleCreateGroup}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all cursor-pointer shadow-xs"
            title={`Crear nueva ${mode === 'category' ? 'categoría' : 'proveedor'}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable list of groups */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {groupList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <HelpCircle className="w-8 h-8 text-slate-350 mx-auto mb-1.5" />
              <p className="text-xs font-extrabold text-slate-500">Ninguno registrado</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Haz clic en "+" para crear el primero.</p>
            </div>
          ) : (
            groupList.map((g) => {
              const isActive = selectedGroup === g;
              const count = groupCounts[g] || 0;
              return (
                <button
                  key={g}
                  onClick={() => setSelectedGroup(g)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-750'
                  }`}
                >
                  <span className="text-xs font-bold truncate pr-3">{g}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Products grid/details */}
      <div className="flex-1 bg-slate-50 p-6 flex flex-col min-h-0 overflow-hidden">
        {selectedGroup ? (
          <div className="flex flex-col h-full min-h-0">
            {/* Selected group title */}
            <div className="pb-4 border-b border-slate-200 shrink-0 mb-4 flex justify-between items-center">
              <div>
                <h3 className="text-md font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <span>{mode === 'category' ? 'Categoría' : 'Proveedor'}:</span>
                  <span className="text-indigo-600 underline decoration-indigo-300">{selectedGroup}</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">
                  Se encontraron {groupedProducts.length} productos registrados bajo este grupo
                </p>
              </div>
            </div>

            {/* Grid of products */}
            <div className="flex-1 overflow-y-auto">
              {groupedProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 bg-white border border-slate-200 rounded-2xl">
                  <Folder className="w-8 h-8 text-slate-350 mb-2" />
                  <p className="text-xs font-extrabold text-slate-500">Este grupo está vacío</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                    Para asignar un producto aquí, ve a la pestaña "Nuevo/Editar", edita un producto y escribe "{selectedGroup}" en el campo de {mode === 'category' ? 'Categoría' : 'Proveedor'}.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedProducts.map((prod) => {
                    // Check if stock is low
                    const threshold = prod.minStock !== undefined ? prod.minStock : 5;
                    const isLowStock = prod.stock <= threshold;

                    return (
                      <div
                        key={prod.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-indigo-200 hover:shadow-xs transition-all duration-200 relative overflow-hidden"
                      >
                        {/* Status bar top */}
                        {isLowStock && (
                          <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500 animate-pulse" />
                        )}

                        <div>
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <div className="w-8 h-8 bg-slate-50 border border-slate-150 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative">
                              {prod.imageUrl ? (
                                <img
                                  src={prod.imageUrl}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = '';
                                    (e.target as HTMLImageElement).classList.add('hidden');
                                    const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-dep-icon');
                                    if (fallback) fallback.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <span className={`fallback-dep-icon text-lg ${prod.imageUrl ? 'hidden' : ''}`}>
                                {prod.emoji || '🏷️'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-800 truncate" title={prod.name}>
                                {prod.name}
                              </h4>
                              <div className="flex items-center gap-0.5 mt-0.5">
                                <Barcode className="w-3 h-3 text-slate-450" />
                                <span className="text-[9px] text-slate-400 font-mono font-bold uppercase truncate">
                                  {prod.code || prod.barcode || prod.id}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-xs mt-3 bg-slate-50/55 p-2 rounded-xl border border-slate-150">
                            <div>
                              <span className="text-[8px] font-extrabold text-slate-400 block uppercase">Precio</span>
                              <span className="font-extrabold text-slate-800">${prod.price.toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[8px] font-extrabold text-slate-400 block uppercase">Stock</span>
                              <span className={`font-black flex items-center gap-0.5 justify-end ${
                                isLowStock ? 'text-rose-600 animate-pulse font-black' : 'text-slate-700'
                              }`}>
                                {isLowStock && <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />}
                                <span>{prod.stock} un.</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                          <button
                            onClick={() => onEditProduct(prod.id)}
                            className="text-[10px] font-black text-indigo-650 hover:text-indigo-850 hover:bg-indigo-50/50 px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer uppercase tracking-wider transition-colors"
                          >
                            <span>Editar</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white max-w-lg mx-auto">
            <Folder className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="text-sm font-black text-slate-650 uppercase">Agrupaciones de Productos</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Selecciona una categoría o proveedor de la barra lateral para inspeccionar sus productos, stock crítico y acceder al editor rápido.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
