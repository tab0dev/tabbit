import { useState, useCallback, useEffect } from 'react';
import { flattenVisibleTree, isAncestorOf, moveNodeInDraftTree, insertNodeInDraftTree, renameNodeInDraftTree, findNodeById } from '../../../utils/bookmarkUtils';
import { globalChromeUndoStack } from '../../../hooks/useTriageActions';
import { useTriage } from '../../../store/TriageProvider';

/**
 * Decodes a dnd-kit overId into { newParentId, beforeSiblingId }.
 *
 * Spacer IDs:
 *   spacer:before:${nodeId}  →  insert before nodeId in nodeId's parent
 *   spacer:end:${folderId}   →  append to folderId (no beforeSiblingId)
 *
 * Plain folder ID (row drop):
 *   ${folderId}              →  drop inside folder (append)
 */
function decodeDropTarget(overId, draftTree) {
  if (overId.startsWith('spacer:before:')) {
    const nodeId = overId.slice('spacer:before:'.length);
    const node = findNodeById(draftTree, nodeId);
    if (!node) return null;
    return { newParentId: node.parentId, beforeSiblingId: nodeId };
  }
  if (overId.startsWith('spacer:end:')) {
    const folderId = overId.slice('spacer:end:'.length);
    return { newParentId: folderId, beforeSiblingId: null };
  }
  // Plain folder row drop → inside
  return { newParentId: overId, beforeSiblingId: null };
}

export function useBookmarkDnd({
  fullTree,
  sortMode,
  expandedIds,
  selectionRef,
  onRefreshTree,
  onAcceptStaged, // NEW prop
}) {
  const { dispatch } = useTriage();
  const [draftTree, setDraftTree] = useState(fullTree);
  const [pendingMoves, setPendingMoves] = useState([]);
  
  const [pendingDeletes, setPendingDeletes] = useState({ leaves: new Set(), folders: new Set() });
  const [pendingArchives, setPendingArchives] = useState({ leaves: new Set(), folders: new Set() });

  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const isDragging = dragId != null;

  // Sync draftTree when fullTree changes (only when idle)
  useEffect(() => {
    if (pendingMoves.length === 0 && !isDragging) {
      setDraftTree(fullTree);
    }
  }, [fullTree, pendingMoves.length, isDragging]);

  const stageDeletions = useCallback((leaves, folders) => {
    setPendingDeletes(prev => ({
      leaves: new Set([...prev.leaves, ...leaves]),
      folders: new Set([...prev.folders, ...folders]),
    }));
  }, []);

  const stageArchives = useCallback((leaves, folders) => {
    setPendingArchives(prev => ({
      leaves: new Set([...prev.leaves, ...leaves]),
      folders: new Set([...prev.folders, ...folders]),
    }));
  }, []);

  const unstageDeletions = useCallback((leaves, folders) => {
    setPendingDeletes(prev => {
      const nextLeaves = new Set(prev.leaves);
      const nextFolders = new Set(prev.folders);
      for (const l of leaves) nextLeaves.delete(l);
      for (const f of folders) nextFolders.delete(f);
      return { leaves: nextLeaves, folders: nextFolders };
    });
  }, []);

  const unstageArchives = useCallback((leaves, folders) => {
    setPendingArchives(prev => {
      const nextLeaves = new Set(prev.leaves);
      const nextFolders = new Set(prev.folders);
      for (const l of leaves) nextLeaves.delete(l);
      for (const f of folders) nextFolders.delete(f);
      return { leaves: nextLeaves, folders: nextFolders };
    });
  }, []);

  const onDragStart = useCallback((event) => {
    if (sortMode !== 'manual') return;
    setDragId(event.active.id);
  }, [sortMode]);

  // Simplified: just track which droppable the pointer is over.
  // No ratio math — the spacer/row separation handles position semantics.
  const onDragOver = useCallback((event) => {
    if (sortMode !== 'manual') return;
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setOverId(null);
      return;
    }
    setOverId(over.id);
  }, [sortMode]);

  const onDragEnd = useCallback((event) => {
    if (sortMode !== 'manual') return;
    const { active, over } = event;

    if (!over || !overId) {
      setDragId(null);
      setOverId(null);
      return;
    }

    const decoded = decodeDropTarget(overId, draftTree);
    if (!decoded) {
      setDragId(null);
      setOverId(null);
      return;
    }

    const { newParentId, beforeSiblingId } = decoded;

    // Collect items to move
    let itemsToMove = [active.id];
    const { selectedLeafIds, selectedFolderIds } = selectionRef.current;
    if (selectedLeafIds.has(active.id) || selectedFolderIds.has(active.id)) {
      const visible = flattenVisibleTree(draftTree, expandedIds);
      itemsToMove = visible
        .filter(v => selectedLeafIds.has(v.id) || selectedFolderIds.has(v.id))
        .map(v => v.id);
      if (itemsToMove.length === 0) itemsToMove = [active.id];
    }

    // Filter out descendants of other items being moved (drag whole subtrees only once)
    const rootItemsToMove = itemsToMove.filter(id =>
      !itemsToMove.some(otherId => otherId !== id && isAncestorOf(otherId, id, draftTree))
    );

    // Guard: can't drop into a descendant of what's being moved
    if (rootItemsToMove.some(id => isAncestorOf(id, newParentId, draftTree))) {
      setDragId(null);
      setOverId(null);
      return;
    }

    // Guard: can't drop an item onto itself (folder row drop)
    if (rootItemsToMove.includes(newParentId)) {
      setDragId(null);
      setOverId(null);
      return;
    }

    let currentDraft = draftTree;
    const newPendingMoves = [...pendingMoves];

    const targetNode = findNodeById(draftTree, newParentId);
    let resolvedParentId = newParentId;

    if (targetNode && !targetNode.isFolder && !beforeSiblingId) {
      // Grouping Action: dropped onto a leaf
      // 1. Synthesize a draft folder
      const draftFolderId = 'draft_group_' + Math.random().toString(36).substr(2, 9);
      const draftFolderTitle = 'New Group';
      const newFolderNode = {
        id: draftFolderId,
        title: draftFolderTitle,
        isFolder: true,
        children: []
      };

      // 2. Insert the new folder where the target leaf currently is
      currentDraft = insertNodeInDraftTree(currentDraft, newFolderNode, targetNode.parentId, targetNode.id);

      // 3. Move the target leaf inside the draft folder
      currentDraft = moveNodeInDraftTree(currentDraft, targetNode.id, draftFolderId, null);

      // 4. Register the group creation
      newPendingMoves.push({
        type: 'CREATE_GROUP',
        draftId: draftFolderId,
        parentId: targetNode.parentId,
        title: draftFolderTitle,
        targetSiblingId: targetNode.id
      });
      newPendingMoves.push({ dragId: targetNode.id, newParentId: draftFolderId, beforeSiblingId: null });

      // Dragged items will now move into the new folder
      resolvedParentId = draftFolderId;
    }

    for (const itemId of rootItemsToMove) {
      currentDraft = moveNodeInDraftTree(currentDraft, itemId, resolvedParentId, beforeSiblingId);
      newPendingMoves.push({ dragId: itemId, newParentId: resolvedParentId, beforeSiblingId });
    }

    setDraftTree(currentDraft);
    setPendingMoves(newPendingMoves);
    setDragId(null);
    setOverId(null);
  }, [sortMode, overId, draftTree, pendingMoves, selectionRef, expandedIds]);

  const onDragCancel = useCallback(() => {
    setDragId(null);
    setOverId(null);
  }, []);

  const onRenameDraftFolder = useCallback((id, newTitle) => {
    setDraftTree(prev => renameNodeInDraftTree(prev, id, newTitle));
    setPendingMoves(prev => prev.map(m =>
      m.type === 'CREATE_GROUP' && m.draftId === id ? { ...m, title: newTitle } : m
    ));
  }, []);

  const handleAccept = useCallback(async () => {
    const hasMoves = pendingMoves.length > 0;
    const hasDeletes = pendingDeletes.leaves.size > 0 || pendingDeletes.folders.size > 0;
    const hasArchives = pendingArchives.leaves.size > 0 || pendingArchives.folders.size > 0;
    
    if (!hasMoves && !hasDeletes && !hasArchives) return;
    
    // For Undo: We need to remember original parentId and index of all dragged items.
    const originalLocations = {};
    for (const move of pendingMoves) {
      if (move.type !== 'CREATE_GROUP') {
        const originalNode = findNodeById(fullTree, move.dragId);
        if (originalNode) {
          originalLocations[move.dragId] = {
            parentId: originalNode.parentId,
            index: originalNode.index,
          };
        }
      }
    }

    if (onAcceptStaged) {
      await onAcceptStaged({
        pendingMoves,
        pendingDeletes,
        pendingArchives,
        originalLocations, // Passed to parent for undo
      });
    }

    setPendingMoves([]);
    setPendingDeletes({ leaves: new Set(), folders: new Set() });
    setPendingArchives({ leaves: new Set(), folders: new Set() });
  }, [pendingMoves, pendingDeletes, pendingArchives, fullTree, onAcceptStaged]);

  const handleRevert = useCallback(() => {
    setDraftTree(fullTree);
    setPendingMoves([]);
    setPendingDeletes({ leaves: new Set(), folders: new Set() });
    setPendingArchives({ leaves: new Set(), folders: new Set() });
  }, [fullTree]);

  const dndHandlers = sortMode === 'manual'
    ? { onDragStart, onDragOver, onDragEnd, onDragCancel }
    : { onDragStart: () => {}, onDragOver: () => {}, onDragEnd: () => {}, onDragCancel: () => {} };

  return {
    draftTree,
    pendingMoves,
    pendingDeletes,
    pendingArchives,
    isDragging: isDragging && sortMode === 'manual',
    dragId,
    overId,
    dndHandlers,
    handleAccept,
    handleRevert,
    stageDeletions,
    stageArchives,
    unstageDeletions,
    unstageArchives,
    stagedCount: pendingMoves.length + pendingDeletes.leaves.size + pendingDeletes.folders.size + pendingArchives.leaves.size + pendingArchives.folders.size,
    movesCount: pendingMoves.filter(m => m.type !== 'CREATE_GROUP').length,
    deletesCount: pendingDeletes.leaves.size + pendingDeletes.folders.size,
    archivesCount: pendingArchives.leaves.size + pendingArchives.folders.size,
    onRenameDraftFolder,
  };
}
