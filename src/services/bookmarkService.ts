/**
 * bookmarkService.js
 *
 * All Chrome bookmark API interactions for the Bookmark Manager feature.
 * Handles: full tree fetching, cold-bookmark detection, selection resolution,
 * execute-remove, execute-archive, archive merge, and restore.
 *
 * Archive file I/O (FileSystemFileHandle reads/writes) is handled by
 * useArchive.js — this layer stays pure (no file-system side effects).
 *
 * Does NOT touch TriageProvider state — this is a pure service layer.
 */

import {
  buildFullTree,
  flattenTree,
  findNodeById,
  getAllLeaves,
  sortBookmarks,
} from '../utils/bookmarkUtils';
import { BookmarkNode, ArchivedBookmark, BookmarkArchive, ResolvedSelection } from '../types';

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * Fetches the entire Chrome bookmark tree and returns it as a fully-annotated
 * tree including both folders and bookmark leaves.
 * All metadata (dateAdded, dateLastUsed, index, parentId) is preserved.
 *
 * @returns {Promise<object[]>}
 */
export async function getFullBookmarkSnapshot(): Promise<BookmarkNode[]> {
  const tree = await chrome.bookmarks.getTree();
  const rootNode = tree[0]; // synthetic root, id "0"
  return buildFullTree(rootNode.children ?? []);
}

/**
 * Returns all bookmark leaves (nodes with a url) from the full tree,
 * flattened and sorted by lastActivity ascending (stalest first).
 *
 * @param {object[]} fullTree - output of getFullBookmarkSnapshot()
 * @param {'lastActivity'|'dateAdded'|'title'|'manual'} sortBy
 * @param {boolean} [asc=true]
 * @returns {object[]}
 */
export function getSortedBookmarkLeaves(
  fullTree: BookmarkNode[],
  sortBy: 'lastActivity' | 'dateAdded' | 'title' | 'manual' = 'lastActivity',
  asc = true,
): BookmarkNode[] {
  const leaves = flattenTree(fullTree).filter((n) => !n.isFolder && n.url);
  return sortBookmarks(leaves, sortBy, asc);
}

// ─── Selection resolution ─────────────────────────────────────────────────────

/**
 * Resolves a mixed selection (individual leaves + explicitly-selected folders)
 * into a concrete, ordered set of Chrome operations.
 *
 * Rules:
 *   1. Fully-selected folder (all leaves selected):
 *      → all leaves go to toAction; folder goes to foldersToRemove.
 *
 *   2. Partially-selected folder (folder in selectedFolderIds, some leaves deselected):
 *      → selected leaves go to toAction.
 *      → deselected leaves go to toOrphan (will be moved to folder's parent position).
 *      → folder goes to foldersToRemove (the user explicitly selected it).
 *
 *   3. Standalone leaf (no parent folder selected):
 *      → leaf goes to toAction; nothing else changes.
 *
 * @param {Set<string>} selectedLeafIds
 * @param {Set<string>} selectedFolderIds
 * @param {object[]}    fullTree
 * @returns {{ toAction: object[], toOrphan: object[], foldersToRemove: object[] }}
 */
export function resolveSelection(
  selectedLeafIds: Set<string>,
  selectedFolderIds: Set<string>,
  fullTree: BookmarkNode[],
): ResolvedSelection {
  const toAction: BookmarkNode[] = [];
  const toOrphan: ResolvedSelection['toOrphan'] = [];
  const foldersToRemove: BookmarkNode[] = [];
  const handledLeafIds = new Set<string>();

  // Pass 1: process each explicitly-selected folder
  for (const folderId of Array.from(selectedFolderIds)) {
    const folderNode = findNodeById(fullTree, folderId);
    if (!folderNode) continue;

    const allLeaves = getAllLeaves(folderNode);
    const selectedLeaves = allLeaves.filter((l) => selectedLeafIds.has(l.id));
    const orphanedLeaves = allLeaves.filter((l) => !selectedLeafIds.has(l.id));

    selectedLeaves.forEach((l) => {
      toAction.push(l);
      handledLeafIds.add(l.id);
    });

    if (orphanedLeaves.length > 0) {
      // These are leaves the user deliberately deselected inside a selected folder.
      // After the action, we rescue them to the folder's parent at the folder's index.
      orphanedLeaves.forEach((l) =>
        toOrphan.push({
          ...l,
          rescueTo: { parentId: folderNode.parentId!, index: folderNode.index ?? 0 },
        }),
      ); // Casting removed because we correctly typed toOrphan
    }

    foldersToRemove.push(folderNode);
  }

  // Pass 2: any remaining selected leaves whose parent folder wasn't selected
  for (const leafId of Array.from(selectedLeafIds)) {
    if (!handledLeafIds.has(leafId)) {
      const node = findNodeById(fullTree, leafId);
      if (node) toAction.push(node);
    }
  }

  return { toAction, toOrphan, foldersToRemove };
}

// ─── Chrome mutation helpers ──────────────────────────────────────────────────

/**
 * Executes a Remove action from a resolved selection.
 * Operation order:
 *   1. Move orphaned children to safety (before their parent folder is deleted).
 *   2. Remove selected leaves (descending index order to avoid index shifting).
 *   3. Remove the now-empty (or emptied) folders.
 *
 * @param {{ toAction: object[], toOrphan: object[], foldersToRemove: object[] }} resolved
 */
export async function executeRemove({ toAction, toOrphan, foldersToRemove }: ResolvedSelection) {
  // 1. Rescue orphaned children first
  for (const node of toOrphan) {
    await chrome.bookmarks.move(node.id, node.rescueTo).catch(() => {});
  }

  // 2. Remove selected leaves — descending index to avoid shifting siblings
  const sorted = [...toAction].sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
  for (const node of sorted) {
    await chrome.bookmarks.remove(node.id).catch(() => {});
  }

  // 3. Remove now-empty folders
  for (const folder of foldersToRemove) {
    await chrome.bookmarks.remove(folder.id).catch(() => {});
  }
}

/**
 * Executes an Archive action from a resolved selection.
 * Orphaned nodes are rescued but NOT archived — user deselected them intentionally.
 *
 * @param {{ toAction: object[], toOrphan: object[], foldersToRemove: object[] }} resolved
 * @param {object|null} existingArchive - current parsed archive JSON, or null on first write
 * @returns {Promise<object>} the updated archive object
 */
export async function executeArchive(
  { toAction, toOrphan, foldersToRemove }: ResolvedSelection,
  existingArchive: BookmarkArchive | null,
) {
  // 1. Rescue orphaned children first
  for (const node of toOrphan) {
    await chrome.bookmarks.move(node.id, node.rescueTo).catch(() => {});
  }

  // 2. Merge selected leaves into archive (pure — no file I/O here)
  const updatedArchive = mergeIntoArchive(toAction, existingArchive);

  // 3. Remove archived leaves from Chrome
  const sorted = [...toAction].sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
  for (const node of sorted) {
    await chrome.bookmarks.remove(node.id).catch(() => {});
  }

  // 4. Remove now-empty (or emptied) folders (explicitly selected by user)
  for (const folder of foldersToRemove) {
    await chrome.bookmarks.remove(folder.id).catch(() => {});
  }

  // 5. Auto-prune ancestor folders that are now empty as a result of the archive.
  //    Covers the common case where the user selects all leaves inside a folder
  //    individually (without clicking the folder row itself), leaving an orphaned
  //    empty folder behind.  Also handles nested folders: if removing a subfolder
  //    empties its parent, the parent is pruned too, and so on up the tree.
  //
  //    Seed set: parent IDs of archived leaves + parent IDs of explicitly-removed
  //    folders (so the grandparent is checked when an entire subtree was wiped).
  const seedParentIds = new Set<string>([
    ...toAction.map((n) => n.parentId).filter((id): id is string => !!id),
    ...foldersToRemove.map((n) => n.parentId).filter((id): id is string => !!id),
  ]);
  for (const parentId of Array.from(seedParentIds)) {
    await pruneEmptyAncestors(parentId);
  }

  return updatedArchive;
}

/**
 * Merges bookmark nodes into an archive object.
 *
 * Pure function — no file I/O. The caller (useArchive.handleAppend) owns
 * the FileSystemFileHandle write after this returns.
 *
 * Deduplication: keyed by URL; incoming entry (newer archivedAt) wins.
 *
 * @param {object[]} nodes          - leaf nodes to archive
 * @param {object|null} existingArchive - current parsed archive or null
 * @returns {object}                  the new archive object
 */
export function mergeIntoArchive(
  nodes: BookmarkNode[],
  existingArchive: BookmarkArchive | null = null,
): BookmarkArchive {
  const incoming = nodes.map((n) => {
    // Derive the parent folder path by stripping exactly the bookmark's title
    // from the end of n.path. We MUST do this as a string suffix match rather
    // than split(' / ').slice(0,-1) because titles can contain the ' / '
    // separator (e.g. Chrome stores Twitter as "X. It's what's happening / X").
    const suffix = ` / ${n.title}`;
    const folderPath = (n.path ?? '').endsWith(suffix)
      ? n.path.slice(0, -suffix.length)
      : (n.path ?? '').split(' / ').slice(0, -1).join(' / ');

    return {
      id: n.id,
      parentId: n.parentId,
      index: n.index,
      title: n.title,
      url: n.url as string,
      dateAdded: n.dateAdded,
      dateLastUsed: n.dateLastUsed,
      path: n.path,
      folderPath, // stored separately so restore never needs to re-derive it
      archivedAt: new Date().toISOString(),
    };
  });

  let merged;
  if (existingArchive?.bookmarks?.length) {
    const byUrl = new Map(existingArchive.bookmarks.map((b) => [b.url, b]));
    incoming.forEach((b) => byUrl.set(b.url, b));
    merged = Array.from(byUrl.values()).sort((a, b) => (a.path ?? '').localeCompare(b.path ?? ''));
  } else {
    merged = incoming;
  }

  return {
    version: 1,
    filename: existingArchive?.filename ?? 'chrome-tab-archive.json',
    lastModified: new Date().toISOString(),
    bookmarks: merged,
  };
}

/**
 * @deprecated Use mergeIntoArchive instead.
 * Kept temporarily so any lingering callers don't crash before cleanup.
 */
export function appendToArchive(
  nodes: BookmarkNode[],
  existingArchive: BookmarkArchive | null = null,
) {
  return mergeIntoArchive(nodes, existingArchive);
}

/**
 * Restores bookmarks from a cold storage archive into Chrome.
 * Rebuilds folder paths as needed using ensureFolderPath().
 * Orphaned/deselected bookmarks are not restored (caller controls selection).
 *
 * @param {object[]} archivedNodes - all bookmarks in the archive
 * @param {Set<string>|null} selectedUrls - which URLs to restore; null = all
 */
export async function restoreFromArchive(
  archivedNodes: ArchivedBookmark[],
  selectedUrls: Set<string> | null = null,
) {
  const toRestore = selectedUrls
    ? archivedNodes.filter((n) => selectedUrls.has(n.url))
    : archivedNodes;

  // Restore in original index order so relative bookmark ordering is preserved.
  const sorted = [...toRestore].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const restoredNodes: chrome.bookmarks.BookmarkTreeNode[] = [];

  for (const node of sorted) {
    // folderPath is stored on archives created after the fix.
    // For legacy archives that only have path+title, derive it the same way
    // mergeIntoArchive now does — suffix-strip so slashes in titles don't split.
    let folderPath = node.folderPath;
    if (!folderPath) {
      const suffix = ` / ${node.title}`;
      folderPath = (node.path ?? '').endsWith(suffix)
        ? node.path.slice(0, -suffix.length)
        : (node.path ?? '').split(' / ').slice(0, -1).join(' / ');
    }

    const parentId = await ensureFolderPath(folderPath);

    // Clamp the index to the folder's current child count.
    // The stored index reflects the original bar state; if the folder is
    // partially filled (e.g. mid-restore or a fresh bar), passing an
    // out-of-range index causes chrome.bookmarks.create() to silently fail.
    let safeIndex;
    if (node.index != null) {
      const currentChildren = await chrome.bookmarks.getChildren(parentId).catch(() => []);
      safeIndex = Math.min(node.index, currentChildren.length);
    }

    const created = await chrome.bookmarks
      .create({
        parentId,
        index: safeIndex,
        title: node.title,
        url: node.url,
      })
      .catch(console.warn);

    if (created) restoredNodes.push(created);
  }

  return restoredNodes;
}

/**
 * Removes entries from the archive without touching Chrome.
 * Returns the updated archive object.
 *
 * @param {object} archive - current archive
 * @param {Set<string>} urlsToRemove - URLs to purge
 * @returns {object} updated archive
 */
export function removeFromArchive(
  archive: BookmarkArchive,
  urlsToRemove: Set<string>,
): BookmarkArchive {
  return {
    ...archive,
    lastModified: new Date().toISOString(),
    bookmarks: archive.bookmarks.filter((b) => !urlsToRemove.has(b.url)),
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Walks up the folder ancestor chain starting from folderId.
 * If the folder is now empty (and is not a Chrome root container), removes it
 * and recurses to its parent.  Stops at Chrome's fixed root IDs so we never
 * accidentally delete the Bookmarks Bar, Other Bookmarks, or Mobile Bookmarks.
 *
 * Called by executeArchive after leaves (and any explicit folders) are removed,
 * to clean up orphaned empty parent folders without requiring the user to have
 * explicitly selected the folder row.
 *
 * @param {string}      folderId
 * @param {Set<string>} [visited] - cycle guard (internal)
 */
async function pruneEmptyAncestors(folderId: string, visited: Set<string> = new Set()) {
  // Chrome's fixed root container IDs — never touch these.
  const ROOT_IDS = new Set(['0', '1', '2', '3']);
  if (!folderId || ROOT_IDS.has(folderId) || visited.has(folderId)) return;
  visited.add(folderId);

  // Check whether the folder still exists and is truly empty.
  const children = await chrome.bookmarks.getChildren(folderId).catch(() => null);
  if (!children || children.length > 0) return; // folder gone or still has content

  // Fetch the node to learn its parentId before deleting it.
  const [node] = await chrome.bookmarks.get(folderId).catch(() => [null]);
  if (!node) return;

  await chrome.bookmarks.remove(folderId).catch(console.warn);

  // Recurse: the parent might now be empty too (handles deeply nested folder trees).
  if (node.parentId) {
    await pruneEmptyAncestors(node.parentId, visited);
  }
}

/**
 * Chrome's top-level bookmark container IDs are fixed across all profiles.
 * We use a name→ID map so we never rely on getChildren('0') which is locale-
 * sensitive and returns containers we can't reliably match by title.
 *
 * Fetched once at first call and cached for the session.
 */
let _rootMap: Map<string, string> | null = null; // Map<normalised-title, chromeId>

async function getRootMap() {
  if (_rootMap) return _rootMap;
  _rootMap = new Map();
  try {
    const tree = await chrome.bookmarks.getTree();
    const roots = tree[0]?.children ?? []; // direct children of id '0'
    for (const r of roots) {
      _rootMap.set(r.title.toLowerCase(), r.id);
    }
  } catch {
    /* ignore */
  }
  return _rootMap;
}

/**
 * Walks a path string (e.g. "Bookmarks bar / Dev / Tools / My Link"),
 * creating any missing intermediate folders, and returns the Chrome ID
 * of the deepest folder (the direct parent of the bookmark).
 *
 * The bookmark title is the last segment — it is stripped before walking.
 *
 * Path anatomy produced by buildFullTree:
 *   "Bookmarks bar"                    — the bar root itself (a folder, not a leaf)
 *   "Bookmarks bar / My Link"          — leaf directly in bar
 *   "Bookmarks bar / Dev / My Link"    — leaf inside subfolder "Dev"
 *
 * After stripping the last segment the folder chain is:
 *   []                  → return '1' (Bookmarks bar fallback — shouldn't happen for real leaves)
 *   ["Bookmarks bar"]   → resolve first segment via getRootMap → return that id
 *   ["Bookmarks bar", "Dev"] → resolve first segment → walk remainder
 *
 * @param {string} fullPath
 * @param {string} bookmarkTitle - used only for logging; stripping is done by index
 * @returns {Promise<string>} Chrome folder ID
 */
/**
 * Walks a folder path string (e.g. "Bookmarks bar / Dev / Tools"),
 * creating any missing intermediate folders, and returns the Chrome ID
 * of the deepest folder.
 *
 * This function receives a PRE-STRIPPED folder path — the bookmark's own
 * title has already been removed by the caller (restoreFromArchive).
 * This is critical because titles can contain ' / ' (e.g. Twitter's tab
 * title is "X. It's what's happening / X").
 *
 * @param {string} folderPath - parent folder chain, no leaf title
 * @returns {Promise<string>} Chrome folder ID
 */
async function ensureFolderPath(folderPath: string): Promise<string> {
  const segments = (folderPath ?? '')
    .split(' / ')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return '1'; // fallback: Bookmarks bar root
  }

  // ── First segment: resolve against Chrome root containers ────────────────
  const rootMap = await getRootMap();
  const firstKey = segments[0].toLowerCase();
  const rootId = rootMap.get(firstKey);

  if (segments.length === 1) {
    // Folder IS a top-level container — return it directly; never create it.
    return rootId ?? '1';
  }

  // ── Remaining segments: walk/create subfolder chain ──────────────────────
  let currentId = rootId ?? '1';
  for (const segment of segments.slice(1)) {
    const children = await chrome.bookmarks.getChildren(currentId).catch(() => []);
    const existing = children.find((c) => !c.url && c.title === segment);
    if (existing) {
      currentId = existing.id;
    } else {
      const newFolder = await chrome.bookmarks
        .create({
          parentId: currentId,
          title: segment,
        })
        .catch(() => null);
      if (!newFolder) return '1';
      currentId = newFolder.id;
    }
  }
  return currentId;
}
