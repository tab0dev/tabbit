import React, { useState, useEffect, useCallback } from 'react';
import { NetworkSlash, PushPin, Hash, Question } from '@phosphor-icons/react';
import styles from './AutoSmusherPanel.module.css';
import Favicon from '../../Shared/Favicon';
import {
  useAutoSmusher,
  useDuplicateTabs,
  closeSmushDuplicates,
} from '../../../hooks/useAutoSmusher';
import InfoIconWithTooltip from '../../Shared/InfoIconWithTooltip';
import SmushConfirmModal from '../../Modals/SmushConfirmModal';
import { useMonitor } from '../../../store/MonitorProvider';
import { pickQuip, SMUSHER_QUIPS } from '../../../constants/quips';
import { MagicDotProvider, useMagicDot } from '../../Tutorial/MagicDotProvider';
import MagicDot from '../../Tutorial/MagicDot';
import { useTutorialSequence } from '../../Tutorial/useTutorialSequence';

import { TriageTab } from '../../../types';

// ─── DuplicateGroup ───────────────────────────────────────────────────────────
// Renders one URL group with all tabs that share it.
function DuplicateGroup({ normUrl, tabs }: { normUrl: string; tabs: TriageTab[] }) {
  return (
    <div className={styles.dupGroup}>
      <div className={styles.dupGroupUrl} title={normUrl}>
        {normUrl}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} className={styles.dupTabRow}>
          <Favicon
            src={tab.favIconUrl}
            size={12}
            className={styles.dupFavicon}
            fallbackClass={styles.dupFaviconFallback}
          />
          <span className={styles.dupTabTitle}>{tab.title || '(Untitled)'}</span>
        </div>
      ))}
    </div>
  );
}

// ─── AutoSmusherPanel ─────────────────────────────────────────────────────────
export interface AutoSmusherPanelProps {
  onClose: () => void;
}
export default function AutoSmusherPanel({ onClose }: AutoSmusherPanelProps) {
  return (
    <MagicDotProvider>
      <AutoSmusherPanelInner onClose={onClose} />
    </MagicDotProvider>
  );
}

function AutoSmusherPanelInner({ onClose }: { onClose: () => void }) {
  const { registerTarget } = useMagicDot();
  const { showTutorial, sequence } = useTutorialSequence('auto-smusher');

  const { settings, updateSettings, loading } = useAutoSmusher();
  const { postStatus } = useMonitor();

  // ── Local form state (staged until Save & Apply) ─────────────────────────
  const [enabled, setEnabled] = useState(settings.enabled);
  const [skipPinned, setSkipPinned] = useState(settings.skipPinned);
  const [ignoreFragments, setIgnoreFragments] = useState(settings.ignoreFragments);
  const [ignoreQueryStrings, setIgnoreQueryStrings] = useState<boolean>(
    settings.ignoreQueryStrings,
  );

  // Sync once storage finishes loading
  useEffect(() => {
    if (!loading) {
      setEnabled(settings.enabled);
      setSkipPinned(settings.skipPinned);
      setIgnoreFragments(settings.ignoreFragments);
    }
  }, [
    loading,
    settings.enabled,
    settings.skipPinned,
    settings.ignoreFragments,
    settings.ignoreQueryStrings,
  ]);

  const hasChanges =
    enabled !== settings.enabled ||
    skipPinned !== settings.skipPinned ||
    ignoreFragments !== settings.ignoreFragments ||
    ignoreQueryStrings !== settings.ignoreQueryStrings;

  // ── Live duplicate detection (via hook) ──────────────────────────────────
  const { duplicateGroups, duplicateTabCount } = useDuplicateTabs({
    skipPinned,
    ignoreFragments,
    ignoreQueryStrings,
  });

  // ── Confirm-modal state ──────────────────────────────────────────────────
  const [pendingGroups, setPendingGroups] = useState<[string, TriageTab[]][] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({ enabled, skipPinned, ignoreFragments, ignoreQueryStrings });

    if (enabled && duplicateGroups.length > 0) {
      setPendingGroups(duplicateGroups);
      return;
    }
    postStatus(`Auto Smusher updated.\n${pickQuip(SMUSHER_QUIPS.save)}`, { level: 'success' });
    onClose();
  };

  const handleConfirm = useCallback(async () => {
    setPendingGroups(null);
    if (!pendingGroups) return;
    try {
      const count = pendingGroups.reduce((acc, [, tabs]) => acc + tabs.length - 1, 0);
      await closeSmushDuplicates(pendingGroups);
      postStatus(
        `✓ ${count} duplicate tab${count !== 1 ? 's' : ''} smushed.\n${pickQuip(SMUSHER_QUIPS.smush)}`,
        { level: 'success' },
      );
    } catch (err) {
      console.warn('[Tabbit] Auto Smusher batch close failed:', err);
    }
    onClose();
  }, [pendingGroups, onClose, postStatus]);

  const handleSkip = useCallback(() => {
    setPendingGroups(null);
    onClose();
  }, [onClose]);

  return (
    <>
      {pendingGroups && (
        <SmushConfirmModal
          duplicateGroups={pendingGroups}
          onConfirm={handleConfirm}
          onSkip={handleSkip}
        />
      )}
      <form className={styles.autoSmusherPanel} onSubmit={handleSubmit}>
        {showTutorial && <MagicDot sequence={sequence} introDelay={600} />}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className={styles.header}>
          <span className={styles.title} ref={registerTarget('sm-header')}>
            <NetworkSlash size={16} weight="duotone" />
            Auto Smusher
            <InfoIconWithTooltip placement="right">
              Runs in the background and automatically closes duplicate tabs the moment they're
              opened, then refocuses you on the original copy.
            </InfoIconWithTooltip>
          </span>
          <label
            className={styles.enableToggle}
            title={enabled ? 'Disable auto smusher' : 'Enable auto smusher'}
            ref={registerTarget('sm-toggle')}
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

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className={styles.content}>
          {/* Settings card */}
          <div
            className={`${styles.sectionBody} ${!enabled ? styles.sectionBodyDisabled : ''}`}
            ref={registerTarget('sm-settings')}
          >
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingTitle}>
                  <PushPin size={16} weight="duotone" className={styles.settingIcon} />
                  Skip pinned tabs
                </div>
                <div className={styles.settingDesc}>
                  Pinned tabs are never considered duplicates — they won't be closed and won't act
                  as the "original" to redirect to.
                </div>
              </div>
              <div className={styles.settingControl}>
                <input
                  type="checkbox"
                  className={styles.toggle}
                  checked={skipPinned}
                  onChange={(e) => setSkipPinned(e.target.checked)}
                />
              </div>
            </div>

            <div className={styles.settingDivider} />

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingTitle}>
                  <Hash size={16} weight="duotone" className={styles.settingIcon} />
                  Ignore URL fragments
                </div>
                <div className={styles.settingDesc}>
                  Treat URLs differing only by <code className={styles.code}>#anchor</code> as
                  duplicates — useful for SPA hash routing.
                </div>
              </div>
              <div className={styles.settingControl}>
                <input
                  type="checkbox"
                  className={styles.toggle}
                  checked={ignoreFragments}
                  onChange={(e) => setIgnoreFragments(e.target.checked)}
                />
              </div>
            </div>

            <div className={styles.settingDivider} />

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <div className={styles.settingTitle}>
                  <Question size={16} weight="duotone" className={styles.settingIcon} />
                  Ignore query strings
                </div>
                <div className={styles.settingDesc}>
                  Strip <code className={styles.code}>?query=params</code> before comparing — handy
                  when tracking params or sort orders vary between tabs.
                </div>
              </div>
              <div className={styles.settingControl}>
                <input
                  type="checkbox"
                  className={styles.toggle}
                  checked={ignoreQueryStrings}
                  onChange={(e) => setIgnoreQueryStrings(e.target.checked)}
                />
              </div>
            </div>
          </div>

          {/* Live duplicate preview */}
          <div className={styles.previewContainer} ref={registerTarget('sm-preview')}>
            <div className={styles.previewHeader}>
              <span className={styles.previewTitle}>
                Live preview — duplicates open ({duplicateGroups.length})
              </span>
            </div>
            <div className={styles.previewScroll}>
              {duplicateGroups.length === 0 ? (
                <div className={styles.emptyState}>
                  <NetworkSlash size={28} weight="duotone" className={styles.emptyIcon} />
                  <span>No duplicate tabs currently open.</span>
                  <span className={styles.emptySubtext}>
                    Duplicates detected across your open tabs will be listed here.
                  </span>
                </div>
              ) : (
                <div className={styles.dupList}>
                  {duplicateGroups.map(([normUrl, tabs]) => (
                    <DuplicateGroup key={normUrl} normUrl={normUrl} tabs={tabs} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <span className={styles.footerMeta}>
              {duplicateTabCount > 0
                ? `${duplicateTabCount} duplicate tab${duplicateTabCount !== 1 ? 's' : ''} open`
                : 'No duplicates currently open'}
            </span>
          </div>
          <div className={styles.footerRight}>
            <button
              type="submit"
              className={styles.btnDone}
              disabled={!hasChanges}
              ref={registerTarget('sm-save')}
            >
              Save &amp; Apply
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
