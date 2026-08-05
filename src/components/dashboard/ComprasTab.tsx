import React, { useState, useMemo } from 'react';
import {
  Product,
  Sale,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseReceipt,
  Employee,
  EmployeePermissions,
  AccountPayable,
  PayablePayment,
  Movement,
  SupplierReturn,
  Supplier,
} from '../../types';
import { SupplierPicker } from '../SupplierPicker';
import { SupplierDetailModal } from '../SupplierDetailModal';
import { firestoreService, BatchOperation } from '../../lib/firebase';
import { increment } from 'firebase/firestore';
import { getRestockSuggestions, RestockSuggestion } from '../../lib/restockSuggestions';
import { matchesProductSearch, rankSearchResults } from '../../lib/search';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  Package,
  FileText,
  DollarSign,
  AlertCircle,
  ArrowDownToLine,
  ChevronDown,
  ChevronUp,
  Printer,
  MessageSquare,
} from 'lucide-react';

export interface DraftOrderGroup {
  supplierName: string;
  items: Array<{
    productId: string;
    productName: string;
    quantityOrdered: number;
    estimatedCost: number;
  }>;
}

interface ComprasTabProps {
  products: Product[];
  sales?: Sale[];
  purchaseOrders: PurchaseOrder[];
  purchaseReceipts: PurchaseReceipt[];
  payables?: AccountPayable[];
  payablePayments?: PayablePayment[];
  movements?: Movement[];
  supplierReturns?: SupplierReturn[];
  currentEmployee: Employee | null;
  clerkName: string;
  permissions: EmployeePermissions;
  showAlert: (msg: string) => void;
  initialDraftOrders?: DraftOrderGroup[];
  onClearDrafts?: () => void;
  suppliers?: Supplier[];
}

export const ComprasTab: React.FC<ComprasTabProps> = ({
  products,
  sales = [],
  purchaseOrders,
  purchaseReceipts,
  payables = [],
  payablePayments = [],
  movements = [],
  supplierReturns = [],
  suppliers = [],
  currentEmployee,
  clerkName,
  permissions,
  showAlert,
  initialDraftOrders,
  onClearDrafts,
}) => {
  const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<string | null>(null);
  const canManage = permissions.managePurchaseOrders ?? permissions.manageProducts;

  // Compute restock suggestions for items needing restock (< 7 days coverage)
  const restockSuggestions = useMemo(() => {
    return getRestockSuggestions(products, sales || []);
  }, [products, sales]);

  const suggestionsBySupplier = useMemo(() => {
    const groups: Record<string, RestockSuggestion[]> = {};
    for (const sug of restockSuggestions) {
      const providerKey = sug.product.provider?.trim() || 'Sin Proveedor asignado';
      if (!groups[providerKey]) {
        groups[providerKey] = [];
      }
      groups[providerKey].push(sug);
    }
    return groups;
  }, [restockSuggestions]);

  // Search and status filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'partial' | 'completed' | 'cancelled'>('all');

  // New PO Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [newItems, setNewItems] = useState<{
    productId: string;
    productName: string;
    quantityOrdered: number;
    estimatedCost: number;
  }[]>([]);

  // Draft queue from restock suggestions
  const [draftQueue, setDraftQueue] = useState<DraftOrderGroup[]>(initialDraftOrders || []);

  const handleSupplierChange = (supplierName: string) => {
    setNewSupplier(supplierName);
  };

  const supplierSuggestedProducts = useMemo(() => {
    if (!newSupplier || !newSupplier.trim()) return [];
    const normalizedSupplier = newSupplier.trim().toLowerCase();

    const restockMap = new Map<string, RestockSuggestion>();
    restockSuggestions.forEach((s) => {
      restockMap.set(s.product.id, s);
    });

    return products
      .filter((p) => p.provider && p.provider.trim().toLowerCase() === normalizedSupplier)
      .filter((p) => {
        const currentStock = p.stock || 0;
        const isOutStock = currentStock <= 0;
        const isBelowMin = p.minStock !== undefined && p.minStock !== null && currentStock <= p.minStock;
        const hasRestockSug = restockMap.has(p.id);

        return isOutStock || isBelowMin || hasRestockSug;
      })
      .map((p) => {
        const currentStock = p.stock || 0;
        const restockSug = restockMap.get(p.id);
        let suggestedQty = 1;

        if (restockSug) {
          suggestedQty = restockSug.suggestedQty;
        } else {
          const targetMax = p.maxStock || (p.minStock ? p.minStock * 2 : 10);
          suggestedQty = Math.max(1, targetMax - currentStock);
        }

        const isOutStock = currentStock <= 0;
        const isBelowMin = p.minStock !== undefined && p.minStock !== null && currentStock <= p.minStock;

        let statusType: 'out_of_stock' | 'below_min' | 'velocity' = 'velocity';
        if (isOutStock) {
          statusType = 'out_of_stock';
        } else if (isBelowMin) {
          statusType = 'below_min';
        }

        return {
          product: p,
          currentStock,
          minStock: p.minStock ?? null,
          maxStock: p.maxStock ?? null,
          suggestedQty,
          statusType,
          hasRestockSug: !!restockSug,
        };
      });
  }, [newSupplier, products, restockSuggestions]);

  const handleAddSuggestedProduct = (prod: Product, suggestedQty: number) => {
    setNewItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.productId === prod.id);
      if (existingIndex >= 0) {
        return prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, quantityOrdered: suggestedQty }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          quantityOrdered: suggestedQty,
          estimatedCost: prod.cost || 0,
        },
      ];
    });
  };

  const handleAddAllSuggestedProducts = () => {
    supplierSuggestedProducts.forEach((sp) => {
      handleAddSuggestedProduct(sp.product, sp.suggestedQty);
    });
  };

  const handleSelectSupplierGroup = (supplierName: string, items: RestockSuggestion[]) => {
    const actualSupplier = supplierName === 'Sin Proveedor asignado' ? '' : supplierName;
    setNewSupplier(actualSupplier);
    setNewItems(
      items.map((s) => ({
        productId: s.product.id,
        productName: s.product.name,
        quantityOrdered: s.suggestedQty,
        estimatedCost: s.product.cost || 0,
      }))
    );
  };

  React.useEffect(() => {
    if (initialDraftOrders && initialDraftOrders.length > 0) {
      setDraftQueue(initialDraftOrders);
      const firstDraft = initialDraftOrders[0];
      setNewSupplier(firstDraft.supplierName);
      setNewItems(firstDraft.items);
      setIsCreateModalOpen(true);
    }
  }, [initialDraftOrders]);

  // PARTE B: Auto-add out-of-stock products when supplier is selected
  const prevSupplierRef = React.useRef<string>('');

  React.useEffect(() => {
    const norm = newSupplier.trim().toLowerCase();
    if (norm && norm !== prevSupplierRef.current) {
      prevSupplierRef.current = norm;
      const outOfStockItems = supplierSuggestedProducts.filter((sp) => sp.statusType === 'out_of_stock');
      if (outOfStockItems.length > 0) {
        setNewItems((prev) => {
          const next = [...prev];
          outOfStockItems.forEach((sp) => {
            if (!next.some((item) => item.productId === sp.product.id)) {
              next.push({
                productId: sp.product.id,
                productName: sp.product.name,
                quantityOrdered: sp.suggestedQty,
                estimatedCost: sp.product.cost || 0,
              });
            }
          });
          return next;
        });
      }
    } else if (!norm) {
      prevSupplierRef.current = '';
    }
  }, [newSupplier, supplierSuggestedProducts]);

  // Receive items Modal state
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [receptionInputs, setReceptionInputs] = useState<
    Record<string, { quantity: number; cost: number }>
  >({});

  // View details Modal state
  const [viewingPo, setViewingPo] = useState<PurchaseOrder | null>(null);

  // Cancellation Modal state
  const [cancellingPo, setCancellingPo] = useState<PurchaseOrder | null>(null);

  // WhatsApp / Print Action modal states
  const [actionPo, setActionPo] = useState<PurchaseOrder | null>(null);
  const [actionType, setActionType] = useState<'whatsapp' | 'print' | null>(null);
  const [printablePo, setPrintablePo] = useState<{ po: PurchaseOrder; includePrices: boolean } | null>(null);
  const [duplicateWarningModalOpen, setDuplicateWarningModalOpen] = useState(false);

  // Duplicate Order Detection
  const existingOpenOrderForSupplier = useMemo(() => {
    if (!newSupplier.trim()) return null;
    const norm = newSupplier.trim().toLowerCase();
    return purchaseOrders.find(
      (po) =>
        (po.status === 'open' || po.status === 'partial') &&
        po.supplierName.trim().toLowerCase() === norm
    ) || null;
  }, [newSupplier, purchaseOrders]);

  // Computed KPIs
  const openOrPartialOrdersCount = useMemo(() => {
    return purchaseOrders.filter((po) => po.status === 'open' || po.status === 'partial').length;
  }, [purchaseOrders]);

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
      const matchesQuery =
        !searchTerm.trim() ||
        po.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesStatus && matchesQuery;
    });
  }, [purchaseOrders, statusFilter, searchTerm]);

  // Product search results for new PO form
  const searchedProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const textMatches = products.filter((p) => matchesProductSearch(p, productSearch));
    return rankSearchResults(textMatches, productSearch).slice(0, 8);
  }, [products, productSearch]);

  const handleAddProductToOrder = (product: Product) => {
    const existingIndex = newItems.findIndex((item) => item.productId === product.id);
    if (existingIndex >= 0) {
      setNewItems((prev) =>
        prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantityOrdered: item.quantityOrdered + 1 } : item
        )
      );
    } else {
      setNewItems((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantityOrdered: 1,
          estimatedCost: product.cost || 0,
        },
      ]);
    }
    setProductSearch('');
  };

  const handleRemoveProductFromOrder = (productId: string) => {
    setNewItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const handleItemQtyChange = (productId: string, qty: number) => {
    const validQty = Math.max(1, qty || 1);
    setNewItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantityOrdered: validQty } : item))
    );
  };

  const handleItemCostChange = (productId: string, cost: number) => {
    const validCost = Math.max(0, cost || 0);
    setNewItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, estimatedCost: validCost } : item))
    );
  };

  // Order Total calculations with 18% ITBIS
  const newOrderSubtotal = useMemo(() => {
    return newItems.reduce((acc, item) => acc + item.quantityOrdered * item.estimatedCost, 0);
  }, [newItems]);

  const newOrderITBIS = useMemo(() => {
    return newOrderSubtotal * 0.18;
  }, [newOrderSubtotal]);

  const newOrderTotalEstimated = useMemo(() => {
    return newOrderSubtotal * 1.18;
  }, [newOrderSubtotal]);

  const handleCreatePurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.trim()) {
      showAlert('Por favor ingresa o selecciona un proveedor.');
      return;
    }
    if (newItems.length === 0) {
      showAlert('Debes agregar al menos un producto a la orden de compra.');
      return;
    }

    if (existingOpenOrderForSupplier) {
      setDuplicateWarningModalOpen(true);
      return;
    }

    await saveNewPurchaseOrder();
  };

  const saveNewPurchaseOrder = async () => {
    setDuplicateWarningModalOpen(false);
    const poId = `po_${Date.now()}`;
    const newOrder: PurchaseOrder = {
      id: poId,
      supplierName: newSupplier.trim(),
      items: newItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: 0,
        estimatedCost: item.estimatedCost,
      })),
      status: 'open',
      employeeId: currentEmployee?.id,
      employeeName: currentEmployee?.name || clerkName,
      createdAt: new Date().toISOString(),
    };

    try {
      await firestoreService.setDocWithId('purchaseOrders', poId, newOrder);
      const remainingDrafts = draftQueue.slice(1);
      if (remainingDrafts.length > 0) {
        setDraftQueue(remainingDrafts);
        const nextDraft = remainingDrafts[0];
        setNewSupplier(nextDraft.supplierName);
        setNewItems(nextDraft.items);
        setIsCreateModalOpen(true);
        showAlert(
          `Orden #${poId.slice(-6).toUpperCase()} creada. Cargado siguiente borrador (${remainingDrafts.length} pendiente): ${nextDraft.supplierName}`
        );
      } else {
        setDraftQueue([]);
        setIsCreateModalOpen(false);
        setNewSupplier('');
        setNewItems([]);
        if (onClearDrafts) onClearDrafts();
        showAlert(`Orden de compra #${poId.slice(-6).toUpperCase()} creada exitosamente.`);
      }
      setProductSearch('');
    } catch (err) {
      console.error('Error creating purchase order:', err);
      showAlert('Error al crear la orden de compra en el servidor.');
    }
  };

  // WhatsApp & Print Action handlers
  const handleOpenActionModal = (po: PurchaseOrder, type: 'whatsapp' | 'print') => {
    setActionPo(po);
    setActionType(type);
  };

  const handleConfirmAction = (includePrices: boolean) => {
    if (!actionPo || !actionType) return;

    if (actionType === 'whatsapp') {
      const normSupp = actionPo.supplierName.trim().toLowerCase();
      const matchedSupplier = suppliers.find((s) => s.name.trim().toLowerCase() === normSupp);

      if (!matchedSupplier || !matchedSupplier.phone || !matchedSupplier.phone.trim()) {
        showAlert(
          `El proveedor "${actionPo.supplierName}" no tiene un teléfono guardado en la base de datos de Proveedores. Agrega su teléfono en Configuración -> Proveedores para enviar por WhatsApp.`
        );
        setActionPo(null);
        setActionType(null);
        return;
      }

      const cleanPhone = matchedSupplier.phone.replace(/[^\d+]/g, '');
      const dateStr = actionPo.createdAt ? new Date(actionPo.createdAt).toLocaleDateString('es-DO') : '-';

      let msg = `*ORDEN DE COMPRA #${actionPo.id.slice(-6).toUpperCase()}*\n`;
      msg += `Proveedor: ${actionPo.supplierName}\n`;
      msg += `Fecha: ${dateStr}\n\n`;
      msg += `*PRODUCTOS A SOLICITAR:*\n`;

      let subtotal = 0;
      actionPo.items.forEach((item, idx) => {
        const itemCostWithTax = item.estimatedCost * 1.18;
        const lineTotalWithTax = item.quantityOrdered * item.estimatedCost * 1.18;
        subtotal += item.quantityOrdered * item.estimatedCost;

        if (includePrices) {
          msg += `${idx + 1}. ${item.productName}: ${item.quantityOrdered} un. @ RD$ ${itemCostWithTax.toFixed(2)} (ITBIS incl.) = RD$ ${lineTotalWithTax.toFixed(2)}\n`;
        } else {
          msg += `${idx + 1}. ${item.productName}: ${item.quantityOrdered} un.\n`;
        }
      });

      if (includePrices) {
        const itbis = subtotal * 0.18;
        const total = subtotal * 1.18;
        msg += `\n*Subtotal base:* RD$ ${subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
        msg += `\n*ITBIS (18%):* RD$ ${itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
        msg += `\n*Total Estimado (ITBIS 18% incl.):* RD$ ${total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`;
      } else {
        const totalUnits = actionPo.items.reduce((a, b) => a + b.quantityOrdered, 0);
        msg += `\nTotal: ${actionPo.items.length} producto(s) (${totalUnits} unidades).`;
      }

      msg += `\n\n_Generado desde el sistema POS._`;

      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, '_blank');
      setActionPo(null);
      setActionType(null);
    } else if (actionType === 'print') {
      const currentPo = actionPo;
      setPrintablePo({ po: currentPo, includePrices });
      setActionPo(null);
      setActionType(null);
      setTimeout(() => {
        window.print();
      }, 250);
    }
  };

  // Open Receive Goods Modal
  const handleOpenReceiveModal = (po: PurchaseOrder) => {
    setReceivingPo(po);
    const initialInputs: Record<string, { quantity: number; cost: number }> = {};
    po.items.forEach((item) => {
      const pendingQty = Math.max(0, item.quantityOrdered - item.quantityReceived);
      initialInputs[item.productId] = {
        quantity: pendingQty,
        cost: item.estimatedCost,
      };
    });
    setReceptionInputs(initialInputs);
  };

  // Submit Receive Goods
  const handleConfirmReception = async () => {
    if (!receivingPo) return;

    let hasAnyQuantity = false;
    let totalReceptionCost = 0;

    const receivedItemsSummary: {
      productId: string;
      productName: string;
      quantity: number;
      actualCost: number;
    }[] = [];

    // Validate inputs
    for (const item of receivingPo.items) {
      const pendingQty = Math.max(0, item.quantityOrdered - item.quantityReceived);
      const input = receptionInputs[item.productId] || { quantity: 0, cost: item.estimatedCost };

      if (input.quantity > pendingQty) {
        showAlert(
          `La cantidad a recibir para "${item.productName}" (${input.quantity}) no puede superar la pendiente (${pendingQty}).`
        );
        return;
      }

      if (input.quantity > 0) {
        hasAnyQuantity = true;
        const lineTotal = input.quantity * input.cost;
        totalReceptionCost += lineTotal;
        receivedItemsSummary.push({
          productId: item.productId,
          productName: item.productName,
          quantity: input.quantity,
          actualCost: input.cost,
        });
      }
    }

    if (!hasAnyQuantity) {
      showAlert('Debes especificar al menos un producto con cantidad a recibir mayor a cero.');
      return;
    }

    const receiptId = `pr_${Date.now()}`;
    const accountPayableId = `ap_po_${Date.now()}`;
    const now = new Date().toISOString();

    // Default due date: 30 days from now
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + 30);
    const dueDateStr = dueDateObj.toISOString().split('T')[0];

    const batchOperations: BatchOperation[] = [];

    // 1. Update product stock and cost
    receivedItemsSummary.forEach((received) => {
      const existingProd = products.find((p) => p.id === received.productId);
      const currentStock = existingProd?.stock || 0;
      const newStock = currentStock + received.quantity;

      batchOperations.push({
        type: 'update',
        collectionName: 'products',
        id: received.productId,
        data: {
          stock: increment(received.quantity),
          cost: received.actualCost, // Newer cost replaces previous cost
        },
      });
    });

    // 2. Update Purchase Order items and status
    const updatedPoItems: PurchaseOrderItem[] = receivingPo.items.map((item) => {
      const qtyToRec = receptionInputs[item.productId]?.quantity || 0;
      return {
        ...item,
        quantityReceived: item.quantityReceived + qtyToRec,
      };
    });

    const isAllCompleted = updatedPoItems.every(
      (item) => item.quantityReceived >= item.quantityOrdered
    );
    const newStatus: PurchaseOrder['status'] = isAllCompleted ? 'completed' : 'partial';

    batchOperations.push({
      type: 'update',
      collectionName: 'purchaseOrders',
      id: receivingPo.id,
      data: {
        items: updatedPoItems,
        status: newStatus,
      },
    });

    // 3. Create AccountPayable
    const newPayable: AccountPayable = {
      id: accountPayableId,
      supplierName: receivingPo.supplierName,
      concept: `Recepción mercancía - Orden #${receivingPo.id.slice(-6).toUpperCase()}`,
      totalAmount: totalReceptionCost,
      dueDate: dueDateStr,
      status: 'pending',
      employeeId: currentEmployee?.id,
      employeeName: currentEmployee?.name || clerkName,
      createdAt: now,
    };

    batchOperations.push({
      type: 'set',
      collectionName: 'accountsPayable',
      id: accountPayableId,
      data: newPayable,
    });

    // 4. Create PurchaseReceipt
    const newReceipt: PurchaseReceipt = {
      id: receiptId,
      purchaseOrderId: receivingPo.id,
      receivedItems: receivedItemsSummary,
      totalAmount: totalReceptionCost,
      linkedAccountPayableId: accountPayableId,
      employeeId: currentEmployee?.id,
      employeeName: currentEmployee?.name || clerkName,
      createdAt: now,
    };

    batchOperations.push({
      type: 'set',
      collectionName: 'purchaseReceipts',
      id: receiptId,
      data: newReceipt,
    });

    try {
      await firestoreService.runBatch(batchOperations);
      showAlert(
        `Recepción registrada correctamente. Se actualizó el stock y costo de los productos y se generó la Cuenta por Pagar por RD$ ${totalReceptionCost.toFixed(
          2
        )}.`
      );
      setReceivingPo(null);
    } catch (err) {
      console.error('Error batch receiving purchase order:', err);
      showAlert('Error al procesar la recepción de mercancía en el servidor.');
    }
  };

  // Cancel Purchase Order
  const handleConfirmCancelPo = async () => {
    if (!cancellingPo) return;
    try {
      await firestoreService.updateDoc('purchaseOrders', cancellingPo.id, {
        status: 'cancelled',
      });
      showAlert(`Orden de compra #${cancellingPo.id.slice(-6).toUpperCase()} cancelada.`);
      setCancellingPo(null);
    } catch (err) {
      console.error('Error cancelling PO:', err);
      showAlert('Error al cancelar la orden de compra.');
    }
  };

  return (
    <div className="space-y-6">
      {draftQueue.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-amber-900 uppercase tracking-tight">
                Borrador de Orden de Compra Sugerido ({draftQueue.length}{' '}
                {draftQueue.length === 1 ? 'proveedor' : 'proveedores'} pendiente(s))
              </div>
              <div className="text-xs text-amber-800 font-medium">
                Proveedor actual: <strong className="font-bold">{draftQueue[0].supplierName}</strong> ({draftQueue[0].items.length} productos). Revisa y ajusta antes de guardar.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                setNewSupplier(draftQueue[0].supplierName);
                setNewItems(draftQueue[0].items);
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-colors shadow-2xs"
            >
              Revisar y Confirmar
            </button>
            <button
              onClick={() => {
                setDraftQueue([]);
                if (onClearDrafts) onClearDrafts();
              }}
              className="px-3 py-2 bg-white/80 hover:bg-white text-slate-600 font-bold text-xs rounded-xl border border-amber-200 transition-colors"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* KPI & Action Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-lg border border-indigo-800/40 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
              Órdenes Pendientes de Recepción
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono">{openOrPartialOrdersCount}</span>
              <span className="text-xs text-indigo-200 font-medium">Abiertas / Parciales</span>
            </div>
          </div>
          <div className="p-3 bg-indigo-600/30 rounded-2xl border border-indigo-400/20 text-indigo-300">
            <Truck className="w-8 h-8" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Total Órdenes Registradas
            </span>
            <div className="text-2xl font-black text-slate-800 font-mono">
              {purchaseOrders.length}
            </div>
          </div>
          <div className="p-3 bg-slate-100 rounded-2xl text-slate-600">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="flex items-center justify-end">
          {canManage && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full md:w-auto px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              <span>Nueva Orden de Compra</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoComplete="off"
              type="text"
              placeholder="Buscar por proveedor o #ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'open', label: 'Abiertas' },
                { id: 'partial', label: 'Parciales' },
                { id: 'completed', label: 'Completadas' },
                { id: 'cancelled', label: 'Canceladas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <th className="p-4">Orden #</th>
                <th className="p-4">Proveedor</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Progreso Recepción</th>
                <th className="p-4">Creado por</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                    No hay órdenes de compra registradas.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => {
                  const totalOrdered = po.items.reduce((acc, i) => acc + i.quantityOrdered, 0);
                  const totalReceived = po.items.reduce((acc, i) => acc + i.quantityReceived, 0);
                  const progressPct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-900">
                        #{po.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        <button
                          type="button"
                          onClick={() => setSelectedSupplierForModal(po.supplierName)}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline font-bold text-left cursor-pointer"
                        >
                          {po.supplierName}
                        </button>
                      </td>
                      <td className="p-4">
                        {po.status === 'open' && (
                          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 font-extrabold rounded-lg text-[10px] uppercase inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Abierta
                          </span>
                        )}
                        {po.status === 'partial' && (
                          <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold rounded-lg text-[10px] uppercase inline-flex items-center gap-1">
                            <Truck className="w-3 h-3" /> Parcial
                          </span>
                        )}
                        {po.status === 'completed' && (
                          <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold rounded-lg text-[10px] uppercase inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Completada
                          </span>
                        )}
                        {po.status === 'cancelled' && (
                          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-500 font-extrabold rounded-lg text-[10px] uppercase inline-flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Cancelada
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1 w-36">
                          <div className="flex justify-between text-[10px] font-bold text-slate-600">
                            <span>
                              {totalReceived} / {totalOrdered} un.
                            </span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                po.status === 'completed'
                                  ? 'bg-emerald-500'
                                  : po.status === 'partial'
                                  ? 'bg-indigo-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-800 font-semibold">{po.employeeName || 'Sistema'}</div>
                        <div className="text-[10px] text-slate-400">
                          {po.createdAt ? new Date(po.createdAt).toLocaleDateString('es-DO') : '-'}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(po, 'whatsapp')}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                            title="Enviar por WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(po, 'print')}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                            title="Imprimir Orden"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewingPo(po)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Detalle</span>
                          </button>

                          {canManage && (po.status === 'open' || po.status === 'partial') && (
                            <>
                              <button
                                onClick={() => handleOpenReceiveModal(po)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                                <span>Recibir</span>
                              </button>
                              <button
                                onClick={() => setCancellingPo(po)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                title="Cancelar Orden"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Create New Purchase Order */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-black text-slate-900">Nueva Orden de Compra</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchaseOrder} className="p-6 overflow-y-auto space-y-6 flex-1">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  Proveedor *
                </label>
                <SupplierPicker
                  value={newSupplier}
                  onChange={handleSupplierChange}
                  products={products}
                  payables={payables}
                  suppliers={suppliers}
                  placeholder="Selecciona o escribe el proveedor..."
                />
              </div>

              {/* Advertencia de Orden Duplicada Existente */}
              {existingOpenOrderForSupplier && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-amber-900 block">
                        Ya existe una orden abierta/parcial con {existingOpenOrderForSupplier.supplierName}
                      </span>
                      <p className="text-amber-800 text-[11px] font-medium mt-0.5">
                        Creada el {existingOpenOrderForSupplier.createdAt ? new Date(existingOpenOrderForSupplier.createdAt).toLocaleDateString('es-DO') : '-'}.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setViewingPo(existingOpenOrderForSupplier);
                    }}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition-colors shrink-0 cursor-pointer shadow-2xs"
                  >
                    Ver orden existente
                  </button>
                </div>
              )}

              {/* Total Estimado Destacado con ITBIS 18% */}
              <div className="bg-indigo-900 text-white p-4 rounded-2xl border border-indigo-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase text-indigo-300 tracking-wider">
                    Total Estimado (ITBIS 18% incluido)
                  </div>
                  <div className="text-2xl font-black font-mono text-white mt-0.5">
                    RD$ {newOrderTotalEstimated.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right text-xs text-indigo-200 space-y-0.5 border-t sm:border-t-0 sm:border-l border-indigo-700/60 pt-2 sm:pt-0 sm:pl-4">
                  <div>Subtotal base: <span className="font-mono font-bold text-white">RD$ {newOrderSubtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
                  <div>ITBIS (18%): <span className="font-mono font-bold text-amber-300">RD$ {newOrderITBIS.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span></div>
                </div>
              </div>

              {/* Productos sugeridos del proveedor seleccionado */}
              {newSupplier.trim() && (
                <div className="space-y-3 bg-slate-50/80 border border-slate-200 p-4 rounded-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-600 shrink-0" />
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                        Productos sugeridos de {newSupplier}
                      </h4>
                      <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-[10px] rounded-full">
                        {supplierSuggestedProducts.length} {supplierSuggestedProducts.length === 1 ? 'sugerencia' : 'sugerencias'}
                      </span>
                    </div>

                    {supplierSuggestedProducts.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAddAllSuggestedProducts}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs"
                      >
                        + Agregar todos a la orden
                      </button>
                    )}
                  </div>

                  {supplierSuggestedProducts.length === 0 ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Todos los productos de <strong>{newSupplier}</strong> cuentan con stock suficiente. Puedes buscar y agregar productos manualmente abajo.</span>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/90 text-slate-600 font-extrabold text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Producto</th>
                              <th className="py-2.5 px-3 text-center">Stock Actual</th>
                              <th className="py-2.5 px-3 text-center">Stock de Seguridad</th>
                              <th className="py-2.5 px-3 text-center">Cant. Sugerida</th>
                              <th className="py-2.5 px-3 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {supplierSuggestedProducts.map((sp) => {
                              const isAdded = newItems.some((item) => item.productId === sp.product.id);

                              let rowBgClass = 'bg-white hover:bg-slate-50';
                              let statusBadge = null;

                              if (sp.statusType === 'out_of_stock') {
                                rowBgClass = 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-100';
                                statusBadge = (
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-black text-[9px] uppercase rounded-md shrink-0">
                                    Agotado (0)
                                  </span>
                                );
                              } else if (sp.statusType === 'below_min') {
                                rowBgClass = 'bg-amber-50/80 hover:bg-amber-100/80 border-amber-100';
                                statusBadge = (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-black text-[9px] uppercase rounded-md shrink-0">
                                    Bajo Mínimo
                                  </span>
                                );
                              } else {
                                rowBgClass = 'bg-sky-50/70 hover:bg-sky-100/80 border-sky-100';
                                statusBadge = (
                                  <span className="px-2 py-0.5 bg-sky-100 text-sky-800 border border-sky-300 font-black text-[9px] uppercase rounded-md shrink-0">
                                    Alta Rotación
                                  </span>
                                );
                              }

                              return (
                                <tr key={sp.product.id} className={`${rowBgClass} transition-colors`}>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-2">
                                      <div className="min-w-0">
                                        <div className="font-bold text-slate-800 truncate" title={sp.product.name}>
                                          {sp.product.name}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono">
                                          {sp.product.barcode ? `SKU: ${sp.product.barcode}` : sp.product.category || 'Sin categoría'}
                                        </div>
                                      </div>
                                      {statusBadge}
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 text-center">
                                    <span className={`font-mono font-black text-xs ${sp.currentStock <= 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                                      {sp.currentStock}
                                    </span>
                                  </td>

                                  <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-600">
                                    {sp.minStock !== null ? sp.minStock : '-'}
                                  </td>

                                  <td className="py-2.5 px-3 text-center">
                                    <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg text-xs">
                                      {sp.suggestedQty}
                                    </span>
                                  </td>

                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleAddSuggestedProduct(sp.product, sp.suggestedQty)}
                                      className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer shadow-2xs ${
                                        isAdded
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                      }`}
                                    >
                                      {isAdded ? 'Agregado ✓' : 'Agregar a la orden'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Restock suggestions grouped by supplier when NO supplier selected yet */}
              {!newSupplier.trim() && restockSuggestions.length > 0 && (
                <div className="p-4 bg-gradient-to-br from-amber-50/90 to-orange-50/90 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-tight">
                      Sugerencias de Reabastecimiento (&lt; 7 días de inventario)
                    </h4>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Selecciona un proveedor para iniciar una orden precargada con sus productos agotándose:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {(Object.entries(suggestionsBySupplier) as [string, RestockSuggestion[]][]).map(([suppName, items]) => (
                      <div
                        key={suppName}
                        className="p-3 bg-white border border-amber-200/90 hover:border-amber-400 rounded-xl shadow-2xs flex flex-col justify-between gap-2 transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between font-bold text-xs text-slate-800 mb-1">
                            <span>{suppName}</span>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold text-[10px] rounded-full">
                              {items.length} {items.length === 1 ? 'prod.' : 'prods.'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 space-y-0.5 line-clamp-2">
                            {items.map((s) => `${s.product.name} (Stock: ${s.product.stock || 0}, Sug: ${s.suggestedQty})`).join(', ')}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectSupplierGroup(suppName, items)}
                          className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Crear orden con estos productos
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product search and addition */}
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase text-slate-400">
                  Agregar Productos a la Orden
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Buscar producto por nombre o código de barras..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchedProducts.length > 0) {
                        e.preventDefault();
                        handleAddProductToOrder(searchedProducts[0]);
                      }
                    }}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Search suggestions */}
                {searchedProducts.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {searchedProducts.map((prod) => (
                      <div
                        key={prod.id}
                        onClick={() => handleAddProductToOrder(prod)}
                        className="p-3 hover:bg-indigo-50 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800">{prod.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>Stock actual: {prod.stock}</span>
                            <span>•</span>
                            <span>Costo estim: RD$ {(prod.cost || 0).toFixed(2)}</span>
                            {prod.provider && (
                              <>
                                <span>•</span>
                                <span className="text-amber-700 font-semibold">Prov: {prod.provider}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-indigo-600 text-white font-bold rounded-lg text-[10px]">
                          + Agregar
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-slate-700 flex justify-between items-center">
                  <span>Productos en la Orden ({newItems.length})</span>
                  <span className="font-mono text-indigo-600">
                    Total Estimado: RD$ {newOrderTotalEstimated.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {newItems.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs font-semibold">
                    No has agregado ningún producto. Utiliza el buscador para agregarlos.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {newItems.map((item) => {
                      const prod = products.find((p) => p.id === item.productId);
                      const prodProvider = prod?.provider?.trim();
                      const orderSupplier = newSupplier.trim();
                      const isDifferentSupplier =
                        Boolean(prodProvider) &&
                        Boolean(orderSupplier) &&
                        prodProvider!.toLowerCase() !== orderSupplier.toLowerCase();

                      return (
                        <div key={item.productId} className="p-3 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-800">{item.productName}</span>
                              {isDifferentSupplier && (
                                <span className="px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-extrabold rounded-md flex items-center gap-1 shadow-2xs">
                                  <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                  Proveedor distinto: {prodProvider}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-400">Cant.</label>
                              <input autoComplete="off"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={item.quantityOrdered}
                                onChange={(e) => handleItemQtyChange(item.productId, parseInt(e.target.value))}
                                className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-400">Costo Estim. (RD$)</label>
                              <input autoComplete="off"
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="0.01"
                                value={item.estimatedCost}
                                onChange={(e) => handleItemCostChange(item.productId, parseFloat(e.target.value))}
                                className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                              />
                            </div>

                            <div className="text-right w-24">
                              <label className="block text-[9px] font-black uppercase text-slate-400">Subtotal</label>
                              <span className="text-xs font-mono font-bold text-slate-900">
                                RD$ {(item.quantityOrdered * item.estimatedCost).toFixed(2)}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveProductFromOrder(item.productId)}
                              className="p-1 hover:bg-rose-100 rounded-lg text-rose-500 transition-colors cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition-colors cursor-pointer shadow-md"
                >
                  Crear Orden de Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Receive Goods ("Recibir Mercancía") */}
      {receivingPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50">
              <div>
                <h3 className="text-lg font-black text-indigo-950 flex items-center gap-2">
                  <ArrowDownToLine className="w-5 h-5 text-indigo-600" />
                  <span>Recibir Mercancía — Orden #{receivingPo.id.slice(-6).toUpperCase()}</span>
                </h3>
                <p className="text-xs text-indigo-700 font-medium">
                  Proveedor: <strong className="font-bold">{receivingPo.supplierName}</strong>
                </p>
              </div>
              <button
                onClick={() => setReceivingPo(null)}
                className="p-2 hover:bg-indigo-100 rounded-full text-indigo-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-start gap-2 text-xs text-amber-800 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Al recibir la mercancía, el stock de cada producto se incrementará automáticamente y el costo real ingresado actualizará el costo del catálogo. Además, se creará una <strong>Cuenta por Pagar</strong> por el monto total recibido.
                </span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                <div className="bg-slate-100 p-3 text-[10px] font-black uppercase text-slate-500 grid grid-cols-12 gap-2">
                  <div className="col-span-5">Producto</div>
                  <div className="col-span-2 text-center">Pendiente</div>
                  <div className="col-span-2 text-center">A Recibir</div>
                  <div className="col-span-3 text-right">Costo Real (RD$)</div>
                </div>

                {receivingPo.items.map((item) => {
                  const pendingQty = Math.max(0, item.quantityOrdered - item.quantityReceived);
                  const currentInput = receptionInputs[item.productId] || {
                    quantity: pendingQty,
                    cost: item.estimatedCost,
                  };

                  return (
                    <div key={item.productId} className="p-3 grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-5 font-bold text-slate-800">
                        {item.productName}
                        <div className="text-[10px] text-slate-400 font-normal">
                          Solicitados: {item.quantityOrdered} | Ya recibidos: {item.quantityReceived}
                        </div>
                      </div>

                      <div className="col-span-2 text-center font-mono font-bold text-amber-700">
                        {pendingQty} un.
                      </div>

                      <div className="col-span-2">
                        <input autoComplete="off"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={pendingQty}
                          value={currentInput.quantity}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(pendingQty, parseInt(e.target.value) || 0));
                            setReceptionInputs((prev) => ({
                              ...prev,
                              [item.productId]: { ...prev[item.productId], quantity: val },
                            }));
                          }}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="col-span-3 text-right">
                        <input autoComplete="off"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={currentInput.cost}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            setReceptionInputs((prev) => ({
                              ...prev,
                              [item.productId]: { ...prev[item.productId], cost: val },
                            }));
                          }}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-right font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Calculation */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex justify-between items-center">
                <span className="text-xs font-black uppercase text-slate-500">Monto Total a Generar en Cuentas por Pagar:</span>
                <span className="text-xl font-black font-mono text-indigo-700">
                  RD${' '}
                  {receivingPo.items
                    .reduce((sum, item) => {
                      const inp = receptionInputs[item.productId] || { quantity: 0, cost: item.estimatedCost };
                      return sum + inp.quantity * inp.cost;
                    }, 0)
                    .toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReceivingPo(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReception}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Recepción y Crear Deuda</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: View Details & History */}
      {viewingPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Detalle de Orden de Compra #{viewingPo.id.slice(-6).toUpperCase()}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Proveedor: {viewingPo.supplierName}</p>
              </div>
              <button
                onClick={() => setViewingPo(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Info summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Estado</span>
                  <div className="font-bold uppercase text-slate-800">{viewingPo.status}</div>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Fecha</span>
                  <div className="font-bold text-slate-800">
                    {viewingPo.createdAt ? new Date(viewingPo.createdAt).toLocaleDateString('es-DO') : '-'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Creado por</span>
                  <div className="font-bold text-slate-800">{viewingPo.employeeName || 'Sistema'}</div>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Progreso General</span>
                  <div className="font-mono font-bold text-indigo-600">
                    {viewingPo.items.reduce((a, b) => a + b.quantityReceived, 0)} /{' '}
                    {viewingPo.items.reduce((a, b) => a + b.quantityOrdered, 0)} un.
                  </div>
                </div>
              </div>

              {/* Items detail table */}
              <div>
                <h4 className="font-extrabold text-slate-800 mb-2">Productos en la Orden</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  <div className="bg-slate-100 p-3 text-[10px] font-black uppercase text-slate-500 grid grid-cols-12 gap-2">
                    <div className="col-span-6">Producto</div>
                    <div className="col-span-2 text-center">Ordenado</div>
                    <div className="col-span-2 text-center">Recibido</div>
                    <div className="col-span-2 text-right">Costo Estim.</div>
                  </div>
                  {viewingPo.items.map((item) => (
                    <div key={item.productId} className="p-3 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6 font-bold text-slate-800">{item.productName}</div>
                      <div className="col-span-2 text-center font-mono font-bold">{item.quantityOrdered}</div>
                      <div className="col-span-2 text-center font-mono font-bold text-emerald-600">
                        {item.quantityReceived}
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-slate-700">
                        RD$ {item.estimatedCost.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Linked Receipts History */}
              <div>
                <h4 className="font-extrabold text-slate-800 mb-2">Historial de Recepciones de Mercancía</h4>
                {purchaseReceipts.filter((pr) => pr.purchaseOrderId === viewingPo.id).length === 0 ? (
                  <p className="text-slate-400 text-xs italic">Aún no se ha recibido mercancía para esta orden.</p>
                ) : (
                  <div className="space-y-3">
                    {purchaseReceipts
                      .filter((pr) => pr.purchaseOrderId === viewingPo.id)
                      .map((receipt) => (
                        <div key={receipt.id} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-800">
                              Recibo #{receipt.id.slice(-6).toUpperCase()} — {new Date(receipt.createdAt || '').toLocaleString('es-DO')}
                            </span>
                            <span className="font-mono font-bold text-indigo-700">
                              Monto Generado: RD$ {receipt.totalAmount.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Recibido por: {receipt.employeeName || 'Sistema'}
                          </div>
                          <div className="mt-2 space-y-1 bg-white p-2.5 rounded-xl border border-slate-200">
                            {receipt.receivedItems.map((ri, i) => (
                              <div key={i} className="flex justify-between text-[11px]">
                                <span>{ri.productName}</span>
                                <span className="font-mono">
                                  {ri.quantity} un. × RD$ {ri.actualCost.toFixed(2)} = RD${' '}
                                  {(ri.quantity * ri.actualCost).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenActionModal(viewingPo, 'whatsapp')}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Enviar por WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenActionModal(viewingPo, 'print')}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingPo(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Preguntar si incluir precios/costos para WhatsApp / Imprimir */}
      {actionPo && actionType && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${actionType === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-800'}`}>
                {actionType === 'whatsapp' ? <MessageSquare className="w-6 h-6" /> : <Printer className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {actionType === 'whatsapp' ? 'Enviar Orden por WhatsApp' : 'Imprimir Orden de Compra'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Orden #{actionPo.id.slice(-6).toUpperCase()} • {actionPo.supplierName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              ¿Deseas incluir los <strong>precios/costos estimados con ITBIS (18%)</strong> en el {actionType === 'whatsapp' ? 'mensaje de WhatsApp' : 'documento a imprimir'} o solo el listado de productos y cantidades?
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleConfirmAction(true)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                Sí, incluir precios con ITBIS (18%)
              </button>
              <button
                type="button"
                onClick={() => handleConfirmAction(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
              >
                No, solo productos y cantidades
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionPo(null);
                  setActionType(null);
                }}
                className="w-full py-2 text-slate-400 hover:text-slate-600 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Advertencia de Orden Duplicada al guardar nueva orden */}
      {duplicateWarningModalOpen && existingOpenOrderForSupplier && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900">Orden Abierta Existente</h3>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
              Ya existe una orden abierta o parcial para <strong>{existingOpenOrderForSupplier.supplierName}</strong> (creada el {existingOpenOrderForSupplier.createdAt ? new Date(existingOpenOrderForSupplier.createdAt).toLocaleDateString('es-DO') : '-'}).
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDuplicateWarningModalOpen(false);
                  setIsCreateModalOpen(false);
                  setViewingPo(existingOpenOrderForSupplier);
                }}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Ir a la orden existente para editarla
              </button>
              <button
                type="button"
                onClick={saveNewPurchaseOrder}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Crear una nueva orden de todas formas
              </button>
              <button
                type="button"
                onClick={() => setDuplicateWarningModalOpen(false)}
                className="w-full py-2 text-slate-400 hover:text-slate-600 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTENEDOR OCULTO PARA IMPRESIÓN */}
      {printablePo && (
        <div className="hidden print:block fixed inset-0 bg-white p-8 text-black z-[9999] font-sans">
          <div className="text-center border-b pb-4 mb-4">
            <h1 className="text-xl font-black uppercase">ORDEN DE COMPRA</h1>
            <p className="text-sm font-mono font-bold">#{printablePo.po.id.slice(-6).toUpperCase()}</p>
            <p className="text-xs text-gray-600">Fecha: {printablePo.po.createdAt ? new Date(printablePo.po.createdAt).toLocaleDateString('es-DO') : '-'}</p>
          </div>

          <div className="mb-4 text-xs space-y-1">
            <p><strong>Proveedor:</strong> {printablePo.po.supplierName}</p>
            <p><strong>Solicitado por:</strong> {printablePo.po.employeeName || clerkName}</p>
          </div>

          <table className="w-full text-xs border-collapse border border-gray-300 mb-4">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-2 text-left border-r border-gray-300">Producto</th>
                <th className="p-2 text-center border-r border-gray-300">Cant. Ordenada</th>
                {printablePo.includePrices && (
                  <>
                    <th className="p-2 text-right border-r border-gray-300">Costo un. (ITBIS incl.)</th>
                    <th className="p-2 text-right">Total (ITBIS incl.)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {printablePo.po.items.map((item) => {
                const itemCostWithTax = item.estimatedCost * 1.18;
                const lineTotalWithTax = item.quantityOrdered * item.estimatedCost * 1.18;
                return (
                  <tr key={item.productId} className="border-b border-gray-200">
                    <td className="p-2 border-r border-gray-300 font-bold">{item.productName}</td>
                    <td className="p-2 text-center border-r border-gray-300 font-mono font-bold">{item.quantityOrdered}</td>
                    {printablePo.includePrices && (
                      <>
                        <td className="p-2 text-right border-r border-gray-300 font-mono">RD$ {itemCostWithTax.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono font-bold">RD$ {lineTotalWithTax.toFixed(2)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {printablePo.includePrices && (() => {
            const subtotal = printablePo.po.items.reduce((a, b) => a + b.quantityOrdered * b.estimatedCost, 0);
            const itbis = subtotal * 0.18;
            const total = subtotal * 1.18;
            return (
              <div className="text-right text-xs space-y-1 mt-4 border-t border-gray-300 pt-3">
                <p>Subtotal base: <strong>RD$ {subtotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong></p>
                <p>ITBIS (18%): <strong>RD$ {itbis.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</strong></p>
                <p className="font-bold text-sm">Total Estimado (ITBIS 18% incl.): RD$ {total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</p>
              </div>
            );
          })()}
        </div>
      )}

      {/* MODAL 4: Cancel Order Confirmation */}
      {cancellingPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-black text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>Cancelar Orden de Compra</span>
            </h3>
            <p className="text-xs text-slate-600">
              ¿Estás seguro de que deseas cancelar la Orden de Compra #{cancellingPo.id.slice(-6).toUpperCase()} de{' '}
              <strong>{cancellingPo.supplierName}</strong>? Esta acción actualizará el estado a cancelada.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancellingPo(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                No, mantener
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelPo}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Sí, cancelar orden
              </button>
            </div>
          </div>
        </div>
      )}

      <SupplierDetailModal
        isOpen={!!selectedSupplierForModal}
        onClose={() => setSelectedSupplierForModal(null)}
        supplierName={selectedSupplierForModal}
        purchaseOrders={purchaseOrders}
        purchaseReceipts={purchaseReceipts}
        accountsPayable={payables}
        payablePayments={payablePayments}
        movements={movements}
        supplierReturns={supplierReturns}
      />
    </div>
  );
};
