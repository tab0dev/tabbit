import React, { useState, useRef } from 'react';
import { ArrowsOutSimple, ArrowsInSimple } from '@phosphor-icons/react';
import { useDroppable } from '@dnd-kit/core';
import Favicon from '../../Shared/Favicon';
import styles from '../AutoTabGroupWizard.module.css';

// left-pane row — one per domain/custom group.
// droppable target for dnd-kit drag-and-drop.
export default function GroupRow({
    group, active, tabCount, totalCount, isDraggingOver,
    onSelect, onToggle, onRename, toggleRef, splitLabel,
    onToggleSplit, isSplit, isSibling, isFirstSibling, isLastSibling, isHighlighted,
    onMouseEnter, onMouseLeave,
}) {
    const { setNodeRef } = useDroppable({ id: group.id });
    const [editing, setEditable] = useState(false);
    const [draft, setDraft] = useState(group.name);
    const inputRef = useRef(null);

    const startEdit = (e) => {
        if (!group.isCustom) return;
        e.stopPropagation();
        setDraft(group.name);
        setEditable(true);
        setTimeout(() => inputRef.current?.focus(), 10);
    };

    const commitEdit = () => {
        setEditable(false);
        const trimmed = draft.trim();
        if (trimmed && trimmed !== group.name) onRename(trimmed);
        else setDraft(group.name);
    };

    const hasSplitAction = group.canSplit || isSplit;

    return (
        <div
            ref={setNodeRef}
            className={`
                ${styles.domainRow}
                ${active ? styles.domainRowActive : ''}
                ${!group.enabled ? styles.domainRowDisabled : ''}
                ${isDraggingOver ? styles.domainRowOver : ''}
                ${isSibling ? styles.domainRowSibling : ''}
                ${isFirstSibling ? styles.domainRowFirstSibling : ''}
                ${isLastSibling ? styles.domainRowLastSibling : ''}
                ${isHighlighted ? styles.domainRowHighlightedSibling : ''}
            `}
            onClick={onSelect}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {group.isCustom ? (
                <div className={styles.domainFaviconFallback} style={{ fontSize: '10px' }}>✦</div>
            ) : (
                <Favicon src={group.favicon} size={16} className={styles.domainFavicon} fallbackClass={styles.domainFaviconFallback} />
            )}

            <div className={styles.domainInfo}>
                {editing ? (
                    <input
                        ref={inputRef}
                        className={styles.groupNameInput}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                            if (e.key === 'Escape') { setEditable(false); setDraft(group.name); }
                            e.stopPropagation();
                        }}
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span
                        className={styles.domainName}
                        onDoubleClick={startEdit}
                        title={group.isCustom ? 'Double-click to rename' : undefined}
                    >
                        {group.name}
                    </span>
                )}
                <span className={styles.domainCount}>
                    {group.enabled ? `${tabCount}/${totalCount}` : `${totalCount} tabs`}
                    {splitLabel && <span className={styles.splitBadge}>{splitLabel}</span>}
                </span>
            </div>

            {hasSplitAction && !group.isCustom && (
                <button
                    className={`${styles.linkBtn} ${isSplit ? styles.linkBtnActive : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggleSplit(); }}
                    title={isSplit ? 'Merge groups back' : 'Split by site'}
                >
                    {isSplit ? <ArrowsInSimple size={14} /> : <ArrowsOutSimple size={14} />}
                </button>
            )}

            <div
                ref={toggleRef}
                className={`${styles.toggle} ${group.enabled ? styles.toggleOn : ''}`}
                onClick={e => { e.stopPropagation(); onToggle(); }}
                title={group.enabled ? 'Disable group' : 'Enable group'}
            />
        </div>
    );
}
