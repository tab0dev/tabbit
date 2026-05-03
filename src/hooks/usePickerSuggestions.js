import { useMemo, useState, useCallback } from 'react';
import { getRecent, getRecommendedIds } from '../services/pickerHistoryService';

/**
 * usePickerSuggestions
 *
 * PURPOSE
 * -------
 * The bridge between the persistent history (pickerHistoryService) and the
 * rendered picker list (PickerPanel). Given all available items from Chrome and
 * the current tab's URL, it produces a sectioned, deduplicated, fuzzy-filtered
 * list ready for the component to render.
 *
 * For full architecture context see: readmes/PICKER_HISTORY.md
 *
 * SECTION ORDER & DEDUPLICATION PRIORITY
 * ---------------------------------------
 * Sections are ordered: Recommended → Recently Used → All.
 *
 * Recommended is derived first and wins any overlap — if a folder appears in
 * both the domain map and the recent list, it goes into Recommended and is
 * excluded from Recently Used. This is intentional: a domain-level signal is
 * more contextually relevant than recency alone, so it earns the top slot.
 *
 * An item can never appear in more than one section.
 *
 * THE INVALIDATE PATTERN
 * ----------------------
 * localStorage writes don't trigger React re-renders. To force the hook to
 * re-read after recordUsage() is called, the hook maintains a `revision`
 * counter in state. PickerPanel calls invalidate() immediately after
 * recordUsage(), which increments `revision` and causes useMemo to re-run.
 *
 * Flow: confirm() → recordUsage() → invalidate() → revision++ → useMemo re-runs
 *
 * PARAMETERS
 * ----------
 * @param {'bookmark'|'group'} type
 *   Which picker type — determines which storage keys are read.
 *
 * @param {Array} rawItems
 *   The full list of available items from Chrome (bookmark folders or tab groups),
 *   sourced from state.bookmarkFolders / state.tabGroups in TriageProvider.
 *   This is the source of truth for what currently exists — history entries that
 *   don't match any rawItem id are silently dropped (handles deleted folders/groups).
 *
 * @param {string|undefined} currentTabUrl
 *   The URL of the tab currently being triaged (state.tabs[state.currentIndex]?.url).
 *   Used to look up domain-matched recommendations. If undefined (no current tab),
 *   Recommended section will always be empty.
 *
 * @param {string} query
 *   The current text in the picker's search input. Applied as a fuzzy filter to
 *   each section independently. Empty string means no filtering.
 *
 * @param {Function} matchFn
 *   Signature: (item, query) => boolean. Called to decide if an item passes the
 *   filter for the given query. Passed as a parameter rather than defined here so
 *   the component can control the matching logic (e.g. fuzzy vs. exact).
 *   IMPORTANT: this must be a stable reference (defined outside the component or
 *   wrapped in useMemo) — a new function reference on every render would cause
 *   this hook's useMemo to re-run on every render, even with no real changes.
 *
 * RETURN VALUE
 * ------------
 * {
 *   sections:  Array<{ key, label, items, showHeader }>
 *     Renderable section groups. Only non-empty sections after filtering are
 *     included. `showHeader` is false when only the "All" section is present,
 *     making the list look identical to the original flat list for new users.
 *
 *   flatItems: Array<item>
 *     All section items concatenated in display order. Used by PickerPanel for
 *     index-based keyboard navigation — selectedIndex maps into this array.
 *     Section headers are not in flatItems, so arrow keys skip them automatically.
 *
 *   invalidate: () => void
 *     Call after recordUsage() to force sections to re-derive from localStorage.
 * }
 */
export function usePickerSuggestions(type, rawItems, currentTabUrl, query, matchFn) {
    // revision is an opaque counter — its value doesn't matter, only that it changes.
    // Including it in useMemo's dependency array is what triggers the re-read.
    const [revision, setRevision] = useState(0);
    const invalidate = useCallback(() => setRevision(r => r + 1), []);

    const { sections, flatItems } = useMemo(() => {
        // Index rawItems by id for O(1) hydration of stored IDs → full item objects.
        // IDs are stringified defensively — Chrome APIs can return numeric IDs for
        // bookmarks but string IDs for tab groups; storing as strings unifies them.
        const itemById = new Map(rawItems.map(item => [String(item.id), item]));

        // ── Step 1: Recommended (built first — wins deduplication priority) ──────
        // getRecommendedIds returns up to MAX_DOMAIN_ENTRIES (3) item IDs that have
        // been used for the current tab's base domain, most-recently-used first.
        // Folders/groups that no longer exist in rawItems are dropped by .filter(Boolean).
        const recommendedIds = currentTabUrl ? getRecommendedIds(type, currentTabUrl) : [];
        const recommendedItems = recommendedIds
            .map(id => itemById.get(String(id)))
            .filter(Boolean);
        const recommendedIdSet = new Set(recommendedItems.map(i => String(i.id)));

        // ── Step 2: Recently Used (excludes anything already in Recommended) ─────
        // getRecent returns up to MAX_RECENT (5) entries from the recent list.
        // Entries not in rawItems are dropped. Entries that matched Recommended
        // are also excluded — Recommended wins the placement tie.
        const recentRaw = getRecent(type);
        const recentItems = recentRaw
            .map(r => itemById.get(String(r.id)))
            .filter(item => item && !recommendedIdSet.has(String(item.id)));

        // ── Step 3: All (the remainder after Recommended + Recently Used are shown) ─
        const shownIds = new Set([
            ...recommendedItems.map(i => String(i.id)),
            ...recentItems.map(i => String(i.id)),
        ]);
        const allItems = rawItems.filter(item => !shownIds.has(String(item.id)));

        // ── Step 4: Apply fuzzy filter to each section independently ─────────────
        // Empty sections after filtering are removed in the next step.
        // This means searching while Recommended is visible will keep the Recommended
        // header visible as long as at least one recommended item matches the query.
        const filterSection = (items) =>
            query ? matchFn(items, query) : items;

        const sectionDefs = [
            { key: 'recommended', label: 'Recommended', items: filterSection(recommendedItems) },
            { key: 'recent', label: 'Recently Used', items: filterSection(recentItems) },
            { key: 'all', label: 'All', items: filterSection(allItems) },
        ];

        // ── Step 5: Drop empty sections, decide whether to show headers ───────────
        const activeSections = sectionDefs.filter(s => s.items.length > 0);

        // Hide all headers if the only active section is "All" — this keeps the
        // picker looking like a plain flat list for users with no history yet,
        // avoiding the visual noise of a single "All" header.
        const shouldShowHeaders = activeSections.length > 1 ||
            (activeSections.length === 1 && activeSections[0].key !== 'all');

        const sections = activeSections.map(s => ({ ...s, showHeader: shouldShowHeaders }));

        // flatItems is the single source of truth for keyboard navigation indices.
        // PickerPanel uses a running counter during render to map each rendered item
        // back to its position in flatItems, so selectedIndex stays consistent with
        // what the user sees on screen.
        const flatItems = activeSections.flatMap(s => s.items);

        return { sections, flatItems };

        // `revision` is intentionally in this dep array even though it's just a number.
        // It's the mechanism by which PickerPanel triggers a re-read after a write.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, rawItems, currentTabUrl, query, matchFn, revision]);

    return { sections, flatItems, invalidate };
}
