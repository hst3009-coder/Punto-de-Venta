import React, { useMemo, useState } from 'react';
import { Employee, Sale, CustomerRefund, Closure, EmployeePermissions } from '../../types';
import {
  detectHighReturnRate,
  detectRepeatedCashDiscrepancies,
  detectCreditSalesSpike,
  HighReturnRateAnomaly,
  CashDiscrepancyAnomaly,
  CreditSpikeAnomaly,
} from '../../lib/anomalyDetection';
import {
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Landmark,
  TrendingUp,
  Info,
  CheckCircle2,
  Users,
  Search,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatCurrency } from '../../lib/money';

interface AnomaliasTabProps {
  employees: Employee[];
  sales: Sale[];
  customerRefunds: CustomerRefund[];
  closures: Closure[];
  permissions: EmployeePermissions;
}

export const AnomaliasTab: React.FC<AnomaliasTabProps> = ({
  employees,
  sales,
  customerRefunds,
  closures,
  permissions,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Permission Gate
  if (!permissions.manageEmployees) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-2xs text-center max-w-lg mx-auto my-12 space-y-4">
        <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl w-fit mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-800">Acceso Restringido</h3>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Solo los usuarios con permisos de gestión de empleados pueden revisar el panel de detección de anomalías operativas.
        </p>
      </div>
    );
  }

  // Calculate anomalies
  const highReturnAnomalies = useMemo(() => {
    return detectHighReturnRate(employees, sales, customerRefunds, closures, 30);
  }, [employees, sales, customerRefunds, closures]);

  const cashDiscrepancyAnomalies = useMemo(() => {
    return detectRepeatedCashDiscrepancies(employees, closures, 3);
  }, [employees, closures]);

  const creditSpikeAnomalies = useMemo(() => {
    return detectCreditSalesSpike(employees, sales, 30);
  }, [employees, sales]);

  // Total anomaly count
  const totalAnomaliesCount =
    highReturnAnomalies.length + cashDiscrepancyAnomalies.length + creditSpikeAnomalies.length;

  // Filter by search term
  const filterBySearch = (empName: string) => {
    if (!searchTerm.trim()) return true;
    return empName.toLowerCase().includes(searchTerm.toLowerCase());
  };

  const filteredReturnAnomalies = highReturnAnomalies.filter((a) => filterBySearch(a.employeeName));
  const filteredCashAnomalies = cashDiscrepancyAnomalies.filter((a) => filterBySearch(a.employeeName));
  const filteredCreditAnomalies = creditSpikeAnomalies.filter((a) => filterBySearch(a.employeeName));

  return (
    <div className="space-y-6">
      {/* Disclaimer Notice Banner */}
      <div className="p-5 bg-gradient-to-r from-amber-50 via-amber-50/80 to-orange-50 border border-amber-200/90 rounded-3xl shadow-2xs space-y-2">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-black text-amber-900 uppercase tracking-tight">
              Aviso de uso supervisado e informativo
            </h3>
            <p className="text-xs text-amber-800 font-semibold leading-relaxed">
              Esta información es un indicador estadístico para tu revisión, no una conclusión — patrones inusuales pueden tener explicaciones legítimas.
            </p>
          </div>
        </div>
      </div>

      {/* Header & Quick Stats */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Anomalías Operativas
                </h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Análisis aritmético continuo de patrones de venta, reembolsos y cortes de caja
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input autoComplete="off"
                type="text"
                placeholder="Buscar empleado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48 transition-all"
              />
            </div>

            <div className="px-3.5 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl font-mono">
              {totalAnomaliesCount} {totalAnomaliesCount === 1 ? 'indicador' : 'indicadores'}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Categories Grid */}
      <div className="space-y-6">
        {/* Category 1: High Return / Cancelled Rate */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                  Tasa Alta de Devoluciones y Anulaciones (Últimos 30 días)
                </h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Empleados con una tasa superior al doble (&gt;2x) del promedio del equipo (&ge;10 ventas)
                </p>
              </div>
            </div>

            <span className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full font-mono">
              {filteredReturnAnomalies.length}
            </span>
          </div>

          {filteredReturnAnomalies.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-500 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>No se detectaron desviaciones significativas en la tasa de devoluciones ni anulaciones.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReturnAnomalies.map((anomaly) => (
                <div
                  key={anomaly.employeeId}
                  className="p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 space-y-3 relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{anomaly.employeeName}</h4>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md inline-block mt-1">
                        Tasa: {(anomaly.returnRate * 100).toFixed(1)}% (vs. Promedio: {(anomaly.overallAvgRate * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-rose-100">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Ventas Totales</span>
                      <span className="font-mono font-bold text-slate-800">{anomaly.totalSales}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Reembolsos/Anulaciones</span>
                      <span className="font-mono font-bold text-rose-700">
                        {anomaly.returnRefundCount + anomaly.cancelledCount}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 italic bg-white/80 p-2 rounded-xl border border-rose-100/60 leading-normal">
                    💡 Nota: Revisa los motivos de anulación registrados en el historial de ventas para verificar si corresponden a correcciones legítimas de caja.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category 2: Repeated Cash Discrepancies */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                  Discrepancias Repetidas de Caja (Últimos 10 Cortes)
                </h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Empleados con 3 o más cortes recientes con faltantes o sobrantes persistentes
                </p>
              </div>
            </div>

            <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full font-mono">
              {filteredCashAnomalies.length}
            </span>
          </div>

          {filteredCashAnomalies.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-500 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>No se detectaron patrones repetidos de discrepancia en los cortes de caja.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCashAnomalies.map((anomaly) => {
                const isShortage = anomaly.direction === 'faltante';
                return (
                  <div
                    key={anomaly.employeeId}
                    className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20 space-y-3 relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{anomaly.employeeName}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block mt-1 ${
                            isShortage ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Patrón de {anomaly.direction.toUpperCase()} ({anomaly.occurrences} de {anomaly.totalClosuresAnalyzed} cortes)
                        </span>
                      </div>
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    </div>

                    <div className="pt-2 border-t border-amber-100 text-[11px] flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Discrepancia Promedio:
                      </span>
                      <span className="font-mono font-black text-slate-900">
                        {isShortage ? '-' : '+'}{formatCurrency(anomaly.avgDiscrepancy)}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-500 italic bg-white/80 p-2 rounded-xl border border-amber-100/60 leading-normal">
                      💡 Nota: Revisa el conteo físico inicial de efectivo y si el empleado realiza retiros/menudo con frecuencia sin registrar.
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category 3: Credit Sales Spike */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                  Pico de Ventas a Crédito (Últimos 30 días vs. Histórico 90 días)
                </h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Monto vendido a crédito reciente superior a 3 veces (&gt;3x) su propio promedio histórico
                </p>
              </div>
            </div>

            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full font-mono">
              {filteredCreditAnomalies.length}
            </span>
          </div>

          {filteredCreditAnomalies.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-500 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>No se detectaron incrementos anómalos en ventas a crédito por empleado.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCreditAnomalies.map((anomaly) => (
                <div
                  key={anomaly.employeeId}
                  className="p-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/20 space-y-3 relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-900">{anomaly.employeeName}</h4>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md inline-block mt-1">
                        Incremento de {anomaly.ratio.toFixed(1)}x respecto a su histórico
                      </span>
                    </div>
                    <AlertTriangle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-indigo-100">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Crédito Reciente (30d)</span>
                      <span className="font-mono font-bold text-indigo-900">
                        {formatCurrency(anomaly.recentCreditTotal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Promedio Histórico</span>
                      <span className="font-mono font-bold text-slate-600">
                        {formatCurrency(anomaly.historicalAvg30d)}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 italic bg-white/80 p-2 rounded-xl border border-indigo-100/60 leading-normal">
                    💡 Nota: Confirma si el empleado atendió a un cliente corporativo o mayoreo en días recientes que justifique el aumento.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
