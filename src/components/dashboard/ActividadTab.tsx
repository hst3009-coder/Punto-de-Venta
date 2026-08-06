import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Lock, 
  Ban, 
  ShieldCheck, 
  Landmark, 
  PackageX, 
  CheckCircle2, 
  TrendingDown, 
  DollarSign, 
  User, 
  Clock, 
  X,
  Calendar
} from 'lucide-react';
import { AuditLogEntry, Employee } from '../../types';
import { firestoreService } from '../../lib/firebase';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { isFuzzyMatch } from '../../lib/textSearch';

interface ActividadTabProps {
  currentEmployee?: Employee | null;
  employees?: Employee[];
}

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todas las acciones' },
  { value: 'close_shift_admin', label: 'Cierre de Turno Admin' },
  { value: 'void_credit_note', label: 'Anulación de Nota de Crédito' },
  { value: 'change_permissions', label: 'Cambio de Permisos' },
  { value: 'confirm_bank_deposit', label: 'Depósito Bancario' },
  { value: 'register_supplier_return', label: 'Devolución a Proveedor' },
  { value: 'credit_supplier_return', label: 'Acreditación de Devolución' },
  { value: 'register_expense', label: 'Registro de Egreso' },
  { value: 'register_payment', label: 'Abono / Pago Registrado' },
];

const getActionConfig = (action: AuditLogEntry['action']) => {
  switch (action) {
    case 'close_shift_admin':
      return {
        label: 'Cierre Turno Admin',
        icon: Lock,
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        iconBg: 'bg-indigo-100 text-indigo-600',
      };
    case 'void_credit_note':
      return {
        label: 'Anulación Nota Crédito',
        icon: Ban,
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
        iconBg: 'bg-rose-100 text-rose-600',
      };
    case 'change_permissions':
      return {
        label: 'Cambio de Permisos',
        icon: ShieldCheck,
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        iconBg: 'bg-amber-100 text-amber-600',
      };
    case 'confirm_bank_deposit':
      return {
        label: 'Depósito Bancario',
        icon: Landmark,
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconBg: 'bg-emerald-100 text-emerald-600',
      };
    case 'register_supplier_return':
      return {
        label: 'Devolución a Proveedor',
        icon: PackageX,
        badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
        iconBg: 'bg-orange-100 text-orange-600',
      };
    case 'credit_supplier_return':
      return {
        label: 'Acreditación Devolución',
        icon: CheckCircle2,
        badgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
        iconBg: 'bg-teal-100 text-teal-600',
      };
    case 'register_expense':
      return {
        label: 'Registro de Egreso',
        icon: TrendingDown,
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
        iconBg: 'bg-purple-100 text-purple-600',
      };
    case 'register_payment':
      return {
        label: 'Abono / Pago',
        icon: DollarSign,
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
        iconBg: 'bg-blue-100 text-blue-600',
      };
    default:
      return {
        label: action || 'Acción',
        icon: Activity,
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
        iconBg: 'bg-slate-100 text-slate-600',
      };
  }
};

interface AuditLogRowProps {
  log: AuditLogEntry;
}

const AuditLogRow: React.FC<AuditLogRowProps> = React.memo(({ log }) => {
  const config = getActionConfig(log.action);
  const IconComp = config.icon;
  const formattedDate = log.createdAt 
    ? new Date(log.createdAt).toLocaleString('es-DO', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      }) 
    : 'Fecha no registrada';

  return (
    <div 
      className="p-4 hover:bg-slate-50/70 transition-colors flex items-start gap-3.5"
    >
      {/* Action Icon Badge */}
      <div className={`w-9 h-9 rounded-2xl ${config.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
        <IconComp className="w-4 h-4" />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${config.badgeBg}`}>
              {config.label}
            </span>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400 inline" />
              {log.employeeName || 'Sistema / Administrador'}
            </span>
          </div>
          
          <span className="text-[11px] font-mono font-semibold text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-300" />
            {formattedDate}
          </span>
        </div>

        <p className="text-xs text-slate-700 font-medium leading-relaxed break-words">
          {log.description}
        </p>
      </div>
    </div>
  );
});

export const ActividadTab: React.FC<ActividadTabProps> = ({
  employees = []
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [selectedActionType, setSelectedActionType] = useState('all');

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = firestoreService.subscribeToCollection<AuditLogEntry>(
      'auditLogs',
      (data) => {
        const sorted = [...data].sort((a, b) => 
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setLogs(sorted);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching audit logs:', err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Employee filter
      if (selectedEmployeeId !== 'all') {
        const matchId = log.employeeId === selectedEmployeeId;
        const empObj = employees.find(e => e.id === selectedEmployeeId);
        const matchName = empObj && log.employeeName === empObj.name;
        if (!matchId && !matchName) return false;
      }

      // Action type filter
      if (selectedActionType !== 'all' && log.action !== selectedActionType) {
        return false;
      }

      // Text search on description & employeeName
      if (debouncedSearchQuery.trim()) {
        const descMatch = isFuzzyMatch(debouncedSearchQuery, log.description || '');
        const empMatch = isFuzzyMatch(debouncedSearchQuery, log.employeeName || '');
        if (!descMatch && !empMatch) return false;
      }

      return true;
    });
  }, [logs, selectedEmployeeId, selectedActionType, debouncedSearchQuery, employees]);

  const hasActiveFilters = searchQuery !== '' || selectedEmployeeId !== 'all' || selectedActionType !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedEmployeeId('all');
    setSelectedActionType('all');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in text-slate-800">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-900 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-indigo-600" />
            <span>Registro de Auditoría y Actividad</span>
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Historial centralizado de acciones operativas realizadas por empleados y administradores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-xs font-black font-mono text-indigo-700">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Text Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoComplete="off"
              type="text"
              placeholder="Buscar en la descripción o empleado..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter by Employee */}
          <div className="relative">
            <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer"
            >
              <option value="all">Todos los empleados</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role})
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Action Type */}
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 font-medium">
            <span>Filtros activos aplicados</span>
            <button
              onClick={clearFilters}
              className="text-indigo-600 font-bold hover:underline text-xs flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 font-semibold text-xs flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Cargando historial de auditoría...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-700">Sin registros de auditoría</h3>
            <p className="text-xs text-slate-400 font-medium">
              {hasActiveFilters 
                ? 'No se encontraron registros que coincidan con los filtros aplicados.' 
                : 'Aún no se han generado registros de auditoría en el sistema.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => (
              <AuditLogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default ActividadTab;
