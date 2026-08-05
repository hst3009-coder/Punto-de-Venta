import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAlert } from '../context/AlertContext';
import { getCustomerDebt } from '../lib/customerDebt';
import { getPayableBalance } from '../lib/payableDebt';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { isFuzzyMatch } from '../lib/textSearch';
import {
  StoreIdentity,
  EmployeePermissions,
  DashboardConfig,
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
  Employee,
  CardDeposit,
  Supplier,
} from '../types';
import { firestoreService } from '../lib/firebase';
import {
  X,
  Search,
  Store,
  Users,
  Database,
  Percent,
  Printer,
  Calendar,
  TrendingUp,
  Tags,
  SlidersHorizontal,
} from 'lucide-react';
import { EmployeesView } from './EmployeesView';
import { StoreIdentitySection } from './admin/StoreIdentitySection';
import { TicketConfigSection } from './admin/TicketConfigSection';
import { CardCommissionsDepositsSection } from './admin/CardCommissionsDepositsSection';
import { CashAndHolidaysSection } from './admin/CashAndHolidaysSection';
import { CategoryProfitTargetsSection } from './admin/CategoryProfitTargetsSection';
import { PaymentTypesSection } from './admin/PaymentTypesSection';
import { BankAccountsSection } from './admin/BankAccountsSection';
import { ClientPriceListsSection } from './admin/ClientPriceListsSection';
import { DatabaseToolsSection } from './admin/DatabaseToolsSection';
import { SuppliersSection } from './admin/SuppliersSection';

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
  cardDeposits?: CardDeposit[];
  suppliers?: Supplier[];
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
  cardDeposits = [],
  suppliers = [],
}) => {
  const { showAlert, showConfirm } = useAlert();
  const [activeTab, setActiveTab] = useState<'identity' | 'config' | 'database' | 'employees'>(
    permissions.editStoreSettings
      ? 'identity'
      : permissions.accessDatabaseTools || permissions.exportFullBackup
      ? 'database'
      : 'employees'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isCleaningDeposits, setIsCleaningDeposits] = useState(false);

  const handleCleanupDuplicateCardDeposits = async () => {
    if (isCleaningDeposits) return;
    setIsCleaningDeposits(true);
    try {
      // Fetch latest card deposits directly from Firestore
      const dbDeposits = await firestoreService.getCollectionDocs<CardDeposit>('cardDeposits');

      const depositsByDate: Record<string, CardDeposit[]> = {};
      dbDeposits.forEach((dep) => {
        if (!dep.batchDate) return;
        if (!depositsByDate[dep.batchDate]) {
          depositsByDate[dep.batchDate] = [];
        }
        depositsByDate[dep.batchDate].push(dep);
      });

      const itemsToDelete: CardDeposit[] = [];

      Object.entries(depositsByDate).forEach(([_dateStr, deposits]) => {
        if (deposits.length > 1) {
          // Sort by createdAt ascending (oldest first)
          const sorted = [...deposits].sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (timeA !== timeB) return timeA - timeB;
            return a.id.localeCompare(b.id);
          });

          // Keep sorted[0] (the oldest), mark the rest for deletion
          const duplicates = sorted.slice(1);
          itemsToDelete.push(...duplicates);
        }
      });

      if (itemsToDelete.length === 0) {
        await showAlert('Sin Duplicados', 'No se encontraron depósitos de tarjeta duplicados para la misma fecha.', 'info');
        return;
      }

      const detailsList = itemsToDelete
        .map(
          (item) =>
            `• Fecha Lote: ${item.batchDate} | ID: ${item.id} | Monto Bruto: RD$ ${item.grossAmount.toLocaleString('es-DO')} | Estado: ${
              item.status === 'confirmed' ? 'Confirmado' : 'Pendiente'
            }`
        )
        .join('\n');

      const confirmDelete = await showConfirm(
        'Limpiar Depósitos Duplicados',
        `Se encontraron ${itemsToDelete.length} depósitos duplicados para la misma fecha de lote.\n\nSe conservará el registro más antiguo de cada fecha y se ELIMINARÁN los siguientes duplicados:\n\n${detailsList}\n\n¿Desea eliminar estos registros de forma permanente?`,
        'Eliminar Duplicados',
        'Cancelar'
      );

      if (!confirmDelete) return;

      for (const item of itemsToDelete) {
        await firestoreService.deleteDoc('cardDeposits', item.id);
      }

      await showAlert(
        'Depósitos Limpiados',
        `Se eliminaron exitosamente ${itemsToDelete.length} depósitos duplicados.`,
        'success'
      );
    } catch (err) {
      console.error('Error al limpiar depósitos duplicados:', err);
      await showAlert('Error', 'Ocurrió un error al intentar limpiar los depósitos duplicados.', 'error');
    } finally {
      setIsCleaningDeposits(false);
    }
  };

  const handleExportFullBackup = () => {
    if (isExporting) return;
    setIsExporting(true);

    setTimeout(async () => {
      try {
        const wb = XLSX.utils.book_new();

        // 1. "Productos"
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

        // 2. "Clientes y Créditos"
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

        // 3. "Cuentas por Pagar"
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

        // 4. "Notas de Crédito (Clientes)"
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

        // 5. "Notas de Crédito (Proveedores)"
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

        // 6. "Egresos"
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
            Fecha: m.createdAt || m.date ? new Date(m.createdAt || m.date).toLocaleString('es-DO') : '',
          }));
        const wsEgresos = XLSX.utils.json_to_sheet(egresosData.length > 0 ? egresosData : [{ Mensaje: 'Sin egresos en los últimos 90 días' }]);
        XLSX.utils.book_append_sheet(wb, wsEgresos, 'Egresos');

        // 7. "Devoluciones a Proveedor"
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

        // 8. "Cierres de Turno"
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

  // Define section items
  const sections = [
    {
      id: 'identity',
      title: 'Identidad de la Tienda',
      tab: 'identity' as const,
      keywords: ['identidad', 'tienda', 'nombre', 'slogan', 'subtitulo', 'direccion', 'telefono', 'logo', 'logotipo', 'factura', 'icono', 'comercial'],
      permission: permissions.editStoreSettings,
      component: <StoreIdentitySection identity={identity} onUpdateIdentity={onUpdateIdentity} />,
    },
    {
      id: 'ticket',
      title: 'Ticket / Recibo',
      tab: 'config' as const,
      keywords: ['ticket', 'recibo', 'impresora', 'papel', '58mm', '80mm', 'tipografia', 'mono', 'sans', 'serif', 'logo', 'slogan', 'itbis', 'cajero', 'pie', 'factura', 'desglose'],
      permission: permissions.editStoreSettings,
      component: <TicketConfigSection dashboardConfig={dashboardConfig} onUpdateDashboardConfig={onUpdateDashboardConfig} />,
    },
    {
      id: 'commissions',
      title: 'Comisiones y Depósitos de Tarjeta',
      tab: 'config' as const,
      keywords: ['comision', 'tarjeta', 'deposito', 'duplicados', 'limpieza', 'lote', 'fee', 'mantenimiento', 'monto', 'bruto'],
      permission: permissions.editStoreSettings,
      component: (
        <CardCommissionsDepositsSection
          dashboardConfig={dashboardConfig}
          onUpdateDashboardConfig={onUpdateDashboardConfig}
          permissions={permissions}
          isCleaningDeposits={isCleaningDeposits}
          onCleanupDuplicateCardDeposits={handleCleanupDuplicateCardDeposits}
        />
      ),
    },
    {
      id: 'cash_holidays',
      title: 'Efectivo Inicial y Días Feriados',
      tab: 'config' as const,
      keywords: ['efectivo', 'inicial', 'apertura', 'corte', 'caja', 'feriado', 'feriados', 'dias no laborables', 'calendario', 'fecha'],
      permission: permissions.editStoreSettings,
      component: <CashAndHolidaysSection dashboardConfig={dashboardConfig} onUpdateDashboardConfig={onUpdateDashboardConfig} />,
    },
    {
      id: 'category_profit',
      title: 'Metas de Ganancia por Categoría',
      tab: 'config' as const,
      keywords: ['meta', 'metas', 'ganancia', 'categoria', 'categorias', 'margen', 'objetivo', 'alerta', 'porcentaje', '%'],
      permission: permissions.editStoreSettings,
      component: (
        <CategoryProfitTargetsSection
          dashboardConfig={dashboardConfig}
          onUpdateDashboardConfig={onUpdateDashboardConfig}
          permissions={permissions}
          categories={categories}
          products={products}
        />
      ),
    },
    {
      id: 'payment_types',
      title: 'Tipos de Cobro',
      tab: 'config' as const,
      keywords: ['tipo', 'cobro', 'metodo', 'pago', 'efectivo', 'tarjeta', 'transferencia', 'credito', 'custom', 'cheque'],
      permission: permissions.editStoreSettings,
      component: <PaymentTypesSection dashboardConfig={dashboardConfig} onUpdateDashboardConfig={onUpdateDashboardConfig} />,
    },
    {
      id: 'bank_accounts',
      title: 'Bancos y Cuentas Bancarias',
      tab: 'config' as const,
      keywords: ['banco', 'bancos', 'cuenta', 'cuentas', 'bancaria', 'bancarias', 'banreservas', 'etiqueta', 'transferencia'],
      permission: permissions.editStoreSettings,
      component: <BankAccountsSection dashboardConfig={dashboardConfig} onUpdateDashboardConfig={onUpdateDashboardConfig} />,
    },
    {
      id: 'client_price_lists',
      title: 'Listas de Precios de Clientes',
      tab: 'config' as const,
      keywords: ['lista', 'listas', 'precio', 'precios', 'cliente', 'clientes', 'mayorista', 'distribuidor', 'ganancia', 'costo'],
      permission: permissions.editStoreSettings,
      component: (
        <ClientPriceListsSection
          dashboardConfig={dashboardConfig}
          onUpdateDashboardConfig={onUpdateDashboardConfig}
          permissions={permissions}
        />
      ),
    },
    {
      id: 'suppliers',
      title: 'Gestión de Proveedores',
      tab: 'config' as const,
      keywords: ['proveedor', 'proveedores', 'contacto', 'telefono', 'email', 'compras', 'supplier', 'direccion'],
      permission: permissions.editStoreSettings,
      component: <SuppliersSection suppliers={suppliers} />,
    },
    {
      id: 'database',
      title: 'Herramientas de Base de Datos',
      tab: 'database' as const,
      keywords: ['base', 'datos', 'database', 'respaldo', 'backup', 'excel', 'xlsx', 'firestore', 'centro', 'conexion', 'servidor', 'descargar'],
      permission: permissions.accessDatabaseTools || permissions.exportFullBackup,
      component: (
        <DatabaseToolsSection
          permissions={permissions}
          isExporting={isExporting}
          onExportFullBackup={handleExportFullBackup}
          onCloseDrawer={onClose}
          onOpenDatabase={onOpenDatabase}
        />
      ),
    },
    {
      id: 'employees',
      title: 'Gestión de Empleados',
      tab: 'employees' as const,
      keywords: ['empleado', 'empleados', 'cajero', 'permisos', 'usuarios', 'roles', 'pin', 'personal'],
      permission: permissions.manageEmployees,
      component: <EmployeesView currentEmployee={currentEmployee} />,
    },
  ];

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);
  const trimmedSearch = debouncedSearchQuery.trim();
  const isSearching = trimmedSearch.length > 0;

  // Filter sections by permissions first, then search query if provided
  const visibleSections = sections.filter((sec) => {
    if (!sec.permission) return false;
    if (!isSearching) return sec.tab === activeTab;
    return (
      isFuzzyMatch(trimmedSearch, sec.title) ||
      sec.keywords.some((kw) => isFuzzyMatch(trimmedSearch, kw))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      {/* Background overlay click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between z-10 animate-slide-left">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/90 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-800">Panel de Configuración</h3>
              <p className="text-xs text-slate-500 mt-0.5">Gestión de identidad, ajustes y base de datos</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Buscador de Secciones / Configuración */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input autoComplete="off"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar sección o ajuste (ej. feriado, ticket, comisión)..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none placeholder:text-slate-400 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs (Hidden during search) */}
        {!isSearching && (
          <div className="px-5 py-2.5 border-b border-slate-200 flex gap-2 text-xs font-bold bg-white overflow-x-auto no-scrollbar">
            {permissions.editStoreSettings && (
              <button
                onClick={() => setActiveTab('identity')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'identity'
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/60 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Identidad</span>
              </button>
            )}
            {permissions.editStoreSettings && (
              <button
                onClick={() => setActiveTab('config')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'config'
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/60 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Ajustes & Cobros</span>
              </button>
            )}
            {(permissions.accessDatabaseTools || permissions.exportFullBackup) && (
              <button
                onClick={() => setActiveTab('database')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'database'
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/60 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Base de Datos</span>
              </button>
            )}
            {permissions.manageEmployees && (
              <button
                onClick={() => setActiveTab('employees')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'employees'
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/60 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Empleados</span>
              </button>
            )}
          </div>
        )}

        {/* Search Results Header indicator */}
        {isSearching && (
          <div className="px-5 py-2 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-900 font-semibold">
            <span>Resultados de búsqueda para "{searchQuery}":</span>
            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {visibleSections.length} {visibleSections.length === 1 ? 'sección' : 'secciones'}
            </span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {visibleSections.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">No se encontraron configuraciones</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Intenta buscar con otros términos como feriado, ticket, depósito, banco, ganancia o empleado.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            visibleSections.map((sec) => (
              <div key={sec.id} className="space-y-2">
                {isSearching && (
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                    {sec.title}
                  </div>
                )}
                {sec.component}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500 font-medium">
          <span>* Los cambios de configuración se aplican inmediatamente.</span>
        </div>
      </div>
    </div>
  );
};
