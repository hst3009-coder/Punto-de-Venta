import React, { useState, useMemo, useRef } from 'react';
import { Product, Category, EmployeePermissions, Sale, DashboardConfig } from '../../types';
import { matchesProductSearch, rankSearchResults } from '../../lib/search';
import { getSaleTimestamp } from '../../lib/dates';
import * as XLSX from 'xlsx';
import { useAlert } from '../../context/AlertContext';
import { firestoreService } from '../../lib/firebase';
import { roundCents, getPreTaxAmount } from '../../lib/money';
import { getStringValue } from '../../lib/normalize';
import { CatalogSearchBar } from '../catalog/CatalogSearchBar';
import { BulkActionsBar } from '../catalog/BulkActionsBar';
import { ProductTable, SortField, SortOrder, InlineField, ActiveInlineEdit, InlineFeedback } from '../catalog/ProductTable';

function lazyWithRetry(componentImport: () => Promise<any>, exportName?: string) {
  return React.lazy(async () => {
    try {
      const m = await componentImport();
      return { default: exportName ? m[exportName] : (m.default || m) };
    } catch (error) {
      console.warn('Dynamic import failed, retrying...', error);
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        const m = await componentImport();
        return { default: exportName ? m[exportName] : (m.default || m) };
      } catch (retryErr) {
        throw retryErr;
      }
    }
  });
}

const ImportWizardModal = lazyWithRetry(() => import('./ImportWizardModal'), 'ImportWizardModal');

import { 
  Package, 
  Upload, 
  Download, 
  DollarSign, 
  Boxes
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
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

  // Inline editing state
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
      const cat = getStringValue(p.category).trim();
      if (cat) {
        set.add(cat);
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
    else if (field === 'category') initialVal = getStringValue(prod.category);
    else if (field === 'provider') initialVal = getStringValue(prod.provider);
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
       const prodCat = getStringValue(prod.category).trim().toLowerCase();
       const matchesCategory = selectedCategory === 'all' || 
         (prodCat !== '' && prodCat === selectedCategory.toLowerCase());
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
        valA = getStringValue(a.category).toLowerCase();
        valB = getStringValue(b.category).toLowerCase();
      } else if (sortField === 'provider') {
        valA = getStringValue(a.provider).toLowerCase();
        valB = getStringValue(b.provider).toLowerCase();
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
      setSortOrder('desc');
    }
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
      <CatalogSearchBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSearchExpanded={isSearchExpanded}
        setIsSearchExpanded={setIsSearchExpanded}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categoriesList={categoriesList}
      />

      {/* 3. PRODUCT CATALOG TABLE VIEW */}
      <div className="flex-1 overflow-auto p-6">
        {/* Batch Actions Bar */}
        <BulkActionsBar
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          permissions={permissions}
          products={products}
          categoriesList={categoriesList}
          batchActionMenu={batchActionMenu}
          setBatchActionMenu={setBatchActionMenu}
          batchPriceMode={batchPriceMode}
          setBatchPriceMode={setBatchPriceMode}
          batchPriceValue={batchPriceValue}
          setBatchPriceValue={setBatchPriceValue}
          batchTargetId={batchTargetId}
          setBatchTargetId={setBatchTargetId}
          onBatchPriceUpdate={handleBatchPriceUpdate}
          onBatchCategoryUpdate={handleBatchCategoryUpdate}
          onBatchProviderUpdate={handleBatchProviderUpdate}
          onBatchToggleVisible={handleBatchToggleVisible}
          onBatchDelete={handleBatchDelete}
        />

        <ProductTable
          products={products}
          sortedProducts={sortedProducts}
          categories={categories}
          dashboardConfig={dashboardConfig}
          permissions={permissions}
          selectedIds={selectedIds}
          toggleSelectAll={toggleSelectAll}
          toggleSelectProduct={toggleSelectProduct}
          sortField={sortField}
          sortOrder={sortOrder}
          toggleSort={toggleSort}
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
        />
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
