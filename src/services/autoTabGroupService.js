import { extractRegistrableDomain, extractRootDomain, extractSubdomainLabel, extractBaseDomain } from '../utils/domainUtils';
import { isDomainSplit } from '../utils/domainPreferences';

/**
 * autoTabGroupService.js
 *
 * Brand-first grouping: all tabs are grouped by root domain by default.
 * Domains the user has explicitly "split" are grouped by full hostname instead.
 */


// ─────────────────────────────────────────────────────────────────────────────
// Title extraction — domain-agnostic smart naming
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds the longest common prefix across an array of tab titles,
 * trimmed to the last word boundary.
 *
 * e.g. ["Gmail - Inbox", "Gmail - Sent"] → "Gmail"
 *      ["Stripe Docs: API", "Stripe Docs: Webhooks"] → "Stripe Docs"
 *
 * Returns null if no meaningful common prefix (< 3 chars after trimming).
 */
export function findCommonTitlePrefix(tabs) {
    const titles = tabs.map(t => (t.title || '').trim()).filter(Boolean);
    if (titles.length < 2) return null;

    // Find the common prefix character-by-character
    let prefix = titles[0];
    for (let i = 1; i < titles.length; i++) {
        let j = 0;
        while (j < prefix.length && j < titles[i].length && prefix[j] === titles[i][j]) j++;
        prefix = prefix.slice(0, j);
        if (!prefix) return null;
    }

    // Trim to last clean word boundary — iteratively strip trailing delimiters
    // and any short fragments left behind (e.g. "Acme Corp | #" → "Acme Corp")
    let prev;
    do {
        prev = prefix;
        prefix = prefix.replace(/[\s\-:·|/#@()\[\]{}]+$/, '').trim();
    } while (prefix !== prev && prefix.length > 0);

    // If the prefix ends mid-word (doesn't match any full title), truncate to
    // the last delimiter boundary. e.g. "Google Docs - Doc" → "Google Docs"
    const endsCleanly = titles.some(t => t === prefix) ||
                        titles.every(t => {
                            const after = t[prefix.length];
                            return !after || /[\s\-:·|/#@]/.test(after);
                        });
    if (!endsCleanly) {
        // Truncate to content before the last delimiter+fragment sequence
        // e.g. "Google Docs - Doc" → capture "Google Docs", discard " - Doc"
        const delimMatch = prefix.match(/^(.+)[\s\-:·|/#@]+\S*$/);
        if (delimMatch) {
            prefix = delimMatch[1].replace(/[\s\-:·|/#@]+$/, '').trim();
        }
    }

    return prefix.length >= 3 ? prefix : null;
}

/**
 * Derives a human-friendly name for a subdomain group.
 * Tries: (1) common title prefix, (2) "Brand · Subdomain", (3) brand name.
 */
export function buildSubdomainName(hostname, tabs, brandName) {
    // Try title extraction first — best signal
    const titlePrefix = findCommonTitlePrefix(tabs);
    if (titlePrefix) return titlePrefix;

    // Fall back to subdomain label
    const sub = extractSubdomainLabel(hostname);
    if (sub) {
        const label = sub.charAt(0).toUpperCase() + sub.slice(1);
        return `${brandName} · ${label}`;
    }

    return brandName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core grouping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given an array of Chrome Tab objects and domain preferences, returns clusters
 * sorted by descending tab count.
 *
 * Default: group by root domain ("google.com" → one cluster).
 * If a domain has split=true in preferences: group by full hostname instead.
 *
 * Returns: Array<{
 *   domain,            // group key (root domain or full hostname)
 *   rootDomain,        // always the root domain
 *   displayName,       // human-friendly name
 *   favicon,
 *   tabs[],
 *   subdomains,        // Set of distinct full hostnames in this group
 *   canSplit,          // true if ≥2 distinct subdomains exist
 * }>
 */
export function buildDomainGroups(tabs, preferences = {}) {
    // Step 1: bucket every tab by root domain
    const rootBuckets = new Map();

    for (const tab of tabs) {
        const hostname = extractBaseDomain(tab.url);
        if (!hostname) continue;
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) continue;

        const rootDomain = extractRootDomain(hostname) || hostname;

        if (!rootBuckets.has(rootDomain)) {
            rootBuckets.set(rootDomain, { tabs: [], hostnames: new Set() });
        }
        const bucket = rootBuckets.get(rootDomain);
        bucket.tabs.push({ ...tab, _hostname: hostname });
        bucket.hostnames.add(hostname);
    }

    // Step 2: for each root domain, decide to merge or split
    const clusters = [];

    for (const [rootDomain, bucket] of rootBuckets) {
        const brandName = extractRegistrableDomain(rootDomain);
        const shouldSplit = isDomainSplit(rootDomain, preferences);
        const canSplit = bucket.hostnames.size >= 2;

        if (shouldSplit && canSplit) {
            // Split mode — one cluster per unique hostname
            const hostMap = new Map();
            for (const tab of bucket.tabs) {
                const h = tab._hostname;
                if (!hostMap.has(h)) {
                    hostMap.set(h, { tabs: [], favicon: null });
                }
                const entry = hostMap.get(h);
                entry.tabs.push(tab);
                if (!entry.favicon && tab.favIconUrl) entry.favicon = tab.favIconUrl;
            }

            for (const [hostname, entry] of hostMap) {
                clusters.push({
                    domain: hostname,
                    rootDomain,
                    displayName: buildSubdomainName(hostname, entry.tabs, brandName),
                    favicon: entry.favicon,
                    tabs: entry.tabs,
                    subdomains: new Set([hostname]),
                    canSplit: false, // already split
                });
            }
        } else {
            // Merged mode — one cluster for the whole root domain
            const favicon = bucket.tabs.find(t => t.favIconUrl)?.favIconUrl || null;

            // Preview subdomain names for the split button label
            let subdomainNames = [];
            if (canSplit) {
                const hostMap = new Map();
                for (const tab of bucket.tabs) {
                    const h = tab._hostname;
                    if (!hostMap.has(h)) hostMap.set(h, []);
                    hostMap.get(h).push(tab);
                }
                subdomainNames = [...hostMap.entries()].map(
                    ([hostname, tabs]) => buildSubdomainName(hostname, tabs, brandName)
                );
            }

            clusters.push({
                domain: rootDomain,
                rootDomain,
                displayName: brandName,
                favicon,
                tabs: bucket.tabs,
                subdomains: bucket.hostnames,
                canSplit,
                subdomainNames,
            });
        }
    }

    // Clean up the temporary _hostname property
    for (const c of clusters) {
        for (const tab of c.tabs) {
            delete tab._hostname;
        }
    }

    return clusters.sort((a, b) => b.tabs.length - a.tabs.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// Name deduplication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a group name that doesn't conflict with any existing tab group titles.
 * If `name` is already taken, appends " 2", " 3", etc.
 */
export function buildDistinctGroupName(desiredName, existingTitles) {
    const taken = new Set(existingTitles.map(t => t.toLowerCase()));
    if (!taken.has(desiredName.toLowerCase())) return desiredName;
    let n = 2;
    while (taken.has(`${desiredName.toLowerCase()} ${n}`)) n++;
    return `${desiredName} ${n}`;
}
