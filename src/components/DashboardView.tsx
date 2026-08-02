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
} from 'lucide-react';
import { useAlert } from '../context/AlertContext';
import { usePermissions } from '../hooks/usePermissions';
import { firestoreService } from '../lib/firebase';
import { useCardDepositGenerator } from '../hooks/useCardDepositGenerator';
import { useDashboardDateFilter } from '../hooks/useDashboardDateFilter';
import { useAdminShiftManager } from '../hooks/useAdminShiftManager';
import { useDashboardKPIs } from '../hooks/useDashboardKPIs';

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
}) => {
  const { showAlert, showConfirm } = useAlert();
  const permissions = usePermissions(currentEmployee);

  const [activeTab, setActiveTab] = useState<DashboardTab>('resumen');
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

  const tabs: Array<{ id: DashboardTab; label: string; icon: React.ReactNode; badge?: number }> = [
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
                  <input
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
                  <input
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
                <input
                  type="date"
                  value={customRangeStart}
                  onChange={(e) => setCustomRangeStart(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-mono text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[10px] font-black uppercase text-slate-400">Hasta</span>
                <input
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

      {/* 2. Secondary Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 shrink-0 px-6 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-xs font-black'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* 3. Main Content Scroll Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
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
              purchaseOrders={purchaseOrders}
              purchaseReceipts={purchaseReceipts}
              payables={payables}
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
            />
          )}

          {activeTab === 'devoluciones' && (
            <DevolucionesTab
              products={products}
              supplierReturns={supplierReturns}
              currentEmployee={currentEmployee}
              supplierCreditNotes={supplierCreditNotes}
              payables={payables}
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
            />
          )}

          {activeTab === 'actividad' && (
            <ActividadTab currentEmployee={currentEmployee} employees={employees} />
          )}
        </React.Suspense>
      </main>

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
              <input
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
    </div>
  );
};

export default DashboardView;
