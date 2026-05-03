import { useEffect } from 'react';
import { useMotionValue, useTransform, animate } from 'framer-motion';

export function useCardAnimation(tab, isTop, actions) {
  const x = useMotionValue(0);

  // Transform values for rotation and background colors
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const bgColor = useTransform(
    x,
    [-80, 0, 80],
    [
      "rgba(248, 113, 113, 0.2)", // More Intense Red
      "rgba(26, 29, 39, 0)",        // Neutral Transparent
      "rgba(57, 174, 100, 0.45)"   // More Intense Green
    ]
  );

  const keepOpacity = useTransform(x, [20, 100], [0, 1]);
  const closeOpacity = useTransform(x, [-20, -100], [0, 1]);
  const stampScale = useTransform(x, [-100, 0, 100], [1.1, 1, 1.1]);

  useEffect(() => {
    const handleSimulate = (e) => {
      if (!isTop || !tab || e.detail.tabId !== tab.id) return;
      const { triageAction } = e.detail;
      let targetX = 0;
      if (triageAction === 'keep' || triageAction === 'bookmark' || triageAction === 'group') {
        targetX = 250;
      } else if (triageAction === 'close') {
        targetX = -250;
      }
      if (targetX !== 0) {
        animate(x, targetX, { duration: 0.2 });
      }
    };
    document.addEventListener('simulate-swipe', handleSimulate);
    return () => document.removeEventListener('simulate-swipe', handleSimulate);
  }, [isTop, tab, x]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 150) {
      actions.keep(tab, true);
    } else if (info.offset.x < -150) {
      actions.close(tab, true);
    }
  };

  return {
    x,
    rotate,
    bgColor,
    keepOpacity,
    closeOpacity,
    stampScale,
    handleDragEnd
  };
}
