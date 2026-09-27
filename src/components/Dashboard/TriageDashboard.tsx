import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import styles from './Dashboard.module.css';
import { useUpcomingTabs } from '../../store/TriageProvider';
import { useTriageActions } from '../../hooks/useTriageActions';
import Card from '../Card/Card';
import BookmarkPickerPanel from './BookmarkPickerPanel';
import TabGroupPickerPanel from './TabGroupPickerPanel';
import BottomStatusBar from './BottomStatusBar';
import { AnimatePresence } from 'framer-motion';
import { useTriage, Mode } from '../../store/TriageProvider';
import { useTheme } from '../../store/ThemeProvider';
import EmptyCard from './EmptyCard';
import QuickStartTutorialModal from '../Modals/QuickStartTutorialModal';
import { useTutorial } from '../../hooks/useTutorial';
import DebuggingWarningModal from '../Modals/DebuggingWarningModal';
import { useTabProcessing } from '../../store/TabProcessingProvider';
import { useTimer } from '../../store/TimerProvider';
import { usePicker } from '../../store/PickerProvider';

// Static set of view keys that trigger a non-normal layout mode.
// Defined at module scope so it is not reallocated on every render.
// To add a new full-screen tool: add its activeView key string here.
// No CSS changes required (see Dashboard.module.css layout contract).
const CENTER_VIEW_KEYS = new Set([
  'settings', // App settings
  'listview', // Full tab list
  'bookmarks', // Bookmark manager
  'autotabgrouperworker', // Auto Tab Grouper settings
  'autocloserworker', // Auto Tab Closer settings
  'autotabgroup', // Tab Group Wizard
  'autosmush', // Auto Smusher
  'tabsorter', // Auto Sorter
  'watchlater', // YouTube Watch Later
  'autoclose', // Close Old Tabs
]);

export default function TriageDashboard() {
  const { state, dispatch } = useTriage();
  const { reduceMotion } = useTheme();
  const { excludeSuspendedTabs, excludeGroupedTabs, mode: tabProcessingMode } = useTabProcessing();
  const { pause, resume } = useTimer();
  const { activePicker, setActivePicker } = usePicker();

  const tabFilterFn = (tab: import('../../types').TriageTab) => {
    if (excludeSuspendedTabs && tab.isSuspended) return false;
    if (excludeGroupedTabs && tab.groupId !== -1) return false;
    return true;
  };
  const upcomingTabs = useUpcomingTabs(2, tabFilterFn);
  const actions = useTriageActions();
  const [isDebuggerWarningDismissed, setIsDebuggerWarningDismissed] = useState<boolean>(
    () => sessionStorage.getItem('debuggerWarningDismissed') === 'true',
  );

  const isComplete = state.mode === Mode.COMPLETE;
  const {
    state: { isActive: isTutorialActive, isReturningUser },
    actions: { complete: completeTutorial },
  } = useTutorial();

  // dashboard-level activeView — lives here (not inside Card) so that
  // card remounts caused by filter changes don't reset the current view
  const [activeView, setActiveView] = useState<string>('default');

  // ── Layout Mode ──────────────────────────────────────────────────────────
  // layoutMode is pure derived state — no useState, no persistence.
  // It drives grid column/row spans, panel visibility, and CSS transitions
  // across all three modes: 'normal', 'centered', 'contentWithSidebar'.
  // ─────────────────────────────────────────────────────────────────────────
  let layoutMode = 'normal';
  if (CENTER_VIEW_KEYS.has(activeView)) {
    if (activeView === 'listview' && activePicker !== null) {
      layoutMode = 'contentWithSidebar';
    } else {
      layoutMode = 'centered';
    }
  }

  const handleNavigate = (view: string) => {
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

    if (
      !reduceMotion &&
      (
        document as Document & {
          startViewTransition?: (cb: () => void) => { finished: Promise<void> };
        }
      ).startViewTransition
    ) {
      document.documentElement.classList.add('is-routing');
      const transition = (
        document as Document & {
          startViewTransition: (cb: () => void) => { finished: Promise<void> };
        }
      ).startViewTransition(() => {
        flushSync(doUpdate);
      });
      transition.finished.finally(() => {
        document.documentElement.classList.remove('is-routing');
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

  // Correction effect: keep currentIndex pointing at a filter-visible tab.
  // Fires whenever the filter flags change (toggle) OR after the reducer
  // advances currentIndex (tab action). The early-return makes it idempotent —
  // when the index is already valid it exits without dispatching, so no loop.
  useEffect(() => {
    if (state.mode !== Mode.TRIAGING) return;
    const current = state.tabs[state.currentIndex];
    if (!current || tabFilterFn(current)) return; // already on a valid tab

    const all = state.tabs;
    for (let i = state.currentIndex + 1; i < all.length; i++) {
      if (!all[i].processed && !all[i].gone && tabFilterFn(all[i])) {
        dispatch({ type: 'SET_CURRENT_INDEX', payload: i });
        return;
      }
    }
    for (let i = 0; i < state.currentIndex; i++) {
      if (!all[i].processed && !all[i].gone && tabFilterFn(all[i])) {
        dispatch({ type: 'SET_CURRENT_INDEX', payload: i });
        return;
      }
    }
    dispatch({ type: 'SET_MODE', payload: Mode.COMPLETE });
  }, [excludeSuspendedTabs, excludeGroupedTabs, state.currentIndex]);

  const handleDismissDebuggerWarning = () => {
    setIsDebuggerWarningDismissed(true);
    sessionStorage.setItem('debuggerWarningDismissed', 'true');
  };

  return (
    <div className={styles.dashboard} data-layout-mode={layoutMode}>
      {isTutorialActive && (
        <QuickStartTutorialModal
          onComplete={completeTutorial}
          isReturningUser={isReturningUser}
          onNavigate={handleNavigate}
        />
      )}

      {!isTutorialActive &&
        !isDebuggerWarningDismissed &&
        localStorage.getItem('suppressDebuggerWarning') !== 'true' && (
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
      </div>
      <div className={`${styles.bookmarks} ${styles.panel}`}>
        <BookmarkPickerPanel
          isActive={activePicker === 'bookmark'}
          onDeactivate={() => setActivePicker(null)}
          onBookmarkCleaner={() => {
            setActivePicker(null);
            handleNavigate('bookmarks');
          }}
        />
      </div>
      <div className={`${styles.tabGroups} ${styles.panel}`}>
        <TabGroupPickerPanel
          isActive={activePicker === 'group'}
          onDeactivate={() => setActivePicker(null)}
          onAutoGroup={() => {
            setActivePicker(null);
            handleNavigate('autotabgroup');
          }}
          onAutoGrouper={() => {
            setActivePicker(null);
            handleNavigate('autotabgrouperworker');
          }}
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
