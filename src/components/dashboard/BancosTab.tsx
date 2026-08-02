import React, { useState, useMemo } from 'react';
import { Landmark, Check, X, Clock, CheckCircle2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { CardDeposit, Employee, EmployeePermissions } from '../../types';
import { roundCents } from '../../lib/money';
import { firestoreService } from '../../lib/firebase';
import { useAlert } from '../../context/AlertContext';

interface BancosTabProps {
  cardDeposits: CardDeposit[];
  permissions: EmployeePermissions;
  currentEmployee: Employee | null;
  firestoreService: typeof firestoreService;
  showAlert: (msg: string) => void;
}

interface DepositGroup {
  expectedDepositDate: string;
  deposits: CardDeposit[];
  totalGrossAmount: number;
  totalNetAmount: number;
  totalConfirmedAmount: number;
  isSingle: boolean;
}

export const BancosTab: React.FC<BancosTabProps> = ({
  cardDeposits,
  permissions,
  currentEmployee,
  firestoreService,
  showAlert,
}) => {
  const { showConfirm } = useAlert();
  const [confirmingGroup, setConfirmingGroup] = useState<DepositGroup | null>(null);
  const [confirmedAmountInput, setConfirmedAmountInput] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [expandedPending, setExpandedPending] = useState<Record<string, boolean>>({});
  const [expandedConfirmed, setExpandedConfirmed] = useState<Record<string, boolean>>({});

  const togglePendingExpanded = (dateKey: string) => {
    setExpandedPending((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const toggleConfirmedExpanded = (dateKey: string) => {
    setExpandedConfirmed((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const handleDeleteDeposit = async (deposit: CardDeposit) => {
    const displayBatch = deposit.batchDate.split('-').reverse().join('/');
    const amountToDisplay = (deposit.confirmedAmount ?? deposit.netAmount).toLocaleString('es-DO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const confirmed = await showConfirm(
      'Eliminar Depósito',
      `¿Estás seguro de que deseas eliminar el depósito del lote ${displayBatch} por un monto de RD$ ${amountToDisplay}?`
    );

    if (confirmed) {
      try {
        await firestoreService.deleteDoc('cardDeposits', deposit.id);
        showAlert('Depósito eliminado correctamente.');
      } catch (err) {
        console.error('Error al eliminar el depósito bancario:', err);
        showAlert('Error al eliminar el depósito. Por favor reintenta.');
      }
    }
  };

  const pendingGroups = useMemo<DepositGroup[]>(() => {
    const map = new Map<string, CardDeposit[]>();
    cardDeposits
      .filter((d) => d.status === 'pending')
      .forEach((d) => {
        const list = map.get(d.expectedDepositDate) || [];
        list.push(d);
        map.set(d.expectedDepositDate, list);
      });

    const result: DepositGroup[] = [];
    map.forEach((deposits, expectedDepositDate) => {
      deposits.sort((a, b) => a.batchDate.localeCompare(b.batchDate));
      const totalGrossAmount = deposits.reduce((acc, d) => acc + d.grossAmount, 0);
      const totalNetAmount = deposits.reduce((acc, d) => acc + d.netAmount, 0);
      const totalConfirmedAmount = deposits.reduce((acc, d) => acc + (d.confirmedAmount ?? d.netAmount), 0);
      result.push({
        expectedDepositDate,
        deposits,
        totalGrossAmount,
        totalNetAmount,
        totalConfirmedAmount,
        isSingle: deposits.length === 1,
      });
    });

    result.sort((a, b) => a.expectedDepositDate.localeCompare(b.expectedDepositDate));
    return result;
  }, [cardDeposits]);

  const confirmedGroups = useMemo<DepositGroup[]>(() => {
    const map = new Map<string, CardDeposit[]>();
    cardDeposits
      .filter((d) => d.status === 'confirmed')
      .forEach((d) => {
        const list = map.get(d.expectedDepositDate) || [];
        list.push(d);
        map.set(d.expectedDepositDate, list);
      });

    const result: DepositGroup[] = [];
    map.forEach((deposits, expectedDepositDate) => {
      deposits.sort((a, b) => a.batchDate.localeCompare(b.batchDate));
      const totalGrossAmount = deposits.reduce((acc, d) => acc + d.grossAmount, 0);
      const totalNetAmount = deposits.reduce((acc, d) => acc + d.netAmount, 0);
      const totalConfirmedAmount = deposits.reduce((acc, d) => acc + (d.confirmedAmount ?? d.netAmount), 0);
      result.push({
        expectedDepositDate,
        deposits,
        totalGrossAmount,
        totalNetAmount,
        totalConfirmedAmount,
        isSingle: deposits.length === 1,
      });
    });

    result.sort((a, b) => {
      const latestA = Math.max(...a.deposits.map((d) => (d.confirmedAt ? new Date(d.confirmedAt).getTime() : 0)));
      const latestB = Math.max(...b.deposits.map((d) => (d.confirmedAt ? new Date(d.confirmedAt).getTime() : 0)));
      return latestB - latestA;
    });
    return result;
  }, [cardDeposits]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Summaries / KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Conciliado en Banco */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Monto Conciliado en Banco</span>
            <span className="text-xl font-black font-mono text-emerald-600">
              RD$ {cardDeposits
                .filter(d => d.status === 'confirmed')
                .reduce((acc, d) => acc + (d.confirmedAmount ?? d.netAmount), 0)
                .toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 font-semibold block">
              Total neto real depositado y verificado.
            </span>
          </div>
        </div>

        {/* Card 2: Pendiente de Tránsito */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Pendiente en Tránsito</span>
            <span className="text-xl font-black font-mono text-amber-500">
              RD$ {cardDeposits
                .filter(d => d.status === 'pending')
                .reduce((acc, d) => acc + d.netAmount, 0)
                .toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 font-semibold block">
              Ventas con tarjeta estimadas a ingresar el próximo día hábil.
            </span>
          </div>
        </div>

        {/* Card 3: Comisión Total Pagada */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Comisiones Acumuladas</span>
            <span className="text-xl font-black font-mono text-rose-500">
              RD$ {cardDeposits
                .reduce((acc, d) => acc + (d.grossAmount - d.netAmount), 0)
                .toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 font-semibold block">
              Tasa estándar de tarjetas descontada del bruto.
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: PENDIENTES POR CONFIRMAR */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Pendientes por Confirmar
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Control de acreditaciones bancarias agrupadas por fecha esperada de depósito</p>
          </div>
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full">
            {pendingGroups.length} {pendingGroups.length === 1 ? 'depósito pendiente' : 'depósitos pendientes'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase bg-slate-50/50">
                <th className="py-3 px-4">Fecha Esperada</th>
                <th className="py-3 px-4">Lote(s) de Venta</th>
                <th className="py-3 px-4 text-right">Monto Bruto</th>
                <th className="py-3 px-4 text-right">Comisión (%)</th>
                <th className="py-3 px-4 text-right">Monto Neto Est.</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendingGroups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-emerald-600 font-bold">
                    <div className="flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>No hay depósitos pendientes ✓</span>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingGroups.map((group) => {
                  const displayExpected = group.expectedDepositDate.split('-').reverse().join('/');
                  const batchLabel = group.isSingle
                    ? group.deposits[0].batchDate.split('-').reverse().join('/')
                    : `${group.deposits.length} lotes (${group.deposits[0].batchDate.split('-').reverse().join('/')} al ${group.deposits[group.deposits.length - 1].batchDate.split('-').reverse().join('/')})`;
                  const isExpanded = !!expandedPending[group.expectedDepositDate];

                  return (
                    <React.Fragment key={group.expectedDepositDate}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50/55 transition-colors text-xs font-semibold text-slate-700">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{displayExpected}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{batchLabel}</td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          RD$ {group.totalGrossAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-500 font-mono">
                          -{group.deposits[0].feePercent}%
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-indigo-600 font-bold">
                          RD$ {group.totalNetAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider inline-block bg-amber-50 text-amber-700 border border-amber-200">
                            Pendiente
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {permissions.confirmBankDeposits ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmingGroup(group);
                                  setConfirmedAmountInput(group.totalNetAmount.toString());
                                }}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Confirmar
                              </button>

                              {group.isSingle ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDeposit(group.deposits[0])}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar depósito"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => togglePendingExpanded(group.expectedDepositDate)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-bold text-[10px]"
                                  title={isExpanded ? 'Ocultar desglose' : 'Ver desglose por día'}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-indigo-600" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-600" />
                                  )}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">Pendiente</span>
                          )}
                        </td>
                      </tr>

                      {/* Detail row for multi-day groups */}
                      {!group.isSingle && isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-150">
                          <td colSpan={7} className="p-3 pl-6 pr-6">
                            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-2xs">
                              <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                <span>Desglose por día de venta ({group.deposits.length} lotes)</span>
                                <span className="text-slate-400 font-mono">Fecha esperada: {displayExpected}</span>
                              </div>
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100">
                                    <th className="py-1.5 px-2">Fecha Lote</th>
                                    <th className="py-1.5 px-2 text-right">Monto Bruto</th>
                                    <th className="py-1.5 px-2 text-right">Comisión</th>
                                    <th className="py-1.5 px-2 text-right">Monto Neto Est.</th>
                                    <th className="py-1.5 px-2 text-center">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium">
                                  {group.deposits.map((dep) => (
                                    <tr key={dep.id} className="hover:bg-slate-50 text-slate-700">
                                      <td className="py-2 px-2 font-mono font-bold">{dep.batchDate.split('-').reverse().join('/')}</td>
                                      <td className="py-2 px-2 text-right font-mono">RD$ {dep.grossAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                      <td className="py-2 px-2 text-right font-mono text-rose-500">-{dep.feePercent}%</td>
                                      <td className="py-2 px-2 text-right font-mono text-indigo-600 font-bold">RD$ {dep.netAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                      <td className="py-2 px-2 text-center">
                                        {permissions.confirmBankDeposits && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteDeposit(dep)}
                                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                            title="Eliminar este lote individual"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: HISTORIAL DE CONFIRMADOS (COLLAPSIBLE & GROUPED) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex justify-between items-center text-left focus:outline-none group cursor-pointer"
        >
          <div>
            <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-600" />
              Historial de Confirmados ({confirmedGroups.length})
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Registro de depósitos bancarios conciliados y cerrados</p>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 group-hover:text-slate-800 font-bold text-xs transition-colors">
            <span>{showHistory ? 'Ocultar' : 'Mostrar'}</span>
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showHistory && (
          <div className="overflow-x-auto pt-2 border-t border-slate-100 animate-fade-in">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase bg-slate-50/50">
                  <th className="py-3 px-4">Fecha Esperada</th>
                  <th className="py-3 px-4">Lote(s) de Venta</th>
                  <th className="py-3 px-4 text-right">Monto Bruto</th>
                  <th className="py-3 px-4 text-right">Comisión (%)</th>
                  <th className="py-3 px-4 text-right">Monto Neto Est.</th>
                  <th className="py-3 px-4 text-right">Monto Real Dep.</th>
                  <th className="py-3 px-4 text-center">Confirmación</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {confirmedGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-xs text-slate-400 font-medium italic">
                      No hay depósitos confirmados en el historial.
                    </td>
                  </tr>
                ) : (
                  confirmedGroups.map((group) => {
                    const displayExpected = group.expectedDepositDate.split('-').reverse().join('/');
                    const batchLabel = group.isSingle
                      ? group.deposits[0].batchDate.split('-').reverse().join('/')
                      : `${group.deposits.length} lotes (${group.deposits[0].batchDate.split('-').reverse().join('/')} al ${group.deposits[group.deposits.length - 1].batchDate.split('-').reverse().join('/')})`;
                    const isExpanded = !!expandedConfirmed[group.expectedDepositDate];
                    const firstConfirmed = group.deposits[0];

                    return (
                      <React.Fragment key={group.expectedDepositDate}>
                        <tr className="border-b border-slate-100 hover:bg-slate-50/55 transition-colors text-xs font-semibold text-slate-700">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{displayExpected}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-600">{batchLabel}</td>
                          <td className="py-3.5 px-4 text-right font-mono">
                            RD$ {group.totalGrossAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right text-rose-500 font-mono">
                            -{group.deposits[0].feePercent}%
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-indigo-600">
                            RD$ {group.totalNetAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-bold">
                            RD$ {group.totalConfirmedAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="text-[10px] text-slate-500 block font-normal leading-normal">
                              <span className="font-bold text-slate-700">{firstConfirmed.confirmedByEmployeeName || 'Cajero'}</span>
                              <br />
                              {firstConfirmed.confirmedAt ? new Date(firstConfirmed.confirmedAt).toLocaleDateString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {group.isSingle ? (
                                permissions.confirmBankDeposits ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDeposit(group.deposits[0])}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar depósito"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400 font-medium">—</span>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleConfirmedExpanded(group.expectedDepositDate)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-bold text-[10px]"
                                  title={isExpanded ? 'Ocultar desglose' : 'Ver desglose por día'}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-600" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Detail row for multi-day confirmed groups */}
                        {!group.isSingle && isExpanded && (
                          <tr className="bg-slate-50/80 border-b border-slate-150">
                            <td colSpan={8} className="p-3 pl-6 pr-6">
                              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-2xs">
                                <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                  <span>Desglose de lotes confirmados ({group.deposits.length} días)</span>
                                  <span className="text-slate-400 font-mono">Fecha esperada: {displayExpected}</span>
                                </div>
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="text-[9px] font-bold text-slate-400 uppercase border-b border-slate-100">
                                      <th className="py-1.5 px-2">Fecha Lote</th>
                                      <th className="py-1.5 px-2 text-right">Monto Bruto</th>
                                      <th className="py-1.5 px-2 text-right">Comisión</th>
                                      <th className="py-1.5 px-2 text-right">Monto Neto Est.</th>
                                      <th className="py-1.5 px-2 text-right">Monto Real Dep.</th>
                                      <th className="py-1.5 px-2 text-center">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-medium">
                                    {group.deposits.map((dep) => (
                                      <tr key={dep.id} className="hover:bg-slate-50 text-slate-700">
                                        <td className="py-2 px-2 font-mono font-bold">{dep.batchDate.split('-').reverse().join('/')}</td>
                                        <td className="py-2 px-2 text-right font-mono">RD$ {dep.grossAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                        <td className="py-2 px-2 text-right font-mono text-rose-500">-{dep.feePercent}%</td>
                                        <td className="py-2 px-2 text-right font-mono text-indigo-600 font-bold">RD$ {dep.netAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                        <td className="py-2 px-2 text-right font-mono text-emerald-600 font-bold">
                                          RD$ {(dep.confirmedAmount ?? dep.netAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                          {permissions.confirmBankDeposits && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteDeposit(dep)}
                                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                              title="Eliminar este lote individual"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deposit Confirmation Modal dialog for Group */}
      {confirmingGroup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-scale-up m-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Landmark className="w-4 h-4 text-indigo-600" />
                Confirmar Depósito Bancario
              </h3>
              <button
                onClick={() => setConfirmingGroup(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Fecha Esperada Depósito</span>
                  <span className="text-slate-800 font-mono font-bold">
                    {confirmingGroup.expectedDepositDate.split('-').reverse().join('/')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Lotes de Venta Incluidos ({confirmingGroup.deposits.length})</span>
                  <div className="flex flex-wrap gap-1 font-mono text-[11px] font-bold text-slate-700">
                    {confirmingGroup.deposits.map((d) => (
                      <span key={d.id} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[10px]">
                        {d.batchDate.split('-').reverse().join('/')} (RD$ {d.netAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 font-semibold">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Monto Bruto Total</span>
                    <span className="text-slate-700 font-mono">
                      RD$ {confirmingGroup.totalGrossAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Neto Estimado Total</span>
                    <span className="text-indigo-600 font-mono font-bold">
                      RD$ {confirmingGroup.totalNetAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Monto Depositado Real (Banco)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">RD$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={confirmedAmountInput}
                    onChange={(e) => setConfirmedAmountInput(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">
                  Monto global acreditado por la verífono/banco para esta fecha de depósito. Se conciliarán los {confirmingGroup.deposits.length} lotes automáticamente.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmingGroup(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const amount = parseFloat(confirmedAmountInput);
                  if (isNaN(amount) || amount <= 0) {
                    showAlert('Por favor introduce un monto de depósito válido.');
                    return;
                  }

                  try {
                    let sumAllocated = 0;
                    const totalConfirmed = roundCents(amount);
                    const now = new Date().toISOString();

                    const ops = confirmingGroup.deposits.map((dep, index) => {
                      let allocatedAmount = 0;
                      if (index === confirmingGroup.deposits.length - 1) {
                        allocatedAmount = roundCents(totalConfirmed - sumAllocated);
                      } else {
                        const ratio = dep.netAmount / confirmingGroup.totalNetAmount;
                        allocatedAmount = roundCents(totalConfirmed * ratio);
                        sumAllocated += allocatedAmount;
                      }

                      const updatedData: Partial<CardDeposit> = {
                        status: 'confirmed',
                        confirmedAmount: allocatedAmount,
                        confirmedAt: now,
                        confirmedByEmployeeId: currentEmployee?.id || 'unknown',
                        confirmedByEmployeeName: currentEmployee?.name || 'Cajero'
                      };

                      return {
                        type: 'update' as const,
                        collectionName: 'cardDeposits',
                        id: dep.id,
                        data: updatedData
                      };
                    });

                    await firestoreService.runBatch(ops);

                    try {
                      const batchListStr = confirmingGroup.deposits.map((d) => d.batchDate).join(', ');
                      await firestoreService.addDoc('auditLogs', {
                        action: 'confirm_bank_deposit',
                        description: `Depósito bancario confirmado por RD$ ${totalConfirmed.toLocaleString('es-DO', { minimumFractionDigits: 2 })} (Fecha esperada: ${confirmingGroup.expectedDepositDate}, Lotes: ${batchListStr})`,
                        employeeId: currentEmployee?.id || '',
                        employeeName: currentEmployee?.name || 'Cajero',
                        createdAt: now
                      });
                    } catch (auditErr) {
                      console.error('Error logging confirm_bank_deposit audit:', auditErr);
                    }

                    setConfirmingGroup(null);
                    showAlert('Depósito bancario confirmado y conciliado con éxito.');
                  } catch (err) {
                    console.error('Error confirming deposit group:', err);
                    showAlert('Hubo un error al confirmar el depósito.');
                  }
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
              >
                <Check className="w-3.5 h-3.5" /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BancosTab;
