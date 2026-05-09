import { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * useRangeSelection
 *
 * Manages multi-select with shift-click range selection over a flat ordered list.
 *
 * @param {Array}    orderedItems  - The flat, display-ordered array of items ({ id, ... })
 * @param {Function} [onClear]     - Optional callback invoked when selection is cleared
 *
 * @returns {{
 *   selectedIds:      Set,
 *   softSelectedIds:  Set,
 *   shiftHeld:        boolean,
 *   handleCardClick:  (id: any, e: MouseEvent) => void,
 *   handleCardHover:  (id: any) => void,
 *   handleCardHoverEnd: () => void,
 *   addToSelection:   (ids: any[]) => void,
 *   selectAll:        () => void,
 *   selectNone:       () => void,
 * }}
 */
export function useRangeSelection(orderedItems) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [anchorId, setAnchorId]       = useState(null);
  const [hoverId, setHoverId]         = useState(null);
  const [shiftHeld, setShiftHeld]     = useState(false);

  // ── Track Shift key globally ──────────────────────────────────────────────
  useEffect(() => {
    const onDown = (e) => { if (e.key === 'Shift') setShiftHeld(true); };
    const onUp   = (e) => { if (e.key === 'Shift') { setShiftHeld(false); setHoverId(null); } };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup',   onUp);
    };
  }, []);

  // ── Soft-select range (hover preview while Shift is held) ─────────────────
  const softSelectedIds = useMemo(() => {
    if (!shiftHeld || anchorId === null || hoverId === null) return new Set();
    const anchorIdx = orderedItems.findIndex(t => t.id === anchorId);
    const hoverIdx  = orderedItems.findIndex(t => t.id === hoverId);
    if (anchorIdx === -1 || hoverIdx === -1) return new Set();
    const lo = Math.min(anchorIdx, hoverIdx);
    const hi = Math.max(anchorIdx, hoverIdx);
    return new Set(orderedItems.slice(lo, hi + 1).map(t => t.id));
  }, [shiftHeld, anchorId, hoverId, orderedItems]);

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleCardClick = useCallback((id, e) => {
    if (e.shiftKey && anchorId !== null) {
      // Commit range
      const anchorIdx  = orderedItems.findIndex(t => t.id === anchorId);
      const targetIdx  = orderedItems.findIndex(t => t.id === id);
      if (anchorIdx === -1 || targetIdx === -1) return;

      const lo = Math.min(anchorIdx, targetIdx);
      const hi = Math.max(anchorIdx, targetIdx);
      const rangeIds = orderedItems.slice(lo, hi + 1).map(t => t.id);

      setSelectedIds(prev => {
        const next = new Set(prev);
        // If anchor is selected → add range; if not → remove range
        if (prev.has(anchorId)) rangeIds.forEach(rid => next.add(rid));
        else                    rangeIds.forEach(rid => next.delete(rid));
        return next;
      });
      // Anchor stays — do not move it on Shift+click
      setHoverId(null);
    } else {
      // Plain click → toggle item, update anchor
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else              next.add(id);
        return next;
      });
      setAnchorId(id);
      setHoverId(null);
    }
  }, [anchorId, orderedItems]);

  // ── Hover handlers ────────────────────────────────────────────────────────
  const handleCardHover    = useCallback((id) => setHoverId(id), []);
  const handleCardHoverEnd = useCallback(()   => setHoverId(null), []);

  // ── Drag-select: merge IDs without disturbing the shift-select anchor ──────
  // Called by DragSelectLayer after a rubber-band drag completes.
  const addToSelection = useCallback((ids) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    // Intentionally does not update anchorId — the next plain click will set it.
  }, []);

  // ── Bulk helpers ──────────────────────────────────────────────────────────
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(orderedItems.map(t => t.id)));
    setAnchorId(null);
  }, [orderedItems]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
    setAnchorId(null);
    setHoverId(null);
  }, []);

  return {
    selectedIds,
    softSelectedIds,
    shiftHeld,
    handleCardClick,
    handleCardHover,
    handleCardHoverEnd,
    addToSelection,
    selectAll,
    selectNone,
  };
}
