import React from 'react';
import { motion } from 'framer-motion';
import styles from './Card.module.css';
import { useTriage } from '../../store/TriageProvider';
import { useProgress } from '../../hooks/useProgress';
import { useTimer } from '../../store/TimerProvider';
import { formatTime, extractDomain } from '../../utils/formatters';
import { useTabProcessing } from '../../store/TabProcessingProvider';

// Modular Components
import CardFooter from './CardFooter';
import CardViewSwitcher from './CardViewSwitcher';
import CardActionPortal from './CardActionPortal';

// Custom Hooks
import { useCardAnimation } from './hooks/useCardAnimation';
import { useCardNavigation } from './hooks/useCardNavigation';
import { useTabGroup } from './hooks/useTabGroup';

const cardVariants = {
  top: {
    scale: 1,
    y: 0,
    opacity: 1,
  },
  next: {
    scale: 0.96,
    y: 14,
    opacity: 0.95,
  },
  back: {
    scale: 0.92,
    y: 20,
    opacity: 0.9,
  },
};

export default function Card({ tab, isTop, index, actions, activeView, onNavigate }) {
  const { state } = useTriage();
  const { elapsed } = useTimer();
  const { excludeSuspendedTabs } = useTabProcessing();
  const tabFilterFn = excludeSuspendedTabs ? (t) => !t.isSuspended : null;
  const { progressPercent, totalTabs, processedTabs } = useProgress(tabFilterFn);

  const {
    x,
    rotate,
    bgColor,
    keepOpacity,
    closeOpacity,
    stampScale,
    handleDragEnd
  } = useCardAnimation(tab, isTop, actions);

  const {
    menuRect,
    handleMenuClick,
    handleCardClick,
    closeMenu
  } = useCardNavigation(tab, isTop, onNavigate);

  const { tabGroup, groupColor } = useTabGroup(tab);

  if (!tab) return null;

  const domain = extractDomain(tab.url);
  const isNext = !isTop && index === 1;

  return (
    <motion.div
      className={styles.card}
      style={{
        x,
        rotate,
        zIndex: 100 - index,
      }}
      layout
      drag={isTop && activeView === 'default' ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      variants={cardVariants}
      initial={isTop ? 'top' : isNext ? 'next' : 'back'}
      animate={isTop ? 'top' : isNext ? 'next' : 'back'}
      exit={{
        x: x.get() > 0 ? 1000 : -1000,
        opacity: 0,
        transition: { duration: 0.3 }
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <CardViewSwitcher
        activeView={activeView}
        isReordering={state.isReordering}
        tab={tab}
        isTop={isTop}
        bgColor={bgColor}
        domain={domain}
        tabGroup={tabGroup}
        groupColor={groupColor}
        handleNavigate={onNavigate}
        handleCardClick={handleCardClick}
        keepOpacity={keepOpacity}
        closeOpacity={closeOpacity}
        stampScale={stampScale}
      />

      <CardFooter 
        progressPercent={progressPercent}
        elapsed={elapsed}
        totalTabs={totalTabs}
        processedTabs={processedTabs}
        activeView={activeView}
        handleNavigate={onNavigate}
        handleMenuClick={handleMenuClick}
        menuRect={menuRect}
      />

      <CardActionPortal 
        menuRect={menuRect} 
        onNavigate={onNavigate} 
        onClose={closeMenu} 
      />
    </motion.div>
  );
}
