/**
 * aiGroupingService.js
 *
 * integrates chrome's built-in prompt api (gemini nano, on-device) to
 * provide intent-aware, context-driven tab grouping.
 *
 * three exports:
 *   isAiAvailable()  — check if the prompt api + model are ready
 *   buildTabContext() — transform raw tabs into a rich prompt-friendly structure
 *   suggestGroups()   — call gemini nano and return grouped tab arrays
 */

import { extractBaseDomain } from '../utils/domainUtils';
import { relativeTime } from '../utils/formatters';

// ─────────────────────────────────────────────────────────────────────────────
// Availability check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether the Chrome Prompt API is available and the Gemini Nano
 * model is downloaded and ready.
 *
 * @returns {Promise<{ available: boolean, downloading: boolean, status: string }>}
 */
export async function isAiAvailable() {
    try {
        if (typeof LanguageModel === 'undefined') {
            return { available: false, downloading: false, status: 'unsupported' };
        }

        const status = await LanguageModel.availability();
        console.log('[Tabbit AI] availability status:', status);
        return {
            available: status === 'available',
            downloading: status === 'downloading',
            downloadable: status === 'downloadable',
            status,
        };
    } catch (err) {
        console.warn('[Tabbit AI] isAiAvailable check failed:', err.message);
        return { available: false, downloading: false, status: 'error' };
    }
}

/**
 * Actively triggers the Gemini Nano model download and reports progress.
 * Resolves when the model is ready to use.
 *
 * @param {(progress: number) => void} onProgress — called with 0.0 → 1.0
 * @param {{ signal?: AbortSignal }} options
 */
export async function downloadModel(onProgress, { signal } = {}) {
    console.log('[Tabbit AI] downloadModel() — triggering download...');
    const session = await LanguageModel.create({
        monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
                console.log(`[Tabbit AI] download progress: ${(e.loaded * 100).toFixed(1)}%`);
                onProgress?.(e.loaded);
            });
        },
        signal,
    });
    session.destroy(); // free memory, model stays cached
    console.log('[Tabbit AI] downloadModel() — model ready');
}

/** safely extract pathname from a url (e.g. "/recipes/fried-chicken"). */
function safePath(url) {
    try {
        const u = new URL(url);
        // Strip trailing slash for cleanliness
        const path = u.pathname.replace(/\/$/, '') || '/';
        return path;
    } catch {
        return '/';
    }
}



/**
 * Transforms an array of raw Chrome tab objects into a structured format
 * optimized for the LLM prompt. Includes temporal, spatial, and relational
 * signals that help the model group by intent rather than just domain.
 *
 * @param {chrome.tabs.Tab[]} tabs
 * @returns {Array<{
 *   index: number,
 *   tabId: number,
 *   title: string,
 *   domain: string,
 *   path: string,
 *   ageMinutes: number|null,
 *   ageLabel: string|null,
 *   windowId: number,
 *   tabIndex: number,
 *   openerIndex: number|null,
 *   pinned: boolean,
 * }>}
 */
export function buildTabContext(tabs) {
    const now = Date.now();

    // Build a lookup from tab.id → prompt index to reference openers
    // by their prompt index (#N) rather than by Chrome's internal tab ID.
    const idToIndex = new Map();
    tabs.forEach((t, i) => idToIndex.set(t.id, i));

    return tabs.map((tab, index) => {
        const ageMs = tab.lastAccessed ? now - tab.lastAccessed : null;
        const openerIdx = tab.openerTabId != null ? (idToIndex.get(tab.openerTabId) ?? null) : null;

        return {
            index,
            tabId: tab.id,
            title: (tab.title || '').slice(0, 65),
            domain: extractBaseDomain(tab.url) || '',
            path: safePath(tab.url),
            ageMinutes: ageMs != null ? Math.round(ageMs / 60000) : null,
            ageLabel: tab.lastAccessed ? relativeTime(tab.lastAccessed) : null,
            windowId: tab.windowId,
            tabIndex: tab.index,
            openerIndex: openerIdx,
            pinned: tab.pinned,
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt construction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats an array of tab context objects into a compact, pipe-delimited
 * string for the LLM prompt. Each line contains the signals the model needs
 * to infer user intent and browsing context.
 */
function formatTabsForPrompt(tabCtx) {
    return tabCtx.map(t => {
        const parts = [`#${t.index}`, `"${t.title}"`, t.domain];
        if (t.path && t.path !== '/') parts.push(t.path);
        if (t.ageLabel) parts.push(t.ageLabel);
        if (t.openerIndex != null) parts.push(`opened-from:#${t.openerIndex}`);
        return parts.join(' | ');
    }).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Nano integration
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Group tabs into categories based on the user's distinct activities.

INPUT FORMAT:
[Index] | "[Title]" | [Domain] | [Path] | [Age] | [Opener]

CRITICAL INSTRUCTIONS:
1. Group tabs by their underlying INTENT, NOT by their website.
2. If multiple tabs relate to the same task (e.g., researching a product, learning a topic), group them together.
3. Use "opened-from" and Age to link tabs from the same session.
4. Name groups with 1 or 2 simple words (e.g., "Watches", "Work", "Cooking").
5. NEVER name groups "Google Search", "YouTube", or "Social Media". Look past the domain to the actual topic!

EXAMPLE INPUT:
0 | "Software Engineer Jobs" | linkedin.com | /jobs | 5m ago
1 | "Rolex Submariner" | google.com | /search | 2m ago
2 | "10 Best Luxury Watches" | youtube.com | /watch | 1m ago | opened-from:1
3 | "Apply - TechCorp" | techcorp.com | /careers | 1m ago | opened-from:0

EXAMPLE OUTPUT:
Job Search: 0, 3
Watches: 1, 2`;

/**
 * Calls the Chrome Prompt API (Gemini Nano) to group tabs by intent.
 *
 * @param {chrome.tabs.Tab[]} tabs  — raw tab objects (must have id, title, url, etc.)
 * @param {{ signal?: AbortSignal, onPhaseChange?: (phase: string) => void }} options
 * @returns {Promise<Array<{ name: string, tabs: chrome.tabs.Tab[] }>>}
 */
export async function suggestGroups(tabs, { signal, onPhaseChange } = {}) {
    const tabCtx = buildTabContext(tabs);
    const tabLines = formatTabsForPrompt(tabCtx);

    // ── Abort wiring ──────────────────────────────────────────────────────────
    // IMPORTANT: the listener must be registered BEFORE the first `await`
    // (LanguageModel.create) — that is the slow path where session creation
    // can take several seconds while the model loads into GPU/CPU memory.
    //
    // If registered AFTER create(), any cancellation that
    // fires during that await would never reach the listener, meaning
    // session.destroy() would never be called and the model would keep burning
    // resources until the AbortError finally propagated through the promise chain.
    //
    // Using a mutable `session` ref allows registering the listener now, and
    // still reference the session object that won't exist until create() resolves.
    let session = null;

    const onAbort = () => {
        const phase = session ? 'inference' : 'session-create';
        console.log(`[Tabbit AI] Cancellation requested during ${phase} — destroying session`);
        session?.destroy();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
        // ── Session creation ──────────────────────────────────────────────────
        // This is where Chrome loads Gemini Nano into GPU/CPU memory.
        // The signal is passed so Chrome can abort internally if needed.
        console.log('[Tabbit AI] Creating session…');
        onPhaseChange?.('initializing');
        const t0 = performance.now();
        session = await LanguageModel.create({
            initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
            expectedInputs: [{ type: 'text', languages: ['en'] }],
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
            signal,
        });
        const t1 = performance.now();
        console.log(`[Tabbit AI] Session ready in ${(t1 - t0).toFixed(0)}ms — starting inference…`);

        // Safety valve: if the signal fired in the narrow synchronous window
        // between create() resolving and the await resuming, bail immediately.
        if (signal?.aborted) {
            session.destroy();
            throw new DOMException('Aborted', 'AbortError');
        }

        // ── Inference ─────────────────────────────────────────────────────────
        onPhaseChange?.('inferencing');
        const promptText = `Group these ${tabs.length} browser tabs by intent. Each tab index (0-${tabs.length - 1}) must appear in exactly one group.\n\n${tabLines}`;

        const t2 = performance.now();
        const result = await session.prompt(promptText, { signal });
        const t3 = performance.now();
        console.log(`[Tabbit AI] Inference completed in ${(t3 - t2).toFixed(0)}ms`);
        console.log(`[Tabbit AI] Raw Inference Result:\n------------------\n${result}\n------------------`);

        // ── Parsing: Robust Line-by-Line ──────────────────────────────────────
        onPhaseChange?.('parsing');
        const parsedGroups = [];
        const lines = result.split('\n');
        
        for (const line of lines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx > 0) {
                // Strip leading/trailing spaces, markdown bullets (- or *), and bold asterisks
                let name = line.substring(0, colonIdx).replace(/^[-*\s]+|[-*\s]+$/g, '');
                
                // If the name is wrapped in quotes, strip them
                name = name.replace(/^["']|["']$/g, '').trim();

                const indicesPart = line.substring(colonIdx + 1);
                
                // Extract all continuous sequences of digits
                const indices = [];
                const numRegex = /\d+/g;
                let m;
                while ((m = numRegex.exec(indicesPart)) !== null) {
                    indices.push(parseInt(m[0], 10));
                }

                if (name && indices.length > 0) {
                    parsedGroups.push({ name, tab_indices: indices });
                }
            }
        }

        const claimed = new Set();
        const deduped = parsedGroups
            .map(g => {
                const uniqueIndices = (g.tab_indices || [])
                    .filter(i => i >= 0 && i < tabs.length && !claimed.has(i));
                uniqueIndices.forEach(i => claimed.add(i));
                return {
                    name: g.name,
                    tabs: uniqueIndices.map(i => tabs[i]),
                };
            })
            .filter(g => g.tabs.length > 0);

        // Catch any tabs the model forgot — put them in an "Other" group
        const orphanTabs = tabs.filter((_, i) => !claimed.has(i));
        if (orphanTabs.length > 0) {
            deduped.push({ name: 'Other', tabs: orphanTabs });
            console.warn(`[Tabbit AI] ${orphanTabs.length} orphan tab(s) placed in "Other" group`);
        }

        // Clean up group names — strip slashes, truncate, title-case
        for (const group of deduped) {
            group.name = group.name
                .replace(/[/|\\]+/g, ' ')     // slash → space
                .replace(/\s+/g, ' ')          // collapse whitespace
                .trim()
                .slice(0, 20);                 // hard cap
        }

        console.log(`[Tabbit AI] Result: ${deduped.length} groups, ${tabs.length} tabs (${claimed.size} claimed + ${orphanTabs.length} orphans)`);
        return deduped;
    } finally {
        // Always remove the abort listener and destroy the session.
        // destroy() is idempotent — safe to call even if onAbort already called it.
        signal?.removeEventListener('abort', onAbort);
        session?.destroy();
    }
}
