import { CartItem, Product, Sale, CreditNote } from '../types';
import { roundCents, roundUpToNearestFive } from './money';

export interface SaleTotals {
  subtotal: number;
  tax: number;
  total: number;
  rawTotal: number;
}

export function calculateSaleTotals(items: CartItem[]): SaleTotals {
  let totalSubtotal = 0;
  let totalTax = 0;
  let rawTotal = 0;

  items.forEach((item) => {
    const itemTotal = item.product.price * item.quantity;
    rawTotal += itemTotal;

    if (item.product.taxExempt) {
      totalSubtotal += itemTotal;
    } else {
      const itemSubtotal = roundCents(itemTotal / 1.18);
      const itemTax = roundCents(itemTotal - itemSubtotal);
      totalSubtotal += itemSubtotal;
      totalTax += itemTax;
    }
  });

  const finalTotal = roundUpToNearestFive(rawTotal);

  return {
    subtotal: roundCents(totalSubtotal),
    tax: roundCents(totalTax),
    total: finalTotal,
    rawTotal: roundCents(rawTotal),
  };
}

export interface BatchOperation {
  type: 'set' | 'update' | 'delete';
  collectionName: string;
  id: string;
  data?: any;
  merge?: boolean;
}

export interface BuildBatchResult {
  updatedProducts: Product[];
  updatedCreditNotes: CreditNote[];
  operations: BatchOperation[];
}

export function buildSaleBatchOperations({
  sale,
  products,
  creditNotes,
}: {
  sale: Sale;
  products: Product[];
  creditNotes: CreditNote[];
}): BuildBatchResult {
  // 1. Calculate stock deduction
  const updatedProducts = products.map((p) => {
    const itemsForProduct = sale.items.filter(
      (item) => item.product.id === p.id && item.product.category !== 'Genérico'
    );
    if (itemsForProduct.length > 0) {
      const totalUnitsDeducted = itemsForProduct.reduce((sum, item) => {
        const qty = item.selectedPackaging
          ? item.selectedPackaging.unitsPerPackage * item.quantity
          : item.quantity;
        return sum + qty;
      }, 0);
      return { ...p, stock: p.stock - totalUnitsDeducted };
    }
    return p;
  });

  // 2. Calculate credit note deductions
  let updatedCreditNotes = [...creditNotes];
  const creditNoteBatchOps: Array<{ id: string; remainingBalance: number; status: 'active' | 'depleted' | 'voided' }> = [];

  const isMixed = sale.paymentMethod === 'mixed' && Array.isArray(sale.paymentBreakdown);
  if (isMixed) {
    const cnRows = sale.paymentBreakdown!.filter(
      (b) => b.method === 'credit_note' && (b.amount || 0) > 0
    );
    for (const row of cnRows) {
      const applied = roundCents(Number(row.amount) || 0);
      const currentNote = updatedCreditNotes.find(
        (cn) =>
          (row.creditNoteId && cn.id === row.creditNoteId) ||
          (row.creditNoteCode && cn.code.toUpperCase() === row.creditNoteCode.toUpperCase())
      );

      if (currentNote) {
        const newRemaining = roundCents(Math.max(0, currentNote.remainingBalance - applied));
        const newStatus: 'active' | 'depleted' | 'voided' = newRemaining === 0 ? 'depleted' : 'active';

        const updatedNote: CreditNote = {
          ...currentNote,
          remainingBalance: newRemaining,
          status: newStatus,
        };

        updatedCreditNotes = updatedCreditNotes.map((cn) => (cn.id === currentNote.id ? updatedNote : cn));
        creditNoteBatchOps.push({
          id: currentNote.id,
          remainingBalance: newRemaining,
          status: newStatus,
        });
      }
    }
  }

  // 3. Build operations array
  const operations: BatchOperation[] = [];

  operations.push({
    type: 'set',
    collectionName: 'sales',
    id: sale.id,
    data: sale,
    merge: true,
  });

  for (const prod of updatedProducts) {
    const original = products.find((p) => p.id === prod.id);
    if (original && original.stock !== prod.stock) {
      operations.push({
        type: 'update',
        collectionName: 'products',
        id: prod.id,
        data: { stock: prod.stock },
      });
    }
  }

  for (const cnOp of creditNoteBatchOps) {
    operations.push({
      type: 'update',
      collectionName: 'creditNotes',
      id: cnOp.id,
      data: {
        remainingBalance: cnOp.remainingBalance,
        status: cnOp.status,
      },
    });
  }

  return {
    updatedProducts,
    updatedCreditNotes,
    operations,
  };
}

export async function processSaleBatch({
  sale,
  products,
  creditNotes,
  runBatchFn,
}: {
  sale: Sale;
  products: Product[];
  creditNotes: CreditNote[];
  runBatchFn: (operations: BatchOperation[]) => Promise<void>;
}): Promise<BuildBatchResult> {
  const result = buildSaleBatchOperations({ sale, products, creditNotes });
  await runBatchFn(result.operations);
  return result;
}
