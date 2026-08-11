import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import styles from './Dashboard.module.css';
import { useUpcomingTabs } from '../../store/TriageProvider';
import { useTriageActions } from '../../hooks/useTriageActions';
import Card from '../Card/Card';
import BookmarkPickerPanel from './BookmarkPickerPanel';
import TabGroupPickerPanel from './TabGroupPickerPanel';
import BottomStatusBar from './BottomStatusBar';
import { AnimatePresence, motion } from 'framer-motion';
import { useTriage, Mode } from '../../store/TriageProvider';
import { useTheme } from '../../store/ThemeProvider';
import EmptyCard from './EmptyCard';
import QuickStartTutorialModal from '../Modals/QuickStartTutorialModal';
import { useTutorial } from '../../hooks/useTutorial';
import ManualTabGroupWizard from '../Tools/TabGroupWizard/ManualTabGroupWizard';
import DebuggingWarningModal from '../Modals/DebuggingWarningModal';
import { useTabProcessing } from '../../store/TabProcessingProvider';
import { useTimer } from '../../store/TimerProvider';
import { usePicker } from '../../store/PickerProvider';

export default function TriageDashboard() {
  const { state, dispatch } = useTriage();
  const { reduceMotion } = useTheme();
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
  const {
    state: { isActive: isTutorialActive, isReturningUser },
    actions: { complete: completeTutorial }
  } = useTutorial();

  // dashboard-level activeView — lives here (not inside Card) so that
  // card remounts caused by filter changes don't reset the current view
  const [activeView, setActiveView] = useState('default');

  // ── CenterView ──────────────────────────────────────────────────────────
  // When one of these views is active, .main expands to fill the entire grid
  // (all 5 columns and full height) and the BottomStatusBar slides off-screen.
  // The right-side panels and status bar stay mounted to preserve their state,
  // but the panels are hidden via opacity: 0 and pointer-events: none.
  //
  // To add a new CenterView card: add its view key string to this Set.
  // No CSS changes required (see Dashboard.module.css layout contract).
  // ────────────────────────────────────────────────────────────────────────
  const CENTER_VIEW_KEYS = new Set([
    'settings',             // App settings
    'listview',             // Full tab list
    'bookmarks',            // Bookmark manager
    'autotabgrouperworker', // Auto Tab Grouper settings
    'autocloserworker',     // Auto Tab Closer settings
    'autotabgroup',         // Tab Group Wizard
    'autosmush',            // Auto Smusher
    'tabsorter',            // Auto Sorter
    'watchlater',           // YouTube Watch Later
    'autoclose',            // Close Old Tabs
  ]);

  // isCenterView is true for CenterView keys, or when the Auto Tab Group
  // wizard overlay is open (it fills the entire grid)
  const isCenterView = CENTER_VIEW_KEYS.has(activeView) || showAutoGroupWizard;

  const handleNavigate = (view) => {
    const doUpdate = () => {
      setActiveView(view);
      if (view !== 'default') {
        pause();
      } else {
        dispatch({ type: 'START_REORDER' });
        dispatch({ type: 'REORDER_TABS', payload: tabProcessingMode });
        resume();
      }
    };

    if (!reduceMotion && document.startViewTransition) {
      document.startViewTransition(() => {
        flushSync(doUpdate);
      });
    } else {
      doUpdate();
    }
  };

  // Sync activeView to a body data attribute so useKeyboard can detect
  // when a panel view is open and suppress triage hotkeys.
  useEffect(() => {
    if (activeView !== 'default') {
      document.body.setAttribute('data-active-view', activeView);
    } else {
      document.body.removeAttribute('data-active-view');
    }
    return () => document.body.removeAttribute('data-active-view');
  }, [activeView]);

  // reset view to 'default' only when a tab is actually processed
  // — but not while the list view is open (it handles batch operations)
  const prevIndexRef = useRef(state.currentIndex);
  useEffect(() => {
    if (state.currentIndex !== prevIndexRef.current) {
      prevIndexRef.current = state.currentIndex;
      if (activeView !== 'listview') {
        setActiveView('default');
      }
    }
  }, [state.currentIndex, activeView]);

  const handleDismissDebuggerWarning = () => {
    setIsDebuggerWarningDismissed(true);
    sessionStorage.setItem('debuggerWarningDismissed', 'true');
  };

  return (
    <div
      className={styles.dashboard}
      data-center-view={isCenterView}
      style={{
        '--main-row-end': isCenterView ? 8 : 7,
        '--main-col-end': isCenterView ? 6 : 4,
        '--panel-opacity': isCenterView ? 0 : 1,
        '--panel-pointer-events': isCenterView ? 'none' : 'auto',
      }}
    >
      {isTutorialActive && <QuickStartTutorialModal onComplete={completeTutorial} isReturningUser={isReturningUser} onNavigate={handleNavigate} />}

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
            <ManualTabGroupWizard onClose={() => setShowAutoGroupWizard(false)} />
          </div>
        )}
      </div>
      <div className={`${styles.bookmarks} ${styles.panel}`}>
        <BookmarkPickerPanel
          isActive={activePicker === 'bookmark'}
          onDeactivate={() => setActivePicker(null)}
          onBookmarkCleaner={() => { setActivePicker(null); handleNavigate('bookmarks'); }}
        />

      </div>
      <div className={`${styles.tabGroups} ${styles.panel}`}>
        <TabGroupPickerPanel
          isActive={activePicker === 'group'}
          onDeactivate={() => setActivePicker(null)}
          onAutoGroup={() => { setActivePicker(null); setShowAutoGroupWizard(true); }}
          onAutoGrouper={() => { setActivePicker(null); handleNavigate('autotabgrouperworker'); }}
        />
      </div>
      {/*
        * CenterView animation: the bar is always mounted (preserving its state).
        * It is visually hoisted into the View Transition layer so it slides out 
        * smoothly in sync with the expanding CenterView card.
        */}
      <div className={styles.hotkeys}>
        <BottomStatusBar actions={actions} />
      </div>
    </div>
  );
}
