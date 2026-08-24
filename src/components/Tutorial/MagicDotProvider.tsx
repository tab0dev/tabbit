import React, { createContext, useContext, useRef, useCallback } from 'react';

export interface MagicDotContextType {
  registerTarget: (id: string) => (node: HTMLElement | null) => void;
  getTarget: (id: string) => HTMLElement | undefined;
  subscribeTarget: (id: string, callback: (node: HTMLElement | null) => void) => () => void;
}

const MagicDotContext = createContext<MagicDotContextType | null>(null);

export interface MagicDotProviderProps {
  children: React.ReactNode;
}

export function MagicDotProvider({ children }: MagicDotProviderProps) {
  const targetsRef = useRef(new Map());
  const listenersRef = useRef(new Map());

  const registerTarget = useCallback((id: string) => {
    return (node: HTMLElement | null) => {
      if (node) {
        targetsRef.current.set(id, node);
        const listeners = listenersRef.current.get(id);
        if (listeners) {
          listeners.forEach((cb: (node: HTMLElement | null) => void) => cb(node));
        }
      } else {
        targetsRef.current.delete(id);
      }
    };
  }, []);

  const getTarget = useCallback((id: string) => {
    return targetsRef.current.get(id);
  }, []);

  const subscribeTarget = useCallback(
    (id: string, callback: (node: HTMLElement | null) => void) => {
      let listeners = listenersRef.current.get(id);
      if (!listeners) {
        listeners = new Set();
        listenersRef.current.set(id, listeners);
      }
      listeners.add(callback);

      const existing = targetsRef.current.get(id);
      if (existing) {
        callback(existing);
      }

      return () => {
        const l = listenersRef.current.get(id);
        if (l) {
          l.delete(callback);
          if (l.size === 0) listenersRef.current.delete(id);
        }
      };
    },
    [],
  );

  return (
    <MagicDotContext.Provider value={{ registerTarget, getTarget, subscribeTarget }}>
      {children}
    </MagicDotContext.Provider>
  );
}

export function useMagicDot() {
  const context = useContext(MagicDotContext);
  if (!context) {
    throw new Error('useMagicDot must be used within a MagicDotProvider');
  }
  return context;
}
