/**
 * bookmarkUtils.js
 *
 * Shared bookmark tree utilities used by both triageLoader.js and bookmarkService.js.
 * Extracted so both consumers share the same logic without duplication.
 */

import { BookmarkFolder, BookmarkNode, ArchivedBookmark } from '../types';

// ─── Tree builders ────────────────────────────────────────────────────────────

/**
 * Builds a folders-only tree for the bookmark picker panel.
 * Used by triageLoader. Exactly matches the existing inline buildTree behavior.
 *
 * @param {chrome.bookmarks.BookmarkTreeNode[]} nodes
 * @param {string} path - accumulated folder path string
 * @returns {object[]}
 */
export function buildFolderTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  path = '',
): BookmarkFolder[] {
  return nodes
    .filter((n) => !n.url && n.id !== '0')
    .map((n) => {
      const newPath = path ? `${path} / ${n.title}` : n.title;
      return {
        id: n.id,
        title: n.title,
        path: newPath,
        children: n.children ? buildFolderTree(n.children, newPath) : [],
      };
    });
}

/**
 * Flattens a computed tree (from buildFolderTree or buildFullTree) into a
 * flat array for keyboard navigation and fuzzy search.
 * Used by both triageLoader (for bookmarkFolders) and bookmarkService.
 *
 * @param {object[]} nodes
 * @returns {object[]}
 */
export function flattenTree<T extends { children?: T[] }>(nodes: T[]): T[] {
  let result: T[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length && node.children.length > 0) {
      result = result.concat(flattenTree(node.children));
    }
  }
  return result;
}

/**
 * Builds a FULL tree including bookmark leaves (nodes with a url).
 * Preserves all metadata: dateAdded, dateLastUsed, index, parentId.
 * Used by bookmarkService only — NOT by triageLoader.
 *
 * @param {chrome.bookmarks.BookmarkTreeNode[]} nodes
 * @param {string} path - accumulated path string
 * @returns {object[]}
 */
export function buildFullTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  path = '',
): BookmarkNode[] {
  return nodes
    .filter((n) => n.id !== '0')
    .map((n) => {
      const isFolder = !n.url;
      const newPath = path ? `${path} / ${n.title}` : n.title;
      return {
        id: n.id,
        parentId: n.parentId ?? null,
        index: n.index ?? null,
        title: n.title,
        url: n.url ?? null, // null for folders
        isFolder,
        dateAdded: n.dateAdded ?? null,
        dateLastUsed: n.dateLastUsed ?? null, // Chrome 114+; null for folders
        folderType: n.folderType ?? null, // "bookmarks-bar" | "other" | "mobile"
        path: newPath,
        children: n.children ? buildFullTree(n.children, newPath) : [],
      };
    });
}

// ─── Tree traversal helpers ───────────────────────────────────────────────────

/**
 * Finds a single node anywhere in the tree by its id.
 * Returns null if not found.
 *
 * @param {object[]} nodes
 * @param {string}   id
 * @returns {object|null}
 */
export function findNodeById<T extends { id: string; children?: T[] }>(
  nodes: T[],
  id: string,
): T | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Returns all leaf nodes (bookmarks with a url) under a given node,
 * recursively. Folders are excluded from the result.
 *
 * @param {object} node - a node from buildFullTree
 * @returns {object[]}
 */
export function getAllLeaves(node: BookmarkNode): BookmarkNode[] {
  const leaves: BookmarkNode[] = [];
  function walk(n: BookmarkNode) {
    if (!n.isFolder && n.url) {
      leaves.push(n);
    }
    if (n.children?.length) {
      n.children.forEach(walk);
    }
  }
  walk(node);
  return leaves;
}

// ─── Activity coloring ────────────────────────────────────────────────────────

/**
 * Returns a CSS variable color string for a raw timestamp (ms since epoch).
 * The same heat scale is used for both "last used" and "date added" badges.
 *
 * Green  < 30 days  — recent
 * Yellow < 90 days
 * Orange < 180 days
 * Red    >= 180 days — cold / old
 *
 * @param {number} ms - timestamp in milliseconds
 * @returns {string} CSS color value
 */
export function getAgeColor(ms: number | null | undefined): string {
  const ageDays = (Date.now() - (ms ?? 0)) / (1000 * 60 * 60 * 24);
  if (ageDays < 30) return 'var(--accent-green,  #30d158)';
  if (ageDays < 90) return 'var(--accent-yellow, #ffd60a)';
  if (ageDays < 180) return 'var(--accent-orange, #ff9f0a)';
  return 'var(--accent-red,    #ff3b30)';
}

/**
 * Returns a CSS variable string for the activity heat color of a bookmark node.
 * Based on how long ago it was last used (dateLastUsed ?? dateAdded).
 *
 * @param {object} node - a node from buildFullTree
 * @returns {string} CSS color value
 */
export function getActivityColor(node: BookmarkNode): string {
  return getAgeColor(node.dateLastUsed ?? node.dateAdded ?? 0);
}

/**
 * Returns the activity color for a folder, derived from its coldest leaf child.
 * If the folder has no leaves, returns null.
 *
 * @param {object} folderNode - a folder node from buildFullTree
 * @returns {string|null}
 */
export function getFolderActivityColor(folderNode: BookmarkNode): string | null {
  const leaves = getAllLeaves(folderNode);
  if (!leaves.length) return null;
  // Sort ascending by lastActivity — pick the stalest (first = smallest timestamp)
  const stalest = leaves.reduce((worst, leaf) => {
    const t = leaf.dateLastUsed ?? leaf.dateAdded ?? 0;
    const w = worst.dateLastUsed ?? worst.dateAdded ?? 0;
    return t < w ? leaf : worst;
  });
  return getActivityColor(stalest);
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

/**
 * Sorts an array of nodes (mixed folders + leaves) by the given sort mode.
 * Does NOT recurse into children — use sortTree() for recursive tree sorting.
 *
 * @param {object[]} nodes
 * @param {'lastActivity'|'dateAdded'|'title'|'manual'} sortBy
 * @param {boolean} [asc=true] - true = ascending, false = descending
 * @returns {object[]}
 */
export function sortBookmarks(
  nodes: BookmarkNode[],
  sortBy: 'lastActivity' | 'dateAdded' | 'title' | 'manual',
  asc = true,
): BookmarkNode[] {
  let sorted;
  if (sortBy === 'lastActivity') {
    sorted = [...nodes].sort((a, b) => {
      const aTime = a.dateLastUsed ?? a.dateAdded ?? 0;
      const bTime = b.dateLastUsed ?? b.dateAdded ?? 0;
      return aTime - bTime;
    });
  } else if (sortBy === 'dateAdded') {
    sorted = [...nodes].sort((a, b) => (a.dateAdded ?? 0) - (b.dateAdded ?? 0));
  } else if (sortBy === 'title') {
    sorted = [...nodes].sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // 'manual' — preserve Chrome's native index order
    return nodes;
  }
  return asc ? sorted : sorted.reverse();
}

/**
 * Recursively sorts the full tree in-place by the given sort mode.
 * Folder children at every level are sorted, maintaining the tree structure.
 *
 * @param {object[]} nodes
 * @param {'lastActivity'|'dateAdded'|'title'|'manual'} sortBy
 * @param {boolean} [asc=true] - true = ascending, false = descending
 * @returns {object[]}
 */
export function sortTree(
  nodes: BookmarkNode[],
  sortBy: 'lastActivity' | 'dateAdded' | 'title' | 'manual',
  asc = true,
): BookmarkNode[] {
  const sorted = sortBookmarks(nodes, sortBy, asc);
  return sorted.map((n) => ({
    ...n,
    children: n.children?.length ? sortTree(n.children, sortBy, asc) : [],
  }));
}

// ─── Activity filtering ───────────────────────────────────────────────────────

const AGE_THRESHOLDS_DAYS: Record<string, number> = {
  '1w': 7,
  '1m': 30,
  '6m': 180,
  '1y': 365,
  '2y': 730,
  '3y': 1095,
  '5y': 1825,
};

/**
 * Returns true if a leaf matches the **Date Used** filter.
 * Operates on `dateLastUsed` only.
 *
 * | filter        | matches when                                        |
 * |---------------|-----------------------------------------------------|
 * | 'all'         | always                                              |
 * | 'never-used'  | dateLastUsed is null                                |
 * | 'recent'      | dateLastUsed within the last 7 days                 |
 * | 'recent-1m'   | dateLastUsed within the last 30 days                |
 * | 'stale-6m'    | dateLastUsed is null OR older than 180 days         |
 * | 'stale-1y'    | dateLastUsed is null OR older than 365 days         |
 *
 * @param {object} leaf   - bookmark leaf from buildFullTree
 * @param {string} filter - 'all' | 'never-used' | 'recent' | 'recent-1m' | 'stale-6m' | 'stale-1y'
 * @returns {boolean}
 */
export function matchesAccessFilter(leaf: BookmarkNode, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  if (filter === 'never-used') return leaf.dateLastUsed == null;
  const now = Date.now();
  if (filter === 'recent') {
    return leaf.dateLastUsed != null && now - leaf.dateLastUsed < 7 * 24 * 60 * 60 * 1000;
  }
  if (filter === 'recent-1m') {
    return leaf.dateLastUsed != null && now - leaf.dateLastUsed < 30 * 24 * 60 * 60 * 1000;
  }
  if (filter === 'stale-6m') {
    return leaf.dateLastUsed == null || now - leaf.dateLastUsed > 180 * 24 * 60 * 60 * 1000;
  }
  if (filter === 'stale-1y') {
    return leaf.dateLastUsed == null || now - leaf.dateLastUsed > 365 * 24 * 60 * 60 * 1000;
  }
  return true;
}

/**
 * Returns true if a leaf matches the **Date Added** filter.
 * Operates on `dateAdded`.
 *
 * | filter      | matches when                              |
 * |-------------|-------------------------------------------|
 * | 'all'       | always                                    |
 * | 'added-1w'  | dateAdded within the last 7 days          |
 * | 'added-1m'  | dateAdded within the last 30 days         |
 * | '1w'        | dateAdded more than 7 days ago            |
 * | '1m'        | dateAdded more than 30 days ago           |
 * | …           | …                                         |
 * | '5y'        | dateAdded more than 1825 days ago         |
 *
 * @param {object} leaf   - bookmark leaf from buildFullTree
 * @param {string} filter - 'all' | 'added-1w' | 'added-1m' | '1w' | '1m' | '6m' | '1y' | '2y' | '3y' | '5y'
 * @returns {boolean}
 */
export function matchesAgeFilter(leaf: BookmarkNode, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  const now = Date.now();
  const added = leaf.dateAdded ?? 0;
  if (filter === 'added-1w') return now - added < 7 * 24 * 60 * 60 * 1000;
  if (filter === 'added-1m') return now - added < 30 * 24 * 60 * 60 * 1000;
  const days = AGE_THRESHOLDS_DAYS[filter];
  if (days == null) return true;
  return now - added > days * 24 * 60 * 60 * 1000;
}

/**
 * Returns true if a leaf matches the **Content** filter.
 *
 * | filter         | matches when                                          |
 * |----------------|-------------------------------------------------------|
 * | 'all'          | always                                                |
 * | 'no-title'     | title is empty or identical to the URL                |
 * | 'deep-nested'  | leaf is buried ≥ 3 folder levels deep (path has ≥ 4  |
 * |                | segments, e.g. "Bar / A / B / Leaf")                  |
 * | 'empty-folder' | always false for leaves — BrowsePanel handles the     |
 * |                | tree-side logic to surface empty folder nodes          |
 * | 'duplicates'   | URL exists more than once in the bookmark tree        |
 *
 * @param {object} leaf   - bookmark leaf from buildFullTree
 * @param {string} filter - 'all' | 'no-title' | 'deep-nested' | 'empty-folder' | 'duplicates'
 * @param {Set<string>} [duplicateUrls] - Set of URLs that have duplicates
 * @returns {boolean}
 */
export function matchesContentFilter(
  leaf: BookmarkNode,
  filter: string,
  duplicateUrls: Set<string> | null = null,
): boolean {
  if (!filter || filter === 'all') return true;
  if (filter === 'no-title') {
    const t = leaf.title?.trim() ?? '';
    return t === '' || t === (leaf.url ?? '');
  }
  if (filter === 'deep-nested') {
    // path is "Root / Folder / Subfolder / Title" — split on ' / ' to count segments.
    // Depth ≥ 3 folder levels means ≥ 4 total segments (root + 2 folders + leaf).
    const segments = (leaf.path ?? '').split(' / ').length;
    return segments >= 4;
  }
  if (filter === 'empty-folder') {
    // Empty folders contain no leaves — this filter is handled in BrowsePanel's
    // tree pass (keepEmptyFolders). For the flat leaf pass, exclude everything.
    return false;
  }
  if (filter === 'duplicates') {
    return duplicateUrls && leaf.url != null ? duplicateUrls.has(leaf.url) : false;
  }
  return true;
}

// ─── Archive grouping ─────────────────────────────────────────────────────────

/**
 * Groups a flat archive bookmarks array into synthetic folder-node objects.
 *
 * Each returned node is shaped to be compatible with:
 *   - useBookmarkSelection  (id, isFolder, children carrying .id / .url)
 *   - BookmarkFolderRow     (id, title, children.length)
 *   - getAllLeaves           (children with .url and no .isFolder → treated as leaves)
 *   - getFolderActivityColor (children carry dateLastUsed / dateAdded)
 *
 * Groups are sorted by folderPath alphabetically (matches archive storage order).
 * Items with no folderPath are placed in a synthetic "Uncategorized" group.
 *
 * @param {object[]} bookmarks - flat archive bookmarks array (from archive.bookmarks)
 * @returns {object[]}         - array of synthetic group nodes, ordered by folderPath
 */
export interface SyntheticArchiveGroup {
  id: string;
  title: string;
  isFolder: boolean;
  parentId: string | null;
  index: number | null;
  url: string | null;
  dateAdded: number | null;
  dateLastUsed: number | null;
  folderType: string | null;
  path: string;
  depth: number;
  folderPath: string;
  children: ArchivedBookmark[];
}

export function groupArchiveByFolder(bookmarks: ArchivedBookmark[]): SyntheticArchiveGroup[] {
  const groupMap = new Map<string, SyntheticArchiveGroup>(); // folderPath → { id, title, depth, children }

  for (const item of bookmarks) {
    const folderPath = item.folderPath?.trim() || 'Uncategorized';
    if (!groupMap.has(folderPath)) {
      const segments = folderPath
        .split(' / ')
        .map((s) => s.trim())
        .filter(Boolean);
      groupMap.set(folderPath, {
        id: `group:${folderPath}`,
        title: segments[segments.length - 1] ?? 'Uncategorized',
        isFolder: true,
        parentId: null,
        index: null,
        url: null,
        dateAdded: null,
        dateLastUsed: null,
        folderType: null,
        path: folderPath,
        depth: segments.length,
        folderPath,
        children: [],
        // No dateAdded/dateLastUsed on the group node itself —
        // getFolderActivityColor derives its value from the children.
      });
    }
    groupMap.get(folderPath)!.children.push(item);
  }

  // Sort groups alphabetically by folderPath; put Uncategorized last.
  return Array.from(groupMap.values()).sort((a, b) => {
    if (a.folderPath === 'Uncategorized') return 1;
    if (b.folderPath === 'Uncategorized') return -1;
    return a.folderPath.localeCompare(b.folderPath);
  });
}

// ─── Drag & Drop Utilities ────────────────────────────────────────────────────

/**
 * Returns an ordered array of all *visible* nodes (folders + leaves) as they
 * appear in the rendered tree.
 * Used to identify the hovered row's index during onDragOver so we can compute the drop position.
 *
 * @param {object[]} nodes
 * @param {Set<string>} expandedIds
 * @returns {object[]}
 */
export function flattenVisibleTree(
  nodes: BookmarkNode[],
  expandedIds: Set<string>,
): BookmarkNode[] {
  let result: BookmarkNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (
      node.isFolder &&
      expandedIds.has(node.id) &&
      node.children?.length &&
      node.children.length > 0
    ) {
      result = result.concat(flattenVisibleTree(node.children, expandedIds));
    }
  }
  return result;
}

/**
 * Returns true if potentialAncestorId is an ancestor of nodeId in the given tree.
 * Used to disallow dropping a folder into its own subtree.
 *
 * @param {string} potentialAncestorId
 * @param {string} nodeId
 * @param {object[]} nodes
 * @returns {boolean}
 */
export function isAncestorOf(
  potentialAncestorId: string,
  nodeId: string,
  nodes: BookmarkNode[],
): boolean {
  if (potentialAncestorId === nodeId) return true;

  function findNode(nList: BookmarkNode[], id: string): BookmarkNode | null {
    for (const n of nList) {
      if (n.id === id) return n;
      if (n.children?.length) {
        const found = findNode(n.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  const ancestor = findNode(nodes, potentialAncestorId);
  if (!ancestor) return false;

  return findNode(ancestor.children || [], nodeId) != null;
}

/**
 * Pure function. Returns a new tree with:
 * - dragId removed from its current parent
 * - dragId inserted into newParentId, before the sibling with beforeSiblingId (or appended if null)
 *
 * @param {object[]} tree
 * @param {string} dragId
 * @param {string} newParentId
 * @param {string|null} beforeSiblingId
 * @returns {object[]}
 */
export function moveNodeInDraftTree(
  tree: BookmarkNode[],
  dragId: string,
  newParentId: string,
  beforeSiblingId: string | null,
): BookmarkNode[] {
  let draggedNode: BookmarkNode | null = null;

  // 1. Find and remove the node
  function removeNode(nodes: BookmarkNode[]): BookmarkNode[] {
    const next: BookmarkNode[] = [];
    for (const n of nodes) {
      if (n.id === dragId) {
        draggedNode = n; // keep reference to insert later
        continue;
      }
      if (n.children) {
        next.push({ ...n, children: removeNode(n.children) });
      } else {
        next.push(n);
      }
    }
    return next;
  }

  const withoutNode = removeNode(tree);
  if (!draggedNode) return tree;

  // 2. Insert the node
  function insertNode(nodes: BookmarkNode[]): BookmarkNode[] {
    return nodes.map((n) => {
      if (n.id === newParentId) {
        const newChildren = [...(n.children || [])];
        if (beforeSiblingId) {
          const idx = newChildren.findIndex((c) => c.id === beforeSiblingId);
          if (idx !== -1) {
            newChildren.splice(idx, 0, draggedNode!);
          } else {
            newChildren.push(draggedNode!);
          }
        } else {
          newChildren.push(draggedNode!);
        }
        return { ...n, children: newChildren };
      }
      if (n.children) {
        return { ...n, children: insertNode(n.children) };
      }
      return n;
    });
  }

  return insertNode(withoutNode);
}

/**
 * Pure function. Returns a new tree with newNode inserted into parentId before beforeSiblingId.
 * Used for synthesizing draft folders.
 */
export function insertNodeInDraftTree(
  tree: BookmarkNode[],
  newNode: BookmarkNode,
  parentId: string | null,
  beforeSiblingId: string | null,
): BookmarkNode[] {
  function insertNode(nodes: BookmarkNode[]): BookmarkNode[] {
    if (!parentId) {
      // Root level insertion
      const next = [...nodes];
      if (beforeSiblingId) {
        const idx = next.findIndex((c) => c.id === beforeSiblingId);
        if (idx !== -1) {
          next.splice(idx, 0, newNode);
          return next;
        }
      }
      next.push(newNode);
      return next;
    }

    return nodes.map((n) => {
      if (n.id === parentId) {
        const newChildren = [...(n.children || [])];
        if (beforeSiblingId) {
          const idx = newChildren.findIndex((c) => c.id === beforeSiblingId);
          if (idx !== -1) {
            newChildren.splice(idx, 0, newNode);
          } else {
            newChildren.push(newNode);
          }
        } else {
          newChildren.push(newNode);
        }
        return { ...n, children: newChildren };
      }
      if (n.children) {
        return { ...n, children: insertNode(n.children) };
      }
      return n;
    });
  }
  return insertNode(tree);
}

/**
 * Pure function. Returns a new tree with the target node's title updated.
 */
export function renameNodeInDraftTree(
  tree: BookmarkNode[],
  nodeId: string,
  newTitle: string,
): BookmarkNode[] {
  return tree.map((n) => {
    if (n.id === nodeId) {
      return { ...n, title: newTitle };
    }
    if (n.children) {
      return { ...n, children: renameNodeInDraftTree(n.children, nodeId, newTitle) };
    }
    return n;
  });
}
