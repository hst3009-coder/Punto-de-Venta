import { Sale, CustomerPayment, Customer, CustomerRefund, isMixedSale } from '../types';

/**
 * Esta función asume que toda venta con componente de crédito (pura o Mixta) tiene creditStatus: 'pending' asignado correctamente al crearse (ver saleProcessor.ts / App.tsx). Si ese campo no se asigna, la deuda correspondiente se excluirá silenciosamente de este cálculo.
 */
export function getCustomerDebt(
  customerId: string,
  sales: Sale[],
  payments: CustomerPayment[],
  customers: Customer[],
  refunds: CustomerRefund[] = []
): number {
  const customer = customers.find(c => c.id === customerId);
  const openingDebt = customer?.openingDebt || 0;

  const creditSalesSum = sales
    .filter(s => s.customerId === customerId && s.creditStatus === 'pending')
    .reduce((acc, s) => {
      if (isMixedSale(s)) {
        const creditPart = s.paymentBreakdown
          .filter(b => b.method === 'credit')
          .reduce((sum, b) => sum + b.amount, 0);
        return acc + creditPart;
      } else if (s.isCredit || s.paymentMethod === 'credit') {
        return acc + s.total;
      }
      return acc;
    }, 0);

  const paymentsSum = payments
    .filter(p => p.customerId === customerId)
    .reduce((acc, p) => acc + p.amount, 0);

  const creditRefundsSum = refunds
    .filter(r => r.customerId === customerId && r.method === 'credit_reduction')
    .reduce((acc, r) => acc + r.amount, 0);

  return Math.max(0, openingDebt + creditSalesSum - paymentsSum - creditRefundsSum);
}
