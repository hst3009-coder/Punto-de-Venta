import { useEffect, useRef } from 'react';

export function useDebouncedLocalStorageWrite<T>(
  key: string,
  value: T,
  delayMs = 800,
  transform?: (val: T) => any
) {
  const transformRef = useRef(transform);
  transformRef.current = transform;

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const dataToSave = transformRef.current ? transformRef.current(value) : value;
        localStorage.setItem(key, JSON.stringify(dataToSave));
      } catch (error) {
        console.error(`Error saving key "${key}" to localStorage:`, error);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [key, value, delayMs]);
}
