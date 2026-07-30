import React, { useState, useMemo } from 'react';
import { Product, SupplierReturn, SupplierCreditNote, AccountPayable, Employee } from '../types';
import { SupplierPicker } from './SupplierPicker';
import { firestoreService } from '../lib/firebase';
import { useAlert } from '../context/AlertContext';
import { usePermissions } from '../hooks/usePermissions';
import { getStringValue } from '../lib/normalize';
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
  Tag,
  CreditCard,
  X,
  Banknote,
  DollarSign,
  ArrowRight
} from 'lucide-react';

interface ReturnsViewProps {
  products: Product[];
  supplierReturns: SupplierReturn[];
  supplierCreditNotes?: SupplierCreditNote[];
  payables?: AccountPayable[];
  currentEmployee: Employee | null;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({
  products,
  supplierReturns = [],
  supplierCreditNotes = [],
  payables = [],
  currentEmployee,
}) => {
  const permissions = usePermissions(currentEmployee);
  const realAlert = useAlert();

  // Tab View inside ReturnsView
  const [activeSubTab, setActiveSubTab] = useState<'returns' | 'credit_notes'>('returns');

  // Form State for Supplier Return
  const [supplierName, setSupplierName] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [costAmount, setCostAmount] = useState<number | ''>('');
  
  // UI States for Returns list
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'credited'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Accreditation Modal State
  const [returnToCredit, setReturnToCredit] = useState<SupplierReturn | null>(null);
  const [isProcessingAccreditation, setIsProcessingAccreditation] = useState(false);

  // Manual Credit Note Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualSupplierName, setManualSupplierName] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [isSavingManualNote, setIsSavingManualNote] = useState(false);

  // Filtered Products for selection in return form
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products.filter(
      p => 
        p.name.toLowerCase().includes(q) || 
        (p.code && p.code.toLowerCase().includes(q)) || 
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [productSearch, products]);

  // Handle product selection
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setShowProductDropdown(false);
    
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
    
    if (!getStringValue(supplierName).trim()) {
      await realAlert.showAlert('Proveedor requerido', 'Debe ingresar o seleccionar un proveedor.', 'warning');
      return;
    }
    if (!selectedProduct) {
      await realAlert.showAlert('Producto requerido', 'Debe seleccionar un producto válido del catálogo.', 'warning');
      return;
    }
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      await realAlert.showAlert('Cantidad inválida', 'La cantidad devuelta debe ser mayor a cero.', 'warning');
      return;
    }
    const cost = Number(costAmount);
    if (isNaN(cost) || cost < 0) {
      await realAlert.showAlert('Costo inválido', 'El monto a costo no puede ser menor a cero.', 'warning');
      return;
    }

    if (qty > selectedProduct.stock) {
      const confirmExceed = await realAlert.showConfirm(
        'Stock Insuficiente',
        `La cantidad a devolver (${qty}) es mayor al stock actual del producto (${selectedProduct.stock}). ¿Desea continuar de todos modos?`
      );
      if (!confirmExceed) return;
    }

    try {
      const confirmSave = await realAlert.showConfirm(
        'Confirmar Devolución',
        `¿Está seguro de registrar la devolución de ${qty} unidad(es) de "${getStringValue(selectedProduct.name)}" al proveedor "${getStringValue(supplierName)}" por un valor total de costo de RD$ ${cost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}?`
      );
      if (!confirmSave) return;

      const newStock = Math.max(0, selectedProduct.stock - qty);

      await firestoreService.runBatch([
        {
          type: 'update',
          collectionName: 'products',
          id: selectedProduct.id,
          data: { stock: newStock }
        }
      ]);

      const returnDoc: Omit<SupplierReturn, 'id'> = {
        supplierName: getStringValue(supplierName).trim(),
        productId: selectedProduct.id,
        productName: getStringValue(selectedProduct.name),
        quantity: qty,
        reason: getStringValue(reason).trim() || 'Sin motivo especificado',
        cost: cost,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
      };

      await firestoreService.addDoc('supplierReturns', returnDoc);

      await realAlert.showAlert('Éxito', 'La devolución se ha registrado correctamente y el stock ha sido actualizado.', 'success');

      setSupplierName('');
      setProductSearch('');
      setSelectedProduct(null);
      setQuantity('');
      setReason('');
      setCostAmount('');
    } catch (error) {
      console.error('Error saving supplier return:', error);
      await realAlert.showAlert('Error', 'No se pudo guardar la devolución a proveedor.', 'error');
    }
  };

  // Open accreditation choice modal for a return
  const handleOpenAccreditation = (ret: SupplierReturn) => {
    setReturnToCredit(ret);
  };

  // Process Accreditation Option
  const handleConfirmAccreditation = async (method: 'cash' | 'credit_note') => {
    if (!returnToCredit) return;
    setIsProcessingAccreditation(true);

    try {
      const operations: Array<{
        type: 'set' | 'update' | 'delete';
        collectionName: string;
        id: string;
        data?: object;
        merge?: boolean;
      }> = [];

      if (method === 'credit_note') {
        const creditNoteId = crypto.randomUUID();
        const creditNoteData: SupplierCreditNote = {
          id: creditNoteId,
          supplierName: getStringValue(returnToCredit.supplierName),
          originalAmount: returnToCredit.cost,
          remainingBalance: returnToCredit.cost,
          reason: `Devolución de ${returnToCredit.quantity}x ${getStringValue(returnToCredit.productName)}` + (getStringValue(returnToCredit.reason) ? ` (${getStringValue(returnToCredit.reason)})` : ''),
          linkedReturnId: returnToCredit.id,
          status: 'active',
          employeeId: currentEmployee?.id || '',
          employeeName: currentEmployee?.name || 'Sistema',
          createdAt: new Date().toISOString()
        };

        operations.push({
          type: 'set',
          collectionName: 'supplierCreditNotes',
          id: creditNoteId,
          data: creditNoteData,
          merge: true
        });
      }

      // Mark supplierReturn as credited
      operations.push({
        type: 'update',
        collectionName: 'supplierReturns',
        id: returnToCredit.id,
        data: {
          status: 'credited'
        }
      });

      await firestoreService.runBatch(operations);

      await realAlert.showAlert(
        'Devolución Acreditada',
        method === 'credit_note'
          ? `Se marcó como acreditada y se creó una Nota de Crédito de Proveedor por RD$ ${returnToCredit.cost.toLocaleString('es-DO', { minimumFractionDigits: 2 })} a favor.`
          : 'Se marcó la devolución como acreditada por reembolso directo en dinero.',
        'success'
      );

      setReturnToCredit(null);
    } catch (error) {
      console.error('Error processing accreditation:', error);
      await realAlert.showAlert('Error', 'No se pudo procesar la acreditación.', 'error');
    } finally {
      setIsProcessingAccreditation(false);
    }
  };

  // Handle manual SupplierCreditNote creation
  const handleCreateManualCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!getStringValue(manualSupplierName).trim()) {
      await realAlert.showAlert('Error', 'Debe especificar el proveedor de la nota de crédito.', 'error');
      return;
    }
    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0) {
      await realAlert.showAlert('Error', 'El monto debe ser mayor a cero.', 'error');
      return;
    }

    setIsSavingManualNote(true);
    try {
      const creditNoteData: Omit<SupplierCreditNote, 'id'> = {
        supplierName: getStringValue(manualSupplierName).trim(),
        originalAmount: amt,
        remainingBalance: amt,
        reason: getStringValue(manualReason).trim() || 'Nota de crédito manual',
        status: 'active',
        employeeId: currentEmployee?.id || '',
        employeeName: currentEmployee?.name || 'Sistema',
        createdAt: new Date().toISOString()
      };

      await firestoreService.addDoc('supplierCreditNotes', creditNoteData);
      await realAlert.showAlert('Éxito', 'Nota de crédito de proveedor registrada correctamente.', 'success');

      setManualSupplierName('');
      setManualAmount('');
      setManualReason('');
      setShowManualModal(false);
    } catch (error) {
      console.error('Error creating manual supplier credit note:', error);
      await realAlert.showAlert('Error', 'No se pudo registrar la nota de crédito.', 'error');
    } finally {
      setIsSavingManualNote(false);
    }
  };

  // Filter returns based on search query and status filter
  const filteredReturns = useMemo(() => {
    return supplierReturns.filter(ret => {
      const matchesStatus = filterStatus === 'all' || ret.status === filterStatus;
      const matchesSearch = 
        getStringValue(ret.supplierName).toLowerCase().includes(searchQuery.toLowerCase()) ||
        getStringValue(ret.productName).toLowerCase().includes(searchQuery.toLowerCase()) ||
        getStringValue(ret.reason).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    }).sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
  }, [supplierReturns, filterStatus, searchQuery]);

  // Supplier Credit Notes stats & filter
  const activeCreditNotesTotal = useMemo(() => {
    return supplierCreditNotes
      .filter(n => n.status === 'active')
      .reduce((sum, n) => sum + (n.remainingBalance || 0), 0);
  }, [supplierCreditNotes]);

  return (
    <div id="returns-view-root" className="flex flex-col gap-5 h-full">
      
      {/* Navigation Sub-Tabs & Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase text-slate-800 tracking-wider">Gestión de Devoluciones y Créditos</h2>
            <p className="text-[10px] font-bold text-slate-400">Devoluciones a proveedores y notas de crédito a favor</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveSubTab('returns')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeSubTab === 'returns'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Devoluciones ({supplierReturns.filter(r => r.status === 'pending').length} Pnd)
            </button>
            <button
              onClick={() => setActiveSubTab('credit_notes')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'credit_notes'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Notas de Crédito (RD$ {activeCreditNotesTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })})</span>
            </button>
          </div>

          {permissions.manageReturns && (
            <button
              onClick={() => setShowManualModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nota Manual</span>
            </button>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: DEVOLUCIONES */}
      {activeSubTab === 'returns' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-start">
          {/* Column 1: Form (lg:span-5) */}
          {permissions.manageReturns && (
            <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Registrar Devolución</h3>
                  <p className="text-[10px] font-bold text-slate-400">Resta stock del catálogo e inicia proceso de crédito</p>
                </div>
              </div>

              <form onSubmit={handleSubmitReturn} className="space-y-4">
                {/* Supplier Name */}
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">
                    Proveedor
                  </label>
                  <SupplierPicker
                    value={supplierName}
                    onChange={setSupplierName}
                    products={products}
                    payables={payables}
                    placeholder="Escribe o selecciona proveedor..."
                  />
                </div>

                {/* Product Search */}
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

                  {showProductDropdown && filteredProducts.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto py-1">
                      {filteredProducts.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleSelectProduct(prod)}
                          className="w-full text-left px-3.5 py-2 text-xs border-b border-slate-50 last:border-0 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
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

                  {selectedProduct && (
                    <div className="mt-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-indigo-900">{selectedProduct.name}</h4>
                        <p className="text-[10px] text-slate-500">
                          Costo unitario: RD$ {(selectedProduct.cost || 0).toFixed(2)} | Stock actual: {selectedProduct.stock}
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
                      Cantidad
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

                  {/* Cost Amount */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wide block">
                      Costo Total (RD$)
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
                    Motivo
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Escribe el motivo (ej. Vencimiento, Defectuoso, Sobre-stock)..."
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  />
                </div>

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

          {/* Column 2: History List */}
          <div className={`${permissions.manageReturns ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col h-full min-h-[500px]`}>
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Historial de Devoluciones</h3>
                <p className="text-[10px] font-bold text-slate-400">Devoluciones registradas a proveedores</p>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-center">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all cursor-pointer ${
                    filterStatus === 'all'
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilterStatus('pending')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all cursor-pointer ${
                    filterStatus === 'pending'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Pendientes
                </button>
                <button
                  onClick={() => setFilterStatus('credited')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all cursor-pointer ${
                    filterStatus === 'credited'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Acreditadas
                </button>
              </div>
            </div>

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
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-slate-800 uppercase">
                          {getStringValue(ret.supplierName)}
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
                        {ret.quantity}x {getStringValue(ret.productName)}
                      </h4>

                      {getStringValue(ret.reason) && (
                        <p className="text-[10px] text-slate-500 italic">
                          Motivo: {getStringValue(ret.reason)}
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

                    {ret.status === 'pending' && permissions.manageReturns && (
                      <button
                        onClick={() => handleOpenAccreditation(ret)}
                        className="self-start sm:self-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Acreditar</span>
                      </button>
                    )}
                    
                    {ret.status === 'credited' && (
                      <div className="text-emerald-600 flex items-center gap-1 self-start sm:self-center bg-emerald-50 px-2.5 py-1 rounded-lg">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Acreditada</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: NOTAS DE CRÉDITO DE PROVEEDORES */}
      {activeSubTab === 'credit_notes' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-4">
          
          {/* Header Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
            <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl">
              <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider block">Saldo Total Disponible</span>
              <span className="text-lg font-black text-emerald-900 font-mono">
                RD$ {activeCreditNotesTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl">
              <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">Notas Activas</span>
              <span className="text-lg font-black text-indigo-900 font-mono">
                {supplierCreditNotes.filter(n => n.status === 'active').length}
              </span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Notas Agotadas</span>
              <span className="text-lg font-black text-slate-700 font-mono">
                {supplierCreditNotes.filter(n => n.status === 'depleted').length}
              </span>
            </div>
          </div>

          {/* List of Supplier Credit Notes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Listado de Notas de Crédito de Proveedores</h3>
              {permissions.manageReturns && (
                <button
                  onClick={() => setShowManualModal(true)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar Nota Manual</span>
                </button>
              )}
            </div>

            {supplierCreditNotes.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                <CreditCard className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold">No hay notas de crédito registradas</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Las notas de crédito emitidas por proveedores al acreditar devoluciones o creadas manualmente aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {supplierCreditNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-4 border rounded-2xl flex flex-col justify-between space-y-2 transition-all ${
                      note.status === 'active'
                        ? 'border-emerald-200 bg-emerald-50/10 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/50 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-black text-slate-800 uppercase block">
                          {getStringValue(note.supplierName)}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                          {getStringValue(note.reason)}
                        </p>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        note.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {note.status === 'active' ? 'Activa' : 'Agotada'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Saldo Disponible</span>
                        <span className="font-black text-emerald-700">
                          RD$ {(note.remainingBalance || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Monto Original</span>
                        <span className="font-bold text-slate-600">
                          RD$ {(note.originalAmount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-400 flex items-center justify-between pt-1 font-sans">
                      <span>{note.createdAt ? new Date(note.createdAt).toLocaleDateString('es-DO') : 'Sin fecha'}</span>
                      {note.linkedReturnId && (
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-md">
                          De Devolución
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACCREDITATION CHOICE MODAL */}
      {returnToCredit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Acreditar Devolución</h3>
              </div>
              <button
                onClick={() => setReturnToCredit(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Proveedor</span>
              <p className="text-xs font-black text-slate-800 uppercase">{getStringValue(returnToCredit.supplierName)}</p>
              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-200/60 mt-1.5">
                <span className="text-slate-600 font-medium">{returnToCredit.quantity}x {getStringValue(returnToCredit.productName)}</span>
                <span className="font-black text-indigo-600 font-mono">
                  RD$ {returnToCredit.cost.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">
                ¿Cómo acreditó o pagó el proveedor esta devolución?
              </p>

              <button
                disabled={isProcessingAccreditation}
                onClick={() => handleConfirmAccreditation('cash')}
                className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 uppercase block">Reembolso Directo en Dinero</span>
                    <span className="text-[10px] text-slate-500 font-medium">Devolvió el efectivo o hizo transferencia</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                disabled={isProcessingAccreditation}
                onClick={() => handleConfirmAccreditation('credit_note')}
                className="w-full p-3 bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-200 rounded-2xl text-left transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl group-hover:scale-105 transition-transform">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-indigo-950 uppercase block">Nota de Crédito de Proveedor</span>
                    <span className="text-[10px] text-indigo-700 font-medium">Crear saldo a favor para compras/pagos futuros</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setReturnToCredit(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL CREDIT NOTE MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Registrar Nota de Crédito Manual</h3>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateManualCreditNote} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Proveedor</label>
                <SupplierPicker
                  value={manualSupplierName}
                  onChange={setManualSupplierName}
                  products={products}
                  payables={payables}
                  placeholder="Selecciona o escribe el proveedor..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Monto de la Nota (RD$)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Motivo / Concepto</label>
                <textarea
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="Ej. Descuento especial de proveedor, saldo a favor concedido por ajuste..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingManualNote}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                >
                  {isSavingManualNote ? 'Guardando...' : 'Guardar Nota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
