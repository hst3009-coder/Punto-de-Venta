import React, { useState, useMemo, useEffect } from 'react';
import { Product } from '../../types';
import { matchesProductSearch } from '../../lib/search';
import { firestoreService } from '../../lib/firebase';
import * as XLSX from 'xlsx';
import { useAlert } from '../../context/AlertContext';
import { 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  ShoppingBag, 
  ArrowRight, 
  X, 
  Download, 
  ShieldAlert,
  Barcode
} from 'lucide-react';

interface InventoryTabProps {
  products: Product[];
  onBatchSuccess: () => void;
}

interface StagedInventoryItem {
  id: string;
  product: Product;
  currentStock: number;
  newCount: number;
  difference: number;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ products, onBatchSuccess }) => {
  const { showAlert } = useAlert();
  const [showBackupModal, setShowBackupModal] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form field
  const [newCount, setNewCount] = useState('');

  // Staged reconciliation items
  const [stagedItems, setStagedItems] = useState<StagedInventoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Backup Excel file generation
  const handleBackupExcel = () => {
    try {
      const backupData = products.map((p) => ({
        ID: p.id,
        Código: p.code || p.barcode || p.id,
        SKU: p.sku || '',
        Nombre: p.name,
        Categoría: p.category,
        Precio_Venta: p.price,
        Costo: p.cost || 0,
        Stock_Actual: p.stock,
        Proveedor: p.provider || '',
      }));

      const ws = XLSX.utils.json_to_sheet(backupData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Catálogo_Completo');
      XLSX.writeFile(wb, `respaldo_inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Error backing up catalog:', err);
    } finally {
      setShowBackupModal(false);
    }
  };

  // Search filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return products.filter((p) => matchesProductSearch(p, searchQuery)).slice(0, 5);
  }, [products, searchQuery]);

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setNewCount(prod.stock.toString());
    setSearchQuery('');
  };

  const handleAddToStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const countVal = parseInt(newCount);
    if (isNaN(countVal) || countVal < 0) {
      await showAlert(
        'Conteo Inválido',
        'Ingresa un conteo válido (0 o superior)',
        'warning'
      );
      return;
    }

    const currentStock = selectedProduct.stock;
    const difference = countVal - currentStock;

    const newItem: StagedInventoryItem = {
      id: crypto.randomUUID(),
      product: selectedProduct,
      currentStock,
      newCount: countVal,
      difference,
    };

    setStagedItems((prev) => {
      // If product already in staged, replace it
      const filtered = prev.filter((item) => item.product.id !== selectedProduct.id);
      return [...filtered, newItem];
    });

    setSelectedProduct(null);
    setNewCount('');
  };

  const handleRemoveStaged = (id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleProcessInventory = async () => {
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

      // We will perform updates setting stock = newCount
      for (const item of stagedItems) {
        operations.push({
          type: 'update',
          collectionName: 'products',
          id: item.product.id,
          data: {
            stock: item.newCount,
          },
        });
      }

      await firestoreService.runBatch(operations);

      // Generate the 3-sheet xlsx report
      // Sheet 1: General Summary
      const summaryData = stagedItems.map((item) => ({
        Código: item.product.code || item.product.barcode || item.product.id,
        Nombre: item.product.name,
        Categoría: item.product.category,
        Stock_Anterior: item.currentStock,
        Nuevo_Conteo: item.newCount,
        Diferencia: item.difference,
        Estado: item.difference === 0 ? 'Correcto' : item.difference > 0 ? 'Sobrante' : 'Faltante',
      }));

      // Sheet 2: Faltantes (Negatives)
      const negatives = stagedItems
        .filter((item) => item.difference < 0)
        .map((item) => ({
          Código: item.product.code || item.product.barcode || item.product.id,
          Nombre: item.product.name,
          Categoría: item.product.category,
          Stock_Anterior: item.currentStock,
          Nuevo_Conteo: item.newCount,
          Diferencia: item.difference,
        }));

      // Sheet 3: Sobrantes (Positives)
      const positives = stagedItems
        .filter((item) => item.difference > 0)
        .map((item) => ({
          Código: item.product.code || item.product.barcode || item.product.id,
          Nombre: item.product.name,
          Categoría: item.product.category,
          Stock_Anterior: item.currentStock,
          Nuevo_Conteo: item.newCount,
          Diferencia: item.difference,
        }));

      const wb = XLSX.utils.book_new();
      
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen General');

      const wsNegatives = XLSX.utils.json_to_sheet(negatives.length > 0 ? negatives : [{ Mensaje: 'No hay faltantes registrados' }]);
      XLSX.utils.book_append_sheet(wb, wsNegatives, 'Faltantes');

      const wsPositives = XLSX.utils.json_to_sheet(positives.length > 0 ? positives : [{ Mensaje: 'No hay sobrantes registrados' }]);
      XLSX.utils.book_append_sheet(wb, wsPositives, 'Sobrantes');

      XLSX.writeFile(wb, `reporte_conciliacion_${new Date().toISOString().split('T')[0]}.xlsx`);

      setNotification({
        message: `¡Éxito! Se actualizó el stock físico de ${stagedItems.length} productos. Reporte de diferencias descargado.`,
        type: 'success',
      });
      setStagedItems([]);
      onBatchSuccess();
    } catch (err: any) {
      console.error('Error in physical inventory processing:', err);
      setNotification({
        message: 'Hubo un error al procesar el inventario: ' + (err.message || String(err)),
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-100 overflow-hidden relative">
      
      {/* Backup Warn Modal/Overlay */}
      {showBackupModal && (
        <div className="absolute inset-0 z-40 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200/80 shadow-2xl space-y-5 text-center animate-fade-in">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 border border-amber-250 flex items-center justify-center text-amber-500 shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-md font-black text-slate-850 uppercase tracking-tight">
                ¿Respaldar antes de comenzar?
              </h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Se recomienda exportar una copia del inventario actual a Excel antes de realizar un ajuste o conteo físico masivo para evitar pérdida accidental de datos.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleBackupExcel}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Respaldar en Excel</span>
              </button>
              <button
                onClick={() => setShowBackupModal(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Omitir Respaldo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT PANEL: Search and Product physical reconciliation count form */}
      <div className="flex-1 p-6 bg-white border-r border-slate-200 overflow-y-auto space-y-6">
        
        {/* Large search input */}
        <div className="space-y-2">
          <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">
            Buscar Producto a Inventariar
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input autoComplete="off"
              type="text"
              placeholder="MAYÚSCULAS O ESCÁNER..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-2xl text-md font-black text-slate-850 focus:outline-none transition-all placeholder:text-slate-400 uppercase"
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
                        Cód: {prod.code || prod.barcode || prod.id} | Stock Actual: {prod.stock}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Product count form */}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Código de Barras
                </label>
                <input autoComplete="off"
                  type="text"
                  readOnly
                  value={selectedProduct.code || selectedProduct.barcode || selectedProduct.id}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-250 bg-slate-100 text-xs font-semibold text-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                  Precio de Venta ($)
                </label>
                <input autoComplete="off"
                  type="text"
                  readOnly
                  value={`$${selectedProduct.price.toFixed(2)}`}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-250 bg-slate-100 text-xs font-semibold text-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Stock Teórico (Sistema)
                </label>
                <div className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-extrabold text-slate-700">
                  {selectedProduct.stock} unidades
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider block mb-1">
                  Nuevo Conteo Físico *
                </label>
                <input autoComplete="off"
                  type="number"
                  inputMode="numeric"
                  required
                  min="0"
                  value={newCount}
                  onChange={(e) => setNewCount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-indigo-300 bg-white text-xs font-black text-slate-850 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Ej. 45"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar a la lista conciliada</span>
            </button>
          </form>
        ) : (
          <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-6">
            <ShoppingBag className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-extrabold text-slate-500">Busca y selecciona un producto para conciliar</p>
            <p className="text-[10px] text-slate-400 mt-1">Ingresa el conteo físico real. El sistema calculará automáticamente diferencias (sobrantes o faltantes).</p>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: List of reconciled items */}
      <div className="w-full md:w-[420px] bg-slate-50 p-6 flex flex-col min-h-0">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200 shrink-0">
          <div>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-15">
              <span>Productos Reconciliados</span>
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md text-[10px] font-black">
                {stagedItems.length}
              </span>
            </h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Ajuste de diferencias físicas</p>
          </div>
          {stagedItems.length > 0 && (
            <button
              onClick={() => setStagedItems([])}
              className="text-[10px] font-black text-rose-600 hover:text-rose-800 hover:underline uppercase tracking-wider cursor-pointer"
            >
              Limpiar todo
            </button>
          )}
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
          {stagedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <ShoppingBag className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-extrabold text-slate-500">Sin reconciliaciones aún</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Agrega productos contados para procesar la actualización del inventario.</p>
            </div>
          ) : (
            stagedItems.map((item) => {
              const diff = item.difference;
              const badgeClass = 
                diff === 0 
                  ? 'bg-slate-100 text-slate-600 border-slate-200' 
                  : diff > 0 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                  : 'bg-rose-50 text-rose-700 border-rose-150';

              const diffText = diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`;
              const labelText = diff === 0 ? 'Correcto' : diff > 0 ? 'Sobrante' : 'Faltante';

              return (
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
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Cód: {item.product.code || item.product.barcode || item.product.id}
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold mt-1">
                      Anterior: <span className="font-bold text-slate-600">{item.currentStock}</span> | Conteo: <span className="font-extrabold text-slate-700">{item.newCount}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right flex flex-col items-end gap-0.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${badgeClass}`}>
                        {diffText}
                      </span>
                      <span className="text-[8px] font-extrabold uppercase text-slate-400">
                        {labelText}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveStaged(item.id)}
                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Quitar de reconciliación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Button */}
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
            onClick={handleProcessInventory}
            disabled={stagedItems.length === 0 || isProcessing}
            className={`w-full py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
              stagedItems.length === 0 || isProcessing
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-slate-900 hover:bg-slate-850 text-white shadow-slate-900/10'
            }`}
          >
            {isProcessing ? (
              <span>Procesando e imprimiendo reporte...</span>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Procesar e Imprimir Inventario</span>
              </>
            )}
          </button>
        </div>

      </div>

    </div>
  );
};

export default InventoryTab;
