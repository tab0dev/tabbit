import { useState, useEffect, useRef } from 'react';
import { useTriage, Mode } from '../../../store/TriageProvider';

export function useCardNavigation(tab, isTop, handleNavigate) {
  const { state } = useTriage();
  const [menuRect, setMenuRect] = useState(null);

  const handleMenuClick = (e) => {
    e.stopPropagation();
    if (menuRect) {
      setMenuRect(null);
    } else {
      setMenuRect(e.currentTarget.getBoundingClientRect());
    }
  };

  const handleCardClick = async (e) => {
    if (e.defaultPrevented) return;
    if (!isTop) return; // Only allow clicking the top card

    if (chrome && chrome.tabs) {
      try {
        await chrome.windows.update(tab.windowId, { focused: true });
        await chrome.tabs.update(tab.id, { active: true });
      } catch (err) {
        console.error('Failed to switch to tab:', err);
      }
    }
  };

  const closeMenu = () => setMenuRect(null);

  const modeRef = useRef(state.mode);
  useEffect(() => {
    modeRef.current = state.mode;
  }, [state.mode]);

  // Safety resume is now handled in TriageDashboard's handleNavigate.
  // keep cleanup here to ensure no stale state if this card
  // unmounts while in an alternate view (TriageDashboard owns the reset).

  return {
    menuRect,
    handleMenuClick,
    handleCardClick,
    closeMenu
  };
}
