import { extractBaseDomain } from '../utils/domainUtils';

/**
 * pickerHistoryService.js
 *
 * PURPOSE
 * -------
 * Pure localStorage persistence for the PickerPanel's "Recently Used" and
 * "Recommended" sections. This module has no React dependencies — it is
 * a plain JS service that can be imported anywhere.
 *
 * All read functions are synchronous. The single write entry point is
 * recordUsage(), which should be called exactly once per confirmed
 * picker selection (inside PickerPanel.confirm()).
 *
 * For a complete architecture overview see: readmes/PICKER_HISTORY.md
 *
 * STORAGE KEYS (per picker type — 'bookmark' or 'group')
 * -------------------------------------------------------
 *   t0:picker:recent:{type}    — Array of recently chosen items, newest-first
 *   t0:picker:domainMap:{type} — Record<baseDomain, DomainEntry[]>
 *
 * Both stores are independent per type so bookmark usage doesn't bleed into
 * tab group recommendations and vice versa.
 */

const RECENT_KEY_PREFIX = 't0:picker:recent';
const DOMAIN_KEY_PREFIX = 't0:picker:domainMap';

/** Max entries in the "Recently Used" section. */
const MAX_RECENT = 5;

/**
 * Max folder/group IDs remembered per domain.
 * Determines how many items can appear in the "Recommended" section for a
 * given URL — one slot per domain entry.
 */
const MAX_DOMAIN_ENTRIES = 3;

// ─── Internal helpers ──────────────────────────────────────────────────────────

function storageKey(prefix, type) {
    return `${prefix}:${type}`;
}

/** Safe JSON read from localStorage — returns `fallback` on any error. */
function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

/** Safe JSON write to localStorage — fails silently (storage full, private mode, etc.). */
function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Intentionally silent — the picker still works, history just won't persist.
    }
}

// ─── Recent list ──────────────────────────────────────────────────────────────

/**
 * Returns up to MAX_RECENT recently used items for the given picker type.
 *
 * Each entry shape:
 *   { id: string, title: string, path?: string, color?: string, usedAt: number }
 *
 * `path` is the bookmark folder breadcrumb (bookmarks only).
 * `color` is the Chrome tab group color string (groups only).
 * `usedAt` is a Unix ms timestamp — not currently displayed, but useful for
 *  future "used X minutes ago" labels or TTL-based expiry.
 *
 * Note: entries are snapshots of item metadata at time of use. If the folder
 * is later renamed or deleted in Chrome, the entry still exists in storage but
 * will be silently dropped at derivation time (it won't match any `rawItems` id).
 */
export function getRecent(type) {
    return readJSON(storageKey(RECENT_KEY_PREFIX, type), []);
}

/**
 * Prepends `item` to the recent list for `type`.
 *
 * Deduplication: if the same id already exists it's removed first, so the
 * chosen item always moves to position 0 rather than appearing twice.
 * Capped at MAX_RECENT entries.
 */
function pushRecent(type, item) {
    const list = getRecent(type);
    // Remove existing entry for this id (dedup before prepend).
    const deduped = list.filter(r => r.id !== item.id);
    const entry = {
        id: item.id,
        title: item.title,
        // Conditionally include type-specific fields so the stored shape is clean.
        ...(item.path != null && { path: item.path }),   // bookmark folders
        ...(item.color != null && { color: item.color }), // tab groups
        usedAt: Date.now(),
    };
    deduped.unshift(entry);
    writeJSON(storageKey(RECENT_KEY_PREFIX, type), deduped.slice(0, MAX_RECENT));
}

// ─── Domain map ───────────────────────────────────────────────────────────────

/**
 * Returns the full domain map for the given type.
 *
 * Shape: Record<baseDomain, Array<{ id: string, usedAt: number }>>
 *
 * Each domain maps to an ordered array of item IDs (most-recently-used first).
 * The IDs here are intentionally thin — just strings — because the full item
 * metadata (title, path, color) is looked up at derivation time from `rawItems`.
 * This keeps the domain map small and avoids stale metadata.
 */
function getDomainMap(type) {
    return readJSON(storageKey(DOMAIN_KEY_PREFIX, type), {});
}

/**
 * Records that `itemId` was used for `domain` under `type`.
 *
 * If the same itemId already exists for that domain, it's moved to the front
 * (refreshed) rather than duplicated. Capped at MAX_DOMAIN_ENTRIES per domain.
 *
 * This means: if a user files YouTube links into "Videos" 20 times and "Watch
 * Later" 3 times, both IDs appear in youtube.com's array (Videos first), giving
 * the user up to 3 contextual recommendations.
 */
function upsertDomainMapping(type, domain, itemId) {
    if (!domain) return;
    const map = getDomainMap(type);
    const existing = map[domain] || [];
    const deduped = existing.filter(e => e.id !== itemId);
    deduped.unshift({ id: itemId, usedAt: Date.now() });
    map[domain] = deduped.slice(0, MAX_DOMAIN_ENTRIES);
    writeJSON(storageKey(DOMAIN_KEY_PREFIX, type), map);
}

/**
 * Given a tab URL, returns up to MAX_DOMAIN_ENTRIES item IDs that have been
 * used for that base domain, most-recently-used first.
 *
 * Returns raw IDs only — the caller (usePickerSuggestions) hydrates them
 * to full items via the rawItems list from Chrome. If an ID no longer exists
 * in rawItems (folder deleted, group closed), it is filtered out at that point.
 */
export function getRecommendedIds(type, url) {
    const domain = extractBaseDomain(url);
    if (!domain) return [];
    const map = getDomainMap(type);
    const entries = map[domain] || [];
    return entries.map(e => e.id);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * THE ONLY WRITE ENTRY POINT.
 *
 * Call this once per confirmed picker selection — PickerPanel.confirm() does
 * this automatically. Do not call it from anywhere else.
 *
 * Updates both stores in one call:
 *   1. Pushes `item` to the front of the recent list (deduped, capped at 5).
 *   2. Upserts `item.id` into the domain map for `tabUrl`'s base domain.
 *
 * @param {'bookmark'|'group'} type  — which picker made the selection
 * @param {Object} item              — the chosen folder/group (needs .id, .title)
 * @param {string} tabUrl            — full URL of the tab being triaged
 */
export function recordUsage(type, item, tabUrl) {
    pushRecent(type, item);
    const domain = extractBaseDomain(tabUrl);
    if (domain) {
        upsertDomainMapping(type, domain, item.id);
    }
}
