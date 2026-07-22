import React, { useState, useMemo } from 'react';
import { Product, SupplierReturn, Employee } from '../types';
import { SupplierPicker } from './SupplierPicker';
import { firestoreService } from '../lib/firebase';
import { useAlert } from '../context/AlertContext';
import { getEmployeePermissions } from '../lib/permissions';
import { 
  Package, 
  Plus, 
  Check, 
  Search, 
  Calendar, 
  Coins, 
  FileText, 
  Trash2, 
  AlertCircle, 
  Clock, 
  ShieldCheck,
  Tag
} from 'lucide-react';

interface ReturnsViewProps {
  products: Product[];
  supplierReturns: SupplierReturn[];
  currentEmployee: Employee | null;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({
  products,
  supplierReturns = [],
  currentEmployee,
}) => {
  const permissions = useMemo(() => getEmployeePermissions(currentEmployee), [currentEmployee]);
  const { showAlert, showConfirm } = useState(() => {
    // We can also import and use the real useAlert context
    return {
      showAlert: async (title: string, desc: string, type: 'success' | 'error' | 'warning' | 'info') => {
        alert(`${title}: ${desc}`);
      },
      showConfirm: async (title: string, desc: string) => {
        return window.confirm(`${title}\n\n${desc}`);
      }
    };
  });
  
  // Real alert hook fallback
  const realAlert = useAlert();
  const alertFn = realAlert?.showAlert ? realAlert.showAlert : showAlert;
  const confirmFn = realAlert?.showConfirm ? realAlert.showConfirm : showConfirm;

  // Form State
  const [supplierName, setSupplierName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [costAmount, setCostAmount] = useState<number | ''>('');
  
  // UI States
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'credited'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Filtered Products for selection
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products.filter(
      p => 
        p.name.toLowerCase().includes(q) || 
        (p.code && p.code.toLowerCase().includes(q)) || 
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 8); // limit to 8 suggestions
  }, [productSearch, products]);

  // Handle product selection
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setShowProductDropdown(false);
    
    // Auto-fill cost if quantity is set, or default cost
    const qty = typeof quantity === 'number' ? quantity : 1;
    const unitCost = product.cost || 0;
    setCostAmount(unitCost * qty);
    if (quantity === '') {
      setQuantity(1);
    }
  };

  // Adjust cost whenever quantity changes
  const handleQuantityChange = (val: number | '') => {
    setQuantity(val);
    if (selectedProduct) {
      const qty = typeof val === 'number' ? val : 0;
      const unitCost = selectedProduct.cost || 0;
      setCostAmount(unitCost * qty);
    }
  };

  // Handle form submission to save return
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplierName.trim()) {
      await alertFn('Proveedor requerido', 'Debe ingresar o seleccionar un proveedor.', 'warning');
      return;
    }
    if (!selectedProduct) {
      await alertFn('Producto requerido', 'Debe seleccionar un producto válido del catálogo.', 'warning');
      return;
    }
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      await alertFn('Cantidad inválida', 'La cantidad devuelta debe ser mayor a cero.', 'warning');
      return;
    }
    const cost = Number(costAmount);
    if (isNaN(cost) || cost < 0) {
      await alertFn('Costo inválido', 'El monto a costo no puede ser menor a cero.', 'warning');
      return;
    }

    if (qty > selectedProduct.stock) {
      const confirmExceed = await confirmFn(
        'Stock Insuficiente',
        `La cantidad a devolver (${qty}) es mayor al stock actual del producto (${selectedProduct.stock}). ¿Desea continuar de todos modos?`
      );
      if (!confirmExceed) return;
    }

    try {
      const confirmSave = await confirmFn(
        'Confirmar Devolución',
        `¿Está seguro de registrar la devolución de ${qty} unidad(es) de "${selectedProduct.name}" al proveedor "${supplierName}" por un valor total de costo de RD$ ${cost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}?`
      );
      if (!confirmSave) return;

      // 1. Calculate new stock
      const newStock = Math.max(0, selectedProduct.stock - qty);

      // 2. Subtract from product stock using runBatch
      await firestoreService.runBatch([
        {
          type: 'update',
          collectionName: 'products',
          id: selectedProduct.id,
          data: { stock: newStock }
        }
      ]);

      // 3. Create document in supplierReturns (status: 'pending') via firestoreService.addDoc
      const returnDoc: Omit<SupplierReturn, 'id'> = {
        supplierName: supplierName.trim(),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: qty,
        reason: reason.trim() || 'Sin motivo especificado',
        cost: cost,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
      };

      await firestoreService.addDoc('supplierReturns', returnDoc);

      await alertFn('Éxito', 'La devolución se ha registrado correctamente y el stock ha sido actualizado.', 'success');

      // Clear Form State
      setSupplierName('');
      setProductSearch('');
      setSelectedProduct(null);
      setQuantity('');
      setReason('');
      setCostAmount('');
    } catch (error) {
      console.error('Error saving supplier return:', error);
      await alertFn('Error', 'No se pudo guardar la devolución a proveedor.', 'error');
    }
  };

  // Handle Mark as Credited
  const handleMarkAsCredited = async (ret: SupplierReturn) => {
    try {
      const confirmCredit = await confirmFn(
        'Marcar como Acreditada',
        `¿Confirmar que la devolución de "${ret.productName}" por RD$ ${ret.cost.toLocaleString('es-DO', { minimumFractionDigits: 2 })} ha sido acreditada o reembolsada por el proveedor?`
      );
      if (!confirmCredit) return;

      await firestoreService.updateDoc('supplierReturns', ret.id, {
        status: 'credited'
      });

      await alertFn('Acreditada', 'La devolución se ha marcado como acreditada con éxito.', 'success');
    } catch (error) {
      console.error('Error updating supplier return status:', error);
      await alertFn('Error', 'No se pudo actualizar el estado de la devolución.', 'error');
    }
  };

  // Filter returns based on search query and status filter
  const filteredReturns = useMemo(() => {
    return supplierReturns.filter(ret => {
      const matchesStatus = filterStatus === 'all' || ret.status === filterStatus;
      const matchesSearch = 
        ret.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ret.reason && ret.reason.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    }).sort((a, b) => {
      // Sort by date descending
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [supplierReturns, filterStatus, searchQuery]);

  return (
    <div id="returns-view-root" className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-start">
      {/* Column 1: Form (lg:span-5) */}
      {permissions.manageReturns && (
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase text-slate-800 tracking-wider">Registrar Devolución</h2>
            <p className="text-[10px] font-bold text-slate-400">Resta stock y genera nota de crédito pendiente</p>
          </div>
        </div>

        <form onSubmit={handleSubmitReturn} className="space-y-4">
          {/* Supplier Name (with SupplierPicker) */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">
              Proveedor
            </label>
            <SupplierPicker
              value={supplierName}
              onChange={setSupplierName}
              products={products}
              placeholder="Escribe o selecciona proveedor..."
            />
          </div>

          {/* Product Search Catalog */}
          <div className="space-y-1 relative">
            <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">
              Buscar Producto
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowProductDropdown(true);
                  if (!e.target.value.trim()) {
                    setSelectedProduct(null);
                  }
                }}
                onFocus={() => setShowProductDropdown(true)}
                placeholder="Escribe nombre, código o SKU..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                autoComplete="off"
              />
            </div>

            {/* Dropdown for products matching */}
            {showProductDropdown && filteredProducts.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto py-1">
                {filteredProducts.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProduct(prod)}
                    className="w-full text-left px-3.5 py-2 text-xs border-b border-slate-50 last:border-0 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-700">{prod.name}</span>
                      {prod.code && <span className="text-[10px] text-slate-400 ml-1.5">({prod.code})</span>}
                    </div>
                    <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      Stock: {prod.stock}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Product Summary Card */}
            {selectedProduct && (
              <div className="mt-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-indigo-900">{selectedProduct.name}</h4>
                  <p className="text-[10px] text-slate-500">
                    Costo unitario registrado: RD$ {(selectedProduct.cost || 0).toFixed(2)} | Stock actual: {selectedProduct.stock}
                  </p>
                </div>
                <Tag className="w-4 h-4 text-indigo-600" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">
                Cantidad a devolver
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="1"
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Cost Amount (Monto a Costo) */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">
                Monto a costo total (RD$)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">
              Motivo de la Devolución
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Escribe el motivo (ej. Vencimiento, Defectuoso, Sobre-stock)..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Devolución</span>
          </button>
        </form>
      </div>
      )}

      {/* Column 2: History List (lg:span-7 or lg:span-12) */}
      <div className={`${permissions.manageReturns ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col h-full min-h-[500px]`}>
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-black uppercase text-slate-800 tracking-wider">Historial de Devoluciones</h2>
            <p className="text-[10px] font-bold text-slate-400">Listado de notas de crédito registradas</p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all ${
                filterStatus === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all ${
                filterStatus === 'pending'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFilterStatus('credited')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all ${
                filterStatus === 'credited'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Acreditadas
            </button>
          </div>
        </div>

        {/* Search inside history */}
        <div className="mt-3 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por proveedor o producto..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white"
          />
        </div>

        {/* Scrollable List container */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1 max-h-[420px]">
          {filteredReturns.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl">
              <FileText className="w-10 h-10 mx-auto mb-2.5 text-slate-300" />
              <p className="text-xs font-bold">No se encontraron devoluciones</p>
              <p className="text-[10px] mt-0.5">Las devoluciones registradas aparecerán aquí.</p>
            </div>
          ) : (
            filteredReturns.map((ret) => (
              <div 
                key={ret.id} 
                className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  ret.status === 'credited' 
                    ? 'border-emerald-100 bg-emerald-50/10' 
                    : 'border-slate-200 hover:border-indigo-150'
                }`}
              >
                {/* Return Information */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-slate-800 uppercase">
                      {ret.supplierName}
                    </span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      ret.status === 'credited'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {ret.status === 'credited' ? 'Acreditada' : 'Pendiente'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-600">
                    {ret.quantity}x {ret.productName}
                  </h4>

                  {ret.reason && (
                    <p className="text-[10px] text-slate-500 italic">
                      Motivo: {ret.reason}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      {ret.date}
                    </span>
                    <span>•</span>
                    <span className="font-extrabold text-indigo-600">
                      Monto a Costo: RD$ {ret.cost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Mark as Credited Button */}
                {ret.status === 'pending' && permissions.manageReturns && (
                  <button
                    onClick={() => handleMarkAsCredited(ret)}
                    className="self-start sm:self-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-lg flex items-center gap-1 shadow-xs hover:shadow-emerald-50 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Acreditar</span>
                  </button>
                )}
                
                {ret.status === 'credited' && (
                  <div className="text-emerald-600 flex items-center gap-1 self-start sm:self-center bg-emerald-50 px-2.5 py-1 rounded-lg">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-wider">Completado</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
