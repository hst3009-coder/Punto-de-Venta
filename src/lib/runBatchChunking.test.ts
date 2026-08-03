import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firestoreService, BatchOperation } from './firebase';
import * as firestoreModule from 'firebase/firestore';

vi.mock('../../firebase-applet-config.json', () => ({
  default: {
    apiKey: 'mock-key',
    authDomain: 'mock.firebaseapp.com',
    projectId: 'mock-project',
  },
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn(),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/firestore', () => {
  return {
    initializeFirestore: vi.fn(),
    collection: vi.fn(),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    doc: vi.fn((_db, col, id) => ({ path: `${col}/${id}` })),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    onSnapshot: vi.fn(),
    query: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
    writeBatch: vi.fn(),
  };
});

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

describe('firestoreService.runBatch chunking', () => {
  let createdBatches: Array<{ set: any; update: any; delete: any; commit: any }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    createdBatches = [];

    vi.mocked(firestoreModule.writeBatch).mockImplementation(() => {
      const mockBatch = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      createdBatches.push(mockBatch);
      return mockBatch as any;
    });
  });

  it('handles empty operations array without error', async () => {
    await firestoreService.runBatch([]);
    expect(firestoreModule.writeBatch).not.toHaveBeenCalled();
  });

  it('runs a single batch when operations <= 450', async () => {
    const ops: BatchOperation[] = Array.from({ length: 100 }, (_, i) => ({
      type: 'set',
      collectionName: 'products',
      id: `p${i}`,
      data: { name: `Product ${i}` },
    }));

    await firestoreService.runBatch(ops);
    expect(createdBatches.length).toBe(1);
    expect(createdBatches[0].set).toHaveBeenCalledTimes(100);
    expect(createdBatches[0].commit).toHaveBeenCalledTimes(1);
  });

  it('splits > 450 operations into sequential 450-item chunks', async () => {

    const ops: BatchOperation[] = Array.from({ length: 1000 }, (_, i) => ({
      type: 'set',
      collectionName: 'products',
      id: `p${i}`,
      data: { name: `Product ${i}` },
    }));

    await firestoreService.runBatch(ops);
    // 1000 items -> 450 + 450 + 100 = 3 chunks
    expect(createdBatches.length).toBe(3);
    expect(createdBatches[0].set).toHaveBeenCalledTimes(450);
    expect(createdBatches[1].set).toHaveBeenCalledTimes(450);
    expect(createdBatches[2].set).toHaveBeenCalledTimes(100);
  });

  it('stops and reports completed chunks count if a subsequent chunk fails', async () => {
    const ops: BatchOperation[] = Array.from({ length: 1000 }, (_, i) => ({
      type: 'set',
      collectionName: 'products',
      id: `p${i}`,
      data: { name: `Product ${i}` },
    }));

    // Mock second batch commit failure
    vi.mocked(firestoreModule.writeBatch).mockImplementation(() => {
      const isSecond = createdBatches.length === 1;
      const mockBatch = {
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        commit: isSecond
          ? vi.fn().mockRejectedValue(new Error('Network disconnected'))
          : vi.fn().mockResolvedValue(undefined),
      };
      createdBatches.push(mockBatch);
      return mockBatch as any;
    });

    await expect(firestoreService.runBatch(ops)).rejects.toThrow(
      'Fallo en el lote 2 de 3 en la ejecución por lotes (1 lote(s) completado(s) previamente).'
    );
  });
});
