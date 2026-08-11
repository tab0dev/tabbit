import { useState, useCallback, useMemo, useEffect } from 'react';
import { getAllLeaves } from '../../../utils/bookmarkUtils';

/**
 * useBookmarkSelection
 *
 * Selection logic for the Bookmark Manager list view.
 *
 * Built on top of the same model as useRangeSelection (ListView), with additions
 * to handle folder selection:
 *   - Clicking a folder selects all its recursive leaf children
 *   - Deselecting a child does NOT clear the folder from selectedFolderIds
 *     (the folder still gets deleted when the action fires; orphans are rescued)
 *   - Folder checkbox state is derived: unchecked / indeterminate / checked
 *   - Shift+click range selection works on the flat ordered items list (leaves only)
 *   - Drag-select (addToSelection) works identically to ListView
 *
 * @param {object[]} orderedFlatLeaves - the display-ordered flat array of leaf nodes
 *   (used for shift-click range, must be the same array the list rows render from)
 *
 * @returns {{
 *   selectedLeafIds:    Set<string>,
 *   selectedFolderIds:  Set<string>,
 *   softSelectedIds:    Set<string>,
 *   shiftHeld:          boolean,
 *   getFolderCheckState: (folderNode: object) => 'unchecked'|'indeterminate'|'checked',
 *   handleLeafClick:    (id: string, e: MouseEvent) => void,
 *   handleFolderClick:  (folderNode: object, e: MouseEvent) => void,
 *   handleItemHover:    (id: string) => void,
 *   handleItemHoverEnd: () => void,
 *   addToSelection:     (ids: string[]) => void,
 *   selectAll:          () => void,
 *   selectNone:         () => void,
 * }}
 */
export function useBookmarkSelection(orderedFlatLeaves) {
  const [selectedLeafIds,   setSelectedLeafIds]   = useState(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState(new Set());

  // Shift-range state — mirrors useRangeSelection exactly
  const [anchorId,   setAnchorId]   = useState(null);
  const [hoverId,    setHoverId]    = useState(null);
  const [shiftHeld,  setShiftHeld]  = useState(false);

  // ── Track Shift key globally (identical to useRangeSelection) ────────────
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

  // ── Soft-selected range (shift-hover preview) — identical to useRangeSelection ──
  const softSelectedIds = useMemo(() => {
    if (!shiftHeld || anchorId === null || hoverId === null) return new Set();
    const anchorIdx = orderedFlatLeaves.findIndex(t => t.id === anchorId);
    const hoverIdx  = orderedFlatLeaves.findIndex(t => t.id === hoverId);
    if (anchorIdx === -1 || hoverIdx === -1) return new Set();
    const lo = Math.min(anchorIdx, hoverIdx);
    const hi = Math.max(anchorIdx, hoverIdx);
    return new Set(orderedFlatLeaves.slice(lo, hi + 1).map(t => t.id));
  }, [shiftHeld, anchorId, hoverId, orderedFlatLeaves]);

  // ── Folder checkbox state (derived, not stored) ───────────────────────────
  const getFolderCheckState = useCallback((folderNode) => {
    const allLeaves = getAllLeaves(folderNode);
    if (allLeaves.length === 0) {
      return selectedFolderIds.has(folderNode.id) ? 'checked' : 'unchecked';
    }

    const selectedCount          = allLeaves.filter(l => selectedLeafIds.has(l.id)).length;
    const folderExplicitSelected = selectedFolderIds.has(folderNode.id);

    if (selectedCount === 0 && !folderExplicitSelected) return 'unchecked';
    if (selectedCount === allLeaves.length && folderExplicitSelected) return 'checked';
    return 'indeterminate';
  }, [selectedLeafIds, selectedFolderIds]);

  // ── Leaf click handler (shift-range identical to useRangeSelection) ───────
  const handleLeafClick = useCallback((id, e) => {
    if (e.shiftKey && anchorId !== null) {
      // Commit shift-range — identical logic to useRangeSelection
      const anchorIdx = orderedFlatLeaves.findIndex(t => t.id === anchorId);
      const targetIdx = orderedFlatLeaves.findIndex(t => t.id === id);
      if (anchorIdx === -1 || targetIdx === -1) return;
      const lo = Math.min(anchorIdx, targetIdx);
      const hi = Math.max(anchorIdx, targetIdx);
      const rangeIds = orderedFlatLeaves.slice(lo, hi + 1).map(t => t.id);

      setSelectedLeafIds(prev => {
        const next = new Set(prev);
        if (prev.has(anchorId)) rangeIds.forEach(rid => next.add(rid));
        else                    rangeIds.forEach(rid => next.delete(rid));
        return next;
      });
      setHoverId(null);
      // NOTE: does NOT touch selectedFolderIds — folder intent is independent
    } else {
      // Plain click — toggle the leaf
      setSelectedLeafIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else              next.add(id);
        return next;
      });
      setAnchorId(id);
      setHoverId(null);
      // NOTE: does NOT touch selectedFolderIds
    }
  }, [anchorId, orderedFlatLeaves]);

  // ── Folder click handler ──────────────────────────────────────────────────
  const handleFolderClick = useCallback((folderNode) => {
    const leaves   = getAllLeaves(folderNode);
    const leafIds  = leaves.map(l => l.id);
    const isFolderSelected = selectedFolderIds.has(folderNode.id);

    if (isFolderSelected) {
      // Deselect: remove folder and all its leaves
      setSelectedFolderIds(prev => { const n = new Set(prev); n.delete(folderNode.id); return n; });
      setSelectedLeafIds(prev => {
        const lSet = new Set(leafIds);
        return new Set([...prev].filter(id => !lSet.has(id)));
      });
    } else {
      // Select: add folder and all its recursive leaf children
      setSelectedFolderIds(prev => new Set([...prev, folderNode.id]));
      setSelectedLeafIds(prev => new Set([...prev, ...leafIds]));
      // Set anchor to the first leaf so shift-range works naturally from here
      if (leafIds.length > 0) setAnchorId(leafIds[0]);
    }
    setHoverId(null);
  }, [selectedFolderIds]);

  // ── Hover (for soft-select preview) ──────────────────────────────────────
  const handleItemHover    = useCallback((id) => setHoverId(id), []);
  const handleItemHoverEnd = useCallback(()   => setHoverId(null), []);

  // ── Drag-select (identical to useRangeSelection.addToSelection) ───────────
  const addToSelection = useCallback((ids) => {
    setSelectedLeafIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    // Does not update anchorId — next plain click sets it
  }, []);

  // ── Bulk helpers ──────────────────────────────────────────────────────────
  const selectAll = useCallback(() => {
    setSelectedLeafIds(new Set(orderedFlatLeaves.map(t => t.id)));
    setAnchorId(null);
    // Does not auto-select all folders — user explicitly selects folders
  }, [orderedFlatLeaves]);

  const selectNone = useCallback(() => {
    setSelectedLeafIds(new Set());
    setSelectedFolderIds(new Set());
    setAnchorId(null);
    setHoverId(null);
  }, []);

  return {
    selectedLeafIds,
    selectedFolderIds,
    softSelectedIds,
    shiftHeld,
    hoverId,
    getFolderCheckState,
    handleLeafClick,
    handleFolderClick,
    handleItemHover,
    handleItemHoverEnd,
    addToSelection,
    selectAll,
    selectNone,
  };
}
