import React, { useState, useEffect } from 'react';
import { Employee, EmployeePermissions, AuditLogEntry } from '../types';
import { firestoreService } from '../lib/firebase';
import { hashPin, verifyPin } from '../lib/crypto';
import { ROLE_DEFAULT_PERMISSIONS } from '../lib/permissions';
import { User, Plus, Edit2, Shield, Key, Check, X, ToggleLeft, ToggleRight, UserCheck, UserX, RefreshCw } from 'lucide-react';

interface EmployeesViewProps {
  currentEmployee?: Employee;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ currentEmployee }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'cashier' | 'manager'>('cashier');
  const [pin, setPin] = useState('');
  const [changePin, setChangePin] = useState(false);
  const [active, setActive] = useState(true);
  const [permissions, setPermissions] = useState<EmployeePermissions>(ROLE_DEFAULT_PERMISSIONS.cashier);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch employees
  useEffect(() => {
    const unsubscribe = firestoreService.subscribeToCollection<Employee>('employees', 
      (data) => {
        setEmployees(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error in employees sub:', err);
        setError('No se pudieron cargar los empleados.');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setName('');
    setRole('cashier');
    setPermissions(ROLE_DEFAULT_PERMISSIONS.cashier);
    setPin('');
    setChangePin(false);
    setActive(true);
    setIsEditing(false);
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (employee: Employee) => {
    setName(employee.name);
    setRole(employee.role);
    setActive(employee.active);
    setPermissions(employee.permissions || ROLE_DEFAULT_PERMISSIONS[employee.role] || ROLE_DEFAULT_PERMISSIONS.cashier);
    setPin('');
    setChangePin(false);
    setIsEditing(true);
    setEditingId(employee.id);
  };

  const handleToggleActive = async (employee: Employee) => {
    setError(null);
    try {
      if (employee.active) {
        const activeCount = employees.filter(emp => emp.active).length;
        if (activeCount <= 1) {
          setError('Debe quedar al menos un empleado activo. Activa a otro empleado antes de desactivar a este.');
          return;
        }
      }
      await firestoreService.updateDoc('employees', employee.id, {
        active: !employee.active
      });
      showSuccess(`Empleado ${employee.name} ${!employee.active ? 'activado' : 'desactivado'} correctamente.`);
    } catch (err) {
      console.error(err);
      setError('Error al actualizar el estado del empleado.');
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRoleChange = (newRole: 'admin' | 'cashier' | 'manager') => {
    setRole(newRole);
    setPermissions(ROLE_DEFAULT_PERMISSIONS[newRole]);
  };

  const handlePermissionToggle = (key: keyof EmployeePermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es requerido.');
      return;
    }

    // Validate PIN for new employee or if changing PIN
    const isPinRequired = !isEditing || changePin;
    if (isPinRequired) {
      if (!pin) {
        setError('El PIN es requerido.');
        return;
      }
      if (!/^\d{4,6}$/.test(pin)) {
        setError('El PIN debe ser un número de entre 4 y 6 dígitos.');
        return;
      }
    }

    setSubmitting(true);
    try {
      // Duplicate PIN validation
      if (isPinRequired) {
        const otherEmployees = employees.filter(emp => !(isEditing && emp.id === editingId) && emp.pinHash && emp.pinSalt);
        const pinCheckResults = await Promise.all(
          otherEmployees.map(async (emp) => {
            const isMatch = await verifyPin(pin, emp.pinHash!, emp.pinSalt!);
            return { emp, isMatch };
          })
        );
        const duplicateEmp = pinCheckResults.find(res => res.isMatch)?.emp;
        if (duplicateEmp) {
          setError(`Este PIN ya está en uso por ${duplicateEmp.name}. Elige un PIN diferente.`);
          setSubmitting(false);
          return;
        }
      }

      let pinData: Partial<Employee> = {};
      if (isPinRequired) {
        const { hash, salt } = await hashPin(pin);
        pinData = {
          pinHash: hash,
          pinSalt: salt
        };
      }

      if (isEditing && editingId) {
        if (!active) {
          const currentEmployee = employees.find(emp => emp.id === editingId);
          if (currentEmployee && currentEmployee.active) {
            const activeCount = employees.filter(emp => emp.active).length;
            if (activeCount <= 1) {
              setError('Debe quedar al menos un empleado activo. Activa a otro empleado antes de desactivar a este.');
              setSubmitting(false);
              return;
            }
          }
        }
        const targetEmp = employees.find(emp => emp.id === editingId);
        const targetPerms = targetEmp?.permissions;
        let permissionsChanged = !targetPerms;
        if (targetPerms) {
          const allPermissionKeys = Array.from(
            new Set([
              ...Object.keys(targetPerms),
              ...Object.keys(permissions)
            ])
          ) as (keyof EmployeePermissions)[];
          permissionsChanged = allPermissionKeys.some(
            key => Boolean(targetPerms[key]) !== Boolean(permissions[key])
          );
        }

        const updateData: any = {
          name,
          role,
          active,
          permissions,
          ...pinData
        };
        await firestoreService.updateDoc('employees', editingId, updateData);

        if (permissionsChanged) {
          try {
            const auditData: Omit<AuditLogEntry, 'id'> = {
              action: 'change_permissions',
              description: `Se modificaron los permisos del empleado ${name}`,
              employeeId: currentEmployee?.id || '',
              employeeName: currentEmployee?.name || 'Administrador',
              targetEmployeeId: editingId,
              createdAt: new Date().toISOString()
            };
            await firestoreService.addDoc('auditLogs', auditData);
          } catch (auditErr) {
            console.error('Error recording audit log for change_permissions:', auditErr);
          }
        }

        showSuccess('Empleado actualizado correctamente.');
      } else {
        const newEmployee: Omit<Employee, 'id'> = {
          name,
          role,
          active,
          permissions,
          pinHash: pinData.pinHash || '',
          pinSalt: pinData.pinSalt || ''
        };
        await firestoreService.addDoc('employees', newEmployee);
        showSuccess('Empleado registrado correctamente.');
      }
      resetForm();
    } catch (err) {
      console.error('Error saving employee:', err);
      setError('Ocurrió un error al guardar el empleado.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-250 text-rose-800 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 animate-fade-in">
          <X className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Form Container */}
        <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <User className="w-4 h-4 text-indigo-600" />
            <h4 className="font-bold text-slate-800 text-sm">
              {isEditing ? 'Editar Empleado' : 'Registrar Nuevo Empleado'}
            </h4>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Nombre Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                required
              />
            </div>

            {/* Role */}
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Rol / Puesto</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
              >
                <option value="cashier">Cajero</option>
                <option value="manager">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {/* Permissions Section */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Permisos del Sistema</label>
                <button 
                  type="button"
                  onClick={() => setPermissions(ROLE_DEFAULT_PERMISSIONS[role])}
                  className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Restaurar Predeterminados
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 bg-white border border-slate-150 p-3 rounded-xl max-h-48 overflow-y-auto">
                {[
                  { key: 'viewDashboard', label: 'Ver Dashboard' },
                  { key: 'manageEmployees', label: 'Gestionar Empleados' },
                  { key: 'manageProducts', label: 'Gestionar Productos' },
                  { key: 'bulkEditProducts', label: 'Ediciones en Lote de Catálogo' },
                  { key: 'importProducts', label: 'Importar Productos (Excel)' },
                  { key: 'manageCustomers', label: 'Gestionar Clientes' },
                  { key: 'registerPayments', label: 'Registrar Abonos' },
                  { key: 'registerExpenses', label: 'Registrar Egresos' },
                  { key: 'closeShift', label: 'Cerrar Turno' },
                  { key: 'voidSales', label: 'Anular/Devolver Ventas' },
                  { key: 'accessDatabaseTools', label: 'Herramientas de Base de Datos' },
                  { key: 'editStoreSettings', label: 'Configuración de Tienda' },
                  { key: 'managePayables', label: 'Cuentas por Pagar' },
                  { key: 'manageReturns', label: 'Devoluciones' },
                  { key: 'confirmBankDeposits', label: 'Confirmar Depósitos Bancarios' },
                  { key: 'exportFullBackup', label: 'Respaldo Completo del Negocio' },
                ].map((perm) => (
                  <label key={perm.key} className="flex items-center gap-2 group cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(permissions as any)[perm.key]}
                      onChange={() => handlePermissionToggle(perm.key as keyof EmployeePermissions)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors uppercase tracking-tight">
                      {perm.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* PIN settings */}
            <div className="space-y-3">
              {isEditing && (
                <label className="flex items-center gap-2 text-xs text-slate-600 font-bold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={changePin}
                    onChange={(e) => setChangePin(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 border-slate-300"
                  />
                  <span>Cambiar PIN de seguridad</span>
                </label>
              )}

              {(!isEditing || changePin) && (
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">
                    PIN de Seguridad (4-6 dígitos)
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ej. 1234"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold tracking-widest focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:outline-none"
                      required={!isEditing || changePin}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Solo números. El PIN es personal e intransferible.
                  </p>
                </div>
              )}
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-150">
              <div>
                <span className="text-xs font-bold text-slate-700 block">Estado de Empleado</span>
                <span className="text-[10px] text-slate-400">¿Permitir el acceso al sistema?</span>
              </div>
              <button
                type="button"
                onClick={() => setActive(!active)}
                className="text-indigo-600 hover:text-indigo-700 transition-colors focus:outline-none cursor-pointer"
              >
                {active ? (
                  <ToggleRight className="w-10 h-10 text-indigo-600" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-slate-300" />
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Registrar Empleado'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="py-2 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List Container */}
        <div className="md:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-600" />
              <h4 className="font-bold text-slate-800 text-sm">Nómina de Empleados</h4>
            </div>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {employees.length} Registrados
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Cargando nómina...</div>
          ) : employees.length === 0 ? (
            <div className="py-12 text-center text-slate-450 text-xs font-semibold flex flex-col items-center gap-2">
              <User className="w-8 h-8 text-slate-300" />
              <span>No hay empleados registrados.</span>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    emp.active
                      ? 'bg-slate-50/50 border-slate-150 hover:bg-slate-50 hover:border-slate-300'
                      : 'bg-slate-100/50 border-slate-200 opacity-65'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${emp.active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                      {emp.active ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-xs">{emp.name}</span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                          emp.role === 'admin'
                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                            : emp.role === 'manager'
                            ? 'bg-amber-50 text-amber-600 border border-amber-100'
                            : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                          {emp.role === 'admin' ? 'Admin' : emp.role === 'manager' ? 'Gerente' : 'Cajero'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                        ID: {emp.id.substring(0, 8)}... • {emp.active ? 'Acceso Permitido' : 'Acceso Revocado'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEdit(emp)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/20 transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(emp)}
                      disabled={emp.active && employees.filter(e => e.active).length <= 1}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        emp.active
                          ? employees.filter(e => e.active).length <= 1
                            ? 'border-slate-200 bg-slate-100 text-slate-350 cursor-not-allowed opacity-50'
                            : 'border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50/20'
                          : 'border-emerald-200 bg-emerald-50/50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                      title={emp.active && employees.filter(e => e.active).length <= 1 ? 'Debe quedar al menos un empleado activo' : emp.active ? 'Desactivar acceso' : 'Activar acceso'}
                    >
                      {emp.active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
