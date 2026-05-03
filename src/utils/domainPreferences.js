/**
 * domainPreferences.js
 *
 * Persists per-domain split/merge preferences to localStorage.
 * Shape: { "google.com": { split: true }, "slack.com": { split: true } }
 */

const STORAGE_KEY = 'atg_domain_prefs';

/** Load all domain preferences from localStorage. */
export function loadDomainPreferences() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/** Save a single domain preference (merges with existing). */
export function saveDomainPreference(rootDomain, pref) {
    const prefs = loadDomainPreferences();
    prefs[rootDomain] = { ...prefs[rootDomain], ...pref };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    return prefs;
}

/** Check whether a specific root domain should be split by subdomain. */
export function isDomainSplit(rootDomain, prefs) {
    return prefs?.[rootDomain]?.split === true;
}
