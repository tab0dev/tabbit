import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ArrowCounterClockwise, Check } from '@phosphor-icons/react';
import styles from './TutorialOverlay.module.css';
import swipeAnimation from './swipe-animation.svg';
import useBunny from '../../hooks/useBunny';
import { useMonitor } from '../../store/MonitorProvider';
import BunnySprite from '../Monitor/BunnySprite';
import { MagicDotProvider, useMagicDot } from './MagicDotProvider';
import MagicDot from './MagicDot';

/** @typedef {import('./types').MagicDotStep} MagicDotStep */
// 2500 + 2000 + 1900 + 1800 + 1700 + 1800 + 2000 + 1900 + 1800 + 3000 = 20400
/** @type {MagicDotStep[]} */

const MAGIC_DOT_SEQUENCE = [
  { target: 'header', position: 'right', duration: 2500, color: 'var(--magic-dot)', pulse: true, size: 16, tooltip: "Welcome in! Let's get you settled.", tooltipPosition: 'right' },
  { target: 'triage', position: 'left', tooltipPosition: 'left', duration: 2000, color: 'var(--magic-dot)', pulse: true, size: 16, tooltip: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Use <ArrowLeft size={13} weight="bold" /> <ArrowRight size={13} weight="bold" /> to triage tabs</span> },
  { target: 'swipe', position: 'left', tooltipPosition: 'left', duration: 1900, color: 'var(--magic-dot)', pulse: false, size: 16, tooltip: 'or click and drag the cards!' },
  { target: 'bookmark', position: 'left', tooltipPosition: 'left', duration: 1800, color: 'var(--magic-dot)', pulse: false, size: 16, tooltip: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Press <ArrowUp size={13} weight="bold" /> to Bookmark</span> },
  { target: 'group', position: 'left', tooltipPosition: 'left', duration: 1700, color: 'var(--magic-dot)', pulse: false, size: 16, tooltip: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>or <ArrowDown size={13} weight="bold" /> to move to a tab group.</span> },
  { target: 'bookmark', position: 'left', tooltipPosition: 'left', duration: 1800, color: 'var(--magic-dot)', pulse: false, size: 16, tooltip: 'For Bookmarks and Tab Groups...' },
  { target: 'navigate', position: 'left', tooltipPosition: 'left', duration: 2000, color: 'var(--magic-dot)', pulse: true, size: 16, tooltip: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>move through the list with <ArrowUp size={13} weight="bold" /> <ArrowDown size={13} weight="bold" /></span> },
  { target: 'search', position: 'left', tooltipPosition: 'left', duration: 1900, color: 'var(--magic-dot)', pulse: false, size: 16, tooltip: 'start typing to search,' },
  { target: 'confirm', position: 'left', tooltipPosition: 'left', duration: 1800, color: 'var(--magic-dot)', pulse: false, size: 16, tooltip: 'and press Enter to confirm and continue.' },
  { target: 'go', position: 'right', tooltipPosition: 'right', duration: 3000, color: 'var(--magic-dot)', pulse: true, size: 16, tooltip: 'Now! Go close your tabs!' },
];


const TUTORIAL_ACTIONS = [
  {
    id: 'header',
    isHeader: true,
    title: 'Global Hotkeys'
  },
  {
    id: 'triage',
    title: 'Left to close, Right to keep',
    keys: [
      <ArrowLeft size={16} weight="bold" key="l" />,
      <ArrowRight size={16} weight="bold" key="r" />
    ]
  },
  {
    id: 'swipe',
    title: 'Swipe to close or keep',
    customVisual: (
      <div className={styles.swipeAnimationContainer}>
        <img src={swipeAnimation} className={styles.swipeHand} alt="Swipe Animation" />
      </div>
    )
  },
  {
    id: 'bookmark',
    title: 'Up to add to Bookmarks Folder',
    keys: [<ArrowUp size={16} weight="bold" key="up" />]
  },
  {
    id: 'group',
    title: 'Down to add to Tab Group',
    keys: [<ArrowDown size={16} weight="bold" key="down" />]
  },
];

const SECONDARY_ACTIONS = [
  {
    id: 'header',
    isHeader: true,
    title: 'Bookmarks & Tab Groups'
  },
  {
    id: 'search',
    title: 'Start typing to Search',
    keys: ['H', 'i']
  },
  {
    id: 'navigate',
    title: 'Move through the List',
    keys: [
      <ArrowUp size={16} weight="bold" key="up" />,
      <ArrowDown size={16} weight="bold" key="down" />
    ]
  },
  {
    id: 'confirm',
    title: 'Save and continue',
    keys: ['Enter']
  },
  {
    id: 'open',
    title: 'Open nested folders',
    keys: ['Space']
  },

];

function TutorialContent({ onComplete, isReturningUser, buttonDelay = 19400 }) {
  const bunny = useBunny({ initialMood: 'idle' });
  const { postStatus } = useMonitor();
  const [step, setStep] = useState(0);
  const [isButtonReady, setIsButtonReady] = useState(false);
  const { registerTarget } = useMagicDot();
  // const registerTarget = () => {};



  useEffect(() => {
    if (buttonDelay <= 0) {
      setIsButtonReady(true);
      return;
    }
    const timer = setTimeout(() => {
      setIsButtonReady(true);
    }, isReturningUser ? 1000 : buttonDelay);
    return () => clearTimeout(timer);
  }, [buttonDelay]);

  useEffect(() => {
    bunny.setMood('happy');
    bunny.triggerAnimation('jump', 1000);
  }, []);

  return (
    <div className={styles.overlay} onClick={onComplete}>
      <MagicDot sequence={MAGIC_DOT_SEQUENCE} introDelay={2000} fixedMode />
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header} ref={registerTarget('header')}>
          <div className={styles.headerTitle}>
            <BunnySprite size={32} mood={bunny.mood} animation={bunny.animation} colour="white" />
            <h2>{isReturningUser ? 'Welcome back!' : 'Welcome!'}</h2>
          </div>
          <p>Tabbit helps you close tabs faster. <br /> Use the keyboard shortcuts!</p>
        </div>

        <div className={styles.boardsContainer}>
          <div className={styles.primaryColumn}>
            <div className={styles.actionsList}>
              {TUTORIAL_ACTIONS.map(action => (
                action.isHeader ? (
                  <div key={action.id} className={styles.sectionHeader}>
                    {action.title}
                  </div>
                ) : (
                  <div key={action.id} ref={registerTarget(action.id)} className={styles.actionRow}>
                    <div className={styles.actionVisual}>
                      {action.customVisual ? (
                        action.customVisual
                      ) : (
                        action.keys?.map((k, i) => (
                          <kbd key={i} className={styles.kbd}>
                            {k}
                          </kbd>
                        ))
                      )}
                    </div>
                    <div className={styles.actionInfo}>
                      <div className={styles.actionTitle}>{action.title}</div>
                      {/* <div className={styles.actionDesc}>{action.description}</div> */}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

          <div className={styles.arrowsColumn}>
            <div className={styles.arrowSlot}></div>
            <div className={styles.arrowSlot}></div>
            <div className={styles.arrowSlot}>
            </div>
            <div className={styles.arrowSlot}>
              {/* <div className={styles.connectorLine} /> */}
            </div>
            <div className={styles.arrowSlot}>
              {/* <div className={styles.connectorLine} /> */}

            </div>
          </div>

          <div className={styles.secondaryColumn}>
            <div className={styles.actionsList} style={{ marginBottom: 0 }}>
              {SECONDARY_ACTIONS.map(action => (
                action.isHeader ? (
                  <div key={action.id} className={styles.sectionHeader}>
                    {action.title}
                  </div>
                ) : (
                  <div key={action.id} ref={registerTarget(action.id)} className={styles.actionRow}>
                    <div className={styles.actionVisual}>
                      {action.keys?.map((k, i) => (
                        <kbd key={i} className={styles.kbd}>
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <div className={styles.actionInfo}>
                      <div className={styles.actionTitle}>{action.title}</div>
                      {/* <div className={styles.actionDesc}>{action.description}</div> */}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>

        <button
          className={`${styles.startButton} ${isButtonReady ? styles.ready : ''}`}
          onClick={onComplete}
          ref={registerTarget('go')}
        >
          <Check size={16} weight="bold" />
          <span className={styles.startButtonText} >Go!</span>
        </button>
      </div>
    </div>
  );
}

export default function TutorialOverlay({ onComplete, isReturningUser }) {
  return (
    <MagicDotProvider>
      <TutorialContent onComplete={onComplete} isReturningUser={isReturningUser} />
    </MagicDotProvider>
  );
}
