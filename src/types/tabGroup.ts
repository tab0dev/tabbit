import { GroupId, TabId, WindowId, TriageTab } from './tab';

/** Chrome tab group representation (normalized from chrome.tabGroups.query). */
export interface ChromeTabGroup {
  id: GroupId;
  title: string;
  color: chrome.tabGroups.Color;
  windowId: WindowId;
}

export type TabGroup = ChromeTabGroup;

/** Wizard group — local mutable state during the Tab Group Wizard. */
export interface WizardGroup {
  id: string; // domain key or "custom-{timestamp}"
  name: string;
  tabIds: TabId[];
  favicon: string | null;
  isCustom: boolean;
  enabled: boolean;
  rootDomain: string | null;
  canSplit: boolean;
  subdomainCount: number;
  subdomainNames?: string[];
}

/** Domain cluster from autoTabGroupService.buildDomainGroups(). */
export interface DomainCluster {
  domain: string;
  rootDomain: string;
  displayName: string;
  favicon: string | null;
  tabs: TriageTab[];
  subdomains: Set<string>;
  canSplit: boolean;
  subdomainNames?: string[];
}
