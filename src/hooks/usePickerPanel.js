import { useState, useRef, useEffect, useCallback } from 'react';
import { usePicker } from '../store/PickerProvider';
import { usePickerSuggestions } from './usePickerSuggestions';
import { recordUsage } from '../services/pickerHistoryService';

/**
 * Shared abstraction for picker panels (Bookmark, TabGroup).
 * Manages query state, index-based selection, DOM refs, suggestion data fetching,
 * and standardizes the confirm/navigate workflows.
 */
export function usePickerPanel({
    pickerType,
    isActive,
    onDeactivate,
    rawItems,
    currentTabUrl,
    matchFn,
    onConfirmItem, // async (item) => void
    customNavigate, // (direction, flatItems, selectedIndex, setSelectedIndex) => void
    customGetSelectedItem, // () => item
    onQueryChange, // () => void (for resetting custom selection state)
    selectedId, // passed down just to trigger auto-scroll when it changes
}) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const { sections, flatItems, invalidate } = usePickerSuggestions(
        pickerType, rawItems, currentTabUrl, query, matchFn
    );

    // Reset selection when query changes or panel becomes active
    useEffect(() => {
        setSelectedIndex(0);
        onQueryChange?.();
    }, [query, isActive, onQueryChange]);

    // Auto-scroll selected item into view
    useEffect(() => {
        const listEl = listRef.current;
        if (!listEl) return;
        const selected = listEl.querySelector('[data-selected="true"]');
        if (selected) selected.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex, selectedId]);

    const recordAndInvalidate = useCallback((item) => {
        if (currentTabUrl && item) {
            recordUsage(pickerType, item, currentTabUrl);
            invalidate();
        }
    }, [pickerType, currentTabUrl, invalidate]);

    // Use a ref for onConfirmItem so confirmWrapper always calls the
    // latest version — avoids stale closures when batchTarget changes.
    const onConfirmItemRef = useRef(onConfirmItem);
    useEffect(() => { onConfirmItemRef.current = onConfirmItem; });

    const confirmWrapper = useCallback(async (overrideItem) => {
        let item = overrideItem;
        if (!item) {
            if (customGetSelectedItem) {
                item = customGetSelectedItem();
            } else {
                item = flatItems[selectedIndex];
            }
        }

        if (!item) return;

        inputRef.current?.blur();
        
        await onConfirmItemRef.current(item);
        recordAndInvalidate(item);

        setQuery('');
        onDeactivate?.();
    }, [customGetSelectedItem, flatItems, selectedIndex, recordAndInvalidate, onDeactivate]);

    // Register with PickerContext
    const { registerPicker } = usePicker();

    useEffect(() => {
        if (!isActive) return;
        return registerPicker(pickerType, {
            onNavigate: (direction) => {
                if (customNavigate) {
                    customNavigate(direction, flatItems, selectedIndex, setSelectedIndex);
                } else {
                    if (direction === 'down') setSelectedIndex(i => Math.min(i + 1, flatItems.length - 1));
                    if (direction === 'up') setSelectedIndex(i => Math.max(i - 1, 0));
                }
            },
            onConfirm: confirmWrapper,
            onDeactivate: () => { onDeactivate?.(); setQuery(''); },
        });
    }, [isActive, pickerType, customNavigate, flatItems, selectedIndex, confirmWrapper, onDeactivate, registerPicker]);

    return {
        query, setQuery,
        selectedIndex, setSelectedIndex,
        inputRef, listRef,
        sections, flatItems,
        confirm: confirmWrapper,
        recordAndInvalidate,
    };
}
