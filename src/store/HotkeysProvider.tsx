import React, { createContext, useContext, useState, useEffect } from 'react';

const defaultHotkeys = {
  keep: 'ARROWRIGHT',
  close: 'ARROWLEFT',
  bookmark: 'ARROWUP',
  group: 'ARROWDOWN',
  back: 'J',
  undo: 'Z',
  openTab: ' ',
};

export interface HotkeysMap {
  keep: string;
  close: string;
  bookmark: string;
  group: string;
  back: string;
  undo: string;
  openTab: string;
}

export interface HotkeysContextValue {
  hotkeys: HotkeysMap;
  updateHotkey: (action: keyof HotkeysMap, key: string) => void;
}

export const HotkeysContext = createContext<HotkeysContextValue | null>(null);

export function HotkeysProvider({ children }: { children: React.ReactNode }) {
  const [hotkeys, setHotkeys] = useState<HotkeysMap>(defaultHotkeys);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tabZeroHotkeys');
      if (saved) {
        setHotkeys({ ...defaultHotkeys, ...JSON.parse(saved) });
      }
    } catch (e) {
      console.error('Failed to load hotkeys:', e);
    }
  }, []);

  const updateHotkey = (action: keyof HotkeysMap, key: string) => {
    const newHotkeys = { ...hotkeys, [action]: key.toUpperCase() };
    setHotkeys(newHotkeys);
    localStorage.setItem('tabZeroHotkeys', JSON.stringify(newHotkeys));
  };

  return (
    <HotkeysContext.Provider value={{ hotkeys, updateHotkey }}>{children}</HotkeysContext.Provider>
  );
}

export function useHotkeys(): HotkeysContextValue {
  const ctx = useContext(HotkeysContext);
  if (!ctx) throw new Error('useHotkeys must be used within HotkeysProvider');
  return ctx;
}
