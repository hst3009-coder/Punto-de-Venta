import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  FileText, 
  DollarSign, 
  Users, 
  UserCheck, 
  ShoppingBag, 
  CreditCard, 
  X, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Layers, 
  TrendingUp, 
  Building2, 
  FileSpreadsheet, 
  Briefcase, 
  Lock, 
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Calendar
} from 'lucide-react';
import { firestoreService } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useAlert } from '../context/AlertContext';

interface DatabaseControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onProductsUpdated?: () => void;
  onSalesUpdated?: () => void;
}

type CollectionKey = 
  | 'accountsPayable'
  | 'banks'
  | 'cardDeposits'
  | 'closures'
  | 'config'
  | 'customers'
  | 'employees'
  | 'movements'
  | 'priceLists'
  | 'productPrices'
  | 'products'
  | 'sales'
  | 'supplierReturns'
  | 'supplierCreditNotes'
  | 'suppliers';

interface CollectionMetadata {
  key: CollectionKey;
  label: string;
  description: string;
  icon: any;
  color: string;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'boolean';
    options?: string[];
    required: boolean;
  }[];
}

const COLLECTIONS: CollectionMetadata[] = [
  {
    key: 'products',
    label: 'Productos',
    description: 'Catálogo principal de productos y existencias',
    icon: ShoppingBag,
    color: 'from-amber-550 to-amber-600 bg-amber-50 text-amber-700',
    fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true },
      { name: 'price', label: 'Precio ($)', type: 'number', required: true },
      { name: 'category', label: 'Categoría', type: 'select', options: ['cafeteria', 'bebidas', 'panaderia', 'comida', 'postres'], required: true },
      { name: 'stock', label: 'Stock', type: 'number', required: true },
      { name: 'emoji', label: 'Emoji / Icono', type: 'text', required: true },
      { name: 'barcode', label: 'Código de Barras', type: 'text', required: false },
      { name: 'taxExempt', label: 'Exento de Impuestos', type: 'boolean', required: false },
      { name: 'color', label: 'Color de Tarjeta (clase)', type: 'text', required: false }
    ]
  },
  {
    key: 'sales',
    label: 'Ventas',
    description: 'Registro histórico de transacciones y tickets',
    icon: TrendingUp,
    color: 'from-emerald-550 to-emerald-600 bg-emerald-50 text-emerald-700',
    fields: [
      { name: 'ticketNumber', label: 'Número de Ticket', type: 'text', required: true },
      { name: 'total', label: 'Monto Total ($)', type: 'number', required: true },
      { name: 'paymentMethod', label: 'Método de Pago', type: 'select', options: ['cash', 'card', 'transfer', 'qr'], required: true },
      { name: 'amountPaid', label: 'Monto Recibido ($)', type: 'number', required: true },
      { name: 'change', label: 'Cambio Entregado ($)', type: 'number', required: true },
      { name: 'date', label: 'Fecha y Hora', type: 'text', required: true }
    ]
  },
  {
    key: 'accountsPayable',
    label: 'Cuentas por Pagar',
    description: 'Deudas y pasivos pendientes con proveedores',
    icon: DollarSign,
    color: 'from-red-550 to-red-600 bg-red-50 text-red-700',
    fields: [
      { name: 'supplierName', label: 'Nombre Proveedor', type: 'text', required: true },
      { name: 'amount', label: 'Monto de Deuda ($)', type: 'number', required: true },
      { name: 'dueDate', label: 'Fecha de Vencimiento', type: 'date', required: true },
      { name: 'status', label: 'Estado', type: 'select', options: ['pending', 'paid'], required: true },
      { name: 'notes', label: 'Notas / Comentarios', type: 'text', required: false }
    ]
  },
  {
    key: 'banks',
    label: 'Bancos',
    description: 'Cuentas bancarias y balances de caja digital',
    icon: Building2,
    color: 'from-blue-550 to-blue-600 bg-blue-50 text-blue-700',
    fields: [
      { name: 'name', label: 'Nombre del Banco', type: 'text', required: true },
      { name: 'accountNumber', label: 'Número de Cuenta', type: 'text', required: true },
      { name: 'balance', label: 'Saldo Disponible ($)', type: 'number', required: true },
      { name: 'currency', label: 'Divisa', type: 'text', required: true }
    ]
  },
  {
    key: 'cardDeposits',
    label: 'Depósitos de Tarjeta',
    description: 'Monitoreo de conciliaciones de pagos con tarjeta',
    icon: CreditCard,
    color: 'from-indigo-550 to-indigo-600 bg-indigo-50 text-indigo-700',
    fields: [
      { name: 'bankName', label: 'Banco Destino', type: 'text', required: true },
      { name: 'amount', label: 'Monto Depositado ($)', type: 'number', required: true },
      { name: 'referenceNumber', label: 'Referencia / Autorización', type: 'text', required: true },
      { name: 'date', label: 'Fecha de Depósito', type: 'date', required: true },
      { name: 'status', label: 'Estado Conciliación', type: 'select', options: ['pending', 'cleared'], required: true }
    ]
  },
  {
    key: 'closures',
    label: 'Cierres de Caja',
    description: 'Arqueos diarios e historial de cierres',
    icon: Lock,
    color: 'from-purple-550 to-purple-600 bg-purple-50 text-purple-700',
    fields: [
      { name: 'date', label: 'Fecha del Cierre', type: 'date', required: true },
      { name: 'clerkName', label: 'Nombre del Cajero', type: 'text', required: true },
      { name: 'initialCash', label: 'Efectivo Inicial ($)', type: 'number', required: true },
      { name: 'salesTotal', label: 'Ventas en Turno ($)', type: 'number', required: true },
      { name: 'expectedCash', label: 'Efectivo Esperado ($)', type: 'number', required: true },
      { name: 'actualCash', label: 'Efectivo Real ($)', type: 'number', required: true },
      { name: 'difference', label: 'Diferencia ($)', type: 'number', required: true },
      { name: 'status', label: 'Estado Cierre', type: 'select', options: ['open', 'closed'], required: true }
    ]
  },
  {
    key: 'customers',
    label: 'Clientes',
    description: 'Padrón de clientes y límites de crédito',
    icon: Users,
    color: 'from-teal-550 to-teal-600 bg-teal-50 text-teal-700',
    fields: [
      { name: 'name', label: 'Nombre Completo', type: 'text', required: true },
      { name: 'phone', label: 'Teléfono', type: 'text', required: false },
      { name: 'email', label: 'Correo Electrónico', type: 'text', required: false },
      { name: 'creditLimit', label: 'Límite de Crédito ($)', type: 'number', required: false },
      { name: 'creditUsed', label: 'Crédito Utilizado ($)', type: 'number', required: false }
    ]
  },
  {
    key: 'employees',
    label: 'Empleados',
    description: 'Catálogo del personal y roles asignados',
    icon: UserCheck,
    color: 'from-rose-550 to-rose-600 bg-rose-50 text-rose-700',
    fields: [
      { name: 'name', label: 'Nombre Completo', type: 'text', required: true },
      { name: 'role', label: 'Rol de Trabajo', type: 'select', options: ['admin', 'cashier', 'manager'], required: true },
      { name: 'email', label: 'Correo Electrónico', type: 'text', required: false },
      { name: 'pin', label: 'PIN de Acceso', type: 'text', required: false },
      { name: 'active', label: 'Empleado Activo', type: 'boolean', required: true }
    ]
  },
  {
    key: 'movements',
    label: 'Movimientos de Caja',
    description: 'Entradas y salidas de efectivo extra-ventas',
    icon: RefreshCw,
    color: 'from-cyan-550 to-cyan-600 bg-cyan-50 text-cyan-700',
    fields: [
      { name: 'type', label: 'Tipo de Movimiento', type: 'select', options: ['in', 'out'], required: true },
      { name: 'amount', label: 'Monto ($)', type: 'number', required: true },
      { name: 'concept', label: 'Concepto / Motivo', type: 'text', required: true },
      { name: 'clerkName', label: 'Cajero Responsable', type: 'text', required: true },
      { name: 'date', label: 'Fecha', type: 'date', required: true }
    ]
  },
  {
    key: 'priceLists',
    label: 'Listas de Precios',
    description: 'Tarifarios y promociones especiales',
    icon: FileSpreadsheet,
    color: 'from-violet-550 to-violet-600 bg-violet-50 text-violet-700',
    fields: [
      { name: 'name', label: 'Nombre de la Lista', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'text', required: false },
      { name: 'discountPercentage', label: 'Porcentaje Descuento (%)', type: 'number', required: false },
      { name: 'active', label: 'Activa', type: 'boolean', required: true }
    ]
  },
  {
    key: 'productPrices',
    label: 'Precios de Productos',
    description: 'Asociación de precios especiales por tarifas',
    icon: Layers,
    color: 'from-orange-550 to-orange-600 bg-orange-50 text-orange-700',
    fields: [
      { name: 'productName', label: 'Nombre de Producto', type: 'text', required: true },
      { name: 'priceListName', label: 'Nombre de Lista Tarifas', type: 'text', required: true },
      { name: 'specialPrice', label: 'Precio Especial ($)', type: 'number', required: true }
    ]
  },
  {
    key: 'supplierReturns',
    label: 'Devoluciones a Proveedores',
    description: 'Merma y devoluciones de mercancías',
    icon: FileText,
    color: 'from-pink-550 to-pink-600 bg-pink-50 text-pink-700',
    fields: [
      { name: 'supplierName', label: 'Proveedor', type: 'text', required: true },
      { name: 'productName', label: 'Producto Devuelto', type: 'text', required: true },
      { name: 'quantity', label: 'Cantidad', type: 'number', required: true },
      { name: 'reason', label: 'Motivo de Devolución', type: 'text', required: true },
      { name: 'date', label: 'Fecha Devolución', type: 'date', required: true },
      { name: 'refunded', label: 'Reembolsado', type: 'boolean', required: true }
    ]
  },
  {
    key: 'supplierCreditNotes',
    label: 'Notas de Crédito de Proveedores',
    description: 'Saldos a favor con proveedores',
    icon: FileText,
    color: 'from-emerald-550 to-emerald-600 bg-emerald-50 text-emerald-700',
    fields: [
      { name: 'supplierName', label: 'Proveedor', type: 'text', required: true },
      { name: 'originalAmount', label: 'Monto Original ($)', type: 'number', required: true },
      { name: 'remainingBalance', label: 'Saldo Disponible ($)', type: 'number', required: true },
      { name: 'reason', label: 'Motivo / Concepto', type: 'text', required: true },
      { name: 'status', label: 'Estado (active/depleted)', type: 'text', required: true }
    ]
  },
  {
    key: 'suppliers',
    label: 'Proveedores',
    description: 'Directorio de abastecedores y marcas asociadas',
    icon: Briefcase,
    color: 'from-slate-650 to-slate-700 bg-slate-50 text-slate-700',
    fields: [
      { name: 'name', label: 'Razón Social / Nombre', type: 'text', required: true },
      { name: 'contactName', label: 'Nombre del Contacto', type: 'text', required: false },
      { name: 'phone', label: 'Teléfono', type: 'text', required: false },
      { name: 'email', label: 'Correo Electrónico', type: 'text', required: false },
      { name: 'address', label: 'Dirección Comercial', type: 'text', required: false }
    ]
  },
  {
    key: 'config',
    label: 'Configuración Tienda',
    description: 'Ajustes generales, impuestos y formato del ticket',
    icon: Database,
    color: 'from-gray-550 to-gray-600 bg-gray-50 text-gray-700',
    fields: [
      { name: 'storeName', label: 'Nombre del Establecimiento', type: 'text', required: true },
      { name: 'storeAddress', label: 'Dirección del Establecimiento', type: 'text', required: false },
      { name: 'taxRate', label: 'Tasa de ITBIS / Impuesto (%)', type: 'number', required: true },
      { name: 'currencySymbol', label: 'Símbolo Monetario', type: 'text', required: true },
      { name: 'ticketFooter', label: 'Mensaje de Pie de Ticket', type: 'text', required: false }
    ]
  }
];

export const DatabaseControlCenter: React.FC<DatabaseControlCenterProps> = ({
  isOpen,
  onClose,
  onProductsUpdated,
  onSalesUpdated
}) => {
  const { showConfirm } = useAlert();
  const [selectedCol, setSelectedCol] = useState<CollectionMetadata | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQueryStr, setSearchQueryStr] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Real-time counts
  const [collectionCounts, setCollectionCounts] = useState<Record<string, number>>({});

  // Dynamic Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Load live counts of records for visual dashboard statistics
  useEffect(() => {
    if (!isOpen) return;
    
    // Fetch counts initially
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      for (const col of COLLECTIONS) {
        try {
          const docs = await firestoreService.getCollectionDocs(col.key);
          counts[col.key] = docs.length;
        } catch (e) {
          counts[col.key] = 0;
        }
      }
      setCollectionCounts(counts);
    };
    
    fetchCounts();
  }, [isOpen]);

  // Load documents when a collection is selected
  useEffect(() => {
    if (!selectedCol) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    setSearchQueryStr('');

    // Subscribe to live updates in this collection
    const unsubscribe = firestoreService.subscribeToCollection(
      selectedCol.key,
      (data) => {
        setDocuments(data);
        setCollectionCounts(prev => ({
          ...prev,
          [selectedCol.key]: data.length
        }));
        setLoading(false);
      },
      (err) => {
        showStatus('Error al conectar con Firestore: ' + err.message, 'error');
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedCol]);

  if (!isOpen) return null;

  const showStatus = (text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  // Open Add Document Form
  const handleOpenAdd = () => {
    if (!selectedCol) return;
    const initialData: Record<string, any> = {};
    selectedCol.fields.forEach(f => {
      if (f.type === 'boolean') initialData[f.name] = true;
      else if (f.type === 'number') initialData[f.name] = 0;
      else if (f.name === 'emoji') initialData[f.name] = '📦';
      else if (f.name === 'color') initialData[f.name] = 'bg-blue-50 text-blue-800 border-blue-200';
      else initialData[f.name] = '';
    });
    setFormData(initialData);
    setEditingDoc(null);
    setIsFormOpen(true);
  };

  // Open Edit Document Form
  const handleOpenEdit = (docData: any) => {
    setFormData({ ...docData });
    setEditingDoc(docData);
    setIsFormOpen(true);
  };

  // Handle Input Changes
  const handleInputChange = (fieldName: string, value: any, type: string) => {
    let parsedVal = value;
    if (type === 'number') {
      parsedVal = parseFloat(value) || 0;
    } else if (type === 'boolean') {
      parsedVal = value === true || value === 'true';
    }
    setFormData(prev => ({
      ...prev,
      [fieldName]: parsedVal
    }));
  };

  // Submit Dynamic Form to Firestore
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCol) return;

    try {
      setLoading(true);
      const submitData = { ...formData };
      delete submitData.id; // Avoid storing local ID field as nested value

      if (editingDoc) {
        await firestoreService.updateDoc(selectedCol.key, editingDoc.id, submitData);
        showStatus('Documento actualizado correctamente en Firestore', 'success');
      } else {
        await firestoreService.addDoc(selectedCol.key, submitData);
        showStatus('Documento creado correctamente en Firestore', 'success');
      }

      // Propagate update triggers to POS main screen if we edited products or sales
      if (selectedCol.key === 'products' && onProductsUpdated) {
        onProductsUpdated();
      }
      if (selectedCol.key === 'sales' && onSalesUpdated) {
        onSalesUpdated();
      }

      setIsFormOpen(false);
      setEditingDoc(null);
    } catch (error: any) {
      showStatus('Error al guardar en Firestore: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Document from Firestore
  const handleDeleteDoc = async (id: string) => {
    if (!selectedCol) return;
    const confirmDelete = await showConfirm(
      'Eliminar Registro',
      '¿Está seguro de que desea eliminar este registro en Firestore?'
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await firestoreService.deleteDoc(selectedCol.key, id);
      showStatus('Registro eliminado correctamente de Firestore', 'success');
      
      if (selectedCol.key === 'products' && onProductsUpdated) {
        onProductsUpdated();
      }
      if (selectedCol.key === 'sales' && onSalesUpdated) {
        onSalesUpdated();
      }
    } catch (error: any) {
      showStatus('Error al eliminar registro: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtered list of documents for search
  const filteredDocs = documents.filter(doc => {
    if (!searchQueryStr) return true;
    const queryLower = searchQueryStr.toLowerCase();
    return Object.values(doc).some(val => 
      String(val).toLowerCase().includes(queryLower)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-hidden">
      
      {/* Outer Panel Modal Container */}
      <div className="w-full h-full bg-slate-50 flex flex-col justify-between overflow-hidden relative shadow-2xl">
        
        {/* Banner/Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-500/25">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight">Centro de Datos Firestore</h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  Conectado Live
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Visualizador y administrador de las 14 colecciones autorizadas de la base de datos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedCol && (
              <button 
                onClick={() => setSelectedCol(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver al Tablero
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dashboard Panels or Selected Collection Table */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          
          {/* Status Message Banner */}
          <AnimatePresence>
            {statusMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mb-4 p-3.5 rounded-xl border flex items-center gap-2.5 text-sm font-semibold shadow-xs ${
                  statusMessage.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {!selectedCol ? (
            /* Tablero General: Grid of all 14 Collections */
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-base">Estatus de Sincronización</h4>
                  <p className="text-xs text-slate-500 mt-1">Todas las colecciones creadas están vinculadas mediante listeners en tiempo real.</p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-150">
                    <span className="block text-xl font-extrabold text-indigo-600">14</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Colecciones</span>
                  </div>
                  <div className="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-150">
                    <span className="block text-xl font-extrabold text-slate-700">
                      {Object.values(collectionCounts).reduce((a: number, b: number) => a + b, 0)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Documentos</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {COLLECTIONS.map((col) => {
                  const IconComp = col.icon;
                  const count = collectionCounts[col.key] !== undefined ? collectionCounts[col.key] : '...';
                  return (
                    <div 
                      key={col.key}
                      onClick={() => setSelectedCol(col)}
                      className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shadow-xs ${col.color.split(' ')[1]} ${col.color.split(' ')[2]}`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{col.label}</h5>
                          <p className="text-xs text-slate-400 font-medium mt-0.5 font-mono">/{col.key}</p>
                          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{col.description}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-400 uppercase tracking-wider text-[10px]">Registros</span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs">
                          {count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Detailed Collection Table view */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-full">
              
              {/* Table Header Controls */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">Colección: {selectedCol.label}</h4>
                    <p className="text-xs text-slate-500 font-mono">Path: /{selectedCol.key} ({documents.length} registros)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text"
                      placeholder="Buscar en esta colección..."
                      value={searchQueryStr}
                      onChange={(e) => setSearchQueryStr(e.target.value)}
                      className="pl-9 pr-4 py-1.5 rounded-lg border border-slate-250 bg-white text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <button 
                    onClick={handleOpenAdd}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Registro
                  </button>
                </div>
              </div>

              {/* Table Content */}
              <div className="flex-1 overflow-x-auto min-h-0">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="text-xs font-semibold">Cargando registros desde Firestore...</span>
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Database className="w-12 h-12 text-slate-300 mb-2" />
                    <span className="text-sm font-bold text-slate-700">Sin registros</span>
                    <span className="text-xs text-slate-400 mt-1">Haga clic en Agregar Registro para crear el primero.</span>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                        <th className="px-5 py-3 font-semibold text-slate-600">ID</th>
                        {selectedCol.fields.slice(0, 4).map(f => (
                          <th key={f.name} className="px-5 py-3 font-semibold text-slate-600">{f.label}</th>
                        ))}
                        <th className="px-5 py-3 font-semibold text-slate-600 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDocs.map((docData) => (
                        <tr key={docData.id} className="hover:bg-slate-50/50 transition-colors text-xs text-slate-600">
                          <td className="px-5 py-3 font-mono text-[10px] text-slate-400 font-bold truncate max-w-[120px]" title={docData.id}>
                            {docData.id}
                          </td>
                          {selectedCol.fields.slice(0, 4).map(f => {
                            const val = docData[f.name];
                            let renderedVal = String(val !== undefined ? val : '');
                            if (f.type === 'boolean') {
                              renderedVal = val ? 'Sí' : 'No';
                            }
                            return (
                              <td key={f.name} className="px-5 py-3 font-medium text-slate-700">
                                {f.type === 'boolean' ? (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${val ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                                    {renderedVal}
                                  </span>
                                ) : (
                                  <span className="truncate max-w-[180px] block" title={renderedVal}>
                                    {renderedVal}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-5 py-3 text-right shrink-0">
                            <div className="flex justify-end gap-1.5">
                              <button 
                                onClick={() => handleOpenEdit(docData)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteDoc(docData.id)}
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Form Modal (Add / Edit Record) */}
      <AnimatePresence>
        {isFormOpen && selectedCol && (
          <div 
            onClick={(e) => { if (e.target === e.currentTarget) setIsFormOpen(false); }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            >
              <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    {editingDoc ? 'Editar Registro' : 'Agregar Registro'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Colección: /{selectedCol.key}</p>
                </div>
                <button 
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
                {selectedCol.fields.map((f) => (
                  <div key={f.name}>
                    <label className="text-xs font-bold text-slate-500 block mb-1">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>

                    {f.type === 'select' ? (
                      <select
                        required={f.required}
                        value={formData[f.name] !== undefined ? formData[f.name] : ''}
                        onChange={(e) => handleInputChange(f.name, e.target.value, f.type)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-250 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="">-- Seleccionar --</option>
                        {f.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : f.type === 'boolean' ? (
                      <div className="flex items-center gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => handleInputChange(f.name, !formData[f.name], 'boolean')}
                          className="text-slate-600 hover:text-indigo-600 flex items-center gap-1.5"
                        >
                          {formData[f.name] ? (
                            <ToggleRight className="w-9 h-6 text-indigo-600" />
                          ) : (
                            <ToggleLeft className="w-9 h-6 text-slate-350" />
                          )}
                          <span className="text-xs font-semibold">
                            {formData[f.name] ? 'Activo / Sí' : 'Inactivo / No'}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <input
                        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                        step={f.type === 'number' ? 'any' : undefined}
                        required={f.required}
                        placeholder={f.label}
                        value={formData[f.name] !== undefined ? formData[f.name] : ''}
                        onChange={(e) => handleInputChange(f.name, e.target.value, f.type)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-250 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    )}

                    {selectedCol.key === 'products' && f.name === 'stock' && (
                      <p className="mt-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-lg leading-relaxed">
                        ⚠️ Editar el stock aquí no protege contra ventas simultáneas en otras terminales — para ajustes de inventario, usa mejor 'Agregar Stock' o 'Inventariar' en Gestión de Productos, que sí están protegidos contra pérdida de datos por uso concurrente.
                      </p>
                    )}
                  </div>
                ))}

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-250 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    {loading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    {editingDoc ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
