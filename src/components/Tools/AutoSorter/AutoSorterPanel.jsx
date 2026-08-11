import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowsDownUp, Link, PushPin, Prohibit, ArrowClockwise } from '@phosphor-icons/react';
import styles from './AutoSorterPanel.module.css';
import Favicon from '../../Shared/Favicon';
import Select from '../../Shared/Select';
import { useAutoSorter } from '../../../hooks/useAutoSorter';
import InfoIconWithTooltip from '../../Shared/InfoIconWithTooltip';
import { useTriage } from '../../../store/TriageProvider';
import { useMonitor } from '../../../store/MonitorProvider';
import { pickQuip, SORTER_QUIPS } from '../../../constants/quips';
import { MagicDotProvider, useMagicDot } from '../../Tutorial/MagicDotProvider';
import MagicDot from '../../Tutorial/MagicDot';
import { useTutorialSequence } from '../../Tutorial/useTutorialSequence';
// ─── Client-side sort key — mirrors background.js sortTabsList logic ──────────
function getSortKey(tab, sortBy) {
  if (sortBy === 'title') return (tab.title || '').toLowerCase();
  try {
    const u = new URL(tab.url || tab.pendingUrl || '');
    return (u.hostname.replace(/^www\./i, '') + u.pathname + u.search + u.hash).toLowerCase();
  } catch {
    return (tab.url || '').toLowerCase();
  }
}

// ─── TabPreviewRow ─────────────────────────────────────────────────────────────
function TabPreviewRow({ tab, sortBy }) {
  const displayUrl = (() => {
    try { return new URL(tab.url).hostname.replace(/^www\./i, ''); } catch { return tab.url; }
  })();

  return (
    <div className={styles.previewRow}>
      <Favicon
        src={tab.favIconUrl}
        size={12}
        className={styles.previewFavicon}
        fallbackClass={styles.previewFaviconFallback}
      />
      {sortBy === 'url' ? (
        <>
          <span className={styles.previewDomainPrimary}>{displayUrl}</span>
          <span className={styles.previewDot}>·</span>
          <span className={styles.previewTitleDim}>{tab.title || '(Untitled)'}</span>
        </>
      ) : (
        <>
          <span className={styles.previewTitle}>{tab.title || '(Untitled)'}</span>
          <span className={styles.previewDomain}>{displayUrl}</span>
        </>
      )}
    </div>
  );
}

// ─── AutoSorterPanel ──────────────────────────────────────────────────────────
export default function AutoSorterPanel({ onClose }) {
  return (
    <MagicDotProvider>
      <AutoSorterPanelInner onClose={onClose} />
    </MagicDotProvider>
  );
}

function AutoSorterPanelInner({ onClose }) {
  const { registerTarget } = useMagicDot();
  const { showTutorial, sequence } = useTutorialSequence('auto-sorter');

  const { state } = useTriage();
  const { settings, updateSettings, loading } = useAutoSorter();
  const { postStatus } = useMonitor();

  // ── Local form state (staged until Save & Apply) ─────────────────────────
  const [autoSortEnabled, setAutoSortEnabled] = useState(settings.autoSortEnabled);
  const [sortBy, setSortBy] = useState(settings.sortBy);
  const [sortPinnedTabs, setSortPinnedTabs] = useState(settings.sortPinnedTabs);
  const [groupSuspendedTabs, setGroupSuspendedTabs] = useState(settings.groupSuspendedTabs);
  const [tabSuspenderExtensionId, setTabSuspenderExtensionId] = useState(settings.tabSuspenderExtensionId);

  // Sync once storage finishes loading
  useEffect(() => {
    if (!loading) {
      setAutoSortEnabled(settings.autoSortEnabled);
      setSortBy(settings.sortBy);
      setSortPinnedTabs(settings.sortPinnedTabs);
      setGroupSuspendedTabs(settings.groupSuspendedTabs);
      setTabSuspenderExtensionId(settings.tabSuspenderExtensionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const hasChanges =
    autoSortEnabled !== settings.autoSortEnabled ||
    sortBy !== settings.sortBy ||
    sortPinnedTabs !== settings.sortPinnedTabs ||
    groupSuspendedTabs !== settings.groupSuspendedTabs ||
    tabSuspenderExtensionId !== settings.tabSuspenderExtensionId;

  // ── Live sort preview — grouped by window ───────────────────────────────
  // Returns an ordered array of [windowId, sortedTabs[]] so the render can
  // show a window-label header between each window's tab rows.
  const previewByWindow = useMemo(() => {
    const tabs = (state.tabs ?? []).filter(
      (t) => !t.gone && !t.processed && t.url &&
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('chrome-extension://'),
    );
    // Group by windowId, preserving insertion order
    const map = new Map();
    for (const tab of tabs) {
      if (!map.has(tab.windowId)) map.set(tab.windowId, []);
      map.get(tab.windowId).push(tab);
    }
    // Sort each window's tabs independently
    for (const [, windowTabs] of map) {
      windowTabs.sort((a, b) => getSortKey(a, sortBy).localeCompare(getSortKey(b, sortBy)));
    }
    return [...map.entries()];
  }, [state.tabs, sortBy]);

  const totalTabCount = previewByWindow.reduce((sum, [, tabs]) => sum + tabs.length, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await updateSettings({ autoSortEnabled, sortBy, sortPinnedTabs, groupSuspendedTabs, tabSuspenderExtensionId });
    postStatus(`Auto Sorter settings saved.\n${pickQuip(SORTER_QUIPS.save)}`, { level: 'success' });
    onClose();
  };

  const handleSortNow = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'sortTabs' });
    postStatus(`✓ ${totalTabCount} tab${totalTabCount !== 1 ? 's' : ''} sorted.\n${pickQuip(SORTER_QUIPS.sortNow)}`, { level: 'success' });
    onClose();
  }, [onClose, postStatus, totalTabCount]);

  return (
    <form className={styles.autoSorterPanel} onSubmit={handleSubmit}>
      {showTutorial && <MagicDot sequence={sequence} introDelay={600} />}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <span className={styles.title} ref={registerTarget('as-header')}>
          <ArrowsDownUp size={16} weight="duotone" />
          Auto Sorter
          <InfoIconWithTooltip placement="right">
            Automatically re-sorts your tabs whenever a new tab opens or navigates,
            keeping your browser permanently ordered.
          </InfoIconWithTooltip>
        </span>
        <label
          className={styles.enableToggle}
          title={autoSortEnabled ? 'Disable auto sorter' : 'Enable auto sorter'}
          ref={registerTarget('as-toggle')}
        >
          <input
            type="checkbox"
            checked={autoSortEnabled}
            onChange={(e) => setAutoSortEnabled(e.target.checked)}
            className={styles.toggleInput}
          />
          <span className={styles.toggleLabel}>{autoSortEnabled ? 'Active' : 'Off'}</span>
          <span className={`${styles.toggleTrack} ${autoSortEnabled ? styles.toggleTrackOn : ''}`}>
            <span className={styles.toggleThumb} />
          </span>
        </label>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className={styles.content}>

        {/* Settings card */}
        <div className={`${styles.sectionBody} ${!autoSortEnabled ? styles.sectionBodyDisabled : ''}`}>

          {/* Sort By */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingTitle}>
                <Link size={16} weight="duotone" className={styles.settingIcon} />
                Sort by
              </div>
              <div className={styles.settingDesc}>
                Sort alphabetically by each tab's URL or its page title.
              </div>
            </div>
            <div className={styles.settingControl} ref={registerTarget('as-sortby')}>
              <Select
                className={styles.select}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: 'url', label: 'URL' },
                  { value: 'title', label: 'Title' },
                ]}
              />
            </div>
          </div>

          <div className={styles.settingDivider} />

          {/* Sort pinned tabs */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingTitle}>
                <PushPin size={16} weight="duotone" className={styles.settingIcon} />
                Sort pinned tabs
              </div>
              <div className={styles.settingDesc}>
                Include pinned tabs when sorting. When off, pinned tabs stay anchored in place.
              </div>
            </div>
            <div className={styles.settingControl}>
              <input
                type="checkbox"
                className={styles.toggle}
                checked={sortPinnedTabs}
                onChange={(e) => setSortPinnedTabs(e.target.checked)}
              />
            </div>
          </div>

          {/* Cluster suspended tabs + extension ID — URL sort only */}
          {sortBy === 'url' && (
            <>
              <div className={styles.settingDivider} />

              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <div className={styles.settingTitle}>
                    <Prohibit size={16} weight="duotone" className={styles.settingIcon} />
                    Cluster suspended tabs
                  </div>
                  <div className={styles.settingDesc}>
                    If you use a tab suspender, this groups suspended tabs together at the
                    left side so they're easy to spot. Also works in tab groups.
                  </div>
                </div>
                <div className={styles.settingControl}>
                  <input
                    type="checkbox"
                    className={styles.toggle}
                    checked={groupSuspendedTabs}
                    onChange={(e) => setGroupSuspendedTabs(e.target.checked)}
                  />
                </div>
              </div>

              {groupSuspendedTabs && (
                <>
                  <div className={styles.settingDivider} />
                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <div className={styles.settingTitle}>Suspender extension ID</div>
                      <div className={styles.settingDesc}>
                        Defaults to <b>Tiny Suspender</b>. Find yours at{' '}
                        <code className={styles.code}>chrome://extensions</code> and paste
                        the 32-character ID here.
                      </div>
                    </div>
                    <div className={styles.settingControl}>
                      <input
                        type="text"
                        className={styles.textInput}
                        value={tabSuspenderExtensionId}
                        onChange={(e) => setTabSuspenderExtensionId(e.target.value)}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

        </div>

        {/* Live sort preview */}
        <div className={`${styles.previewContainer} ${sortBy === 'url' ? styles.previewContainerExpanded : ''}`} ref={registerTarget('as-preview')}>
          <div className={styles.previewHeader}>
            <span className={styles.previewHeaderTitle}>
              Sort preview · {totalTabCount} tab{totalTabCount !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              className={styles.sortNowBtn}
              onClick={handleSortNow}
              title="Sort tabs now without saving"
              ref={registerTarget('as-sortnow')}
            >
              <ArrowsDownUp size={13} weight="bold" />
              Sort now without saving
            </button>
          </div>
          <div className={styles.previewScroll}>
            {previewByWindow.length === 0 ? (
              <div className={styles.emptyState}>
                <ArrowsDownUp size={28} weight="duotone" className={styles.emptyIcon} />
                <span>No tabs to preview.</span>
                <span className={styles.emptySubtext}>
                  Open tabs will be shown here in their projected sorted order.
                </span>
              </div>
            ) : (
              <div className={styles.previewList}>
                {previewByWindow.map(([windowId, tabs], index) => (
                  <div key={windowId} className={styles.windowSection}>
                    {previewByWindow.length > 1 && (
                      <div className={styles.windowLabel}>
                        Window {index + 1} · {tabs.length} tab{tabs.length !== 1 ? 's' : ''}
                      </div>
                    )}
                    {tabs.map((tab) => (
                      <TabPreviewRow key={tab.id} tab={tab} sortBy={sortBy} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.footerMeta}>
            {totalTabCount > 0
              ? `${totalTabCount} tab${totalTabCount !== 1 ? 's' : ''} will be sorted`
              : 'No tabs to sort'}
          </span>
        </div>
        <div className={styles.footerRight}>
          <button type="submit" className={styles.btnDone} disabled={!hasChanges} ref={registerTarget('as-save')}>
            Save &amp; Apply
          </button>
        </div>
      </div>

    </form>
  );
}
