import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  ClockCountdown,
  Trash,
  ArrowCounterClockwise,
  Lightning,
  Skull,
} from '@phosphor-icons/react';
import styles from './AutoTabCloserPanel.module.css';
import Select from '../../Shared/Select';
import Favicon from '../../Shared/Favicon';
import { useTriage } from '../../../store/TriageProvider';
import { useAutoCloser } from '../../../hooks/useAutoCloser';
import {
  AUTO_CLOSER_THRESHOLDS,
  THRESHOLDS,
  thresholdFromMs,
} from '../../../utils/autoCloseThresholds';
import { relativeTime } from '../../../utils/formatters';
import Tooltip from '../../Shared/Tooltip';
import InfoIconWithTooltip from '../../Shared/InfoIconWithTooltip';
import { useMonitor } from '../../../store/MonitorProvider';
import { pickQuip, CLOSER_QUIPS } from '../../../constants/quips';
import { MagicDotProvider, useMagicDot } from '../../Tutorial/MagicDotProvider';
import MagicDot from '../../Tutorial/MagicDot';
import { useTutorialSequence } from '../../Tutorial/useTutorialSequence';

const INTERVALS = [
  { value: '15', label: 'Every 15 min' },
  { value: '30', label: 'Every 30 min' },
  { value: '60', label: 'Every hour' },
  { value: '180', label: 'Every 3 hours' },
  { value: '360', label: 'Every 6 hours' },
];

function DuplicateBadge({ count }: { count: number }) {
  const [hovered, setHovered] = useState<boolean>(false);
  const badgeRef = useRef(null);
  return (
    <>
      <div
        ref={badgeRef}
        className={styles.duplicateBadge}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {count}
      </div>
      <Tooltip anchorRef={badgeRef} visible={hovered} placement="top">
        Selecting this tab will also select all {count} duplicate copies
      </Tooltip>
    </>
  );
}

import GridTabPreview from '../../Shared/GridTabPreview';

function ShimmerRow() {
  return (
    <div className={styles.graveRow}>
      <div
        className={`${styles.graveFaviconFallback} ${styles.shimmer}`}
        style={{ width: 14, height: 14 }}
      />
      <div className={styles.graveInfo}>
        <div className={`${styles.shimmerBar} ${styles.shimmerBarTitle}`} />
        <div className={`${styles.shimmerBar} ${styles.shimmerBarUrl}`} />
      </div>
    </div>
  );
}

function GraveyardRow({
  entry,
  onRestore,
}: {
  entry: import('../../../hooks/useAutoCloser').GraveyardEntry;
  onRestore: (entry: import('../../../hooks/useAutoCloser').GraveyardEntry) => void;
}) {
  return (
    <div className={styles.graveRow}>
      <Favicon
        src={entry.favIconUrl || ''}
        className={styles.graveFavicon}
        fallbackClass={styles.graveFaviconFallback}
      />
      <div className={styles.graveInfo}>
        <div className={styles.graveTitle}>{entry.title || '(Untitled)'}</div>
        <div className={styles.graveUrl}>{entry.url}</div>
      </div>
      <div className={styles.graveMeta}>
        <span className={styles.graveTime}>{relativeTime(entry.closedAt)}</span>
        <button
          className={styles.restoreBtn}
          onClick={() => onRestore(entry)}
          title="Restore this tab"
        >
          <ArrowCounterClockwise size={13} weight="bold" />
        </button>
      </div>
    </div>
  );
}

export interface AutoTabCloserPanelProps {
  onClose: () => void;
}
export default function AutoTabCloserPanel({ onClose }: AutoTabCloserPanelProps) {
  return (
    <MagicDotProvider>
      <AutoTabCloserWorkerPanelInner onClose={onClose} />
    </MagicDotProvider>
  );
}

function AutoTabCloserWorkerPanelInner({ onClose }: { onClose: () => void }) {
  const { registerTarget } = useMagicDot();
  const { showTutorial, sequence } = useTutorialSequence('auto-close');

  const { state } = useTriage();
  const { postStatus } = useMonitor();
  const { settings, updateSettings, graveyard, restoreTab, clearGraveyard, loading } =
    useAutoCloser();

  // Local form state — staged until the user submits
  const [enabled, setEnabled] = useState<boolean>(settings.enabled);
  const [thresholdMs, setThresholdMs] = useState<number>(settings.thresholdMs);
  const [intervalMinutes, setIntervalMinutes] = useState(settings.intervalMinutes);

  // Sync from storage once it finishes loading
  useEffect(() => {
    if (!loading) {
      setEnabled(settings.enabled);
      setThresholdMs(settings.thresholdMs);
      setIntervalMinutes(settings.intervalMinutes);
    }
  }, [loading, settings.enabled, settings.thresholdMs, settings.intervalMinutes]);

  const hasChanges =
    enabled !== settings.enabled ||
    thresholdMs !== settings.thresholdMs ||
    intervalMinutes !== settings.intervalMinutes;

  const thresholdKey = thresholdFromMs(thresholdMs)?.value ?? '7_days';

  const tabsToClose = useMemo(() => {
    // if (!enabled) return [];
    const thresholdObj = THRESHOLDS.find((t) => t.value === thresholdKey);
    if (!thresholdObj || thresholdObj.ms < 0) return [];
    const now = Date.now();
    return state.tabs.filter(
      (t) =>
        !t.processed &&
        !t.gone &&
        !t.pinned &&
        typeof t.lastAccessed === 'number' &&
        now - t.lastAccessed >= thresholdObj.ms,
    );
  }, [state.tabs, thresholdKey, enabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({ enabled, thresholdMs, intervalMinutes });
    postStatus(`Auto-closer settings saved.\n${pickQuip(CLOSER_QUIPS.save)}`, { level: 'success' });
    onClose();
  };

  return (
    <form className={styles.autoCloserWorkerCard} onSubmit={handleSubmit}>
      {showTutorial && <MagicDot sequence={sequence} introDelay={600} />}
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <span className={styles.title} ref={registerTarget('ac-header')}>
          <Lightning size={16} weight="duotone" />
          Auto-Closer
          <InfoIconWithTooltip placement="right">
            Runs in the background and automatically cleans up tabs based on your rules, saving
            system resources.
          </InfoIconWithTooltip>
        </span>
        <label
          className={styles.enableToggle}
          title={enabled ? 'Disable auto-closer' : 'Enable auto-closer'}
          ref={registerTarget('ac-toggle')}
        >
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className={styles.toggleInput}
          />

          <span className={styles.toggleLabel}>{enabled ? 'Active' : 'Off'}</span>
          <span className={`${styles.toggleTrack} ${enabled ? styles.toggleTrackOn : ''}`}>
            <span className={styles.toggleThumb} />
          </span>
        </label>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className={styles.content}>
        <div className={`${styles.sectionBody} ${!enabled ? styles.sectionBodyDisabled : ''}`}>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingTitle}>
                <ClockCountdown size={16} weight="duotone" className={styles.settingIcon} />
                Close tabs older than
              </div>
              <div className={styles.settingDesc}>
                Tabs last accessed before this threshold will be closed automatically.
              </div>
            </div>
            <div className={styles.settingControl} ref={registerTarget('ac-threshold')}>
              <Select
                value={thresholdKey}
                onChange={(e) => {
                  const entry = AUTO_CLOSER_THRESHOLDS.find((t) => t.value === e.target.value);
                  if (entry) setThresholdMs(entry.ms);
                }}
                options={AUTO_CLOSER_THRESHOLDS}
                disabled={!enabled}
              />
            </div>
          </div>

          <div className={styles.settingDivider} />

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingTitle}>Check interval</div>
              <div className={styles.settingDesc}>
                How often the background worker scans for old tabs.
              </div>
            </div>
            <div className={styles.settingControl}>
              <Select
                value={String(intervalMinutes)}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                options={INTERVALS}
                disabled={!enabled}
              />
            </div>
          </div>
        </div>

        {/* {enabled && ( */}
        <div className={styles.tabsPreviewContainer}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>Will close ({tabsToClose.length})</span>
          </div>
          <div className={styles.tabsPreviewScroll} ref={registerTarget('ac-grid')}>
            {tabsToClose.length === 0 ? (
              <div className={styles.emptyState}>No tabs currently exceed this threshold.</div>
            ) : (
              <div className={styles.previewGrid}>
                {tabsToClose.map((tab) => (
                  <div key={tab.id} className={styles.previewCard}>
                    {tab.duplicates && tab.duplicates.length > 0 && (
                      <DuplicateBadge count={tab.duplicates.length + 1} />
                    )}
                    <div className={styles.previewCardTop}>
                      <Favicon
                        src={tab.favIconUrl}
                        size={16}
                        className={styles.gridFavicon}
                        fallbackClass={styles.gridFaviconFallback}
                      />
                    </div>
                    <div className={styles.previewCardInfo}>
                      <div className={styles.previewCardTitle}>{tab.title || '(Untitled)'}</div>
                      <div className={styles.previewCardUrl}>{tab.url}</div>
                    </div>
                    <GridTabPreview tab={tab} className={styles.closerThumbnailOverride} />
                    {typeof tab.lastAccessed === 'number' && (
                      <div className={styles.previewCardAge}>{relativeTime(tab.lastAccessed)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* )} */}

        {/* Graveyard */}
        <div className={styles.previewContainer}>
          <div className={styles.previewHeader}>
            <span className={styles.previewTitle}>
              <Skull
                size={13}
                weight="duotone"
                style={{ marginRight: 5, verticalAlign: 'middle' }}
              />
              Graveyard ({graveyard.length})
            </span>
            {graveyard.length > 0 && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => {
                  const count = graveyard.length;
                  clearGraveyard();
                  postStatus(
                    `Graveyard cleared (${count} tab${count !== 1 ? 's' : ''}).\n${pickQuip(CLOSER_QUIPS.clear)}`,
                    { level: 'success' },
                  );
                }}
              >
                <Trash size={12} weight="bold" />
                Clear all
              </button>
            )}
          </div>
          <div className={styles.previewGridScroll} ref={registerTarget('ac-graveyard')}>
            {loading ? (
              <>
                <ShimmerRow />
                <ShimmerRow />
                <ShimmerRow />
              </>
            ) : graveyard.length === 0 ? (
              <div className={styles.emptyState}>
                <Skull size={28} weight="duotone" className={styles.emptyIcon} />
                <span>No auto-closed tabs yet.</span>
                <span className={styles.emptySubtext}>
                  Tabs closed by the worker will appear here so you can restore them.
                </span>
              </div>
            ) : (
              graveyard.map((entry) => (
                <GraveyardRow
                  key={entry.id}
                  entry={entry}
                  onRestore={(tab) => {
                    restoreTab(tab);
                    postStatus(`Tab restored from the dead.\n${pickQuip(CLOSER_QUIPS.restore)}`, {
                      level: 'success',
                    });
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.footerMeta}>
            {graveyard.length > 0
              ? `${graveyard.length} tab${graveyard.length !== 1 ? 's' : ''} in graveyard · clears on browser close`
              : 'Graveyard clears when the browser closes'}
          </span>
        </div>
        <div className={styles.footerRight}>
          <button
            type="submit"
            className={styles.btnDone}
            disabled={!hasChanges}
            ref={registerTarget('ac-save')}
          >
            Save & Apply
          </button>
        </div>
      </div>
    </form>
  );
}
