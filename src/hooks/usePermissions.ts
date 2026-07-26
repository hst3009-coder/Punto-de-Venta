import { useMemo } from 'react';
import { Employee, EmployeePermissions } from '../types';
import { getEmployeePermissions } from '../lib/permissions';

export function usePermissions(currentEmployee: Employee | null): EmployeePermissions {
  return useMemo(() => getEmployeePermissions(currentEmployee), [currentEmployee]);
}
