export interface AutoCloseSettings {
  enabled: boolean;
  thresholdMs: number;
  intervalMinutes: number;
}

export interface AutoSmushSettings {
  enabled: boolean;
  skipPinned: boolean;
  ignoreFragments: boolean;
  ignoreQueryStrings: boolean;
}

export interface AutoSorterSettings {
  sortBy: 'url' | 'title';
  groupSuspendedTabs: boolean;
  tabSuspenderExtensionId: string;
  sortPinnedTabs: boolean;
  autoSortEnabled: boolean;
}

export interface AutoGrouperSettings {
  enabled: boolean;
}

export interface AutoGrouperRule {
  id: string;
  name: string;
  color: chrome.tabGroups.Color;
  patterns: RulePattern[];
}

export type RulePattern =
  | { type: 'pattern' | 'regex' | 'simple'; value: string; isRegex?: boolean }
  | {
      type: 'rough';
      target: 'hostname' | 'href' | 'title' | 'title_ignorecase';
      method: 'includes' | 'startsWith' | 'endsWith' | 'equals';
      value: string;
    };

export type PickerType = 'bookmark' | 'group';

/** Picker history entries stored in localStorage */
export interface PickerRecentEntry {
  id: string;
  title: string;
  path?: string; // bookmark folders only
  color?: string; // tab groups only
  usedAt: number; // Unix ms
}

/** Domain map entry for picker recommendations */
export interface DomainMapEntry {
  id: string;
  usedAt: number;
}

/** Tab processing sort modes */
export type TabProcessingMode =
  'auto' | 'oldest_first' | 'group_by_site' | 'alphabetical' | 'newest_first' | 'random';

/** Hotkey mapping */
export interface HotkeyMap {
  keep: string;
  close: string;
  bookmark: string;
  group: string;
  back: string;
  undo: string;
  openTab: string;
}
