import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Clock, YoutubeLogoIcon } from '@phosphor-icons/react';
import styles from './WatchLaterCard.module.css';
import { useTriage } from '../../../store/TriageProvider';
import { useMonitor } from '../../../store/MonitorProvider';
import { isYouTubeWatchTab } from '../../../utils/chromeUtils';
import { runWatchLaterBatch } from '../../../utils/watchLaterBatch';
import InfoIconWithTooltip from '../../Shared/InfoIconWithTooltip';
import Favicon from '../../Shared/Favicon';
import { pickQuip, WATCH_LATER_QUIPS } from '../../../data/quips';

function StatusBadge({ status }) {
  if (!status) return null;
  const map = {
    activating: { label: '…', cls: styles.statusPending },
    saving: { label: '…', cls: styles.statusPending },
    saved: { label: '✓', cls: styles.statusSaved },
    failed: { label: '✕', cls: styles.statusFailed },
  };
  const { label, cls } = map[status] || { label: '?', cls: '' };
  return <div className={`${styles.statusBadge} ${cls}`}>{label}</div>;
}


export default function WatchLaterCard({ onClose }) {
  const { state } = useTriage();
  const { postStatus } = useMonitor();

  const [excludedIds, setExcludedIds] = useState(new Set());
  const [runStatus, setRunStatus] = useState('idle');
  const [tabStatuses, setTabStatuses] = useState({});
  const [summary, setSummary] = useState(null);
  const [debugLines, setDebugLines] = useState([]);
  const controllerRef = useRef(null);
  const debugLogRef = useRef(null);

  const pushLog = useCallback(
    (line) => setDebugLines(prev => [...prev.slice(-80), `${new Date().toLocaleTimeString()} ${line}`]),
    []
  );

  // ── Derived tab lists ─────────────────────────────────────────────────────

  const eligibleTabs = useMemo(
    () => state.tabs.filter(t => !t.processed && !t.gone && isYouTubeWatchTab(t)),
    [state.tabs]
  );

  const includedTabs = useMemo(
    () => eligibleTabs.filter(t => !excludedIds.has(t.id)),
    [eligibleTabs, excludedIds]
  );

  const allSelected = includedTabs.length > 0 && includedTabs.length === eligibleTabs.length;

  // ── Selection toggles ─────────────────────────────────────────────────────

  const toggleAll = () => {
    setExcludedIds(allSelected
      ? new Set(eligibleTabs.map(t => t.id))
      : new Set()
    );
  };

  const toggleTab = (id) => {
    if (runStatus === 'running') return;
    setExcludedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetState = useCallback(() => {
    setRunStatus('idle');
    setTabStatuses({});
    setSummary(null);
    setDebugLines([]);
  }, []);

  // ── Auto-scroll debug log — only when near the bottom ────────────────────

  useEffect(() => {
    const el = debugLogRef.current;
    if (!el || debugLines.length === 0) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [debugLines.length]);

  // ── Main batch run ────────────────────────────────────────────────────────

  const handleRun = async () => {
    if (runStatus === 'running' || includedTabs.length === 0) return;

    resetState();
    setRunStatus('running');

    const controller = new AbortController();
    controllerRef.current = controller;

    const tabIds = includedTabs.map(t => t.id);

    await runWatchLaterBatch(tabIds, {
      signal: controller.signal,
      onProgress: (event) => {
        if (event.type === 'log') {
          pushLog(event.line);
        } else if (event.type === 'tabStatus') {
          setTabStatuses(prev => ({ ...prev, [event.tabId]: event.status }));
        } else if (event.type === 'done') {
          const { succeeded, failed, stopped } = event;
          setRunStatus(stopped ? 'stopped' : 'done');
          setSummary({ succeeded, failed, stopped });

          // Post a summary to the Rabbit Monitor so it's visible after the card closes
          const total = succeeded + failed;
          if (succeeded > 0 && failed === 0) {
            postStatus(
              `✓ ${succeeded} video${succeeded !== 1 ? 's' : ''} added to Watch Later\n${pickQuip(WATCH_LATER_QUIPS.success)}`,
              { ttlMs: 6000, level: 'success' }
            );
          } else if (succeeded > 0) {
            postStatus(
              `✓ ${succeeded}/${total} added to Watch Later\n${pickQuip(WATCH_LATER_QUIPS.partial)}`,
              { ttlMs: 6000, level: 'success' }
            );
          } else if (failed > 0) {
            postStatus(
              `✕ Watch Later: all ${failed} failed\n${pickQuip(WATCH_LATER_QUIPS.failed)}`,
              { ttlMs: 5000, level: 'error' }
            );
          }
        }
      },
    });
  };

  const handleStop = () => controllerRef.current?.abort();

  const isRunning = runStatus === 'running';
  const isDone = runStatus === 'done' || runStatus === 'stopped';

  const footerMeta = useMemo(() => {
    if (isRunning) {
      const done = Object.values(tabStatuses).filter(s => s === 'saved' || s === 'failed').length;
      return `${done} / ${includedTabs.length} processed…`;
    }
    if (isDone) return `Done — ${summary?.succeeded ?? 0} saved, ${summary?.failed ?? 0} failed`;
    return `${includedTabs.length} tab${includedTabs.length !== 1 ? 's' : ''} selected`;
  }, [runStatus, tabStatuses, includedTabs.length, summary]);

  return (
    <div className={styles.watchLaterCard}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>
          <YoutubeLogoIcon size={20} weight="duotone" />
          Save to Watch Later
          <InfoIconWithTooltip placement="right">Automatically saves all selected YouTube tabs to your Watch Later playlist by simulating clicks, then closes each tab on success.</InfoIconWithTooltip>
        </span>
        {isDone && (
          <button className={styles.resetBtn} onClick={resetState}>
            Reset
          </button>
        )}
      </div>

      {/* Tab grid */}
      <div className={styles.content}>
        <div className={styles.previewContainer}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>YouTube Tabs ({eligibleTabs.length})</span>
            {eligibleTabs.length > 0 && !isRunning && (
              <button className={styles.toggleAllBtn} onClick={toggleAll}>
                {allSelected ? 'Select None' : 'Select All'}
              </button>
            )}
          </div>

          <div className={styles.previewGridScroll}>
            {eligibleTabs.length === 0 ? (
              <div className={styles.emptyState}>No YouTube watch tabs open.</div>
            ) : (
              <div className={styles.previewGrid}>
                {eligibleTabs.map(tab => {
                  const isExcluded = excludedIds.has(tab.id);
                  const status = tabStatuses[tab.id];
                  return (
                    <div
                      key={tab.id}
                      className={`${styles.previewCard} ${isExcluded ? styles.previewCardExcluded : ''} ${isRunning ? styles.previewCardLocked : ''}`}
                      onClick={() => toggleTab(tab.id)}
                    >
                      <StatusBadge status={status} />
                      <div className={styles.previewCardTop}>
                        <Favicon src={tab.favIconUrl} className={styles.previewFavicon} fallbackClass={styles.previewFaviconFallback} />
                        {!isRunning && (
                          <div className={`${styles.checkbox} ${!isExcluded ? styles.checkboxChecked : ''}`}>
                            {!isExcluded && '✓'}
                          </div>
                        )}
                      </div>
                      <div className={styles.previewInfo}>
                        <div className={styles.previewTitleText}>{tab.title || '(Untitled)'}</div>
                        <div className={styles.previewUrlText}>{tab.url}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Debug log */}
        {debugLines.length > 0 && (
          <div className={styles.debugLog} ref={debugLogRef}>
            {debugLines.map((line, i) => (
              <div key={i} className={styles.debugLine}>{line}</div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.footerMeta}>{footerMeta}</span>
        </div>
        <div className={styles.footerRight}>
          {!isRunning && (
            <button className={styles.btnCancel} onClick={() => { if (onClose) onClose(); }}>
              {isDone ? 'Close' : 'Cancel'}
            </button>
          )}
          {isRunning ? (
            <button className={`${styles.btnConfirm} ${styles.btnStop}`} onClick={handleStop}>
              Stop
            </button>
          ) : (
            <button
              className={styles.btnConfirm}
              onClick={isDone ? () => { if (onClose) onClose(); } : handleRun}
              disabled={!isDone && includedTabs.length === 0}
            >
              {isDone ? 'Done' : 'Save to Watch Later'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
