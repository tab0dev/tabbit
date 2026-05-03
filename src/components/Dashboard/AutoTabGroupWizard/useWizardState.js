import { useState, useCallback, useMemo } from 'react';
import { useTriage } from '../../../store/TriageProvider';
import { buildDomainGroups, buildDistinctGroupName } from '../../../services/autoTabGroupService';
import { loadDomainPreferences, saveDomainPreference, isDomainSplit } from '../../../utils/domainPreferences';

// converts autoTabGroupService clusters into the local group shape
// used throughout the wizard
function seedGroups(clusters) {
    return clusters.map(c => ({
        id: c.domain,
        name: c.displayName,
        tabIds: c.tabs.map(t => t.id),
        favicon: c.favicon,
        isCustom: false,
        enabled: true,
        rootDomain: c.rootDomain,
        canSplit: c.canSplit,
        subdomainCount: c.subdomains?.size ?? 0,
        subdomainNames: c.subdomainNames ?? [],
    }));
}

// manages all wizard group state, tab exclusions, domain split prefs,
// dnd operations, and the confirm flow.
export function useWizardState({ onClose }) {
    const { state, dispatch } = useTriage();

    // stable tab lookup — only built once from the initial tab list
    const tabById = useMemo(() => {
        const map = new Map();
        state.tabs.forEach(t => map.set(t.id, t));
        return map;
    }, [state.tabs]);

    // domain preferences (split/merge decisions persisted to localStorage)
    const [domainPrefs, setDomainPrefs] = useState(() => loadDomainPreferences());
    const [hoveredRootDomain, setHoveredRootDomain] = useState(null);

    // filtered to only unprocessed, ungrouped, unpinned tabs — frozen at mount
    const activeTabs = useMemo(() => {
        return state.tabs.filter(t =>
            !t.processed &&
            !t.gone &&
            !t.pinned &&
            (t.groupId === -1 || t.groupId == null)
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const buildGroups = useCallback((prefs) => {
        return seedGroups(buildDomainGroups(activeTabs, prefs));
    }, [activeTabs]);

    // mutable local group state
    const [groups, setGroups] = useState(() => buildGroups(domainPrefs));
    const [activeGroupId, setActiveGroupId] = useState(() => groups[0]?.id ?? null);
    const [excludedTabIds, setExcludedTabIds] = useState(new Set());

    // dnd active drag item
    const [dragItem, setDragItem] = useState(null);
    const [overGroupId, setOverGroupId] = useState(null);
    const [working, setWorking] = useState(false);

    // derived values
    const activeGroup = groups.find(g => g.id === activeGroupId) ?? groups[0] ?? null;

    const tabCountForGroup = useCallback((group) => {
        if (!group.enabled) return 0;
        return group.tabIds.filter(id => !excludedTabIds.has(id)).length;
    }, [excludedTabIds]);

    const willCreateCount = useMemo(() =>
        groups.filter(g => g.enabled && tabCountForGroup(g) > 0).length,
        [groups, tabCountForGroup]
    );

    const totalSelectedTabs = useMemo(() =>
        groups.reduce((sum, g) => sum + tabCountForGroup(g), 0),
        [groups, tabCountForGroup]
    );

    // group operations
    const toggleGroup = useCallback((groupId) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, enabled: !g.enabled } : g));
    }, []);

    const renameGroup = useCallback((groupId, newName) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
    }, []);

    const addCustomGroup = useCallback(() => {
        const id = `custom-${Date.now()}`;
        const newGroup = { id, name: 'New Group', tabIds: [], favicon: null, isCustom: true, enabled: true, rootDomain: null, canSplit: false, subdomainCount: 0 };
        setGroups(prev => [...prev, newGroup]);
        setActiveGroupId(id);
    }, []);

    // split/merge a domain — re-derives only the affected groups
    const handleToggleSplit = useCallback((group) => {
        if (!group.rootDomain) return;
        const currentlySplit = isDomainSplit(group.rootDomain, domainPrefs);
        const newPrefs = saveDomainPreference(group.rootDomain, { split: !currentlySplit });
        setDomainPrefs(newPrefs);

        const freshClusters = buildDomainGroups(activeTabs, newPrefs);
        const freshSeeded = seedGroups(freshClusters);

        setGroups(prev => {
            const kept = prev.filter(g => g.isCustom || (g.rootDomain && g.rootDomain !== group.rootDomain));
            const newDomainGroups = freshSeeded.filter(g => g.rootDomain === group.rootDomain);

            // preserve tab assignments moved via drag-and-drop
            const movedTabIds = new Set();
            for (const k of kept) {
                for (const tid of k.tabIds) movedTabIds.add(tid);
            }
            for (const g of newDomainGroups) {
                g.tabIds = g.tabIds.filter(id => !movedTabIds.has(id));
            }

            // sort siblings together by rootDomain, then by size
            return [...kept, ...newDomainGroups].sort((a, b) => {
                if (a.rootDomain && b.rootDomain && a.rootDomain === b.rootDomain) {
                    return b.tabIds.length - a.tabIds.length;
                }
                if (a.rootDomain && b.rootDomain) {
                    return a.rootDomain.localeCompare(b.rootDomain);
                }
                return b.tabIds.length - a.tabIds.length;
            });
        });

        const firstNew = freshClusters.find(c => c.rootDomain === group.rootDomain);
        if (firstNew) setActiveGroupId(firstNew.domain);
    }, [domainPrefs, activeTabs]);

    // tab operations
    const toggleExclude = useCallback((tabId) => {
        setExcludedTabIds(prev => {
            const next = new Set(prev);
            if (next.has(tabId)) next.delete(tabId);
            else next.add(tabId);
            return next;
        });
    }, []);

    const toggleAllInActive = useCallback(() => {
        if (!activeGroup) return;
        const { tabIds } = activeGroup;
        const allIncluded = tabIds.every(id => !excludedTabIds.has(id));
        setExcludedTabIds(prev => {
            const next = new Set(prev);
            if (allIncluded) tabIds.forEach(id => next.add(id));
            else tabIds.forEach(id => next.delete(id));
            return next;
        });
    }, [activeGroup, excludedTabIds]);

    // dnd handlers
    const handleDragStart = useCallback((event) => {
        const { tabId, fromGroupId } = event.active.data.current;
        setDragItem({ tabId, fromGroupId });
    }, []);

    const handleDragOver = useCallback((event) => {
        setOverGroupId(event.over?.id ?? null);
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { over } = event;
        setDragItem(null);
        setOverGroupId(null);

        if (!over || !dragItem) return;
        const { tabId, fromGroupId } = dragItem;
        const targetGroupId = over.id;
        if (fromGroupId === targetGroupId) return;

        setGroups(prev => prev.map(g => {
            if (g.id === fromGroupId) return { ...g, tabIds: g.tabIds.filter(id => id !== tabId) };
            if (g.id === targetGroupId) return { ...g, tabIds: [...g.tabIds, tabId] };
            return g;
        }));

        setExcludedTabIds(prev => {
            const next = new Set(prev);
            next.delete(tabId);
            return next;
        });

        setActiveGroupId(targetGroupId);
    }, [dragItem]);

    const handleDragCancel = useCallback(() => {
        setDragItem(null);
        setOverGroupId(null);
    }, []);

    // confirm — creates chrome tab groups for all enabled wizard groups
    const handleConfirm = useCallback(async () => {
        if (working || willCreateCount === 0) return;
        setWorking(true);

        const existingTitles = (state.tabGroups ?? []).map(g => g.title || '');

        try {
            for (const group of groups) {
                if (!group.enabled) continue;

                const includedTabs = group.tabIds
                    .filter(id => !excludedTabIds.has(id))
                    .map(id => tabById.get(id))
                    .filter(Boolean);

                if (includedTabs.length === 0) continue;

                const groupName = buildDistinctGroupName(group.name, existingTitles);
                existingTitles.push(groupName);

                // chrome.tabs.group requires same-window tabIds
                const byWindow = new Map();
                for (const tab of includedTabs) {
                    if (!byWindow.has(tab.windowId)) byWindow.set(tab.windowId, []);
                    byWindow.get(tab.windowId).push(tab.id);
                }

                let firstGroupId = null;
                for (const [windowId, tabIds] of byWindow) {
                    const groupId = await chrome.tabs.group({ tabIds });
                    await chrome.tabGroups.update(groupId, { title: groupName });
                    if (firstGroupId === null) {
                        firstGroupId = groupId;
                        dispatch({
                            type: 'ADD_TAB_GROUP',
                            payload: { id: groupId, title: groupName, color: 'grey', windowId },
                        });
                    }
                }
            }
        } catch (err) {
            console.warn('[Tabbit] AutoTabGroupWizard confirm failed:', err);
        } finally {
            setWorking(false);
            onClose?.();
        }
    }, [working, willCreateCount, groups, excludedTabIds, tabById, state.tabGroups, dispatch, onClose]);

    return {
        // state
        groups, setGroups,
        activeGroupId, setActiveGroupId,
        activeGroup,
        excludedTabIds, setExcludedTabIds,
        dragItem,
        overGroupId,
        working,
        domainPrefs,
        hoveredRootDomain, setHoveredRootDomain,
        tabById,
        activeTabs,

        // derived
        willCreateCount,
        totalSelectedTabs,
        tabCountForGroup,

        // actions
        toggleGroup,
        renameGroup,
        addCustomGroup,
        handleToggleSplit,
        toggleExclude,
        toggleAllInActive,
        buildGroups,

        // dnd
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel,

        // confirm
        handleConfirm,
    };
}
