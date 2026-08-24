import { useState, useRef, useEffect, useCallback } from 'react';
import { usePicker } from '../store/PickerProvider';
import { PickerItem } from '../services/pickerHistoryService';
import { usePickerSuggestions, PickerSection } from './usePickerSuggestions';
import { PickerType } from '../types';

export interface UsePickerPanelOptions<T> {
  pickerType: PickerType;
  isActive: boolean;
  onDeactivate?: () => void;
  rawItems: T[];
  currentTabUrl?: string;
  matchFn: (items: T[], query: string) => T[];
  onConfirmItem: (item: T) => Promise<boolean | void> | boolean | void;
  customNavigate?: (
    direction: 'up' | 'down',
    flatItems: T[],
    selectedIndex: number,
    setSelectedIndex: React.Dispatch<React.SetStateAction<number>>,
  ) => void;
  customGetSelectedItem?: () => T | null;
  onQueryChange?: () => void;
  selectedId?: string | null;
}

export interface UsePickerPanelReturn<T> {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  inputRef: React.RefObject<HTMLInputElement>;
  listRef: React.RefObject<HTMLUListElement>;
  sections: PickerSection<T>[];
  flatItems: T[];
  confirm: (overrideItem?: T) => Promise<void>;
  recordAndInvalidate: (item: T) => void;
}

/**
 * Shared abstraction for picker panels (Bookmark, TabGroup).
 * Manages query state, index-based selection, DOM refs, suggestion data fetching,
 * and standardizes the confirm/navigate workflows.
 */
export function usePickerPanel<T extends PickerItem>({
  pickerType,
  isActive,
  onDeactivate,
  rawItems,
  currentTabUrl,
  matchFn,
  onConfirmItem,
  customNavigate,
  customGetSelectedItem,
  onQueryChange,
  selectedId,
}: UsePickerPanelOptions<T>): UsePickerPanelReturn<T> {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { sections, flatItems, recordAndInvalidate } = usePickerSuggestions(
    pickerType,
    rawItems,
    currentTabUrl,
    query,
    matchFn,
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

  // Use a ref for onConfirmItem so confirmWrapper always calls the
  // latest version — avoids stale closures when batchTarget changes.
  const onConfirmItemRef = useRef(onConfirmItem);
  useEffect(() => {
    onConfirmItemRef.current = onConfirmItem;
  });

  const confirmWrapper = useCallback(
    async (overrideItem?: T) => {
      let item: T | null | undefined = overrideItem;
      if (!item) {
        if (customGetSelectedItem) {
          item = customGetSelectedItem();
        } else {
          item = flatItems[selectedIndex];
        }
      }

      if (!item) return;

      inputRef.current?.blur();

      const shouldClose = await onConfirmItemRef.current(item);

      if (shouldClose !== false) {
        recordAndInvalidate(item);
        setQuery('');
        onDeactivate?.();
      }
    },
    [customGetSelectedItem, flatItems, selectedIndex, recordAndInvalidate, onDeactivate],
  );

  // Register with PickerContext
  const { registerPicker } = usePicker();

  useEffect(() => {
    if (!isActive) return;
    return registerPicker(pickerType, {
      onNavigate: (direction) => {
        if (customNavigate) {
          customNavigate(direction, flatItems, selectedIndex, setSelectedIndex);
        } else {
          if (direction === 'down') setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
          if (direction === 'up') setSelectedIndex((i) => Math.max(i - 1, 0));
        }
      },
      onConfirm: confirmWrapper,
      onDeactivate: () => {
        onDeactivate?.();
        setQuery('');
      },
    });
  }, [
    isActive,
    pickerType,
    customNavigate,
    flatItems,
    selectedIndex,
    confirmWrapper,
    onDeactivate,
    registerPicker,
  ]);

  return {
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    inputRef,
    listRef,
    sections,
    flatItems,
    confirm: confirmWrapper,
    recordAndInvalidate,
  };
}
