import { AccountPayable, PayablePayment } from '../types';

export function getPayableBalance(
  payableId: string,
  payables: AccountPayable[],
  payments: PayablePayment[]
): number {
  const payable = payables.find(p => p.id === payableId);
  if (!payable) return 0;
  
  const totalPaid = payments
    .filter(pay => pay.payableId === payableId)
    .reduce((sum, pay) => sum + pay.amount, 0);
    
  return Math.max(0, payable.totalAmount - totalPaid);
}

export function getTotalPayablesBalance(
  payables: AccountPayable[],
  payments: PayablePayment[]
): number {
  return payables.reduce((totalSum, payable) => {
    const bal = getPayableBalance(payable.id, payables, payments);
    if (payable.status !== 'paid' || bal > 0) {
      return totalSum + bal;
    }
    return totalSum;
  }, 0);
}
