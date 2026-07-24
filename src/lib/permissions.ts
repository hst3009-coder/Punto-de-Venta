import { Employee, EmployeePermissions } from '../types';

export const ROLE_DEFAULT_PERMISSIONS: Record<'admin' | 'manager' | 'cashier', EmployeePermissions> = {
  admin: {
    viewDashboard: true,
    manageEmployees: true,
    manageProducts: true,
    bulkEditProducts: true,
    importProducts: true,
    manageCustomers: true,
    registerPayments: true,
    registerExpenses: true,
    closeShift: true,
    voidSales: true,
    accessDatabaseTools: true,
    editStoreSettings: true,
    managePayables: true,
    manageReturns: true,
    confirmBankDeposits: true,
    exportFullBackup: true,
  },
  manager: {
    viewDashboard: true,
    manageEmployees: false,
    manageProducts: true,
    bulkEditProducts: true,
    importProducts: true,
    manageCustomers: true,
    registerPayments: true,
    registerExpenses: true,
    closeShift: true,
    voidSales: true,
    accessDatabaseTools: false,
    editStoreSettings: false,
    managePayables: true,
    manageReturns: true,
    confirmBankDeposits: true,
    exportFullBackup: false,
  },
  cashier: {
    viewDashboard: false,
    manageEmployees: false,
    manageProducts: false,
    bulkEditProducts: false,
    importProducts: false,
    manageCustomers: true,
    registerPayments: true,
    registerExpenses: false,
    closeShift: true,
    voidSales: false,
    accessDatabaseTools: false,
    editStoreSettings: false,
    managePayables: false,
    manageReturns: false,
    confirmBankDeposits: false,
    exportFullBackup: false,
  },
};

export function getEmployeePermissions(employee: Employee | null): EmployeePermissions {
  if (!employee) {
    // Return all false if no employee
    return {
      viewDashboard: false,
      manageEmployees: false,
      manageProducts: false,
      bulkEditProducts: false,
      importProducts: false,
      manageCustomers: false,
      registerPayments: false,
      registerExpenses: false,
      closeShift: false,
      voidSales: false,
      accessDatabaseTools: false,
      editStoreSettings: false,
      managePayables: false,
      manageReturns: false,
      confirmBankDeposits: false,
      exportFullBackup: false,
    };
  }

  if (employee.permissions) {
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[employee.role] || ROLE_DEFAULT_PERMISSIONS.cashier;
    return { ...roleDefaults, ...employee.permissions };
  }

  return ROLE_DEFAULT_PERMISSIONS[employee.role] || ROLE_DEFAULT_PERMISSIONS.cashier;
}
