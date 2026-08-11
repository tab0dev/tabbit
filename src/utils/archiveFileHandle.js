/**
 * archiveFileHandle.js
 *
 * Persists a FileSystemFileHandle to IndexedDB so it survives extension
 * reloads and browser restarts. FileSystemFileHandle cannot be stored in
 * chrome.storage.local or localStorage — IndexedDB is the only supported
 * serialisation mechanism for these objects.
 *
 * On subsequent sessions the caller should always verify permission before
 * use:
 *   const perm = await handle.queryPermission({ mode: 'readwrite' });
 *   if (perm === 'prompt') await handle.requestPermission({ mode: 'readwrite' });
 *
 * localStorage fallback:
 *   A lightweight { filename, linkedAt } object is written to localStorage
 *   alongside every IndexedDB save. This survives IndexedDB eviction so that
 *   when the handle is gone the app can still tell the user which file they
 *   had linked and prompt them to re-link it (instead of showing a blank
 *   "no archive file linked" state).
 */

const DB_NAME    = 'tabbit-archive';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'archiveHandle';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Persists a FileSystemFileHandle to IndexedDB.
 * @param {FileSystemFileHandle} handle
 */
export async function saveHandle(handle) {
  const db    = await openDb();
  const tx    = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put(handle, HANDLE_KEY);
  // Mirror filename to localStorage so we survive IndexedDB eviction.
  try {
    localStorage.setItem('tabbit-archive-meta', JSON.stringify({
      filename: handle.name,
      linkedAt: new Date().toISOString(),
    }));
  } catch { /* localStorage unavailable — not fatal */ }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = (e) => { db.close(); reject(e.target.error); };
  });
}

/**
 * Retrieves the stored FileSystemFileHandle, or null if none exists.
 * @returns {Promise<FileSystemFileHandle|null>}
 */
export async function loadHandle() {
  const db    = await openDb();
  const tx    = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const req   = store.get(HANDLE_KEY);
  return new Promise((resolve, reject) => {
    req.onsuccess = (e) => { db.close(); resolve(e.target.result ?? null); };
    req.onerror   = (e) => { db.close(); reject(e.target.error); };
  });
}

/**
 * Removes the stored handle (e.g. user wants to unlink / create a new file).
 */
export async function clearHandle() {
  const db    = await openDb();
  const tx    = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(HANDLE_KEY);
  try { localStorage.removeItem('tabbit-archive-meta'); } catch { /* not fatal */ }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror    = (e) => { db.close(); reject(e.target.error); };
  });
}

/**
 * Returns the last-known archive filename from localStorage, or null.
 * Used when IndexedDB has no handle — lets the UI show which file was
 * previously linked and prompt the user to re-link it.
 *
 * @returns {{ filename: string, linkedAt: string } | null}
 */
export function loadHandleMeta() {
  try {
    const raw = localStorage.getItem('tabbit-archive-meta');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
