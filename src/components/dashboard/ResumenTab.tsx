import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Package, 
  AlertCircle, 
  DollarSign, 
  Receipt, 
  ShoppingBag, 
  CreditCard,
  Percent,
  Calendar,
  AlertTriangle,
  Coins,
  ChevronDown,
  ChevronUp,
  Info
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
  lowStockAlerts = [],
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
  onNavigateToCustomer
}) => {
  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [showAllOverlimit, setShowAllOverlimit] = useState(false);
  const [showAllPayablesAlerts, setShowAllPayablesAlerts] = useState(false);
  const [showAllLowMargin, setShowAllLowMargin] = useState(false);
  const [showAllCardTerminal, setShowAllCardTerminal] = useState(false);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* 1. TOP KPI METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Ventas Cerradas */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ventas Cerradas</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-slate-800">
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
            <div className="text-2xl font-black font-mono text-amber-600">
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
            <div className="text-2xl font-black font-mono text-indigo-600">
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
            <div className="text-2xl font-black font-mono text-sky-600">
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
            <div className="text-2xl font-black font-mono text-purple-600">
              {Number(marginPercent || 0).toFixed(1)}%
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 font-semibold truncate">
            Excluye categoría Genérico
          </div>
        </div>

      </div>

      {/* 2. MAIN CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Chart (Sales trend) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-2xs">
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

        {/* Pie Chart (Payment methods distribution) */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-2xs flex flex-col justify-between">
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

      </div>

      {/* 3. ALERTS & INSIGHTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        
        {/* Alert 1: Low Stock */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-black uppercase text-slate-800">Stock Bajo ({lowStockAlerts.length})</h4>
            </div>
          </div>
          {lowStockAlerts.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No hay productos en stock bajo</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(showAllLowStock ? lowStockAlerts : lowStockAlerts.slice(0, 3)).map(item => (
                <div key={item.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 truncate max-w-[120px]">{item.name}</span>
                  <button 
                    onClick={() => onNavigateToProduct(item.id)}
                    className="text-amber-600 font-mono font-black text-[10px] hover:underline cursor-pointer"
                  >
                    {item.stock} / Mín {item.minStock}
                  </button>
                </div>
              ))}
              {lowStockAlerts.length > 3 && (
                <button
                  onClick={() => setShowAllLowStock(!showAllLowStock)}
                  className="text-[10px] font-black text-indigo-600 uppercase hover:underline cursor-pointer"
                >
                  {showAllLowStock ? 'Ver menos' : `Ver todos (${lowStockAlerts.length})`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Alert 2: Overlimit Customers */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-rose-500" />
              <h4 className="text-xs font-black uppercase text-slate-800">Límite Excedido ({overlimitCustomerAlerts.length})</h4>
            </div>
          </div>
          {overlimitCustomerAlerts.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Ningún cliente excede su límite</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(showAllOverlimit ? overlimitCustomerAlerts : overlimitCustomerAlerts.slice(0, 3)).map(item => (
                <div key={item.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 truncate max-w-[120px]">{item.name}</span>
                  <button 
                    onClick={() => onNavigateToCustomer(item.id)}
                    className="text-rose-600 font-mono font-black text-[10px] hover:underline cursor-pointer"
                  >
                    +RD$ {item.exceeded.toLocaleString()}
                  </button>
                </div>
              ))}
              {overlimitCustomerAlerts.length > 3 && (
                <button
                  onClick={() => setShowAllOverlimit(!showAllOverlimit)}
                  className="text-[10px] font-black text-indigo-600 uppercase hover:underline cursor-pointer"
                >
                  {showAllOverlimit ? 'Ver menos' : `Ver todos (${overlimitCustomerAlerts.length})`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Alert 3: Card Terminal Discrepancies */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-rose-500" />
              <h4 className="text-xs font-black uppercase text-slate-800">Discrepancias Terminal ({cardTerminalAlerts.length})</h4>
            </div>
          </div>
          {cardTerminalAlerts.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No hay discrepancias registradas</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(showAllCardTerminal ? cardTerminalAlerts : cardTerminalAlerts.slice(0, 3)).map(item => (
                <div key={item.id} className="p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-center font-bold text-slate-800">
                    <span className="truncate max-w-[110px]">{item.employeeName}</span>
                    <span className="text-[9px] text-slate-400 font-mono">{item.formattedDate}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-medium">Sistema:</span>
                    <span className="font-mono font-bold text-slate-700">RD$ {item.systemAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-medium">Terminal:</span>
                    <span className="font-mono font-black text-rose-600">RD$ {item.reportedAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}
              {cardTerminalAlerts.length > 3 && (
                <button
                  onClick={() => setShowAllCardTerminal(!showAllCardTerminal)}
                  className="text-[10px] font-black text-indigo-600 uppercase hover:underline cursor-pointer"
                >
                  {showAllCardTerminal ? 'Ver menos' : `Ver todos (${cardTerminalAlerts.length})`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Alert 4: Upcoming Payables */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-black uppercase text-slate-800">Facturas x Pagar ({upcomingPayablesAlerts.length})</h4>
            </div>
          </div>
          {upcomingPayablesAlerts.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No hay facturas vencidas o próximas</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(showAllPayablesAlerts ? upcomingPayablesAlerts : upcomingPayablesAlerts.slice(0, 3)).map(item => (
                <div key={item.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                  <div className="truncate max-w-[120px]">
                    <span className="font-bold text-slate-800 block truncate">{item.supplierName}</span>
                    <span className="text-[9px] text-slate-400 truncate block">{item.concept}</span>
                  </div>
                  <span className={`font-mono font-black text-[10px] ${item.isOverdue ? 'text-rose-600' : 'text-amber-600'}`}>
                    RD$ {item.balance.toLocaleString()}
                  </span>
                </div>
              ))}
              {upcomingPayablesAlerts.length > 3 && (
                <button
                  onClick={() => setShowAllPayablesAlerts(!showAllPayablesAlerts)}
                  className="text-[10px] font-black text-indigo-600 uppercase hover:underline cursor-pointer"
                >
                  {showAllPayablesAlerts ? 'Ver menos' : `Ver todos (${upcomingPayablesAlerts.length})`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Alert 5: Low Margin Products */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-purple-500" />
              <h4 className="text-xs font-black uppercase text-slate-800">Margen Bajo Meta ({lowMarginAlerts.length})</h4>
            </div>
          </div>
          {lowMarginAlerts.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Todos los productos cumplen meta de margen</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(showAllLowMargin ? lowMarginAlerts : lowMarginAlerts.slice(0, 3)).map(item => (
                <div key={item.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 truncate max-w-[120px]">{item.name}</span>
                  <button 
                    onClick={() => onNavigateToProduct(item.id)}
                    className="text-purple-600 font-mono font-black text-[10px] hover:underline cursor-pointer"
                  >
                    {item.actualMargin.toFixed(0)}% (Meta: {item.targetMargin}%)
                  </button>
                </div>
              ))}
              {lowMarginAlerts.length > 3 && (
                <button
                  onClick={() => setShowAllLowMargin(!showAllLowMargin)}
                  className="text-[10px] font-black text-indigo-600 uppercase hover:underline cursor-pointer"
                >
                  {showAllLowMargin ? 'Ver menos' : `Ver todos (${lowMarginAlerts.length})`}
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 4. TOP PRODUCTS & EXPIRING PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Products */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-2xs space-y-4">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Top 5 Productos Más Vendidos</h3>
          {topProductsData.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sin datos en el período</p>
          ) : (
            <div className="space-y-3">
              {topProductsData.slice(0, 5).map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50/60 border border-slate-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{p.qty} unidades vendidas</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black text-slate-800">
                    RD$ {p.total.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiring Soon Products */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-2xs space-y-4">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Próximos a Vencer (7 días)</h3>
          {expiringSoonProducts.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No hay productos próximos a vencer en los siguientes 7 días</p>
          ) : (
            <div className="space-y-3">
              {expiringSoonProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50/60 border border-slate-100 rounded-2xl">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Vence: {p.expirationDate}</span>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-black uppercase">
                    {p.daysLeft === 0 ? 'Vence hoy' : `En ${p.daysLeft} d.`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default ResumenTab;
