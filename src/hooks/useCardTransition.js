import { useCallback } from 'react';
import { useTriage } from '../store/TriageProvider';

/**
 * Returns a delayedDispatch function that broadcasts a swipe action
 * so Framer Motion can animate the card before the reducer removes it.
 */
export function useCardTransition() {
  const { dispatch } = useTriage();

  const delayedDispatch = useCallback((action) => {
    if (action.type === 'PROCESS_TAB') {
      const e = new CustomEvent('simulate-swipe', {
        detail: { tabId: action.payload.tabId, triageAction: action.payload.triageAction }
      });
      document.dispatchEvent(e);
      // Wait for framer-motion to partially animate `x` and show stamps
      setTimeout(() => {
        dispatch(action);
      }, 150);
    } else {
      setTimeout(() => dispatch(action), 150);
    }
  }, [dispatch]);

  return { delayedDispatch };
}
