export interface Closure {
  id: string;
  date: string;
  clerkName: string;
  employeeId?: string;
  initialCash: number;
  expectedCash: number;
  actualCash: number;
  salesTotal: number;
  difference: number;
  status: 'open' | 'closed';
  createdAt?: string;
  pendingCashCount?: boolean;
  closedByAdminId?: string;
  closedByAdminName?: string;
}

export interface EmployeePermissions {
  viewDashboard: boolean;
  manageEmployees: boolean;
  manageProducts: boolean;
  bulkEditProducts: boolean;
  importProducts: boolean;
  manageCustomers: boolean;
  registerPayments: boolean;
  registerExpenses?: boolean;
  closeShift: boolean;
  voidSales: boolean;
  accessDatabaseTools: boolean;
  editStoreSettings: boolean;
  managePayables?: boolean;
  manageReturns?: boolean;
  confirmBankDeposits?: boolean;
  exportFullBackup?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: 'admin' | 'cashier' | 'manager';
  email?: string;
  pinHash?: string;
  pinSalt?: string;
  active: boolean;
  createdAt?: string;
  permissions?: EmployeePermissions;
}
