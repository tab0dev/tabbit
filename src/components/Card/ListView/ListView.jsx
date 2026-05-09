import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useRangeSelection } from './useRangeSelection';
import uFuzzy from '@leeoniya/ufuzzy';
import { ListBullets, MagnifyingGlassIcon, X, BookmarkSimple, Tabs, Check, SquaresFour, List as ListIcon } from '@phosphor-icons/react';
import styles from './ListView.module.css';
import { useTriage } from '../../../store/TriageProvider';
import { useTriageActions } from '../../../hooks/useTriageActions';
import { usePicker } from '../../../store/PickerProvider';
import { extractDomain } from '../../../utils/formatters';
import { applyTabProcessing } from '../../../services/tabProcessingService';
import { GROUP_COLORS } from '../../Overlay/TabGroupPickerPanel';
import ListViewTabCard from './ListViewTabCard';
import ListViewSidebar from './ListViewSidebar';
import DragSelectLayer from './DragSelectLayer';
import GroupBySelect from './GroupBySelect';

const uf = new uFuzzy({ intraMode: 1 });

export default function ListView({ onClose }) {
  const { state } = useTriage();
  const actions = useTriageActions();
  const { setActivePicker, setBatchTarget } = usePicker();


  // ── View Mode ────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // ── Search ───────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // ── Sort ──────────────────────────────────────────────────────────────────
  const [sortMode, setSortMode] = useState('auto');

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterGroupIds, setFilterGroupIds] = useState(new Set());
  const [filterDomains, setFilterDomains] = useState(new Set());

  // ── Grouping ─────────────────────────────────────────────────────────────
  const [groupBy, setGroupBy] = useState('none');

  // ── Derived: eligible tabs (unprocessed, not gone) ───────────────────────
  const eligibleTabs = useMemo(
    () => state.tabs.filter(t => !t.processed && !t.gone),
    [state.tabs]
  );

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sortedTabs = useMemo(
    () => applyTabProcessing(eligibleTabs, sortMode),
    [eligibleTabs, sortMode]
  );

  // ── Filter by sidebar ────────────────────────────────────────────────────
  const filteredTabs = useMemo(() => {
    return sortedTabs.filter(tab => {
      if (filterGroupIds.size > 0 && !filterGroupIds.has(tab.groupId ?? -1)) return false;
      if (filterDomains.size > 0 && !filterDomains.has(extractDomain(tab.url))) return false;
      return true;
    });
  }, [sortedTabs, filterGroupIds, filterDomains]);

  // ── Search ────────────────────────────────────────────────────────────────
  const displayTabs = useMemo(() => {
    if (!searchQuery.trim()) return filteredTabs;
    const haystack = filteredTabs.map(t => `${t.title} ${t.url}`);
    const [, info, order] = uf.search(haystack, searchQuery.trim());
    if (!order?.length) return [];
    return order.map(oi => filteredTabs[info.idx[oi]]);
  }, [filteredTabs, searchQuery]);

  // ── Selection (range-select logic lives in useRangeSelection) ─────────────
  // Placed after displayTabs since it takes the ordered item list as input.
  const {
    selectedIds,
    softSelectedIds,
    shiftHeld,
    handleCardClick,
    handleCardHover,
    handleCardHoverEnd,
    addToSelection,
    selectAll,
    selectNone,
  } = useRangeSelection(displayTabs);

  // ── Scroll container ref (used by DragSelectLayer) ──────────────────────
  const scrollRef = useRef(null);

  // ── Grouping ──────────────────────────────────────────────────────────────
  const groupedTabs = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: null, tabs: displayTabs }];

    const groups = new Map();
    displayTabs.forEach(tab => {
      let key, label, color;
      if (groupBy === 'tab_group') {
        const gid = tab.groupId ?? -1;
        key = String(gid);
        if (gid === -1) {
          label = 'Ungrouped';
          color = null;
        } else {
          const g = state.tabGroups.find(g => g.id === gid);
          label = g?.title || 'Untitled';
          color = GROUP_COLORS[g?.color] ?? GROUP_COLORS.grey;
        }
      } else if (groupBy === 'domain') {
        key = extractDomain(tab.url);
        label = key;
        color = null;
      } else if (groupBy === 'window') {
        key = String(tab.windowId);
        label = null; // resolved below after grouping
        color = null;
      }

      if (!groups.has(key)) groups.set(key, { key, label, color, tabs: [] });
      groups.get(key).tabs.push(tab);
    });

    const result = Array.from(groups.values());

    // For window grouping, assign human-readable labels (Window 1, 2, …)
    if (groupBy === 'window') {
      result.forEach((g, i) => { g.label = `Window ${i + 1} (${g.tabs.length} tab${g.tabs.length !== 1 ? 's' : ''})`; });
    }

    return result;
  }, [displayTabs, groupBy, state.tabGroups]);

  // ── Tab group lookup (for card border colors) ─────────────────────────────
  const tabGroupMap = useMemo(() => {
    const m = new Map();
    (state.tabGroups || []).forEach(g => m.set(g.id, g));
    return m;
  }, [state.tabGroups]);

  const getGroupColor = useCallback((tab) => {
    const gid = tab.groupId ?? -1;
    if (gid === -1) return null;
    const g = tabGroupMap.get(gid);
    return g ? (GROUP_COLORS[g.color] ?? GROUP_COLORS.grey) : null;
  }, [tabGroupMap]);

  // ── Selection helpers — provided by useRangeSelection ───────────────────

  const allSelected = displayTabs.length > 0 && selectedIds.size === displayTabs.length;

  // ── Selected tab objects ──────────────────────────────────────────────────
  const selectedTabs = useMemo(
    () => eligibleTabs.filter(t => selectedIds.has(t.id)),
    [eligibleTabs, selectedIds]
  );

  // Note: setSelectedIds is intentionally not used directly here;
  // all selection mutations go through useRangeSelection's exported helpers.

  // ── Filter toggles ───────────────────────────────────────────────────────
  const toggleGroupFilter = useCallback((id) => {
    setFilterGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleDomainFilter = useCallback((domain) => {
    setFilterDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }, []);

  // ── Batch actions ─────────────────────────────────────────────────────────
  const handleBatchKeep = useCallback(() => {
    if (selectedTabs.length === 0) return;
    selectedTabs.forEach(tab => actions.keep(tab, true));
    setSelectedIds(new Set());
  }, [selectedTabs, actions]);

  const handleBatchClose = useCallback(() => {
    if (selectedTabs.length === 0) return;
    actions.closeBatch(selectedTabs, true);
    setSelectedIds(new Set());
  }, [selectedTabs, actions]);

  const handleBatchBookmark = useCallback(() => {
    if (selectedTabs.length === 0) return;
    setBatchTarget({ tabs: selectedTabs });
    setActivePicker('bookmark');
  }, [selectedTabs, setBatchTarget, setActivePicker]);

  const handleBatchGroup = useCallback(() => {
    if (selectedTabs.length === 0) return;
    setBatchTarget({ tabs: selectedTabs });
    setActivePicker('group');
  }, [selectedTabs, setBatchTarget, setActivePicker]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  React.useEffect(() => {
    function onKeyDown(e) {
      // Don't intercept when typing in the search input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (selectedIds.size > 0) selectNone();
        else if (onClose) onClose();
      }
      if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        selectAll();
      }
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('listview-search')?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedIds.size, selectNone, selectAll, onClose]);

  // Also handle Ctrl/Cmd+A when NOT in an input
  React.useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          selectAll();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectAll]);

  const hasSelection = selectedIds.size > 0;

  const hasActiveFilters = filterGroupIds.size > 0 || filterDomains.size > 0;

  return (
    <div className={styles.listView}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>
          <ListBullets size={16} weight="duotone" />
          All Tabs
          {/* <span className={styles.titleCount}>{eligibleTabs.length}</span> */}
        </span>

        {/* Search */}
        <div className={styles.searchRow}>
          <MagnifyingGlassIcon size={14} weight="duotone" color="var(--text-muted)" />
          <input
            id="listview-search"
            className={styles.searchInput}
            placeholder="Search tabs…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                if (searchQuery) setSearchQuery('');
                else e.target.blur();
              }
            }}
          />
          {searchQuery && (
            <button
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
            >
              <X size={12} weight="bold" />
            </button>
          )}
        </div>

        {/* Header controls: GroupBy · View mode · Close */}
        <div className={styles.headerControls}>
          <GroupBySelect
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            options={[
              { value: 'none', label: 'No Grouping', shortLabel: 'Ungrouped' },
              { value: 'tab_group', label: 'Group by Tab Group', shortLabel: 'By Group' },
              { value: 'domain', label: 'Group by Domain', shortLabel: 'By Domain' },
              { value: 'window', label: 'Group by Window', shortLabel: 'By Window' },
            ]}
          />
          <div className={styles.viewToggleGroup}>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <SquaresFour size={15} weight="duotone" />
            </button>
            <button
              className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <ListIcon size={15} weight="duotone" />
            </button>
          </div>
        </div>
      </div>

      {/* Body: sidebar + grid */}
      <div className={styles.body}>
        <ListViewSidebar
          tabs={eligibleTabs}
          tabGroups={state.tabGroups || []}
          sortMode={sortMode}
          onSortChange={setSortMode}
          filterGroupIds={filterGroupIds}
          onToggleGroupFilter={toggleGroupFilter}
          filterDomains={filterDomains}
          onToggleDomainFilter={toggleDomainFilter}
        />

        <div className={styles.gridArea}>
          {/* Slim context sub-header */}
          <div className={styles.gridHeader}>
            <div className={styles.gridHeaderLeft}>
              {hasActiveFilters && (
                <button
                  className={styles.clearFiltersBtn}
                  onClick={() => { setFilterGroupIds(new Set()); setFilterDomains(new Set()); }}
                >
                  <X size={10} weight="bold" className={styles.clearFiltersX} />
                  Clear filters
                </button>
              )}
              <span className={styles.gridTitle}>
                {hasSelection
                  ? <><strong>{selectedIds.size}</strong> of {displayTabs.length} selected</>
                  : <><strong>{displayTabs.length}</strong> tab{displayTabs.length !== 1 ? 's' : ''}{searchQuery ? ` matching "${searchQuery}"` : ''}</>
                }
              </span>
            </div>
            <div className={styles.gridHeaderRight}>
              {hasSelection && (
                <button className={styles.toggleAllBtn} onClick={selectNone}>
                  Clear all
                </button>
              )}
              {displayTabs.length > 0 && (
                <button className={styles.toggleAllBtn} onClick={allSelected ? selectNone : selectAll}>
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
          </div>

          {/* Grid */}
          <DragSelectLayer
            scrollRef={scrollRef}
            onDragSelect={addToSelection}
            disabled={shiftHeld}
          />
          <div className={styles.gridScroll} ref={scrollRef}>
            {displayTabs.length === 0 ? (
              <div className={styles.emptyState}>
                {searchQuery
                  ? `No tabs match "${searchQuery}"`
                  : 'No tabs match the current filters.'}
              </div>
            ) : (
              <div className={viewMode === 'list' ? styles.listLayout : styles.grid}>
                {groupedTabs.map(group => (
                  <React.Fragment key={group.key}>
                    {group.label && (
                      <div className={styles.groupHeader}>
                        {group.color && <span className={styles.groupHeaderDot} style={{ background: group.color }} />}
                        {group.label}
                        <span className={styles.groupHeaderCount}>({group.tabs.length})</span>
                      </div>
                    )}
                    {group.tabs.map(tab => (
                      <ListViewTabCard
                        key={tab.id}
                        tab={tab}
                        isSelected={selectedIds.has(tab.id)}
                        isSoftSelected={softSelectedIds.has(tab.id)}
                        groupColor={getGroupColor(tab)}
                        onClick={handleCardClick}
                        onHover={handleCardHover}
                        onHoverEnd={handleCardHoverEnd}
                        viewMode={viewMode}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Batch action bar — only renders when items are selected */}
      {hasSelection && (
        <div className={styles.actionBar}>
          <span className={styles.actionBarCount}>
            {selectedIds.size} selected
          </span>
          <div className={styles.actionBarActions}>
            <button className={styles.btnAction} onClick={handleBatchKeep}>
              <Check size={13} weight="bold" />
              Keep
            </button>
            <button className={styles.btnAction} onClick={handleBatchBookmark}>
              <BookmarkSimple size={13} weight="duotone" />
              Bookmark
            </button>
            <button className={styles.btnAction} onClick={handleBatchGroup}>
              <Tabs size={13} weight="duotone" />
              Group
            </button>
            <button className={`${styles.btnAction} ${styles.btnActionDanger}`} onClick={handleBatchClose}>
              <X size={13} weight="bold" />
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
