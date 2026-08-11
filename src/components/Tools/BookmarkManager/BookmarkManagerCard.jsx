import React, { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon, X, Broom, List as ListIcon,
  TreeView,
} from '@phosphor-icons/react';




import listStyles from '../ListView/ListView.module.css';
import styles from './BookmarkManagerCard.module.css';

import BrowsePanel from './BrowsePanel';
import ColdStoragePanel from './ColdStoragePanel';
import { useBookmarkData } from './useBookmarkData';
import { useArchive } from './useArchive';
import {
  resolveSelection,
  executeRemove,
  executeArchive,
} from '../../../services/bookmarkService';
import { useTriage } from '../../../store/TriageProvider';
import { globalChromeUndoStack } from '../../../hooks/useTriageActions';
import { useMonitor } from '../../../store/MonitorProvider';
import { pickQuip } from '../../../constants/quips';
import { MagicDotProvider, useMagicDot } from '../../Tutorial/MagicDotProvider';
import MagicDot from '../../Tutorial/MagicDot';
import { useTutorialSequence } from '../../Tutorial/useTutorialSequence';


/**
 * BookmarkManagerCard
 *
 * Thin orchestrator. Owns only:
 *   - mode (browse | coldStorage) and view (list | tree) toggles
 *   - sort/filter/search state (lifted so header search stays in sync)
 *   - useBookmarkData — tree fetch and refresh
 *   - useArchive      — file I/O, restore, remove from archive
 *   - Browse-level mutations (archive/remove) that need both hooks to coordinate
 *   - Keyboard shortcuts (Escape, Cmd+A, /)
 *
 * All rendering is delegated to BrowsePanel and ColdStoragePanel.
 */
export default function BookmarkManagerCard({ onClose }) {
  return (
    <MagicDotProvider>
      <BookmarkManagerCardInner onClose={onClose} />
    </MagicDotProvider>
  );
}

function BookmarkManagerCardInner({ onClose }) {
  const { registerTarget } = useMagicDot();
  const { showTutorial, sequence } = useTutorialSequence('bookmarks');

  const { dispatch } = useTriage();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState('browse');
  const [viewMode, setViewMode] = useState('tree');
  const [sortMode, setSortMode] = useState('manual');
  const [sortAsc, setSortAsc] = useState(true);
  const [folderFilter, setFolderFilter] = useState('all');
  const [accessFilter, setAccessFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [contentFilter, setContentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');


  // Clear search when switching modes so stale queries don't carry over
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setSearchQuery('');
  };

  // ── Data hook ─────────────────────────────────────────────────────────────
  const {
    fullTree,
    loading,
    expandedIds,
    toggleExpand,
    expandAll,
    mergeExpandIds,
    collapseAll,
    refreshTree,
  } = useBookmarkData();

  // ── Archive hook ──────────────────────────────────────────────────────────
  // archiveReady / archiveState are resolved on mount via IndexedDB +
  // FileSystemFileHandle.queryPermission() — no lazy init needed.
  const {
    archive,
    archiveState,
    archiveReady,
    lastKnownFilename,
    handleCreateArchive,
    handleReconnect,
    handleAppend,
    handleRestore,
    handleRestoreAndRemove,
    handleRemoveFromArchive,
  } = useArchive({ onRefreshTree: refreshTree });



  // ── Browse mutations ────────────────────────────────────────────────────────
  const handleArchive = async (selectedLeafIds, selectedFolderIds) => {
    const resolved = resolveSelection(selectedLeafIds, selectedFolderIds, fullTree);
    const merged = await executeArchive(resolved, archive);
    if (resolved.toAction.length > 0) await handleAppend(resolved.toAction);
    await refreshTree();

    const batchSize = resolved.toAction.length + resolved.foldersToRemove.length;
    if (batchSize > 0) {
      const archivedUrls = new Set(resolved.toAction.map(n => n.url));
      globalChromeUndoStack.push({
        type: 'bookmarks_manager_custom',
        undoFn: async () => {
          // 1. Remove from archive
          await handleRemoveFromArchive(archivedUrls);
          // 2. Re-create folders
          for (const f of resolved.foldersToRemove) {
            await chrome.bookmarks.create({ parentId: f.parentId, title: f.title, index: f.index }).catch(() => { });
          }
          // 3. Re-create leaves
          for (const l of resolved.toAction) {
            await chrome.bookmarks.create({ parentId: l.parentId, title: l.title, url: l.url, index: l.index }).catch(() => { });
          }
          // 4. Move orphans back
          for (const o of resolved.toOrphan) {
            await chrome.bookmarks.move(o.id, { parentId: o.parentId, index: o.index }).catch(() => { });
          }
          await refreshTree();
        }
      });
      dispatch({ type: 'PROCESS_BOOKMARKS_MANAGER_ACTION', payload: { batchSize } });
    }
  };

  const handleAcceptStaged = async ({ pendingMoves, pendingDeletes, pendingArchives, originalLocations }) => {
    // 1. Resolve selections for archives and deletes
    const archivesResolved = resolveSelection(pendingArchives.leaves, pendingArchives.folders, fullTree);
    const deletesResolved = resolveSelection(pendingDeletes.leaves, pendingDeletes.folders, fullTree);

    // 2. Execute archives
    if (archivesResolved.toAction.length > 0 || archivesResolved.foldersToRemove.length > 0) {
      await executeArchive(archivesResolved, archive);
      if (archivesResolved.toAction.length > 0) await handleAppend(archivesResolved.toAction);
    }

    // 3. Execute deletes
    if (deletesResolved.toAction.length > 0 || deletesResolved.foldersToRemove.length > 0) {
      await executeRemove(deletesResolved);
    }

    // 4. Execute moves
    const idMap = {};
    const createdGroupIds = [];

    for (const move of pendingMoves) {
      if (move.type === 'CREATE_GROUP') {
        const pId = idMap[move.parentId] || move.parentId;
        let index = undefined;
        if (move.targetSiblingId) {
          const children = await chrome.bookmarks.getChildren(pId);
          const idx = children.findIndex(c => c.id === move.targetSiblingId);
          if (idx !== -1) index = idx;
        }
        const newFolder = await chrome.bookmarks.create({ parentId: pId, title: move.title, index });
        idMap[move.draftId] = newFolder.id;
        createdGroupIds.push(newFolder.id);
        continue;
      }

      const { dragId: id, newParentId, beforeSiblingId } = move;
      const realId = idMap[id] || id;
      const realParentId = idMap[newParentId] || newParentId;
      const realBeforeSiblingId = idMap[beforeSiblingId] || beforeSiblingId;

      let index = undefined;
      if (realBeforeSiblingId) {
        const children = await chrome.bookmarks.getChildren(realParentId);
        const idx = children.findIndex(c => c.id === realBeforeSiblingId);
        if (idx !== -1) index = idx;
      }

      await chrome.bookmarks.move(realId, { parentId: realParentId, index });
    }

    await refreshTree();

    // 5. Construct single undo thunk
    const batchSize =
      archivesResolved.toAction.length + archivesResolved.foldersToRemove.length +
      deletesResolved.toAction.length + deletesResolved.foldersToRemove.length +
      pendingMoves.filter(m => m.type !== 'CREATE_GROUP').length;

    if (batchSize > 0) {
      const archivedUrls = new Set(archivesResolved.toAction.map(n => n.url));
      globalChromeUndoStack.push({
        type: 'bookmarks_manager_custom',
        undoFn: async () => {
          // A. Undo Moves (in reverse order)
          const movesToUndo = pendingMoves.filter(m => m.type !== 'CREATE_GROUP').reverse();
          for (const move of movesToUndo) {
            const loc = originalLocations[move.dragId];
            if (loc) {
              await chrome.bookmarks.move(move.dragId, { parentId: loc.parentId, index: loc.index }).catch(() => { });
            }
          }
          for (const groupId of createdGroupIds) {
            await chrome.bookmarks.remove(groupId).catch(() => { });
          }

          // B. Undo Deletes (re-create folders, then leaves, then orphans)
          for (const f of deletesResolved.foldersToRemove) {
            await chrome.bookmarks.create({ parentId: f.parentId, title: f.title, index: f.index }).catch(() => { });
          }
          for (const l of deletesResolved.toAction) {
            await chrome.bookmarks.create({ parentId: l.parentId, title: l.title, url: l.url, index: l.index }).catch(() => { });
          }
          for (const o of deletesResolved.toOrphan) {
            await chrome.bookmarks.move(o.id, { parentId: o.parentId, index: o.index }).catch(() => { });
          }

          // C. Undo Archives
          if (archivedUrls.size > 0) await handleRemoveFromArchive(archivedUrls);
          for (const f of archivesResolved.foldersToRemove) {
            await chrome.bookmarks.create({ parentId: f.parentId, title: f.title, index: f.index }).catch(() => { });
          }
          for (const l of archivesResolved.toAction) {
            await chrome.bookmarks.create({ parentId: l.parentId, title: l.title, url: l.url, index: l.index }).catch(() => { });
          }
          for (const o of archivesResolved.toOrphan) {
            await chrome.bookmarks.move(o.id, { parentId: o.parentId, index: o.index }).catch(() => { });
          }

          await refreshTree();
        }
      });
      dispatch({ type: 'PROCESS_BOOKMARKS_MANAGER_ACTION', payload: { batchSize } });
    }
  };

  // ── Keyboard shortcuts (mirrors ListView) ─────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('bm-search')?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={listStyles.listView}>
      {showTutorial && <MagicDot sequence={sequence} introDelay={600} />}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={listStyles.header}>
        {/* Title */}
        <span className={listStyles.title} ref={registerTarget('bm-header')}>
          <Broom size={16} weight="duotone" />
          Bookmarks
        </span>

        {/* Centre: mode tabs + search */}
        <div className={styles.headerCentre}>
          {/*
          <div className={styles.modeTabs} ref={registerTarget('bm-modes')}>
            <button
              className={`${styles.modeTab} ${mode === 'browse' ? styles.modeTabActive : ''}`}
              onClick={() => handleModeChange('browse')}
            >
              Browse
            </button>
            <button
              className={`${styles.modeTab} ${mode === 'coldStorage' ? styles.modeTabActive : ''}`}
              onClick={() => handleModeChange('coldStorage')}
            >
              Cold Storage{archive?.bookmarks?.length > 0 ? ` (${archive.bookmarks.length})` : ''}
            </button>
          </div>
          */}

          {/* Search — always visible; flex:1 so it fills remaining header space */}
          <div className={listStyles.searchRow} style={{ flex: 1, minWidth: 0 }}>
            <MagnifyingGlassIcon size={14} weight="duotone" color="var(--text-muted)" />
            <input
              id="bm-search"
              className={listStyles.searchInput}
              placeholder={mode === 'browse' ? 'Search bookmarks…' : 'Search archive…'}
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
              <button className={listStyles.searchClear} onClick={() => setSearchQuery('')}>
                <X size={12} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {/* Right controls — view toggle only; no X close button (back button handles dismissal) */}
        <div className={listStyles.headerControls}>
          {mode === 'browse' && (
            <div className={listStyles.viewToggleGroup}>
              <button
                className={`${listStyles.viewToggleBtn} ${viewMode === 'tree' ? listStyles.viewToggleBtnActive : ''}`}
                onClick={() => setViewMode('tree')}
                title="Tree view"
              >
                <TreeView size={15} weight="duotone" />
              </button>
              <button
                className={`${listStyles.viewToggleBtn} ${viewMode === 'list' ? listStyles.viewToggleBtnActive : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <ListIcon size={15} weight="duotone" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} ref={registerTarget('bm-body')}>
        {mode === 'browse' ? (
          <BrowsePanel
            fullTree={fullTree}
            loading={loading}
            expandedIds={expandedIds}
            onToggleExpand={toggleExpand}
            onExpandAll={expandAll}
            onMergeExpandIds={mergeExpandIds}
            onCollapseAll={collapseAll}
            sortMode={sortMode}
            sortAsc={sortAsc}
            onSortChange={(newMode) => {
              if (newMode === sortMode) {
                setSortAsc(a => !a);
              } else {
                setSortMode(newMode);
                setSortAsc(true);
              }
            }}
            folderFilter={folderFilter}
            onFolderFilterChange={setFolderFilter}
            accessFilter={accessFilter}
            onAccessFilterChange={setAccessFilter}
            ageFilter={ageFilter}
            onAgeFilterChange={setAgeFilter}
            contentFilter={contentFilter}
            onContentFilterChange={setContentFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            archiveReady={archiveReady}
            onAcceptStaged={handleAcceptStaged}
            onRefreshTree={refreshTree}
          />

        ) : (
          <ColdStoragePanel
            archive={archive}
            archiveState={archiveState}
            lastKnownFilename={lastKnownFilename}
            searchQuery={searchQuery}
            onCreateArchive={handleCreateArchive}
            onReconnect={handleReconnect}
            onRestore={handleRestore}
            onRestoreAndRemove={handleRestoreAndRemove}
            onRemoveFromArchive={handleRemoveFromArchive}
            onGoToBrowse={() => handleModeChange('browse')}
          />


        )}
      </div>
    </div>
  );
}
