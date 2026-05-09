import { useRef } from 'react';
import Selecto from 'react-selecto';

/**
 * DragSelectLayer
 *
 * Renders a react-selecto instance scoped to the grid scroll container.
 * Draws a rubber-band selection box when the user drags over empty space,
 * then calls onDragSelect with the array of tab IDs that were intersected.
 *
 * Props:
 *   scrollRef     — React ref to the .gridScroll scrollable div
 *   onDragSelect  — (tabIds: number[]) => void — called when drag ends
 *   disabled      — boolean — true while Shift is held (avoids conflict with shift-select)
 */
export default function DragSelectLayer({ scrollRef, onDragSelect, disabled }) {
  const selectoRef = useRef(null);
  const container = scrollRef.current;

  if (!container) return null;

  return (
    <Selecto
      ref={selectoRef}
      dragContainer={window}
      container={container}
      selectableTargets={['[data-tab-id]']}
      hitRate={0}
      selectByClick={false}
      selectFromInside={false}
      isEnabled={!disabled}
      shouldStartSelecting={(target) => {
        // Block drag if pointer started on a card or any of its children
        let el = target instanceof Element ? target : null;
        while (el && el !== document.body) {
          if (el.dataset?.tabId !== undefined) return false;
          if (el === container) break;
          el = el.parentElement;
        }
        return true;
      }}
      scrollOptions={{
        container,
        throttleTime: 30,
        getScrollPosition: () => [
          container.scrollLeft,
          container.scrollTop,
        ],
      }}
      onScroll={({ direction }) => {
        container.scrollBy(direction[0] * 8, direction[1] * 8);
      }}
      onSelectEnd={({ selected }) => {
        // data-tab-id is always a string in the DOM; tab.id is a number — convert back
        const ids = selected
          .map(el => {
            const raw = el.dataset?.tabId;
            return raw !== undefined ? Number(raw) : null;
          })
          .filter(id => id !== null && !Number.isNaN(id));

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
