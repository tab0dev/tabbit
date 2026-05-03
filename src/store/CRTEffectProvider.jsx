import { useState, useEffect, useContext, createContext } from 'react';

const CRTContext = createContext(null);

/**
 * Reads the persisted CRT effect preference from localStorage.
 * Defaults to enabled (true) if no preference has been stored.
 */
function resolveInitialCRT() {
  try {
    const stored = localStorage.getItem('crtEffect');
    if (stored !== null) return stored !== 'false';
  } catch { /* ignore */ }
  return false;
}

export function CRTEffectProvider({ children }) {
  const [crtEnabled, setCrtEnabled] = useState(resolveInitialCRT);

  // Reflect state as a data attribute on <html> so CSS can toggle all effects
  // instantly without any React re-render cascade through the tree.
  useEffect(() => {
    const root = document.documentElement;
    if (crtEnabled) {
      root.removeAttribute('data-crt-off');
    } else {
      root.setAttribute('data-crt-off', '');
    }
    try {
      localStorage.setItem('crtEffect', String(crtEnabled));
    } catch { /* ignore */ }
  }, [crtEnabled]);

  const toggleCRT = () => setCrtEnabled(v => !v);

  return (
    <CRTContext.Provider value={{ crtEnabled, toggleCRT }}>
      {children}
    </CRTContext.Provider>
  );
}

export function useCRTEffect() {
  const ctx = useContext(CRTContext);
  if (!ctx) throw new Error('useCRTEffect must be used within CRTEffectProvider');
  return ctx;
}
