import { useState, useMemo } from 'react';
import { Employee, Closure, Sale, Movement, AuditLogEntry, isMixedSale } from '../types';
import { getSaleTimestamp } from '../lib/dates';
import { firestoreService } from '../lib/firebase';
import { usePermissions } from './usePermissions';

interface UseAdminShiftManagerProps {
  currentEmployee: Employee | null;
  employees: Employee[];
  closures: Closure[];
  sales: Sale[];
  movements: Movement[];
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'warning' | 'info') => Promise<void>;
  showConfirm: (title: string, message: string, confirmText?: string, cancelText?: string) => Promise<boolean>;
}

export function useAdminShiftManager({
  currentEmployee,
  employees,
  closures,
  sales,
  movements,
  showAlert,
  showConfirm,
}: UseAdminShiftManagerProps) {
  const [editingClosure, setEditingClosure] = useState<Closure | null>(null);
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [savingPendingClosure, setSavingPendingClosure] = useState(false);

  const permissions = usePermissions(currentEmployee);
  const canManageEmployees = currentEmployee?.role === 'admin' || permissions.manageEmployees;

  const openShifts = useMemo(() => {
    const activeEmployees = employees.filter((emp) => emp.active);

    const shifts: Array<{
      employee: Employee;
      firstSaleTime: number;
      expectedCash: number;
      totalSalesSum: number;
    }> = [];

    activeEmployees.forEach((emp) => {
      const empClosures = closures.filter((c) => c.employeeId === emp.id);
      let lastClosure: Closure | null = null;
      empClosures.forEach((current) => {
        if (!lastClosure) {
          lastClosure = current;
          return;
        }
        const latestTime = new Date(lastClosure.createdAt || lastClosure.date).getTime();
        const currentTime = new Date(current.createdAt || current.date).getTime();
        if (currentTime > latestTime) {
          lastClosure = current;
        }
      });

      const lastClosureTime = lastClosure
        ? new Date(lastClosure.createdAt || lastClosure.date).getTime()
        : 0;

      const empSales = sales.filter((sale) => {
        if (!sale.date || sale.isCancelled) return false;
        if (sale.soldBy?.id !== emp.id) return false;
        return getSaleTimestamp(sale) > lastClosureTime;
      });

      if (empSales.length > 0) {
        const sortedEmpSales = [...empSales].sort(
          (a, b) => getSaleTimestamp(a) - getSaleTimestamp(b)
        );
        const firstSaleTime = getSaleTimestamp(sortedEmpSales[0]);
        const initialCash = 500;

        const empCashSalesSum = empSales.reduce((acc, s) => {
          if (s.paymentMethod === 'cash') return acc + s.total;
          if (isMixedSale(s)) {
            const cashPart = s.paymentBreakdown
              .filter((b) => b.method === 'cash')
              .reduce((sum, b) => sum + b.amount, 0);
            return acc + cashPart;
          }
          return acc;
        }, 0);

        const empExpenses = movements.filter((m) => {
          if (m.type !== 'out') return false;
          const source = m.source ?? 'shift';
          if (source !== 'shift') return false;
          if (m.employeeId !== emp.id) return false;
          const mTime = new Date(m.createdAt || m.date).getTime();
          return mTime > lastClosureTime;
        });

        const empCashExpensesSum = empExpenses
          .filter((m) => m.paymentMethod === 'cash')
          .reduce((acc, m) => acc + m.amount, 0);

        const expectedCash = initialCash + empCashSalesSum - empCashExpensesSum;
        const totalSalesSum = empSales.reduce((acc, s) => acc + s.total, 0);

        shifts.push({
          employee: emp,
          firstSaleTime,
          expectedCash,
          totalSalesSum,
        });
      }
    });

    return shifts;
  }, [employees, closures, sales, movements]);

  const pendingClosures = useMemo(() => {
    return closures.filter((c) => c.pendingCashCount === true);
  }, [closures]);

  const handleCloseShiftAdmin = async (shift: any) => {
    if (!canManageEmployees) {
      await showAlert(
        'Acceso Denegado',
        'No tienes permisos para cerrar turnos de otros empleados.',
        'error'
      );
      return;
    }

    const confirmed = await showConfirm(
      'Cierre Administrativo de Turno',
      `¿Estás seguro de que deseas cerrar administrativamente el turno de ${shift.employee.name}? El efectivo esperado (${shift.expectedCash.toFixed(2)}) se registrará como un estimado y quedará pendiente de conteo físico real.`,
      'Sí, Cerrar Turno',
      'Cancelar'
    );

    if (!confirmed) return;

    try {
      const d = new Date();
      const dateString = d.toISOString().split('T')[0];

      const closureData = {
        date: dateString,
        clerkName: shift.employee.name,
        employeeId: shift.employee.id,
        initialCash: 500,
        salesTotal: shift.totalSalesSum,
        expectedCash: shift.expectedCash,
        actualCash: shift.expectedCash, // marker
        difference: 0,
        status: 'closed' as const,
        createdAt: new Date().toISOString(),
        pendingCashCount: true,
        closedByAdminId: currentEmployee?.id || 'admin',
        closedByAdminName: currentEmployee?.name || 'Administrador',
      };

      await firestoreService.addDoc('closures', closureData);

      try {
        const auditData: Omit<AuditLogEntry, 'id'> = {
          action: 'close_shift_admin',
          description: `Cerró el turno de ${shift.employee.name} (pendiente de contar)`,
          employeeId: currentEmployee?.id || '',
          employeeName: currentEmployee?.name || 'Administrador',
          targetEmployeeId: shift.employee.id,
          createdAt: new Date().toISOString(),
        };
        await firestoreService.addDoc('auditLogs', auditData);
      } catch (auditErr) {
        console.error('Error recording audit log for close_shift_admin:', auditErr);
      }

      await showAlert(
        'Cierre Registrado',
        `El turno de ${shift.employee.name} ha sido cerrado. Recuerda registrar el conteo real en la sección "Cierres Pendientes de Contar" cuando cuentes el efectivo.`,
        'success'
      );
    } catch (err: any) {
      console.error('Error creating admin closure:', err);
      await showAlert('Error', 'No se pudo cerrar el turno: ' + err.message, 'error');
    }
  };

  const handleEditPendingClosure = (closure: Closure) => {
    setEditingClosure(closure);
    setActualCashInput(closure.expectedCash.toFixed(2));
  };

  const handleSavePendingClosure = async () => {
    if (!editingClosure) return;
    const val = parseFloat(actualCashInput);
    if (isNaN(val)) {
      await showAlert(
        'Valor Inválido',
        'Por favor, ingresa un número válido para el efectivo contado.',
        'warning'
      );
      return;
    }

    try {
      setSavingPendingClosure(true);
      const newActualCash = val;
      const newDifference = newActualCash - editingClosure.expectedCash;

      await firestoreService.updateDoc('closures', editingClosure.id, {
        actualCash: newActualCash,
        difference: newDifference,
        pendingCashCount: false,
        updatedAt: new Date().toISOString(),
      });

      await showAlert(
        'Arqueo Registrado',
        'El conteo físico de caja ha sido registrado exitosamente.',
        'success'
      );
      setEditingClosure(null);
      setActualCashInput('');
    } catch (err: any) {
      console.error('Error updating closure:', err);
      await showAlert('Error', 'No se pudo guardar el conteo: ' + err.message, 'error');
    } finally {
      setSavingPendingClosure(false);
    }
  };

  return {
    editingClosure,
    setEditingClosure,
    actualCashInput,
    setActualCashInput,
    savingPendingClosure,
    canManageEmployees,
    openShifts,
    pendingClosures,
    handleCloseShiftAdmin,
    handleEditPendingClosure,
    handleSavePendingClosure,
  };
}
