import React, { createContext, useContext, useRef, useCallback } from 'react';

const MagicDotContext = createContext(null);

export function MagicDotProvider({ children }) {
  const targetsRef = useRef(new Map());
  const listenersRef = useRef(new Map());

  const registerTarget = useCallback((id) => {
    return (node) => {
      if (node) {
        targetsRef.current.set(id, node);
        const listeners = listenersRef.current.get(id);
        if (listeners) {
          listeners.forEach(cb => cb(node));
        }
      } else {
        targetsRef.current.delete(id);
      }
    };
  }, []);

  const getTarget = useCallback((id) => {
    return targetsRef.current.get(id);
  }, []);

  const subscribeTarget = useCallback((id, callback) => {
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
  }, []);

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
