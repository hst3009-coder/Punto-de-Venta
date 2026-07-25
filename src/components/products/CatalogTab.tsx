import React, { useState, useMemo, useRef } from 'react';
import { Product, Category, EmployeePermissions, Sale, DashboardConfig } from '../../types';
import { SupplierPicker } from '../SupplierPicker';
import { matchesProductSearch, rankSearchResults } from '../../lib/search';
import { getSaleTimestamp } from '../../lib/dates';
import * as XLSX from 'xlsx';
import { useAlert } from '../../context/AlertContext';
import { firestoreService } from '../../lib/firebase';
import { roundCents, getPreTaxAmount, isProductBelowTargetProfit } from '../../lib/money';
import { ImportWizardModal } from './ImportWizardModal';
import { 
  Search, 
  Barcode, 
  Trash2, 
  Edit3, 
  Package, 
  Check, 
  Plus, 
  Upload, 
  Download, 
  ArrowUpDown, 
  DollarSign, 
  Boxes, 
  Percent,
  TrendingUp,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronDown,
  X as XIcon,
  Users
} from 'lucide-react';

interface CatalogTabProps {
  products: Product[];
  categories: Category[];
  dashboardConfig?: DashboardConfig;
  onEdit: (productId: string) => void;
  onDeleteProduct: (productId: string) => void;
  onAddProduct: (product: Product) => void;
  permissions: EmployeePermissions;
  sales?: Sale[];
}

type SortField = 'name' | 'category' | 'provider' | 'stock' | 'cost' | 'price' | 'profitPercent';
type SortOrder = 'asc' | 'desc';

export const CatalogTab: React.FC<CatalogTabProps> = ({
  products,
  categories,
  dashboardConfig,
  onEdit,
  onDeleteProduct,
  onAddProduct,
  permissions,
  sales = [],
}) => {
  const { showAlert, showConfirm } = useAlert();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  // Inline editing state
  type InlineField = 'price' | 'category' | 'provider' | 'code' | 'sku' | 'cost';
  interface ActiveInlineEdit {
    productId: string;
    field: InlineField;
    value: string;
    originalValue: any;
  }
  interface InlineFeedback {
    productId: string;
    field: InlineField;
    type: 'success' | 'error';
  }

  const [activeEdit, setActiveEdit] = useState<ActiveInlineEdit | null>(null);
  const [feedback, setFeedback] = useState<InlineFeedback | null>(null);
  const activeEditRef = useRef<ActiveInlineEdit | null>(null);
  activeEditRef.current = activeEdit;

  // Compute recentSalesCount map for the last 30 days
  const recentSalesCount = useMemo(() => {
    const map = new Map<string, number>();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    sales.forEach((sale) => {
      if (sale.isCancelled) return;
      const t = getSaleTimestamp(sale);
      if (t >= thirtyDaysAgo) {
        sale.items.forEach((item) => {
          if (item.product && item.product.id) {
            const current = map.get(item.product.id) || 0;
            map.set(item.product.id, current + (item.quantity || 1));
          }
        });
      }
    });
    return map;
  }, [sales]);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchActionMenu, setBatchActionMenu] = useState<'price' | 'category' | 'provider' | null>(null);
  
  // Batch action form states
  const [batchPriceMode, setBatchPriceMode] = useState<'fixed' | 'percent'>('fixed');
  const [batchPriceValue, setBatchPriceValue] = useState('');
  const [batchTargetId, setBatchTargetId] = useState('');
  
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Global Inventory Metrics
  const globalMetrics = useMemo(() => {
    const totalCount = products.length;
    const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalCostValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || 0)), 0);
    return { totalCount, totalStock, totalCostValue };
  }, [products]);

  // Calculate unique categories list from products
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Combined categories list (for datalist suggestions)
  const allCategoryNames = useMemo(() => {
    const set = new Set<string>(categoriesList);
    categories.forEach((c) => {
      if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    return Array.from(set).sort();
  }, [categoriesList, categories]);

  const renderFeedbackIcon = (productId: string, field: InlineField) => {
    if (!feedback || feedback.productId !== productId || feedback.field !== field) return null;

    if (feedback.type === 'success') {
      return (
        <span className="inline-flex items-center justify-center p-0.5 bg-emerald-100 text-emerald-600 rounded-full animate-bounce shrink-0 ml-1" title="Guardado exitosamente">
          <Check className="w-3 h-3 stroke-[3]" />
        </span>
      );
    }

    if (feedback.type === 'error') {
      return (
        <span className="inline-flex items-center justify-center p-0.5 bg-rose-100 text-rose-600 rounded-full animate-pulse shrink-0 ml-1" title="Error al guardar">
          <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
        </span>
      );
    }

    return null;
  };

  const saveCurrentEdit = async (editToSave = activeEditRef.current): Promise<boolean> => {
    if (!editToSave) return true;

    const { productId, field, value } = editToSave;
    const prod = products.find(p => p.id === productId);
    if (!prod) {
      setActiveEdit(null);
      return true;
    }

    let updatedValue: any = value.trim();

    if (field === 'price' || field === 'cost') {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        setActiveEdit(null);
        return false;
      }
      updatedValue = roundCents(num);
      const currentVal = field === 'price' ? prod.price : (prod.cost || 0);
      if (updatedValue === currentVal) {
        setActiveEdit(null);
        return true;
      }
    } else {
      const currentVal = String(prod[field as keyof Product] || '').trim();
      if (updatedValue === currentVal) {
        setActiveEdit(null);
        return true;
      }
    }

    setActiveEdit(null);

    const updateData: Partial<Product> = {
      [field]: updatedValue
    };

    try {
      await firestoreService.updateDoc('products', productId, updateData);
      
      const updatedProd: Product = {
        ...prod,
        ...updateData
      };
      onAddProduct(updatedProd);

      setFeedback({ productId, field, type: 'success' });
      setTimeout(() => {
        setFeedback(prev => (prev?.productId === productId && prev?.field === field ? null : prev));
      }, 1800);

      return true;
    } catch (err) {
      console.error(`Error inline updating ${field} for product ${productId}:`, err);
      
      setFeedback({ productId, field, type: 'error' });
      setTimeout(() => {
        setFeedback(prev => (prev?.productId === productId && prev?.field === field ? null : prev));
      }, 2500);

      showAlert(
        'Error de Guardado',
        `No se pudo actualizar el campo. Revisa tu conexión e intenta de nuevo.`,
        'error'
      );
      return false;
    }
  };

  const handleStartEdit = async (prod: Product, field: InlineField) => {
    if (!permissions.manageProducts) return;

    if (activeEditRef.current && activeEditRef.current.productId === prod.id && activeEditRef.current.field === field) {
      return;
    }

    if (activeEditRef.current) {
      await saveCurrentEdit(activeEditRef.current);
    }

    let initialVal = '';
    if (field === 'price') initialVal = prod.price !== undefined ? String(prod.price) : '0';
    else if (field === 'cost') initialVal = prod.cost !== undefined ? String(prod.cost) : '0';
    else if (field === 'category') initialVal = prod.category || '';
    else if (field === 'provider') initialVal = prod.provider || '';
    else if (field === 'code') initialVal = prod.code || prod.barcode || '';
    else if (field === 'sku') initialVal = prod.sku || '';

    setActiveEdit({
      productId: prod.id,
      field,
      value: initialVal,
      originalValue: prod[field as keyof Product] ?? ''
    });
  };

  // Filter products by search & category
  const filteredProducts = useMemo(() => {
    const filtered = products.filter((prod) => {
       const matchesSearch = matchesProductSearch(prod, searchQuery);
       const matchesCategory = selectedCategory === 'all' || 
         (prod.category && prod.category.trim().toLowerCase() === selectedCategory.toLowerCase());
       return matchesSearch && matchesCategory;
     });
 
     return rankSearchResults(filtered, searchQuery, recentSalesCount);
   }, [products, searchQuery, selectedCategory, recentSalesCount]);

  // Sort filtered products
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === 'category') {
        valA = (a.category || '').toLowerCase();
        valB = (b.category || '').toLowerCase();
      } else if (sortField === 'provider') {
        valA = (a.provider || '').toLowerCase();
        valB = (b.provider || '').toLowerCase();
      } else if (sortField === 'stock') {
        valA = a.stock || 0;
        valB = b.stock || 0;
      } else if (sortField === 'cost') {
        valA = a.cost || 0;
        valB = b.cost || 0;
      } else if (sortField === 'price') {
        valA = a.price || 0;
        valB = b.price || 0;
      } else if (sortField === 'profitPercent') {
        valA = a.cost && a.cost > 0 ? ((a.price - a.cost) / a.cost) * 100 : 0;
        valB = b.cost && b.cost > 0 ? ((b.price - b.cost) / b.cost) * 100 : 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to high-to-low for premium feel
    }
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

  // Export spreadsheet function
  const handleExportExcel = () => {
    try {
      const exportData = filteredProducts.map((prod) => {
        const pricePreTax = getPreTaxAmount(prod.price, prod.taxExempt);
        const margin = prod.cost && prod.cost > 0 ? ((pricePreTax - prod.cost) / prod.cost) * 100 : 0;
        return {
          'Código/Barras': prod.code || prod.barcode || prod.id,
          'Nombre/Producto': prod.name,
          'Categoría': prod.category,
          'Proveedor': prod.provider || '',
          'Stock/Existencia': prod.stock,
          'Costo de Compra (RD$)': prod.cost || 0,
          'Precio de Venta (RD$)': prod.price,
          'Margen Ganancia (%)': margin.toFixed(2),
          'SKU': prod.sku || '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catalogo_POS');
      
      const filename = `catalogo_pos_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Error exporting catalog to Excel:', err);
      showAlert(
        'Error de Exportación',
        'Error al exportar. Revisa la consola para más detalles.',
        'error'
      );
    }
  };


  const handleToggleVisible = async (prod: Product) => {
    const updated: Product = {
      ...prod,
      visible: prod.visible === false ? true : false
    };
    try {
      await firestoreService.setDocWithId('products', prod.id, updated);
      onAddProduct(updated);
    } catch (err) {
      console.error("Error toggling visibility:", err);
    }
  };

  const handleBatchDelete = async () => {
    const selectedProds = products.filter(p => selectedIds.includes(p.id));
    const count = selectedProds.length;
    const namesDisplay = selectedProds.slice(0, 3).map(p => p.name).join(', ') + (count > 3 ? ` y ${count - 3} más` : '');

    const confirmed = await showConfirm(
      'Eliminar Lote',
      `¿Estás seguro de que deseas eliminar ${count} productos (${namesDisplay})? Esta acción es irreversible.`
    );

    if (confirmed) {
      try {
        const ops = selectedIds.map(id => ({
          type: 'delete' as const,
          collectionName: 'products',
          id
        }));
        await firestoreService.runBatch(ops);
        selectedIds.forEach(id => onDeleteProduct(id));
        setSelectedIds([]);
        showAlert('Éxito', `${count} productos eliminados correctamente.`, 'success');
      } catch (err) {
        console.error("Error in batch delete:", err);
      }
    }
  };

  const handleBatchPriceUpdate = async () => {
    const val = parseFloat(batchPriceValue);
    if (isNaN(val)) return;

    const confirmed = await showConfirm(
      'Actualizar Precios',
      `¿Aplicar el cambio de precio a ${selectedIds.length} productos seleccionados?`
    );

    if (confirmed) {
      try {
        const ops = selectedIds.map(id => {
          const prod = products.find(p => p.id === id)!;
          let newPrice = prod.price;
          if (batchPriceMode === 'fixed') {
            newPrice = val;
          } else {
            newPrice = roundCents(prod.price * (1 + val / 100));
          }
          
          return {
            type: 'update' as const,
            collectionName: 'products',
            id,
            data: { price: newPrice }
          };
        });
        await firestoreService.runBatch(ops);
        
        // Update local state
        ops.forEach(op => {
          const prod = products.find(p => p.id === op.id)!;
          onAddProduct({ ...prod, price: op.data!.price });
        });

        setSelectedIds([]);
        setBatchActionMenu(null);
        setBatchPriceValue('');
        showAlert('Éxito', `${selectedIds.length} precios actualizados.`, 'success');
      } catch (err) {
        console.error("Error in batch price update:", err);
      }
    }
  };

  const handleBatchCategoryUpdate = async () => {
    if (!batchTargetId) return;

    const confirmed = await showConfirm(
      'Cambiar Categoría',
      `¿Cambiar la categoría de ${selectedIds.length} productos a "${batchTargetId}"?`
    );

    if (confirmed) {
      try {
        const ops = selectedIds.map(id => ({
          type: 'update' as const,
          collectionName: 'products',
          id,
          data: { category: batchTargetId }
        }));
        await firestoreService.runBatch(ops);
        
        ops.forEach(op => {
          const prod = products.find(p => p.id === op.id)!;
          onAddProduct({ ...prod, category: batchTargetId });
        });

        setSelectedIds([]);
        setBatchActionMenu(null);
        setBatchTargetId('');
        showAlert('Éxito', `${selectedIds.length} categorías actualizadas.`, 'success');
      } catch (err) {
        console.error("Error in batch category update:", err);
      }
    }
  };

  const handleBatchProviderUpdate = async () => {
    if (!batchTargetId) return;

    const confirmed = await showConfirm(
      'Cambiar Proveedor',
      `¿Cambiar el proveedor de ${selectedIds.length} productos a "${batchTargetId}"?`
    );

    if (confirmed) {
      try {
        const ops = selectedIds.map(id => ({
          type: 'update' as const,
          collectionName: 'products',
          id,
          data: { provider: batchTargetId }
        }));
        await firestoreService.runBatch(ops);
        
        ops.forEach(op => {
          const prod = products.find(p => p.id === op.id)!;
          onAddProduct({ ...prod, provider: batchTargetId });
        });

        setSelectedIds([]);
        setBatchActionMenu(null);
        setBatchTargetId('');
        showAlert('Éxito', `${selectedIds.length} proveedores actualizados.`, 'success');
      } catch (err) {
        console.error("Error in batch provider update:", err);
      }
    }
  };

  const handleBatchToggleVisible = async (isVisible: boolean) => {
    const confirmed = await showConfirm(
      isVisible ? 'Mostrar Lote' : 'Ocultar Lote',
      `¿Deseas ${isVisible ? 'mostrar' : 'ocultar'} ${selectedIds.length} productos seleccionados en el catálogo de ventas?`
    );

    if (confirmed) {
      try {
        const ops = selectedIds.map(id => ({
          type: 'update' as const,
          collectionName: 'products',
          id,
          data: { visible: isVisible }
        }));
        await firestoreService.runBatch(ops);
        
        ops.forEach(op => {
          const prod = products.find(p => p.id === op.id)!;
          onAddProduct({ ...prod, visible: isVisible });
        });

        setSelectedIds([]);
        showAlert('Éxito', `${ops.length} productos actualizados.`, 'success');
      } catch (err) {
        console.error("Error in batch visibility update:", err);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedProducts.length && sortedProducts.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedProducts.map(p => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-100 overflow-hidden">
      
      {/* 1. UPPER PANEL: Global Metrics & Action Buttons */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        
        {/* Metric 1: Total Products */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-750 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Total Productos</span>
            <span className="text-sm font-black text-slate-800 font-mono">
              {globalMetrics.totalCount} <span className="text-[10px] text-slate-400 font-sans font-bold">ítems</span>
            </span>
          </div>
        </div>

        {/* Metric 2: Total Stock */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Total Existencias</span>
            <span className="text-sm font-black text-slate-800 font-mono">
              {globalMetrics.totalStock} <span className="text-[10px] text-slate-400 font-sans font-bold">unidades</span>
            </span>
          </div>
        </div>

        {/* Metric 3: Value at Cost */}
        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Valor en Costo</span>
            <span className="text-sm font-black text-emerald-600 font-mono">
              RD$ {globalMetrics.totalCostValue.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Metric 4: Spreadsheet Action Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-center bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-2.5">
          {permissions.manageProducts && (
            <button
              onClick={() => setIsImportWizardOpen(true)}
              className="w-full sm:flex-1 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-600/10"
              title="Importar catálogo mediante asistente"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Asistente de Importación</span>
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="w-full sm:flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shadow-slate-900/10"
            title="Exportar catálogo filtrado a Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
        </div>

      </div>

      {/* 2. SUB BAR: Search & Category Filter Pills */}
      <div className="p-4 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 gap-3">
        {!isSearchExpanded ? (
          /* Collapsed Search Icon Button */
          <button
            type="button"
            onClick={() => {
              setIsSearchExpanded(true);
              setTimeout(() => searchInputRef.current?.focus(), 0);
            }}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center gap-2 text-xs font-bold shrink-0"
            title="Buscar productos"
          >
            <Search className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline text-slate-500 font-medium">Buscar...</span>
          </button>
        ) : (
          /* Expanded Search Bar */
          <div className="relative flex-1 flex items-center gap-2 max-w-2xl animate-fade-in">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                placeholder="Buscar por nombre, SKU, código, categoría, proveedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => {
                  if (!searchQuery.trim()) {
                    setIsSearchExpanded(false);
                  }
                }}
                className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-semibold text-slate-850 focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Limpiar texto"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSearchQuery('');
                setIsSearchExpanded(false);
              }}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
              title="Cerrar búsqueda"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Category Pills (Hidden when search is expanded) */}
        {!isSearchExpanded && (
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 shrink-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas las Categorías
            </button>
            {categoriesList.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>📁</span>
                <span>{cat}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. PRODUCT CATALOG TABLE VIEW */}
      <div className="flex-1 overflow-auto p-6">
        {/* Batch Actions Bar */}
        {selectedIds.length >= 2 && permissions.bulkEditProducts && (
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
                        <button onClick={() => setBatchActionMenu(null)}><XIcon className="w-3.5 h-3.5 text-slate-400" /></button>
                      </div>
                      <div className="flex gap-1 mb-3 bg-slate-100 p-1 rounded-xl">
                        <button 
                          onClick={() => setBatchPriceMode('fixed')}
                          className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${batchPriceMode === 'fixed' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                        >Fijo</button>
                        <button 
                          onClick={() => setBatchPriceMode('percent')}
                          className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${batchPriceMode === 'percent' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                        >% Variación</button>
                      </div>
                      <div className="relative mb-3">
                        {batchPriceMode === 'fixed' ? <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" /> : <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />}
                        <input 
                          type="number"
                          placeholder={batchPriceMode === 'fixed' ? 'Nuevo precio RD$' : '% ejemplo: 10 o -5'}
                          value={batchPriceValue}
                          onChange={(e) => setBatchPriceValue(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <button 
                        onClick={handleBatchPriceUpdate}
                        disabled={!batchPriceValue}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                      >Aplicar a {selectedIds.length} ítems</button>
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
                        <button onClick={() => setBatchActionMenu(null)}><XIcon className="w-3.5 h-3.5 text-slate-400" /></button>
                      </div>
                      <select
                        value={batchTargetId}
                        onChange={(e) => setBatchTargetId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none mb-3"
                      >
                        <option value="">Seleccionar...</option>
                        {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button 
                        onClick={handleBatchCategoryUpdate}
                        disabled={!batchTargetId}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                      >Mover Selección</button>
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
                        <button onClick={() => setBatchActionMenu(null)}><XIcon className="w-3.5 h-3.5 text-slate-400" /></button>
                      </div>
                      <SupplierPicker
                        value={batchTargetId}
                        onChange={setBatchTargetId}
                        products={products}
                        placeholder="Nombre del proveedor..."
                        className="mb-3"
                      />
                      <button 
                        onClick={handleBatchProviderUpdate}
                        disabled={!batchTargetId}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50"
                      >Actualizar Proveedor</button>
                    </div>
                  )}
                </div>

                {/* Batch Toggle Visibility */}
                <button
                  onClick={() => handleBatchToggleVisible(true)}
                  className="px-3 py-1.5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
                  title="Mostrar todos los seleccionados"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Mostrar</span>
                </button>
                <button
                  onClick={() => handleBatchToggleVisible(false)}
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
                onClick={handleBatchDelete}
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
        )}

        {sortedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-xs max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
              <Package className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-slate-700 uppercase">No se encontraron productos</h4>
            <p className="text-xs text-slate-450 mt-1 max-w-xs leading-relaxed">
              Prueba ajustando los filtros de categoría, el texto de búsqueda o importa un catálogo completo con el botón de Importar.
            </p>
          </div>
        ) : (
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
                  {sortedProducts.map((prod) => {
                    const cost = prod.cost || 0;
                    const pricePreTax = getPreTaxAmount(prod.price, prod.taxExempt);
                    const margin = cost > 0 ? ((pricePreTax - cost) / cost) * 100 : 0;
                    const { isBelow: isMarginBelowTarget, targetMargin } = isProductBelowTargetProfit(
                      prod,
                      dashboardConfig?.categoryProfitTargets,
                      categories
                    );
                    
                    return (
                      <tr key={prod.id} className={`hover:bg-slate-50/50 transition-colors group ${selectedIds.includes(prod.id) ? 'bg-indigo-50/40' : ''}`}>
                        
                        {/* Checkbox */}
                        <td className="py-3.5 px-5 text-center">
                          <div className="flex items-center justify-center">
                            <input 
                              type="checkbox"
                              checked={selectedIds.includes(prod.id)}
                              onChange={() => toggleSelectProduct(prod.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </div>
                        </td>

                        {/* 1. Nombre o Producto */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            {/* Visual Asset (Photo or Emoji fallback) */}
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
                                    const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-table-icon');
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
                                <span className="font-extrabold text-slate-800 block truncate leading-tight hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => onEdit(prod.id)}>
                                  {prod.name}
                                </span>
                                {prod.visible === false && (
                                  <span className="bg-slate-200 text-slate-600 text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-wider">Oculto</span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {/* Category Badge */}
                                <span 
                                  onClick={() => handleStartEdit(prod, 'category')}
                                  className={`text-[8px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-black uppercase transition-all ${
                                    permissions.manageProducts ? 'hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer' : ''
                                  }`}
                                  title={permissions.manageProducts ? 'Clic para editar categoría' : undefined}
                                >
                                  {prod.category || 'Sin categoría'}
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
                                    <input
                                      type="text"
                                      value={activeEdit.value || ''}
                                      onChange={(e) => setActiveEdit({ ...activeEdit, value: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); saveCurrentEdit(); }
                                        if (e.key === 'Escape') { e.preventDefault(); setActiveEdit(null); }
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
                                    <input
                                      type="text"
                                      value={activeEdit.value || ''}
                                      onChange={(e) => setActiveEdit({ ...activeEdit, value: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); saveCurrentEdit(); }
                                        if (e.key === 'Escape') { e.preventDefault(); setActiveEdit(null); }
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
                                        permissions.manageProducts ? 'hover:bg-slate-100 hover:text-slate-700 hover:ring-1 hover:ring-slate-300 cursor-pointer' : ''
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
                              <input
                                type="text"
                                list={`category-list-${prod.id}`}
                                value={activeEdit.value || ''}
                                onChange={(e) => setActiveEdit({ ...activeEdit, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); saveCurrentEdit(); }
                                  if (e.key === 'Escape') { e.preventDefault(); setActiveEdit(null); }
                                }}
                                onBlur={() => saveCurrentEdit()}
                                autoFocus
                                placeholder="Categoría..."
                                className="w-32 px-2 py-1 text-xs border border-indigo-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-bold"
                              />
                              <datalist id={`category-list-${prod.id}`}>
                                {allCategoryNames.map(c => <option key={c} value={c} />)}
                              </datalist>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group/cell">
                              <span
                                onClick={() => handleStartEdit(prod, 'category')}
                                className={`bg-slate-100/60 px-2 py-1 rounded-lg text-[10px] text-slate-700 transition-all ${
                                  permissions.manageProducts ? 'hover:bg-indigo-50 hover:text-indigo-700 hover:ring-1 hover:ring-indigo-300 cursor-pointer' : ''
                                }`}
                                title={permissions.manageProducts ? 'Clic para editar categoría' : undefined}
                              >
                                {prod.category || 'Sin Categoría'}
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
                                onChange={(val) => setActiveEdit(prev => prev ? { ...prev, value: val } : null)}
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
                                  permissions.manageProducts ? 'hover:bg-indigo-50 hover:text-indigo-700 hover:ring-1 hover:ring-indigo-300 cursor-pointer' : ''
                                }`}
                                title={permissions.manageProducts ? 'Clic para editar proveedor' : undefined}
                              >
                                {prod.provider ? (
                                  prod.provider
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
                          <span className={`text-xs font-black px-2.5 py-1 rounded-xl shadow-xs inline-block min-w-[70px] ${
                            prod.stock <= 5
                              ? 'bg-rose-50 text-rose-600 border border-rose-100 animate-pulse'
                              : prod.stock <= 15
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {prod.stock} un.
                          </span>
                        </td>

                        {/* 5. Costo */}
                        <td className="py-3.5 px-4 text-right font-bold text-slate-600 font-mono">
                          {activeEdit?.productId === prod.id && activeEdit?.field === 'cost' ? (
                            <div className="flex items-center justify-end gap-1" onMouseDown={(e) => e.stopPropagation()}>
                              <span className="text-xs font-bold text-slate-400">RD$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={activeEdit.value || ''}
                                onChange={(e) => setActiveEdit({ ...activeEdit, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); saveCurrentEdit(); }
                                  if (e.key === 'Escape') { e.preventDefault(); setActiveEdit(null); }
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
                                  permissions.manageProducts ? 'hover:bg-indigo-50 hover:text-indigo-700 hover:ring-1 hover:ring-indigo-300 cursor-pointer' : ''
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
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={activeEdit.value || ''}
                                onChange={(e) => setActiveEdit({ ...activeEdit, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); saveCurrentEdit(); }
                                  if (e.key === 'Escape') { e.preventDefault(); setActiveEdit(null); }
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
                                  permissions.manageProducts ? 'hover:bg-indigo-50 hover:text-indigo-700 hover:ring-1 hover:ring-indigo-300 cursor-pointer' : ''
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
                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${
                            margin >= 40 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                              : margin >= 15 
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-150' 
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
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
                                title={prod.visible === false ? "Mostrar en catálogo de ventas" : "Ocultar de catálogo de ventas"}
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
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Table Footer Results Counter */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-right text-[11px] text-slate-500 font-bold">
              Mostrando {sortedProducts.length} de {products.length} productos registrados.
            </div>
          </div>
        )}
      </div>

      {isImportWizardOpen && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl border border-slate-100">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-600">Cargando Asistente de Importación...</span>
            </div>
          </div>
        }>
          <ImportWizardModal 
            isOpen={isImportWizardOpen}
            onClose={() => setIsImportWizardOpen(false)}
            products={products}
            categories={categories}
          />
        </React.Suspense>
      )}
    </div>
  );
};
