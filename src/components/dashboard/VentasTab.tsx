import React from 'react';
import { AlertCircle, Receipt } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Closure, Sale } from '../../types';
import { formatSpanishDate } from '../../lib/dashboardCalculations';

interface VentasTabProps {
  paymentMethodsData: Array<{ name: string; value: number; color: string }>;
  totalSalesAmount: number;
  chartData: Array<{ label: string; total: number }>;
  closuresWithSales: Array<Closure & { sales: Sale[]; salesCount: number; actualTotal: number }>;
  setSelectedClosureModal: (closure: Closure) => void;
}

interface ClosureRowProps {
  closure: Closure & { sales: Sale[]; salesCount: number; actualTotal: number };
  setSelectedClosureModal: (closure: Closure) => void;
}

const ClosureRow: React.FC<ClosureRowProps> = React.memo(({ closure, setSelectedClosureModal }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-indigo-200 hover:shadow-md">
      <button 
        onClick={() => setSelectedClosureModal(closure)}
        className="w-full p-4 flex flex-wrap items-center justify-between gap-4 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-black text-slate-800 block">
              {formatSpanishDate(new Date(closure.createdAt || closure.date))}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Cajero: {closure.clerkName}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase block">Ventas Total</span>
            <span className="text-sm font-black font-mono text-slate-800">RD$ {closure.actualTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase block">Diferencia</span>
            <span className={`text-sm font-black font-mono ${closure.difference < 0 ? 'text-rose-600' : closure.difference > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
              RD$ {closure.difference.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-xs transition-colors">
            Ver Detalle
          </div>
        </div>
      </button>
    </div>
  );
});

export const VentasTab: React.FC<VentasTabProps> = ({
  paymentMethodsData,
  totalSalesAmount,
  chartData,
  closuresWithSales,
  setSelectedClosureModal,
}) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {paymentMethodsData.map(method => (
          <div key={method.name} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: method.color }} />
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{method.name}</span>
            </div>
            <span className="text-sm font-black font-mono text-slate-800">
              RD$ {method.value.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        <div className="bg-indigo-600 p-4 rounded-2xl shadow-md text-white flex flex-col justify-center">
          <span className="text-[10px] font-black uppercase opacity-80 tracking-wider">Total del Período</span>
          <span className="text-lg font-black font-mono">
            RD$ {totalSalesAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
        <div className="mb-6">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Tendencia de Ventas Diaria</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase">Ingresos brutos por fecha</p>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis fontSize={10} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                formatter={(v: number | string) => [`RD$ ${Number(v).toLocaleString()}`, 'Ventas']}
              />
              <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Closures List */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">Cortes de Caja (Cierres de Turno)</h3>
        {closuresWithSales.length === 0 ? (
          <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl text-slate-400">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-xs font-bold uppercase tracking-wider">No se encontraron cortes de caja en este período</p>
          </div>
        ) : (
          <div className="space-y-3">
            {closuresWithSales.map(closure => (
              <ClosureRow key={closure.id} closure={closure} setSelectedClosureModal={setSelectedClosureModal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VentasTab;
