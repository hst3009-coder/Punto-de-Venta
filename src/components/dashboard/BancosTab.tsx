import React, { useState, useMemo } from 'react';
import { Landmark, Check, X, Clock, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { CardDeposit, Employee, EmployeePermissions } from '../../types';
import { roundCents } from '../../lib/money';
import { firestoreService } from '../../lib/firebase';

interface BancosTabProps {
  cardDeposits: CardDeposit[];
  permissions: EmployeePermissions;
  currentEmployee: Employee | null;
  firestoreService: typeof firestoreService;
  showAlert: (msg: string) => void;
}

export const BancosTab: React.FC<BancosTabProps> = ({
  cardDeposits,
  permissions,
  currentEmployee,
  firestoreService,
  showAlert,
}) => {
  const [confirmingDeposit, setConfirmingDeposit] = useState<CardDeposit | null>(null);
  const [confirmedAmountInput, setConfirmedAmountInput] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);

  const pendingDeposits = useMemo(() => {
    return cardDeposits
      .filter((d) => d.status === 'pending')
      .sort((a, b) => a.expectedDepositDate.localeCompare(b.expectedDepositDate));
  }, [cardDeposits]);

  const confirmedDeposits = useMemo(() => {
    return cardDeposits
      .filter((d) => d.status === 'confirmed')
      .sort((a, b) => {
        const timeA = a.confirmedAt ? new Date(a.confirmedAt).getTime() : 0;
        const timeB = b.confirmedAt ? new Date(b.confirmedAt).getTime() : 0;
        return timeB - timeA;
      });
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
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Control de acreditaciones bancarias pendientes en tránsito</p>
          </div>
          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full">
            {pendingDeposits.length} {pendingDeposits.length === 1 ? 'pendiente' : 'pendientes'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase bg-slate-50/50">
                <th className="py-3 px-4">Fecha Lote</th>
                <th className="py-3 px-4">Fecha Esperada</th>
                <th className="py-3 px-4 text-right">Monto Bruto</th>
                <th className="py-3 px-4 text-right">Comisión (%)</th>
                <th className="py-3 px-4 text-right">Monto Neto Est.</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pendingDeposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-emerald-600 font-bold">
                    <div className="flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>No hay depósitos pendientes ✓</span>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingDeposits.map((deposit) => {
                  const displayBatch = deposit.batchDate.split('-').reverse().join('/');
                  const displayExpected = deposit.expectedDepositDate.split('-').reverse().join('/');
                  return (
                    <tr key={deposit.id} className="border-b border-slate-100 hover:bg-slate-50/55 transition-colors text-xs font-semibold text-slate-700">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{displayBatch}</td>
                      <td className="py-3.5 px-4 font-mono">{displayExpected}</td>
                      <td className="py-3.5 px-4 text-right font-mono">RD$ {deposit.grossAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-4 text-right text-rose-500 font-mono">-{deposit.feePercent}%</td>
                      <td className="py-3.5 px-4 text-right font-mono text-indigo-600">RD$ {deposit.netAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider inline-block bg-amber-50 text-amber-700 border border-amber-200">
                          Pendiente
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {permissions.confirmBankDeposits ? (
                          <button
                            onClick={() => {
                              setConfirmingDeposit(deposit);
                              setConfirmedAmountInput(deposit.netAmount.toString());
                            }}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase rounded-lg transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                          >
                            <Check className="w-3 h-3" /> Confirmar
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Pendiente</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: HISTORIAL DE CONFIRMADOS (COLLAPSIBLE) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex justify-between items-center text-left focus:outline-none group cursor-pointer"
        >
          <div>
            <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-600" />
              Historial de Confirmados ({confirmedDeposits.length})
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
                  <th className="py-3 px-4">Fecha Lote</th>
                  <th className="py-3 px-4">Fecha Esperada</th>
                  <th className="py-3 px-4 text-right">Monto Bruto</th>
                  <th className="py-3 px-4 text-right">Comisión (%)</th>
                  <th className="py-3 px-4 text-right">Monto Neto Est.</th>
                  <th className="py-3 px-4 text-right">Monto Real Dep.</th>
                  <th className="py-3 px-4 text-center">Confirmación</th>
                </tr>
              </thead>
              <tbody>
                {confirmedDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-xs text-slate-400 font-medium italic">
                      No hay depósitos confirmados en el historial.
                    </td>
                  </tr>
                ) : (
                  confirmedDeposits.map((deposit) => {
                    const displayBatch = deposit.batchDate.split('-').reverse().join('/');
                    const displayExpected = deposit.expectedDepositDate.split('-').reverse().join('/');
                    return (
                      <tr key={deposit.id} className="border-b border-slate-100 hover:bg-slate-50/55 transition-colors text-xs font-semibold text-slate-700">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{displayBatch}</td>
                        <td className="py-3.5 px-4 font-mono">{displayExpected}</td>
                        <td className="py-3.5 px-4 text-right font-mono">RD$ {deposit.grossAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3.5 px-4 text-right text-rose-500 font-mono">-{deposit.feePercent}%</td>
                        <td className="py-3.5 px-4 text-right font-mono text-indigo-600">RD$ {deposit.netAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-600 font-bold">
                          RD$ {(deposit.confirmedAmount ?? deposit.netAmount).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="text-[10px] text-slate-500 block font-normal leading-normal">
                            <span className="font-bold text-slate-700">{deposit.confirmedByEmployeeName || 'Cajero'}</span>
                            <br />
                            {deposit.confirmedAt ? new Date(deposit.confirmedAt).toLocaleDateString('es-DO', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deposit Confirmation Modal dialog */}
      {confirmingDeposit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-scale-up m-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Landmark className="w-4 h-4 text-indigo-600" />
                Confirmar Depósito Bancario
              </h3>
              <button
                onClick={() => setConfirmingDeposit(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha Lote</span>
                  <span className="text-slate-700 font-mono font-bold">{confirmingDeposit.batchDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Fecha Esperada</span>
                  <span className="text-slate-700 font-mono font-bold">{confirmingDeposit.expectedDepositDate}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Monto Bruto</span>
                  <span className="text-slate-700 font-mono">RD$ {confirmingDeposit.grossAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Comisión ({confirmingDeposit.feePercent}%)</span>
                  <span className="text-slate-700 font-mono">RD$ {roundCents(confirmingDeposit.grossAmount * confirmingDeposit.feePercent / 100).toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 block">Monto Neto Calculado</label>
                <span className="text-lg font-black font-mono text-indigo-600 block">
                  RD$ {confirmingDeposit.netAmount.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                </span>
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
                <p className="text-[10px] text-slate-400 font-semibold">Ajusta este monto si el banco depositó una cantidad diferente por retenciones o comisiones reales.</p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmingDeposit(null)}
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
                    const updatedDeposit: Partial<CardDeposit> = {
                      status: 'confirmed',
                      confirmedAmount: amount,
                      confirmedAt: new Date().toISOString(),
                      confirmedByEmployeeId: currentEmployee?.id || 'unknown',
                      confirmedByEmployeeName: currentEmployee?.name || 'Cajero'
                    };
                    await firestoreService.updateDoc('cardDeposits', confirmingDeposit.id, updatedDeposit);
                    try {
                      await firestoreService.addDoc('auditLogs', {
                        action: 'confirm_bank_deposit',
                        description: `Depósito bancario confirmado por RD$ ${amount.toLocaleString('es-DO', { minimumFractionDigits: 2 })} (Lote: ${confirmingDeposit.batchDate})`,
                        employeeId: currentEmployee?.id || '',
                        employeeName: currentEmployee?.name || 'Cajero',
                        createdAt: new Date().toISOString()
                      });
                    } catch (auditErr) {
                      console.error('Error logging confirm_bank_deposit audit:', auditErr);
                    }
                    setConfirmingDeposit(null);
                    showAlert('Depósito confirmado y conciliado con éxito.');
                  } catch (err) {
                    console.error('Error confirming deposit:', err);
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
