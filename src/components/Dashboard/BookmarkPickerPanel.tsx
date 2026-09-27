import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PickerItem } from '../../services/pickerHistoryService';
import uFuzzy from '@leeoniya/ufuzzy';
import {
  FolderOpen,
  Plus,
  CaretRight,
  CaretDown,
  FloppyDisk,
  Broom,
  MagnifyingGlass as MagnifyingGlassIcon,
} from '@phosphor-icons/react';

import Tooltip from '../Shared/Tooltip';
import InlineAddRow from '../Shared/InlineAddRow';
import PickerHoverItem from '../Shared/PickerHoverItem';
import { useTriage } from '../../store/TriageProvider';
import { useTriageActions } from '../../hooks/useTriageActions';
import { usePickerPanel } from '../../hooks/usePickerPanel';
import { usePicker } from '../../store/PickerProvider';
import styles from './PickerPanels.module.css';
import { BookmarkNode } from '../../types';

// uFuzzy instance — intraMode:1 allows one intra-word gap between query chars
// (good for mild typos) while still preventing the extreme false-match rate
// of the old character-walk approach.
const uf = new uFuzzy({ intraMode: 1 });

// Returns a flat ordered list of visible tree nodes (respects expand/collapse state).
// Used for arrow-key keyboard navigation in tree mode.
function flattenVisible(
  nodes: BookmarkNode[],
  expandedIds: Set<string>,
  depth = 0,
): { node: BookmarkNode; depth: number }[] {
  const result: { node: BookmarkNode; depth: number }[] = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (expandedIds.has(node.id) && node.children?.length) {
      result.push(...flattenVisible(node.children, expandedIds, depth + 1));
    }
  }
  return result;
}

export interface BookmarkPickerPanelProps {
  isActive: boolean;
  onDeactivate: () => void;
  onBookmarkCleaner: () => void;
}

export default function BookmarkPickerPanel({
  isActive,
  onDeactivate,
  onBookmarkCleaner,
}: BookmarkPickerPanelProps) {
  const { state, dispatch } = useTriage();
  const { bookmark: bookmarkAction, bookmarkBatch } = useTriageActions();
  const { batchTarget, setBatchTarget } = usePicker();
  const currentTab = state.tabs[state.currentIndex];

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // addingToId: folder id for the new subfolder (null = not adding)
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState<string>('');

  const [forceSubfolder, setForceSubfolder] = useState<boolean>(() => {
    const stored = localStorage.getItem('tabbit_force_subfolder_creation');
    return stored !== null ? stored === 'true' : true;
  });

  const toggleForceSubfolder = useCallback(() => {
    setForceSubfolder((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('tabbit_force_subfolder_creation', String(next));
      return next;
    });
  }, []);

  const broomRef = useRef(null);
  const [broomHovered, setBroomHovered] = useState<boolean>(false);

  const flatFolders = state.bookmarkFolders ?? [];

  // Bulk filter: receives the full items array + query, returns filtered+sorted slice.
  // usePickerSuggestions calls filterFn(items, query) for each section.
  const matchFn = useCallback((items: PickerItem[], q: string) => {
    if (!q) return items;
    const haystack = items.map((item) => item.path || item.title || '');
    const [, info, order] = uf.search(haystack, q);
    if (!order || order.length === 0) return [];
    return order.map((oi) => items[info.idx[oi]]);
  }, []);

  const {
    query,
    setQuery,
    selectedIndex: searchSelectedIndex,
    inputRef,
    listRef,
    sections,
    flatItems,
    confirm,
    setSelectedIndex: setSearchSelectedIndex,
    recordAndInvalidate,
  } = usePickerPanel({
    pickerType: 'bookmark',
    isActive,
    onDeactivate,
    rawItems: flatFolders,
    currentTabUrl: currentTab?.url,
    matchFn,
    selectedId: selectedKey, // Trigger auto-scroll when selection changes
    onConfirmItem: async (item: PickerItem) => {
      if ((batchTarget?.tabs?.length ?? 0) > 1 && forceSubfolder) {
        const sectionKey = selectedKey ? selectedKey.split('-')[0] : 'all';
        openAddFolder(String(item.id), sectionKey);
        return false; // Prevent panel from closing
      } else if (batchTarget?.tabs?.length) {
        bookmarkBatch(batchTarget.tabs, String(item.id), item.title, true);
        setBatchTarget(null);
      } else if (currentTab) {
        bookmarkAction(currentTab, String(item.id));
      }
    },
    customNavigate: (direction, currentFlatItems, currentIdx, setIdx) => {
      if (query.length > 0) {
        if (direction === 'down') setIdx((i) => Math.min(i + 1, currentFlatItems.length - 1));
        if (direction === 'up') setIdx((i) => Math.max(i - 1, 0));
      } else {
        const visible = displaySections.flatMap((sec) =>
          flattenVisible(sec.items as import('../../types').BookmarkNode[], expandedIds).map(
            (v) => ({ ...v, key: `${sec.key}-${v.node.id}` }),
          ),
        );
        const currentVisibleIdx = visible.findIndex((v) => v.key === selectedKey);
        if (direction === 'down') {
          const next = visible[currentVisibleIdx + 1];
          if (next) setSelectedKey(next.key);
        }
        if (direction === 'up') {
          const prev = visible[currentVisibleIdx - 1];
          if (prev) setSelectedKey(prev.key);
        }
      }
    },
    customGetSelectedItem: () => {
      if (query.length > 0) return null; // Fallback to flatItems[selectedIndex]
      if (!selectedKey) return null;
      const id = selectedKey.split('-').slice(1).join('-');
      return (flatFolders.find((f) => f.id === id) as PickerItem) || null;
    },
  });

  const isSearchMode = query.length > 0;

  const displaySections = useMemo(() => {
    if (isSearchMode) return sections;
    return sections.map((sec) => {
      if (sec.key === 'all') {
        return { ...sec, items: state.bookmarkTree ?? [] };
      }
      return sec;
    });
  }, [isSearchMode, sections, state.bookmarkTree]);

  const visibleNodes = useMemo(() => {
    if (isSearchMode) return [];
    return displaySections.flatMap((sec) =>
      flattenVisible(sec.items as import('../../types').BookmarkNode[], expandedIds).map((v) => ({
        ...v,
        key: `${sec.key}-${v.node.id}`,
      })),
    );
  }, [displaySections, expandedIds, isSearchMode]);

  // Auto-expand all root-level nodes whenever tree data loads or panel activates.
  useEffect(() => {
    if (state.bookmarkTree && state.bookmarkTree.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        state.bookmarkTree.forEach((n: import('../../types').BookmarkFolder) => next.add(n.id));
        return next;
      });
      if (isActive && !selectedKey) {
        // Pre-select the first visible node
        if (visibleNodes.length > 0) setSelectedKey(visibleNodes[0].key);
      }
    }
  }, [state.bookmarkTree, isActive]);

  useEffect(() => {
    if (addingToId && query.length > 0) {
      setQuery('');
    }
  }, [addingToId, query.length, setQuery]);

  const createFolder = useCallback(
    async (parentId: string) => {
      const name = newFolderName.trim();
      if (!name) {
        setAddingToId(null);
        setNewFolderName('');
        return;
      }
      try {
        const newNode = await chrome?.bookmarks?.create({ parentId, title: name });
        if (newNode) {
          dispatch({
            type: 'ADD_BOOKMARK_FOLDER',
            payload: { id: newNode.id, title: newNode.title, parentId },
          });
          setExpandedIds((prev) => new Set([...prev, parentId]));
          // Just select the newly created folder in the 'all' section
          setSelectedKey(`all-${newNode.id}`);

          if (batchTarget?.tabs?.length) {
            bookmarkBatch(batchTarget.tabs, newNode.id, newNode.title, true);
            setBatchTarget(null);
            recordAndInvalidate(newNode as unknown as BookmarkNode);
            onDeactivate?.();
          } else if (currentTab) {
            bookmarkAction(currentTab, newNode.id);
            recordAndInvalidate(newNode as unknown as BookmarkNode);
            onDeactivate?.();
          }
        }
      } catch (err) {
        console.warn('[Tabbit] Failed to create bookmark folder:', err);
      }
      setNewFolderName('');
      setAddingToId(null);
    },
    [
      newFolderName,
      dispatch,
      batchTarget,
      bookmarkAction,
      setBatchTarget,
      onDeactivate,
      currentTab,
      recordAndInvalidate,
    ],
  );

  const openAddFolder = useCallback((nodeId: string, sectionKey: string) => {
    setAddingToId(nodeId);
    setNewFolderName('');
    setExpandedIds((prev) => new Set([...prev, nodeId]));
    setSelectedKey(`${sectionKey}-${nodeId}`);
  }, []);

  const cancelAddFolder = useCallback(() => {
    setAddingToId(null);
    setNewFolderName('');
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // spacebar toggles tree expansion — component-specific, not part of picker protocol
  useEffect(() => {
    if (!isActive) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!selectedKey || isSearchMode) return;
      e.preventDefault();
      const id = selectedKey.split('-').slice(1).join('-');
      toggleExpanded(id);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isActive, isSearchMode, selectedKey, toggleExpanded]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        setQuery('');
      } else {
        inputRef.current?.blur();
        onDeactivate?.();
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (isSearchMode)
        setSearchSelectedIndex((i: number) => Math.min(i + 1, flatItems.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isSearchMode) setSearchSelectedIndex((i: number) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
    }
  };

  let runningIndex = 0;

  return (
    <div className={styles.pickerPanelOuter}>
      <div className={`${styles.pickerPanelInner} ${isActive ? styles.pickerPanelActive : ''}`}>
        <div className={styles.pickerHeader}>
          <span className={styles.pickerTitle}>
            <FolderOpen size={16} weight="duotone" />
            Bookmarks
          </span>
          <div className={styles.pickerHeaderActions}>
            {isActive && (batchTarget?.tabs?.length ?? 0) > 1 && (
              <label className={styles.pickerHeaderToggle}>
                <input type="checkbox" checked={forceSubfolder} onChange={toggleForceSubfolder} />
                Subfolder
              </label>
            )}
            {isActive && !((batchTarget?.tabs?.length ?? 0) > 1) && (
              <button
                className={styles.pickerSaveBtn}
                onClick={() => confirm()}
                title="Save bookmark here (Enter)"
              >
                <FloppyDisk size={16} weight="duotone" />
                Save
              </button>
            )}
            {/* <button
                            ref={dotsRef}
                            className={styles.pickerIconBtn}
                            onClick={() => { chrome?.tabs?.create({ url: 'chrome://bookmarks/' }); }}
                            onMouseEnter={() => setDotsHovered(true)}
                            onMouseLeave={() => setDotsHovered(false)}
                            aria-label="Open Chrome Bookmarks Manager"
                        >
                            <DotsThree size={16} weight="bold" />
                        </button> */}
            {/* <Tooltip anchorRef={dotsRef} visible={dotsHovered} placement="right">
                            Chrome Bookmarks Manager
                        </Tooltip> */}

            <button
              ref={broomRef}
              className={styles.pickerIconBtn}
              onClick={() => {
                onDeactivate?.();
                onBookmarkCleaner?.();
              }}
              onMouseEnter={() => setBroomHovered(true)}
              onMouseLeave={() => setBroomHovered(false)}
              aria-label="Open Bookmark Cleaner"
            >
              <Broom size={15} weight="duotone" />
            </button>
            <Tooltip anchorRef={broomRef} visible={broomHovered} placement="right">
              Bookmark Cleaner
            </Tooltip>
          </div>
        </div>

        <div className={styles.pickerSearchRow}>
          <MagnifyingGlassIcon size={16} weight="duotone" color="var(--text-muted)" />
          <input
            ref={inputRef}
            id="picker-search-bookmark"
            className={styles.pickerSearchInput}
            placeholder="Search folders…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            onKeyDown={handleSearchKeyDown}
          />
        </div>

        {/* Tree mode */}
        {!isSearchMode && (
          <ul className={styles.pickerList} ref={listRef}>
            {displaySections.length === 0 && (
              <div className={styles.pickerEmpty}>No bookmark folders found</div>
            )}
            {displaySections.map((sec) => (
              <React.Fragment key={sec.key}>
                {sec.showHeader && (
                  <li className={styles.pickerSectionHeader} aria-hidden="true">
                    {sec.label}
                  </li>
                )}
                {sec.items.map((rootNode) => (
                  <BookmarkTreeNode
                    key={`${sec.key}-${rootNode.id}`}
                    sectionKey={sec.key}
                    node={rootNode as import('../../types').BookmarkNode}
                    depth={0}
                    selectedKey={selectedKey}
                    expandedIds={expandedIds}
                    addingToId={addingToId}
                    newFolderName={newFolderName}
                    onSelect={(key) => setSelectedKey(key)}
                    onToggle={toggleExpanded}
                    onConfirm={confirm}
                    onOpenAdd={openAddFolder}
                    onCancelAdd={cancelAddFolder}
                    onNewFolderNameChange={setNewFolderName}
                    onCreateFolder={createFolder}
                  />
                ))}
              </React.Fragment>
            ))}
          </ul>
        )}

        {/* Search / flat mode */}
        {isSearchMode && (
          <ul className={styles.pickerList} ref={listRef}>
            {flatItems.length === 0 && (
              <div className={styles.pickerEmpty}>No results for "{query}"</div>
            )}
            {displaySections.map((sec) => {
              const sectionItems = sec.items;
              return (
                <React.Fragment key={sec.key}>
                  {sec.showHeader && (
                    <li className={styles.pickerSectionHeader} aria-hidden="true">
                      {sec.label}
                    </li>
                  )}
                  {sectionItems.map((item) => {
                    const globalIdx = runningIndex++;
                    return (
                      <PickerHoverItem
                        key={`${sec.key}-${item.id}`}
                        isSelected={globalIdx === searchSelectedIndex}
                        icon={<span className={styles.pickerItemIcon}>📁</span>}
                        label={item.title}
                        prefix="Save to"
                        suffix="and close"
                        path={item.path}
                        onClick={() => confirm(item)}
                        onMouseEnter={() => setSearchSelectedIndex(globalIdx)}
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}
          </ul>
        )}
      </div>
      {/* Action-hint bulge — bottom edge, slides in when active */}
      <div
        className={`${styles.actionBulge} ${styles.actionBulgeBottom} ${isActive ? styles.actionBulgeVisible : ''}`}
      >
        <span className={styles.actionBulgeHint}>
          <span className={styles.actionBulgeKey}>↵</span>
          save
        </span>
        <span className={styles.actionBulgeDivider} />
        <span className={styles.actionBulgeHint}>
          <span className={styles.actionBulgeKey}>space</span>
          open
        </span>
        <span className={styles.actionBulgeDivider} />
        <span className={styles.actionBulgeHint}>
          <span className={styles.actionBulgeKey}>esc</span>
          cancel
        </span>
        <span className={styles.actionBulgeDivider} />
        <span className={styles.actionBulgeKey}>↑</span>
        <span className={styles.actionBulgeKey}>↓</span>
      </div>
    </div>
  );
}

// Recursive tree node component
export interface BookmarkTreeNodeProps {
  sectionKey: string;
  node: BookmarkNode;
  depth: number;
  selectedKey: string | null;
  expandedIds: Set<string>;
  addingToId: string | null;
  newFolderName: string;
  onSelect: (key: string) => void;
  onToggle: (id: string) => void;
  onConfirm: (node: BookmarkNode) => void;
  onOpenAdd: (id: string, sectionKey: string) => void;
  onCancelAdd: () => void;
  onNewFolderNameChange: (name: string) => void;
  onCreateFolder: (id: string) => void;
}

function BookmarkTreeNode({
  sectionKey,
  node,
  depth,
  selectedKey,
  expandedIds,
  addingToId,
  newFolderName,
  onSelect,
  onToggle,
  onConfirm,
  onOpenAdd,
  onCancelAdd,
  onNewFolderNameChange,
  onCreateFolder,
}: BookmarkTreeNodeProps) {
  const hasChildren = node.children?.length > 0;
  const currentKey = `${sectionKey}-${node.id}`;
  const isSelected = currentKey === selectedKey;
  const isExpanded = expandedIds.has(node.id);
  const isAddingHere = addingToId === node.id;

  // Local hover state for the inline + button tooltip
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [addBtnHovered, setAddBtnHovered] = useState<boolean>(false);

  return (
    <>
      <li
        data-selected={isSelected ? 'true' : 'false'}
        className={`${styles.treeNode} ${isSelected ? styles.treeNodeSelected : ''}`}
        style={{ paddingLeft: `${10 + depth * 16}px` }}
        onClick={() => onConfirm(node)}
        onMouseEnter={() => onSelect(currentKey)}
        onMouseMove={() => onSelect(currentKey)}
      >
        <button
          className={styles.treeChevron}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
          tabIndex={-1}
        >
          {hasChildren ? (
            isExpanded ? (
              <CaretDown size={10} weight="bold" />
            ) : (
              <CaretRight size={10} weight="bold" />
            )
          ) : (
            <span className={styles.treeChevronSpacer} />
          )}
        </button>
        <span className={styles.treeNodeIcon}>📁</span>
        <span className={styles.treeNodeLabel}>
          {isSelected ? (
            <>
              <span className={styles.pickerHoverPrefix}>Save to </span>
              {node.title || 'Untitled'}
              <span className={styles.pickerHoverSuffix}> and close</span>
              <span className={styles.pickerHoverArrow}>→</span>
            </>
          ) : (
            node.title || 'Untitled'
          )}
        </span>
        {/* Inline + button — hidden until row is hovered/selected */}
        <button
          ref={addBtnRef}
          className={styles.treeNodeAddBtn}
          onClick={(e) => {
            e.stopPropagation();
            onOpenAdd(node.id, sectionKey);
          }}
          onMouseEnter={() => setAddBtnHovered(true)}
          onMouseLeave={() => setAddBtnHovered(false)}
          tabIndex={-1}
        >
          <Plus size={11} weight="bold" />
        </button>
        <Tooltip anchorRef={addBtnRef} visible={addBtnHovered} placement="right">
          New folder
        </Tooltip>
      </li>

      {/* Inline input row, shown directly after this node when adding here */}
      {isAddingHere && (
        <InlineAddRow
          name={newFolderName}
          onChange={onNewFolderNameChange}
          onCreate={() => onCreateFolder(node.id)}
          onCancel={onCancelAdd}
          placeholder="Folder name…"
          icon={<span className={styles.treeNodeIcon}>📁</span>}
          style={{ paddingLeft: `${10 + (depth + 1) * 16}px` }}
        />
      )}

      {/* Children */}
      {isExpanded &&
        hasChildren &&
        node.children.map((child: BookmarkNode) => (
          <BookmarkTreeNode
            key={`${sectionKey}-${child.id}`}
            sectionKey={sectionKey}
            node={child}
            depth={depth + 1}
            selectedKey={selectedKey}
            expandedIds={expandedIds}
            addingToId={addingToId}
            newFolderName={newFolderName}
            onSelect={onSelect}
            onToggle={onToggle}
            onConfirm={onConfirm}
            onOpenAdd={onOpenAdd}
            onCancelAdd={onCancelAdd}
            onNewFolderNameChange={onNewFolderNameChange}
            onCreateFolder={onCreateFolder}
          />
        ))}
    </>
  );
}
