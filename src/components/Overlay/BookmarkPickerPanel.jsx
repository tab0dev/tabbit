import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import uFuzzy from '@leeoniya/ufuzzy';
import { FolderOpen, FloppyDisk, Plus, DotsThreeOutline, CaretRight, CaretDown, MagnifyingGlassIcon } from '@phosphor-icons/react';
import Tooltip from '../Shared/Tooltip';
import InlineAddRow from '../Shared/InlineAddRow';
import { useTriage } from '../../store/TriageProvider';
import { useTriageActions } from '../../hooks/useTriageActions';
import { usePickerPanel } from '../../hooks/usePickerPanel';
import { usePicker } from '../../store/PickerProvider';
import styles from './Overlay.module.css';

// uFuzzy instance — intraMode:1 allows one intra-word gap between query chars
// (good for mild typos) while still preventing the extreme false-match rate
// of the old character-walk approach.
const uf = new uFuzzy({ intraMode: 1 });

// Returns a flat ordered list of visible tree nodes (respects expand/collapse state).
// Used for arrow-key keyboard navigation in tree mode.
function flattenVisible(nodes, expandedIds, depth = 0) {
    const result = [];
    for (const node of nodes) {
        result.push({ node, depth });
        if (expandedIds.has(node.id) && node.children?.length) {
            result.push(...flattenVisible(node.children, expandedIds, depth + 1));
        }
    }
    return result;
}

export default function BookmarkPickerPanel({ isActive, onDeactivate }) {
    const { state, dispatch } = useTriage();
    const { bookmark: bookmarkAction } = useTriageActions();
    const { batchTarget, setBatchTarget } = usePicker();
    const currentTab = state.tabs[state.currentIndex];

    const [selectedId, setSelectedId] = useState(null);
    const [expandedIds, setExpandedIds] = useState(new Set());

    // addingToId: folder id for the new subfolder (null = not adding)
    const [addingToId, setAddingToId] = useState(null);
    const [newFolderName, setNewFolderName] = useState('');

    const dotsRef = useRef(null);
    const [dotsHovered, setDotsHovered] = useState(false);

    const flatFolders = state.bookmarkFolders ?? [];

    // Bulk filter: receives the full items array + query, returns filtered+sorted slice.
    // usePickerSuggestions calls filterFn(items, query) for each section.
    const matchFn = useCallback((items, q) => {
        if (!q) return items;
        const haystack = items.map(item => item.path || item.title || '');
        const [, info, order] = uf.search(haystack, q);
        if (!order || order.length === 0) return [];
        return order.map(oi => items[info.idx[oi]]);
    }, []);

    const {
        query, setQuery,
        selectedIndex: searchSelectedIndex,
        inputRef, listRef,
        sections, flatItems,
        confirm
    } = usePickerPanel({
        pickerType: 'bookmark',
        isActive,
        onDeactivate,
        rawItems: flatFolders,
        currentTabUrl: currentTab?.url,
        matchFn,
        selectedId, // Trigger auto-scroll when selectedId changes
        onConfirmItem: async (item) => {
            if (batchTarget?.tabs?.length) {
                batchTarget.tabs.forEach(tab => bookmarkAction(tab, item.id, true));
                setBatchTarget(null);
            } else if (currentTab) {
                bookmarkAction(currentTab, item.id);
            }
        },
        customNavigate: (direction, currentFlatItems, currentIdx, setIdx) => {
            if (query.length > 0) {
                if (direction === 'down') setIdx(i => Math.min(i + 1, currentFlatItems.length - 1));
                if (direction === 'up') setIdx(i => Math.max(i - 1, 0));
            } else {
                const visible = displaySections.flatMap(sec => flattenVisible(sec.items, expandedIds));
                const currentVisibleIdx = visible.findIndex(({ node }) => node.id === selectedId);
                if (direction === 'down') { const next = visible[currentVisibleIdx + 1]; if (next) setSelectedId(next.node.id); }
                if (direction === 'up') { const prev = visible[currentVisibleIdx - 1]; if (prev) setSelectedId(prev.node.id); }
            }
        },
        customGetSelectedItem: () => {
            if (query.length > 0) return null; // Fallback to flatItems[selectedIndex]
            return flatFolders.find(f => f.id === selectedId);
        },
    });

    const isSearchMode = query.length > 0;

    const displaySections = useMemo(() => {
        if (isSearchMode) return sections;
        return sections.map(sec => {
            if (sec.key === 'all') {
                return { ...sec, items: state.bookmarkTree ?? [] };
            }
            return sec;
        });
    }, [isSearchMode, sections, state.bookmarkTree]);

    const visibleNodes = useMemo(() => {
        if (isSearchMode) return [];
        return displaySections.flatMap(sec => flattenVisible(sec.items, expandedIds));
    }, [displaySections, expandedIds, isSearchMode]);

    // Auto-expand all root-level nodes whenever tree data loads or panel activates.
    useEffect(() => {
        if (state.bookmarkTree?.length > 0) {
            setExpandedIds(prev => {
                const next = new Set(prev);
                state.bookmarkTree.forEach(n => next.add(n.id));
                return next;
            });
            if (isActive && !selectedId) {
                // Pre-select the first visible node
                if (visibleNodes.length > 0) setSelectedId(visibleNodes[0].node.id);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.bookmarkTree, isActive]);

    const createFolder = useCallback(async (parentId) => {
        const name = newFolderName.trim();
        if (!name) { setAddingToId(null); setNewFolderName(''); return; }
        try {
            const newNode = await chrome?.bookmarks?.create({ parentId, title: name });
            if (newNode) {
                dispatch({
                    type: 'ADD_BOOKMARK_FOLDER',
                    payload: { id: newNode.id, title: newNode.title, parentId },
                });
                setExpandedIds(prev => new Set([...prev, parentId]));
                setSelectedId(newNode.id);
            }
        } catch (err) {
            console.warn('[Tabbit] Failed to create bookmark folder:', err);
        }
        setNewFolderName('');
        setAddingToId(null);
    }, [newFolderName, dispatch]);

    const openAddFolder = useCallback((nodeId) => {
        setAddingToId(nodeId);
        setNewFolderName('');
        setExpandedIds(prev => new Set([...prev, nodeId]));
        setSelectedId(nodeId);
    }, []);

    const cancelAddFolder = useCallback(() => {
        setAddingToId(null);
        setNewFolderName('');
    }, []);

    const toggleExpanded = useCallback((id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);


    // spacebar toggles tree expansion — component-specific, not part of picker protocol
    useEffect(() => {
        if (!isActive) return;
        function onKeyDown(e) {
            if (e.code !== 'Space') return;
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (!selectedId || isSearchMode) return;
            e.preventDefault();
            toggleExpanded(selectedId);
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isActive, isSearchMode, selectedId, toggleExpanded]);

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); if (query) { setQuery(''); } else { inputRef.current?.blur(); onDeactivate?.(); } }
        if (e.key === 'ArrowDown') { e.preventDefault(); if (isSearchMode) setSearchSelectedIndex(i => Math.min(i + 1, flatItems.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); if (isSearchMode) setSearchSelectedIndex(i => Math.max(i - 1, 0)); }
        if (e.key === 'Enter') { e.preventDefault(); confirm(); }
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
                        {isActive && (
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
                            onClick={() => chrome?.tabs?.create({ url: 'chrome://bookmarks' })}
                            onMouseEnter={() => setDotsHovered(true)}
                            onMouseLeave={() => setDotsHovered(false)}
                            aria-label="Open Chrome Bookmarks Manager"
                        >
                            <DotsThreeOutline size={16} weight="duotone" />
                        </button>
                        <Tooltip anchorRef={dotsRef} visible={dotsHovered} placement="right">
                            Open Chrome Bookmarks Manager
                        </Tooltip> */}
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
                        onChange={(e) => setQuery(e.target.value)}
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
                                {sec.items.map(rootNode => (
                                    <BookmarkTreeNode
                                        key={rootNode.id}
                                        node={rootNode}
                                        depth={0}
                                        selectedId={selectedId}
                                        expandedIds={expandedIds}
                                        addingToId={addingToId}
                                        newFolderName={newFolderName}
                                        onSelect={node => setSelectedId(node.id)}
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
                        {displaySections.map(sec => {
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
                                            <li
                                                key={`${sec.key}-${item.id}`}
                                                data-selected={globalIdx === searchSelectedIndex ? 'true' : 'false'}
                                                className={`${styles.pickerItem} ${globalIdx === searchSelectedIndex ? styles.pickerItemSelected : ''}`}
                                                onClick={() => confirm(item.id)}
                                                onMouseEnter={() => setSearchSelectedIndex(globalIdx)}
                                            >
                                                <span className={styles.pickerItemIcon}>📁</span>
                                                <span className={styles.pickerItemLabel}>{item.title}</span>
                                                <span className={styles.pickerItemPath}>{item.path}</span>
                                            </li>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </ul>
                )}
            </div>
            {/* Action-hint bulge — bottom edge, slides in when active */}
            <div className={`${styles.actionBulge} ${styles.actionBulgeBottom} ${isActive ? styles.actionBulgeVisible : ''}`}>
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
function BookmarkTreeNode({
    node, depth, selectedId, expandedIds, addingToId, newFolderName,
    onSelect, onToggle, onConfirm, onOpenAdd, onCancelAdd, onNewFolderNameChange, onCreateFolder,
}) {
    const hasChildren = node.children?.length > 0;
    const isSelected = node.id === selectedId;
    const isExpanded = expandedIds.has(node.id);
    const isAddingHere = addingToId === node.id;

    // Local hover state for the inline + button tooltip
    const addBtnRef = useRef(null);
    const [addBtnHovered, setAddBtnHovered] = useState(false);

    return (
        <>
            <li
                data-selected={isSelected ? 'true' : 'false'}
                className={`${styles.treeNode} ${isSelected ? styles.treeNodeSelected : ''}`}
                style={{ paddingLeft: `${10 + depth * 16}px` }}
                onClick={() => onSelect(node)}
                onMouseEnter={() => onSelect(node)}
                onDoubleClick={() => onConfirm(node.id)}
            >
                <button
                    className={styles.treeChevron}
                    onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggle(node.id); }}
                    tabIndex={-1}
                >
                    {hasChildren
                        ? (isExpanded ? <CaretDown size={10} weight="bold" /> : <CaretRight size={10} weight="bold" />)
                        : <span className={styles.treeChevronSpacer} />
                    }
                </button>
                <span className={styles.treeNodeIcon}>📁</span>
                <span className={styles.treeNodeLabel}>{node.title || 'Untitled'}</span>
                {/* Inline + button — hidden until row is hovered/selected */}
                <button
                    ref={addBtnRef}
                    className={styles.treeNodeAddBtn}
                    onClick={(e) => { e.stopPropagation(); onOpenAdd(node.id); }}
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
            {isExpanded && hasChildren && node.children.map(child => (
                <BookmarkTreeNode
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    selectedId={selectedId}
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
