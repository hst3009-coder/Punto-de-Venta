import React from 'react';
import { Coins } from 'lucide-react';
import { Customer, CustomerPayment } from '../../types';
import { getSaleTimestamp } from '../../lib/dates';

interface CreditosTabProps {
  totalOutstandingCredit: number;
  customers: Customer[];
  customerDebts: Record<string, number>;
  customerPayments: CustomerPayment[];
  onNavigateToCustomer: (customerId: string) => void;
}

interface DebtorRowProps {
  customer: Customer & { debt: number };
  onNavigateToCustomer: (customerId: string) => void;
}

const DebtorRow: React.FC<DebtorRowProps> = React.memo(({ customer: c, onNavigateToCustomer }) => {
  const limit = c.creditLimit || 5000;
  const progress = Math.min(100, (c.debt / limit) * 100);
  const isOverLimit = c.debt > limit;

  return (
    <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/30">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-sm font-black text-slate-800 block">{c.name}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Límite: RD$ {limit.toLocaleString()}
          </span>
        </div>
        <div className="text-right">
          <span className={`text-sm font-black font-mono block ${isOverLimit ? 'text-rose-600' : 'text-slate-800'}`}>
            RD$ {c.debt.toLocaleString()}
          </span>
          <button 
            onClick={() => onNavigateToCustomer(c.id)}
            className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline cursor-pointer"
          >
            Ver en Clientes
          </button>
        </div>
      </div>
      
      <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`absolute inset-y-0 left-0 transition-all duration-1000 rounded-full ${isOverLimit ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-indigo-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {isOverLimit && (
        <span className="text-[9px] font-black text-rose-500 uppercase mt-1 block">Excedió el límite por RD$ {(c.debt - limit).toLocaleString()}</span>
      )}
    </div>
  );
});

interface PaymentRowProps {
  payment: CustomerPayment;
  customerName: string;
}

const PaymentRow: React.FC<PaymentRowProps> = React.memo(({ payment: p, customerName }) => {
  return (
    <div className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <Coins className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-black text-slate-800 block">{customerName}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase">
            {new Date(p.date).toLocaleDateString()} • {p.employeeName || 'Cajero'}
          </span>
        </div>
      </div>
      <span className="text-sm font-black font-mono text-emerald-600">
        +RD$ {p.amount.toLocaleString()}
      </span>
    </div>
  );
});

export const CreditosTab: React.FC<CreditosTabProps> = ({
  totalOutstandingCredit,
  customers,
  customerDebts,
  customerPayments,
  onNavigateToCustomer
}) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header KPI Card */}
      <div className="bg-rose-600 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-[10px] sm:text-xs font-black uppercase opacity-80 tracking-widest mb-2">Cartera de Deuda Total</h3>
          <span className="text-2xl sm:text-4xl font-black font-mono">
            RD$ {totalOutstandingCredit.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
          </span>
          <p className="text-xs mt-4 opacity-70 font-medium">Saldo pendiente global de todos los clientes activos.</p>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Clientes */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
          <div className="mb-6">
            <h3 className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Ranking de Deudores</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Clientes con saldo pendiente actual</p>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {customers
              .map(c => ({ ...c, debt: customerDebts[c.id] || 0 }))
              .filter(c => c.debt > 0)
              .sort((a, b) => b.debt - a.debt)
              .map(c => (
                <DebtorRow key={c.id} customer={c} onNavigateToCustomer={onNavigateToCustomer} />
              ))}
          </div>
        </div>

        {/* Log de Abonos */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-xs">
          <div className="mb-6">
            <h3 className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Últimos Abonos Recibidos</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">Registro histórico global</p>
          </div>

          <div className="space-y-3">
            {customerPayments
              .sort((a, b) => getSaleTimestamp(b) - getSaleTimestamp(a))
              .slice(0, 10)
              .map(p => {
                const cust = customers.find(c => c.id === p.customerId);
                return (
                  <PaymentRow key={p.id} payment={p} customerName={cust?.name || 'Cliente'} />
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditosTab;
