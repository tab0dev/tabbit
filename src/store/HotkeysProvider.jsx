import React, { createContext, useContext, useState, useEffect } from 'react';

const defaultHotkeys = {
  keep: 'ARROWRIGHT',
  close: 'ARROWLEFT',
  bookmark: 'ARROWUP',
  group: 'ARROWDOWN',
  back: 'J',
  undo: 'Z'
};

export const HotkeysContext = createContext();

export function HotkeysProvider({ children }) {
  const [hotkeys, setHotkeys] = useState(defaultHotkeys);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tabZeroHotkeys');
      if (saved) {
        setHotkeys({ ...defaultHotkeys, ...JSON.parse(saved) });
      }
    } catch (e) {
      console.error("Failed to load hotkeys:", e);
    }
  }, []);

  const updateHotkey = (action, key) => {
    const newHotkeys = { ...hotkeys, [action]: key.toUpperCase() };
    setHotkeys(newHotkeys);
    localStorage.setItem('tabZeroHotkeys', JSON.stringify(newHotkeys));
  };

  return (
    <HotkeysContext.Provider value={{ hotkeys, updateHotkey }}>
      {children}
    </HotkeysContext.Provider>
  );
}

export function useHotkeys() {
  return useContext(HotkeysContext);
}
