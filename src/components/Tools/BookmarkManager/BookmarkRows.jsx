import React, { useRef } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CaretRight, CaretDown } from '@phosphor-icons/react';
import listStyles from '../ListView/ListView.module.css';
import styles from './BookmarkManagerCard.module.css';
import { getActivityColor, getAgeColor, getFolderActivityColor } from '../../../utils/bookmarkUtils';

// ─── Checkbox component ───────────────────────────────────────────────────────
// Mirrors the ListView checkbox div exactly. Adds indeterminate support for folders.

function Checkbox({ state }) {
  // state: 'unchecked' | 'indeterminate' | 'checked'
  const isChecked       = state === 'checked';
  const isIndeterminate = state === 'indeterminate';

  return (
    <div
      className={[
        listStyles.checkbox,
        isChecked || isIndeterminate ? listStyles.checkboxChecked : '',
        isIndeterminate ? styles.checkboxIndeterminate : '',
      ].filter(Boolean).join(' ')}
    >
      {isChecked       && '✓'}
      {isIndeterminate && '−'}
    </div>
  );
}

// ─── Leaf row (list + tree mode) ────────────────────────────────────────────
// depth prop controls the rendering mode:
//   depth = null/undefined  → list mode: no paddingLeft, no chevron spacer
//   depth = number          → tree mode: paddingLeft = 14 + depth×18 (same formula
//                             as BookmarkFolderRow), chevron spacer rendered so
//                             favicon aligns with folder text at the same depth.
//
// The depth formula is applied DIRECTLY on the card element (not a wrapper div)
// so there is no stacking with the card's own padding — this is what prevents
// the depth-0 misalignment bug that existed in the old wrapper-div approach.

export function BookmarkLeafRow({
  node,
  depth,          // optional: undefined/null = list mode, number = tree mode
  sortMode,       // 'lastActivity' | 'dateAdded' | 'title' | 'manual'
  isSelected,
  isSoftSelected,
  onClick,
  onHover,
  onHoverEnd,
  draggableProps,
  isDraggingThis,
  isStagedForDeletion,
  isStagedForArchive,
  hoveredUrl,
  urlCounts,
}) {
  const isTreeMode    = depth != null;
  const activityColor = getActivityColor(node);

  const isTwinHovered = hoveredUrl && hoveredUrl === node.url;
  const copyCount = urlCounts?.get(node.url) || 0;

  const cardClasses = [
    listStyles.listItemCard,
    listStyles.listItemCardGrouped,
    isSelected     ? listStyles.listItemCardSelected     : '',
    isSoftSelected ? listStyles.listItemCardSoftSelected : '',
    isDraggingThis ? styles.bmDragGhost : '',
    isStagedForDeletion || isStagedForArchive ? styles.bmStagedItem : '',
    isTwinHovered ? styles.duplicateHighlight : ''
  ].filter(Boolean).join(' ');

  const cardStyle = isTreeMode
    ? { paddingLeft: `${14 + depth * 18}px`, borderLeftColor: activityColor, opacity: isStagedForDeletion || isStagedForArchive ? 0.5 : 1 }
    : { borderLeftColor: activityColor, opacity: isStagedForDeletion || isStagedForArchive ? 0.5 : 1 };

  const usedStr    = node.dateLastUsed ? `Used ${formatRelativeDate(node.dateLastUsed)}` : 'Never used';
  const addedStr   = node.dateAdded    ? `Added ${formatRelativeDate(node.dateAdded)}`   : null;

  // Dim the badge that isn't the active sort dimension to a neutral gray.
  // When sort is title/manual (no date dimension in focus), both stay colored.
  const MUTED = 'var(--text-muted, #888)';
  const usedColor = sortMode === 'dateAdded'
    ? MUTED
    : (node.dateLastUsed ? activityColor : 'var(--accent-red, #ff3b30)');
  const addedColor = sortMode === 'lastActivity'
    ? MUTED
    : (node.dateAdded ? getAgeColor(node.dateAdded) : null);

  return (
    <div
      ref={draggableProps?.ref}
      {...(draggableProps?.attributes || {})}
      {...(draggableProps?.listeners || {})}
      data-bookmark-id={node.id}
      data-bookmark-url={node.url}
      className={cardClasses}
      style={cardStyle}
      onClick={(e) => onClick(node.id, e)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHoverEnd()}
    >
      <Checkbox state={isSelected ? 'checked' : 'unchecked'} />

      {/* Spacer aligns favicon with folder text when in tree mode */}
      {isTreeMode && <span className={styles.bmTreeChevronSpacer} />}

      <div className={styles.bmFavicon}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(node.url)}&sz=16`}
          alt=""
          width={16}
          height={16}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      </div>

      <div className={listStyles.listItemInfo} style={{ textDecoration: isStagedForDeletion || isStagedForArchive ? 'line-through' : 'none' }}>
        <div className={listStyles.listItemTitle} title={node.title}>
          {node.title || '(Untitled)'}
          {copyCount > 1 && (
            <span className={styles.duplicateBadge}>{copyCount} copies</span>
          )}
        </div>
        <div className={listStyles.listItemUrl} title={node.url}>
          {node.url}
        </div>
      </div>

      {(usedStr || addedStr) && (
        <div className={styles.bmDateStack}>
          <span className={styles.bmDateBadge} style={{ color: usedColor }}>{usedStr}</span>
          {addedStr && <span className={styles.bmDateBadge} style={{ color: addedColor }}>{addedStr}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Tree-mode folder row ─────────────────────────────────────────────────────

export function BookmarkFolderRow({
  node,
  depth,
  checkState,        // 'unchecked' | 'indeterminate' | 'checked'
  isExpanded,
  onFolderClick,
  onToggleExpand,
  draggableProps,
  isDropTarget,
  isDraggingThis,
  onRenameDraftFolder,
  isStagedForDeletion,
  isStagedForArchive,
}) {
  const folderColor = getFolderActivityColor(node);

  const borderStyle = folderColor
    ? { borderLeftColor: folderColor }
    : undefined;

  return (
    <div
      ref={draggableProps?.ref}
      {...(draggableProps?.attributes || {})}
      {...(draggableProps?.listeners || {})}
      data-bookmark-id={node.id}
      className={[
        listStyles.listItemCard,
        folderColor ? listStyles.listItemCardGrouped : '',
        styles.bmFolderRow,
        checkState !== 'unchecked' ? listStyles.listItemCardSelected : '',
        isDropTarget ? styles.bmDropTarget : '',
        isDraggingThis ? styles.bmDragGhost : '',
        isStagedForDeletion || isStagedForArchive ? styles.bmStagedItem : ''
      ].filter(Boolean).join(' ')}
      style={{ paddingLeft: `${14 + depth * 18}px`, ...borderStyle, opacity: isStagedForDeletion || isStagedForArchive ? 0.5 : 1 }}
      onClick={() => onFolderClick(node)}
    >
      <Checkbox state={checkState} />

      {/* Expand/collapse caret */}
      <button
        className={styles.bmTreeChevron}
        onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
        tabIndex={-1}
        disabled={isStagedForDeletion || isStagedForArchive}
      >
        {node.children?.length > 0
          ? (isExpanded ? <CaretDown size={10} weight="bold" /> : <CaretRight size={10} weight="bold" />)
          : <span className={styles.bmTreeChevronSpacer} />
        }
      </button>

      <span className={styles.bmFolderIcon}>📁</span>
      {node.id.startsWith('draft_group_') ? (
        <input
          autoFocus
          className={styles.bmDraftFolderInput}
          value={node.title}
          onChange={(e) => onRenameDraftFolder?.(node.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="New Group"
        />
      ) : (
        <span className={styles.bmFolderLabel} style={{ textDecoration: isStagedForDeletion || isStagedForArchive ? 'line-through' : 'none' }}>{node.title || 'Untitled'}</span>
      )}
      {node.children?.length > 0
        ? <span className={styles.bmFolderCount}>({node.children.length})</span>
        : <span className={styles.bmFolderEmpty}>Empty</span>
      }
    </div>
  );
}

// ─── Recursive tree node (folder + its children) ─────────────────────────────

export function BookmarkTreeNode({
  node,
  depth = 0,
  sortMode,
  expandedIds,
  getFolderCheckState,
  selectedLeafIds,
  softSelectedIds,
  onFolderClick,
  onLeafClick,
  onToggleExpand,
  onHover,
  onHoverEnd,
  isDragging,
  dragId,
  overId,
  onRenameDraftFolder,
  pendingDeletes,
  pendingArchives,
  hoveredUrl,
  urlCounts,
}) {
  const isExpanded = expandedIds.has(node.id);
  const disabled = sortMode !== 'manual';

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging: isDraggingThis,
  } = useDraggable({ id: node.id, disabled });

  // Both folders and leaves are droppable for "inside" grouping (grouping an item with a leaf creates a folder)
  const { setNodeRef: setDropRef } = useDroppable({
    id: node.id,
    disabled: disabled,
  });

  // Merge draggable + droppable refs onto the same element
  const setRowRef = (el) => { setDraggableRef(el); setDropRef(el); };

  const draggableProps = { ref: setRowRef, attributes, listeners };

  const isDropTarget = overId === node.id;

  return (
    <>
      {/* Spacer BEFORE this node — drop zone for "insert before nodeId" */}
      <BookmarkDropSpacer
        id={`spacer:before:${node.id}`}
        depth={depth}
        isActive={overId === `spacer:before:${node.id}`}
        disabled={disabled}
      />

      {node.isFolder ? (
        <BookmarkFolderRow
          node={node}
          depth={depth}
          checkState={getFolderCheckState(node)}
          isExpanded={isExpanded}
          onFolderClick={onFolderClick}
          onToggleExpand={onToggleExpand}
          draggableProps={draggableProps}
          isDropTarget={isDropTarget}
          isDraggingThis={isDraggingThis}
          onRenameDraftFolder={onRenameDraftFolder}
          isStagedForDeletion={pendingDeletes?.folders.has(node.id)}
          isStagedForArchive={pendingArchives?.folders.has(node.id)}
        />
      ) : (
        <BookmarkLeafRow
          node={node}
          depth={depth}
          sortMode={sortMode}
          isSelected={selectedLeafIds.has(node.id)}
          isSoftSelected={softSelectedIds.has(node.id)}
          onClick={onLeafClick}
          onHover={onHover}
          onHoverEnd={onHoverEnd}
          draggableProps={draggableProps}
          isDraggingThis={isDraggingThis}
          isStagedForDeletion={pendingDeletes?.leaves.has(node.id)}
          isStagedForArchive={pendingArchives?.leaves.has(node.id)}
          hoveredUrl={hoveredUrl}
          urlCounts={urlCounts}
        />
      )}

      {/* Children — each brings its own spacer:before */}
      {isExpanded && node.isFolder && node.children?.map(child => (
        <BookmarkTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          sortMode={sortMode}
          expandedIds={expandedIds}
          getFolderCheckState={getFolderCheckState}
          selectedLeafIds={selectedLeafIds}
          softSelectedIds={softSelectedIds}
          onFolderClick={onFolderClick}
          onLeafClick={onLeafClick}
          onToggleExpand={onToggleExpand}
          onHover={onHover}
          onHoverEnd={onHoverEnd}
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

      {/* Trailing spacer — "append to this folder" */}
      {isExpanded && node.isFolder && (
        <BookmarkDropSpacer
          id={`spacer:end:${node.id}`}
          depth={depth + 1}
          isActive={overId === `spacer:end:${node.id}`}
          disabled={disabled}
        />
      )}
    </>
  );
}

// ─── Drop Spacer ───────────────────────────────────────────────────────────────
// Thin strip between / before rows that is the real droppable for reordering.
// The accent line appears via ::after when this spacer is the active over target.
export function BookmarkDropSpacer({ id, depth, isActive, disabled }) {
  const { setNodeRef } = useDroppable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      className={[styles.bmDropSpacer, isActive ? styles.bmDropSpacerActive : ''].filter(Boolean).join(' ')}
      style={{ marginLeft: `${14 + depth * 18}px` }}
    />
  );
}

// ─── Cold Storage: group header ───────────────────────────────────────────────
// Renders a folder-style header for each archive group.
// Always expanded (no caret toggle — archive groups are never collapsed).
// Uses the same CSS classes as BookmarkFolderRow for visual consistency.

export function ArchivedGroupHeader({ node, checkState, onClick }) {
  const folderColor = getFolderActivityColor(node);
  const borderStyle = folderColor ? { borderLeftColor: folderColor } : undefined;

  return (
    <div
      className={[
        listStyles.listItemCard,
        folderColor ? listStyles.listItemCardGrouped : '',
        styles.bmFolderRow,
        checkState !== 'unchecked' ? listStyles.listItemCardSelected : '',
      ].filter(Boolean).join(' ')}
      style={{ paddingLeft: `${14 + node.depth * 18}px`, ...borderStyle }}
      onClick={onClick}
    >
      <Checkbox state={checkState} />

      {/* Spacer in place of caret — groups are always expanded */}
      <span className={styles.bmTreeChevronSpacer} style={{ width: 16, display: 'inline-block' }} />

      <span className={styles.bmFolderIcon}>📁</span>
      <span className={styles.bmFolderLabel}>{node.title}</span>
      <span className={styles.bmFolderCount}>({node.children.length})</span>
    </div>
  );
}

// ─── Cold Storage: archived bookmark row ─────────────────────────────────────
// data-bookmark-id enables BookmarkDragSelectLayer (same attribute as Browse rows).
// onClick passes node.id (not URL) so useBookmarkSelection's ID-based API works.

export function ArchivedBookmarkRow({
  node,
  isSelected,
  isSoftSelected,
  onClick,
  onHover,
  onHoverEnd,
}) {
  const cardClasses = [
    listStyles.listItemCard,
    listStyles.listItemCardGrouped,
    isSelected     ? listStyles.listItemCardSelected     : '',
    isSoftSelected ? listStyles.listItemCardSoftSelected : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      data-bookmark-id={node.id}
      className={cardClasses}
      onClick={(e) => onClick(node.id, e)}
      onMouseEnter={() => onHover?.(node.id)}
      onMouseLeave={() => onHoverEnd?.()}
    >
      <Checkbox state={isSelected ? 'checked' : 'unchecked'} />

      <div className={styles.bmFavicon}>
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(node.url)}&sz=16`}
          alt=""
          width={16}
          height={16}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      </div>

      <div className={listStyles.listItemInfo}>
        <div className={listStyles.listItemTitle} title={node.title}>{node.title || '(Untitled)'}</div>
        <div className={listStyles.listItemUrl} title={node.url}>{node.url}</div>
      </div>

      <div className={styles.bmDateBadge}>
        Archived {formatRelativeDate(new Date(node.archivedAt).getTime())}
      </div>
    </div>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function formatRelativeDate(ms) {
  if (!ms) return '';
  const now     = Date.now();
  const diff    = now - ms;
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months  = Math.floor(days / 30);
  const years   = Math.floor(days / 365);

  if (days   <  1) return 'today';
  if (days   <  2) return 'yesterday';
  if (days   <  7) return `${days}d ago`;
  if (months <  1) return `${Math.floor(days / 7)}w ago`;
  if (years  <  1) return `${months}mo ago`;
  return `${years}y ago`;
}
