import { useRef } from 'react';
import Selecto from 'react-selecto';

/**
 * BookmarkDragSelectLayer
 *
 * Identical to DragSelectLayer, but targets [data-bookmark-id] elements
 * instead of [data-tab-id]. IDs are strings (Chrome bookmark IDs), not numbers.
 *
 * Props:
 *   scrollRef     — React ref to the scrollable div
 *   onDragSelect  — (bookmarkIds: string[]) => void
 *   disabled      — boolean — true while Shift is held
 */
export default function BookmarkDragSelectLayer({ scrollRef, onDragSelect, disabled }) {
  const selectoRef = useRef(null);
  const container = scrollRef.current;

  if (!container) return null;

  return (
    <Selecto
      ref={selectoRef}
      dragContainer={window}
      container={container}
      selectableTargets={['[data-bookmark-id]']}
      hitRate={0}
      selectByClick={false}
      selectFromInside={false}
      isEnabled={!disabled}
      shouldStartSelecting={(target) => {
        let el = target instanceof Element ? target : null;
        
        // Ignore mousedown if it originated on a bookmark row (to prevent competing with DnD)
        if (el && el.closest('[data-bookmark-id]')) {
          return false;
        }

        while (el && el !== document.body) {
          if (el.dataset?.bookmarkId !== undefined) return false;
          if (el === container) break;
          el = el.parentElement;
        }
        return true;
      }}
      scrollOptions={{
        container,
        throttleTime: 30,
        getScrollPosition: () => [container.scrollLeft, container.scrollTop],
      }}
      onScroll={({ direction }) => {
        container.scrollBy(direction[0] * 8, direction[1] * 8);
      }}
      onSelectEnd={({ selected }) => {
        // Bookmark IDs are strings — no Number() conversion needed
        const ids = selected
          .map(el => el.dataset?.bookmarkId)
          .filter(id => id !== undefined && id !== null);
        if (ids.length > 0) onDragSelect(ids);
      }}
      selectionProps={{
        style: {
          border: '1.5px solid var(--text-secondary)',
          background: 'color-mix(in srgb, var(--text-secondary) 8%, transparent)',
          borderRadius: '4px',
          position: 'absolute',
          zIndex: 50,
          pointerEvents: 'none',
        },
      }}
    />
  );
}
