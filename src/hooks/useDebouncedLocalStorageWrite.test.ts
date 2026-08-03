import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncedLocalStorageWrite } from './useDebouncedLocalStorageWrite';

const storageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => (key in storageStore ? storageStore[key] : null),
  setItem: (key: string, val: string) => {
    storageStore[key] = val;
  },
  removeItem: (key: string) => {
    delete storageStore[key];
  },
  clear: () => {
    for (const k of Object.keys(storageStore)) {
      delete storageStore[k];
    }
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

vi.mock('react', () => {
  return {
    useRef: (initial: any) => ({ current: initial }),
    useEffect: (cb: () => void | (() => void)) => {
      cb();
    },
  };
});

describe('useDebouncedLocalStorageWrite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets timer to write to localStorage after delay', () => {
    useDebouncedLocalStorageWrite('my_key', { data: 123 }, 400);

    expect(localStorage.getItem('my_key')).toBeNull();

    vi.advanceTimersByTime(400);

    expect(localStorage.getItem('my_key')).toBe(JSON.stringify({ data: 123 }));
  });

  it('uses transform function if provided', () => {
    useDebouncedLocalStorageWrite(
      'notes_key',
      [{ id: '1', code: 'secret', name: 'Note' }],
      400,
      (notes: any[]) => notes.map((n) => ({ ...n, code: undefined }))
    );

    vi.advanceTimersByTime(400);

    expect(localStorage.getItem('notes_key')).toBe(
      JSON.stringify([{ id: '1', code: undefined, name: 'Note' }])
    );
  });
});
