import React from 'react';
import { Movement, Employee, DashboardConfig, PurchaseOrder, PurchaseReceipt, AccountPayable, PayablePayment, SupplierReturn } from '../../types';

const ExpensesView = React.lazy(() => import('../ExpensesView'));

interface EgresosTabProps {
  movements: Movement[];
  currentEmployee: Employee | null;
  clerkName: string;
  dashboardConfig: DashboardConfig;
  employees: Employee[];
  purchaseOrders?: PurchaseOrder[];
  purchaseReceipts?: PurchaseReceipt[];
  accountsPayable?: AccountPayable[];
  payablePayments?: PayablePayment[];
  supplierReturns?: SupplierReturn[];
}

export const EgresosTab: React.FC<EgresosTabProps> = (props) => {
  return (
    <div className="max-w-7xl mx-auto h-full min-h-[500px]">
      <React.Suspense fallback={
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 font-bold">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Cargando Egresos...</span>
        </div>
      }>
        <ExpensesView {...props} />
      </React.Suspense>
    </div>
  );
};

export default EgresosTab;
