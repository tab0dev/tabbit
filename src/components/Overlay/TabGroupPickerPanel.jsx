import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import uFuzzy from '@leeoniya/ufuzzy';
import { Tabs, FloppyDisk, Plus, DotsThreeOutline, MagicWand, MagnifyingGlassIcon } from '@phosphor-icons/react';
import Tooltip from '../Shared/Tooltip';
import InlineAddRow from '../Shared/InlineAddRow';
import { useTriage, Mode } from '../../store/TriageProvider';
import { useTriageActions } from '../../hooks/useTriageActions';
import { usePickerPanel } from '../../hooks/usePickerPanel';
import styles from './Overlay.module.css';



// uFuzzy instance shared across renders — no index to build, instant startup.
const uf = new uFuzzy({ intraMode: 1 });

export const GROUP_COLORS = {
    grey: '#9aa0a6', blue: '#8ab4f8', red: '#f28b82', yellow: '#fdd663',
    green: '#81c995', pink: '#ff8ac0', purple: '#d1bcff', cyan: '#78d1e8', orange: '#fcad70',
};

export default function TabGroupPickerPanel({ isActive, onDeactivate, onAutoGroup }) {
    const { state, dispatch } = useTriage();
    const { group: groupAction } = useTriageActions();
    const [isAdding, setIsAdding] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [dotsHovered, setDotsHovered] = useState(false);
    const [wandHovered, setWandHovered] = useState(false);
    const dotsRef = useRef(null);
    const wandRef = useRef(null);

    const rawItems = state.tabGroups ?? [];

    const currentTab = state.tabs[state.currentIndex];
    const currentTabUrl = currentTab?.url;

    // Disabled when there are no tabs left to process (mirrors isComplete in TriageDashboard)
    const isComplete = state.mode === Mode.COMPLETE || !currentTab || currentTab.processed || currentTab.gone;

    // Bulk filter: receives the full items array + query, returns filtered+sorted slice.
    const matchFn = useCallback((items, q) => {
        if (!q) return items;
        const haystack = items.map(item => item.title || 'Untitled');
        const [, info, order] = uf.search(haystack, q);
        if (!order || order.length === 0) return [];
        return order.map(oi => items[info.idx[oi]]);
    }, []);

    const {
        query, setQuery,
        selectedIndex, setSelectedIndex,
        inputRef, listRef,
        sections, flatItems,
        confirm, recordAndInvalidate
    } = usePickerPanel({
        pickerType: 'group',
        isActive,
        onDeactivate,
        rawItems,
        currentTabUrl,
        matchFn,
        onConfirmItem: (item) => {
            if (currentTab) groupAction(currentTab, item.id);
        }
    });

    const createTabGroup = useCallback(async () => {
        const name = newGroupName.trim();
        if (!name || !currentTab) {
            setIsAdding(false);
            setNewGroupName('');
            return;
        }

        try {
            // Group the current tab into a new group
            const groupId = await chrome.tabs.group({ tabIds: [currentTab.id] });
            // Set the brand new group's title
            await chrome.tabGroups.update(groupId, { title: name });

            const newGroup = { id: groupId, title: name, color: 'grey', windowId: currentTab.windowId };

            // Update state so it's available for next tabs
            dispatch({
                type: 'ADD_TAB_GROUP',
                payload: newGroup,
            });

            // Record usage
            recordAndInvalidate(newGroup);

            // Execute the triage effect (advance card, post status, quip)
            groupAction(currentTab, groupId);

        } catch (err) {
            console.warn('[Tabbit] Failed to create tab group:', err);
        }

        setNewGroupName('');
        setIsAdding(false);
        onDeactivate?.();
    }, [newGroupName, currentTab, dispatch, groupAction, onDeactivate, recordAndInvalidate]);

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); inputRef.current?.blur(); setQuery(''); onDeactivate?.(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
        if (e.key === 'Enter') { e.preventDefault(); confirm(flatItems[selectedIndex]); }
    };

    // build a running flat index to map section items to global selectedIndex.
    let runningIndex = 0;

    return (
        <div className={styles.pickerPanelOuter}>
            {/* Action-hint bulge — top edge, slides in when active */}
            <div className={`${styles.actionBulge} ${styles.actionBulgeTop} ${isActive ? styles.actionBulgeVisible : ''}`}>
                <span className={styles.actionBulgeHint}>
                    <span className={styles.actionBulgeKey}>↵</span>
                    save
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
            <div className={`${styles.pickerPanelInner} ${isActive ? styles.pickerPanelActive : ''}`}>
                <div className={styles.pickerHeader}>
                    <span className={styles.pickerTitle}>
                        <Tabs size={16} weight="duotone" />
                        Tab Groups
                    </span>
                    <div className={styles.pickerHeaderActions}>
                        {isActive && (
                            <button
                                className={styles.pickerSaveBtn}
                                onClick={() => confirm()}
                                title="Save (Enter)"
                            >
                                <FloppyDisk size={16} weight="duotone" />
                                Save
                            </button>
                        )}

                        <button
                            ref={wandRef}
                            className={styles.pickerIconBtn}
                            onClick={onAutoGroup}
                            onMouseEnter={() => setWandHovered(true)}
                            onMouseLeave={() => setWandHovered(false)}
                            aria-label="Auto Tab Group"
                            disabled={isComplete}
                        >
                            ✦
                            {/* <MagicWand size={14} weight="bold" /> */}
                        </button>
                        <Tooltip anchorRef={wandRef} visible={wandHovered} placement="right">
                            Auto Tab Group
                        </Tooltip>

                        <button
                            ref={dotsRef}
                            className={styles.pickerIconBtn}
                            onClick={() => setIsAdding(true)}
                            onMouseEnter={() => setDotsHovered(true)}
                            onMouseLeave={() => setDotsHovered(false)}
                            aria-label="Create New Tab Group"
                            disabled={isComplete}
                        >
                            <Plus size={16} weight="bold" />
                        </button>
                        <Tooltip anchorRef={dotsRef} visible={dotsHovered} placement="right">
                            Create New Tab Group (with this tab)
                        </Tooltip>

                    </div>
                </div>

                <div className={styles.pickerSearchRow}>
                    <MagnifyingGlassIcon size={16} weight="duotone" color="var(--text-muted)" />
                    <input
                        ref={inputRef}
                        id="picker-search-group"
                        className={styles.pickerSearchInput}
                        placeholder="Filter tab groups..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                <ul className={styles.pickerList} ref={listRef}>
                    {isAdding && (
                        <InlineAddRow
                            name={newGroupName}
                            onChange={setNewGroupName}
                            onCreate={createTabGroup}
                            onCancel={() => setIsAdding(false)}
                            placeholder="New group name…"
                            icon={<span className={styles.pickerItemColor} style={{ background: '#9aa0a6', marginRight: '4px' }} />}
                            style={{ paddingLeft: '20px' }}
                        />
                    )}
                    {flatItems.length === 0 && (
                        <div className={styles.pickerEmpty}>
                            {query ? `No results for "${query}"` : 'No items available'}
                        </div>
                    )}
                    {sections.map((section) => {
                        const sectionStartIndex = runningIndex;
                        const sectionItems = section.items;
                        runningIndex += sectionItems.length;

                        return (
                            <React.Fragment key={section.key}>
                                {section.showHeader && (
                                    <li className={styles.pickerSectionHeader} aria-hidden="true">
                                        {section.label}
                                    </li>
                                )}
                                {sectionItems.map((item, localIdx) => {
                                    const globalIdx = sectionStartIndex + localIdx;
                                    const label = item.title || 'Untitled group';
                                    const color = GROUP_COLORS[item.color] ?? GROUP_COLORS.grey;
                                    return (
                                        <li
                                            key={`${section.key}-${item.id}`}
                                            data-selected={globalIdx === selectedIndex ? 'true' : 'false'}
                                            className={`${styles.pickerItem} ${globalIdx === selectedIndex ? styles.pickerItemSelected : ''}`}
                                            onClick={() => confirm(item)}
                                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                                        >
                                            <span className={styles.pickerItemColor} style={{ background: color }} />
                                            <span className={styles.pickerItemLabel}>{label}</span>
                                        </li>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
