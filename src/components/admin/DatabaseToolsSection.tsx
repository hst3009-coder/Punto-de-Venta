import React from 'react';
import { EmployeePermissions } from '../../types';
import { Database, Download, FileSpreadsheet, Loader2 } from 'lucide-react';

interface DatabaseToolsSectionProps {
  permissions: EmployeePermissions;
  isExporting: boolean;
  onExportFullBackup: () => void;
  onCloseDrawer: () => void;
  onOpenDatabase: () => void;
}

export const DatabaseToolsSection: React.FC<DatabaseToolsSectionProps> = ({
  permissions,
  isExporting,
  onExportFullBackup,
  onCloseDrawer,
  onOpenDatabase,
}) => {
  return (
    <div className="space-y-6">
      {permissions.exportFullBackup && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Respaldo Completo del Negocio</h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Exporta toda la información operativa y financiera en un libro de Excel (.xlsx) multihaja.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Genera una hoja individual por cada conjunto de datos: Productos, Clientes y Créditos, Cuentas por Pagar,
            Notas de Crédito (Clientes y Proveedores), Egresos (últimos 90 días), Devoluciones a Proveedor y Cierres de
            Turno (últimos 90 días).
          </p>

          <button
            type="button"
            onClick={onExportFullBackup}
            disabled={isExporting}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm active:scale-98"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Generando Respaldo en Excel...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Descargar Respaldo Completo del Negocio (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      )}

      {permissions.accessDatabaseTools && (
        <>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Centro de Datos Firestore</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm mx-auto">
                Accede a la consola de administración en tiempo real de las 14 colecciones autorizadas de la base de datos (ventas, cierres, mermas, clientes, etc.).
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onCloseDrawer(); // Close the admin drawer first
                onOpenDatabase(); // Open the Database Control Center!
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 mx-auto font-bold"
            >
              <Database className="w-3.5 h-3.5" /> Abrir Centro de Datos
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
            <h5 className="text-xs font-black uppercase text-slate-400 tracking-wider">Estado de Conexión</h5>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">Servidor Firestore:</span>
              <span className="text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Activo (Live)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold border-t border-slate-200/60 pt-2.5">
              <span className="text-slate-500">Proyecto de Base de Datos:</span>
              <span className="text-slate-700 font-mono text-[10px]">ai-studio-puntodeventa</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
