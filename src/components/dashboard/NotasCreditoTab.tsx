import React from 'react';
import { Search, Receipt, Package, Ban } from 'lucide-react';
import { CreditNote, EmployeePermissions } from '../../types';

interface NotasCreditoTabProps {
  creditNotes: CreditNote[];
  permissions: EmployeePermissions;
  creditNoteSearch: string;
  setCreditNoteSearch: (val: string) => void;
  creditNoteStatusFilter: 'all' | 'active' | 'depleted' | 'voided';
  setCreditNoteStatusFilter: (val: 'all' | 'active' | 'depleted' | 'voided') => void;
  setIsQueryCreditNoteOpen: (open: boolean) => void;
  setQueryCreditNoteCode: (code: string) => void;
  setQueryCreditNoteResult: (res: CreditNote | null) => void;
  setNoteToVoid: (note: CreditNote | null) => void;
  setVoidReasonInput: (val: string) => void;
}

export const NotasCreditoTab: React.FC<NotasCreditoTabProps> = ({
  creditNotes,
  permissions,
  creditNoteSearch,
  setCreditNoteSearch,
  creditNoteStatusFilter,
  setCreditNoteStatusFilter,
  setIsQueryCreditNoteOpen,
  setQueryCreditNoteCode,
  setQueryCreditNoteResult,
  setNoteToVoid,
  setVoidReasonInput
}) => {
  const totalActiveBalance = creditNotes
    .filter(cn => cn.status === 'active')
    .reduce((sum, cn) => sum + (cn.remainingBalance || 0), 0);
  const totalCreatedCount = creditNotes.length;
  const activeCount = creditNotes.filter(cn => cn.status === 'active').length;
  const depletedCount = creditNotes.filter(cn => cn.status === 'depleted').length;
  const voidedCount = creditNotes.filter(cn => cn.status === 'voided').length;

  const filteredNotes = creditNotes.filter(cn => {
    const codeMatch = cn.code.toLowerCase().includes(creditNoteSearch.toLowerCase()) ||
      (cn.employeeName || '').toLowerCase().includes(creditNoteSearch.toLowerCase());
    const statusMatch = creditNoteStatusFilter === 'all' || cn.status === creditNoteStatusFilter;
    return codeMatch && statusMatch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
            🏷️ Notas de Crédito
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Gestión de notas de crédito emitidas por devoluciones y saldo disponible para canje en ventas.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              setIsQueryCreditNoteOpen(true);
              setQueryCreditNoteCode('');
              setQueryCreditNoteResult(null);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span>Consultar Nota de Crédito</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Saldo Total Disponible</span>
            <Receipt className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600">
            RD$ {totalActiveBalance.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] font-semibold text-slate-500">
            Monto pendiente de canje en ventas.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Notas Creadas</span>
            <Package className="w-5 h-5 text-slate-600" />
          </div>
          <div className="text-2xl font-black text-slate-800">
            {totalCreatedCount} <span className="text-xs font-bold text-slate-400">notas</span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500">
            Historial total de emisiones.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Estado de Notas</span>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Activas"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" title="Agotadas"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" title="Anuladas"></span>
            </div>
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-black text-emerald-600">{activeCount} <span className="text-[10px] font-bold text-emerald-700">Activas</span></span>
            <span className="text-sm font-bold text-slate-300">/</span>
            <span className="text-lg font-bold text-slate-600">{depletedCount} <span className="text-[10px] font-semibold text-slate-500">Agotadas</span></span>
            <span className="text-sm font-bold text-slate-300">/</span>
            <span className="text-lg font-bold text-slate-500">{voidedCount} <span className="text-[10px] font-semibold text-slate-400">Anuladas</span></span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500">
            Proporción del estado de las notas.
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input autoComplete="off"
            type="text"
            placeholder="Buscar por código de nota o empleado..."
            value={creditNoteSearch}
            onChange={(e) => setCreditNoteSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['all', 'active', 'depleted', 'voided'] as const).map(status => (
            <button
              key={status}
              type="button"
              onClick={() => setCreditNoteStatusFilter(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                creditNoteStatusFilter === status
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status === 'all' && 'Todas'}
              {status === 'active' && 'Activas'}
              {status === 'depleted' && 'Agotadas'}
              {status === 'voided' && 'Anuladas'}
            </button>
          ))}
        </div>
      </div>

      {/* Credit Notes Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredNotes.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-bold text-slate-600">No se encontraron notas de crédito</p>
            <p className="text-xs text-slate-400">
              {creditNoteSearch || creditNoteStatusFilter !== 'all'
                ? 'Pruebe ajustando los filtros de búsqueda.'
                : 'Las notas de crédito aparecerán aquí al emitirse en devoluciones.'}
            </p>
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Monto Original</th>
                    <th className="py-3 px-4">Saldo Disponible</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Empleado</th>
                    <th className="py-3 px-4">Fecha de Emisión</th>
                    {permissions.manageReturns && <th className="py-3 px-4 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {filteredNotes.map((note) => (
                    <tr key={note.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-black text-indigo-600 text-sm">
                        {note.code}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        RD$ {note.originalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-emerald-600">
                        RD$ {note.remainingBalance.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4">
                        {note.status === 'active' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Activa
                          </span>
                        )}
                        {note.status === 'depleted' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Agotada
                          </span>
                        )}
                        {note.status === 'voided' && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-300 w-fit">
                              <Ban className="w-3 h-3 text-slate-400" />
                              <span className="line-through">Anulada</span>
                            </span>
                            {note.voidReason && (
                              <span className="text-[10px] text-slate-500 font-normal italic truncate max-w-[160px]" title={note.voidReason}>
                                Motivo: {note.voidReason}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">
                        {note.employeeName || 'Sistema'}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-500">
                        {note.createdAt ? new Date(note.createdAt).toLocaleString('es-DO') : '—'}
                      </td>
                      {permissions.manageReturns && (
                        <td className="py-3.5 px-4 text-right">
                          {note.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => {
                                setNoteToVoid(note);
                                setVoidReasonInput('');
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Anular
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="block md:hidden p-4 space-y-3">
              {filteredNotes.map((note) => (
                <div key={note.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-indigo-600 text-base">{note.code}</span>
                    <div>
                      {note.status === 'active' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Activa
                        </span>
                      )}
                      {note.status === 'depleted' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                          Agotada
                        </span>
                      )}
                      {note.status === 'voided' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-300">
                          <Ban className="w-3 h-3" />
                          <span className="line-through">Anulada</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-2 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 block font-sans text-[9px] font-bold uppercase">Original</span>
                      <span className="font-black text-slate-800">
                        RD$ {note.originalAmount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans text-[9px] font-bold uppercase">Saldo Disponible</span>
                      <span className="font-black text-emerald-600">
                        RD$ {note.remainingBalance.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[10px] text-slate-500 font-medium">
                    <span>{note.employeeName || 'Sistema'} • {note.createdAt ? new Date(note.createdAt).toLocaleDateString('es-DO') : '—'}</span>
                    {permissions.manageReturns && note.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => {
                          setNoteToVoid(note);
                          setVoidReasonInput('');
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        Anular
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotasCreditoTab;
