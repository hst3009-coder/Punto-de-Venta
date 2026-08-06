import React, { useState, useRef } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Package, 
  AlertCircle, 
  Receipt, 
  ShoppingBag, 
  CreditCard,
  Percent,
  Coins,
  ArrowRight,
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

import { Product, Sale } from '../../types';
import { RestockSuggestionsPanel, DraftOrderGroup } from './RestockSuggestionsPanel';

interface ResumenTabProps {
  totalSalesAmount: number;
  totalTicketsCount: number;
  marginPercent: number;
  salesVariationPercent: number;
  totalOutstandingCredit: number;
  cashLiquidityTotal: number;
  bankLiquidityTotal: number;
  onOpenLiquidityModal: () => void;
  lowStockAlerts: Array<{ id: string; name: string; stock: number; minStock: number }>;
  overlimitCustomerAlerts: Array<{ id: string; name: string; debt: number; limit: number; exceeded: number }>;
  upcomingPayablesAlerts: Array<{ id: string; supplierName: string; concept: string; balance: number; dueDate: string; diffDays: number; isOverdue: boolean; isSoon: boolean }>;
  lowMarginAlerts: Array<{ id: string; name: string; category: string; actualMargin: number; targetMargin: number; diff: number; isBelow: boolean }>;
  cardTerminalAlerts?: Array<{ id: string; date: string; formattedDate: string; employeeName: string; systemAmount: number; reportedAmount: number }>;
  topProductsData: Array<{ id: string; name: string; qty: number; total: number }>;
  expiringSoonProducts: Array<{ id: string; name: string; expirationDate: string; daysLeft: number }>;
  paymentMethodsData: Array<{ name: string; value: number; color: string }>;
  chartData: Array<{ label: string; total: number }>;
  filterType: 'Día' | 'Semana' | 'Mes' | 'Rango';
  onNavigateToProduct: (id: string) => void;
  onNavigateToCustomer: (id: string) => void;
  onNavigateToTab?: (tab: string) => void;
  products?: Product[];
  sales?: Sale[];
  onCreateDraftOrders?: (drafts: DraftOrderGroup[]) => void;
}

export const ResumenTab: React.FC<ResumenTabProps> = ({
  totalSalesAmount = 0,
  totalTicketsCount = 0,
  marginPercent = 0,
  salesVariationPercent = 0,
  totalOutstandingCredit = 0,
  cashLiquidityTotal = 0,
  bankLiquidityTotal = 0,
  onOpenLiquidityModal,
  overlimitCustomerAlerts = [],
  upcomingPayablesAlerts = [],
  lowMarginAlerts = [],
  cardTerminalAlerts = [],
  topProductsData = [],
  expiringSoonProducts = [],
  paymentMethodsData = [],
  chartData = [],
  filterType = 'Día',
  onNavigateToProduct,
  onNavigateToCustomer,
  onNavigateToTab,
  products = [],
  sales = [],
  onCreateDraftOrders = () => {},
}) => {
  // Carousel 1 State (Charts & Top Sold: 3 slides)
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeChartIndex, setActiveChartIndex] = useState(0);

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const width = carouselRef.current.clientWidth;
    if (width > 0) {
      const newIndex = Math.round(carouselRef.current.scrollLeft / width);
      if (newIndex !== activeChartIndex && newIndex >= 0 && newIndex < 3) {
        setActiveChartIndex(newIndex);
      }
    }
  };

  const scrollToChart = (index: number) => {
    if (!carouselRef.current) return;
    const width = carouselRef.current.clientWidth;
    carouselRef.current.scrollTo({
      left: index * width,
      behavior: 'smooth',
    });
    setActiveChartIndex(index);
  };

  // Carousel 2 State (Reports & Alerts: 2 slides)
  const carousel2Ref = useRef<HTMLDivElement>(null);
  const [activeCarousel2Page, setActiveCarousel2Page] = useState(0);

  const handleScroll2 = () => {
    if (!carousel2Ref.current) return;
    const width = carousel2Ref.current.clientWidth;
    if (width > 0) {
      const newPage = Math.round(carousel2Ref.current.scrollLeft / width);
      if (newPage !== activeCarousel2Page && newPage >= 0 && newPage < 2) {
        setActiveCarousel2Page(newPage);
      }
    }
  };

  const scrollToCarousel2Page = (pageIndex: number) => {
    if (!carousel2Ref.current) return;
    const width = carousel2Ref.current.clientWidth;
    carousel2Ref.current.scrollTo({
      left: pageIndex * width,
      behavior: 'smooth',
    });
    setActiveCarousel2Page(pageIndex);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* 1. TOP KPI METRICS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Ventas Cerradas */}
        <div className="col-span-2 sm:col-span-1 bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ventas Cerradas</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[clamp(1rem,5vw,1.5rem)] sm:text-2xl font-black font-mono text-slate-800 truncate">
              RD$ {Number(totalSalesAmount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-bold uppercase">{totalTicketsCount || 0} tickets</span>
            <div className={`flex items-center gap-0.5 font-bold font-mono ${
              (salesVariationPercent || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {(salesVariationPercent || 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{(salesVariationPercent || 0) >= 0 ? '+' : ''}{Number(salesVariationPercent || 0).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Cuentas por Cobrar */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cuentas por Cobrar</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[clamp(1rem,5vw,1.5rem)] sm:text-2xl font-black font-mono text-amber-600 truncate">
              RD$ {Number(totalOutstandingCredit || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 font-semibold truncate">
            Saldo acumulado pendiente
          </div>
        </div>

        {/* KPI 3: Liquidez en Efectivo (Clickable) */}
        <div 
          onClick={onOpenLiquidityModal}
          className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs flex flex-col justify-between cursor-pointer hover:border-indigo-300 transition-all group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">
                Liquidez en Efectivo
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-100 transition-colors">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[clamp(1rem,5vw,1.5rem)] sm:text-2xl font-black font-mono text-indigo-600 truncate">
              RD$ {Number(cashLiquidityTotal || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-indigo-600 font-bold flex items-center justify-between">
            <span>Ver detalle completo</span>
            <span>→</span>
          </div>
        </div>

        {/* KPI 4: Liquidez Bancos */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Liquidez Bancos</span>
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[clamp(1rem,5vw,1.5rem)] sm:text-2xl font-black font-mono text-sky-600 truncate">
              RD$ {Number(bankLiquidityTotal || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 font-semibold truncate">
            Tarjetas conciliadas y transf.
          </div>
        </div>

        {/* KPI 5: Margen Promedio */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Margen Prom. Est.</span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[clamp(1rem,5vw,1.5rem)] sm:text-2xl font-black font-mono text-purple-600 truncate">
              {Number(marginPercent || 0).toFixed(1)}%
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 font-semibold truncate">
            Excluye categoría Genérico
          </div>
        </div>

      </div>

      {/* 2. CARRUSEL 1: Gráficos + Top Vendidos (3 slides full width) */}
      <div className="space-y-3">
        {/* Controls Bar */}
        <div className="flex items-center justify-between px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
              {activeChartIndex === 0
                ? 'Tendencia de Ventas'
                : activeChartIndex === 1
                ? 'Distribución por Métodos de Pago'
                : 'Top 5 Productos Más Vendidos'}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">
              ({activeChartIndex + 1} de 3)
            </span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/60 overflow-x-auto">
            <button
              type="button"
              onClick={() => scrollToChart(0)}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all cursor-pointer whitespace-nowrap ${
                activeChartIndex === 0 ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Ventas
            </button>
            <button
              type="button"
              onClick={() => scrollToChart(1)}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all cursor-pointer whitespace-nowrap ${
                activeChartIndex === 1 ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Métodos de Pago
            </button>
            <button
              type="button"
              onClick={() => scrollToChart(2)}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all cursor-pointer whitespace-nowrap ${
                activeChartIndex === 2 ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Top Vendidos
            </button>
          </div>
        </div>

        {/* Scroll Snap Carousel Container 1 */}
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-2 scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Slide 1: Main Chart (Sales trend) */}
          <div className="w-full shrink-0 snap-start bg-white border border-slate-200/80 p-6 rounded-3xl shadow-2xs">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Tendencia de Ventas</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Ventas cerradas en el período ({filterType})</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                    formatter={(value: number | string) => [`RD$ ${Number(value).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`, 'Ventas']}
                  />
                  <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Slide 2: Pie Chart (Payment methods distribution) */}
          <div className="w-full shrink-0 snap-start bg-white border border-slate-200/80 p-6 rounded-3xl shadow-2xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-1">Métodos de Pago</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">Distribución de ingresos</p>
              <div className="h-48 flex items-center justify-center">
                {paymentMethodsData.length === 0 ? (
                  <span className="text-xs text-slate-400 font-medium">Sin ventas en el período</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {paymentMethodsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                        formatter={(value: number | string) => [`RD$ ${Number(value).toLocaleString('es-DO', { minimumFractionDigits: 2 })}`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="space-y-1.5 pt-3 border-t border-slate-100">
              {paymentMethodsData.map(pm => (
                <div key={pm.name} className="flex justify-between items-center text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pm.color }} />
                    <span className="text-slate-700">{pm.name}</span>
                  </div>
                  <span className="font-mono text-slate-800">RD$ {pm.value.toLocaleString('es-DO', { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Slide 3: Top 5 Productos Más Vendidos */}
          <div className="w-full shrink-0 snap-start bg-white border border-slate-200/80 p-6 rounded-3xl shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Top 5 Productos Más Vendidos</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Productos con mayor volumen de venta ({filterType})</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('ventas')}
                  className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver todas las ventas</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {topProductsData.length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-xs text-slate-400 italic">Sin datos en el período</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {topProductsData.slice(0, 5).map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50/60 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span 
                            onClick={() => onNavigateToProduct(p.id)}
                            className="text-xs font-bold text-slate-800 block truncate hover:text-indigo-600 hover:underline cursor-pointer"
                          >
                            {p.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">{p.qty} unidades vendidas</span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-black text-slate-800 shrink-0 ml-2">
                        RD$ {p.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Carousel 1 Indicator Dots (3 dots) */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToChart(idx)}
              aria-label={`Ver slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                activeChartIndex === idx ? 'w-6 bg-indigo-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 3. CARRUSEL 2: Reabastecer solo (1 panel) + 4 alertas operacionales en cuadrícula 2x2 (2 slides totales) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
              {activeCarousel2Page === 0
                ? 'Qué Reabastecer (Stock Bajo y Sugerencias)'
                : 'Alertas Operativas (Créditos, Cuentas x Pagar, Terminal y Margen)'}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">
              ({activeCarousel2Page + 1} de 2)
            </span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/60 overflow-x-auto">
            <button
              type="button"
              onClick={() => scrollToCarousel2Page(0)}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all cursor-pointer whitespace-nowrap ${
                activeCarousel2Page === 0 ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Reabastecer
            </button>
            <button
              type="button"
              onClick={() => scrollToCarousel2Page(1)}
              className={`px-3 py-1 text-[10px] font-black rounded-full transition-all cursor-pointer whitespace-nowrap ${
                activeCarousel2Page === 1 ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Alertas Operativas
            </button>
          </div>
        </div>

        {/* Scroll Snap Carousel Container 2 */}
        <div
          ref={carousel2Ref}
          onScroll={handleScroll2}
          className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-2 scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Slide 1: Qué Reabastecer (Stock Bajo + Sugerencias) - SOLO w-full */}
          <div className="w-full shrink-0 snap-start flex flex-col justify-between">
            <RestockSuggestionsPanel
              products={products}
              sales={sales}
              onCreateDraftOrders={onCreateDraftOrders}
              onNavigateToProduct={onNavigateToProduct}
            />
          </div>

          {/* Slide 2: Combined 4 Alert Cards Slide in a 2x2 Grid (1 col on mobile, 2 cols on md+) */}
          <div className="w-full shrink-0 snap-start grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
            {/* Alert Card 1: Clientes con Crédito Excedido */}
            <div className="bg-white border border-slate-200/80 p-5 sm:p-6 rounded-3xl shadow-2xs flex flex-col h-fit space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-rose-500 shrink-0" />
                    <h4 className="text-xs font-black uppercase text-slate-800">Clientes Límite Excedido ({overlimitCustomerAlerts.length})</h4>
                  </div>
                </div>
                {overlimitCustomerAlerts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-1.5">Ningún cliente excede su límite de crédito</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {overlimitCustomerAlerts.map(item => (
                      <div key={item.id} className="p-3 bg-rose-50/50 border border-rose-100 rounded-2xl space-y-1 text-xs">
                        <div className="flex justify-between items-center font-bold text-slate-800">
                          <span className="truncate max-w-[140px] hover:underline cursor-pointer hover:text-indigo-600" onClick={() => onNavigateToCustomer(item.id)}>
                            {item.name}
                          </span>
                          <span className="text-[10px] font-mono font-black text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded-md">
                            +RD$ {item.exceeded.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Deuda: RD$ {item.debt.toLocaleString()}</span>
                          <span>Límite: RD$ {item.limit.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('creditos')}
                className="w-full mt-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-indigo-600 font-bold text-xs rounded-xl border border-slate-200/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Ir a Créditos CxC</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Alert Card 2: Cuentas por Pagar Próximas a Vencer */}
            <div className="bg-white border border-slate-200/80 p-5 sm:p-6 rounded-3xl shadow-2xs flex flex-col h-fit space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-indigo-500 shrink-0" />
                    <h4 className="text-xs font-black uppercase text-slate-800">Cuentas por Pagar Próximas ({upcomingPayablesAlerts.length})</h4>
                  </div>
                </div>
                {upcomingPayablesAlerts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-1.5">No hay facturas vencidas o próximas a vencer</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {upcomingPayablesAlerts.map(item => (
                      <div key={item.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1 text-xs">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate">{item.supplierName}</span>
                            <span className="text-[9px] text-slate-400 truncate block">{item.concept || 'Factura de compra'}</span>
                          </div>
                          <span className="font-mono font-black text-xs text-slate-900 shrink-0">
                            RD$ {item.balance.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] pt-1">
                          <span className="text-slate-400 font-medium">Vence: {item.dueDate}</span>
                          <span className={`px-1.5 py-0.5 rounded font-mono font-black ${
                            item.isOverdue 
                              ? 'bg-rose-100 text-rose-700' 
                              : item.diffDays === 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            {item.isOverdue ? `Venció hace ${Math.abs(item.diffDays)}d` : item.diffDays === 0 ? 'Vence hoy' : `En ${item.diffDays}d`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('cuentas_pagar')}
                className="w-full mt-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-indigo-600 font-bold text-xs rounded-xl border border-slate-200/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Ir a Cuentas x Pagar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Alert Card 3: Discrepancias de Terminal de Tarjetas */}
            <div className="bg-white border border-slate-200/80 p-5 sm:p-6 rounded-3xl shadow-2xs flex flex-col h-fit space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-rose-500 shrink-0" />
                    <h4 className="text-xs font-black uppercase text-slate-800">Discrepancias Terminal ({cardTerminalAlerts.length})</h4>
                  </div>
                </div>
                {cardTerminalAlerts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-1.5">No hay discrepancias registradas</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {cardTerminalAlerts.map(item => {
                      const diff = item.systemAmount - item.reportedAmount;
                      return (
                        <div key={item.id} className="p-3 bg-rose-50/50 border border-rose-100 rounded-2xl space-y-1 text-xs">
                          <div className="flex justify-between items-center font-bold text-slate-800">
                            <span className="truncate max-w-[110px]">{item.employeeName}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{item.formattedDate}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 font-medium">Sistema vs Terminal:</span>
                            <span className="font-mono font-bold text-slate-700">RD$ {item.systemAmount.toLocaleString('es-DO', { maximumFractionDigits: 0 })} / {item.reportedAmount.toLocaleString('es-DO', { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-mono font-black text-rose-600 pt-0.5 border-t border-rose-100/60">
                            <span>Diferencia:</span>
                            <span>-RD$ {Math.abs(diff).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('bancos')}
                className="w-full mt-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-indigo-600 font-bold text-xs rounded-xl border border-slate-200/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Ir a Bancos / Tarjetas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Alert Card 4: Productos por Debajo del Margen Objetivo */}
            <div className="bg-white border border-slate-200/80 p-5 sm:p-6 rounded-3xl shadow-2xs flex flex-col h-fit space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-purple-500 shrink-0" />
                    <h4 className="text-xs font-black uppercase text-slate-800">Margen Bajo Meta ({lowMarginAlerts.length})</h4>
                  </div>
                </div>
                {lowMarginAlerts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-1.5">Todos los productos cumplen la meta de margen</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {lowMarginAlerts.map(item => (
                      <div key={item.id} className="p-3 bg-purple-50/40 border border-purple-100/80 rounded-2xl space-y-1 text-xs">
                        <div className="flex justify-between items-center font-bold text-slate-800">
                          <span className="truncate max-w-[130px] hover:underline cursor-pointer hover:text-indigo-600" onClick={() => onNavigateToProduct(item.id)}>
                            {item.name}
                          </span>
                          <span className="font-mono font-black text-[10px] text-purple-700 bg-purple-100/80 px-1.5 py-0.5 rounded-md">
                            {item.actualMargin.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Cat: {item.category || 'General'}</span>
                          <span>Meta: {item.targetMargin}% (-{Math.abs(item.diff).toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab?.('inventario')}
                className="w-full mt-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-indigo-600 font-bold text-xs rounded-xl border border-slate-200/80 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Ir a Inventario</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel 2 Indicator Dots (2 dots) */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {[0, 1].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToCarousel2Page(idx)}
              aria-label={`Ver diapositiva ${idx + 1}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                activeCarousel2Page === idx ? 'w-6 bg-indigo-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      </div>

    </div>
  );
};

export default ResumenTab;
