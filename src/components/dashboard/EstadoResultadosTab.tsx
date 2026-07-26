import React from 'react';
import { FileBarChart, Info } from 'lucide-react';
import { AccountPayable, PayablePayment } from '../../types';
import { getTotalPayablesBalance } from '../../lib/dashboardCalculations';

interface EstadoResultadosTabProps {
  plReportData: {
    totalSalesPreTax: number;
    totalCOGS: number;
    grossProfit: number;
    operationalExpenses: number;
    netOperatingProfit: number;
    personalExpenses: number;
  };
  totalOutstandingCredit: number;
  payables: AccountPayable[];
  payablePayments: PayablePayment[];
  exportToExcel: () => void;
}

export const EstadoResultadosTab: React.FC<EstadoResultadosTabProps> = ({
  plReportData,
  totalOutstandingCredit,
  payables,
  payablePayments,
  exportToExcel
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">Estado de Resultados (P&L)</h3>
            <p className="text-xs text-slate-400">Análisis detallado de ingresos, costos y utilidad operativa del período seleccionado</p>
          </div>
          <button
            onClick={exportToExcel}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
          >
            <FileBarChart className="w-4 h-4" />
            <span>Exportar a Excel</span>
          </button>
        </div>

        {/* Main Report Body */}
        <div className="mt-6 space-y-6">
          
          {/* Ingresos & Costos Section */}
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">Estructura Operativa</span>
            
            {/* Ingresos por Ventas */}
            <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Ingresos por Ventas</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Suma sin ITBIS. Incluye artículos Genéricos</span>
              </div>
              <span className="text-sm font-black font-mono text-slate-800">
                RD$ {plReportData.totalSalesPreTax.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Costo de Mercancía Vendida */}
            <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">(-) Costo de Mercancía Vendida (CMV)</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Excluye artículos de categoría 'Genérico'</span>
              </div>
              <span className="text-sm font-black font-mono text-slate-800">
                RD$ {plReportData.totalCOGS.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Utilidad Bruta */}
            <div className="flex justify-between items-center py-3.5 px-4 bg-indigo-50/30 rounded-xl border border-indigo-100/50">
              <span className="text-xs font-black text-indigo-900 uppercase tracking-wide">= Utilidad Bruta</span>
              <span className="text-base font-black font-mono text-indigo-950">
                RD$ {plReportData.grossProfit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Gastos & Utilidad Neta Section */}
          <div className="space-y-3">
            {/* Gastos Operativos */}
            <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50/50 rounded-xl border border-slate-100">
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">(-) Gastos Operativos</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Egresos operativos del período</span>
              </div>
              <span className="text-sm font-black font-mono text-slate-800">
                RD$ {plReportData.operationalExpenses.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Utilidad Neta Operativa */}
            <div className={`flex justify-between items-center py-4 px-4 rounded-2xl border ${
              plReportData.netOperatingProfit >= 0 
                ? 'bg-emerald-50/30 border-emerald-100/80' 
                : 'bg-rose-50/30 border-rose-100/80'
            }`}>
              <div className="flex flex-col">
                <span className={`text-sm font-black uppercase tracking-wide ${
                  plReportData.netOperatingProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'
                }`}>
                  = Utilidad Neta Operativa
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Resultado del ejercicio del negocio</span>
              </div>
              <span className={`text-lg font-black font-mono ${
                plReportData.netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                RD$ {plReportData.netOperatingProfit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Gastos Personales Box (Separated, grey, informative) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Gastos Personales del Período</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Suma de egresos no operativos</span>
              </div>
              <span className="text-sm font-black font-mono text-slate-600">
                RD$ {plReportData.personalExpenses.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-bold leading-normal border-t border-slate-200/60 pt-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>Nota: Estos egresos están marcados como no operativos y son de carácter personal del dueño. No afectan la Utilidad Neta Operativa del negocio mostrada arriba, sirviendo únicamente como dato informativo.</span>
            </div>
          </div>

          {/* Saldos Pendientes (Reference) */}
          <div className="border-t border-slate-200/80 pt-5 space-y-3">
            <div>
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">Saldos Pendientes (A la fecha de hoy)</span>
              <p className="text-[10px] text-slate-400 font-bold uppercase leading-normal">Referencia de posición financiera global, independiente del filtro de tiempo.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cuentas por Cobrar */}
              <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50/30 rounded-xl border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Cuentas por Cobrar Totales</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Deuda acumulada de clientes</span>
                </div>
                <span className="text-xs font-black font-mono text-amber-600">
                  RD$ {totalOutstandingCredit.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Cuentas por Pagar */}
              <div className="flex justify-between items-center py-2.5 px-4 bg-slate-50/30 rounded-xl border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wide">Cuentas por Pagar Totales</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Deuda pendiente con proveedores</span>
                </div>
                <span className="text-xs font-black font-mono text-rose-600">
                  RD$ {getTotalPayablesBalance(payables, payablePayments).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EstadoResultadosTab;
