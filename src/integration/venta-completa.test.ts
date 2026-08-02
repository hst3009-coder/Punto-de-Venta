import { describe, it, expect, vi } from 'vitest';
import { increment } from 'firebase/firestore';
import { CartItem, Product, Sale, CreditNote } from '../types';
import { calculateSaleTotals, buildSaleBatchOperations, processSaleBatch } from '../lib/saleProcessor';

describe('Integration Test: Flujo Completo de Venta Compleja', () => {
  it('procesa correctamente una venta mixta (Efectivo + Nota de Crédito) con productos gravados y exentos', async () => {
    // 1. Configuración de Productos (Gravado con ITBIS 18% y Exento 0%)
    const productTaxable: Product = {
      id: 'prod_taxable_1',
      name: 'Producto Gravado ITBIS 18%',
      price: 118,
      cost: 70,
      stock: 50,
      taxExempt: false,
      category: 'General',
      color: 'bg-indigo-500',
      emoji: '📦',
    };

    const productExempt: Product = {
      id: 'prod_exempt_1',
      name: 'Producto Exento ITBIS 0%',
      price: 100,
      cost: 60,
      stock: 30,
      taxExempt: true,
      category: 'Víveres',
      color: 'bg-emerald-500',
      emoji: '🥦',
    };

    const products: Product[] = [productTaxable, productExempt];

    // 2. Configuración de Nota de Crédito previa
    const initialCreditNote: CreditNote = {
      id: 'cn_1001',
      code: 'NC-1001',
      originalAmount: 200,
      remainingBalance: 200,
      createdAt: '2026-08-01T10:00:00.000Z',
      status: 'active',
    };

    const creditNotes: CreditNote[] = [initialCreditNote];

    // 3. Ítems del Carrito (2x Gravado + 3x Exento)
    const cartItems: CartItem[] = [
      {
        product: productTaxable,
        quantity: 2, // 2 * 118 = 236. Subtotal = 200, Tax = 36
      },
      {
        product: productExempt,
        quantity: 3, // 3 * 100 = 300. Subtotal = 300, Tax = 0
      },
    ];

    // 4. Verificación de Cálculos Matemáticos (Subtotal, ITBIS, Total)
    const totals = calculateSaleTotals(cartItems);

    expect(totals.rawTotal).toBe(536); // 236 + 300 = 536
    expect(totals.subtotal).toBe(500); // 200 + 300 = 500
    expect(totals.tax).toBe(36);       // 36 + 0 = 36
    expect(totals.total).toBe(536);     // Redondeo a múltiplos de 5 si aplica

    // 5. Estructura del Pago Mixto (Efectivo + Nota de Crédito)
    const creditNoteAppliedAmount = 200;
    const cashPaidAmount = 400;
    const totalPaid = creditNoteAppliedAmount + cashPaidAmount; // 600
    const expectedChange = totalPaid - totals.total; // 600 - 536 = 64

    expect(expectedChange).toBe(64);

    const saleData: Sale = {
      id: 'sale_complex_999',
      ticketNumber: 'TKT-999888',
      items: cartItems,
      total: totals.total,
      paymentMethod: 'mixed',
      paymentBreakdown: [
        {
          id: 'pb_1',
          method: 'credit_note',
          amount: creditNoteAppliedAmount,
          creditNoteCode: 'NC-1001',
          creditNoteId: 'cn_1001',
        },
        {
          id: 'pb_2',
          method: 'cash',
          amount: cashPaidAmount,
        },
      ],
      amountPaid: totalPaid,
      change: expectedChange,
      date: '2026-08-02 14:30:00',
      createdAt: '2026-08-02T14:30:00.000Z',
      soldBy: { id: 'emp_1', name: 'Cajero Pruebas' },
    };

    // Mock de la función de ejecución Batch de Firestore
    const runBatchMock = vi.fn().mockResolvedValue(undefined);

    // 6. Ejecución del Procesamiento en Lote (Batch)
    const result = await processSaleBatch({
      sale: saleData,
      products,
      creditNotes,
      runBatchFn: runBatchMock,
    });

    // 7. Verificación 1: Deducción exacta de Inventario/Stock
    const updatedTaxable = result.updatedProducts.find((p) => p.id === 'prod_taxable_1');
    const updatedExempt = result.updatedProducts.find((p) => p.id === 'prod_exempt_1');

    expect(updatedTaxable?.stock).toBe(48); // 50 - 2 = 48
    expect(updatedExempt?.stock).toBe(27);  // 30 - 3 = 27

    // 8. Verificación 2: Reducción de saldo y estado de Nota de Crédito
    const updatedNote = result.updatedCreditNotes.find((cn) => cn.id === 'cn_1001');

    expect(updatedNote?.remainingBalance).toBe(0); // 200 - 200 = 0
    expect(updatedNote?.status).toBe('depleted');  // Totalmente agotada

    // 9. Verificación 3: Generación correcta de operaciones Batch de Firestore
    expect(runBatchMock).toHaveBeenCalledOnce();
    const ops = result.operations;

    // Operación 1: Guardar venta
    const saleOp = ops.find((op) => op.collectionName === 'sales' && op.id === 'sale_complex_999');
    expect(saleOp).toBeDefined();
    expect(saleOp?.type).toBe('set');
    expect(saleOp?.data.total).toBe(536);
    expect(saleOp?.data.change).toBe(64);
    expect(saleOp?.data.paymentMethod).toBe('mixed');

    // Operación 2: Actualizar stock de Producto Gravado
    const prodTaxableOp = ops.find((op) => op.collectionName === 'products' && op.id === 'prod_taxable_1');
    expect(prodTaxableOp).toBeDefined();
    expect(prodTaxableOp?.type).toBe('update');
    expect(prodTaxableOp?.data.stock).toEqual(increment(-2));

    // Operación 3: Actualizar stock de Producto Exento
    const prodExemptOp = ops.find((op) => op.collectionName === 'products' && op.id === 'prod_exempt_1');
    expect(prodExemptOp).toBeDefined();
    expect(prodExemptOp?.type).toBe('update');
    expect(prodExemptOp?.data.stock).toEqual(increment(-3));

    // Operación 4: Actualizar saldo de Nota de Crédito
    const cnOp = ops.find((op) => op.collectionName === 'creditNotes' && op.id === 'cn_1001');
    expect(cnOp).toBeDefined();
    expect(cnOp?.type).toBe('update');
    expect(cnOp?.data.remainingBalance).toBe(0);
    expect(cnOp?.data.status).toBe('depleted');
  });
});
