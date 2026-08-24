import { TabId, WindowId, TriageTab } from './tab';

export interface AiAvailability {
  available: boolean;
  downloading: boolean;
  downloadable?: boolean;
  status: string;
}

export interface TabContext {
  index: number;
  tabId: TabId;
  title: string;
  domain: string;
  path: string;
  ageMinutes: number | null;
  ageLabel: string | null;
  windowId: WindowId;
  tabIndex: number;
  openerIndex: number | null;
  pinned: boolean;
}

export interface AiGroupSuggestion {
  name: string;
  tabs: TriageTab[];
}
