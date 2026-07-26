import React from 'react';
import { Product, SupplierReturn, Employee, SupplierCreditNote, AccountPayable } from '../../types';

const ReturnsView = React.lazy(() => import('../ReturnsView'));

interface DevolucionesTabProps {
  products: Product[];
  supplierReturns: SupplierReturn[];
  currentEmployee: Employee | null;
  supplierCreditNotes: SupplierCreditNote[];
  payables: AccountPayable[];
}

export const DevolucionesTab: React.FC<DevolucionesTabProps> = (props) => {
  return (
    <div className="max-w-7xl mx-auto h-full min-h-[500px]">
      <React.Suspense fallback={
        <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500 font-bold">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Cargando Devoluciones...</span>
        </div>
      }>
        <ReturnsView {...props} />
      </React.Suspense>
    </div>
  );
};

export default DevolucionesTab;
