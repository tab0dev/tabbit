import React, { useRef, useState } from 'react';
import styles from './Card.module.css';
import Tooltip from '../Shared/Tooltip';
import { getAccessPillProps } from '../../utils/formatters';
import { PushPin, Moon } from '@phosphor-icons/react';

export default function CardPills({ tab, tabGroup, groupColor }) {
  const pillRef = useRef(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const accessedRef = useRef(null);
  const [accessedTooltipVisible, setAccessedTooltipVisible] = useState(false);
  const suspendedRef = useRef(null);
  const [suspendedTooltipVisible, setSuspendedTooltipVisible] = useState(false);

  return (
    <div className={styles.pillContainer}>
      {tab.isSuspended && (
        <div
          ref={suspendedRef}
          className={styles.tabGroupPill}
          style={{
            backgroundColor: 'var(--pill-suspended-bg, rgba(120, 90, 40, 0.25))',
            borderColor: 'var(--pill-suspended-border, rgba(180, 140, 60, 0.35))',
            color: 'var(--pill-text-color)',
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={() => setSuspendedTooltipVisible(true)}
          onMouseLeave={() => setSuspendedTooltipVisible(false)}
        >
          <Moon size={12} weight="fill" style={{ marginRight: '4px', opacity: 0.8 }} />
          <span className={styles.pillText} style={{ textTransform: 'lowercase' }}>suspended</span>
          <Tooltip anchorRef={suspendedRef} visible={suspendedTooltipVisible} placement="right">
            Currently suspended by Tiny Suspender — bookmarks work and are saved properly!
          </Tooltip>
        </div>
      )}
      {tab.pinned && (
        <div
          className={styles.tabGroupPill}
          style={{
            backgroundColor: 'var(--pill-pinned-bg)',
            borderColor: 'var(--pill-pinned-border)',
            color: 'var(--pill-text-color)',
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <PushPin size={12} weight="fill" style={{ marginRight: '4px', opacity: 0.8 }} />
          <span className={styles.pillText} style={{ textTransform: 'lowercase' }}>pinned</span>
        </div>
      )}
      {tab.lastAccessed && (() => {
        const pillProps = getAccessPillProps(tab.lastAccessed);
        if (!pillProps) return null;
        return (
          <div
            ref={accessedRef}
            className={styles.tabGroupPill}
            style={{
              ...pillProps.style,
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={() => setAccessedTooltipVisible(true)}
            onMouseLeave={() => setAccessedTooltipVisible(false)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px', opacity: 0.8 }}>
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span className={styles.pillText} style={{ textTransform: 'lowercase' }}>
              {pillProps.text}
            </span>
            <Tooltip anchorRef={accessedRef} visible={accessedTooltipVisible} placement="right">
              Last accessed {pillProps.text.toLowerCase()}
            </Tooltip>
          </div>
        );
      })()}
      {tab.duplicates && tab.duplicates.length > 0 && (
        <div
          className={styles.tabGroupPill}
          style={{
            backgroundColor: 'var(--pill-green-bg)',
            borderColor: 'var(--pill-green-border)',
            color: 'var(--pill-text-color)',
            textTransform: 'lowercase',
            cursor: 'default',
          }}
        >
          <span className={styles.pillText}>
            {tab.duplicates.length + 1} copies
          </span>
        </div>
      )}
      {tabGroup && (
        <div
          ref={pillRef}
          className={styles.tabGroupPill}
          style={{
            backgroundColor: `color-mix(in srgb, ${groupColor} var(--pill-bg-mix), transparent)`,
            borderColor: `color-mix(in srgb, ${groupColor} var(--pill-border-mix), transparent)`,
            color: `color-mix(in srgb, ${groupColor} var(--pill-group-text-mix), var(--text-primary))`,
          }}
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
        >
          <span className={styles.pillText}>{tabGroup.title || 'Untitled Group'}</span>
          <Tooltip anchorRef={pillRef} visible={tooltipVisible} placement="right">
            This is the current active tab group
          </Tooltip>
        </div>
      )}
    </div>
  );
}
