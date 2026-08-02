import { useEffect, useRef } from 'react';

export type ShortcutHandler = (e: KeyboardEvent) => void;

export interface KeyboardShortcutsMap {
  [key: string]: ShortcutHandler;
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  /** Optional fallback handler triggered if no specific key matched in shortcuts map */
  onUnhandledKey?: (e: KeyboardEvent) => void;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcutsMap,
  enabledOrOptions: boolean | UseKeyboardShortcutsOptions = true
) {
  const enabled =
    typeof enabledOrOptions === 'boolean'
      ? enabledOrOptions
      : enabledOrOptions.enabled ?? true;
  const onUnhandledKey =
    typeof enabledOrOptions === 'object'
      ? enabledOrOptions.onUnhandledKey
      : undefined;

  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const onUnhandledKeyRef = useRef(onUnhandledKey);
  onUnhandledKeyRef.current = onUnhandledKey;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;

      const currentShortcuts = shortcutsRef.current;
      const currentUnhandledHandler = onUnhandledKeyRef.current;

      let handler: ShortcutHandler | undefined;

      // Support combination shortcuts like 'ctrl+k' or 'Control+k'
      if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        handler =
          currentShortcuts['ctrl+k'] ||
          currentShortcuts['Control+k'] ||
          currentShortcuts['ctrl+K'];
      }

      if (!handler) {
        handler = currentShortcuts[e.key] || currentShortcuts[e.code];
      }

      // Automatically preventDefault for function keys F1-F12 if handled
      if (/^F([1-9]|1[0-2])$/.test(e.key) && handler) {
        e.preventDefault();
      }

      if (handler) {
        handler(e);
      } else if (currentUnhandledHandler) {
        currentUnhandledHandler(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
