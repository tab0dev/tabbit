import React, { useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import Favicon from '../../Shared/Favicon';
import styles from '../AutoTabGroupWizard.module.css';

// right-pane row — one per tab in the active group.
// draggable source for dnd-kit drag-and-drop.
export default function TabRow({ tab, groupId, excluded, onToggleExclude, isDraggingThis, dragRef }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: String(tab.id),
        data: { tabId: tab.id, fromGroupId: groupId },
    });

    const dragging = isDragging || isDraggingThis;

    // merge dnd-kit's ref with the optional tutorial ref
    const mergedRef = useCallback((node) => {
        setNodeRef(node);
        if (dragRef) dragRef(node);
    }, [setNodeRef, dragRef]);

    return (
        <div
            ref={mergedRef}
            {...listeners}
            {...attributes}
            className={`
                ${styles.tabRow}
                ${excluded ? styles.tabRowExcluded : ''}
                ${dragging ? styles.tabRowDragging : ''}
            `}
        >
            {/* checkbox — onPointerDown blocked so drag sensor ignores checkbox taps */}
            <div
                className={`${styles.checkbox} ${!excluded ? styles.checkboxChecked : ''}`}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onToggleExclude(); }}
            >
                {!excluded && '✓'}
            </div>

            <Favicon src={tab.favIconUrl} size={14} className={styles.tabFavicon} fallbackClass={styles.tabFaviconFallback} />

            <div className={styles.tabInfo}>
                <div className={styles.tabTitle}>{tab.title || '(Untitled)'}</div>
                <div className={styles.tabUrl}>{tab.url}</div>
            </div>
        </div>
    );
}
