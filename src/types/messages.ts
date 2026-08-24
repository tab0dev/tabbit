import { TabId } from './tab';

/** Messages sent FROM the React app TO background.js */
export type BackgroundRequest = { type: 'captureTab'; tabId: TabId } | { type: 'sortTabs' };

/** Responses FROM background.js TO the React app */
export type CaptureResponse = { ok: true; dataUrl: string } | { ok: false; error: string };

export type SortResponse = { ok: true } | { ok: false; error: string };
