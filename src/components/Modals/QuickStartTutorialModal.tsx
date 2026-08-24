import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bomb,
  Lightning,
  Broom,
  ArrowUp,
  ArrowDown,
  Check,
  ListNumbers,
  MagicWandIcon,
} from '@phosphor-icons/react';
import styles from './QuickStartTutorialModal.module.css';
import swipeAnimation from '../Tutorial/swipe-animation.svg';
import { useMagicDot, MagicDotProvider } from '../Tutorial/MagicDotProvider';
import { useTutorialSequence } from '../Tutorial/useTutorialSequence';
import MagicDot from '../Tutorial/MagicDot';
import BunnySprite from '../Dashboard/Monitor/BunnySprite';
import useBunny from '../../hooks/useBunny';
import { useTriage } from '../../store/TriageProvider';
import { useBookmarkData } from '../Tools/BookmarkManager/useBookmarkData';
import { flattenTree } from '../../utils/bookmarkUtils';
import InfoIconWithTooltip from '../Shared/InfoIconWithTooltip';

/** @typedef {import('./types').MagicDotStep} MagicDotStep */

interface QuickActionRowProps {
  icon: React.ElementType;
  colorClass: string;
  title: React.ReactNode;
  description: React.ReactNode;
  autoTitle?: string;
  baseAction: string;
  autoAction?: string;
  handleAction: (view: string) => void;
  infoTooltip?: React.ReactNode;
}

function QuickActionRow({
  icon: Icon,
  colorClass,
  title,
  description,
  autoTitle,
  baseAction,
  autoAction,
  handleAction,
  infoTooltip,
}: QuickActionRowProps) {
  const [isAutoHovered, setIsAutoHovered] = useState<boolean>(false);

  return (
    <div
      className={`${styles.actionRow} ${styles.quickActionRow} ${styles[colorClass]} ${isAutoHovered ? styles.isAutoHovered : ''}`}
      onClick={() => handleAction(baseAction)}
    >
      <div className={styles.actionVisual}>
        <div className={styles.tileIcon}>
          <Icon size={16} weight="bold" />
        </div>
      </div>
      <div className={styles.actionInfo}>
        <div className={styles.actionTitle}>{isAutoHovered && autoTitle ? autoTitle : title}</div>
        <div className={styles.actionDesc}>{description}</div>
      </div>
      {autoAction && (
        <div
          className={styles.lightningAction}
          onMouseEnter={() => setIsAutoHovered(true)}
          onMouseLeave={() => setIsAutoHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            handleAction(autoAction);
          }}
        >
          <Lightning size={16} weight={isAutoHovered ? 'fill' : 'duotone'} />
        </div>
      )}
      {infoTooltip && (
        <div className={styles.infoAction}>
          <InfoIconWithTooltip placement="left">{infoTooltip}</InfoIconWithTooltip>
        </div>
      )}
    </div>
  );
}

const TUTORIAL_ACTIONS = [
  {
    id: 'header',
    isHeader: true,
    title: 'Main Stack Hotkeys',
  },
  {
    id: 'triage',
    title: 'Left to close, Right to keep',
    keys: [
      <ArrowLeft size={16} weight="bold" key="l" />,
      <ArrowRight size={16} weight="bold" key="r" />,
    ],
  },
  {
    id: 'swipe',
    title: 'Swipe to close or keep',
    customVisual: (
      <div className={styles.swipeAnimationContainer}>
        <img src={swipeAnimation} className={styles.swipeHand} alt="Swipe Animation" />
      </div>
    ),
  },
  {
    id: 'bookmark',
    title: 'Up for Bookmarks',
    keys: [<ArrowUp size={16} weight="bold" key="up" />],
  },
  {
    id: 'group',
    title: 'Down for Tab Groups',
    keys: [<ArrowDown size={16} weight="bold" key="down" />],
  },
];

const SECONDARY_ACTIONS = [
  {
    id: 'header',
    isHeader: true,
    title: 'Bookmarks & Tab Groups',
  },
  {
    id: 'search',
    title: 'Start typing to Search',
    keys: ['H', 'i'],
  },
  {
    id: 'navigate',
    title: 'Move through the List',
    keys: [
      <ArrowUp size={16} weight="bold" key="up" />,
      <ArrowDown size={16} weight="bold" key="down" />,
    ],
  },
  {
    id: 'open',
    title: 'Open nested folders',
    keys: ['Space'],
  },
  {
    id: 'confirm',
    title: 'Save and continue',
    keys: ['Enter'],
  },
];

interface TutorialContentProps {
  onComplete: () => void;
  isReturningUser?: boolean;
  onNavigate?: (view: string) => void;
  buttonDelay?: number;
}

function TutorialContent({
  onComplete,
  isReturningUser,
  onNavigate,
  buttonDelay = 19400,
}: TutorialContentProps) {
  const bunny = useBunny({ initialMood: 'idle' });
  const [isButtonReady, setIsButtonReady] = useState<boolean>(false);
  const { registerTarget } = useMagicDot();
  const { sequence } = useTutorialSequence('main-overlay');

  const { state } = useTriage();
  const { oldTabsCount, ungroupedTabsCount, sortableTabsCount } = React.useMemo(() => {
    const tabs = state.tabs?.filter((t) => !t.processed && !t.gone) || [];
    const unpinnedTabs = tabs.filter((t) => !t.pinned);

    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    const oldTabs = unpinnedTabs.filter(
      (t) => typeof t.lastAccessed === 'number' && now - t.lastAccessed >= TWENTY_FOUR_HOURS,
    );

    return {
      oldTabsCount: oldTabs.length,
      ungroupedTabsCount: unpinnedTabs.length,
      sortableTabsCount: unpinnedTabs.length,
    };
  }, [state.tabs]);

  const { fullTree } = useBookmarkData();
  const unopenedBookmarksCount = React.useMemo(() => {
    const leaves = (flattenTree(fullTree) as import('../../types').BookmarkNode[]).filter(
      (n: import('../../types').BookmarkNode) => !n.isFolder && n.url && !n.dateLastUsed,
    );
    return leaves.length;
  }, [fullTree]);

  const handleAction = (view: string) => {
    if (onNavigate) {
      onComplete();
      onNavigate(view);
    }
  };

  useEffect(() => {
    if (buttonDelay <= 0) {
      setIsButtonReady(true);
      return;
    }
    const timer = setTimeout(
      () => {
        setIsButtonReady(true);
      },
      isReturningUser ? 1000 : buttonDelay,
    );
    return () => clearTimeout(timer);
  }, [buttonDelay]);

  useEffect(() => {
    bunny.setMood('happy');
    bunny.triggerAnimation('jump', 1000);
  }, []);

  return (
    <div className={styles.overlay} onClick={onComplete}>
      <MagicDot sequence={sequence} introDelay={2000} fixedMode />
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header} ref={registerTarget('header')}>
          <div className={styles.headerTitle}>
            <BunnySprite size={32} mood={bunny.mood} animation={bunny.animation} colour="white" />
            <h2>{isReturningUser ? 'Welcome back!' : 'Welcome!'}</h2>
          </div>
          <p>
            Tabbit helps you close tabs faster. <br /> Use the keyboard shortcuts!
          </p>
        </div>

        <div className={styles.boardsContainer}>
          <div className={styles.primaryColumn}>
            <div className={styles.actionsList} style={{ marginBottom: 0 }}>
              <div className={styles.sectionHeader}>Quick Actions</div>

              <QuickActionRow
                icon={Bomb}
                colorClass="tileBomb"
                title="Close old tabs"
                description={
                  <>
                    {oldTabsCount} tabs {'>'} 24h
                  </>
                }
                autoTitle="Auto close old tabs"
                baseAction="autoclose"
                autoAction="autocloserworker"
                handleAction={handleAction}
              />

              <QuickActionRow
                icon={MagicWandIcon}
                colorClass="tileWand"
                title="Group tabs"
                description={<>{ungroupedTabsCount} tabs to organize</>}
                autoTitle="Auto group tabs"
                baseAction="autotabgroup"
                autoAction="autotabgrouperworker"
                handleAction={handleAction}
              />

              <QuickActionRow
                icon={ListNumbers}
                colorClass="tileSort"
                title="Auto-sort tabs"
                description={<>{sortableTabsCount} unpinned tabs</>}
                baseAction="tabsorter"
                handleAction={handleAction}
                infoTooltip="Right-click the Tabbit extension icon to sort tabs on the fly if you prefer not to have it happen automatically."
              />

              <QuickActionRow
                icon={Broom}
                colorClass="tileNetwork"
                title="Clean bookmarks"
                description={<>{unopenedBookmarksCount} unused bookmarks</>}
                baseAction="bookmarks"
                handleAction={handleAction}
              />
            </div>
          </div>

          <div className={styles.arrowsColumn}>{/* Spacing */}</div>

          <div className={styles.secondaryColumn}>
            <div className={styles.actionsList}>
              {TUTORIAL_ACTIONS.map((action) =>
                action.isHeader ? (
                  <div key={action.id} className={styles.sectionHeader}>
                    {action.title}
                  </div>
                ) : (
                  <div key={action.id} ref={registerTarget(action.id)} className={styles.actionRow}>
                    <div className={styles.actionVisual}>
                      {action.customVisual
                        ? action.customVisual
                        : action.keys?.map((k, i) => (
                            <kbd
                              key={i}
                              className={styles.kbd}
                              style={
                                typeof k === 'string' && (k === 'Enter' || k === 'Space')
                                  ? { width: '100%' }
                                  : {}
                              }
                            >
                              {k}
                            </kbd>
                          ))}
                    </div>
                    <div className={styles.actionInfo}>
                      <div className={styles.actionTitle}>{action.title}</div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className={styles.arrowsColumn}>{/* Spacing */}</div>

          <div className={styles.tertiaryColumn}>
            <div className={styles.actionsList} style={{ marginBottom: 0 }}>
              {SECONDARY_ACTIONS.map((action) =>
                action.isHeader ? (
                  <div key={action.id} className={styles.sectionHeader}>
                    {action.title}
                  </div>
                ) : (
                  <div key={action.id} ref={registerTarget(action.id)} className={styles.actionRow}>
                    <div className={styles.actionVisual}>
                      {action.keys?.map((k, i) => (
                        <kbd
                          key={i}
                          className={styles.kbd}
                          style={
                            typeof k === 'string' && (k === 'Enter' || k === 'Space')
                              ? { width: '100%' }
                              : {}
                          }
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <div className={styles.actionInfo}>
                      <div className={styles.actionTitle}>{action.title}</div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        <button
          className={`${styles.startButton} ${isButtonReady ? styles.ready : ''}`}
          onClick={onComplete}
          ref={registerTarget('go')}
        >
          <Check size={16} weight="bold" />
          <span className={styles.startButtonText}>Go!</span>
        </button>
      </div>
    </div>
  );
}

export interface QuickStartTutorialModalProps {
  onComplete: () => void;
  isReturningUser: boolean;
  onNavigate: (view: string) => void;
}

export default function QuickStartTutorialModal({
  onComplete,
  isReturningUser,
  onNavigate,
}: QuickStartTutorialModalProps) {
  return (
    <MagicDotProvider>
      <TutorialContent
        onComplete={onComplete}
        isReturningUser={isReturningUser}
        onNavigate={onNavigate}
      />
    </MagicDotProvider>
  );
}
