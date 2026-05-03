import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// centralizes picker panel state and keyboard↔panel communication.
// replaces the old pickerRegistry singleton + custom DOM events pattern
// with standard react context, keeping the data flow visible in devtools.

const PickerContext = createContext(null);

export function PickerProvider({ children }) {
  const [activePicker, setActivePicker] = useState(null); // null | 'bookmark' | 'group'

  // event listeners registered by each picker panel.
  // keyed by pickerType → { onNavigate, onConfirm, onDeactivate }
  const listenersRef = useRef({});

  // register a picker panel's event handlers.
  // called by each picker panel on mount, returns unregister fn.
  const registerPicker = useCallback((type, handlers) => {
    listenersRef.current[type] = handlers;
    return () => { delete listenersRef.current[type]; };
  }, []);

  // dispatch a navigation event to the active picker
  const navigatePicker = useCallback((direction) => {
    const type = activePicker;
    if (!type) return;
    listenersRef.current[type]?.onNavigate?.(direction);
  }, [activePicker]);

  // dispatch a confirm event to the active picker
  const confirmPicker = useCallback(() => {
    const type = activePicker;
    if (!type) return;
    listenersRef.current[type]?.onConfirm?.();
  }, [activePicker]);

  // deactivate the current picker, notifying it first
  const deactivatePicker = useCallback(() => {
    const type = activePicker;
    if (!type) return;
    listenersRef.current[type]?.onDeactivate?.();
    setActivePicker(null);
  }, [activePicker]);

  return (
    <PickerContext.Provider value={{
      activePicker,
      setActivePicker,
      registerPicker,
      navigatePicker,
      confirmPicker,
      deactivatePicker,
    }}>
      {children}
    </PickerContext.Provider>
  );
}

export function usePicker() {
  const ctx = useContext(PickerContext);
  if (!ctx) throw new Error('usePicker must be used within PickerProvider');
  return ctx;
}
