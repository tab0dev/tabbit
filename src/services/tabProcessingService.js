import { TAB_PROCESSING_MODES } from '../store/tabProcessingModes';

function withOriginalIndex(tabs) {
  return tabs.map((tab, index) => ({ tab, index }));
}

function stripWrapper(wrapped) {
  return wrapped.map(({ tab }) => tab);
}

function normalizeHostname(url) {
  if (!url) return 'unknown';
  try {
    const u = new URL(url);
    return u.hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

function autoStrategy(tabs) {
  // Preserve existing behavior for now.
  return tabs;
}

function oldestFirstStrategy(tabs) {
  const wrapped = withOriginalIndex(tabs);
  wrapped.sort((a, b) => {
    const aTime = a.tab.lastAccessed ?? Infinity;
    const bTime = b.tab.lastAccessed ?? Infinity;
    if (aTime !== bTime) return aTime - bTime;
    return a.index - b.index;
  });
  return stripWrapper(wrapped);
}

function alphabeticalStrategy(tabs) {
  const wrapped = withOriginalIndex(tabs);
  wrapped.sort((a, b) => {
    const aTitle = (a.tab.title || '').toLowerCase();
    const bTitle = (b.tab.title || '').toLowerCase();
    if (aTitle !== bTitle) return aTitle.localeCompare(bTitle);
    const aUrl = (a.tab.url || '').toLowerCase();
    const bUrl = (b.tab.url || '').toLowerCase();
    if (aUrl !== bUrl) return aUrl.localeCompare(bUrl);
    return a.index - b.index;
  });
  return stripWrapper(wrapped);
}

function newestFirstStrategy(tabs) {
  const wrapped = withOriginalIndex(tabs);
  wrapped.sort((a, b) => {
    const aTime = a.tab.lastAccessed ?? 0;
    const bTime = b.tab.lastAccessed ?? 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.index - b.index;
  });
  return stripWrapper(wrapped);
}

function randomStrategy(tabs) {
  const result = [...tabs];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function groupBySiteStrategy(tabs) {
  const groups = new Map();

  tabs.forEach((tab, index) => {
    const key = normalizeHostname(tab.url);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push({ tab, index });
  });

  const groupedArrays = Array.from(groups.entries());

  groupedArrays.sort((aEntry, bEntry) => {
    const [aKey, aTabs] = aEntry;
    const [bKey, bTabs] = bEntry;
    if (aTabs.length !== bTabs.length) {
      // Larger groups first
      return bTabs.length - aTabs.length;
    }
    return aKey.localeCompare(bKey);
  });

  const ordered = [];
  for (const [, wrappedTabs] of groupedArrays) {
    // Preserve original relative order within each site group
    wrappedTabs.sort((a, b) => a.index - b.index);
    ordered.push(...wrappedTabs);
  }

  return stripWrapper(ordered);
}

const STRATEGIES = {
  [TAB_PROCESSING_MODES.AUTO]: autoStrategy,
  [TAB_PROCESSING_MODES.OLDEST_FIRST]: oldestFirstStrategy,
  [TAB_PROCESSING_MODES.GROUP_BY_SITE]: groupBySiteStrategy,
  [TAB_PROCESSING_MODES.ALPHABETICAL]: alphabeticalStrategy,
  [TAB_PROCESSING_MODES.NEWEST_FIRST]: newestFirstStrategy,
  [TAB_PROCESSING_MODES.RANDOM]: randomStrategy,
};

export function applyTabProcessing(tabs, mode) {
  const strategy = STRATEGIES[mode] || STRATEGIES[TAB_PROCESSING_MODES.AUTO];
  // Always work on a shallow copy to avoid mutating callers' arrays.
  return strategy([...tabs]);
}

