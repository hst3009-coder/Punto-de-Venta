import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAlert } from '../context/AlertContext';
import { getCustomerDebt } from '../lib/customerDebt';
import { getPayableBalance } from '../lib/payableDebt';
import {
  StoreIdentity,
  EmployeePermissions,
  DashboardConfig,
  TicketConfig,
  Product,
  Category,
  Customer,
  Sale,
  CustomerPayment,
  CustomerRefund,
  AccountPayable,
  PayablePayment,
  CreditNote,
  SupplierCreditNote,
  Movement,
  SupplierReturn,
  Closure,
  AuditLogEntry,
  Employee,
  ClientPriceList
} from '../types';
import { firestoreService } from '../lib/firebase';
import {
  X,
  Check,
  Database,
  Store,
  Users,
  Calendar,
  Plus,
  Trash2,
  Percent,
  TrendingUp,
  ToggleLeft,
  ToggleRight,
  Printer,
  FileSpreadsheet,
  Download,
  Loader2,
  ShieldCheck,
  Tags,
  Edit3
} from 'lucide-react';
import { EmployeesView } from './EmployeesView';

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDatabase: () => void;
  identity: StoreIdentity;
  onUpdateIdentity: (identity: StoreIdentity) => void;
  permissions: EmployeePermissions;
  dashboardConfig: DashboardConfig;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
  products?: Product[];
  categories?: Category[];
  customers?: Customer[];
  salesHistory?: Sale[];
  customerPayments?: CustomerPayment[];
  customerRefunds?: CustomerRefund[];
  payables?: AccountPayable[];
  payablePayments?: PayablePayment[];
  creditNotes?: CreditNote[];
  supplierCreditNotes?: SupplierCreditNote[];
  movements?: Movement[];
  supplierReturns?: SupplierReturn[];
  closures?: Closure[];
  currentEmployee?: Employee;
}

export const AdminDrawer: React.FC<AdminDrawerProps> = ({
  isOpen,
  onClose,
  onOpenDatabase,
  identity,
  onUpdateIdentity,
  permissions,
  dashboardConfig,
  onUpdateDashboardConfig,
  products = [],
  categories = [],
  customers = [],
  salesHistory = [],
  customerPayments = [],
  customerRefunds = [],
  payables = [],
  payablePayments = [],
  creditNotes = [],
  supplierCreditNotes = [],
  movements = [],
  supplierReturns = [],
  closures = [],
  currentEmployee,
}) => {
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState<'identity' | 'dashboard' | 'database' | 'employees' | 'audit'>(
    permissions.editStoreSettings ? 'identity' : 
    (permissions.accessDatabaseTools || permissions.exportFullBackup) ? 'database' : 'employees'
  );

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (!isOpen || activeTab !== 'audit' || !permissions.manageEmployees) return;
    setLoadingAudit(true);
    const unsubscribe = firestoreService.subscribeToCollection<AuditLogEntry>(
      'auditLogs',
      (data) => {
        const sorted = [...data].sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setAuditLogs(sorted);
        setLoadingAudit(false);
      },
      (err) => {
        console.error('Error in auditLogs subscription:', err);
        setLoadingAudit(false);
      }
    );
    return () => unsubscribe();
  }, [isOpen, activeTab, permissions.manageEmployees]);

  const [newPaymentTypeLabel, setNewPaymentTypeLabel] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newAccountLabel, setNewAccountLabel] = useState('');
  const [priceListName, setPriceListName] = useState('');
  const [priceListProfit, setPriceListProfit] = useState('');
  const [editingPriceListId, setEditingPriceListId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportFullBackup = () => {
    if (isExporting) return;
    setIsExporting(true);

    setTimeout(async () => {
      try {
        const wb = XLSX.utils.book_new();

        // 1. "Productos": mismo contenido que el respaldo ya existente en InventoryTab
        const productsData = (products || []).map((p) => ({
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
        const wsProducts = XLSX.utils.json_to_sheet(productsData.length > 0 ? productsData : [{ Mensaje: 'Sin productos' }]);
        XLSX.utils.book_append_sheet(wb, wsProducts, 'Productos');

        // 2. "Clientes y Créditos": lista de clientes con deuda actual, límite de crédito, datos contacto
        const customersData = (customers || []).map((c) => {
          const currentDebt = getCustomerDebt(c.id, salesHistory || [], customerPayments || [], customers || [], customerRefunds || []);
          return {
            ID: c.id,
            Nombre: c.name,
            'Cédula / RNC': c.rnc || c.taxId || '',
            Teléfono: c.phone || '',
            Email: c.email || '',
            Dirección: c.address || '',
            'Límite de Crédito': c.creditLimit || 0,
            'Deuda Actual': currentDebt,
            'Deuda Inicial': c.openingDebt || 0,
          };
        });
        const wsCustomers = XLSX.utils.json_to_sheet(customersData.length > 0 ? customersData : [{ Mensaje: 'Sin clientes' }]);
        XLSX.utils.book_append_sheet(wb, wsCustomers, 'Clientes y Créditos');

        // 3. "Cuentas por Pagar": lista de AccountPayable con saldo pendiente
        const payablesData = (payables || []).map((p) => {
          const remainingBalance = getPayableBalance(p.id, payables || [], payablePayments || []);
          return {
            ID: p.id,
            Proveedor: p.supplierName || '',
            'No. Factura / Ref': p.invoiceNumber || '',
            'Monto Total': p.totalAmount || 0,
            'Saldo Pendiente': remainingBalance,
            'Fecha Vencimiento': p.dueDate || '',
            Estado: p.status || '',
            Notas: p.notes || '',
          };
        });
        const wsPayables = XLSX.utils.json_to_sheet(payablesData.length > 0 ? payablesData : [{ Mensaje: 'Sin cuentas por pagar' }]);
        XLSX.utils.book_append_sheet(wb, wsPayables, 'Cuentas por Pagar');

        // 4. "Notas de Crédito (Clientes)": lista completa de CreditNote
        const creditNotesData = (creditNotes || []).map((cn) => ({
          ID: cn.id,
          Código: cn.code,
          'Monto Original': cn.originalAmount,
          'Saldo Disponible': cn.remainingBalance,
          Estado: cn.status,
          Cliente: cn.customerName || '',
          Empleado: cn.employeeName || '',
          'Fecha Emisión': cn.createdAt ? new Date(cn.createdAt).toLocaleString('es-DO') : '',
          'Motivo Anulación': cn.voidReason || '',
          'Fecha Anulación': cn.voidedAt ? new Date(cn.voidedAt).toLocaleString('es-DO') : '',
          'Anulado Por': cn.voidedByEmployeeName || '',
        }));
        const wsCreditNotes = XLSX.utils.json_to_sheet(creditNotesData.length > 0 ? creditNotesData : [{ Mensaje: 'Sin notas de crédito' }]);
        XLSX.utils.book_append_sheet(wb, wsCreditNotes, 'Notas de Crédito (Clientes)');

        // 5. "Notas de Crédito (Proveedores)": lista completa de SupplierCreditNote
        const supplierCreditNotesData = (supplierCreditNotes || []).map((scn) => ({
          ID: scn.id,
          Proveedor: scn.supplierName,
          'Monto Original': scn.originalAmount,
          'Saldo Disponible': scn.remainingBalance,
          Motivo: scn.reason,
          Estado: scn.status,
          Fecha: scn.createdAt ? new Date(scn.createdAt).toLocaleString('es-DO') : '',
        }));
        const wsSupplierCreditNotes = XLSX.utils.json_to_sheet(supplierCreditNotesData.length > 0 ? supplierCreditNotesData : [{ Mensaje: 'Sin notas de crédito de proveedores' }]);
        XLSX.utils.book_append_sheet(wb, wsSupplierCreditNotes, 'Notas de Crédito (Proveedores)');

        // 6. "Egresos": lista de Movement tipo 'out' de los últimos 90 días
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const egresosData = (movements || [])
          .filter((m) => {
            if (m.type !== 'out') return false;
            const dateStr = m.createdAt || m.date;
            if (!dateStr) return true;
            return new Date(dateStr) >= ninetyDaysAgo;
          })
          .map((m) => ({
            ID: m.id,
            Concepto: m.description || m.reason || '',
            Monto: m.amount || 0,
            Categoría: m.category || '',
            'Método de Pago': m.paymentMethod || '',
            Empleado: m.employeeName || '',
            Fecha: (m.createdAt || m.date) ? new Date(m.createdAt || m.date).toLocaleString('es-DO') : '',
          }));
        const wsEgresos = XLSX.utils.json_to_sheet(egresosData.length > 0 ? egresosData : [{ Mensaje: 'Sin egresos en los últimos 90 días' }]);
        XLSX.utils.book_append_sheet(wb, wsEgresos, 'Egresos');

        // 7. "Devoluciones a Proveedor": lista de SupplierReturn
        const supplierReturnsData = (supplierReturns || []).map((sr) => ({
          ID: sr.id,
          Proveedor: sr.supplierName || '',
          'Monto Total': sr.totalAmount || 0,
          Motivo: sr.reason || '',
          Empleado: sr.employeeName || '',
          Fecha: sr.createdAt ? new Date(sr.createdAt).toLocaleString('es-DO') : '',
        }));
        const wsSupplierReturns = XLSX.utils.json_to_sheet(supplierReturnsData.length > 0 ? supplierReturnsData : [{ Mensaje: 'Sin devoluciones a proveedor' }]);
        XLSX.utils.book_append_sheet(wb, wsSupplierReturns, 'Devoluciones a Proveedor');

        // 8. "Cierres de Turno": lista de Closure de los últimos 90 días
        const closuresData = (closures || [])
          .filter((cl) => {
            const dateStr = cl.closedAt || cl.openedAt || cl.createdAt;
            if (!dateStr) return true;
            return new Date(dateStr) >= ninetyDaysAgo;
          })
          .map((cl) => ({
            ID: cl.id,
            Cajero: cl.employeeName || '',
            'Efectivo Apertura': cl.openingCash || 0,
            'Efectivo Esperado': cl.expectedCash || 0,
            'Efectivo Real': cl.actualCash || 0,
            Diferencia: cl.difference || 0,
            'Ventas Efectivo': cl.cashSales || 0,
            'Ventas Tarjeta': cl.cardSales || 0,
            'Ventas Transferencia': cl.transferSales || 0,
            'Ventas Crédito': cl.creditSales || 0,
            'Total Ventas': cl.totalSales || 0,
            'Fecha Apertura': cl.openedAt ? new Date(cl.openedAt).toLocaleString('es-DO') : '',
            'Fecha Cierre': cl.closedAt ? new Date(cl.closedAt).toLocaleString('es-DO') : '',
          }));
        const wsClosures = XLSX.utils.json_to_sheet(closuresData.length > 0 ? closuresData : [{ Mensaje: 'Sin cierres de turno en los últimos 90 días' }]);
        XLSX.utils.book_append_sheet(wb, wsClosures, 'Cierres de Turno');

        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `Respaldo_Negocio_${dateStr}.xlsx`;

        XLSX.writeFile(wb, filename);

        await showAlert('Respaldo Completado', 'El respaldo completo del negocio ha sido generado y descargado con éxito.', 'success');
      } catch (err) {
        console.error('Error generating full business backup:', err);
        await showAlert('Error de Exportación', 'Ocurrió un error al generar el respaldo. Por favor intente nuevamente.', 'error');
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      {/* Background overlay click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-250 flex flex-col justify-between z-10 animate-slide-left">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Panel de Configuración</h3>
            <p className="text-xs text-slate-500 mt-1">Gestión de la identidad de la tienda y base de datos</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2 border-b border-slate-200 flex gap-4 text-sm font-bold bg-white">
          {permissions.editStoreSettings && (
            <button
              onClick={() => setActiveTab('identity')}
              className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'identity'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Identidad</span>
            </button>
          )}
          {permissions.editStoreSettings && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
          )}
          {(permissions.accessDatabaseTools || permissions.exportFullBackup) && (
            <button
              onClick={() => setActiveTab('database')}
              className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'database'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Base de Datos</span>
            </button>
          )}
          {permissions.manageEmployees && (
            <button
              onClick={() => setActiveTab('employees')}
              className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'employees'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Empleados</span>
            </button>
          )}
          {permissions.manageEmployees && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Auditoría</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'identity' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Store className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-800 text-sm">Identidad de la Tienda</h4>
                </div>
                
                <div className="space-y-4">
                  {/* Nombre */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 block">Nombre Comercial</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={identity.showNameOnInvoice}
                          onChange={(e) => onUpdateIdentity({ ...identity, showNameOnInvoice: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                        />
                        Ver en factura
                      </label>
                    </div>
                    <input
                      type="text"
                      value={identity.name || ''}
                      onChange={(e) => onUpdateIdentity({ ...identity, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                  </div>

                  {/* Slogan */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 block">Slogan / Subtítulo</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!identity.showSloganOnInvoice}
                          onChange={(e) => onUpdateIdentity({ ...identity, showSloganOnInvoice: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                        />
                        Ver en factura
                      </label>
                    </div>
                    <input
                      type="text"
                      value={identity.slogan || ''}
                      onChange={(e) => onUpdateIdentity({ ...identity, slogan: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                  </div>

                  {/* Dirección */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 block">Dirección</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!identity.showAddressOnInvoice}
                          onChange={(e) => onUpdateIdentity({ ...identity, showAddressOnInvoice: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                        />
                        Ver en factura
                      </label>
                    </div>
                    <input
                      type="text"
                      value={identity.address || ''}
                      onChange={(e) => onUpdateIdentity({ ...identity, address: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 block">Número de Teléfono</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!identity.showPhoneOnInvoice}
                          onChange={(e) => onUpdateIdentity({ ...identity, showPhoneOnInvoice: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                        />
                        Ver en factura
                      </label>
                    </div>
                    <input
                      type="text"
                      value={identity.phone || ''}
                      onChange={(e) => onUpdateIdentity({ ...identity, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                  </div>

                  {/* Logo/Icono */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 block">Ícono / Logotipo</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!identity.showLogoOnInvoice}
                          onChange={(e) => onUpdateIdentity({ ...identity, showLogoOnInvoice: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                        />
                        Ver en factura
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl border border-slate-200 text-slate-700 flex items-center justify-center text-xl font-bold overflow-hidden bg-white shrink-0 shadow-sm">
                        {identity.logoUrl && (identity.logoUrl.startsWith('data:image') || identity.logoUrl.startsWith('http')) ? (
                          <img src={identity.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          identity.logoUrl || '☕'
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <input
                          type="text"
                          value={identity.logoUrl || ''}
                          placeholder="Ej: ☕ o enlace de imagen"
                          onChange={(e) => onUpdateIdentity({ ...identity, logoUrl: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors block text-center flex-1">
                            Subir Logotipo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    if (typeof reader.result === 'string') {
                                      onUpdateIdentity({ ...identity, logoUrl: reader.result });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => onUpdateIdentity({ ...identity, logoUrl: '☕' })}
                            className="text-[10px] text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition-colors font-bold flex-1"
                          >
                            Restablecer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {activeTab === 'dashboard' && (() => {
            const categoryProfitTargets = dashboardConfig?.categoryProfitTargets || {};

            // Calculate list of all unique categories in store
            const allCategoryList = (() => {
              const map = new Map<string, { id: string; name: string; emoji?: string }>();
              if (categories && categories.length > 0) {
                categories.forEach((c) => {
                  if (c.id !== 'all' && c.name && c.name !== 'Todos') {
                    map.set(c.name, { id: c.id, name: c.name, emoji: c.emoji });
                  }
                });
              }
              products.forEach((p) => {
                if (p.category && p.category.trim() && p.category !== 'all') {
                  const catName = p.category.trim();
                  if (!map.has(catName)) {
                    map.set(catName, { id: catName, name: catName });
                  }
                }
              });
              Object.keys(categoryProfitTargets).forEach((k) => {
                if (k && k !== 'all' && !map.has(k)) {
                  map.set(k, { id: k, name: k });
                }
              });
              return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
            })();

            const paymentTypes = dashboardConfig?.paymentTypes ?? [
              { id: 'cash', label: 'Efectivo', active: true },
              { id: 'card', label: 'Tarjeta', active: true },
              { id: 'transfer', label: 'Transferencia', active: true },
              { id: 'credit', label: 'Crédito', active: true },
            ];
            const bankAccounts = dashboardConfig?.bankAccounts ?? [];
            const clientPriceLists = dashboardConfig?.clientPriceLists ?? [];
            const ticketConfig: TicketConfig = dashboardConfig?.ticketConfig ?? {
              width: '80mm',
              fontFamily: 'mono',
              showLogo: true,
              showSlogan: true,
              showTaxBreakdown: true,
              showEmployeeName: true,
              showFooterMessage: true,
              footerMessageText: '¡Gracias por su compra!',
            };

            const handleTogglePaymentType = (id: string) => {
              const updated = paymentTypes.map((pt) => {
                if (pt.id === id) {
                  return { ...pt, active: !pt.active };
                }
                return pt;
              });
              onUpdateDashboardConfig({
                ...dashboardConfig,
                paymentTypes: updated,
              });
            };

            const handleAddPaymentType = () => {
              if (!newPaymentTypeLabel.trim()) return;
              const newPt = {
                id: `custom_${Date.now()}`,
                label: newPaymentTypeLabel.trim(),
                active: true,
              };
              onUpdateDashboardConfig({
                ...dashboardConfig,
                paymentTypes: [...paymentTypes, newPt],
              });
              setNewPaymentTypeLabel('');
            };

            const handleDeletePaymentType = (id: string) => {
              if (['cash', 'card', 'transfer', 'credit'].includes(id)) return;
              const updated = paymentTypes.filter((pt) => pt.id !== id);
              onUpdateDashboardConfig({
                ...dashboardConfig,
                paymentTypes: updated,
              });
            };

            const handleToggleBankAccount = (id: string) => {
              const updated = bankAccounts.map((ba) => {
                if (ba.id === id) {
                  return { ...ba, active: !ba.active };
                }
                return ba;
              });
              onUpdateDashboardConfig({
                ...dashboardConfig,
                bankAccounts: updated,
              });
            };

            const handleAddBankAccount = () => {
              if (!newBankName.trim() || !newAccountLabel.trim()) return;
              const newBa = {
                id: `bank_${Date.now()}`,
                bankName: newBankName.trim(),
                accountLabel: newAccountLabel.trim(),
                active: true,
              };
              onUpdateDashboardConfig({
                ...dashboardConfig,
                bankAccounts: [...bankAccounts, newBa],
              });
              setNewBankName('');
              setNewAccountLabel('');
            };

            const handleDeleteBankAccount = (id: string) => {
              const updated = bankAccounts.filter((ba) => ba.id !== id);
              onUpdateDashboardConfig({
                ...dashboardConfig,
                bankAccounts: updated,
              });
            };

            return (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5 overflow-y-auto max-h-[70vh]">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Percent className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-800 text-sm">Configuración del Dashboard</h4>
                </div>

                {/* Comisión de Tarjeta */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block">Comisión de Tarjeta (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={dashboardConfig?.cardFeePercent ?? 3.8}
                      onChange={(e) => onUpdateDashboardConfig({
                        ...dashboardConfig,
                        cardFeePercent: parseFloat(e.target.value) || 0
                      })}
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">Tasa estándar descontada automáticamente para el cálculo de depósitos netos.</p>
                </div>

                {/* Efectivo Inicial Configurable */}
                <div className="space-y-1.5 pt-3 border-t border-slate-200">
                  <label className="text-xs font-bold text-slate-500 block">Efectivo Inicial por Defecto (RD$)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={dashboardConfig?.defaultInitialCash ?? 500}
                      onChange={(e) => onUpdateDashboardConfig({
                        ...dashboardConfig,
                        defaultInitialCash: parseFloat(e.target.value) || 0
                      })}
                      className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">RD$</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">Monto precargado para el efectivo inicial en la apertura y corte de turno/caja.</p>
                </div>

                {/* Listado de Feriados */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-800">Días Feriados / No Laborables</label>
                  </div>
                  
                  {/* Formulario para agregar feriado */}
                  <div className="flex gap-2">
                    <input
                      type="date"
                      id="new-holiday-date"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('new-holiday-date') as HTMLInputElement;
                        if (input && input.value) {
                          const dateStr = input.value; // YYYY-MM-DD
                          const currentHolidays = dashboardConfig?.holidays ?? [];
                          if (!currentHolidays.includes(dateStr)) {
                            const updatedHolidays = [...currentHolidays, dateStr].sort();
                            onUpdateDashboardConfig({
                              ...dashboardConfig,
                              holidays: updatedHolidays
                            });
                          }
                          input.value = '';
                        }
                      }}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>

                  {/* Lista de feriados */}
                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                    {(!dashboardConfig?.holidays || dashboardConfig.holidays.length === 0) ? (
                      <p className="text-xs text-slate-400 font-medium italic text-center py-2">No hay días feriados registrados.</p>
                    ) : (
                      dashboardConfig.holidays.map((h) => {
                        // Format to readable Spanish date
                        const parts = h.split('-');
                        const displayDate = parts.length === 3 
                          ? `${parts[2]}/${parts[1]}/${parts[0]}` 
                          : h;
                        return (
                          <div key={h} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-1.5">
                            <span className="text-xs font-semibold text-slate-700">{displayDate}</span>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateDashboardConfig({
                                  ...dashboardConfig,
                                  holidays: (dashboardConfig.holidays || []).filter(item => item !== h)
                                });
                              }}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* --- MARGEN OBJETIVO POR CATEGORÍA --- */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-800">% de Ganancia Objetivo por Categoría</label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    Establece el % de ganancia objetivo para cada categoría. Generará una alerta para productos con margen 5% o más por debajo.
                  </p>

                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {allCategoryList.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium italic text-center py-2">No hay categorías en el catálogo.</p>
                    ) : (
                      allCategoryList.map((catItem) => {
                        const catKey = catItem.name;
                        const currentTarget = categoryProfitTargets[catKey] ?? categoryProfitTargets[catItem.id] ?? '';
                        return (
                          <div key={catItem.id || catItem.name} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-3.5 py-2">
                            <span className="text-xs font-bold text-slate-700 truncate max-w-[180px]" title={catItem.name}>
                              {catItem.emoji ? `${catItem.emoji} ` : ''}{catItem.name}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                min="0"
                                max="1000"
                                step="0.5"
                                placeholder="Ej. 40"
                                disabled={!permissions.editStoreSettings}
                                value={currentTarget}
                                onChange={(e) => {
                                  if (!permissions.editStoreSettings) return;
                                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                  const newTargets = { ...categoryProfitTargets };
                                  if (val === undefined || isNaN(val)) {
                                    delete newTargets[catKey];
                                    delete newTargets[catItem.id];
                                  } else {
                                    newTargets[catKey] = val;
                                  }
                                  onUpdateDashboardConfig({
                                    ...dashboardConfig,
                                    categoryProfitTargets: newTargets,
                                  });
                                }}
                                className={`w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                  !permissions.editStoreSettings ? 'bg-slate-100 cursor-not-allowed' : 'bg-slate-50 focus:bg-white'
                                }`}
                              />
                              <span className="text-xs font-bold text-slate-400">%</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* --- TIPOS DE COBRO --- */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-800">Tipos de Cobro</label>
                  </div>

                  {/* Formulario para agregar tipo de cobro */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej. Transferencia USD, Cheque"
                      value={newPaymentTypeLabel}
                      onChange={(e) => setNewPaymentTypeLabel(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddPaymentType}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>

                  {/* Lista de tipos de cobro */}
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {paymentTypes.map((pt) => {
                      const isOriginal = ['cash', 'card', 'transfer', 'credit'].includes(pt.id);
                      return (
                        <div key={pt.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-1.5">
                          <span className={`text-xs font-semibold ${pt.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                            {pt.label} {isOriginal && <span className="text-[9px] text-indigo-500 font-bold uppercase ml-1">(Básico)</span>}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTogglePaymentType(pt.id)}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              title={pt.active ? "Desactivar" : "Activar"}
                            >
                              {pt.active ? (
                                <ToggleRight className="w-6 h-6 text-indigo-600 cursor-pointer" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-slate-300 cursor-pointer" />
                              )}
                            </button>
                            {!isOriginal && (
                              <button
                                type="button"
                                onClick={() => handleDeletePaymentType(pt.id)}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* --- CUENTAS BANCARIAS --- */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-800">Cuentas Bancarias</label>
                  </div>

                  {/* Formulario para agregar cuenta bancaria */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Banco (ej. Banreservas)"
                        value={newBankName}
                        onChange={(e) => setNewBankName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Etiqueta (ej. Cuenta 1234)"
                        value={newAccountLabel}
                        onChange={(e) => setNewAccountLabel(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddBankAccount}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Cuenta Bancaria
                    </button>
                  </div>

                  {/* Lista de cuentas bancarias */}
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {bankAccounts.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium italic text-center py-2">No hay cuentas bancarias registradas.</p>
                    ) : (
                      bankAccounts.map((ba) => (
                        <div key={ba.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-1.5">
                          <div className="flex flex-col">
                            <span className={`text-xs font-bold ${ba.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                              {ba.bankName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {ba.accountLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleBankAccount(ba.id)}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              title={ba.active ? "Desactivar" : "Activar"}
                            >
                              {ba.active ? (
                                <ToggleRight className="w-6 h-6 text-indigo-600 cursor-pointer" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-slate-300 cursor-pointer" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBankAccount(ba.id)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* --- LISTAS DE PRECIOS DE CLIENTES --- */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Tags className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-800">Listas de Precios de Clientes (% Ganancia)</label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    Define un % de ganancia fijo sobre el costo para los clientes asignados a cada lista (redondeado hacia arriba al peso entero).
                  </p>

                  {/* Formulario para agregar / editar lista de precios */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nombre (ej. Mayorista, Distribuidor)"
                        disabled={!permissions.editStoreSettings}
                        value={priceListName}
                        onChange={(e) => setPriceListName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                      />
                      <div className="relative w-28">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="% Ganancia"
                          disabled={!permissions.editStoreSettings}
                          value={priceListProfit}
                          onChange={(e) => setPriceListProfit(e.target.value)}
                          className="w-full pl-3 pr-7 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!permissions.editStoreSettings}
                        onClick={() => {
                          if (!permissions.editStoreSettings) return;
                          if (!priceListName.trim()) {
                            showAlert('Ingrese el nombre de la lista de precios', 'error');
                            return;
                          }
                          const profitNum = parseFloat(priceListProfit);
                          if (isNaN(profitNum) || profitNum < 0) {
                            showAlert('Ingrese un % de ganancia válido (0 o mayor)', 'error');
                            return;
                          }

                          if (editingPriceListId) {
                            const updated = clientPriceLists.map((pl) =>
                              pl.id === editingPriceListId
                                ? { ...pl, name: priceListName.trim(), profitPercent: profitNum }
                                : pl
                            );
                            onUpdateDashboardConfig({
                              ...dashboardConfig,
                              clientPriceLists: updated,
                            });
                            showAlert('Lista de precios actualizada', 'success');
                          } else {
                            const newPl: ClientPriceList = {
                              id: `pl_${Date.now()}`,
                              name: priceListName.trim(),
                              profitPercent: profitNum,
                            };
                            onUpdateDashboardConfig({
                              ...dashboardConfig,
                              clientPriceLists: [...clientPriceLists, newPl],
                            });
                            showAlert('Lista de precios creada', 'success');
                          }
                          setPriceListName('');
                          setPriceListProfit('');
                          setEditingPriceListId(null);
                        }}
                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {editingPriceListId ? 'Guardar Cambios de Lista' : 'Agregar Lista de Precios'}
                      </button>
                      {editingPriceListId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPriceListId(null);
                            setPriceListName('');
                            setPriceListProfit('');
                          }}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lista de listas de precios configuradas */}
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {clientPriceLists.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium italic text-center py-2">No hay listas de precios registradas.</p>
                    ) : (
                      clientPriceLists.map((pl) => (
                        <div key={pl.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 uppercase">
                              {pl.name}
                            </span>
                            <span className="text-[10px] text-indigo-600 font-bold">
                              +{pl.profitPercent}% ganancia sobre costo
                            </span>
                          </div>
                          {permissions.editStoreSettings && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPriceListId(pl.id);
                                  setPriceListName(pl.name);
                                  setPriceListProfit(pl.profitPercent.toString());
                                }}
                                className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = clientPriceLists.filter((item) => item.id !== pl.id);
                                  onUpdateDashboardConfig({
                                    ...dashboardConfig,
                                    clientPriceLists: updated,
                                  });
                                  if (editingPriceListId === pl.id) {
                                    setEditingPriceListId(null);
                                    setPriceListName('');
                                    setPriceListProfit('');
                                  }
                                  showAlert('Lista de precios eliminada', 'success');
                                }}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* --- CONFIGURACIÓN DE TICKET --- */}
                <div className="space-y-4 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-800">Configuración de Ticket</label>
                  </div>

                  {/* Ancho & Tipografía */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">Ancho de Papel</label>
                      <select
                        value={ticketConfig.width}
                        onChange={(e) => onUpdateDashboardConfig({
                          ...dashboardConfig,
                          ticketConfig: { ...ticketConfig, width: e.target.value as '58mm' | '80mm' }
                        })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                      >
                        <option value="80mm">80mm (Estándar POS)</option>
                        <option value="58mm">58mm (Compacto)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">Tipografía</label>
                      <select
                        value={ticketConfig.fontFamily}
                        onChange={(e) => onUpdateDashboardConfig({
                          ...dashboardConfig,
                          ticketConfig: { ...ticketConfig, fontFamily: e.target.value as 'mono' | 'sans' | 'serif' }
                        })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                      >
                        <option value="mono">Monospace (Térmico)</option>
                        <option value="sans">Sans-Serif (Limpio)</option>
                        <option value="serif">Serif (Clásico)</option>
                      </select>
                    </div>
                  </div>

                  {/* Checkboxes para elementos mostrados */}
                  <div className="space-y-2 pt-1">
                    <label className="text-[11px] font-bold text-slate-600 block">Elementos a Mostrar</label>
                    <div className="space-y-2 bg-white border border-slate-200 rounded-xl p-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ticketConfig.showLogo}
                          onChange={(e) => onUpdateDashboardConfig({
                            ...dashboardConfig,
                            ticketConfig: { ...ticketConfig, showLogo: e.target.checked }
                          })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>Mostrar Logo</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ticketConfig.showSlogan}
                          onChange={(e) => onUpdateDashboardConfig({
                            ...dashboardConfig,
                            ticketConfig: { ...ticketConfig, showSlogan: e.target.checked }
                          })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>Mostrar Slogan</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ticketConfig.showTaxBreakdown}
                          onChange={(e) => onUpdateDashboardConfig({
                            ...dashboardConfig,
                            ticketConfig: { ...ticketConfig, showTaxBreakdown: e.target.checked }
                          })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>Desglosar Subtotal / ITBIS</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ticketConfig.showEmployeeName}
                          onChange={(e) => onUpdateDashboardConfig({
                            ...dashboardConfig,
                            ticketConfig: { ...ticketConfig, showEmployeeName: e.target.checked }
                          })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>Mostrar Cajero ("Atendido por")</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ticketConfig.showFooterMessage}
                          onChange={(e) => onUpdateDashboardConfig({
                            ...dashboardConfig,
                            ticketConfig: { ...ticketConfig, showFooterMessage: e.target.checked }
                          })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span>Mostrar Mensaje de Pie</span>
                      </label>
                    </div>
                  </div>

                  {/* Texto del Mensaje al Pie */}
                  {ticketConfig.showFooterMessage && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600 block">Mensaje de Pie de Ticket</label>
                      <input
                        type="text"
                        value={ticketConfig.footerMessageText || ''}
                        onChange={(e) => onUpdateDashboardConfig({
                          ...dashboardConfig,
                          ticketConfig: { ...ticketConfig, footerMessageText: e.target.value }
                        })}
                        placeholder="ej. ¡Gracias por su compra!"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === 'database' && (
            <div className="space-y-6">
              {permissions.exportFullBackup && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                    <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Respaldo Completo del Negocio</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Exporta toda la información operativa y financiera en un libro de Excel (.xlsx) multihaja.</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Genera una hoja individual por cada conjunto de datos: Productos, Clientes y Créditos, Cuentas por Pagar, Notas de Crédito (Clientes y Proveedores), Egresos (últimos 90 días), Devoluciones a Proveedor y Cierres de Turno (últimos 90 días).
                  </p>

                  <button
                    type="button"
                    onClick={handleExportFullBackup}
                    disabled={isExporting}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm active:scale-98"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Generando Respaldo en Excel...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Descargar Respaldo Completo del Negocio (.xlsx)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {permissions.accessDatabaseTools && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Centro de Datos Firestore</h4>
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm mx-auto">
                        Accede a la consola de administración en tiempo real de las 14 colecciones autorizadas de la base de datos (ventas, cierres, mermas, clientes, etc.).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose(); // Close the admin drawer first
                        onOpenDatabase(); // Open the Database Control Center!
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 mx-auto"
                    >
                      <Database className="w-3.5 h-3.5" /> Abrir Centro de Datos
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                    <h5 className="text-xs font-black uppercase text-slate-400 tracking-wider">Estado de Conexión</h5>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500">Servidor Firestore:</span>
                      <span className="text-emerald-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Activo (Live)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold border-t border-slate-200/60 pt-2.5">
                      <span className="text-slate-500">Proyecto de Base de Datos:</span>
                      <span className="text-slate-700 font-mono text-[10px]">ai-studio-puntodeventa</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'employees' && permissions.manageEmployees && (
            <EmployeesView currentEmployee={currentEmployee} />
          )}

          {activeTab === 'audit' && permissions.manageEmployees && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-800 text-sm">Registro de Auditoría</h4>
                </div>
                <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {auditLogs.length} registro(s)
                </span>
              </div>

              {loadingAudit ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                  Cargando registros de auditoría...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  No hay acciones registradas en la auditoría.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1 hover:bg-slate-100/60 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-indigo-600">
                          {log.employeeName || 'Sistema / Administrador'}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString('es-DO') : 'Sin fecha'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed">
                        {log.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info or quick restore */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500 font-medium">
          <span>* Los productos creados se guardan localmente.</span>
        </div>

      </div>
    </div>
  );
};
