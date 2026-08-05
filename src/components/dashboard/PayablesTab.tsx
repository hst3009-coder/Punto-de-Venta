import React from 'react';
import { Product, AccountPayable, PayablePayment, Employee, DashboardConfig, SupplierCreditNote, PurchaseOrder, PurchaseReceipt, Movement, SupplierReturn } from '../../types';

const PayablesView = React.lazy(() => import('../PayablesView'));

interface PayablesTabProps {
  products: Product[];
  payables: AccountPayable[];
  payablePayments: PayablePayment[];
  currentEmployee: Employee | null;
  dashboardConfig: DashboardConfig;
  supplierCreditNotes: SupplierCreditNote[];
  purchaseOrders?: PurchaseOrder[];
  purchaseReceipts?: PurchaseReceipt[];
  movements?: Movement[];
  supplierReturns?: SupplierReturn[];
}

export const PayablesTab: React.FC<PayablesTabProps> = (props) => {
  return (
    <div className="max-w-7xl mx-auto h-full min-h-[500px]">
      <React.Suspense fallback={
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 font-bold">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Cargando Cuentas por Pagar...</span>
        </div>
      }>
        <PayablesView {...props} />
      </React.Suspense>
    </div>
  );
};

export default PayablesTab;
