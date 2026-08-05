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

      // Support combination shortcuts like 'alt+1' or 'Alt+1' or 'alt+Digit1'
      if (e.altKey) {
        const keyLower = e.key ? e.key.toLowerCase() : '';
        const codeLower = e.code ? e.code.toLowerCase() : '';
        const digitMatch = e.code ? e.code.replace('Digit', '').replace('Numpad', '') : '';

        handler =
          currentShortcuts[`alt+${e.key}`] ||
          currentShortcuts[`Alt+${e.key}`] ||
          currentShortcuts[`alt+${keyLower}`] ||
          currentShortcuts[`Alt+${keyLower}`] ||
          currentShortcuts[`alt+${e.code}`] ||
          currentShortcuts[`Alt+${e.code}`] ||
          currentShortcuts[`alt+${codeLower}`] ||
          currentShortcuts[`Alt+${codeLower}`] ||
          currentShortcuts[`alt+${digitMatch}`] ||
          currentShortcuts[`Alt+${digitMatch}`];
      }

      // Support combination shortcuts like 'ctrl+k' or 'Control+k'
      if (!handler && e.ctrlKey) {
        const keyLower = e.key ? e.key.toLowerCase() : '';
        handler =
          currentShortcuts[`ctrl+${keyLower}`] ||
          currentShortcuts[`Control+${keyLower}`] ||
          currentShortcuts[`ctrl+${e.key}`] ||
          currentShortcuts[`Control+${e.key}`];
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
