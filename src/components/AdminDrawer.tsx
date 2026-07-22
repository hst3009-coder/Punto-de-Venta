import React, { useState } from 'react';
import { StoreIdentity, EmployeePermissions, DashboardConfig } from '../types';
import { X, Check, Database, Store, Users, Calendar, Plus, Trash2, Percent, ToggleLeft, ToggleRight } from 'lucide-react';
import { EmployeesView } from './EmployeesView';

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDatabase: () => void;
  identity: StoreIdentity;
  onUpdateIdentity: (identity: StoreIdentity) => void;
  permissions: EmployeePermissions;
  dashboardConfig: DashboardConfig;
  onUpdateDashboardConfig: (config: DashboardConfig) => void;
}

export const AdminDrawer: React.FC<AdminDrawerProps> = ({
  isOpen,
  onClose,
  onOpenDatabase,
  identity,
  onUpdateIdentity,
  permissions,
  dashboardConfig,
  onUpdateDashboardConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'dashboard' | 'database' | 'employees'>(
    permissions.editStoreSettings ? 'identity' : 
    permissions.accessDatabaseTools ? 'database' : 'employees'
  );

  const [newPaymentTypeLabel, setNewPaymentTypeLabel] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [newAccountLabel, setNewAccountLabel] = useState('');
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      {/* Background overlay click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-250 flex flex-col justify-between z-10 animate-slide-left">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Panel de Configuración</h3>
            <p className="text-xs text-slate-500 mt-1">Gestión de la identidad de la tienda y base de datos</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2 border-b border-slate-200 flex gap-4 text-sm font-bold bg-white">
          {permissions.editStoreSettings && (
            <button
              onClick={() => setActiveTab('identity')}
              className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'identity'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Identidad</span>
            </button>
          )}
          {permissions.editStoreSettings && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
          )}
          {permissions.accessDatabaseTools && (
            <button
              onClick={() => setActiveTab('database')}
              className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'database'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Base de Datos</span>
            </button>
          )}
          {permissions.manageEmployees && (
            <button
              onClick={() => setActiveTab('employees')}
              className={`pb-2 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'employees'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Empleados</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'identity' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Store className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-800 text-sm">Identidad de la Tienda</h4>
                </div>
                
                <div className="space-y-4">
                  {/* Nombre */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 block">Nombre Comercial</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={identity.showNameOnInvoice}
                          onChange={(e) => onUpdateIdentity({ ...identity, showNameOnInvoice: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                        />
                        Ver en factura
                      </label>
                    </div>
                    <input
                      type="text"
                      value={identity.name}
                      onChange={(e) => onUpdateIdentity({ ...identity, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                  </div>

                  {/* Slogan */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 block">Slogan / Subtítulo</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={identity.showSloganOnInvoice}
                          onChange={(e) => onUpdateIdentity({ ...identity, showSloganOnInvoice: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                        />
                        Ver en factura
                      </label>
                    </div>
                    <input
                      type="text"
                      value={identity.slogan}
                      onChange={(e) => onUpdateIdentity({ ...identity, slogan: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                  </div>

                  {/* Dirección */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 block">Dirección</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={identity.showAddressOnInvoice}
                          onChange={(e) => onUpdateIdentity({ ...identity, showAddressOnInvoice: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                        />
                        Ver en factura
                      </label>
                    </div>
                    <input
                      type="text"
                      value={identity.address}
                      onChange={(e) => onUpdateIdentity({ ...identity, address: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 block">Número de Teléfono</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={identity.showPhoneOnInvoice}
                          onChange={(e) => onUpdateIdentity({ ...identity, showPhoneOnInvoice: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                        />
                        Ver en factura
                      </label>
                    </div>
                    <input
                      type="text"
                      value={identity.phone}
                      onChange={(e) => onUpdateIdentity({ ...identity, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                  </div>

                  {/* Logo/Icono */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-500 block">Ícono / Logotipo</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={identity.showLogoOnInvoice}
                          onChange={(e) => onUpdateIdentity({ ...identity, showLogoOnInvoice: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                        />
                        Ver en factura
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl border border-slate-200 text-slate-700 flex items-center justify-center text-xl font-bold overflow-hidden bg-white shrink-0 shadow-sm">
                        {identity.logoUrl && (identity.logoUrl.startsWith('data:image') || identity.logoUrl.startsWith('http')) ? (
                          <img src={identity.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          identity.logoUrl || '☕'
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <input
                          type="text"
                          value={identity.logoUrl}
                          placeholder="Ej: ☕ o enlace de imagen"
                          onChange={(e) => onUpdateIdentity({ ...identity, logoUrl: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors block text-center flex-1">
                            Subir Logotipo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    if (typeof reader.result === 'string') {
                                      onUpdateIdentity({ ...identity, logoUrl: reader.result });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => onUpdateIdentity({ ...identity, logoUrl: '☕' })}
                            className="text-[10px] text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md transition-colors font-bold flex-1"
                          >
                            Restablecer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {activeTab === 'dashboard' && (() => {
            const paymentTypes = dashboardConfig?.paymentTypes ?? [
              { id: 'cash', label: 'Efectivo', active: true },
              { id: 'card', label: 'Tarjeta', active: true },
              { id: 'transfer', label: 'Transferencia', active: true },
              { id: 'credit', label: 'Crédito', active: true },
            ];
            const bankAccounts = dashboardConfig?.bankAccounts ?? [];

            const handleTogglePaymentType = (id: string) => {
              const updated = paymentTypes.map((pt) => {
                if (pt.id === id) {
                  return { ...pt, active: !pt.active };
                }
                return pt;
              });
              onUpdateDashboardConfig({
                ...dashboardConfig,
                paymentTypes: updated,
              });
            };

            const handleAddPaymentType = () => {
              if (!newPaymentTypeLabel.trim()) return;
              const newPt = {
                id: `custom_${Date.now()}`,
                label: newPaymentTypeLabel.trim(),
                active: true,
              };
              onUpdateDashboardConfig({
                ...dashboardConfig,
                paymentTypes: [...paymentTypes, newPt],
              });
              setNewPaymentTypeLabel('');
            };

            const handleDeletePaymentType = (id: string) => {
              if (['cash', 'card', 'transfer', 'credit'].includes(id)) return;
              const updated = paymentTypes.filter((pt) => pt.id !== id);
              onUpdateDashboardConfig({
                ...dashboardConfig,
                paymentTypes: updated,
              });
            };

            const handleToggleBankAccount = (id: string) => {
              const updated = bankAccounts.map((ba) => {
                if (ba.id === id) {
                  return { ...ba, active: !ba.active };
                }
                return ba;
              });
              onUpdateDashboardConfig({
                ...dashboardConfig,
                bankAccounts: updated,
              });
            };

            const handleAddBankAccount = () => {
              if (!newBankName.trim() || !newAccountLabel.trim()) return;
              const newBa = {
                id: `bank_${Date.now()}`,
                bankName: newBankName.trim(),
                accountLabel: newAccountLabel.trim(),
                active: true,
              };
              onUpdateDashboardConfig({
                ...dashboardConfig,
                bankAccounts: [...bankAccounts, newBa],
              });
              setNewBankName('');
              setNewAccountLabel('');
            };

            const handleDeleteBankAccount = (id: string) => {
              const updated = bankAccounts.filter((ba) => ba.id !== id);
              onUpdateDashboardConfig({
                ...dashboardConfig,
                bankAccounts: updated,
              });
            };

            return (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5 overflow-y-auto max-h-[70vh]">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                  <Percent className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-800 text-sm">Configuración del Dashboard</h4>
                </div>

                {/* Comisión de Tarjeta */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 block">Comisión de Tarjeta (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={dashboardConfig?.cardFeePercent ?? 3.8}
                      onChange={(e) => onUpdateDashboardConfig({
                        ...dashboardConfig,
                        cardFeePercent: parseFloat(e.target.value) || 0
                      })}
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold">Tasa estándar descontada automáticamente para el cálculo de depósitos netos.</p>
                </div>

                {/* Listado de Feriados */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-800">Días Feriados / No Laborables</label>
                  </div>
                  
                  {/* Formulario para agregar feriado */}
                  <div className="flex gap-2">
                    <input
                      type="date"
                      id="new-holiday-date"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('new-holiday-date') as HTMLInputElement;
                        if (input && input.value) {
                          const dateStr = input.value; // YYYY-MM-DD
                          const currentHolidays = dashboardConfig?.holidays ?? [];
                          if (!currentHolidays.includes(dateStr)) {
                            const updatedHolidays = [...currentHolidays, dateStr].sort();
                            onUpdateDashboardConfig({
                              ...dashboardConfig,
                              holidays: updatedHolidays
                            });
                          }
                          input.value = '';
                        }
                      }}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>

                  {/* Lista de feriados */}
                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                    {(!dashboardConfig?.holidays || dashboardConfig.holidays.length === 0) ? (
                      <p className="text-xs text-slate-400 font-medium italic text-center py-2">No hay días feriados registrados.</p>
                    ) : (
                      dashboardConfig.holidays.map((h) => {
                        // Format to readable Spanish date
                        const parts = h.split('-');
                        const displayDate = parts.length === 3 
                          ? `${parts[2]}/${parts[1]}/${parts[0]}` 
                          : h;
                        return (
                          <div key={h} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-1.5">
                            <span className="text-xs font-semibold text-slate-700">{displayDate}</span>
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateDashboardConfig({
                                  ...dashboardConfig,
                                  holidays: (dashboardConfig.holidays || []).filter(item => item !== h)
                                });
                              }}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* --- TIPOS DE COBRO --- */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-800">Tipos de Cobro</label>
                  </div>

                  {/* Formulario para agregar tipo de cobro */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej. Transferencia USD, Cheque"
                      value={newPaymentTypeLabel}
                      onChange={(e) => setNewPaymentTypeLabel(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddPaymentType}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>

                  {/* Lista de tipos de cobro */}
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {paymentTypes.map((pt) => {
                      const isOriginal = ['cash', 'card', 'transfer', 'credit'].includes(pt.id);
                      return (
                        <div key={pt.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-1.5">
                          <span className={`text-xs font-semibold ${pt.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                            {pt.label} {isOriginal && <span className="text-[9px] text-indigo-500 font-bold uppercase ml-1">(Básico)</span>}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTogglePaymentType(pt.id)}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              title={pt.active ? "Desactivar" : "Activar"}
                            >
                              {pt.active ? (
                                <ToggleRight className="w-6 h-6 text-indigo-600 cursor-pointer" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-slate-300 cursor-pointer" />
                              )}
                            </button>
                            {!isOriginal && (
                              <button
                                type="button"
                                onClick={() => handleDeletePaymentType(pt.id)}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* --- CUENTAS BANCARIAS --- */}
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <label className="text-xs font-bold text-slate-800">Cuentas Bancarias</label>
                  </div>

                  {/* Formulario para agregar cuenta bancaria */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Banco (ej. Banreservas)"
                        value={newBankName}
                        onChange={(e) => setNewBankName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Etiqueta (ej. Cuenta 1234)"
                        value={newAccountLabel}
                        onChange={(e) => setNewAccountLabel(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddBankAccount}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Cuenta Bancaria
                    </button>
                  </div>

                  {/* Lista de cuentas bancarias */}
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {bankAccounts.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium italic text-center py-2">No hay cuentas bancarias registradas.</p>
                    ) : (
                      bankAccounts.map((ba) => (
                        <div key={ba.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-1.5">
                          <div className="flex flex-col">
                            <span className={`text-xs font-bold ${ba.active ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                              {ba.bankName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {ba.accountLabel}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleBankAccount(ba.id)}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              title={ba.active ? "Desactivar" : "Activar"}
                            >
                              {ba.active ? (
                                <ToggleRight className="w-6 h-6 text-indigo-600 cursor-pointer" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-slate-300 cursor-pointer" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBankAccount(ba.id)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'database' && (
            <div className="space-y-6">
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
                    onClose(); // Close the admin drawer first
                    onOpenDatabase(); // Open the Database Control Center!
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 mx-auto"
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
            </div>
          )}

          {activeTab === 'employees' && (
            <EmployeesView />
          )}
        </div>

        {/* Footer info or quick restore */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500 font-medium">
          <span>* Los productos creados se guardan localmente.</span>
        </div>

      </div>
    </div>
  );
};
