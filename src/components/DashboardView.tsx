import React, { useState } from 'react';
import {
  Product,
  Sale,
  Customer,
  CustomerPayment,
  Employee,
  Closure,
  Movement,
  AccountPayable,
  PayablePayment,
  CardDeposit,
  DashboardConfig,
  SupplierReturn,
  CustomerRefund,
  CreditNote,
  SupplierCreditNote,
  AuditLogEntry,
  PurchaseOrder,
  PurchaseReceipt,
  Supplier,
} from '../types';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Coins,
  TrendingUp,
  Users,
  Package,
  AlertCircle,
  Receipt,
  Award,
  CreditCard,
  Landmark,
  FileBarChart,
  Ban,
  Activity,
  X,
  Search,
  Check,
  Printer,
  DollarSign,
  Info,
  Truck,
  ShieldAlert,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from 'lucide-react';
import { useAlert } from '../context/AlertContext';
import { usePermissions } from '../hooks/usePermissions';
import { firestoreService } from '../lib/firebase';
import { useCardDepositGenerator } from '../hooks/useCardDepositGenerator';
import { useDashboardDateFilter } from '../hooks/useDashboardDateFilter';
import { useAdminShiftManager } from '../hooks/useAdminShiftManager';
import { useDashboardKPIs } from '../hooks/useDashboardKPIs';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

function lazyWithRetry(componentImport: () => Promise<any>, exportName?: string) {
  return React.lazy(async () => {
    try {
      const m = await componentImport();
      return { default: exportName ? m[exportName] : m.default || m };
    } catch (error) {
      console.warn('Dynamic import failed, retrying...', error);
      try {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const m = await componentImport();
        return { default: exportName ? m[exportName] : m.default || m };
      } catch (retryErr) {
        throw retryErr;
      }
    }
  });
}

const ResumenTab = lazyWithRetry(() => import('./dashboard/ResumenTab'), 'ResumenTab');
const VentasTab = lazyWithRetry(() => import('./dashboard/VentasTab'), 'VentasTab');
const CreditosTab = lazyWithRetry(() => import('./dashboard/CreditosTab'), 'CreditosTab');
const InventarioTab = lazyWithRetry(() => import('./dashboard/InventarioTab'), 'InventarioTab');
const EmpleadosTab = lazyWithRetry(() => import('./dashboard/EmpleadosTab'), 'EmpleadosTab');
const PayablesTab = lazyWithRetry(() => import('./dashboard/PayablesTab'), 'PayablesTab');
const ComprasTab = lazyWithRetry(() => import('./dashboard/ComprasTab'), 'ComprasTab');
const DevolucionesTab = lazyWithRetry(() => import('./dashboard/DevolucionesTab'), 'DevolucionesTab');
const BancosTab = lazyWithRetry(() => import('./dashboard/BancosTab'), 'BancosTab');
const NotasCreditoTab = lazyWithRetry(() => import('./dashboard/NotasCreditoTab'), 'NotasCreditoTab');
const EstadoResultadosTab = lazyWithRetry(() => import('./dashboard/EstadoResultadosTab'), 'EstadoResultadosTab');
const AnomaliasTab = lazyWithRetry(() => import('./dashboard/AnomaliasTab'), 'AnomaliasTab');
const EgresosTab = lazyWithRetry(() => import('./dashboard/EgresosTab'), 'EgresosTab');
const ActividadTab = lazyWithRetry(() => import('./dashboard/ActividadTab'), 'ActividadTab');

interface DashboardViewProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  customerPayments: CustomerPayment[];
  employees: Employee[];
  closures: Closure[];
  movements?: Movement[];
  customerRefunds?: CustomerRefund[];
  onNavigateToCustomer: (customerId: string) => void;
  onNavigateToProduct: (productId: string) => void;
  onOpenExpenses?: () => void;
  currentEmployee?: Employee | null;
  payables?: AccountPayable[];
  payablePayments?: PayablePayment[];
  cardDeposits?: CardDeposit[];
  dashboardConfig?: DashboardConfig;
  onOpenMenudo?: () => void;
  supplierReturns?: SupplierReturn[];
  supplierCreditNotes?: SupplierCreditNote[];
  creditNotes?: CreditNote[];
  purchaseOrders?: PurchaseOrder[];
  purchaseReceipts?: PurchaseReceipt[];
  suppliers?: Supplier[];
}

type DashboardTab =
  | 'resumen'
  | 'ventas'
  | 'creditos'
  | 'compras'
  | 'cuentas_pagar'
  | 'bancos'
  | 'inventario'
  | 'devoluciones'
  | 'notas_credito'
  | 'estado_resultados'
  | 'empleados'
  | 'anomalias'
  | 'egresos'
  | 'actividad';

export const DashboardView: React.FC<DashboardViewProps> = ({
  isOpen,
  onClose,
  products,
  sales,
  customers,
  customerPayments,
  employees,
  closures,
  movements = [],
  customerRefunds = [],
  creditNotes = [],
  onNavigateToCustomer,
  onNavigateToProduct,
  onOpenExpenses,
  currentEmployee = null,
  payables = [],
  payablePayments = [],
  cardDeposits = [],
  dashboardConfig = { id: 'dashboardConfig', cardFeePercent: 3.8, holidays: [] },
  onOpenMenudo,
  supplierReturns = [],
  supplierCreditNotes = [],
  purchaseOrders = [],
  purchaseReceipts = [],
  suppliers = [],
}) => {
  const { showAlert, showConfirm } = useAlert();
  const permissions = usePermissions(currentEmployee);

  const [activeTab, setActiveTab] = useState<DashboardTab>('resumen');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [favoriteTabs, setFavoriteTabs] = useState<DashboardTab[]>(() => {
    try {
      const saved = localStorage.getItem('pos_dashboard_favorite_tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed as DashboardTab[];
      }
    } catch (err) {
      console.error('Error loading favorite tabs:', err);
    }
    return [];
  });

  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pos_dashboard_panel_collapsed') === 'true';
    } catch (err) {
      return false;
    }
  });

  const toggleFavoriteTab = (tabId: DashboardTab) => {
    setFavoriteTabs((prev) => {
      let next: DashboardTab[];
      if (prev.includes(tabId)) {
        next = prev.filter((id) => id !== tabId);
      } else {
        next = [...prev, tabId];
      }
      try {
        localStorage.setItem('pos_dashboard_favorite_tabs', JSON.stringify(next));
      } catch (err) {
        console.error('Error saving favorite tabs:', err);
      }
      return next;
    });
  };

  const togglePanelCollapsed = () => {
    setIsPanelCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pos_dashboard_panel_collapsed', next ? 'true' : 'false');
      } catch (err) {
        console.error('Error saving panel collapsed state:', err);
      }
      return next;
    });
  };
  const [draftOrdersForCompras, setDraftOrdersForCompras] = useState<any[]>([]);
  const [selectedClosureModal, setSelectedClosureModal] = useState<Closure | null>(null);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [isLiquidityModalOpen, setIsLiquidityModalOpen] = useState(false);

  // Credit notes tab filter states
  const [creditNoteSearch, setCreditNoteSearch] = useState('');
  const [creditNoteStatusFilter, setCreditNoteStatusFilter] = useState<
    'all' | 'active' | 'depleted' | 'voided'
  >('all');
  const [noteToVoid, setNoteToVoid] = useState<CreditNote | null>(null);
  const [voidReasonInput, setVoidReasonInput] = useState('');

  // Credit Note Lookup Modal state
  const [isQueryCreditNoteOpen, setIsQueryCreditNoteOpen] = useState(false);
  const [queryCreditNoteCode, setQueryCreditNoteCode] = useState('');
  const [queryCreditNoteResult, setQueryCreditNoteResult] = useState<
    CreditNote | 'not_found' | null
  >(null);

  // Auto-create card deposits
  useCardDepositGenerator({
    isOpen,
    sales,
    cardDeposits,
    dashboardConfig,
  });

  // Date filters
  const dateFilter = useDashboardDateFilter();
  const {
    filterType,
    setFilterType,
    selectedDay,
    setSelectedDay,
    selectedWeekAnchor,
    setSelectedWeekAnchor,
    selectedMonthAnchor,
    customRangeStart,
    setCustomRangeStart,
    customRangeEnd,
    setCustomRangeEnd,
    start,
    end,
    handlePrev,
    handleNext,
    formattedRangeText,
  } = dateFilter;

  // Shift manager
  const shiftManager = useAdminShiftManager({
    currentEmployee,
    employees,
    closures,
    sales,
    movements,
    dashboardConfig,
    showAlert,
    showConfirm,
  });

  // KPIs
  const kpis = useDashboardKPIs({
    products,
    sales,
    customers,
    customerPayments,
    employees,
    closures,
    movements,
    customerRefunds,
    creditNotes,
    payables,
    payablePayments,
    cardDeposits,
    supplierReturns,
    dashboardConfig,
    filterType,
    selectedDay,
    selectedWeekAnchor,
    selectedMonthAnchor,
    customRangeStart,
    customRangeEnd,
    start,
    end,
    selectedClosureModal,
  });

  const handleVoidCreditNote = async () => {
    if (!noteToVoid) return;
    if (!voidReasonInput.trim()) {
      await showAlert('Motivo Requerido', 'Debes especificar la razón de la anulación.', 'warning');
      return;
    }

    try {
      await firestoreService.updateDoc('creditNotes', noteToVoid.id, {
        status: 'voided',
        voidedAt: new Date().toISOString(),
        voidedByEmployeeId: currentEmployee?.id || '',
        voidedByEmployeeName: currentEmployee?.name || 'Administrador',
        voidReason: voidReasonInput.trim(),
      });

      try {
        const auditData: Omit<AuditLogEntry, 'id'> = {
          action: 'void_credit_note',
          description: `Anuló la nota de crédito #${noteToVoid.code} (${noteToVoid.customerName}). Motivo: ${voidReasonInput.trim()}`,
          employeeId: currentEmployee?.id || '',
          employeeName: currentEmployee?.name || 'Administrador',
          createdAt: new Date().toISOString(),
        };
        await firestoreService.addDoc('auditLogs', auditData);
      } catch (auditErr) {
        console.error('Error recording audit log:', auditErr);
      }

      await showAlert('Nota Anulada', `La nota de crédito #${noteToVoid.code} ha sido anulada exitosamente.`, 'success');
      setNoteToVoid(null);
      setVoidReasonInput('');
    } catch (err: any) {
      console.error('Error voiding credit note:', err);
      await showAlert('Error', 'No se pudo anular la nota de crédito: ' + err.message, 'error');
    }
  };

  const handleSearchCreditNoteCode = () => {
    const codeClean = queryCreditNoteCode.trim().toUpperCase();
    if (!codeClean) return;
    const found = creditNotes.find((cn) => cn.code.toUpperCase() === codeClean);
    if (found) {
      setQueryCreditNoteResult(found);
    } else {
      setQueryCreditNoteResult('not_found');
    }
  };

  if (!isOpen) return null;

  const defaultTabs: Array<{ id: DashboardTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'resumen', label: 'Resumen', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'ventas', label: 'Ventas', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'creditos', label: 'Créditos CxC', icon: <Users className="w-4 h-4" /> },
    { id: 'compras', label: 'Compras / OC', icon: <Truck className="w-4 h-4" /> },
    { id: 'cuentas_pagar', label: 'Cuentas x Pagar', icon: <Receipt className="w-4 h-4" /> },
    { id: 'bancos', label: 'Bancos / Tarjetas', icon: <Landmark className="w-4 h-4" /> },
    { id: 'inventario', label: 'Inventario', icon: <Package className="w-4 h-4" /> },
    { id: 'devoluciones', label: 'Devoluciones', icon: <AlertCircle className="w-4 h-4" /> },
    { id: 'notas_credito', label: 'Notas de Crédito', icon: <Receipt className="w-4 h-4" /> },
    { id: 'estado_resultados', label: 'Estado de Resultados', icon: <FileBarChart className="w-4 h-4" /> },
    { id: 'empleados', label: 'Empleados', icon: <Award className="w-4 h-4" /> },
    { id: 'anomalias', label: 'Anomalías Operativas', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'egresos', label: 'Egresos', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'actividad', label: 'Actividad', icon: <Activity className="w-4 h-4" /> },
  ];

  const tabs = React.useMemo(() => {
    if (favoriteTabs.length === 0) return defaultTabs;

    const favSet = new Set(favoriteTabs);
    const tabMap = new Map(defaultTabs.map((t) => [t.id, t]));

    const favList: typeof defaultTabs = [];
    favoriteTabs.forEach((id) => {
      const item = tabMap.get(id);
      if (item) favList.push(item);
    });

    const nonFavList = defaultTabs.filter((t) => !favSet.has(t.id));

    return [...favList, ...nonFavList];
  }, [favoriteTabs]);

  const canAccessTab = (tabId: DashboardTab): boolean => {
    switch (tabId) {
      case 'empleados':
      case 'anomalias':
        return !!(permissions.manageEmployees || currentEmployee?.role === 'admin');
      case 'cuentas_pagar':
        return permissions.managePayables !== false;
      case 'compras':
        return (permissions.managePurchaseOrders ?? permissions.manageProducts) !== false;
      case 'devoluciones':
      case 'notas_credito':
        return permissions.manageReturns !== false;
      case 'bancos':
        return permissions.confirmBankDeposits !== false;
      case 'egresos':
        return permissions.registerExpenses !== false;
      case 'inventario':
        return permissions.manageProducts !== false;
      case 'creditos':
        return permissions.manageCustomers !== false;
      default:
        return true;
    }
  };

  const handleTabShortcut = (index: number, e: KeyboardEvent) => {
    const targetTab = tabs[index];
    if (!targetTab) return;
    if (!canAccessTab(targetTab.id)) return;

    e.preventDefault();
    setActiveTab(targetTab.id);
  };

  useKeyboardShortcuts(
    {
      'Alt+1': (e) => handleTabShortcut(0, e),
      'Alt+2': (e) => handleTabShortcut(1, e),
      'Alt+3': (e) => handleTabShortcut(2, e),
      'Alt+4': (e) => handleTabShortcut(3, e),
      'Alt+5': (e) => handleTabShortcut(4, e),
      'Alt+6': (e) => handleTabShortcut(5, e),
      'Alt+7': (e) => handleTabShortcut(6, e),
      'Alt+8': (e) => handleTabShortcut(7, e),
      'Alt+9': (e) => handleTabShortcut(8, e),
      'Alt+0': (e) => handleTabShortcut(9, e),
      'alt+1': (e) => handleTabShortcut(0, e),
      'alt+2': (e) => handleTabShortcut(1, e),
      'alt+3': (e) => handleTabShortcut(2, e),
      'alt+4': (e) => handleTabShortcut(3, e),
      'alt+5': (e) => handleTabShortcut(4, e),
      'alt+6': (e) => handleTabShortcut(5, e),
      'alt+7': (e) => handleTabShortcut(6, e),
      'alt+8': (e) => handleTabShortcut(7, e),
      'alt+9': (e) => handleTabShortcut(8, e),
      'alt+0': (e) => handleTabShortcut(9, e),
    },
    isOpen
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 animate-fade-in h-screen w-screen overflow-hidden text-slate-800">
      {/* 1. Header Area */}
      <header className="bg-white border-b border-slate-200 shrink-0 shadow-xs px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
              <LayoutDashboard className="w-5 h-5 text-indigo-600" />
              <span>Centro de Control y Analíticas</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              Métricas de rendimiento del negocio
            </p>
          </div>
        </div>

        {/* Flexible Time Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Main Filter Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(['Día', 'Semana', 'Mes', 'Rango'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
                  filterType === type
                    ? 'bg-white text-indigo-600 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Navigators / Date Selectors depending on filter type */}
          <div className="flex items-center gap-2">
            {filterType !== 'Rango' ? (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-xs">
                <button
                  onClick={handlePrev}
                  className="p-1.5 hover:bg-white rounded-lg transition-all cursor-pointer text-slate-500 hover:text-slate-800 border border-transparent hover:border-slate-200"
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 text-xs font-black text-slate-700 uppercase tracking-wider font-mono text-center min-w-[150px] whitespace-nowrap">
                  {formattedRangeText}
                </span>

                <button
                  onClick={handleNext}
                  className="p-1.5 hover:bg-white rounded-lg transition-all cursor-pointer text-slate-500 hover:text-slate-800 border border-transparent hover:border-slate-200"
                  title="Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {filterType === 'Día' && (
                  <input autoComplete="off"
                    type="date"
                    value={selectedDay.toISOString().split('T')[0]}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDay(new Date(e.target.value + 'T00:00:00'));
                      }
                    }}
                    className="ml-2 py-0.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                )}

                {filterType === 'Semana' && (
                  <input autoComplete="off"
                    type="date"
                    value={selectedWeekAnchor.toISOString().split('T')[0]}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedWeekAnchor(new Date(e.target.value + 'T00:00:00'));
                      }
                    }}
                    className="ml-2 py-0.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 shadow-xs">
                <span className="text-[10px] font-black uppercase text-slate-400">Desde</span>
                <input autoComplete="off"
                  type="date"
                  value={customRangeStart}
                  onChange={(e) => setCustomRangeStart(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-mono text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[10px] font-black uppercase text-slate-400">Hasta</span>
                <input autoComplete="off"
                  type="date"
                  value={customRangeEnd}
                  onChange={(e) => setCustomRangeEnd(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-mono text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Menudo Button */}
            <button
              onClick={() => onOpenMenudo?.()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl font-bold text-amber-700 transition-colors cursor-pointer shadow-xs"
              title="Módulo de Menudo"
            >
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-black uppercase tracking-wider">Menudo</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace Layout with Vertical Navigation Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative">
        
        {/* Mobile Sub-Views Navigation Trigger Bar (visible only on mobile) */}
        <div className="md:hidden bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
              {tabs.find(t => t.id === activeTab)?.icon}
            </span>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Sub-vista Activa</span>
              <span className="text-xs font-bold text-slate-900 truncate block">{tabs.find(t => t.id === activeTab)?.label}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 ml-2"
          >
            <Menu className="w-4 h-4" />
            <span>Sub-vistas</span>
          </button>
        </div>

        {/* Sidebar Navigation (Desktop) */}
        <aside
          className={`hidden md:flex ${
            isPanelCollapsed ? 'w-16 p-2' : 'w-64 p-3'
          } shrink-0 bg-white border-r border-slate-200 flex-col overflow-y-auto space-y-1 select-none transition-all duration-200`}
        >
          {/* Collapse / Expand Toggle Header */}
          <div
            className={`flex items-center pb-2 border-b border-slate-100 mb-1 ${
              isPanelCollapsed ? 'justify-center' : 'justify-between px-1'
            }`}
          >
            {!isPanelCollapsed && (
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Sub-vistas
              </span>
            )}
            <button
              type="button"
              onClick={togglePanelCollapsed}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title={isPanelCollapsed ? 'Expandir panel' : 'Colapsar panel'}
            >
              {isPanelCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-slate-600" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {tabs.map((tab, index) => {
            let shortcutLabel: string | null = null;
            if (index < 9) {
              shortcutLabel = `Alt+${index + 1}`;
            } else if (index === 9) {
              shortcutLabel = 'Alt+0';
            }

            const isSelected = activeTab === tab.id;
            const isFav = favoriteTabs.includes(tab.id);

            if (isPanelCollapsed) {
              return (
                <div key={tab.id} className="relative group flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    title={`${tab.label}${shortcutLabel ? ` (${shortcutLabel})` : ''}`}
                    className={`w-full py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center relative cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="shrink-0">{tab.icon}</span>

                    {/* Favorite star badge indicator */}
                    {isFav && (
                      <span className="absolute top-1 right-1">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                      </span>
                    )}

                    {/* Shortcut indicator in collapsed mode */}
                    {shortcutLabel && (
                      <span
                        className={`text-[9px] font-mono mt-0.5 font-semibold ${
                          isSelected ? 'text-indigo-200' : 'text-slate-400'
                        }`}
                      >
                        {shortcutLabel.replace('Alt+', 'A')}
                      </span>
                    )}
                  </button>

                  {/* Quick star toggle button on hover in collapsed mode */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteTab(tab.id);
                    }}
                    className={`absolute -top-1 -right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-md border border-slate-200 z-10 cursor-pointer ${
                      isFav ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'
                    }`}
                    title={isFav ? 'Quitar de favoritos' : 'Marcar como favorita'}
                  >
                    <Star className={`w-3 h-3 ${isFav ? 'fill-amber-400' : ''}`} />
                  </button>
                </div>
              );
            }

            return (
              <div key={tab.id} className="flex items-center group">
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Star button */}
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavoriteTab(tab.id);
                      }}
                      className={`p-0.5 rounded transition-colors shrink-0 ${
                        isFav
                          ? 'text-amber-400 hover:text-amber-300'
                          : isSelected
                          ? 'text-indigo-300 hover:text-white opacity-60 hover:opacity-100'
                          : 'text-slate-300 hover:text-amber-400 opacity-60 hover:opacity-100'
                      }`}
                      title={isFav ? 'Quitar de favoritos' : 'Marcar como favorita'}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : ''}`} />
                    </span>

                    <span className="shrink-0">{tab.icon}</span>
                    <span className="truncate">{tab.label}</span>
                  </div>

                  {shortcutLabel && (
                    <span
                      className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded font-medium ${
                        isSelected
                          ? 'bg-indigo-700/80 text-indigo-100'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {shortcutLabel}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </aside>

        {/* 3. Main Content Scroll Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 min-w-0">
          <React.Suspense
            fallback={
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 font-bold">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Cargando pestaña...</span>
              </div>
            }
          >
          {activeTab === 'resumen' && (
            <ResumenTab
              products={products}
              sales={sales}
              onCreateDraftOrders={(drafts) => {
                setDraftOrdersForCompras(drafts);
                setActiveTab('compras');
              }}
              totalSalesAmount={kpis.totalSalesAmount}
              totalTicketsCount={kpis.totalTicketsCount}
              marginPercent={kpis.marginPercent}
              salesVariationPercent={kpis.salesVariationPercent}
              totalOutstandingCredit={kpis.totalOutstandingCredit}
              cashLiquidityTotal={kpis.cashLiquidityTotal}
              bankLiquidityTotal={kpis.bankLiquidityTotal}
              onOpenLiquidityModal={() => setIsLiquidityModalOpen(true)}
              lowStockAlerts={kpis.lowStockAlerts}
              overlimitCustomerAlerts={kpis.overlimitCustomerAlerts}
              upcomingPayablesAlerts={kpis.upcomingPayablesAlerts}
              lowMarginAlerts={kpis.lowMarginAlerts}
              cardTerminalAlerts={kpis.cardTerminalAlerts}
              topProductsData={kpis.topProductsData}
              expiringSoonProducts={kpis.expiringSoonProducts}
              paymentMethodsData={kpis.paymentMethodsData}
              chartData={kpis.chartData}
              filterType={filterType}
              onNavigateToProduct={onNavigateToProduct}
              onNavigateToCustomer={onNavigateToCustomer}
              onNavigateToTab={(tab) => setActiveTab(tab as any)}
            />
          )}

          {activeTab === 'ventas' && (
            <VentasTab
              paymentMethodsData={kpis.paymentMethodsData}
              totalSalesAmount={kpis.totalSalesAmount}
              chartData={kpis.chartData}
              closuresWithSales={kpis.closuresWithSales}
              setSelectedClosureModal={setSelectedClosureModal}
            />
          )}

          {activeTab === 'creditos' && (
            <CreditosTab
              totalOutstandingCredit={kpis.totalOutstandingCredit}
              customers={customers}
              customerDebts={kpis.customerDebts}
              customerPayments={customerPayments}
              onNavigateToCustomer={onNavigateToCustomer}
            />
          )}

          {activeTab === 'inventario' && (
            <InventarioTab
              inventoryStats={kpis.inventoryStats}
              onNavigateToProduct={onNavigateToProduct}
            />
          )}

          {activeTab === 'empleados' && (
            <EmpleadosTab
              canManageEmployees={shiftManager.canManageEmployees}
              openShifts={shiftManager.openShifts}
              pendingClosures={shiftManager.pendingClosures}
              editingClosure={shiftManager.editingClosure}
              actualCashInput={shiftManager.actualCashInput}
              savingPendingClosure={shiftManager.savingPendingClosure}
              employeeStats={kpis.employeeStats}
              expandedEmployeeId={expandedEmployeeId}
              setExpandedEmployeeId={setExpandedEmployeeId}
              handleCloseShiftAdmin={shiftManager.handleCloseShiftAdmin}
              handleEditPendingClosure={shiftManager.handleEditPendingClosure}
              setEditingClosure={shiftManager.setEditingClosure}
              setActualCashInput={shiftManager.setActualCashInput}
              handleSavePendingClosure={shiftManager.handleSavePendingClosure}
              getEmployeeTrend={kpis.getEmployeeTrend}
            />
          )}

          {activeTab === 'compras' && (
            <ComprasTab
              products={products}
              sales={sales}
              purchaseOrders={purchaseOrders}
              purchaseReceipts={purchaseReceipts}
              payables={payables}
              payablePayments={payablePayments}
              movements={movements}
              supplierReturns={supplierReturns}
              suppliers={suppliers}
              currentEmployee={currentEmployee}
              clerkName={currentEmployee?.name || 'Administrador'}
              permissions={permissions}
              showAlert={(msg) => showAlert('Órdenes de Compra', msg)}
              initialDraftOrders={draftOrdersForCompras}
              onClearDrafts={() => setDraftOrdersForCompras([])}
            />
          )}

          {activeTab === 'cuentas_pagar' && (
            <PayablesTab
              products={products}
              payables={payables}
              payablePayments={payablePayments}
              currentEmployee={currentEmployee}
              dashboardConfig={dashboardConfig}
              supplierCreditNotes={supplierCreditNotes}
              purchaseOrders={purchaseOrders}
              purchaseReceipts={purchaseReceipts}
              movements={movements}
              supplierReturns={supplierReturns}
            />
          )}

          {activeTab === 'devoluciones' && (
            <DevolucionesTab
              products={products}
              supplierReturns={supplierReturns}
              currentEmployee={currentEmployee}
              supplierCreditNotes={supplierCreditNotes}
              payables={payables}
              purchaseOrders={purchaseOrders}
              purchaseReceipts={purchaseReceipts}
              payablePayments={payablePayments}
              movements={movements}
            />
          )}

          {activeTab === 'bancos' && (
            <BancosTab
              cardDeposits={cardDeposits}
              permissions={permissions}
              currentEmployee={currentEmployee}
              firestoreService={firestoreService}
              showAlert={(msg) => showAlert('Información', msg)}
            />
          )}

          {activeTab === 'notas_credito' && (
            <NotasCreditoTab
              creditNotes={creditNotes}
              permissions={permissions}
              creditNoteSearch={creditNoteSearch}
              setCreditNoteSearch={setCreditNoteSearch}
              creditNoteStatusFilter={creditNoteStatusFilter}
              setCreditNoteStatusFilter={setCreditNoteStatusFilter}
              setIsQueryCreditNoteOpen={setIsQueryCreditNoteOpen}
              setQueryCreditNoteCode={setQueryCreditNoteCode}
              setQueryCreditNoteResult={setQueryCreditNoteResult}
              setNoteToVoid={setNoteToVoid}
              setVoidReasonInput={setVoidReasonInput}
            />
          )}

          {activeTab === 'estado_resultados' && (
            <EstadoResultadosTab
              plReportData={kpis.plReportData}
              totalOutstandingCredit={kpis.totalOutstandingCredit}
              payables={payables}
              payablePayments={payablePayments}
              exportToExcel={kpis.exportToExcel}
            />
          )}

          {activeTab === 'anomalias' && (
            <AnomaliasTab
              employees={employees}
              sales={sales}
              customerRefunds={customerRefunds || []}
              closures={closures}
              permissions={permissions}
            />
          )}

          {activeTab === 'egresos' && (
            <EgresosTab
              movements={movements}
              currentEmployee={currentEmployee}
              clerkName={currentEmployee?.name || 'Administrador'}
              dashboardConfig={dashboardConfig}
              employees={employees}
              purchaseOrders={purchaseOrders}
              purchaseReceipts={purchaseReceipts}
              accountsPayable={payables}
              payablePayments={payablePayments}
              supplierReturns={supplierReturns}
            />
          )}

          {activeTab === 'actividad' && (
            <ActividadTab currentEmployee={currentEmployee} employees={employees} />
          )}
        </React.Suspense>
      </main>
      </div>

      {/* 4. Modals */}

      {/* Cash Liquidity Detail Modal */}
      {isLiquidityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-emerald-50">
              <div>
                <h3 className="text-lg font-black text-emerald-950 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>Detalle de Liquidez en Efectivo</span>
                </h3>
                <p className="text-xs text-emerald-700 font-medium">
                  Auditoría completa de entradas, salidas y reembolsos de efectivo cerrados
                </p>
              </div>
              <button
                onClick={() => setIsLiquidityModalOpen(false)}
                className="p-2 hover:bg-emerald-100 rounded-full text-emerald-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-emerald-600">Ventas en Efectivo</span>
                  <p className="text-xl font-black font-mono text-emerald-800">
                    RD$ {kpis.cashLiquidityDetail.totalEntries.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-rose-600">Gastos/Egresos</span>
                  <p className="text-xl font-black font-mono text-rose-800">
                    - RD$ {kpis.cashLiquidityDetail.totalExits.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-amber-600">Reembolsos</span>
                  <p className="text-xl font-black font-mono text-amber-800">
                    - RD$ {kpis.cashLiquidityDetail.totalRefunds.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-indigo-600">Liquidez Neta</span>
                  <p className="text-xl font-black font-mono text-indigo-900">
                    RD$ {kpis.cashLiquidityDetail.totalLiquidity.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsLiquidityModalOpen(false)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Note Query Modal */}
      {isQueryCreditNoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-600" />
                <span>Consultar Nota de Crédito</span>
              </h3>
              <button
                onClick={() => {
                  setIsQueryCreditNoteOpen(false);
                  setQueryCreditNoteCode('');
                  setQueryCreditNoteResult(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <input autoComplete="off"
                type="text"
                placeholder="Código de la nota (ej. NC-1001)..."
                value={queryCreditNoteCode}
                onChange={(e) => setQueryCreditNoteCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchCreditNoteCode()}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase"
              />
              <button
                onClick={handleSearchCreditNoteCode}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Buscar
              </button>
            </div>

            {queryCreditNoteResult === 'not_found' && (
              <p className="text-xs text-rose-600 font-bold text-center py-4">
                No se encontró ninguna nota de crédito con ese código.
              </p>
            )}

            {queryCreditNoteResult && queryCreditNoteResult !== 'not_found' && (
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2 text-xs font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-black text-[10px]">Código:</span>
                  <span className="font-mono font-bold text-slate-800">#{queryCreditNoteResult.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-black text-[10px]">Cliente:</span>
                  <span className="font-bold text-slate-800">{queryCreditNoteResult.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-black text-[10px]">Monto Inicial:</span>
                  <span className="font-mono font-bold text-slate-800">RD$ {queryCreditNoteResult.initialAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-black text-[10px]">Saldo Restante:</span>
                  <span className="font-mono font-bold text-emerald-600">RD$ {queryCreditNoteResult.remainingBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-black text-[10px]">Estado:</span>
                  <span className="font-bold uppercase text-slate-700">{queryCreditNoteResult.status}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Void Credit Note Modal */}
      {noteToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-sm font-black text-rose-600 flex items-center gap-2">
              <Ban className="w-4 h-4" />
              <span>Anular Nota de Crédito #{noteToVoid.code}</span>
            </h3>

            <p className="text-xs text-slate-600">
              ¿Estás seguro de que deseas anular esta nota de crédito? Esta acción no se puede deshacer.
            </p>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Motivo de Anulación</label>
              <textarea
                value={voidReasonInput}
                onChange={(e) => setVoidReasonInput(e.target.value)}
                placeholder="Ingresa la razón..."
                rows={3}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setNoteToVoid(null);
                  setVoidReasonInput('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleVoidCreditNote}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                Confirmar Anulación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sub-Views Selector Modal */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 max-h-[85vh] flex flex-col animate-scale-up">
            <div className="p-4 border-b border-slate-150 bg-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight">Seleccionar Sub-vista</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl bg-white border border-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-1.5 flex-1">
              {tabs.map((tab) => {
                const isSelected = activeTab === tab.id;
                const isFav = favoriteTabs.includes(tab.id);

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md font-black'
                        : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="shrink-0">{tab.icon}</span>
                      <span className="truncate">{tab.label}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isFav && <Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;
