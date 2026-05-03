import React, { useState, useEffect, useRef } from 'react';
import styles from './Dashboard.module.css';
import { useUpcomingTabs } from '../../store/TriageProvider';
import { useTriageActions } from '../../hooks/useTriageActions';
import Card from '../Card/Card';
import BookmarkPickerPanel from '../Overlay/BookmarkPickerPanel';
import TabGroupPickerPanel from '../Overlay/TabGroupPickerPanel';
import BottomStatusBar from './BottomStatusBar';
import { AnimatePresence } from 'framer-motion';
import { useTriage, Mode } from '../../store/TriageProvider';
import EmptyCard from './EmptyCard';
import TutorialOverlay from '../Tutorial/TutorialOverlay';
import { useTutorial } from '../../hooks/useTutorial';
import AutoTabGroupWizard from './AutoTabGroupWizard';
import DebuggingWarningModal from './DebuggingWarningModal';
import { useTabProcessing } from '../../store/TabProcessingProvider';
import { useTimer } from '../../store/TimerProvider';
import { usePicker } from '../../store/PickerProvider';

export default function TriageDashboard() {
  const { state, dispatch } = useTriage();
  const { excludeSuspendedTabs, mode: tabProcessingMode } = useTabProcessing();
  const { pause, resume } = useTimer();
  const { activePicker, setActivePicker } = usePicker();

  const tabFilterFn = excludeSuspendedTabs ? (tab) => !tab.isSuspended : null;
  const upcomingTabs = useUpcomingTabs(2, tabFilterFn);
  const actions = useTriageActions();
  const [showAutoGroupWizard, setShowAutoGroupWizard] = useState(false);
  const [isDebuggerWarningDismissed, setIsDebuggerWarningDismissed] = useState(() =>
    sessionStorage.getItem('debuggerWarningDismissed') === 'true'
  );
  const isComplete = state.mode === Mode.COMPLETE;
  const { isTutorialActive, completeTutorial, isReturningUser } = useTutorial();

  // dashboard-level activeView — lives here (not inside Card) so that
  // card remounts caused by filter changes don't reset the current view
  const [activeView, setActiveView] = useState('default');

  const handleNavigate = (view) => {
    setActiveView(view);
    if (view !== 'default') {
      pause();
    } else {
      dispatch({ type: 'START_REORDER' });
      dispatch({ type: 'REORDER_TABS', payload: tabProcessingMode });
      resume();
    }
  };

  // reset view to 'default' only when a tab is actually processed
  const prevIndexRef = useRef(state.currentIndex);
  useEffect(() => {
    if (state.currentIndex !== prevIndexRef.current) {
      prevIndexRef.current = state.currentIndex;
      setActiveView('default');
    }
  }, [state.currentIndex]);

  const handleDismissDebuggerWarning = () => {
    setIsDebuggerWarningDismissed(true);
    sessionStorage.setItem('debuggerWarningDismissed', 'true');
  };

  return (
    <div className={styles.dashboard}>
      {isTutorialActive && <TutorialOverlay onComplete={completeTutorial} isReturningUser={isReturningUser} />}
      {!isTutorialActive && !isDebuggerWarningDismissed && !showAutoGroupWizard && localStorage.getItem('suppressDebuggerWarning') !== 'true' && (
        <DebuggingWarningModal onDismiss={handleDismissDebuggerWarning} />
      )}
      <div className={styles.main}>
        <div className={styles.cardStack}>
          <AnimatePresence mode="popLayout">
            {isComplete ? (
              <EmptyCard />
            ) : (
              upcomingTabs.map((tab, index) => (
                <Card
                  key={tab.originalId || tab.id}
                  tab={tab}
                  isTop={index === 0}
                  index={index}
                  actions={actions}
                  activeView={activeView}
                  onNavigate={handleNavigate}
                />
              ))
            )}
          </AnimatePresence>
        </div>
        {showAutoGroupWizard && (
          <div className={styles.wizardOverlay}>
            <AutoTabGroupWizard onClose={() => setShowAutoGroupWizard(false)} />
          </div>
        )}
      </div>
      <div className={`${styles.bookmarks} ${styles.panel}`}>
        <BookmarkPickerPanel
          isActive={activePicker === 'bookmark'}
          onDeactivate={() => setActivePicker(null)}
        />
      </div>
      <div className={`${styles.tabGroups} ${styles.panel}`}>
        <TabGroupPickerPanel
          isActive={activePicker === 'group'}
          onDeactivate={() => setActivePicker(null)}
          onAutoGroup={() => { setActivePicker(null); setShowAutoGroupWizard(true); }}
        />
      </div>
      <div className={styles.hotkeys}>
        <BottomStatusBar actions={actions} />
      </div>
    </div>
  );
}
