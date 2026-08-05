import React from 'react';
import { User, TrendingUp } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Closure, Employee } from '../../types';

export interface OpenShift {
  employee: Employee;
  firstSaleTime: number;
  expectedCash: number;
}

export interface EmployeeStat {
  id: string;
  name: string;
  role: string;
  tickets: number;
  total: number;
}

interface EmpleadosTabProps {
  canManageEmployees: boolean;
  openShifts: OpenShift[];
  pendingClosures: Closure[];
  editingClosure: Closure | null;
  actualCashInput: string;
  savingPendingClosure: boolean;
  employeeStats: EmployeeStat[];
  expandedEmployeeId: string | null;
  setExpandedEmployeeId: (id: string | null) => void;
  handleCloseShiftAdmin: (shift: OpenShift) => void;
  handleEditPendingClosure: (closure: Closure) => void;
  setEditingClosure: (closure: Closure | null) => void;
  setActualCashInput: (val: string) => void;
  handleSavePendingClosure: () => void;
  getEmployeeTrend: (empId: string) => Array<{ label: string; total: number }>;
}

interface OpenShiftRowProps {
  shift: OpenShift;
  handleCloseShiftAdmin: (shift: OpenShift) => void;
}

const OpenShiftRow: React.FC<OpenShiftRowProps> = React.memo(({ shift, handleCloseShiftAdmin }) => {
  const elapsedMs = Date.now() - shift.firstSaleTime;
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  let elapsedStr = `${elapsedMinutes} min`;
  if (elapsedMinutes >= 60) {
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours >= 24) {
      elapsedStr = `${Math.floor(elapsedHours / 24)} días y ${elapsedHours % 24} hrs`;
    } else {
      elapsedStr = `${elapsedHours} hrs y ${elapsedMinutes % 60} min`;
    }
  }

  return (
    <div className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
      <div>
        <span className="text-sm font-black text-slate-800 block">{shift.employee.name}</span>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-bold uppercase">
          <span>Abierto hace {elapsedStr}</span>
          <span>•</span>
          <span>Régimen: {shift.employee.role}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <span className="text-[10px] text-slate-450 font-bold uppercase block">Esperado Neto</span>
          <span className="text-sm font-black font-mono text-slate-800">RD$ {shift.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
        </div>

        <button
          onClick={() => handleCloseShiftAdmin(shift)}
          className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs uppercase tracking-wider"
        >
          Cerrar (Admin)
        </button>
      </div>
    </div>
  );
});

interface PendingClosureRowProps {
  closure: Closure;
  isEditing: boolean;
  actualCashInput: string;
  savingPendingClosure: boolean;
  setActualCashInput: (val: string) => void;
  setEditingClosure: (closure: Closure | null) => void;
  handleSavePendingClosure: () => void;
  handleEditPendingClosure: (closure: Closure) => void;
}

const PendingClosureRow: React.FC<PendingClosureRowProps> = React.memo(({
  closure,
  isEditing,
  actualCashInput,
  savingPendingClosure,
  setActualCashInput,
  setEditingClosure,
  handleSavePendingClosure,
  handleEditPendingClosure,
}) => {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      {isEditing ? (
        <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-800">Registrar Arqueo: {closure.clerkName}</span>
            <span className="text-[10px] text-slate-400 font-mono">{new Date(closure.createdAt || closure.date).toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Efectivo Esperado</span>
              <span className="font-bold text-slate-800 font-mono">RD$ {closure.expectedCash.toFixed(2)}</span>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Efectivo Real Contado ($)</label>
              <input autoComplete="off"
                type="number"
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-250 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 text-xs">
            <button
              onClick={() => setEditingClosure(null)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-lg font-bold cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSavePendingClosure}
              disabled={savingPendingClosure}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black cursor-pointer transition-colors shadow-sm"
            >
              {savingPendingClosure ? 'Guardando...' : 'Guardar Conteo'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm font-black text-slate-800 block">{closure.clerkName}</span>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-bold uppercase">
              <span>Corte: {new Date(closure.createdAt || closure.date).toLocaleDateString()}</span>
              <span>•</span>
              <span>Estimado por: {closure.closedByAdminName || 'Admin'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-slate-450 font-bold uppercase block">Monto Esperado</span>
              <span className="text-sm font-black font-mono text-indigo-600">RD$ {closure.expectedCash.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</span>
            </div>

            <button
              onClick={() => handleEditPendingClosure(closure)}
              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs uppercase tracking-wider"
            >
              Contar Caja
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

interface EmployeeStatRowProps {
  emp: EmployeeStat;
  idx: number;
  isExpanded: boolean;
  setExpandedEmployeeId: (id: string | null) => void;
  getEmployeeTrend: (empId: string) => Array<{ label: string; total: number }>;
}

const EmployeeStatRow: React.FC<EmployeeStatRowProps> = React.memo(({
  emp,
  idx,
  isExpanded,
  setExpandedEmployeeId,
  getEmployeeTrend,
}) => {
  const avg = emp.tickets > 0 ? emp.total / emp.tickets : 0;

  return (
    <React.Fragment>
      <tr 
        onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/20' : ''}`}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                <User className="w-5 h-5 text-slate-400" />
              </div>
              {idx < 3 && (
                <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm border border-white ${
                  idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-300' : 'bg-orange-600'
                }`}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                </div>
              )}
            </div>
            <div>
              <span className="text-sm font-black text-slate-800 block">{emp.name}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{emp.role}</span>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-center">
          <span className="text-sm font-black font-mono text-slate-700">{emp.tickets}</span>
        </td>
        <td className="px-6 py-4 text-right">
          <span className="text-sm font-black font-mono text-indigo-600">
            RD$ {emp.total.toLocaleString()}
          </span>
        </td>
        <td className="px-6 py-4 text-right">
          <span className="text-sm font-black font-mono text-slate-600">
            RD$ {avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={4} className="px-6 pb-6 pt-2 bg-slate-50/30">
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-inner">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tendencia de Venta Individual (Últimos 6 meses)</h4>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getEmployeeTrend(emp.id)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" fontSize={9} axisLine={false} tickLine={false} />
                    <YAxis fontSize={9} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                      formatter={(v: number) => [`RD$ ${v.toLocaleString()}`, 'Ventas']}
                    />
                    <Bar dataKey="total" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
});

export const EmpleadosTab: React.FC<EmpleadosTabProps> = ({
  canManageEmployees,
  openShifts,
  pendingClosures,
  editingClosure,
  actualCashInput,
  savingPendingClosure,
  employeeStats,
  expandedEmployeeId,
  setExpandedEmployeeId,
  handleCloseShiftAdmin,
  handleEditPendingClosure,
  setEditingClosure,
  setActualCashInput,
  handleSavePendingClosure,
  getEmployeeTrend
}) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Section: Turnos Abiertos (Admin only) */}
      {canManageEmployees && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel: Turnos Abiertos */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs p-6">
            <div className="mb-4">
              <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Turnos Abiertos Actualmente
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Empleados activos con ventas desde su último corte</p>
            </div>

            {openShifts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                No hay turnos abiertos con ventas registradas en este momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                {openShifts.map(shift => (
                  <OpenShiftRow key={shift.employee.id} shift={shift} handleCloseShiftAdmin={handleCloseShiftAdmin} />
                ))}
              </div>
            )}
          </div>

          {/* Panel: Cierres Pendientes de Contar */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs p-6">
            <div className="mb-4">
              <h3 className="text-sm font-black text-slate-850 uppercase tracking-tight flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                Cierres Pendientes de Conteo
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Cortes administrativos que requieren conteo físico de caja</p>
            </div>

            {pendingClosures.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                No hay cierres pendientes de conteo físico en este momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                {pendingClosures.map(closure => (
                  <PendingClosureRow
                    key={closure.id}
                    closure={closure}
                    isEditing={editingClosure?.id === closure.id}
                    actualCashInput={actualCashInput}
                    savingPendingClosure={savingPendingClosure}
                    setActualCashInput={setActualCashInput}
                    setEditingClosure={setEditingClosure}
                    handleSavePendingClosure={handleSavePendingClosure}
                    handleEditPendingClosure={handleEditPendingClosure}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Employee Stats Table */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        {/* Desktop Table */}
        <table className="w-full text-left hidden md:table">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Empleado</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Tickets</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Venta Total</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Promedio Ticket</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employeeStats.map((emp, idx) => (
              <EmployeeStatRow
                key={emp.id}
                emp={emp}
                idx={idx}
                isExpanded={expandedEmployeeId === emp.id}
                setExpandedEmployeeId={setExpandedEmployeeId}
                getEmployeeTrend={getEmployeeTrend}
              />
            ))}
          </tbody>
        </table>

        {/* Mobile Cards */}
        <div className="block md:hidden p-4 space-y-3">
          {employeeStats.map((emp, idx) => {
            const avg = emp.tickets > 0 ? emp.total / emp.tickets : 0;
            const isExpanded = expandedEmployeeId === emp.id;
            return (
              <div
                key={emp.id}
                onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.id)}
                className={`p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 cursor-pointer ${
                  isExpanded ? 'ring-2 ring-indigo-500/50 bg-indigo-50/20' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center border border-slate-200">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      {idx < 3 && (
                        <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm border border-white ${
                          idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-300' : 'bg-orange-600'
                        }`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-black text-slate-800 block">{emp.name}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{emp.role}</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                    {isExpanded ? 'Ocultar gráfico' : 'Ver gráfico'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-[10px] font-mono">
                  <div>
                    <span className="text-slate-400 block font-sans text-[9px] font-bold uppercase">Tickets</span>
                    <span className="font-black text-slate-700">{emp.tickets}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans text-[9px] font-bold uppercase">Total Venta</span>
                    <span className="font-black text-indigo-600">RD$ {emp.total.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans text-[9px] font-bold uppercase">Promedio</span>
                    <span className="font-black text-slate-600">RD$ {avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="pt-3 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tendencia (6 meses)</h4>
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="h-36">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getEmployeeTrend(emp.id)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="label" fontSize={9} axisLine={false} tickLine={false} />
                          <YAxis fontSize={9} axisLine={false} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }}
                            formatter={(v: number) => [`RD$ ${v.toLocaleString()}`, 'Ventas']}
                          />
                          <Bar dataKey="total" fill="#6366f1" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EmpleadosTab;
