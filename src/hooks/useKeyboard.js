import { useEffect, useRef } from 'react';
import { useTriage, Mode } from '../store/TriageProvider';
import { useHotkeys } from '../store/HotkeysProvider';
import { useTriageActions } from './useTriageActions';
import { usePicker } from '../store/PickerProvider';

// global keydown handler for triage navigation.
//
// picker two-step flow:
//  1. press bookmark/group hotkey → panel activates, first item selected.
//  2. arrow keys → move selection. enter → confirm. escape → cancel.
//  pressing the same hotkey again while active also deactivates.
export function useKeyboard() {
  const { state } = useTriage();
  const { hotkeys } = useHotkeys();
  const actions = useTriageActions();
  const picker = usePicker();

  // always-current snapshots for closure access
  const stateRef = useRef(state);
  const hotkeysRef = useRef(hotkeys);
  const pickerRef = useRef(picker);
  useEffect(() => { stateRef.current = state; });
  useEffect(() => { hotkeysRef.current = hotkeys; });
  useEffect(() => { pickerRef.current = picker; });

  useEffect(() => {
    function handleKeyDown(e) {
      if (document.body.classList.contains('rebind-active-element')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const s = stateRef.current;
      const hk = hotkeysRef.current;
      const pk = pickerRef.current;
      const currentTab = s.tabs[s.currentIndex];
      const key = e.key.toUpperCase();
      const rawKey = e.key;
      const activePicker = pk.activePicker;

      // handle active picker panel navigation first
      if (activePicker) {
        // allow typing in search inputs normally — only intercept escape
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          // skip inline add inputs — they handle escape themselves
          if (rawKey === 'Escape' && !e.target.dataset.inlineAdd) { pk.deactivatePicker(); }
          return;
        }

        if (rawKey === 'ArrowDown') {
          e.preventDefault();
          pk.navigatePicker('down');
          return;
        }
        if (rawKey === 'ArrowUp') {
          e.preventDefault();
          pk.navigatePicker('up');
          return;
        }
        if (rawKey === 'Enter') {
          e.preventDefault();
          pk.confirmPicker();
          return;
        }
        if (rawKey === 'Escape') {
          e.preventDefault();
          pk.deactivatePicker();
          return;
        }

        // printable character (excluding space) → auto-focus the search input
        if (rawKey.length === 1 && rawKey !== ' ') {
          const searchInputId = activePicker === 'group' ? 'picker-search-group' : 'picker-search-bookmark';
          const input = document.getElementById(searchInputId);
          if (input) input.focus();
          return;
        }

        return;
      }

      // no picker active — global hotkeys (disabled in inputs)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (s.mode === Mode.TRIAGING) {
        if (!currentTab) return;
        if (key === hk.keep) actions.keep(currentTab);
        else if (key === hk.close) actions.close(currentTab);
        else if (key === hk.bookmark) pk.setActivePicker('bookmark');
        else if (key === hk.group) pk.setActivePicker('group');
        else if (key === hk.back) actions.back();
        else if (key === hk.undo) actions.undo();
      } else if (s.mode === Mode.COMPLETE) {
        if (key === hk.undo) actions.undo();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [actions]);
}
