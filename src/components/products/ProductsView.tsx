import React, { useState, useEffect } from 'react';
import { Product, Category, Sale, EmployeePermissions } from '../../types';
const CatalogTab = React.lazy(() => import('./CatalogTab').then(m => ({ default: m.CatalogTab })));
import { ProductFormTab } from './ProductFormTab';
import { StockAddTab } from './StockAddTab';
const InventoryTab = React.lazy(() => import('./InventoryTab').then(m => ({ default: m.InventoryTab })));
const KitsTab = React.lazy(() => import('./KitsTab').then(m => ({ default: m.KitsTab })));
import { DepartmentsSuppliersTab } from './DepartmentsSuppliersTab';
const ProductSalesTab = React.lazy(() => import('./ProductSalesTab').then(m => ({ default: m.ProductSalesTab })));
import { firestoreService } from '../../lib/firebase';
import { deleteField } from 'firebase/firestore';
import { 
  Package, 
  PlusCircle, 
  FilePlus2, 
  X, 
  ArrowLeft,
  LayoutGrid,
  Settings,
  Box,
  Layers,
  Tags,
  BarChart2
} from 'lucide-react';

interface ProductsViewProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  onAddProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  sales: Sale[];
  initialTab?: TabId;
  initialProductId?: string | null;
  permissions: EmployeePermissions;
}

type TabId = 'catalog' | 'edit' | 'add' | 'inventory' | 'kits' | 'categories_suppliers' | 'sales';

export const ProductsView: React.FC<ProductsViewProps> = ({
  isOpen,
  onClose,
  products,
  categories,
  onAddProduct,
  onDeleteProduct,
  sales,
  initialTab,
  initialProductId = null,
  permissions,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab || 'catalog');
  const [editingProductId, setEditingProductId] = useState<string | null>(initialProductId);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    if (initialProductId) setEditingProductId(initialProductId);
  }, [initialTab, initialProductId]);

  // Migration: department -> category (One-time run when products load)
  useEffect(() => {
    const productsToMigrate = products.filter(p => {
      const legacy = p as any;
      return legacy.department && (!p.category || p.category.trim() === '');
    });

    if (productsToMigrate.length > 0) {
      const migrate = async () => {
        try {
          const ops = productsToMigrate.map(p => ({
            type: 'update' as const,
            collectionName: 'products',
            id: p.id,
            data: {
              category: (p as any).department,
              department: deleteField()
            }
          }));
          await firestoreService.runBatch(ops);
          console.log(`Migrated ${productsToMigrate.length} products from department to category.`);
        } catch (err) {
          console.error("Migration error:", err);
        }
      };
      migrate();
    }
  }, [products]);

  if (!isOpen) return null;

  const tabs = [
    {
      id: 'catalog' as TabId,
      label: 'Catálogo',
      icon: LayoutGrid,
      show: true,
    },
    {
      id: 'edit' as TabId,
      label: editingProductId ? 'Editar Producto' : 'Nuevo Producto',
      icon: PlusCircle,
      show: permissions.manageProducts,
    },
    {
      id: 'add' as TabId,
      label: 'Agregar Stock',
      icon: FilePlus2,
      show: permissions.manageProducts,
    },
    {
      id: 'inventory' as TabId,
      label: 'Inventariar',
      icon: Box,
      show: permissions.manageProducts,
    },
    {
      id: 'kits' as TabId,
      label: 'Kits/Promo',
      icon: Layers,
      show: permissions.manageProducts,
    },
    {
      id: 'categories_suppliers' as TabId,
      label: 'Categorías/Proveedores',
      icon: Tags,
      show: permissions.manageProducts,
    },
    {
      id: 'sales' as TabId,
      label: 'Ventas p/Producto',
      icon: BarChart2,
      show: permissions.viewDashboard,
    },
  ].filter(t => t.show);

  const handleEditClick = (id: string) => {
    if (!permissions.manageProducts) return;
    setEditingProductId(id);
    setActiveTab('edit');
  };

  const handleNewClick = () => {
    if (!permissions.manageProducts) return;
    setEditingProductId(null);
    setActiveTab('edit');
  };

  const handleFormSuccess = (updatedProduct: Product) => {
    onAddProduct(updatedProduct);
    setEditingProductId(null);
    setActiveTab('catalog');
  };

  const handleFormCancel = () => {
    setEditingProductId(null);
    setActiveTab('catalog');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 animate-fade-in h-screen w-screen overflow-hidden">
      
      {/* Top Main Navigation Header */}
      <header className="bg-white border-b border-slate-200 shrink-0 shadow-xs px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer text-slate-500 hover:text-slate-800"
            title="Volver a ventas"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-850 flex items-center gap-2">
              <Package className="w-5.5 h-5.5 text-slate-900" />
              <span>GESTIÓN DE PRODUCTOS</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Módulos avanzados de catálogo e inventarios</p>
          </div>
        </div>

        {/* Tab Selector Pills (Sólido oscuro en la pestaña activa, texto claro en las inactivas) */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'edit' && !editingProductId) {
                    handleNewClick();
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Back to sales button */}
        <button
          onClick={onClose}
          className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0 uppercase tracking-wider"
        >
          <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-black">F1</span>
          <span>Ventas</span>
        </button>
      </header>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'catalog' && (
          <React.Suspense fallback={
            <div className="p-8 text-center text-slate-500 font-bold flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Cargando Catálogo de Productos...</span>
            </div>
          }>
            <CatalogTab
              products={products}
              categories={categories}
              onEdit={handleEditClick}
              onDeleteProduct={onDeleteProduct}
              onAddProduct={onAddProduct}
              permissions={permissions}
              sales={sales}
            />
          </React.Suspense>
        )}

        {activeTab === 'edit' && (
          <ProductFormTab
            id={editingProductId}
            products={products}
            categories={categories}
            onSuccess={handleFormSuccess}
            onCancel={handleFormCancel}
          />
        )}

        {activeTab === 'add' && (
          <StockAddTab
            products={products}
            onBatchSuccess={() => {
              // Optionally do something on successful batch restock
            }}
          />
        )}

        {activeTab === 'inventory' && (
          <React.Suspense fallback={
            <div className="p-8 text-center text-slate-500 font-bold flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Cargando Módulo de Inventario...</span>
            </div>
          }>
            <InventoryTab
              products={products}
              onBatchSuccess={() => {}}
            />
          </React.Suspense>
        )}

        {activeTab === 'kits' && (
          <React.Suspense fallback={
            <div className="p-8 text-center text-slate-500 font-bold flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Cargando Módulo de Combos...</span>
            </div>
          }>
            <KitsTab
              products={products}
              categories={categories}
              onAddProduct={onAddProduct}
              onDeleteProduct={onDeleteProduct}
            />
          </React.Suspense>
        )}

        {activeTab === 'categories_suppliers' && (
          <DepartmentsSuppliersTab
            products={products}
            onEditProduct={handleEditClick}
          />
        )}

        {activeTab === 'sales' && (
          <React.Suspense fallback={
            <div className="p-8 text-center text-slate-500 font-bold flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Cargando Módulo de Ventas por Producto...</span>
            </div>
          }>
            <ProductSalesTab
              sales={sales}
              products={products}
            />
          </React.Suspense>
        )}
      </main>

    </div>
  );
};
