import { describe, it, expect } from 'vitest';
import { increment } from 'firebase/firestore';
import { prepareOperationsForStorage, reconstructOperationsFromStorage, BatchOperation } from './saleProcessor';

describe('increment serialization in sale operations', () => {
  it('prepares operations with increment for storage and reconstructs them correctly without losing delta value', () => {
    const ops: BatchOperation[] = [
      {
        type: 'set',
        collectionName: 'sales',
        id: 'sale_123',
        data: { id: 'sale_123', total: 150 },
      },
      {
        type: 'update',
        collectionName: 'products',
        id: 'prod_1',
        data: { stock: increment(-5) },
      },
      {
        type: 'update',
        collectionName: 'products',
        id: 'prod_2',
        data: { stock: increment(12) },
      },
    ];

    // 1. Convert operations to storage-friendly format
    const prepared = prepareOperationsForStorage(ops);
    expect(prepared[1].data.stock).toEqual({ __incrementBy: -5 });
    expect(prepared[2].data.stock).toEqual({ __incrementBy: 12 });

    // 2. Simulate saving to and loading from localStorage (JSON serialization/deserialization)
    const json = JSON.stringify(prepared);
    const parsed = JSON.parse(json);

    // 3. Reconstruct operations back to real Firestore increment() FieldValues
    const reconstructed = reconstructOperationsFromStorage(parsed);
    expect(reconstructed[1].data.stock).toEqual(increment(-5));
    expect(reconstructed[2].data.stock).toEqual(increment(12));
    expect(reconstructed[0].data).toEqual({ id: 'sale_123', total: 150 });
  });
});
