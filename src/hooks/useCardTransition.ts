import { useCallback } from 'react';
import { useTriage } from '../store/TriageProvider';
import { TriageReducerAction } from '../types';

/**
 * Returns a delayedDispatch function that broadcasts a swipe action
 * so Framer Motion can animate the card before the reducer removes it.
 */
export function useCardTransition(): { delayedDispatch: (action: TriageReducerAction) => void } {
  const { dispatch } = useTriage();

  const delayedDispatch = useCallback(
    (action: TriageReducerAction) => {
      if (action.type === 'PROCESS_TAB') {
        const e = new CustomEvent('simulate-swipe', {
          detail: { tabId: action.payload.tabId, triageAction: action.payload.triageAction },
        });
        document.dispatchEvent(e);
        // Wait for framer-motion to partially animate `x` and show stamps
        setTimeout(() => {
          dispatch(action);
        }, 150);
      } else {
        setTimeout(() => dispatch(action), 150);
      }
    },
    [dispatch],
  );

  return { delayedDispatch };
}
