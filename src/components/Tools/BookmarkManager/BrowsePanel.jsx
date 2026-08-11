import React, { useMemo, useRef, useEffect, useState } from 'react';
import uFuzzy from '@leeoniya/ufuzzy';
import { ArrowSquareOut, ArrowUp, ArrowDown } from '@phosphor-icons/react';
import { DndContext, DragOverlay, PointerSensor, useSensors, useSensor } from '@dnd-kit/core';

import listStyles from '../ListView/ListView.module.css';
import styles from './BookmarkManagerCard.module.css';

import BookmarkManagerSidebar from './BookmarkManagerSidebar';
import BookmarkDragSelectLayer from './BookmarkDragSelectLayer';
import { BookmarkLeafRow, BookmarkTreeNode, BookmarkDropSpacer } from './BookmarkRows';
import { useBookmarkSelection } from './useBookmarkSelection';
import { useBookmarkDnd } from './useBookmarkDnd';
import { getSortedBookmarkLeaves } from '../../../services/bookmarkService';
import { sortTree, matchesAccessFilter, matchesAgeFilter, matchesContentFilter, flattenVisibleTree } from '../../../utils/bookmarkUtils';
import { useMagicDot } from '../../Tutorial/MagicDotProvider';

const uf = new uFuzzy({ intraMode: 1 });
const STALE_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000; // 6 months

/**
 * BrowsePanel
 *
 * The "Browse" mode of the Bookmark Manager.
 * Renders the sidebar + scrollable list/tree area + action bar.
 *
 * Key layout note: the action bar must be a sibling of the flex-row .body,
 * not a child of it. The .browsePanelRoot class creates the outer column so the
 * action bar stacks below the sidebar+grid row (same pattern ListView uses).
 *
 * All selection logic lives in useBookmarkSelection (mirrors useRangeSelection).
 * Mutations are delegated to the parent via onArchive/onRemove callbacks.
 */
// Collects IDs of all folder nodes at tree depth <= maxDepth (0-indexed).
// Used to auto-expand ancestor folders when the deep-nested filter is active.
function collectFolderIdsUpToDepth(nodes, maxDepth, currentDepth = 0) {
  const ids = [];
  for (const n of nodes) {
    if (!n.isFolder) continue;
    ids.push(n.id);
    if (currentDepth < maxDepth && n.children?.length) {
      ids.push(...collectFolderIdsUpToDepth(n.children, maxDepth, currentDepth + 1));
    }
  }
  return ids;
}

// Collects IDs of all folder nodes at any depth (used by expand-all button).
function collectFolderIds(nodes) {
  const ids = [];
  for (const n of nodes) {
    if (n.isFolder) {
      ids.push(n.id);
      if (n.children?.length) ids.push(...collectFolderIds(n.children));
    }
  }
  return ids;
}

export default function BrowsePanel({
  fullTree,
  loading,
  expandedIds,
  onToggleExpand,
  onExpandAll,
  onMergeExpandIds,
  onCollapseAll,
  sortMode,
  sortAsc,
  onSortChange,
  folderFilter,
  onFolderFilterChange,
  accessFilter,
  onAccessFilterChange,
  ageFilter,
  onAgeFilterChange,
  contentFilter,
  onContentFilterChange,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  archiveReady,    // boolean — false until user has created/linked a cold storage file
  onAcceptStaged,
  onRefreshTree,   // NEW
}) {
  const { registerTarget } = useMagicDot();
  const scrollRef = useRef(null);
  const selectionRef = useRef({ selectedLeafIds: new Set(), selectedFolderIds: new Set() });

  const {
    draftTree,
    pendingMoves,
    pendingDeletes,
    pendingArchives,
    isDragging,
    dragId,
    overId,
    dndHandlers,
    handleAccept,
    handleRevert,
    stageDeletions,
    stageArchives,
    unstageDeletions,
    unstageArchives,
    stagedCount,
    movesCount,
    deletesCount,
    archivesCount,
    onRenameDraftFolder,
  } = useBookmarkDnd({
    fullTree,
    sortMode,
    expandedIds,
    selectionRef,
    onRefreshTree,
    onAcceptStaged,
  });

  // ── Derived: folder-filtered tree ────────────────────────────────────────
  const filteredTree = useMemo(() => {
    const treeSource = (pendingMoves.length > 0 || isDragging) ? draftTree : fullTree;
    if (folderFilter === 'all') return treeSource;
    return treeSource.filter(n => n.folderType === folderFilter || n.id === folderFilter);
  }, [fullTree, draftTree, pendingMoves.length, isDragging, folderFilter]);

  // ── Derived: Duplicate URLs ───────────────────────────────────────────────
  const allLeavesForDuplicates = useMemo(() => getSortedBookmarkLeaves(filteredTree, 'manual'), [filteredTree]);
  const { duplicateUrls, urlCounts } = useMemo(() => {
    const urls = new Set();
    const duplicates = new Set();
    const counts = new Map();
    for (const leaf of allLeavesForDuplicates) {
      if (!leaf.url) continue;
      counts.set(leaf.url, (counts.get(leaf.url) || 0) + 1);
      if (urls.has(leaf.url)) duplicates.add(leaf.url);
      else urls.add(leaf.url);
    }
    if (contentFilter !== 'duplicates') return { duplicateUrls: null, urlCounts: counts };
    return { duplicateUrls: duplicates, urlCounts: counts };
  }, [allLeavesForDuplicates, contentFilter]);

  // ── Auto-expand for structural content filters ────────────────────────────
  // When a structural filter is active in tree view, pre-expand enough of the
  // tree so the relevant folders are immediately visible.
  //
  //  'deep-nested'  → expand depth-0 and depth-1 only. Qualifying depth-2
  //                   folders become visible (but not opened), so the user sees
  //                   the nesting without being flooded with leaf bookmarks.
  //
  //  'empty-folder' → expand ALL ancestor folders. Empty folders can live at
  //                   any depth, so the full tree must be opened to surface them.
  //
  // Uses mergeExpandIds (union) so existing manual expand state is preserved.
  // filteredTree is intentionally not in the deps — we fire only on filter/view
  // changes, reading the folder snapshot current at that moment.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (viewMode !== 'tree') return;
    if (contentFilter === 'deep-nested') {
      const ids = collectFolderIdsUpToDepth(filteredTree, /* maxDepth= */ 1);
      if (ids.length > 0) onMergeExpandIds(ids);
    } else if (contentFilter === 'empty-folder' || contentFilter === 'duplicates') {
      const ids = collectFolderIds(filteredTree);
      if (ids.length > 0) onMergeExpandIds(ids);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentFilter, viewMode]);

  // ── Derived: sorted tree (tree view) ─────────────────────────────────────
  const sortedTree = useMemo(() => sortTree(filteredTree, sortMode, sortAsc), [filteredTree, sortMode, sortAsc]);

  // ── Derived: flat sorted leaves (list view + selection ordering) ──────────
  const sortedLeaves = useMemo(
    () => getSortedBookmarkLeaves(filteredTree, sortMode, sortAsc),
    [filteredTree, sortMode, sortAsc]
  );

  // ── Derived: filtered leaves (list view) ──────────────────────────────────
  // All three filters (access, age, content) must pass.
  // 'empty-folder' is a tree-only concept — no leaves to show in list view.
  const filteredLeaves = useMemo(() => {
    const noAccess  = !accessFilter  || accessFilter  === 'all';
    const noAge     = !ageFilter     || ageFilter     === 'all';
    const noContent = !contentFilter || contentFilter === 'all';
    if (noAccess && noAge && noContent) return sortedLeaves;
    if (contentFilter === 'empty-folder') return []; // no leaves inside empty folders
    return sortedLeaves.filter(leaf =>
      matchesAccessFilter(leaf, accessFilter) &&
      matchesAgeFilter(leaf, ageFilter) &&
      matchesContentFilter(leaf, contentFilter, duplicateUrls)
    );
  }, [sortedLeaves, accessFilter, ageFilter, contentFilter]);

  // ── Derived: filtered tree (tree view) ───────────────────────────────────
  // Recursively prunes non-matching leaves; removes empty folders.
  // Special case: 'empty-folder' inverts the logic — keep only folders that
  // have zero bookmark leaves anywhere in their subtree.
  const filteredTree2 = useMemo(() => {
    const noAccess  = !accessFilter  || accessFilter  === 'all';
    const noAge     = !ageFilter     || ageFilter     === 'all';
    const noContent = !contentFilter || contentFilter === 'all';
    if (noAccess && noAge && noContent) return sortedTree;

    // ── Empty-folder branch ────────────────────────────────────────────────
    // Walk the tree; keep only folder nodes whose subtree has no leaves.
    // Empty sub-folders are kept so nested empty hierarchies are visible.
    if (contentFilter === 'empty-folder') {
      function hasLeaf(nodes) {
        for (const n of nodes) {
          if (!n.isFolder) return true;
          if (hasLeaf(n.children ?? [])) return true;
        }
        return false;
      }
      function keepEmptyFolders(nodes) {
        const result = [];
        for (const node of nodes) {
          if (!node.isFolder) continue; // skip leaves — empty folders have none
          const filteredChildren = keepEmptyFolders(node.children ?? []);
          // Include this folder if it has no leaves (even if it has sub-folders)
          if (!hasLeaf(node.children ?? [])) {
            result.push({ ...node, children: filteredChildren });
          } else if (filteredChildren.length > 0) {
            // Folder itself has leaves, but some children are empty sub-folders
            result.push({ ...node, children: filteredChildren });
          }
        }
        return result;
      }
      return keepEmptyFolders(sortedTree);
    }

    // ── Normal branch ─────────────────────────────────────────────────────
    function pruneTree(nodes) {
      const result = [];
      for (const node of nodes) {
        if (node.isFolder) {
          const prunedChildren = pruneTree(node.children ?? []);
          if (prunedChildren.length > 0) result.push({ ...node, children: prunedChildren });
        } else {
          if (
            matchesAccessFilter(node, accessFilter) &&
            matchesAgeFilter(node, ageFilter) &&
            matchesContentFilter(node, contentFilter, duplicateUrls)
          ) {
            result.push(node);
          }
        }
      }
      return result;
    }
    return pruneTree(sortedTree);
  }, [sortedTree, accessFilter, ageFilter, contentFilter]);

  // ── Fuzzy search ──────────────────────────────────────────────────────────
  const displayLeaves = useMemo(() => {
    if (!searchQuery.trim()) return filteredLeaves;
    const haystack = filteredLeaves.map(n => `${n.title} ${n.url}`);
    const [, info, order] = uf.search(haystack, searchQuery.trim());
    if (!order?.length) return [];
    return order.map(oi => filteredLeaves[info.idx[oi]]);
  }, [filteredLeaves, searchQuery]);

  // ── Derived: search-pruned tree (tree view) ───────────────────────────────
  // When a search query is active, prune any leaf whose title+url doesn't
  // match, then collapse folders that become empty as a result.
  // The empty-folder content filter is exempted: there are no leaves to match
  // against, and search doesn't meaningfully apply to that view.
  const displayTree = useMemo(() => {
    const q = searchQuery.trim();
    if (!q || contentFilter === 'empty-folder') return filteredTree2;

    // Collect all leaves from the filtered tree so uFuzzy can rank them
    function collectLeaves(nodes, out = []) {
      for (const n of nodes) {
        if (n.isFolder) collectLeaves(n.children ?? [], out);
        else out.push(n);
      }
      return out;
    }
    const allLeaves = collectLeaves(filteredTree2);
    if (allLeaves.length === 0) return filteredTree2;

    const haystack = allLeaves.map(n => `${n.title} ${n.url}`);
    const [, info, order] = uf.search(haystack, q);
    if (!order?.length) return [];
    const matchedIds = new Set(order.map(oi => allLeaves[info.idx[oi]].id));

    function pruneForSearch(nodes) {
      const result = [];
      for (const node of nodes) {
        if (node.isFolder) {
          const prunedChildren = pruneForSearch(node.children ?? []);
          if (prunedChildren.length > 0) result.push({ ...node, children: prunedChildren });
        } else if (matchedIds.has(node.id)) {
          result.push(node);
        }
      }
      return result;
    }
    return pruneForSearch(filteredTree2);
  }, [filteredTree2, searchQuery, contentFilter]);

  // ── Selection — mirrors useRangeSelection pattern from ListView ───────────
  const {
    selectedLeafIds,
    selectedFolderIds,
    softSelectedIds,
    shiftHeld,
    hoverId,
    getFolderCheckState,
    handleLeafClick,
    handleFolderClick,
    handleItemHover,
    handleItemHoverEnd,
    addToSelection,
    selectAll,
    selectNone,
  } = useBookmarkSelection(displayLeaves);

  // Sync ref for DND
  useEffect(() => {
    selectionRef.current = { selectedLeafIds, selectedFolderIds };
  }, [selectedLeafIds, selectedFolderIds]);

  // ── Hovered URL and Offscreen Twins tracking ──────────────────────────────
  const hoveredUrl = useMemo(() => {
    if (!hoverId) return null;
    return allLeavesForDuplicates.find(l => l.id === hoverId)?.url || null;
  }, [hoverId, allLeavesForDuplicates]);

  const [offscreenTwins, setOffscreenTwins] = useState({ above: 0, below: 0 });

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let rafId;
    const checkOffscreen = () => {
      if (!hoveredUrl) {
        setOffscreenTwins({ above: 0, below: 0 });
        return;
      }
      // Use requestAnimationFrame to avoid thrashing during scroll
      rafId = requestAnimationFrame(() => {
        // Do not use CSS.escape() inside attribute quotes
        const safeUrl = hoveredUrl.replace(/"/g, '\\"');
        const twins = container.querySelectorAll(`[data-bookmark-url="${safeUrl}"]`);
        if (twins.length <= 1) {
          setOffscreenTwins({ above: 0, below: 0 });
          return;
        }

        let above = 0;
        let below = 0;
        const containerRect = container.getBoundingClientRect();
        
        twins.forEach(el => {
          const rect = el.getBoundingClientRect();
          // Element is entirely above the visible scroll area
          if (rect.bottom < containerRect.top) above++;
          // Element is entirely below the visible scroll area
          else if (rect.top > containerRect.bottom) below++;
        });
        
        setOffscreenTwins({ above, below });
      });
    };

    checkOffscreen();
    container.addEventListener('scroll', checkOffscreen);
    return () => {
      container.removeEventListener('scroll', checkOffscreen);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [hoveredUrl]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const draggedGroupCount = useMemo(() => {
    if (!dragId) return 0;
    if (selectedLeafIds.has(dragId) || selectedFolderIds.has(dragId)) {
      return flattenVisibleTree(draftTree, expandedIds).filter(v => selectedLeafIds.has(v.id) || selectedFolderIds.has(v.id)).length || 1;
    }
    return 1;
  }, [dragId, selectedLeafIds, selectedFolderIds, draftTree, expandedIds]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const allLeaves = useMemo(() => getSortedBookmarkLeaves(filteredTree, 'manual'), [filteredTree]);
  const coldCount = useMemo(() => {
    const now = Date.now();
    return allLeaves.filter(
      n => (now - (n.dateLastUsed ?? n.dateAdded ?? 0)) > STALE_THRESHOLD_MS
    ).length;
  }, [allLeaves]);

  const hasActiveFilters =
    (accessFilter  && accessFilter  !== 'all') ||
    (ageFilter     && ageFilter     !== 'all') ||
    (contentFilter && contentFilter !== 'all');
  const hasSelection = selectedLeafIds.size > 0 || selectedFolderIds.size > 0;
  const allSelected  = displayLeaves.length > 0 && selectedLeafIds.size === displayLeaves.length;

  const handleOpenClick = () => {
    if (selectedLeafIds.size === 1) {
      const selectedId = Array.from(selectedLeafIds)[0];
      const selectedBookmark = allLeaves.find(b => b.id === selectedId);
      if (selectedBookmark?.url) {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: selectedBookmark.url, active: true });
        } else {
          window.open(selectedBookmark.url, '_blank');
        }
      }
    }
  };

  // ── Action handlers — delegate to parent which calls refreshTree after ────
  const handleArchiveClick = () => {
    stageArchives(Array.from(selectedLeafIds), Array.from(selectedFolderIds));
    selectNone();
  };

  const handleRemoveClick = () => {
    stageDeletions(Array.from(selectedLeafIds), Array.from(selectedFolderIds));
    selectNone();
  };

  const handleUnArchiveClick = () => {
    unstageArchives(Array.from(selectedLeafIds), Array.from(selectedFolderIds));
    selectNone();
  };

  const handleUnRemoveClick = () => {
    unstageDeletions(Array.from(selectedLeafIds), Array.from(selectedFolderIds));
    selectNone();
  };

  // Determine if selection is mostly staged items or unstaged items
  const isSelectionMostlyDeletes = useMemo(() => {
    if (!hasSelection) return false;
    let count = 0;
    for (const id of selectedLeafIds) if (pendingDeletes.leaves.has(id)) count++;
    for (const id of selectedFolderIds) if (pendingDeletes.folders.has(id)) count++;
    return count > 0;
  }, [selectedLeafIds, selectedFolderIds, pendingDeletes]);

  const isSelectionMostlyArchives = useMemo(() => {
    if (!hasSelection) return false;
    let count = 0;
    for (const id of selectedLeafIds) if (pendingArchives.leaves.has(id)) count++;
    for (const id of selectedFolderIds) if (pendingArchives.folders.has(id)) count++;
    return count > 0;
  }, [selectedLeafIds, selectedFolderIds, pendingArchives]);

  // ── Render ────────────────────────────────────────────────────────────────
  // .browsePanelRoot is a flex column — body (row) on top, action bar on bottom.
  // This mirrors how ListView.jsx places actionBar as a sibling of .body,
  // both children of the outer .listView column container.
  return (
    <div className={styles.browsePanelRoot}>

      {/* flex-row: sidebar on left, grid area on right */}
      <div className={listStyles.body}>

        {/* Sidebar */}
        <BookmarkManagerSidebar
          sortMode={sortMode}
          sortAsc={sortAsc}
          onSortChange={onSortChange}
          folderFilter={folderFilter}
          onFolderFilterChange={onFolderFilterChange}
          accessFilter={accessFilter}
          onAccessFilterChange={onAccessFilterChange}
          ageFilter={ageFilter}
          onAgeFilterChange={onAgeFilterChange}
          contentFilter={contentFilter}
          onContentFilterChange={onContentFilterChange}
          totalCount={allLeaves.length}
          coldCount={coldCount}
        />

        {/* Grid area */}
        <div className={listStyles.gridArea}>
          {/* Sub-header */}
          <div className={listStyles.gridHeader}>
            <div className={listStyles.gridHeaderLeft}>
              {hasActiveFilters && (
                <button
                  className={listStyles.clearFiltersBtn}
                  onClick={() => { onAccessFilterChange('all'); onAgeFilterChange('all'); onContentFilterChange('all'); }}
                >
                  <span style={{ fontSize: 10, fontWeight: 'bold', marginRight: 2 }}>×</span>
                  Clear filters
                </button>
              )}
              <span className={listStyles.gridTitle} ref={registerTarget('bm-grid-title')}>
                {hasSelection
                  ? <><strong>{selectedLeafIds.size}</strong> of {displayLeaves.length} selected</>
                  : <><strong>{displayLeaves.length}</strong> bookmark{displayLeaves.length !== 1 ? 's' : ''}{searchQuery ? ` matching “${searchQuery}”` : ''}</>
                }
              </span>
            </div>
            <div className={listStyles.gridHeaderRight} ref={registerTarget('bm-collapse-expand')}>
              {viewMode === 'tree' && (
                <>
                  <button
                    className={listStyles.toggleAllBtn}
                    onClick={() => onCollapseAll()}
                    title="Collapse all folders"
                  >
                    Collapse all
                  </button>
                  <button
                    className={listStyles.toggleAllBtn}
                    onClick={() => onExpandAll(collectFolderIds(displayTree))}
                    title="Expand all folders"
                  >
                    Expand all
                  </button>
                </>
              )}
              {hasSelection && (
                <button className={listStyles.toggleAllBtn} onClick={selectNone}>Clear all</button>
              )}
              {displayLeaves.length > 0 && (
                <button className={listStyles.toggleAllBtn} onClick={allSelected ? selectNone : selectAll}>
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
          </div>

          {/* Floating Indicators for offscreen duplicate twins */}
          {offscreenTwins.above > 0 && (
            <div className={`${styles.floatingIndicator} ${styles.floatingIndicatorTop}`}>
              <ArrowUp size={14} weight="bold" />
              {offscreenTwins.above} {offscreenTwins.above === 1 ? 'copy' : 'copies'} above
            </div>
          )}
          {offscreenTwins.below > 0 && (
            <div className={`${styles.floatingIndicator} ${styles.floatingIndicatorBottom}`}>
              <ArrowDown size={14} weight="bold" />
              {offscreenTwins.below} {offscreenTwins.below === 1 ? 'copy' : 'copies'} below
            </div>
          )}

          {/* Drag-select layer — targets data-bookmark-id (parallel to data-tab-id in ListView) */}
          <BookmarkDragSelectLayer
            scrollRef={scrollRef}
            onDragSelect={addToSelection}
            disabled={shiftHeld || isDragging}
          />

          {/* Scroll area */}
          <div className={listStyles.gridScroll} ref={scrollRef}>
            <DndContext sensors={sensors} {...dndHandlers}>
              {loading ? (
                <div className={listStyles.emptyState}>Loading bookmarks…</div>
            ) : displayLeaves.length === 0 && viewMode === 'list' ? (
              <div className={listStyles.emptyState}>
                {searchQuery ? `No bookmarks match "${searchQuery}"` : 'No bookmarks found.'}
              </div>
            ) : viewMode === 'list' ? (
              /* List view — flat sorted leaves, mirrors ListView's list layout */
              <div className={listStyles.listLayout}>
                {displayLeaves.map(node => (
                <BookmarkLeafRow
                  key={node.id}
                  node={node}
                  sortMode={sortMode}
                  isSelected={selectedLeafIds.has(node.id)}
                  isSoftSelected={softSelectedIds.has(node.id)}
                  onClick={handleLeafClick}
                  onHover={handleItemHover}
                  onHoverEnd={handleItemHoverEnd}
                  hoveredUrl={hoveredUrl}
                  urlCounts={urlCounts}
                />
              ))}
              </div>
            ) : (
              /* Tree view — recursive filtered + sorted tree */
              <div className={`${listStyles.listLayout} ${styles.listLayoutTree}`}>
                {displayTree.map(rootNode => (
                <BookmarkTreeNode
                  key={rootNode.id}
                  node={rootNode}
                  depth={0}
                  sortMode={sortMode}
                  expandedIds={expandedIds}
                  getFolderCheckState={getFolderCheckState}
                  selectedLeafIds={selectedLeafIds}
                  softSelectedIds={softSelectedIds}
                  onFolderClick={handleFolderClick}
                  onLeafClick={handleLeafClick}
                  onToggleExpand={onToggleExpand}
                  onHover={handleItemHover}
                  onHoverEnd={handleItemHoverEnd}
                  isDragging={isDragging}
                  dragId={dragId}
                  overId={overId}
                  onRenameDraftFolder={onRenameDraftFolder}
                  pendingDeletes={pendingDeletes}
                  pendingArchives={pendingArchives}
                  hoveredUrl={hoveredUrl}
                  urlCounts={urlCounts}
                />
              ))}
                {/* Optional trailing spacer for the very bottom of the tree could go here */}
              </div>
            )}
            <DragOverlay dropAnimation={null}>
              {dragId ? (
                <div className={styles.bmDragOverlay}>
                  <span>{draggedGroupCount} item{draggedGroupCount !== 1 ? 's' : ''}</span>
                </div>
              ) : null}
            </DragOverlay>
            </DndContext>
          </div>
        </div>
      </div>

      {/* Action bar — outside the flex-row body so it stacks at the bottom */}
      {/* Unified Action bar — always rendered; buttons disabled until a tab is selected */}
      <div className={listStyles.actionBar} style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className={listStyles.actionBarCount} style={{ display: 'flex', alignItems: 'center' }}>
          {hasSelection ? (
            <span>{selectedLeafIds.size + selectedFolderIds.size} selected</span>
          ) : stagedCount > 0 ? (
            <span>
              📦 {movesCount > 0 ? `${movesCount} move${movesCount !== 1 ? 's' : ''}` : ''}
              {movesCount > 0 && deletesCount > 0 ? ', ' : ''}
              {deletesCount > 0 ? `${deletesCount} deletion${deletesCount !== 1 ? 's' : ''}` : ''}
              {(movesCount > 0 || deletesCount > 0) && archivesCount > 0 ? ', ' : ''}
              {archivesCount > 0 ? `${archivesCount} archive${archivesCount !== 1 ? 's' : ''}` : ''} staged
            </span>
          ) : (
            <span>No bookmarks selected</span>
          )}
        </div>
        <div className={listStyles.actionBarActions} style={{ display: 'flex', gap: '8px' }}>
          {hasSelection && selectedLeafIds.size === 1 && selectedFolderIds.size === 0 && (
            <button className={listStyles.btnAction} onClick={handleOpenClick}>
              <ArrowSquareOut size={13} weight="bold" />
              Open Bookmark
            </button>
          )}
          {/*
          {isSelectionMostlyArchives ? (
            <button className={listStyles.btnAction} onClick={handleUnArchiveClick}>Un-archive</button>
          ) : (
            <button
              ref={registerTarget('bm-archive')}
              className={listStyles.btnAction}
              onClick={handleArchiveClick}
              disabled={!hasSelection || !archiveReady}
              title={archiveReady ? undefined : 'Create a Cold Storage file first'}
            >
              Archive
            </button>
          )}
          */}
          {isSelectionMostlyDeletes ? (
            <button className={listStyles.btnAction} onClick={handleUnRemoveClick}>Un-remove</button>
          ) : (
            <button
              ref={registerTarget('bm-remove')}
              className={`${listStyles.btnAction} ${listStyles.btnActionDanger}`}
              onClick={handleRemoveClick}
              disabled={!hasSelection}
            >
              Remove
            </button>
          )}
          {/* Visual separator if both sets of buttons are visible */}
          {stagedCount > 0 && <div style={{ width: 1, height: 16, background: 'var(--border)', alignSelf: 'center', margin: '0 4px' }} />}

          {stagedCount > 0 && (
            <>
              <button className={listStyles.btnAction} style={{ background: 'transparent', border: '1px solid var(--border)' }} onClick={handleRevert}>Revert</button>
              <button className={listStyles.btnAction} style={{ background: 'var(--accent-green, #30d158)', color: '#fff' }} onClick={handleAccept}>Accept</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
