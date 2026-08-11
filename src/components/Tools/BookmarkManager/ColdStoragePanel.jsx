import React, { useMemo, useRef } from 'react';
import { ArrowCounterClockwise, Trash, ArrowSquareOut } from '@phosphor-icons/react';
import uFuzzy from '@leeoniya/ufuzzy';

import listStyles from '../ListView/ListView.module.css';
import styles from './BookmarkManagerCard.module.css';

import { ArchivedGroupHeader, ArchivedBookmarkRow } from './BookmarkRows';
import { useBookmarkSelection } from './useBookmarkSelection';
import BookmarkDragSelectLayer from './BookmarkDragSelectLayer';
import { groupArchiveByFolder } from '../../../utils/bookmarkUtils';

const uf = new uFuzzy({ intraMode: 1 });

/**
 * ColdStoragePanel
 *
 * Renders one of three states based on archiveState:
 *
 *   'unlinked'        — No archive file. Show "Create file" CTA.
 *   'needsPermission' — Handle in IndexedDB but permission lapsed (e.g. browser
 *                       restart). Show "Reconnect" button (requires user gesture).
 *   'ready'           — Archive loaded from file.
 *                       • empty bookmarks → "Linked, nothing archived yet"
 *                       • bookmarks present → grouped list + action bar
 *
 * Selection state lives here (via useBookmarkSelection), keyed on Chrome bookmark IDs.
 * Action callbacks (onRestore, onRestoreAndRemove, onRemoveFromArchive) receive an
 * explicit Set<string> of URLs derived from the selection.
 */
export default function ColdStoragePanel({
  archive,
  archiveState,
  lastKnownFilename = null,
  searchQuery = '',
  onCreateArchive,
  onReconnect,
  onRestore,
  onRestoreAndRemove,
  onRemoveFromArchive,
  onGoToBrowse,
}) {
  const scrollRef = useRef(null);
  const bookmarks = archive?.bookmarks ?? [];

  // ── Fuzzy search filter (same pattern as BrowsePanel) ────────────────────
  const filteredBookmarks = useMemo(() => {
    if (!searchQuery.trim()) return bookmarks;
    const haystack = bookmarks.map(b => `${b.title} ${b.url}`);
    const [, info, order] = uf.search(haystack, searchQuery.trim());
    if (!order?.length) return [];
    return order.map(oi => bookmarks[info.idx[oi]]);
  }, [bookmarks, searchQuery]);

  // ── Group archive items into synthetic folder nodes ──────────────────────
  const groups = useMemo(() => groupArchiveByFolder(filteredBookmarks), [filteredBookmarks]);

  // Flat ordered array of archive items in display order (group 1 first, etc.)
  // useBookmarkSelection uses this for shift-range anchor/target lookup.
  const orderedFlatItems = useMemo(() => groups.flatMap(g => g.children), [groups]);

  // ── Selection — reuse useBookmarkSelection directly ───────────────────────
  // Archive items have original Chrome .id fields, so the ID-based selection
  // hook works without modification. getAllLeaves() treats archive items as
  // leaves because they have .url and no .isFolder field (undefined = falsy).
  const {
    selectedLeafIds,
    selectedFolderIds,
    softSelectedIds,
    shiftHeld,
    getFolderCheckState,
    handleLeafClick,
    handleFolderClick,
    handleItemHover,
    handleItemHoverEnd,
    addToSelection,
    selectAll,
    selectNone,
  } = useBookmarkSelection(orderedFlatItems);

  // ── Translate selected IDs → URL set for action callbacks ─────────────────
  const idToUrl = useMemo(
    () => new Map(bookmarks.map(b => [b.id, b.url])),
    [bookmarks]
  );
  const selectedUrls = useMemo(
    () => new Set([...selectedLeafIds].map(id => idToUrl.get(id)).filter(Boolean)),
    [selectedLeafIds, idToUrl]
  );

  const hasSelected  = selectedLeafIds.size > 0;
  const totalCount   = filteredBookmarks.length;
  const allSelected  = totalCount > 0 && selectedLeafIds.size === totalCount;

  // ── Status chip ────────────────────────────────────────────────────────────
  const renderStatusChip = () => (
    <div className={styles.archiveStatus}>
      <span className={styles.archiveStatusIcon}>📄</span>
      <div className={styles.archiveStatusText}>
        {archiveState === 'unlinked' && (
          <div className={styles.archiveStatusEmpty}>No archive file linked</div>
        )}
        {archiveState === 'needsRelink' && (
          <>
            <div className={styles.archiveStatusFilename}>{lastKnownFilename}</div>
            <div className={styles.archiveStatusCount}>Archive file needs to be re-linked</div>
          </>
        )}
        {archiveState === 'needsPermission' && (
          <>
            <div className={styles.archiveStatusFilename}>{archive?.filename ?? 'chrome-tab-archive.json'}</div>
            <div className={styles.archiveStatusCount}>Permission required to reconnect</div>
          </>
        )}
        {archiveState === 'ready' && (
          <>
            <div className={styles.archiveStatusFilename}>{archive?.filename ?? 'chrome-tab-archive.json'}</div>
            <div className={styles.archiveStatusCount}>{bookmarks.length} archived bookmark{bookmarks.length !== 1 ? 's' : ''}</div>
          </>
        )}
      </div>

      {archiveState === 'unlinked' && (
        <button className={styles.archiveStatusBtn} onClick={onCreateArchive}>
          Create file
        </button>
      )}
      {archiveState === 'needsRelink' && (
        <button className={styles.archiveStatusBtn} onClick={onCreateArchive}>
          Re-link file
        </button>
      )}
      {archiveState === 'needsPermission' && (
        <button className={styles.archiveStatusBtn} onClick={onReconnect}>
          Reconnect
        </button>
      )}
    </div>
  );

  // ── Body ───────────────────────────────────────────────────────────────────
  const renderBody = () => {
    if (archiveState === 'unlinked') {
      return (
        <div className={styles.archiveEmpty}>
          <div className={styles.archiveEmptyIcon}>🗄️</div>
          <div className={styles.archiveEmptyTitle}>No archive file yet</div>
          <div className={styles.archiveEmptyBody}>
            Create a JSON file on your computer to store stale bookmarks.
            You'll be able to browse and restore them here any time.
          </div>
          <button className={styles.archiveEmptyBtn} onClick={onCreateArchive}>
            Create file
          </button>
        </div>
      );
    }

    if (archiveState === 'needsRelink') {
      return (
        <div className={styles.archiveEmpty}>
          <div className={styles.archiveEmptyIcon}>🔗</div>
          <div className={styles.archiveEmptyTitle}>Archive file lost</div>
          <div className={styles.archiveEmptyBody}>
            Your previously linked file <strong>{lastKnownFilename}</strong> is no longer
            accessible — browser storage was likely cleared. Pick the same file again to
            restore access without losing your archive.
          </div>
          <button className={styles.archiveEmptyBtn} onClick={onCreateArchive}>
            Re-link file
          </button>
        </div>
      );
    }

    if (archiveState === 'needsPermission') {
      return (
        <div className={styles.archiveEmpty}>
          <div className={styles.archiveEmptyIcon}>🔐</div>
          <div className={styles.archiveEmptyTitle}>Permission needed</div>
          <div className={styles.archiveEmptyBody}>
            Your archive file was found but the browser needs your permission to
            access it again. Click Reconnect to re-grant access.
          </div>
          <button className={styles.archiveEmptyBtn} onClick={onReconnect}>
            Reconnect
          </button>
        </div>
      );
    }

    // archiveState === 'ready'
    if (!bookmarks.length) {
      return (
        <div className={styles.archiveEmpty}>
          <div className={styles.archiveEmptyIcon}>✅</div>
          <div className={styles.archiveEmptyTitle}>Archive linked — nothing here yet</div>
          <div className={styles.archiveEmptyBody}>
            Go to Browse mode, select stale bookmarks, and click Archive.
            They'll be written directly to your file.
          </div>
          <button className={styles.archiveEmptyBtn} onClick={onGoToBrowse}>
            Back to Browse
          </button>
        </div>
      );
    }

    return (
      <>
        {/* Grid header — selection count + bulk controls */}
        <div className={listStyles.gridHeader}>
          <div className={listStyles.gridHeaderLeft}>
            <span className={listStyles.gridTitle}>
              {hasSelected
                ? <><strong>{selectedLeafIds.size}</strong> of {totalCount} selected</>
                : searchQuery.trim()
                  ? <><strong>{totalCount}</strong> result{totalCount !== 1 ? 's' : ''} for "{searchQuery}"</>
                  : <><strong>{totalCount}</strong> archived bookmark{totalCount !== 1 ? 's' : ''}</>
              }
            </span>
          </div>
          <div className={listStyles.gridHeaderRight}>
            {hasSelected && (
              <button className={listStyles.toggleAllBtn} onClick={selectNone}>Clear all</button>
            )}
            <button className={listStyles.toggleAllBtn} onClick={allSelected ? selectNone : selectAll}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        </div>

        {/* Drag-select — reuses BookmarkDragSelectLayer unchanged;
            ArchivedBookmarkRow has data-bookmark-id={node.id} as its target. */}
        <BookmarkDragSelectLayer
          scrollRef={scrollRef}
          onDragSelect={addToSelection}
          disabled={shiftHeld}
        />

        {/* Scroll area */}
        <div className={listStyles.gridScroll} ref={scrollRef}>
          <div className={listStyles.listLayout}>
            {groups.map(group => (
              <React.Fragment key={group.id}>
                <ArchivedGroupHeader
                  node={group}
                  checkState={getFolderCheckState(group)}
                  onClick={() => handleFolderClick(group)}
                />
                {group.children.map(node => (
                  <div key={node.id} style={{ paddingLeft: `${(group.depth + 1) * 18}px` }}>
                    <ArchivedBookmarkRow
                      node={node}
                      isSelected={selectedLeafIds.has(node.id)}
                      isSoftSelected={softSelectedIds.has(node.id)}
                      onClick={handleLeafClick}
                      onHover={handleItemHover}
                      onHoverEnd={handleItemHoverEnd}
                    />
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Action bar */}
        {hasSelected && (
          <div className={listStyles.actionBar}>
            <span className={listStyles.actionBarCount}>
              {selectedLeafIds.size} selected
            </span>
            <div className={listStyles.actionBarActions}>
              {selectedLeafIds.size === 1 && selectedFolderIds.size === 0 && (
                <button
                  className={listStyles.btnAction}
                  onClick={() => {
                    const leafId = Array.from(selectedLeafIds)[0];
                    const selectedBookmark = bookmarks.find(b => b.id === leafId);
                    if (selectedBookmark?.url) {
                      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                        chrome.tabs.create({ url: selectedBookmark.url, active: true });
                      } else {
                        window.open(selectedBookmark.url, '_blank');
                      }
                    }
                  }}
                >
                  <ArrowSquareOut size={13} weight="bold" />
                  Open Bookmark
                </button>
              )}
              <button className={listStyles.btnAction} onClick={() => { onRestore(selectedUrls); selectNone(); }}>
                <ArrowCounterClockwise size={13} weight="bold" />
                Restore to Chrome
              </button>
              <button className={listStyles.btnAction} onClick={() => { onRestoreAndRemove(selectedUrls); selectNone(); }}>
                <ArrowCounterClockwise size={13} weight="bold" />
                Restore &amp; remove
              </button>
              <button
                className={`${listStyles.btnAction} ${listStyles.btnActionDanger}`}
                onClick={() => { onRemoveFromArchive(selectedUrls); selectNone(); }}
              >
                <Trash size={13} weight="duotone" />
                Delete from archive
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className={styles.browsePanelRoot}>
      {/* Status chip — flex-shrink:0 via .archiveStatus, no flex:1 wrapper */}
      {renderStatusChip()}
      {archiveState === 'ready' && bookmarks.length > 0 ? (
        <div className={listStyles.gridArea}>
          {renderBody()}
        </div>
      ) : (
        <div className={listStyles.body}>
          <div className={styles.coldStorageBody}>
            {renderBody()}
          </div>
        </div>
      )}
    </div>
  );
}
