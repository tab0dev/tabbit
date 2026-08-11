import { useState, useCallback, useEffect, useRef } from 'react';
import { mergeIntoArchive, restoreFromArchive, removeFromArchive } from '../../../services/bookmarkService';
import { saveHandle, loadHandle, clearHandle, loadHandleMeta } from '../../../utils/archiveFileHandle';
import { useTriage } from '../../../store/TriageProvider';
import { globalChromeUndoStack } from '../../../hooks/useTriageActions';

/**
 * useArchive
 *
 * Manages the cold storage archive using the File System Access API.
 * Mirrors the pattern used by files.md: a FileSystemFileHandle is persisted
 * in IndexedDB so the file can be read/written across sessions without
 * prompting the user again (as long as permission is still granted).
 *
 * Archive states:
 *   'unlinked'        — no handle in IndexedDB; user needs to create a file
 *   'needsPermission' — handle found but queryPermission() returned 'prompt';
 *                       a user-gesture button calls requestPermission()
 *   'ready'           — handle has readwrite permission; archive is loaded
 *
 * File I/O:
 *   Create  → showSaveFilePicker (one-time save dialog, user picks location)
 *   Read    → handle.getFile().text()  → JSON.parse
 *   Write   → handle.createWritable() → write(JSON) → close()  (no dialog)
 *
 * @param {{ onRefreshTree: () => Promise<void> }} opts
 */
export function useArchive({ onRefreshTree }) {
  const [archive,      setArchive]      = useState(null);
  const [archiveState, setArchiveState] = useState('unlinked'); // 'unlinked' | 'needsRelink' | 'needsPermission' | 'ready'
  const [lastKnownFilename, setLastKnownFilename] = useState(null); // populated in 'needsRelink' state
  const { dispatch } = useTriage();

  // Keep a ref so callbacks (handleAppend etc.) always see the current handle
  // without being re-created on every state change.
  const handleRef = useRef(null);

  // ── On mount: attempt to reconnect from IndexedDB ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const handle = await loadHandle();
        if (!handle) {
          // IndexedDB empty — check localStorage for a previously-linked filename.
          // If found, show 'needsRelink' so the user knows they had a file and
          // can re-pick it, rather than seeing a blank "no archive file linked".
          const meta = loadHandleMeta();
          if (meta?.filename) {
            setLastKnownFilename(meta.filename);
            setArchiveState('needsRelink');
          } else {
            setArchiveState('unlinked');
          }
          return;
        }

        handleRef.current = handle;
        const perm = await handle.queryPermission({ mode: 'readwrite' });

        if (perm === 'granted') {
          await readArchiveFromHandle(handle);
        } else {
          // perm === 'prompt' — need a user gesture to call requestPermission
          setArchiveState('needsPermission');
        }
      } catch (err) {
        console.warn('[Tabbit] Could not load archive handle from IndexedDB', err);
        setArchiveState('unlinked');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Internal: read archive from an already-permitted handle ───────────────
  async function readArchiveFromHandle(handle) {
    try {
      const file    = await handle.getFile();
      const text    = await file.text();
      const parsed  = JSON.parse(text);
      // Backfill filename in case it was missing from an earlier write
      if (!parsed.filename) parsed.filename = handle.name;
      setArchive(parsed);
      setArchiveState('ready');
    } catch (err) {
      console.warn('[Tabbit] Could not read archive file', err);
      // File may have been deleted — let user create a new one
      await clearHandle();
      setArchiveState('unlinked');
    }
  }

  // ── Internal: write current archive to the handle ─────────────────────────
  async function writeArchiveToHandle(updatedArchive) {
    const handle = handleRef.current;
    if (!handle) throw new Error('[Tabbit] No archive file handle');
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(updatedArchive, null, 2));
    await writable.close();
  }

  // ── Create (first-time): user picks save location ─────────────────────────
  const handleCreateArchive = useCallback(async () => {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'chrome-tab-archive.json',
        types: [{
          description: 'JSON archive',
          accept: { 'application/json': ['.json'] },
        }],
      });

      const emptyArchive = {
        version:      1,
        filename:     handle.name,
        lastModified: new Date().toISOString(),
        bookmarks:    [],
      };

      handleRef.current = handle;
      await writeArchiveToHandle(emptyArchive);
      await saveHandle(handle);

      setArchive(emptyArchive);
      setArchiveState('ready');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[Tabbit] Could not create archive file', err);
      }
      // AbortError = user dismissed the dialog; stay in current state
    }
  }, []);

  // ── Reconnect (return visit, permission lapsed) ───────────────────────────
  const handleReconnect = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    try {
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await readArchiveFromHandle(handle);
      }
    } catch (err) {
      console.warn('[Tabbit] requestPermission failed', err);
    }
  }, []);

  // ── Append: merge nodes into archive, write to file ───────────────────────
  const handleAppend = useCallback(async (nodes) => {
    const updated = mergeIntoArchive(nodes, archive);
    await writeArchiveToHandle(updated);
    setArchive(updated);
    return updated;
  }, [archive]);

  // ── Restore: re-create selected bookmarks in Chrome ───────────────────────
  // urlSet: Set<string> of URLs to restore (passed from ColdStoragePanel)
  const handleRestore = useCallback(async (urlSet) => {
    if (!archive?.bookmarks) return;
    const urls = urlSet?.size > 0 ? urlSet : null;
    const restoredNodes = await restoreFromArchive(archive.bookmarks, urls);
    await onRefreshTree();
    
    if (restoredNodes && restoredNodes.length > 0) {
      globalChromeUndoStack.push({
        type: 'bookmarks_manager_custom',
        undoFn: async () => {
          for (const node of restoredNodes) {
            await chrome.bookmarks.remove(node.id).catch(() => {});
          }
          await onRefreshTree();
        }
      });
      dispatch({ type: 'PROCESS_BOOKMARKS_MANAGER_ACTION', payload: { batchSize: restoredNodes.length } });
    }
  }, [archive, onRefreshTree, dispatch]);

  // ── Restore + remove: restore to Chrome AND purge from archive file ────────
  // urlSet: Set<string> of URLs to restore+remove (passed from ColdStoragePanel)
  const handleRestoreAndRemove = useCallback(async (urlSet) => {
    if (!archive?.bookmarks || !urlSet?.size) return;
    
    // Store original archived items for undo
    const itemsToRestoreToArchive = archive.bookmarks.filter(b => urlSet.has(b.url));
    
    // 1. Restore selected bookmarks back into Chrome
    const restoredNodes = await restoreFromArchive(archive.bookmarks, urlSet);
    // 2. Remove them from the archive object
    const updated = removeFromArchive(archive, urlSet);
    // 3. Persist the trimmed archive to disk
    await writeArchiveToHandle(updated);
    setArchive(updated);
    await onRefreshTree();
    
    if (itemsToRestoreToArchive.length > 0) {
      globalChromeUndoStack.push({
        type: 'bookmarks_manager_custom',
        undoFn: async () => {
          // Remove from Chrome
          if (restoredNodes) {
            for (const node of restoredNodes) {
              await chrome.bookmarks.remove(node.id).catch(() => {});
            }
          }
          // Re-append to Archive
          const handle = handleRef.current;
          if (handle) {
            // Need latest archive state to merge into
            const file = await handle.getFile();
            const text = await file.text();
            const currentArchive = JSON.parse(text);
            const reverted = mergeIntoArchive(itemsToRestoreToArchive, currentArchive);
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(reverted, null, 2));
            await writable.close();
            setArchive(reverted);
          }
          await onRefreshTree();
        }
      });
      dispatch({ type: 'PROCESS_BOOKMARKS_MANAGER_ACTION', payload: { batchSize: itemsToRestoreToArchive.length } });
    }
  }, [archive, onRefreshTree, dispatch]);

  // ── Remove from archive: purge entries, write to file ────────────────────
  // urlSet: Set<string> of URLs to purge (passed from ColdStoragePanel)
  const handleRemoveFromArchive = useCallback(async (urlSet) => {
    if (!archive?.bookmarks || !urlSet?.size) return;
    
    const itemsToRestoreToArchive = archive.bookmarks.filter(b => urlSet.has(b.url));
    
    const updated = removeFromArchive(archive, urlSet);
    await writeArchiveToHandle(updated);
    setArchive(updated);
    
    if (itemsToRestoreToArchive.length > 0) {
      globalChromeUndoStack.push({
        type: 'bookmarks_manager_custom',
        undoFn: async () => {
          const handle = handleRef.current;
          if (handle) {
            const file = await handle.getFile();
            const text = await file.text();
            const currentArchive = JSON.parse(text);
            const reverted = mergeIntoArchive(itemsToRestoreToArchive, currentArchive);
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(reverted, null, 2));
            await writable.close();
            setArchive(reverted);
          }
        }
      });
      dispatch({ type: 'PROCESS_BOOKMARKS_MANAGER_ACTION', payload: { batchSize: itemsToRestoreToArchive.length } });
    }
  }, [archive, dispatch]);

  return {
    archive,
    archiveState,
    archiveReady: archiveState === 'ready',
    lastKnownFilename,
    handleCreateArchive,
    handleReconnect,
    handleAppend,
    handleRestore,
    handleRestoreAndRemove,
    handleRemoveFromArchive,
  };

}
