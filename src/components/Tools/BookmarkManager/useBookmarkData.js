import { useState, useCallback, useEffect } from 'react';
import {
  getFullBookmarkSnapshot,
  executeRemove,
  executeArchive,
  resolveSelection,
} from '../../../services/bookmarkService';

/**
 * useBookmarkData
 *
 * Manages the full Chrome bookmark tree: initial load, refresh after mutations,
 * and the expand-state for the tree view.
 *
 * Separating this from the component means BookmarkManagerCard and BrowsePanel
 * never need to call Chrome APIs directly — they read tree state and call
 * the returned mutation helpers.
 *
 * @returns {{
 *   fullTree:       object[],
 *   loading:        boolean,
 *   expandedIds:    Set<string>,
 *   toggleExpand:   (id: string) => void,
 *   expandAll:      (ids: string[]) => void,
 *   mergeExpandIds: (ids: string[]) => void,
 *   collapseAll:    () => void,
 *   refreshTree:    () => Promise<void>,
 * }}
 */
export function useBookmarkData() {
  const [fullTree,    setFullTree]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Initial load
  useEffect(() => {
    getFullBookmarkSnapshot()
      .then(tree => {
        setFullTree(tree);
        // Auto-expand all top-level folders on first load
        setExpandedIds(new Set(tree.map(n => n.id)));
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * Re-fetches the full tree from Chrome after a mutation (remove/archive).
   * Keeps expandedIds intact so the user's expand state survives.
   */
  const refreshTree = useCallback(async () => {
    const newTree = await getFullBookmarkSnapshot();
    setFullTree(newTree);
  }, []);

  const toggleExpand = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback((ids) => {
    setExpandedIds(new Set(ids));
  }, []);

  const mergeExpandIds = useCallback((ids) => {
    setExpandedIds(prev => new Set([...prev, ...ids]));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  return { fullTree, loading, expandedIds, toggleExpand, expandAll, mergeExpandIds, collapseAll, refreshTree };
}
